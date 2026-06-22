/**
 * Facebook Groups Auto-Publishing Command Center — API routes
 * (mounted at /api/facebook-groups).
 * ---------------------------------------------------------------------------
 * A CONTROLLED auto-publishing engine for OPEN Facebook groups. It connects to
 * everything the artist wants to promote (songs, merch, social posts, concerts,
 * gallery photos), auto-prepares a publishing queue with AI-written captions,
 * paces it with daily caps + intervals, and surfaces "ready" items for a
 * ONE-CLICK manual publish into each group (Hybrid mode — ToS-conscious).
 *
 * ⚠️ Facebook's Terms of Service restrict unattended automated posting. This
 * module DEFAULTS to Hybrid mode: the engine prepares and schedules everything,
 * but the human clicks the final "Publish" per group (we open the group with
 * the caption copied to clipboard + image ready). Full unattended auto-posting
 * is left as an explicit, clearly-labelled advanced opt-in under the user's own
 * risk and is NOT performed by this backend.
 *
 * Data is stored per-artist under Firestore subcollections:
 *   artists/{artistId}/facebookGroups/{groupId}
 *   artists/{artistId}/facebookGroupQueue/{itemId}
 *   artists/{artistId}/facebookGroupSettings/config
 *   artists/{artistId}/facebookGroupLog/{logId}
 */
import { Router, Request, Response } from 'express';
import { db, FieldValue } from '../firebase';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { callAI } from '../utils/smart-ai';

const router = Router();

function nowMs() { return Date.now(); }
function artistDoc(artistId: string) { return db.collection('artists').doc(String(artistId)); }

/** Resolve the authenticated user id (Clerk-resolved PG id or string). */
function uid(req: Request): string {
  return String((req.user as any)?.id ?? (req.user as any)?.uid ?? '');
}

/** Numeric artist id (Postgres users.id) for content queries. */
function numericArtistId(artistId: string | number): number | null {
  const n = Number(artistId);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Write an audit-log entry under the artist for compliance/traceability. */
async function audit(artistId: string, action: string, detail: any, ownerId?: string) {
  try {
    await artistDoc(artistId).collection('facebookGroupLog').add({
      action, detail: detail ?? null, ownerId: ownerId ?? null, at: nowMs(),
    });
  } catch (e: any) {
    logger.warn('[fb-groups] audit write failed:', e?.message);
  }
}

// ─── Settings defaults ───────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  autopilot: false,          // auto-prepare the queue from content on a cadence
  hybridMode: true,          // human clicks final publish (recommended / ToS-safe)
  dailyCap: 8,               // max items to surface as "ready" per day
  minIntervalMinutes: 45,    // min spacing between two ready items
  rotateContent: true,       // cycle through content types so it isn't repetitive
  tone: 'energetic',         // caption tone
  language: 'es',            // caption language
  defaultGroupIds: [] as string[],
};

async function getSettings(artistId: string) {
  const snap = await artistDoc(artistId).collection('facebookGroupSettings').doc('config').get();
  return { ...DEFAULT_SETTINGS, ...(snap.exists ? snap.data() : {}) };
}

// ─────────────────────────── GROUPS CRUD ────────────────────────────────────

/** GET /:artistId/groups → list the artist's registered open FB groups. */
router.get('/:artistId/groups', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await artistDoc(artistId).collection('facebookGroups').orderBy('addedAt', 'desc').get();
    const groups = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, groups });
  } catch (e: any) {
    logger.error('[fb-groups] list groups error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to list groups' });
  }
});

/** POST /:artistId/groups → register an open FB group {name, url, memberCount?, category?, notes?}. */
router.post('/:artistId/groups', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { name, url, memberCount, category, notes } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    const cleanUrl = String(url || '').trim();
    if (cleanUrl && !/^https?:\/\/(www\.|m\.|web\.)?facebook\.com\//i.test(cleanUrl)) {
      return res.status(400).json({ success: false, error: 'url must be a facebook.com group link' });
    }
    const ref = await artistDoc(artistId).collection('facebookGroups').add({
      name: String(name).trim(),
      url: cleanUrl || null,
      memberCount: Number(memberCount) || null,
      category: category ? String(category).slice(0, 60) : null,
      notes: notes ? String(notes).slice(0, 500) : null,
      active: true,
      publishCount: 0,
      lastPublishedAt: null,
      addedAt: nowMs(),
      ownerId: uid(req),
    });
    await audit(artistId, 'group.add', { groupId: ref.id, name }, uid(req));
    const doc = await ref.get();
    return res.json({ success: true, group: { id: ref.id, ...doc.data() } });
  } catch (e: any) {
    logger.error('[fb-groups] add group error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to add group' });
  }
});

