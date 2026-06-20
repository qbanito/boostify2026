/**
 * Song Intelligence & Market Analysis API Routes
 * Song identity resolution, audio features, performance, demographics, market potential.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import {
  resolveSongIdentity,
  getSongMetadata,
  getSongPerformance,
  getAudioFeatures,
  getAudienceDemographics,
  analyzeMarketPotential,
  scoreHitPotential,
} from '../services/song-market-intelligence';
import { matchSongAcrossPlatforms } from '../services/cross-platform-matching';

const router = Router();

// ─── Song Intelligence ──────────────────────────────────────────

// POST /api/song-intel/resolve
router.post('/resolve', authenticate, async (req: Request, res: Response) => {
  try {
    const { isrc, spotifyId, title, artistName } = req.body;
    if (!isrc && !spotifyId && !title) {
      return res.status(400).json({ success: false, error: 'Provide isrc, spotifyId, or at least a title' });
    }
    const data = await resolveSongIdentity({ isrc, spotifyId, title, artistName });
    if (!data) return res.status(404).json({ success: false, error: 'Song not found' });
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[SongIntel] Resolve error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/song-intel/:id/metadata
router.get('/:id/metadata', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await getSongMetadata(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Song not found' });
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[SongIntel] Metadata error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/song-intel/:id/performance
router.get('/:id/performance', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await getSongPerformance(req.params.id);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[SongIntel] Performance error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/song-intel/:id/audio-features
router.get('/:id/audio-features', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await getAudioFeatures(req.params.id);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[SongIntel] Audio features error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// ─── Market Analysis ────────────────────────────────────────────

// GET /api/song-intel/demographics/:artistId?platform=spotify
router.get('/demographics/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const platform = (req.query.platform as string) || 'spotify';
    const data = await getAudienceDemographics(req.params.artistId, platform);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[SongIntel] Demographics error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/song-intel/market-potential/:artistId?city=mexico-city&country=Mexico
router.get('/market-potential/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string || '').trim();
    const country = (req.query.country as string || '').trim();
    if (!city || !country) {
      return res.status(400).json({ success: false, error: 'city and country params required' });
    }
    const data = await analyzeMarketPotential(req.params.artistId, city, country);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[SongIntel] Market potential error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// ─── Cross-Platform Matching ────────────────────────────────────────────────

/**
 * POST /api/song-intel/cross-platform
 * Body: { isrc?, spotifyId?, title?, artistName? }
 * Returns matches for the same recording on Spotify, Apple Music, Deezer,
 * MusicBrainz, and YouTube (if YOUTUBE_API_KEY is set).
 */
router.post('/cross-platform', authenticate, async (req: Request, res: Response) => {
  try {
    const { isrc, spotifyId, title, artistName } = req.body;
    if (!isrc && !spotifyId && !(title && artistName)) {
      return res.status(400).json({
        success: false,
        error: 'Provide isrc, spotifyId, or title + artistName',
      });
    }
    const data = await matchSongAcrossPlatforms({ isrc, spotifyId, title, artistName });
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[SongIntel] Cross-platform error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// ─── Hit Potential Scoring ──────────────────────────────────────────────────

/**
 * GET /api/song-intel/:id/hit-potential
 * Param: id = Spotify track ID
 * Returns multi-factor hit potential score with grade, breakdown, and recommendations.
 */
router.get('/:id/hit-potential', authenticate, async (req: Request, res: Response) => {
  try {
    const spotifyTrackId = req.params.id?.trim();
    if (!spotifyTrackId) {
      return res.status(400).json({ success: false, error: 'Spotify track ID is required' });
    }
    const data = await scoreHitPotential(spotifyTrackId);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[SongIntel] Hit potential error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
