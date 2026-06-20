/**
 * ============================================================
 *  HERMES AGENT INTEGRATION ROUTES
 * ============================================================
 *
 * REST API endpoints that Hermes Agent calls to interact with
 * the Boostify platform. All endpoints require a shared secret
 * (HERMES_API_SECRET) for service-to-service auth.
 *
 * GET  /api/hermes/artist/:id           — Full artist data bundle
 * GET  /api/hermes/artist/:id/memory    — MEMORY.md text
 * GET  /api/hermes/artist/:id/soul      — SOUL.md text
 * GET  /api/hermes/artist/:id/goals     — Current goals array
 * GET  /api/hermes/artist/:id/blueprint — Blueprint JSON
 * POST /api/hermes/artist/:id/sync      — Update artist from Hermes memory
 * POST /api/hermes/artist/:id/content   — Save a content idea/post
 * POST /api/hermes/webhook              — Receive completed task results
 * GET  /api/hermes/status               — Health check
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db as pgDb } from '../../db';
import { users, songs, artistBlueprints } from '../../db/schema';
import { eq } from 'drizzle-orm';
import {
  exportArtistHermesProfile,
  applyHermesMemoryUpdate,
  type HermesWebhookPayload,
} from '../services/hermes-memory';

const router = Router();

// ─── Service-to-service auth middleware ──────────────────────────────────────

function requireHermesSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.HERMES_API_SECRET;
  if (!secret) {
    // If no secret configured, only allow localhost requests
    const host = req.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
      res.status(503).json({ error: 'HERMES_API_SECRET not configured' });
      return;
    }
    next();
    return;
  }

  const provided = req.headers['x-hermes-secret'] || req.query.hermesSecret;
  if (provided !== secret) {
    res.status(401).json({ error: 'Invalid Hermes secret' });
    return;
  }
  next();
}

// Apply auth to all routes
router.use(requireHermesSecret);

// ─── Health check ────────────────────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Boostify Hermes Integration',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    capabilities: [
      'artist_profile',
      'memory_export',
      'soul_export',
      'goals',
      'blueprint',
      'memory_sync',
      'content_creation',
      'webhook_receiver',
    ],
  });
});

// ─── Full artist data bundle ──────────────────────────────────────────────────

router.get('/artist/:id', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.id, 10);
  if (isNaN(artistId)) {
    return res.status(400).json({ error: 'Invalid artist ID' });
  }

  try {
    const profile = await exportArtistHermesProfile(artistId);
    res.json({
      success: true,
      data: {
        artistId: profile.artistId,
        artistName: profile.artistName,
        genre: profile.raw.user.genre,
        location: profile.raw.user.location,
        biography: profile.raw.user.biography,
        songCount: profile.raw.songCount,
        topSongs: profile.raw.topSongs,
        platforms: {
          spotify: profile.raw.user.spotifyUrl,
          instagram: profile.raw.user.instagramHandle,
          twitter: profile.raw.user.twitterHandle,
          youtube: profile.raw.user.youtubeChannel,
          tiktok: profile.raw.user.tiktokUrl,
        },
        hasBlueprint: profile.raw.blueprint !== null,
        blueprintSummary: profile.raw.blueprint ? {
          globalScore: (profile.raw.blueprint as any).global_artist_score,
          currentEra: (profile.raw.blueprint as any).current_era,
          primaryGenre: (profile.raw.blueprint as any).primary_genre,
          brandArchetype: (profile.raw.blueprint as any).brand_archetype,
        } : null,
      },
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ─── MEMORY.md export ────────────────────────────────────────────────────────

router.get('/artist/:id/memory', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.id, 10);
  if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist ID' });

  try {
    const profile = await exportArtistHermesProfile(artistId);
    // Return as plain text (MEMORY.md format) or JSON depending on Accept header
    if (req.headers.accept?.includes('text/plain')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(profile.memory);
    } else {
      res.json({ success: true, content: profile.memory, format: 'markdown' });
    }
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ─── SOUL.md export ──────────────────────────────────────────────────────────

router.get('/artist/:id/soul', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.id, 10);
  if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist ID' });

  try {
    const profile = await exportArtistHermesProfile(artistId);
    if (req.headers.accept?.includes('text/plain')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(profile.soul);
    } else {
      res.json({ success: true, content: profile.soul, format: 'markdown' });
    }
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ─── Goals ───────────────────────────────────────────────────────────────────

router.get('/artist/:id/goals', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.id, 10);
  if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist ID' });

  try {
    const profile = await exportArtistHermesProfile(artistId);
    res.json({ success: true, goals: profile.goals, artistName: profile.artistName });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ─── Blueprint JSON ───────────────────────────────────────────────────────────

router.get('/artist/:id/blueprint', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.id, 10);
  if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist ID' });

  try {
    const blueprintRows = await pgDb
      .select()
      .from(artistBlueprints)
      .where(eq(artistBlueprints.artistId, artistId))
      .limit(1);

    if (blueprintRows.length === 0) {
      return res.status(404).json({
        error: 'Blueprint not generated yet',
        hint: 'Use POST /api/artist-blueprint/:id/generate to create one',
      });
    }

    const bp = blueprintRows[0];
    res.json({
      success: true,
      blueprintId: bp.id,
      artistId: bp.artistId,
      version: bp.version,
      status: bp.generationStatus,
      generatedAt: bp.generatedAt,
      blueprint: bp.blueprintJson,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Songs catalog ────────────────────────────────────────────────────────────

router.get('/artist/:id/songs', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.id, 10);
  if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist ID' });

  try {
    const artistSongs = await pgDb
      .select({
        id: songs.id,
        title: songs.title,
        genre: songs.genre,
        releaseDate: songs.releaseDate,
        streams: songs.plays,
        audioUrl: songs.audioUrl,
        coverUrl: songs.coverArt,
        firestoreId: songs.firestoreId,
      })
      .from(songs)
      .where(eq(songs.userId, artistId));

    res.json({
      success: true,
      artistId,
      count: artistSongs.length,
      songs: artistSongs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Memory sync: update artist from Hermes memory ───────────────────────────

router.post('/artist/:id/sync', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.id, 10);
  if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist ID' });

  const { memorySection, notes } = req.body as {
    memorySection?: string;
    notes?: string;
  };

  if (!memorySection && !notes) {
    return res.status(400).json({ error: 'memorySection or notes required' });
  }

  try {
    const section = memorySection || notes || '';
    const result = await applyHermesMemoryUpdate(artistId, section);
    res.json({
      success: true,
      ...result,
      message: result.updated
        ? `Updated ${result.fields.length} field(s): ${result.fields.join(', ')}`
        : 'No matching fields found to update',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Content creation: save a post/content idea ──────────────────────────────

router.post('/artist/:id/content', async (req: Request, res: Response) => {
  const artistId = parseInt(req.params.id, 10);
  if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist ID' });

  const { platform, content, contentType, scheduledFor } = req.body as {
    platform?: string;
    content?: string;
    contentType?: string;
    scheduledFor?: string;
  };

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  // Log content idea (stored as artist note — social content table integration can be added)
  console.log(`[Hermes] Content idea for artist ${artistId} on ${platform || 'general'}:`, {
    contentType,
    scheduledFor,
    preview: content.substring(0, 100),
  });

  // TODO: integrate with social-content table when schema is ready
  res.json({
    success: true,
    message: 'Content idea received and logged',
    artistId,
    platform: platform || 'general',
    contentType: contentType || 'post',
    preview: content.substring(0, 200),
    scheduledFor: scheduledFor || null,
    note: 'Full social content pipeline integration coming in Phase 2',
  });
});

// ─── Webhook: receive completed task results from Hermes ─────────────────────

router.post('/webhook', async (req: Request, res: Response) => {
  const payload = req.body as HermesWebhookPayload;

  if (!payload.artistId || !payload.taskType) {
    return res.status(400).json({ error: 'artistId and taskType are required' });
  }

  console.log(`[Hermes Webhook] Task completed for artist ${payload.artistId}:`, {
    taskType: payload.taskType,
    taskTitle: payload.taskTitle,
    hasResult: !!payload.result,
    hasMemoryUpdates: !!payload.memoryUpdates,
    timestamp: payload.timestamp,
  });

  // If Hermes sends memory updates, apply them
  if (payload.memoryUpdates) {
    try {
      const syncResult = await applyHermesMemoryUpdate(payload.artistId, payload.memoryUpdates);
      if (syncResult.updated) {
        console.log(`[Hermes Webhook] Auto-synced ${syncResult.fields.length} field(s) to DB`);
      }
    } catch (err) {
      console.warn('[Hermes Webhook] Memory sync failed:', err);
    }
  }

  res.json({
    success: true,
    received: true,
    artistId: payload.artistId,
    taskType: payload.taskType,
    timestamp: new Date().toISOString(),
  });
});

export default router;
