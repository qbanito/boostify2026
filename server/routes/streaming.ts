/**
 * Boostify Streaming API  (mounted at /api/streaming)
 * ─────────────────────────────────────────────────────────────────────────────
 * Spotify / Apple-Music style streaming surface:
 *  - Browse / search artists from the DB (only published artists that have music)
 *  - Listen to an artist's published AI songs
 *  - Home feed: featured (admin + AI), trending, recently added, by-genre
 *  - User playlists (CRUD + add/remove songs)
 *  - Admin curation: set featured artists / order
 *  - AI ranking agent: pulls social-network engagement + plays and ranks artists
 *
 * Tables: playlists, playlist_songs, streaming_featured  (see add-streaming-tables.mjs)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { neon } from '@neondatabase/serverless';
import { authenticate } from '../middleware/auth';
import { createTrackedOpenAI } from '../utils/tracked-openai';

const router = Router();
const getSql = () => neon(process.env.DATABASE_URL!);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapArtistRow(r: any) {
  return {
    id: r.id,
    name:
      r.artist_name ||
      [r.first_name, r.last_name].filter(Boolean).join(' ') ||
      r.username ||
      'Boostify Artist',
    slug: r.slug,
    genre: r.genre,
    country: r.country,
    biography: r.biography,
    image: r.profile_image_url || r.profile_image,
    cover: r.cover_image,
    isAIGenerated: !!r.is_ai_generated,
    songCount: Number(r.song_count || 0),
    totalPlays: Number(r.total_plays || 0),
    // curation
    featured: !!r.is_featured,
    featuredOrder: r.featured_order != null ? Number(r.featured_order) : null,
    badge: r.badge || null,
    aiScore: r.ai_score != null ? Number(r.ai_score) : null,
  };
}

// Normalize a stored social handle/URL into a full clickable URL (or null).
function socialUrl(value: any, base: string): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return base + v.replace(/^@/, '');
}

// Build an artist's social-links object from a user row. Returns null when the
// row carries no social data (e.g. queries that don't SELECT these columns).
function buildSocial(r: any) {
  const social = {
    spotify: socialUrl(r.spotify_url, 'https://open.spotify.com/'),
    instagram: socialUrl(r.instagram_handle, 'https://instagram.com/'),
    tiktok: socialUrl(r.tiktok_url, 'https://www.tiktok.com/@'),
    youtube: socialUrl(r.youtube_channel, 'https://youtube.com/'),
    facebook: socialUrl(r.facebook_url, 'https://facebook.com/'),
    twitter: socialUrl(r.twitter_handle, 'https://twitter.com/'),
    website: socialUrl(r.website, 'https://'),
  };
  return Object.values(social).some(Boolean) ? social : null;
}

function mapSongRow(r: any) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    audioUrl: r.audio_url,
    coverArt: r.cover_art,
    genre: r.genre,
    mood: r.mood,
    duration: r.duration,
    plays: Number(r.plays || 0),
    createdAt: r.created_at,
    artist: {
      id: r.artist_id,
      name:
        r.artist_name ||
        [r.first_name, r.last_name].filter(Boolean).join(' ') ||
        r.username ||
        'Boostify Artist',
      slug: r.slug,
      image: r.profile_image_url || r.profile_image,
      // Optional rich media — only populated by queries that SELECT them
      // (e.g. the public/embed endpoint). null everywhere else.
      video: r.loop_video_url || null,
      social: buildSocial(r),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTISTS — browse / search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/streaming/artists?search=&genre=&limit=&onlyWithMusic=1
 * Public. Returns published artists, with song counts. By default only artists
 * that have at least one published AI song are returned.
 */
router.get('/artists', async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';
    const genre = req.query.genre ? String(req.query.genre).trim() : '';
    const limit = Math.max(1, Math.min(parseInt(String(req.query.limit || '48')) || 48, 100));
    const onlyWithMusic = String(req.query.onlyWithMusic ?? '1') !== '0';

    const like = `%${search.toLowerCase()}%`;

    const rows = await sql`
      SELECT u.id, u.artist_name, u.first_name, u.last_name, u.username, u.slug,
             u.genre, u.country, u.biography, u.profile_image, u.profile_image_url,
             u.cover_image, u.is_ai_generated,
             COALESCE(s.song_count, 0)  AS song_count,
             COALESCE(s.total_plays, 0) AS total_plays,
             f.is_featured, f.featured_order, f.badge, f.ai_score
      FROM users u
      LEFT JOIN (
        SELECT user_id,
               COUNT(*)                       AS song_count,
               COALESCE(SUM(plays), 0)        AS total_plays
        FROM songs
        WHERE is_published = TRUE AND audio_url IS NOT NULL
        GROUP BY user_id
      ) s ON s.user_id = u.id
      LEFT JOIN streaming_featured f ON f.artist_id = u.id AND f.is_featured = TRUE
      WHERE u.is_published = TRUE
        AND (${search} = '' OR LOWER(COALESCE(u.artist_name, '')) LIKE ${like}
             OR LOWER(COALESCE(u.username, '')) LIKE ${like}
             OR LOWER(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) LIKE ${like})
        AND (${genre} = '' OR LOWER(COALESCE(u.genre, '')) = LOWER(${genre}))
        AND (${onlyWithMusic ? 'true' : 'false'} = 'false' OR COALESCE(s.song_count, 0) > 0)
      ORDER BY COALESCE(f.featured_order, 999999) ASC,
               COALESCE(s.total_plays, 0) DESC,
               COALESCE(s.song_count, 0) DESC
      LIMIT ${limit}
    `;

    res.json({ success: true, artists: (rows as any[]).map(mapArtistRow) });
  } catch (error: any) {
    console.error('[Streaming] /artists error:', error);
    res.status(500).json({ success: false, error: error?.message, artists: [] });
  }
});

/**
 * GET /api/streaming/artists/:id/songs
 * Public. Published songs for a given artist.
 */
