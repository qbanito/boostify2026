/**
 * POST /api/musicians/import
 * --------------------------------------------------------------
 * Bulk import musicians from CSV text, JSON array or raw objects.
 *
 * Strategy
 *   1. Normalize every incoming row (flexible header names).
 *   2. For each row:
 *        a. Skip if the name is empty.
 *        b. (Optional) create a companion `users` row so the
 *           imported musician can eventually log in / receive
 *           messages — seeded with a master JSON stub.
 *        c. Upsert the `musicians` row (keyed on userId + name).
 *   3. Persist a `musician_import_batches` audit entry.
 *
 * Accepted columns (any case, underscores/spaces/hyphens OK):
 *   name* | instrument | category | description | price | rating
 *   genres (comma-separated) | photo / image | email | phone
 *   country | city | spotify | instagram | tiktok | youtube
 *
 *   (* = required)
 */

import { Router } from 'express';
import { db } from '../db';
import {
  musicians,
  musicianImportBatches,
  users,
} from '../../db/schema';
import { and, eq } from 'drizzle-orm';
import { isAuthenticated } from '../middleware/clerk-auth';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────
function slugify(name: string, suffix?: number | string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return suffix != null ? `${base}-${suffix}` : base;
}

function parseCsv(text: string): Record<string, string>[] {
  // Minimal CSV parser that honors quoted fields. Good enough for
  // manual pastes; for production-grade uploads the client should
  // send JSON.
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        cur.push(field); field = '';
        if (cur.some(f => f.length > 0)) rows.push(cur);
        cur = [];
      } else { field += c; }
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }

  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/[\s_-]+/g, ''));
  return rows.slice(1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
    return obj;
  });
}

function pick(obj: Record<string, any>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim().length > 0) return String(v).trim();
  }
  return undefined;
}

function normalizeRow(raw: Record<string, any>) {
  // Flatten keys for tolerant header matching
  const flat: Record<string, any> = {};
  for (const k of Object.keys(raw)) {
    flat[k.toLowerCase().replace(/[\s_-]+/g, '')] = raw[k];
  }
  const name = pick(flat, ['name', 'fullname', 'artistname', 'title', 'musician']);
  if (!name) return null;
  const instrument = pick(flat, ['instrument', 'role', 'skill']) || 'Other';
  const category = pick(flat, ['category', 'type']) || instrument;
  const description = pick(flat, ['description', 'bio', 'about']) || `${name} — ${instrument} specialist.`;
  const priceRaw = pick(flat, ['price', 'rate', 'fee']) || '100';
  const price = String(Number.parseFloat(String(priceRaw).replace(/[^0-9.]/g, '')) || 100);
  const ratingRaw = pick(flat, ['rating', 'score']);
  const rating = ratingRaw ? String(Math.max(0, Math.min(5, Number.parseFloat(ratingRaw)))) : '5.0';
  const reviews = Math.max(0, parseInt(pick(flat, ['totalreviews', 'reviews', 'reviewcount']) || '0', 10));
  const genresRaw = pick(flat, ['genres', 'genre', 'styles', 'style']) || '';
  const genres = genresRaw
    .split(/[,;|]/)
    .map(g => g.trim())
    .filter(Boolean);
  const photo = pick(flat, ['photo', 'image', 'imageurl', 'avatar', 'picture']) || '';
  const email = pick(flat, ['email', 'mail', 'contactemail']);
  const phone = pick(flat, ['phone', 'mobile', 'telephone']);
  const country = pick(flat, ['country']);
  const city = pick(flat, ['city']);
  const spotify = pick(flat, ['spotify', 'spotifyurl']);
  const instagram = pick(flat, ['instagram', 'instagramhandle', 'ig']);
  const tiktok = pick(flat, ['tiktok']);
  const youtube = pick(flat, ['youtube', 'youtubechannel']);

  return {
    name, instrument, category, description,
    price, rating, reviews, genres, photo,
    email, phone, country, city, spotify, instagram, tiktok, youtube,
  };
}

// ── Routes ─────────────────────────────────────────────────────────

/**
 * POST /api/musicians/import
 * Body shape (any one of):
 *   { csv: "name,instrument,...\n..." , createProfiles?: boolean }
 *   { rows: [{...}, {...}],           createProfiles?: boolean }
 *   { json: "[{...},{...}]",          createProfiles?: boolean }
 */