/** PATCH /:artistId/groups/:groupId → edit / toggle active. */
router.patch('/:artistId/groups/:groupId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, groupId } = req.params;
    const patch: Record<string, any> = {};
    const { name, url, active, memberCount, category, notes } = req.body || {};
    if (name !== undefined) patch.name = String(name).trim();
    if (url !== undefined) patch.url = String(url).trim() || null;
    if (active !== undefined) patch.active = !!active;
    if (memberCount !== undefined) patch.memberCount = Number(memberCount) || null;
    if (category !== undefined) patch.category = category ? String(category).slice(0, 60) : null;
    if (notes !== undefined) patch.notes = notes ? String(notes).slice(0, 500) : null;
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, error: 'no fields to update' });
    }
    await artistDoc(artistId).collection('facebookGroups').doc(groupId).set(patch, { merge: true });
    await audit(artistId, 'group.update', { groupId, patch }, uid(req));
    return res.json({ success: true });
  } catch (e: any) {
    logger.error('[fb-groups] update group error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to update group' });
  }
});

/** DELETE /:artistId/groups/:groupId */
router.delete('/:artistId/groups/:groupId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, groupId } = req.params;
    await artistDoc(artistId).collection('facebookGroups').doc(groupId).delete();
    await audit(artistId, 'group.delete', { groupId }, uid(req));
    return res.json({ success: true });
  } catch (e: any) {
    logger.error('[fb-groups] delete group error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to delete group' });
  }
});

// ─────────────────────────── CONTENT POOL ───────────────────────────────────

export type PromotableItem = {
  contentType: 'song' | 'merch' | 'social_post' | 'concert' | 'photo';
  contentId: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  link?: string | null;
};

/** Build a public profile link base from the artist's slug/username. */
function profileLinkBase(slug?: string | null, username?: string | null): string | null {
  const handle = (slug || username || '').toString().trim();
  if (!handle) return null;
  const base = process.env.PUBLIC_APP_URL || process.env.APP_URL || '';
  const root = base ? base.replace(/\/+$/, '') : '';
  return `${root}/artist/${handle}`;
}

/**
 * Aggregate everything the artist can promote from Postgres content tables.
 * Returns a flat, UI-friendly list grouped by contentType.
 */