router.get('/artists/:id/songs', async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const artistId = parseInt(req.params.id, 10);
    if (!Number.isFinite(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist id', songs: [] });
    }

    const rows = await sql`
      SELECT s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
             s.duration, s.plays, s.created_at,
             u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
             u.slug, u.profile_image, u.profile_image_url
      FROM songs s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.user_id = ${artistId}
        AND s.is_published = TRUE
        AND s.audio_url IS NOT NULL
      ORDER BY s.created_at DESC
      LIMIT 100
    `;

    res.json({ success: true, songs: (rows as any[]).map(mapSongRow) });
  } catch (error: any) {
    console.error('[Streaming] /artists/:id/songs error:', error);
    res.status(500).json({ success: false, error: error?.message, songs: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HOME — featured / trending / recent / genres
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/streaming/home
 * Public. Aggregated sections for the streaming landing surface.
 */
router.get('/home', async (_req: Request, res: Response) => {
  const sql = getSql();
  try {
    // Featured artists (admin + AI agent), ordered.
    const featured = await sql`
      SELECT u.id, u.artist_name, u.first_name, u.last_name, u.username, u.slug,
             u.genre, u.country, u.biography, u.profile_image, u.profile_image_url,
             u.cover_image, u.is_ai_generated,
             COALESCE(s.song_count, 0)  AS song_count,
             COALESCE(s.total_plays, 0) AS total_plays,
             f.is_featured, f.featured_order, f.badge, f.ai_score
      FROM streaming_featured f
      INNER JOIN users u ON u.id = f.artist_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS song_count, COALESCE(SUM(plays), 0) AS total_plays
        FROM songs WHERE is_published = TRUE AND audio_url IS NOT NULL GROUP BY user_id
      ) s ON s.user_id = u.id
      WHERE f.is_featured = TRUE AND u.is_published = TRUE
      ORDER BY COALESCE(f.featured_order, 999999) ASC, f.ai_score DESC
      LIMIT 12
    `;

    // Trending songs (most played, recent).
    const trendingSongs = await sql`
      SELECT s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
             s.duration, s.plays, s.created_at,
             u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
             u.slug, u.profile_image, u.profile_image_url
      FROM songs s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.is_published = TRUE AND s.audio_url IS NOT NULL
      ORDER BY COALESCE(s.plays, 0) DESC, s.created_at DESC
      LIMIT 18
    `;

    // Recently added songs.
    const recentSongs = await sql`
      SELECT s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
             s.duration, s.plays, s.created_at,
             u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
             u.slug, u.profile_image, u.profile_image_url
      FROM songs s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.is_published = TRUE AND s.audio_url IS NOT NULL
      ORDER BY s.created_at DESC
      LIMIT 18
    `;

    // Genres distribution.
    const genres = await sql`
      SELECT s.genre AS genre, COUNT(*)::int AS count
      FROM songs s
      WHERE s.is_published = TRUE AND s.audio_url IS NOT NULL
        AND s.genre IS NOT NULL AND s.genre <> ''
      GROUP BY s.genre
      ORDER BY COUNT(*) DESC
      LIMIT 16
    `;

    res.json({
      success: true,
      featured: (featured as any[]).map(mapArtistRow),
      trending: (trendingSongs as any[]).map(mapSongRow),
      recent: (recentSongs as any[]).map(mapSongRow),
      genres: (genres as any[]).map((g) => ({ genre: g.genre, count: Number(g.count) })),
    });
  } catch (error: any) {
    console.error('[Streaming] /home error:', error);
    res.status(500).json({
      success: false,
      error: error?.message,
      featured: [],
      trending: [],
      recent: [],
      genres: [],
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLISTS — CRUD (authenticated)
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/streaming/playlists — current user's playlists (with song counts) */
router.get('/playlists', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const rows = await sql`
      SELECT p.id, p.title, p.description, p.cover_art, p.is_public, p.created_at, p.updated_at,
             COALESCE(ps.cnt, 0) AS song_count
      FROM playlists p
      LEFT JOIN (SELECT playlist_id, COUNT(*) AS cnt FROM playlist_songs GROUP BY playlist_id) ps
             ON ps.playlist_id = p.id
      WHERE p.user_id = ${userId}
      ORDER BY p.updated_at DESC
    `;
    res.json({
      success: true,
      playlists: (rows as any[]).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        coverArt: p.cover_art,
        isPublic: p.is_public,
        songCount: Number(p.song_count || 0),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Streaming] GET /playlists error:', error);
    res.status(500).json({ success: false, error: error?.message, playlists: [] });
  }
});

/** GET /api/streaming/playlists/:id — playlist detail with ordered songs */
router.get('/playlists/:id', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const playlistId = parseInt(req.params.id, 10);
    const [pl] = await sql`
      SELECT id, user_id, title, description, cover_art, is_public, created_at, updated_at
      FROM playlists WHERE id = ${playlistId} LIMIT 1
    `;
    if (!pl) return res.status(404).json({ success: false, error: 'Playlist not found' });
    if (pl.user_id !== userId && !pl.is_public) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const songs = await sql`
      SELECT s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
             s.duration, s.plays, s.created_at,
             u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
             u.slug, u.profile_image, u.profile_image_url,
             ps.order_index
      FROM playlist_songs ps
      INNER JOIN songs s ON s.id = ps.song_id
      INNER JOIN users u ON u.id = s.user_id
      WHERE ps.playlist_id = ${playlistId}
      ORDER BY ps.order_index ASC, ps.added_at ASC
    `;

    res.json({
      success: true,
      playlist: {
        id: pl.id,
        title: pl.title,
        description: pl.description,
        coverArt: pl.cover_art,
        isPublic: pl.is_public,
        isOwner: pl.user_id === userId,
        createdAt: pl.created_at,
        updatedAt: pl.updated_at,
      },
      songs: (songs as any[]).map(mapSongRow),
    });
  } catch (error: any) {
    console.error('[Streaming] GET /playlists/:id error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** GET /api/streaming/playlists/:id/public — public playlist + songs for embed/share (no auth) */
router.get('/playlists/:id/public', async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const playlistId = parseInt(req.params.id, 10);
    if (!Number.isFinite(playlistId)) {
      return res.status(400).json({ success: false, error: 'Invalid id' });
    }
    const [pl] = await sql`
      SELECT p.id, p.user_id, p.title, p.description, p.cover_art, p.is_public,
             p.created_at, p.updated_at,
             u.artist_name, u.first_name, u.last_name, u.username, u.slug,
             u.profile_image, u.profile_image_url, u.cover_image, u.loop_video_url,
             u.biography, u.instagram_handle, u.twitter_handle, u.youtube_channel,
             u.spotify_url, u.facebook_url, u.tiktok_url, u.website
      FROM playlists p
      INNER JOIN users u ON u.id = p.user_id
      WHERE p.id = ${playlistId} LIMIT 1
    `;
    if (!pl) return res.status(404).json({ success: false, error: 'Playlist not found' });
    if (!pl.is_public) return res.status(403).json({ success: false, error: 'This playlist is private' });

    const songs = await sql`
      SELECT s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
             s.duration, s.plays, s.created_at,
             u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
             u.slug, u.profile_image, u.profile_image_url, u.cover_image, u.loop_video_url,
             u.instagram_handle, u.twitter_handle, u.youtube_channel, u.spotify_url,
             u.facebook_url, u.tiktok_url, u.website,
             ps.order_index
      FROM playlist_songs ps
      INNER JOIN songs s ON s.id = ps.song_id
      INNER JOIN users u ON u.id = s.user_id
      WHERE ps.playlist_id = ${playlistId}
      ORDER BY ps.order_index ASC, ps.added_at ASC
    `;

    const ownerName =
      pl.artist_name ||
      [pl.first_name, pl.last_name].filter(Boolean).join(' ') ||
      pl.username ||
      'Boostify';

    res.json({
      success: true,
      playlist: {
        id: pl.id,
        title: pl.title,
        description: pl.description,
        coverArt: pl.cover_art,
        isPublic: pl.is_public,
        ownerName,
        ownerSlug: pl.slug || null,
        ownerImage: pl.profile_image_url || pl.profile_image || null,
        ownerCover: pl.cover_image || null,
        ownerVideo: pl.loop_video_url || null,
        ownerBio: pl.biography || null,
        social: buildSocial(pl),
        createdAt: pl.created_at,
        updatedAt: pl.updated_at,
      },
      songs: (songs as any[]).map(mapSongRow),
    });
  } catch (error: any) {
    console.error('[Streaming] GET /playlists/:id/public error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** POST /api/streaming/playlists — create */
router.post('/playlists', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const title = String(req.body.title || '').trim() || 'Mi playlist';
    const description = req.body.description ? String(req.body.description).trim() : null;
    const coverArt = req.body.coverArt ? String(req.body.coverArt) : null;
    const isPublic = req.body.isPublic === false ? false : true;

    const [row] = await sql`
      INSERT INTO playlists (user_id, title, description, cover_art, is_public)
      VALUES (${userId}, ${title}, ${description}, ${coverArt}, ${isPublic})
      RETURNING id, title, description, cover_art, is_public, created_at, updated_at
    `;
    res.json({
      success: true,
      playlist: {
        id: row.id,
        title: row.title,
        description: row.description,
        coverArt: row.cover_art,
        isPublic: row.is_public,
        songCount: 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Streaming] POST /playlists error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** PUT /api/streaming/playlists/:id — rename / edit */
router.put('/playlists/:id', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const playlistId = parseInt(req.params.id, 10);
    const [pl] = await sql`SELECT user_id FROM playlists WHERE id = ${playlistId} LIMIT 1`;
    if (!pl) return res.status(404).json({ success: false, error: 'Not found' });
    if (pl.user_id !== userId) return res.status(403).json({ success: false, error: 'Forbidden' });

    const title = req.body.title != null ? String(req.body.title).trim() : null;
    const description = req.body.description != null ? String(req.body.description) : null;
    const isPublic = typeof req.body.isPublic === 'boolean' ? req.body.isPublic : null;

    const [row] = await sql`
      UPDATE playlists
      SET title       = COALESCE(${title}, title),
          description = COALESCE(${description}, description),
          is_public   = COALESCE(${isPublic}, is_public),
          updated_at  = NOW()
      WHERE id = ${playlistId}
      RETURNING id, title, description, cover_art, is_public, created_at, updated_at
    `;
    res.json({ success: true, playlist: row });
  } catch (error: any) {
    console.error('[Streaming] PUT /playlists/:id error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** DELETE /api/streaming/playlists/:id */
router.delete('/playlists/:id', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const playlistId = parseInt(req.params.id, 10);
    const [pl] = await sql`SELECT user_id FROM playlists WHERE id = ${playlistId} LIMIT 1`;
    if (!pl) return res.status(404).json({ success: false, error: 'Not found' });
    if (pl.user_id !== userId) return res.status(403).json({ success: false, error: 'Forbidden' });
    await sql`DELETE FROM playlists WHERE id = ${playlistId}`;
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Streaming] DELETE /playlists/:id error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** POST /api/streaming/playlists/:id/songs  body { songId } — add a song */
router.post('/playlists/:id/songs', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const playlistId = parseInt(req.params.id, 10);
    const songId = parseInt(String(req.body.songId), 10);
    if (!Number.isFinite(songId)) {
      return res.status(400).json({ success: false, error: 'songId required' });
    }
    const [pl] = await sql`SELECT user_id FROM playlists WHERE id = ${playlistId} LIMIT 1`;
    if (!pl) return res.status(404).json({ success: false, error: 'Playlist not found' });
    if (pl.user_id !== userId) return res.status(403).json({ success: false, error: 'Forbidden' });

    const [song] = await sql`SELECT id FROM songs WHERE id = ${songId} LIMIT 1`;
    if (!song) return res.status(404).json({ success: false, error: 'Song not found' });

    const [{ next_index }] = await sql`
      SELECT COALESCE(MAX(order_index), -1) + 1 AS next_index
      FROM playlist_songs WHERE playlist_id = ${playlistId}
    `;
    await sql`
      INSERT INTO playlist_songs (playlist_id, song_id, order_index)
      VALUES (${playlistId}, ${songId}, ${next_index})
      ON CONFLICT (playlist_id, song_id) DO NOTHING
    `;
    await sql`UPDATE playlists SET updated_at = NOW() WHERE id = ${playlistId}`;
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Streaming] POST /playlists/:id/songs error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** DELETE /api/streaming/playlists/:id/songs/:songId — remove a song */
router.delete('/playlists/:id/songs/:songId', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const playlistId = parseInt(req.params.id, 10);
    const songId = parseInt(req.params.songId, 10);
    const [pl] = await sql`SELECT user_id FROM playlists WHERE id = ${playlistId} LIMIT 1`;
    if (!pl) return res.status(404).json({ success: false, error: 'Not found' });
    if (pl.user_id !== userId) return res.status(403).json({ success: false, error: 'Forbidden' });
    await sql`DELETE FROM playlist_songs WHERE playlist_id = ${playlistId} AND song_id = ${songId}`;
    await sql`UPDATE playlists SET updated_at = NOW() WHERE id = ${playlistId}`;
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Streaming] DELETE /playlists/:id/songs/:songId error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SOCIAL / PERSONALIZATION  (plays · likes · follows · search · charts · radio)
// ─────────────────────────────────────────────────────────────────────────────

// Optional auth: resolves req.user when a valid token/session exists, but never
// blocks the request when the listener is anonymous (e.g. from the embed widget).
function optionalAuth(req: Request, res: Response, next: NextFunction) {
  let done = false;
  const cont = () => { if (!done) { done = true; next(); } };
  const proxyRes: any = {
    status() { return { json() { cont(); return proxyRes; }, send() { cont(); return proxyRes; }, end() { cont(); return proxyRes; } }; },
    json() { cont(); return proxyRes; },
    send() { cont(); return proxyRes; },
  };
  try {
    Promise.resolve(authenticate(req, proxyRes as Response, cont)).catch(cont);
  } catch {
    cont();
  }
}

function optUserId(req: Request): number | null {
  const id = (req as any).user?.id;
  return typeof id === 'number' && Number.isFinite(id) ? id : null;
}

// Published-songs SELECT columns (expected by mapSongRow). The neon() tagged
// template `sql` exposes no raw-interpolation helper (no .unsafe / .query), so
// these columns are written inline in each query below.

/**
 * POST /api/streaming/plays   body { songId, msPlayed?, source? }
 * Scrobble a meaningful play. Increments songs.plays and (for logged-in users)
 * records a row in listening_history → powers trending, charts, recs, history.
 * Optional auth: works for anonymous listeners (embed) too.
 */
router.post('/plays', optionalAuth, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const songId = parseInt(String(req.body.songId), 10);
    if (!Number.isFinite(songId)) {
      return res.status(400).json({ success: false, error: 'songId required' });
    }
    const msPlayed = Math.max(0, parseInt(String(req.body.msPlayed || 0), 10) || 0);
    const source = ['stream', 'embed', 'radio'].includes(String(req.body.source))
      ? String(req.body.source)
      : 'stream';
    const userId = optUserId(req);

    const [song] = await sql`SELECT id FROM songs WHERE id = ${songId} LIMIT 1`;
    if (!song) return res.status(404).json({ success: false, error: 'Song not found' });

    await sql`UPDATE songs SET plays = COALESCE(plays, 0) + 1 WHERE id = ${songId}`;
    await sql`
      INSERT INTO listening_history (user_id, song_id, ms_played, source)
      VALUES (${userId}, ${songId}, ${msPlayed}, ${source})
    `;
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Streaming] POST /plays error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** GET /api/streaming/likes/ids — set of liked song ids for the user (for UI hearts) */
router.get('/likes/ids', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const rows = await sql`SELECT song_id FROM song_likes WHERE user_id = ${userId}`;
    res.json({ success: true, ids: (rows as any[]).map((r) => Number(r.song_id)) });
  } catch (error: any) {
    console.error('[Streaming] GET /likes/ids error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** GET /api/streaming/likes — full list of liked songs ("Tus me gusta") */
router.get('/likes', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const songs = await sql`
      SELECT
        s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
        s.duration, s.plays, s.created_at,
        u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
        u.slug, u.profile_image, u.profile_image_url,
        sl.created_at AS liked_at
      FROM song_likes sl
      INNER JOIN songs s ON s.id = sl.song_id
      INNER JOIN users u ON u.id = s.user_id
      WHERE sl.user_id = ${userId}
      ORDER BY sl.created_at DESC
    `;
    res.json({ success: true, songs: (songs as any[]).map(mapSongRow) });
  } catch (error: any) {
    console.error('[Streaming] GET /likes error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** POST /api/streaming/likes/:songId — like a song */
router.post('/likes/:songId', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const songId = parseInt(req.params.songId, 10);
    if (!Number.isFinite(songId)) return res.status(400).json({ success: false, error: 'Invalid songId' });
    const [song] = await sql`SELECT id FROM songs WHERE id = ${songId} LIMIT 1`;
    if (!song) return res.status(404).json({ success: false, error: 'Song not found' });
    await sql`
      INSERT INTO song_likes (user_id, song_id) VALUES (${userId}, ${songId})
      ON CONFLICT (user_id, song_id) DO NOTHING
    `;
    res.json({ success: true, liked: true });
  } catch (error: any) {
    console.error('[Streaming] POST /likes/:songId error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** DELETE /api/streaming/likes/:songId — unlike */
router.delete('/likes/:songId', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const songId = parseInt(req.params.songId, 10);
    await sql`DELETE FROM song_likes WHERE user_id = ${userId} AND song_id = ${songId}`;
    res.json({ success: true, liked: false });
  } catch (error: any) {
    console.error('[Streaming] DELETE /likes/:songId error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** GET /api/streaming/follows/ids — set of followed artist ids for the user */
router.get('/follows/ids', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const rows = await sql`SELECT artist_id FROM artist_follows WHERE user_id = ${userId}`;
    res.json({ success: true, ids: (rows as any[]).map((r) => Number(r.artist_id)) });
  } catch (error: any) {
    console.error('[Streaming] GET /follows/ids error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** POST /api/streaming/follows/:artistId — follow an artist */
router.post('/follows/:artistId', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const artistId = parseInt(req.params.artistId, 10);
    if (!Number.isFinite(artistId)) return res.status(400).json({ success: false, error: 'Invalid artistId' });
    if (artistId === userId) return res.status(400).json({ success: false, error: 'No puedes seguirte a ti mismo' });
    const [artist] = await sql`SELECT id FROM users WHERE id = ${artistId} LIMIT 1`;
    if (!artist) return res.status(404).json({ success: false, error: 'Artist not found' });
    await sql`
      INSERT INTO artist_follows (user_id, artist_id) VALUES (${userId}, ${artistId})
      ON CONFLICT (user_id, artist_id) DO NOTHING
    `;
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM artist_follows WHERE artist_id = ${artistId}`;
    res.json({ success: true, following: true, followers: Number(count) });
  } catch (error: any) {
    console.error('[Streaming] POST /follows/:artistId error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** DELETE /api/streaming/follows/:artistId — unfollow */
router.delete('/follows/:artistId', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const artistId = parseInt(req.params.artistId, 10);
    await sql`DELETE FROM artist_follows WHERE user_id = ${userId} AND artist_id = ${artistId}`;
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM artist_follows WHERE artist_id = ${artistId}`;
    res.json({ success: true, following: false, followers: Number(count) });
  } catch (error: any) {
    console.error('[Streaming] DELETE /follows/:artistId error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** GET /api/streaming/following/feed — new releases from artists the user follows */
router.get('/following/feed', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const songs = await sql`
      SELECT
        s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
        s.duration, s.plays, s.created_at,
        u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
        u.slug, u.profile_image, u.profile_image_url
      FROM songs s
      INNER JOIN users u ON u.id = s.user_id
      INNER JOIN artist_follows af ON af.artist_id = s.user_id AND af.user_id = ${userId}
      WHERE s.is_published = TRUE AND s.audio_url IS NOT NULL
      ORDER BY s.created_at DESC
      LIMIT 30
    `;
    res.json({ success: true, songs: (songs as any[]).map(mapSongRow) });
  } catch (error: any) {
    console.error('[Streaming] GET /following/feed error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/**
 * GET /api/streaming/search?q=    Unified search (public).
 * Returns matching artists + songs + public playlists.
 */
router.get('/search', async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    if (!q) return res.json({ success: true, artists: [], songs: [], playlists: [] });
    const like = `%${q.toLowerCase()}%`;

    const [artists, songs, playlists] = await Promise.all([
      sql`
        SELECT u.id, u.artist_name, u.first_name, u.last_name, u.username, u.slug,
               u.genre, u.country, u.biography, u.profile_image, u.profile_image_url,
               u.cover_image, u.is_ai_generated,
               COALESCE(s.song_count, 0) AS song_count, COALESCE(s.total_plays, 0) AS total_plays,
               f.is_featured, f.featured_order, f.badge, f.ai_score
        FROM users u
        LEFT JOIN (
          SELECT user_id, COUNT(*) AS song_count, COALESCE(SUM(plays),0) AS total_plays
          FROM songs WHERE is_published = TRUE AND audio_url IS NOT NULL GROUP BY user_id
        ) s ON s.user_id = u.id
        LEFT JOIN streaming_featured f ON f.artist_id = u.id AND f.is_featured = TRUE
        WHERE u.is_published = TRUE AND COALESCE(s.song_count,0) > 0
          AND (LOWER(COALESCE(u.artist_name,'')) LIKE ${like}
               OR LOWER(COALESCE(u.username,'')) LIKE ${like}
               OR LOWER(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) LIKE ${like})
        ORDER BY COALESCE(s.total_plays,0) DESC LIMIT 20
      `,
      sql`
        SELECT
          s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
          s.duration, s.plays, s.created_at,
          u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
          u.slug, u.profile_image, u.profile_image_url
        FROM songs s INNER JOIN users u ON u.id = s.user_id
        WHERE s.is_published = TRUE AND s.audio_url IS NOT NULL
          AND LOWER(s.title) LIKE ${like}
        ORDER BY COALESCE(s.plays,0) DESC LIMIT 30
      `,
      sql`
        SELECT p.id, p.title, p.description, p.cover_art, p.is_public, p.created_at,
               u.artist_name, u.first_name, u.last_name, u.username,
               (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id)::int AS song_count
        FROM playlists p INNER JOIN users u ON u.id = p.user_id
        WHERE p.is_public = TRUE AND LOWER(p.title) LIKE ${like}
        ORDER BY p.updated_at DESC LIMIT 20
      `,
    ]);

    res.json({
      success: true,
      artists: (artists as any[]).map(mapArtistRow),
      songs: (songs as any[]).map(mapSongRow),
      playlists: (playlists as any[]).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        coverArt: p.cover_art,
        isPublic: p.is_public,
        songCount: Number(p.song_count || 0),
        ownerName:
          p.artist_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || 'Boostify',
        createdAt: p.created_at,
      })),
    });
  } catch (error: any) {
    console.error('[Streaming] GET /search error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/**
 * GET /api/streaming/charts?genre=   Public.
 * top   = most-played songs all-time (Top 50)
 * viral = most-played in the last 7 days (from listening_history)
 */
router.get('/charts', async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const genre = req.query.genre ? String(req.query.genre).trim() : '';
    const top = await sql`
      SELECT
        s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
        s.duration, s.plays, s.created_at,
        u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
        u.slug, u.profile_image, u.profile_image_url
      FROM songs s INNER JOIN users u ON u.id = s.user_id
      WHERE s.is_published = TRUE AND s.audio_url IS NOT NULL
        AND (${genre} = '' OR LOWER(COALESCE(s.genre,'')) = LOWER(${genre}))
      ORDER BY COALESCE(s.plays,0) DESC, s.created_at DESC
      LIMIT 50
    `;
    const viral = await sql`
      SELECT
        s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
        s.duration, s.plays, s.created_at,
        u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
        u.slug, u.profile_image, u.profile_image_url,
        COUNT(lh.id)::int AS recent_plays
      FROM listening_history lh
      INNER JOIN songs s ON s.id = lh.song_id
      INNER JOIN users u ON u.id = s.user_id
      WHERE lh.played_at >= NOW() - INTERVAL '7 days'
        AND s.is_published = TRUE AND s.audio_url IS NOT NULL
        AND (${genre} = '' OR LOWER(COALESCE(s.genre,'')) = LOWER(${genre}))
      GROUP BY s.id, u.id, u.artist_name, u.first_name, u.last_name, u.username, u.slug, u.profile_image, u.profile_image_url
      ORDER BY recent_plays DESC
      LIMIT 30
    `;
    // Fallback when listening_history is still empty (fresh install / no recent
    // plays): surface the newest published tracks so "Virales" never looks dead.
    let viralRows = viral as any[];
    if (viralRows.length === 0) {
      viralRows = (await sql`
        SELECT
          s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
          s.duration, s.plays, s.created_at,
          u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
          u.slug, u.profile_image, u.profile_image_url
        FROM songs s INNER JOIN users u ON u.id = s.user_id
        WHERE s.is_published = TRUE AND s.audio_url IS NOT NULL
          AND (${genre} = '' OR LOWER(COALESCE(s.genre,'')) = LOWER(${genre}))
        ORDER BY s.created_at DESC, COALESCE(s.plays,0) DESC
        LIMIT 30
      `) as any[];
    }
    res.json({
      success: true,
      top: (top as any[]).map(mapSongRow),
      viral: viralRows.map(mapSongRow),
    });
  } catch (error: any) {
    console.error('[Streaming] GET /charts error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** GET /api/streaming/recent — recently played for the logged-in user */
router.get('/recent', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const songs = await sql`
      SELECT
        s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
        s.duration, s.plays, s.created_at,
        u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
        u.slug, u.profile_image, u.profile_image_url,
        mx.last_played
      FROM (
        SELECT song_id, MAX(played_at) AS last_played
        FROM listening_history WHERE user_id = ${userId}
        GROUP BY song_id ORDER BY last_played DESC LIMIT 20
      ) mx
      INNER JOIN songs s ON s.id = mx.song_id
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.is_published = TRUE AND s.audio_url IS NOT NULL
      ORDER BY mx.last_played DESC
    `;
    res.json({ success: true, songs: (songs as any[]).map(mapSongRow) });
  } catch (error: any) {
    console.error('[Streaming] GET /recent error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/**
 * GET /api/streaming/made-for-you — personalized mixes by the user's top genres
 * (derived from likes + listening history). Falls back to globally popular genres.
 */
router.get('/made-for-you', authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    let genres = await sql`
      SELECT s.genre AS genre, COUNT(*)::int AS c
      FROM listening_history lh INNER JOIN songs s ON s.id = lh.song_id
      WHERE lh.user_id = ${userId} AND s.genre IS NOT NULL AND s.genre <> ''
      GROUP BY s.genre ORDER BY c DESC LIMIT 4
    `;
    if ((genres as any[]).length === 0) {
      genres = await sql`
        SELECT s.genre AS genre, COUNT(*)::int AS c
        FROM song_likes sl INNER JOIN songs s ON s.id = sl.song_id
        WHERE sl.user_id = ${userId} AND s.genre IS NOT NULL AND s.genre <> ''
        GROUP BY s.genre ORDER BY c DESC LIMIT 4
      `;
    }
    if ((genres as any[]).length === 0) {
      genres = await sql`
        SELECT genre, COUNT(*)::int AS c FROM songs
        WHERE is_published = TRUE AND audio_url IS NOT NULL AND genre IS NOT NULL AND genre <> ''
        GROUP BY genre ORDER BY c DESC LIMIT 4
      `;
    }

    const mixes = await Promise.all(
      (genres as any[]).map(async (g) => {
        const songs = await sql`
          SELECT
            s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
            s.duration, s.plays, s.created_at,
            u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
            u.slug, u.profile_image, u.profile_image_url
          FROM songs s INNER JOIN users u ON u.id = s.user_id
          WHERE s.is_published = TRUE AND s.audio_url IS NOT NULL
            AND LOWER(COALESCE(s.genre,'')) = LOWER(${g.genre})
          ORDER BY COALESCE(s.plays,0) DESC, s.created_at DESC
          LIMIT 20
        `;
        return {
          id: `mix-${g.genre}`,
          title: `Mix de ${g.genre}`,
          genre: g.genre,
          songs: (songs as any[]).map(mapSongRow),
        };
      }),
    );
    res.json({ success: true, mixes: mixes.filter((m) => m.songs.length > 0) });
  } catch (error: any) {
    console.error('[Streaming] GET /made-for-you error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/**
 * GET /api/streaming/radio/:songId — similar songs to seed (autoplay radio). Public.
 * Matches same genre / mood / artist, excludes the seed, ranked by plays.
 */
router.get('/radio/:songId', async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const songId = parseInt(req.params.songId, 10);
    if (!Number.isFinite(songId)) return res.status(400).json({ success: false, error: 'Invalid songId' });
    const [seed] = await sql`SELECT id, genre, mood, user_id FROM songs WHERE id = ${songId} LIMIT 1`;
    if (!seed) return res.status(404).json({ success: false, error: 'Song not found' });

    const songs = await sql`
      SELECT
        s.id, s.title, s.description, s.audio_url, s.cover_art, s.genre, s.mood,
        s.duration, s.plays, s.created_at,
        u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
        u.slug, u.profile_image, u.profile_image_url,
             (CASE WHEN LOWER(COALESCE(s.genre,'')) = LOWER(${seed.genre || ''}) THEN 3 ELSE 0 END
              + CASE WHEN LOWER(COALESCE(s.mood,'')) = LOWER(${seed.mood || ''}) THEN 2 ELSE 0 END
              + CASE WHEN s.user_id = ${seed.user_id} THEN 1 ELSE 0 END) AS score
      FROM songs s INNER JOIN users u ON u.id = s.user_id
      WHERE s.is_published = TRUE AND s.audio_url IS NOT NULL AND s.id <> ${songId}
        AND (LOWER(COALESCE(s.genre,'')) = LOWER(${seed.genre || ''})
             OR LOWER(COALESCE(s.mood,'')) = LOWER(${seed.mood || ''})
             OR s.user_id = ${seed.user_id})
      ORDER BY score DESC, COALESCE(s.plays,0) DESC
      LIMIT 30
    `;
    res.json({ success: true, songs: (songs as any[]).map(mapSongRow) });
  } catch (error: any) {
    console.error('[Streaming] GET /radio/:songId error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** GET /api/streaming/songs/:id/lyrics — lyrics for the Now-Playing panel. Public. */
router.get('/songs/:id/lyrics', async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const songId = parseInt(req.params.id, 10);
    if (!Number.isFinite(songId)) return res.status(400).json({ success: false, error: 'Invalid id' });
    const [row] = await sql`SELECT lyrics FROM songs WHERE id = ${songId} LIMIT 1`;
    if (!row) return res.status(404).json({ success: false, error: 'Song not found' });
    res.json({ success: true, lyrics: row.lyrics || null });
  } catch (error: any) {
    console.error('[Streaming] GET /songs/:id/lyrics error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — curation (featured artists)
// ─────────────────────────────────────────────────────────────────────────────

function requireAdmin(req: Request, res: Response): boolean {
  if (!(req as any).user?.isAdmin) {
    res.status(403).json({ success: false, error: 'Admin only' });
    return false;
  }
  return true;
}

/** GET /api/streaming/admin/featured — full curation list (admin) */
router.get('/admin/featured', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT f.id, f.artist_id, f.featured_order, f.is_featured, f.badge, f.source,
             f.ai_score, f.ai_reason, f.updated_at,
             u.artist_name, u.first_name, u.last_name, u.username, u.slug,
             u.profile_image, u.profile_image_url, u.genre
      FROM streaming_featured f
      INNER JOIN users u ON u.id = f.artist_id
      ORDER BY COALESCE(f.featured_order, 999999) ASC, f.ai_score DESC
    `;
    res.json({
      success: true,
      featured: (rows as any[]).map((r) => ({
        id: r.id,
        artistId: r.artist_id,
        name:
          r.artist_name ||
          [r.first_name, r.last_name].filter(Boolean).join(' ') ||
          r.username ||
          'Artist',
        slug: r.slug,
        genre: r.genre,
        image: r.profile_image_url || r.profile_image,
        featuredOrder: r.featured_order,
        isFeatured: r.is_featured,
        badge: r.badge,
        source: r.source,
        aiScore: r.ai_score != null ? Number(r.ai_score) : null,
        aiReason: r.ai_reason,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('[Streaming] GET /admin/featured error:', error);
    res.status(500).json({ success: false, error: error?.message, featured: [] });
  }
});

/**
 * POST /api/streaming/admin/featured
 * body { items: [{ artistId, featuredOrder?, badge?, isFeatured? }] }
 * Replaces the admin-managed featured ordering. (Upsert per artist.)
 */
router.post('/admin/featured', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const sql = getSql();
  try {
    const userId: number = (req as any).user.id;
    const items: any[] = Array.isArray(req.body.items) ? req.body.items : [];
    let order = 0;
    for (const it of items) {
      const artistId = parseInt(String(it.artistId), 10);
      if (!Number.isFinite(artistId)) continue;
      const featuredOrder = it.featuredOrder != null ? parseInt(String(it.featuredOrder), 10) : order;
      const badge = it.badge ? String(it.badge) : null;
      const isFeatured = it.isFeatured === false ? false : true;
      await sql`
        INSERT INTO streaming_featured (artist_id, featured_order, is_featured, badge, source, updated_by, updated_at)
        VALUES (${artistId}, ${featuredOrder}, ${isFeatured}, ${badge}, 'admin', ${userId}, NOW())
        ON CONFLICT (artist_id) DO UPDATE
        SET featured_order = ${featuredOrder}, is_featured = ${isFeatured}, badge = ${badge},
            source = 'admin', updated_by = ${userId}, updated_at = NOW()
      `;
      order += 1;
    }
    res.json({ success: true, count: items.length });
  } catch (error: any) {
    console.error('[Streaming] POST /admin/featured error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/** DELETE /api/streaming/admin/featured/:artistId — un-feature an artist */
router.delete('/admin/featured/:artistId', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const sql = getSql();
  try {
    const artistId = parseInt(req.params.artistId, 10);
    await sql`DELETE FROM streaming_featured WHERE artist_id = ${artistId}`;
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Streaming] DELETE /admin/featured/:artistId error:', error);
    res.status(500).json({ success: false, error: error?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — AI ranking agent (connected to the social network)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/streaming/admin/run-agent
 * The novelty: an AI agent that ranks artists for the streaming home using
 * real plays + social-network engagement (followers, posts, likes), then writes
 * featured rows with source='ai-agent'. Admin-managed rows (source='admin') are
 * left untouched so the human curation always wins.
 */
router.post('/admin/run-agent', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const sql = getSql();
  try {
    const topN = Math.max(3, Math.min(parseInt(String(req.body.topN || '8')) || 8, 20));

    // 1) Gather candidate artists with music + social engagement signals.
    //    social_users.real_user_id links to users.id; posts/likes are aggregated.
    const candidates = await sql`
      SELECT u.id AS artist_id, u.artist_name, u.first_name, u.last_name, u.username,
             u.genre,
             COALESCE(s.song_count, 0)  AS song_count,
             COALESCE(s.total_plays, 0) AS total_plays,
             COALESCE(su.followers_count, 0) AS followers,
             COALESCE(po.post_count, 0)      AS posts,
             COALESCE(po.likes_total, 0)     AS likes
      FROM users u
      INNER JOIN (
        SELECT user_id, COUNT(*) AS song_count, COALESCE(SUM(plays), 0) AS total_plays
        FROM songs WHERE is_published = TRUE AND audio_url IS NOT NULL GROUP BY user_id
      ) s ON s.user_id = u.id
      LEFT JOIN social_users su ON su.real_user_id = u.id
      LEFT JOIN (
        SELECT social_user_id,
               COUNT(*) AS post_count,
               COALESCE(SUM(likes_count), 0) AS likes_total
        FROM posts GROUP BY social_user_id
      ) po ON po.social_user_id = su.id
      WHERE u.is_published = TRUE
      ORDER BY (COALESCE(s.total_plays, 0)
                + COALESCE(su.followers_count, 0) * 3
                + COALESCE(po.likes_total, 0) * 2
                + COALESCE(po.post_count, 0) * 5) DESC
      LIMIT 40
    `;

    const list = candidates as any[];
    if (list.length === 0) {
      return res.json({ success: true, ranked: [], message: 'No candidate artists with music found.' });
    }

    const candidateSummaries = list.map((c) => ({
      artistId: c.artist_id,
      name:
        c.artist_name ||
        [c.first_name, c.last_name].filter(Boolean).join(' ') ||
        c.username ||
        'Artist',
      genre: c.genre || 'unknown',
      songs: Number(c.song_count || 0),
      plays: Number(c.total_plays || 0),
      followers: Number(c.followers || 0),
      posts: Number(c.posts || 0),
      likes: Number(c.likes || 0),
    }));

    // 2) Ask the AI agent to rank, with a deterministic fallback score.
    let ranked: { artistId: number; score: number; reason: string; badge?: string }[] = [];
    try {
      const openai = createTrackedOpenAI();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are the Boostify Streaming ranking agent. You rank artists for the homepage of a Spotify-style music platform. ' +
              'Weigh streaming plays, social-network engagement (followers, posts, likes) and catalog depth. ' +
              'Reward momentum and consistency. Return STRICT JSON: ' +
              '{"ranked":[{"artistId":number,"score":number(0-100),"reason":string(short, Spanish),"badge":string(short tag in Spanish like "Tendencia","Nuevo","Top Fans")}]}. ' +
              'Only include artistIds from the provided list. Order best first.',
          },
          {
            role: 'user',
            content: `Rank the top ${topN} artists from this candidate pool:\n${JSON.stringify(
              candidateSummaries,
            )}`,
          },
        ],
      });
      const raw = completion.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.ranked)) {
        const validIds = new Set(list.map((c) => Number(c.artist_id)));
        ranked = parsed.ranked
          .filter((r: any) => validIds.has(Number(r.artistId)))
          .slice(0, topN)
          .map((r: any) => ({
            artistId: Number(r.artistId),
            score: Math.max(0, Math.min(100, Number(r.score) || 0)),
            reason: String(r.reason || '').slice(0, 280),
            badge: r.badge ? String(r.badge).slice(0, 24) : undefined,
          }));
      }
    } catch (aiErr: any) {
      console.warn('[Streaming] AI ranking failed, using fallback:', aiErr?.message);
    }

    // Fallback: deterministic engagement score if the AI returned nothing.
    if (ranked.length === 0) {
      ranked = candidateSummaries.slice(0, topN).map((c, i) => ({
        artistId: c.artistId,
        score: Math.max(
          1,
          Math.min(100, Math.round((c.plays + c.followers * 3 + c.likes * 2 + c.posts * 5) / 10)),
        ),
        reason: `Ranking automático por engagement (${c.plays} plays · ${c.followers} seguidores).`,
        badge: i === 0 ? 'Tendencia' : undefined,
      }));
    }

    // 3) Persist AI rankings (do not overwrite admin-curated rows).
    let order = 0;
    for (const r of ranked) {
      const [existing] = await sql`
        SELECT source FROM streaming_featured WHERE artist_id = ${r.artistId} LIMIT 1
      `;
      if (existing && existing.source === 'admin') {
        order += 1;
        continue; // human curation wins
      }
      await sql`
        INSERT INTO streaming_featured (artist_id, featured_order, is_featured, badge, source, ai_score, ai_reason, updated_at)
        VALUES (${r.artistId}, ${1000 + order}, TRUE, ${r.badge || null}, 'ai-agent', ${r.score}, ${r.reason}, NOW())
        ON CONFLICT (artist_id) DO UPDATE
        SET featured_order = ${1000 + order}, is_featured = TRUE, badge = ${r.badge || null},
            source = 'ai-agent', ai_score = ${r.score}, ai_reason = ${r.reason}, updated_at = NOW()
      `;
      order += 1;
    }

    res.json({ success: true, ranked, count: ranked.length });
  } catch (error: any) {
    console.error('[Streaming] POST /admin/run-agent error:', error);
    res.status(500).json({ success: false, error: error?.message, ranked: [] });
  }
});

export default router;
