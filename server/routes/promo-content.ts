import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db, pool } from '../../db';
import { songs, artistMedia, merchandise, concertEvents, users } from '../../db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

/**
 * Promo Content Library — shared aggregator that turns an artist's existing
 * databases (songs, videos, merch products, concert tickets, gallery artworks)
 * into ready-to-use promotional links + media + pre-written captions.
 *
 * Consumed by the publishing modules (WhatsApp, Telegram, Discord) and the
 * Reddit intelligence center so the artist never has to write a post from
 * scratch — they just pick a piece of content and its link/media/caption are
 * injected into the composer as easy variables.
 */
const router = Router();

export type PromoContentType = 'song' | 'video' | 'product' | 'ticket' | 'gallery';

export interface PromoContentItem {
  id: string;
  type: PromoContentType;
  title: string;
  subtitle?: string;
  link: string;       // public landing URL (clickable)
  mediaUrl?: string;  // image/poster/cover to attach (sendMedia)
  caption: string;    // pre-written promo line (already includes the link)
}

function getBaseUrl(req: Request): string {
  const canonical = (process.env.PRODUCTION_URL || process.env.APP_URL || '').replace(/\/$/, '');
  if (canonical && process.env.NODE_ENV === 'production') return canonical;
  const origin = req.headers.origin;
  if (typeof origin === 'string' && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, '');
  const referer = req.headers.referer;
  if (typeof referer === 'string') {
    try { const u = new URL(referer); return `${u.protocol}//${u.host}`; } catch { /* ignore */ }
  }
  if (canonical) return canonical;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0];
  const proto = forwardedProto || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5001';
  return `${proto}://${host}`;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

function fmtMoney(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `$${n.toFixed(2)}`;
}