export async function aggregatePromotableContent(artistPk: number): Promise<{
  artistName: string | null;
  items: PromotableItem[];
}> {
  // Resolve artist identity for links + AI context.
  const { rows: userRows } = await pool.query<{ artist_name: string | null; username: string | null; slug: string | null }>(
    'SELECT artist_name, username, slug FROM users WHERE id = $1 LIMIT 1',
    [artistPk],
  );
  const u = userRows[0] || { artist_name: null, username: null, slug: null };
  const linkBase = profileLinkBase(u.slug, u.username);

  const items: PromotableItem[] = [];

  // Songs (published)
  try {
    const { rows } = await pool.query(
      `SELECT id, title, genre, cover_art FROM songs
       WHERE user_id = $1 AND is_published = true
       ORDER BY created_at DESC LIMIT 24`,
      [artistPk],
    );
    for (const r of rows) {
      items.push({
        contentType: 'song',
        contentId: String(r.id),
        title: r.title,
        subtitle: r.genre || 'Single',
        imageUrl: r.cover_art || null,
        link: linkBase ? `${linkBase}#songs` : null,
      });
    }
  } catch (e: any) { logger.warn('[fb-groups] songs query:', e?.message); }

  // Merchandise (available)
  try {
    const { rows } = await pool.query(
      `SELECT id, name, price, images FROM merchandise
       WHERE user_id = $1 AND is_available = true
       ORDER BY created_at DESC LIMIT 24`,
      [artistPk],
    );
    for (const r of rows) {
      const img = Array.isArray(r.images) ? r.images[0] : null;
      items.push({
        contentType: 'merch',
        contentId: String(r.id),
        title: r.name,
        subtitle: r.price ? `$${r.price}` : null,
        imageUrl: img || null,
        link: linkBase ? `${linkBase}#merchandise` : null,
      });
    }
  } catch (e: any) { logger.warn('[fb-groups] merch query:', e?.message); }

  // Social posts (already have polished captions + viral images)
  try {
    const { rows } = await pool.query(
      `SELECT id, caption, image_url, cta FROM social_media_posts
       WHERE user_id = $1 AND image_url IS NOT NULL
       ORDER BY created_at DESC LIMIT 24`,
      [artistPk],
    );
    for (const r of rows) {
      const cap = String(r.caption || '').replace(/\s+/g, ' ').trim();
      items.push({
        contentType: 'social_post',
        contentId: String(r.id),
        title: cap.slice(0, 70) || 'Social post',
        subtitle: r.cta || null,
        imageUrl: r.image_url || null,
        link: linkBase ? `${linkBase}#social-posts` : null,
      });
    }
  } catch (e: any) { logger.warn('[fb-groups] social posts query:', e?.message); }

  // Concerts (published / live)
  try {
    const { rows } = await pool.query(
      `SELECT id, title, venue, location, starts_at, poster_url FROM concert_events
       WHERE artist_id = $1 AND status IN ('published','live')
       ORDER BY starts_at ASC NULLS LAST LIMIT 16`,
      [artistPk],
    );
    for (const r of rows) {
      const where = [r.venue, r.location].filter(Boolean).join(' · ');
      items.push({
        contentType: 'concert',
        contentId: String(r.id),
        title: r.title,
        subtitle: where || (r.starts_at ? new Date(r.starts_at).toLocaleDateString() : 'Live event'),
        imageUrl: r.poster_url || null,
        link: linkBase ? `${linkBase}#live-stage` : null,
      });
    }
  } catch (e: any) { logger.warn('[fb-groups] concerts query:', e?.message); }

  // Gallery photos (public)
  try {
    const { rows } = await pool.query(
      `SELECT id, image_url, title FROM artist_profile_images
       WHERE artist_profile_id = $1 AND is_public = true AND image_url IS NOT NULL
       ORDER BY display_order ASC, id DESC LIMIT 18`,
      [artistPk],
    );
    for (const r of rows) {
      items.push({
        contentType: 'photo',
        contentId: String(r.id),
        title: r.title || 'Artist photo',
        subtitle: null,
        imageUrl: r.image_url || null,
        link: linkBase || null,
      });
    }
  } catch (e: any) { logger.warn('[fb-groups] gallery query:', e?.message); }

  return { artistName: u.artist_name || u.username, items };
}

/** GET /:artistId/content → all promotable content connected to this artist. */
router.get('/:artistId/content', authenticate, async (req: Request, res: Response) => {
  try {
    const pk = numericArtistId(req.params.artistId);
    if (!pk) return res.status(400).json({ success: false, error: 'invalid artistId' });
    const { artistName, items } = await aggregatePromotableContent(pk);
    return res.json({ success: true, artistName, items, total: items.length });
  } catch (e: any) {
    logger.error('[fb-groups] content error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to aggregate content' });
  }
});

// ─────────────────────────── AI CAPTION ─────────────────────────────────────

