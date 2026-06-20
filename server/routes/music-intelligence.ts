/**
 * Music Intelligence API Routes
 * Playlist tracking, editorial placements, chart querying, playlist discovery.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import {
  findEditorialPlacements,
  getArtistActivePlaylists,
  searchGlobalPlaylists,
  getAvailableCharts,
  getChartRanking,
  getGlobalSongChart,
} from '../services/playlist-chart-intelligence';

const router = Router();

// ─── Playlists ──────────────────────────────────────────────────

// GET /api/music-intel/playlists/editorial/:artistId?days=90
router.get('/playlists/editorial/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const data = await findEditorialPlacements(req.params.artistId, days);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[MusicIntel] Editorial placements error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/music-intel/playlists/active/:artistId
router.get('/playlists/active/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await getArtistActivePlaylists(req.params.artistId);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[MusicIntel] Active playlists error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/music-intel/playlists/search?genre=lofi&limit=20
router.get('/playlists/search', authenticate, async (req: Request, res: Response) => {
  try {
    const genre = (req.query.genre as string || '').trim();
    if (!genre) return res.status(400).json({ success: false, error: 'Query parameter "genre" is required' });
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await searchGlobalPlaylists(genre, limit);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[MusicIntel] Playlist search error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Charts ─────────────────────────────────────────────────────

// GET /api/music-intel/charts/available?platform=spotify&country=US
router.get('/charts/available', authenticate, async (req: Request, res: Response) => {
  try {
    const platform = req.query.platform as string;
    const country = req.query.country as string;
    const data = getAvailableCharts(platform, country);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/music-intel/charts/ranking/:slug
router.get('/charts/ranking/:slug', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await getChartRanking(req.params.slug);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[MusicIntel] Chart ranking error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/music-intel/charts/global/:chartId
router.get('/charts/global/:chartId', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await getGlobalSongChart(req.params.chartId);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[MusicIntel] Global chart error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