// ──────────────────────────────────────────────
// GET /api/promo-content/:artistId
// Returns the artist's promotable content as ready-to-use links + captions.
// Optional ?type=song|video|product|ticket|gallery to filter, ?limit= per type.
// ──────────────────────────────────────────────
router.get('/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(String(req.params.artistId), 10);
    if (!Number.isFinite(artistId)) {
      return res.status(400).json({ success: false, error: 'invalid artistId' });
    }
    const onlyType = String(req.query.type || '').trim() as PromoContentType | '';
    const perType = Math.min(Math.max(parseInt(String(req.query.limit || '24'), 10) || 24, 1), 50);
    const base = getBaseUrl(req);

    // Resolve artist slug + name (for /artist/:slug links).
    const [artistRow] = await db
      .select({ id: users.id, slug: users.slug, artistName: users.artistName, username: users.username })
      .from(users)
      .where(eq(users.id, artistId))
      .limit(1);

    const slug = artistRow?.slug || artistRow?.username || String(artistId);
    const artistName = artistRow?.artistName || artistRow?.username || 'el artista';
    const profileUrl = `${base}/artist/${slug}`;
    const storeUrl = `${base}/artist/${slug}/store`;

    const wants = (t: PromoContentType) => !onlyType || onlyType === t;
    const items: PromoContentItem[] = [];

    // ── SONGS ──
    if (wants('song')) {
      try {
        const rows = await db
          .select()
          .from(songs)
          .where(and(eq(songs.userId, artistId), eq(songs.isPublished, true)))
          .orderBy(desc(songs.createdAt))
          .limit(perType);
        for (const s of rows) {
          items.push({
            id: `song-${s.id}`,
            type: 'song',
            title: s.title,
            subtitle: [s.genre, s.mood].filter(Boolean).join(' · ') || undefined,
            link: profileUrl,
            mediaUrl: s.coverArt || undefined,
            caption: `🎵 Escucha "${s.title}" de ${artistName} 👉 ${profileUrl}`,
          });
        }
      } catch (e: any) { console.warn('[promo-content] songs error:', e?.message); }
    }

    // ── VIDEOS (artist_media type=video) ──
    if (wants('video')) {
      try {
        const rows = await db
          .select()
          .from(artistMedia)
          .where(and(eq(artistMedia.userId, artistId), eq(artistMedia.type, 'video'), eq(artistMedia.isPublished, true)))
          .orderBy(desc(artistMedia.createdAt))
          .limit(perType);
        for (const v of rows) {
          items.push({
            id: `video-${v.id}`,
            type: 'video',
            title: v.title,
            subtitle: v.duration || undefined,
            link: profileUrl,
            mediaUrl: v.thumbnail || undefined,
            caption: `🎬 Mira el nuevo video "${v.title}" de ${artistName} 👉 ${profileUrl}`,
          });
        }
      } catch (e: any) { console.warn('[promo-content] videos error:', e?.message); }
    }

    // ── PRODUCTS (merchandise) ──
    if (wants('product')) {
      try {
        const rows = await db
          .select()
          .from(merchandise)
          .where(and(eq(merchandise.userId, artistId), eq(merchandise.isAvailable, true)))
          .orderBy(desc(merchandise.createdAt))
          .limit(perType);
        for (const p of rows) {
          const price = fmtMoney(p.price);
          items.push({
            id: `product-${p.id}`,
            type: 'product',
            title: p.name,
            subtitle: price || undefined,
            link: storeUrl,
            mediaUrl: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : undefined,
            caption: `🛍️ ${p.name}${price ? ` (${price})` : ''} ya disponible en la tienda de ${artistName} 👉 ${storeUrl}`,
          });
        }
      } catch (e: any) { console.warn('[promo-content] products error:', e?.message); }
    }

    // ── TICKETS / CONCERTS ──
    if (wants('ticket')) {
      try {
        const rows = await db
          .select()
          .from(concertEvents)
          .where(and(eq(concertEvents.artistId, artistId), inArray(concertEvents.status, ['published', 'live'])))
          .orderBy(desc(concertEvents.startsAt))
          .limit(perType);
        for (const c of rows) {
          const when = fmtDate(c.startsAt as any);
          const where = [c.venue, c.location].filter(Boolean).join(', ');
          items.push({
            id: `ticket-${c.id}`,
            type: 'ticket',
            title: c.title,
            subtitle: [when, where].filter(Boolean).join(' · ') || undefined,
            link: profileUrl,
            mediaUrl: c.posterUrl || undefined,
            caption: `🎟️ ${artistName} en vivo: "${c.title}"${when ? ` · ${when}` : ''}${where ? ` · ${where}` : ''}. Consigue tu entrada 👉 ${profileUrl}`,
          });
        }
      } catch (e: any) { console.warn('[promo-content] tickets error:', e?.message); }
    }

    // ── GALLERY (art_artworks — raw SQL) ──
    if (wants('gallery')) {
      try {
        const { rows } = await pool.query(
          `SELECT id, title, category, image_url, price, sale_mode
             FROM art_artworks
            WHERE artist_id = $1 AND is_published = true AND status != 'archived'
            ORDER BY featured DESC, created_at DESC
            LIMIT $2`,
          [artistId, perType],
        );
        for (const a of rows) {
          const price = fmtMoney(a.price);
          items.push({
            id: `gallery-${a.id}`,
            type: 'gallery',
            title: a.title,
            subtitle: [a.category, price].filter(Boolean).join(' · ') || undefined,
            link: profileUrl,
            mediaUrl: a.image_url || undefined,
            caption: `🖼️ Obra "${a.title}" de ${artistName}${price ? ` · ${price}` : ''} en la galería 👉 ${profileUrl}`,
          });
        }
      } catch (e: any) { console.warn('[promo-content] gallery error:', e?.message); }
    }

    const counts = items.reduce<Record<string, number>>((acc, it) => {
      acc[it.type] = (acc[it.type] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      success: true,
      artist: { id: artistId, slug, name: artistName },
      baseUrl: base,
      profileUrl,
      storeUrl,
      counts,
      items,
    });
  } catch (err: any) {
    console.error('[promo-content] error:', err?.message);
    return res.status(500).json({ success: false, error: err?.message || 'failed', items: [] });
  }
});

export default router;