/** Build a group-friendly, non-spammy caption for a promotable item. */
export async function buildGroupCaption(opts: {
  artistName?: string | null;
  contentType: string;
  title: string;
  subtitle?: string | null;
  link?: string | null;
  tone?: string;
  language?: string;
}): Promise<string> {
  const lang = opts.language === 'en' ? 'English' : 'Spanish';
  const tone = opts.tone || 'energetic';
  const typeLabel: Record<string, string> = {
    song: 'a song / single',
    merch: 'a merch product',
    social_post: 'a social update',
    concert: 'a live concert / event',
    photo: 'an artist photo / moment',
  };
  const sys = `You write short, authentic posts to share inside OPEN Facebook fan/music groups. Rules:
- Write in ${lang}, ${tone} but genuine tone (no corporate spam, no clickbait).
- 1-3 short sentences. Sound like a real person sharing something they love, NOT an ad.
- Add 2-4 relevant hashtags at the end.
- Do NOT use ALL CAPS, do NOT beg for likes, do NOT repeat the link in the body.
- Respect Facebook group etiquette: friendly, value-first, community-minded.`;
  const user = `Artist: ${opts.artistName || 'the artist'}
Sharing: ${typeLabel[opts.contentType] || opts.contentType}
Title: ${opts.title}${opts.subtitle ? `\nDetail: ${opts.subtitle}` : ''}
Write the post caption only (no preamble).`;
  try {
    const out = await callAI('caption', [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], { temperature: 0.85, maxTokens: 220, label: 'fb-group-caption' });
    return (out || '').trim().replace(/^["']|["']$/g, '') || opts.title;
  } catch (e: any) {
    logger.warn('[fb-groups] caption AI failed:', e?.message);
    // Graceful fallback caption.
    const tail = opts.link ? `\n\n${opts.link}` : '';
    return `${opts.title}${opts.subtitle ? ` — ${opts.subtitle}` : ''} 🎶${tail}`;
  }
}

/** POST /:artistId/generate-caption → AI caption for a content item (no enqueue). */
router.post('/:artistId/generate-caption', authenticate, async (req: Request, res: Response) => {
  try {
    const pk = numericArtistId(req.params.artistId);
    const { contentType, title, subtitle, link, tone, language } = req.body || {};
    if (!title) return res.status(400).json({ success: false, error: 'title is required' });
    const settings = await getSettings(req.params.artistId);
    let artistName: string | null = null;
    if (pk) {
      const { rows } = await pool.query<{ artist_name: string | null; username: string | null }>(
        'SELECT artist_name, username FROM users WHERE id = $1 LIMIT 1', [pk]);
      artistName = rows[0]?.artist_name || rows[0]?.username || null;
    }
    const caption = await buildGroupCaption({
      artistName,
      contentType: contentType || 'song',
      title,
      subtitle,
      link,
      tone: tone || settings.tone,
      language: language || settings.language,
    });
    return res.json({ success: true, caption });
  } catch (e: any) {
    logger.error('[fb-groups] generate-caption error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to generate caption' });
  }
});

// ─────────────────────────── GROUP DISCOVERY ────────────────────────────────

export type DiscoveredGroup = {
  name: string;
  query: string;          // suggested Facebook search query
  searchUrl: string;      // deep-link into Facebook's native group search
  niche: string;
  sizeTier: 'mega' | 'large' | 'mid' | 'niche';
  estMembers: string;     // human label, e.g. "500k+", "50k-500k" (AI estimate)
  relevance: string;      // why it fits this artist
  language?: string;
};

const SIZE_ORDER: Record<string, number> = { mega: 0, large: 1, mid: 2, niche: 3 };
const SIZE_LABEL: Record<string, string> = {
  mega: '500k+', large: '50k–500k', mid: '5k–50k', niche: '<5k',
};

/** Best-effort JSON parse from an LLM string (strips code fences / prose). */
function safeJsonParse<T = any>(raw: string): T | null {
  if (!raw) return null;
  let s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  try { return JSON.parse(s) as T; } catch { return null; }
}

function fbGroupSearchUrl(query: string): string {
  return `https://www.facebook.com/search/groups/?q=${encodeURIComponent(query)}`;
}

/** Resolve the artist's dominant genre (from their catalog) for relevance. */
async function resolveArtistGenre(artistPk: number): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ genre: string | null }>(
      `SELECT genre FROM songs WHERE user_id = $1 AND genre IS NOT NULL AND genre <> ''
       GROUP BY genre ORDER BY COUNT(*) DESC LIMIT 1`,
      [artistPk],
    );
    return rows[0]?.genre || null;
  } catch { return null; }
}

/**
 * POST /:artistId/discover → AI-assisted Facebook group discovery by keyword.
 * Returns a curated, genre-aware set of group archetypes grouped by size tier,
 * each with a NATIVE Facebook group-search deep-link so the artist verifies the
 * real member count and joins manually (ToS-safe — we never scrape FB).
 */
