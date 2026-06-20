/**
 * Artist Intelligence API Routes
 * Cross-platform artist search, stats, geographic data, growth analysis,
 * similar artists, competitors, and career stage classification.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import {
  searchArtist,
  getArtistStats,
  getGeographicData,
  analyzeGrowthRates,
  findSimilarArtists,
  findGenreCompetitors,
  getCareerStage,
} from '../services/artist-intelligence';

const router = Router();

// GET /api/artist-intel/search?q=Bad+Bunny
router.get('/search', authenticate, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
    const results = await searchArtist(query);
    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('[ArtistIntel] Search error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/artist-intel/:id/stats?period=30
router.get('/:id/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const period = parseInt(req.query.period as string) || 30;
    const data = await getArtistStats(req.params.id, period);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[ArtistIntel] Stats error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/artist-intel/:id/geographic
router.get('/:id/geographic', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await getGeographicData(req.params.id);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[ArtistIntel] Geographic error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/artist-intel/:id/growth?platform=spotify&period=90
router.get('/:id/growth', authenticate, async (req: Request, res: Response) => {
  try {
    const platform = (req.query.platform as string) || 'spotify';
    const period = parseInt(req.query.period as string) || 90;
    const data = await analyzeGrowthRates(req.params.id, platform, period);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[ArtistIntel] Growth error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/artist-intel/:id/similar
router.get('/:id/similar', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await findSimilarArtists(req.params.id);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[ArtistIntel] Similar error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/artist-intel/:id/competitors
router.get('/:id/competitors', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await findGenreCompetitors(req.params.id);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[ArtistIntel] Competitors error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/artist-intel/:id/career-stage
router.get('/:id/career-stage', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await getCareerStage(req.params.id);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[ArtistIntel] Career stage error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