router.post('/musicians/import', isAuthenticated, async (req, res) => {
  try {
    const { csv, json, rows, createProfiles = true, fileName } = req.body || {};

    // Resolve importer pg user id (optional)
    const clerkUserId = (req as any).user?.id as string | undefined;
    let importedBy: number | null = null;
    if (clerkUserId) {
      const [u] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, clerkUserId))
        .limit(1);
      importedBy = u?.id ?? null;
    }

    let sourceRows: Record<string, any>[] = [];
    let source: 'csv' | 'json' | 'manual' = 'manual';

    if (typeof csv === 'string' && csv.trim().length > 0) {
      sourceRows = parseCsv(csv);
      source = 'csv';
    } else if (typeof json === 'string' && json.trim().length > 0) {
      try {
        const parsed = JSON.parse(json);
        sourceRows = Array.isArray(parsed) ? parsed : [parsed];
        source = 'json';
      } catch (e: any) {
        return res.status(400).json({ success: false, error: `Invalid JSON: ${e.message}` });
      }
    } else if (Array.isArray(rows)) {
      sourceRows = rows;
      source = 'manual';
    } else {
      return res.status(400).json({ success: false, error: 'Provide `csv`, `json`, or `rows`.' });
    }

    if (sourceRows.length === 0) {
      return res.status(400).json({ success: false, error: 'No rows to import.' });
    }
    if (sourceRows.length > 2000) {
      return res.status(400).json({ success: false, error: 'Batch too large (max 2000 rows).' });
    }

    const errorLog: Array<{ row: number; error: string; data?: any }> = [];
    let successCount = 0;
    let skipCount = 0;
    const createdMusicians: any[] = [];

    for (let i = 0; i < sourceRows.length; i++) {
      const raw = sourceRows[i];
      try {
        const n = normalizeRow(raw);
        if (!n) { skipCount++; errorLog.push({ row: i + 1, error: 'Missing name', data: raw }); continue; }

        // Optionally create a companion users row (used by the messaging
        // system so this musician can receive messages).
        let companionUserId: number | null = null;
        if (createProfiles) {
          try {
            const syntheticUsername = `imported_musician_${Date.now()}_${i}`;
            const [created] = await db
              .insert(users)
              .values({
                username: syntheticUsername,
                password: 'imported-musician',
                artistName: n.name,
                role: 'artist',
                email: n.email || null,
                phone: n.phone || null,
                biography: n.description,
                genre: n.genres[0] || null,
                genres: n.genres.length > 0 ? n.genres : null,
                country: n.country || null,
                spotifyUrl: n.spotify || null,
                instagramHandle: n.instagram || null,
                tiktokUrl: n.tiktok || null,
                youtubeChannel: n.youtube || null,
                profileImage: n.photo || null,
                slug: slugify(n.name, Date.now()),
                masterJson: {
                  meta: {
                    source: 'musician-import',
                    importedAt: new Date().toISOString(),
                    enrichmentStatus: 'seeded',
                  },
                  identity: {
                    artistName: n.name,
                    bio: { medium: n.description },
                  },
                  contact: { email: n.email || null, phone: n.phone || null },
                  platforms: {
                    spotify: n.spotify ? { url: n.spotify } : null,
                    instagram: n.instagram ? { handle: n.instagram.replace(/^@/, '') } : null,
                    tiktok: n.tiktok ? { url: n.tiktok } : null,
                    youtube: n.youtube ? { url: n.youtube } : null,
                  },
                  music: { genres: n.genres },
                  producerTools: {
                    isMusician: true,
                    instrument: n.instrument,
                    category: n.category,
                    defaultRate: Number(n.price),
                  },
                } as any,
              })
              .returning({ id: users.id });
            companionUserId = created?.id ?? null;
          } catch (profileErr: any) {
            // Non-fatal — we still insert the musician row
            console.warn('[musician-import] companion user failed:', profileErr.message);
          }
        }

        // Upsert musician: if (userId + name) already exists, update; else insert
        let musician: any = null;
        if (companionUserId) {
          const [existing] = await db
            .select()
            .from(musicians)
            .where(and(eq(musicians.userId, companionUserId), eq(musicians.name, n.name)))
            .limit(1);
          if (existing) {
            const [updated] = await db
              .update(musicians)
              .set({
                instrument: n.instrument,
                category: n.category,
                description: n.description,
                price: n.price,
                rating: n.rating,
                totalReviews: n.reviews,
                genres: n.genres,
                photo: n.photo || existing.photo,
                updatedAt: new Date(),
              })
              .where(eq(musicians.id, existing.id))
              .returning();
            musician = updated;
          }
        }
        if (!musician) {
          const [inserted] = await db
            .insert(musicians)
            .values({
              userId: companionUserId,
              name: n.name,
              photo: n.photo || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(n.name),
              instrument: n.instrument,
              category: n.category,
              description: n.description,
              price: n.price,
              rating: n.rating,
              totalReviews: n.reviews,
              genres: n.genres.length > 0 ? n.genres : [n.category],
              isActive: true,
            })
            .returning();
          musician = inserted;
        }
        createdMusicians.push(musician);
        successCount++;
      } catch (rowErr: any) {
        errorLog.push({ row: i + 1, error: rowErr?.message || String(rowErr), data: raw });
      }
    }

    const errorCount = errorLog.length - skipCount;
    const [batch] = await db
      .insert(musicianImportBatches)
      .values({
        importedBy,
        source,
        fileName: fileName || null,
        totalRows: sourceRows.length,
        successCount,
        skipCount,
        errorCount: Math.max(0, errorCount),
        errorLog,
      })
      .returning();

    return res.status(200).json({
      success: true,
      batch,
      summary: {
        total: sourceRows.length,
        success: successCount,
        skipped: skipCount,
        errors: Math.max(0, errorCount),
      },
      errorLog,
    });
  } catch (err: any) {
    console.error('[musician-import] failed:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Import failed' });
  }
});

/**
 * GET /api/musicians/import/batches — recent import history
 */
router.get('/musicians/import/batches', isAuthenticated, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(musicianImportBatches)
      .orderBy(musicianImportBatches.createdAt)
      .limit(50);
    return res.json({ success: true, data: rows.reverse() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch batches' });
  }
});

export default router;