router.post('/:artistId/discover', authenticate, async (req: Request, res: Response) => {
  try {
    const pk = numericArtistId(req.params.artistId);
    if (!pk) return res.status(400).json({ success: false, error: 'invalid artistId' });
    const keyword = String(req.body?.keyword || '').trim();
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword is required' });

    const settings = await getSettings(req.params.artistId);
    const lang = settings.language === 'en' ? 'English' : 'Spanish';
    const [{ rows: userRows }, genre] = await Promise.all([
      pool.query<{ artist_name: string | null; username: string | null }>(
        'SELECT artist_name, username FROM users WHERE id = $1 LIMIT 1', [pk]),
      resolveArtistGenre(pk),
    ]);
    const artistName = userRows[0]?.artist_name || userRows[0]?.username || 'the artist';
    const bodyGenre = req.body?.genre ? String(req.body.genre).slice(0, 60) : null;
    const effectiveGenre = bodyGenre || genre || 'music';

    const sys = `You are a Facebook Groups growth strategist for musicians. Given a keyword and the artist's genre, you propose the BEST OPEN public Facebook groups (archetypes) where this artist could authentically share content and find fans. You DO NOT have live data, so member counts are realistic ESTIMATES (size tiers). Return STRICT JSON only.`;
    const user = `Artist: ${artistName}
Genre: ${effectiveGenre}
Keyword / niche the artist wants: "${keyword}"
Audience language: ${lang}

Propose 10-14 distinct, realistic OPEN Facebook group archetypes worth joining to promote this artist (mix of big reach + tight niche). For each provide:
- name: a realistic Facebook group name (specific, plausible)
- query: the best Facebook search query to find groups like it (2-5 words)
- niche: short category (e.g. "Indie discovery", "${effectiveGenre} fans", "Local scene")
- sizeTier: one of "mega" (500k+), "large" (50k-500k), "mid" (5k-50k), "niche" (<5k)
- estMembers: short human label matching the tier
- relevance: one sentence on why it fits ${artistName}
- language: "es" or "en"
Also include "keywords": an array of 6-8 alternative search keywords/phrases to discover more groups.
Return JSON exactly: { "keywords": string[], "groups": [ { name, query, niche, sizeTier, estMembers, relevance, language } ] }`;

    const raw = await callAI('analysis', [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], { temperature: 0.8, maxTokens: 1600, requireJSON: true, label: 'fb-group-discover' });

    const parsed = safeJsonParse<{ keywords?: string[]; groups?: any[] }>(raw) || {};
    const groups: DiscoveredGroup[] = (parsed.groups || [])
      .filter((g) => g && g.name)
      .map((g) => {
        const tier = ['mega', 'large', 'mid', 'niche'].includes(g.sizeTier) ? g.sizeTier : 'mid';
        const query = String(g.query || g.name).slice(0, 80);
        return {
          name: String(g.name).slice(0, 120),
          query,
          searchUrl: fbGroupSearchUrl(query),
          niche: String(g.niche || effectiveGenre).slice(0, 60),
          sizeTier: tier,
          estMembers: String(g.estMembers || SIZE_LABEL[tier]).slice(0, 24),
          relevance: String(g.relevance || '').slice(0, 240),
          language: g.language === 'en' ? 'en' : (g.language === 'es' ? 'es' : settings.language),
        } as DiscoveredGroup;
      })
      .sort((a, b) => (SIZE_ORDER[a.sizeTier] - SIZE_ORDER[b.sizeTier]));

    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.map((k) => String(k).slice(0, 60)).filter(Boolean).slice(0, 8)
      : [];

    // Group by tier for the UI.
    const byTier: Record<string, DiscoveredGroup[]> = { mega: [], large: [], mid: [], niche: [] };
    for (const g of groups) byTier[g.sizeTier].push(g);

    await audit(req.params.artistId, 'discover', { keyword, count: groups.length }, uid(req));
    return res.json({
      success: true,
      keyword,
      genre: effectiveGenre,
      keywords,
      groups,
      byTier,
      tierLabels: SIZE_LABEL,
      searchUrlFor: fbGroupSearchUrl(keyword),
      note: 'Los conteos de miembros son estimaciones de IA. Abre el enlace de Facebook para ver el tamaño real y unirte.',
    });
  } catch (e: any) {
    logger.error('[fb-groups] discover error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to discover groups' });
  }
});

// ─────────────────────────── PUBLISH QUEUE ──────────────────────────────────

/** POST /:artistId/queue → enqueue a post for one or more groups. */
router.post('/:artistId/queue', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const pk = numericArtistId(artistId);
    const {
      contentType, contentId, title, subtitle, imageUrl, link,
      caption, groupIds, scheduledAt, autoCaption,
    } = req.body || {};
    if (!title) return res.status(400).json({ success: false, error: 'title is required' });

    const settings = await getSettings(artistId);
    const targetGroups: string[] = Array.isArray(groupIds) && groupIds.length
      ? groupIds.map(String)
      : (settings.defaultGroupIds || []);

    let finalCaption = caption ? String(caption) : '';
    if (!finalCaption && autoCaption !== false) {
      let artistName: string | null = null;
      if (pk) {
        const { rows } = await pool.query<{ artist_name: string | null; username: string | null }>(
          'SELECT artist_name, username FROM users WHERE id = $1 LIMIT 1', [pk]);
        artistName = rows[0]?.artist_name || rows[0]?.username || null;
      }
      finalCaption = await buildGroupCaption({
        artistName, contentType: contentType || 'song', title, subtitle, link,
        tone: settings.tone, language: settings.language,
      });
    }

    const when = scheduledAt ? Number(scheduledAt) : nowMs();
    const ref = await artistDoc(artistId).collection('facebookGroupQueue').add({
      contentType: contentType || 'custom',
      contentId: contentId ? String(contentId) : null,
      title: String(title),
      subtitle: subtitle ? String(subtitle) : null,
      imageUrl: imageUrl || null,
      link: link || null,
      caption: finalCaption,
      groupIds: targetGroups,
      publishedGroups: {},          // { [groupId]: timestamp } once published
      status: when <= nowMs() ? 'ready' : 'scheduled',
      scheduledAt: when,
      autoGenerated: false,
      createdAt: nowMs(),
      ownerId: uid(req),
    });
    await audit(artistId, 'queue.add', { itemId: ref.id, contentType, title }, uid(req));
    const doc = await ref.get();
    return res.json({ success: true, item: { id: ref.id, ...doc.data() } });
  } catch (e: any) {
    logger.error('[fb-groups] enqueue error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to enqueue' });
  }
});

/** GET /:artistId/queue → list queue items (optionally filter by status). */
router.get('/:artistId/queue', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const status = req.query.status ? String(req.query.status) : null;
    let q: FirebaseFirestore.Query = artistDoc(artistId).collection('facebookGroupQueue');
    if (status) q = q.where('status', '==', status);
    const snap = await q.get();
    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0));
    return res.json({ success: true, items });
  } catch (e: any) {
    logger.error('[fb-groups] list queue error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to list queue' });
  }
});

/** PATCH /:artistId/queue/:itemId → edit caption / schedule / groups. */
router.patch('/:artistId/queue/:itemId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, itemId } = req.params;
    const patch: Record<string, any> = {};
    const { caption, groupIds, scheduledAt, imageUrl } = req.body || {};
    if (caption !== undefined) patch.caption = String(caption);
    if (Array.isArray(groupIds)) patch.groupIds = groupIds.map(String);
    if (imageUrl !== undefined) patch.imageUrl = imageUrl || null;
    if (scheduledAt !== undefined) {
      patch.scheduledAt = Number(scheduledAt);
      patch.status = Number(scheduledAt) <= nowMs() ? 'ready' : 'scheduled';
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, error: 'no fields to update' });
    }
    await artistDoc(artistId).collection('facebookGroupQueue').doc(itemId).set(patch, { merge: true });
    await audit(artistId, 'queue.update', { itemId, patch }, uid(req));
    return res.json({ success: true });
  } catch (e: any) {
    logger.error('[fb-groups] update queue error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to update item' });
  }
});

/**
 * POST /:artistId/queue/:itemId/mark-published → Hybrid 1-click confirm.
 * Records that the human published this item into {groupId}. When every target
 * group is done, the item flips to 'published'.
 */
router.post('/:artistId/queue/:itemId/mark-published', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, itemId } = req.params;
    const { groupId } = req.body || {};
    if (!groupId) return res.status(400).json({ success: false, error: 'groupId is required' });

    const itemRef = artistDoc(artistId).collection('facebookGroupQueue').doc(itemId);
    const snap = await itemRef.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'item not found' });
    const item = snap.data() as any;
    const published = { ...(item.publishedGroups || {}), [String(groupId)]: nowMs() };
    const targets: string[] = item.groupIds || [];
    const allDone = targets.length > 0 && targets.every((g) => published[String(g)]);

    await itemRef.set({
      publishedGroups: published,
      status: allDone ? 'published' : item.status,
      lastPublishedAt: nowMs(),
    }, { merge: true });

    // Bump the group's publish stats.
    await artistDoc(artistId).collection('facebookGroups').doc(String(groupId)).set({
      publishCount: FieldValue.increment(1),
      lastPublishedAt: nowMs(),
    }, { merge: true }).catch(() => {});

    await audit(artistId, 'queue.published', { itemId, groupId, allDone }, uid(req));
    return res.json({ success: true, allDone, publishedGroups: published });
  } catch (e: any) {
    logger.error('[fb-groups] mark-published error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to mark published' });
  }
});

/** POST /:artistId/queue/:itemId/skip → skip an item. */
router.post('/:artistId/queue/:itemId/skip', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, itemId } = req.params;
    await artistDoc(artistId).collection('facebookGroupQueue').doc(itemId)
      .set({ status: 'skipped' }, { merge: true });
    await audit(artistId, 'queue.skip', { itemId }, uid(req));
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'failed to skip' });
  }
});

/** DELETE /:artistId/queue/:itemId */
router.delete('/:artistId/queue/:itemId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, itemId } = req.params;
    await artistDoc(artistId).collection('facebookGroupQueue').doc(itemId).delete();
    await audit(artistId, 'queue.delete', { itemId }, uid(req));
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'failed to delete item' });
  }
});

// ─────────────────────────── SETTINGS ───────────────────────────────────────

/** GET /:artistId/settings */
router.get('/:artistId/settings', authenticate, async (req: Request, res: Response) => {
  try {
    const settings = await getSettings(req.params.artistId);
    return res.json({ success: true, settings });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'failed to load settings' });
  }
});

/** POST /:artistId/settings → update settings (merge). */
router.post('/:artistId/settings', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const body = req.body || {};
    const patch: Record<string, any> = {};
    if (body.autopilot !== undefined) patch.autopilot = !!body.autopilot;
    if (body.hybridMode !== undefined) patch.hybridMode = !!body.hybridMode;
    if (body.dailyCap !== undefined) patch.dailyCap = Math.max(1, Math.min(50, Number(body.dailyCap) || 8));
    if (body.minIntervalMinutes !== undefined) patch.minIntervalMinutes = Math.max(5, Math.min(720, Number(body.minIntervalMinutes) || 45));
    if (body.rotateContent !== undefined) patch.rotateContent = !!body.rotateContent;
    if (body.tone !== undefined) patch.tone = String(body.tone).slice(0, 40);
    if (body.language !== undefined) patch.language = body.language === 'en' ? 'en' : 'es';
    if (Array.isArray(body.defaultGroupIds)) patch.defaultGroupIds = body.defaultGroupIds.map(String);
    patch.updatedAt = nowMs();
    await artistDoc(artistId).collection('facebookGroupSettings').doc('config').set(patch, { merge: true });
    await audit(artistId, 'settings.update', patch, uid(req));
    const settings = await getSettings(artistId);
    return res.json({ success: true, settings });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'failed to save settings' });
  }
});

// ─────────────────────────── OVERVIEW ───────────────────────────────────────

/** GET /:artistId/overview → settings + counts + next ready items (the dashboard). */
router.get('/:artistId/overview', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const [settings, groupsSnap, queueSnap] = await Promise.all([
      getSettings(artistId),
      artistDoc(artistId).collection('facebookGroups').get(),
      artistDoc(artistId).collection('facebookGroupQueue').get(),
    ]);
    const groups = groupsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const queue = queueSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const publishedToday = queue.filter((q) =>
      q.lastPublishedAt && q.lastPublishedAt >= startOfDay.getTime()).length;

    const ready = queue
      .filter((q) => q.status === 'ready')
      .sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0));
    const scheduled = queue.filter((q) => q.status === 'scheduled').length;
    const publishedCount = queue.filter((q) => q.status === 'published').length;

    return res.json({
      success: true,
      settings,
      stats: {
        groups: groups.length,
        activeGroups: groups.filter((g) => g.active !== false).length,
        queueTotal: queue.length,
        ready: ready.length,
        scheduled,
        published: publishedCount,
        publishedToday,
        dailyCap: settings.dailyCap,
      },
      nextReady: ready.slice(0, 5),
    });
  } catch (e: any) {
    logger.error('[fb-groups] overview error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to load overview' });
  }
});

/**
 * POST /:artistId/autopilot/run → manually trigger one prepare cycle: pull from
 * content, build captioned queue items (respecting the daily cap), and surface
 * them as "ready" (Hybrid: NOT auto-posted — the human clicks publish).
 */
router.post('/:artistId/autopilot/run', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const pk = numericArtistId(artistId);
    if (!pk) return res.status(400).json({ success: false, error: 'invalid artistId' });
    const { prepared } = await preparePublishQueue(artistId, pk, { force: true });
    await audit(artistId, 'autopilot.run', { prepared }, uid(req));
    return res.json({ success: true, prepared });
  } catch (e: any) {
    logger.error('[fb-groups] autopilot run error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'failed to run autopilot' });
  }
});

// ─────────────────────────── QUEUE PREP ENGINE ──────────────────────────────

/**
 * Shared queue-preparation logic used by BOTH the manual /autopilot/run endpoint
 * and the background scheduler. It tops up the queue from promotable content,
 * respecting the daily cap and avoiding re-queuing the same content twice.
 */
export async function preparePublishQueue(
  artistId: string,
  artistPk: number,
  opts: { force?: boolean } = {},
): Promise<{ prepared: number; skippedReason?: string }> {
  const settings = await getSettings(artistId);
  if (!opts.force && !settings.autopilot) {
    return { prepared: 0, skippedReason: 'autopilot off' };
  }

  // Daily cap guard — count items surfaced/published today.
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const queueSnap = await artistDoc(artistId).collection('facebookGroupQueue').get();
  const queue = queueSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const preparedToday = queue.filter((q) =>
    (q.createdAt || 0) >= startOfDay.getTime() && q.autoGenerated).length;
  const remaining = Math.max(0, (settings.dailyCap || 8) - preparedToday);
  if (remaining <= 0) return { prepared: 0, skippedReason: 'daily cap reached' };

  // Avoid re-queuing content we already have pending/ready/scheduled.
  const activeKeys = new Set(
    queue
      .filter((q) => ['ready', 'scheduled', 'draft'].includes(q.status))
      .map((q) => `${q.contentType}:${q.contentId}`),
  );

  const { artistName, items } = await aggregatePromotableContent(artistPk);
  let pool: PromotableItem[] = items.filter((it) => !activeKeys.has(`${it.contentType}:${it.contentId}`));

  // Rotate so we don't dump 8 songs in a row.
  if (settings.rotateContent) pool = interleaveByType(pool);

  const groups = (await artistDoc(artistId).collection('facebookGroups').get())
    .docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((g) => g.active !== false);
  const defaultGroupIds: string[] = (settings.defaultGroupIds && settings.defaultGroupIds.length)
    ? settings.defaultGroupIds
    : groups.map((g) => g.id);

  // Spacing: schedule each new item minIntervalMinutes apart, starting now.
  const intervalMs = (settings.minIntervalMinutes || 45) * 60 * 1000;
  let cursor = nowMs();

  let prepared = 0;
  for (const it of pool.slice(0, remaining)) {
    const caption = await buildGroupCaption({
      artistName, contentType: it.contentType, title: it.title,
      subtitle: it.subtitle, link: it.link, tone: settings.tone, language: settings.language,
    });
    const when = cursor;
    cursor += intervalMs;
    await artistDoc(artistId).collection('facebookGroupQueue').add({
      contentType: it.contentType,
      contentId: it.contentId,
      title: it.title,
      subtitle: it.subtitle || null,
      imageUrl: it.imageUrl || null,
      link: it.link || null,
      caption,
      groupIds: defaultGroupIds,
      publishedGroups: {},
      status: when <= nowMs() ? 'ready' : 'scheduled',
      scheduledAt: when,
      autoGenerated: true,
      createdAt: nowMs(),
      ownerId: null,
    });
    prepared++;
  }
  return { prepared };
}

/** Round-robin interleave items by contentType so the queue feels varied. */
function interleaveByType(items: PromotableItem[]): PromotableItem[] {
  const buckets = new Map<string, PromotableItem[]>();
  for (const it of items) {
    if (!buckets.has(it.contentType)) buckets.set(it.contentType, []);
    buckets.get(it.contentType)!.push(it);
  }
  const out: PromotableItem[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const arr of buckets.values()) {
      const next = arr.shift();
      if (next) { out.push(next); added = true; }
    }
  }
  return out;
}

export default router;
