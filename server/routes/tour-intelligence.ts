/**
 * Tour Intelligence Routes
 * Opening act discovery, festival search, venue finding.
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import {
  findLocalOpeningActs,
  findStrategicOpeningActs,
  searchFestivals,
  getUpcomingFestivals,
  searchVenuesByGenre,
} from '../services/tour-intelligence';
import {
  getArtistLiveEvents,
  getNearbyLiveEvents,
  getLiveEventSources,
} from '../services/live-events';
import { optimizeTourRoute } from '../services/tour-routing';

const router = Router();

// GET /api/tour-intel/opening-acts/local/:artistId?country=US&city=Miami
router.get('/opening-acts/local/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const country = (req.query.country as string) || 'US';
    const city = req.query.city as string | undefined;
    const acts = await findLocalOpeningActs(artistId, country, city);
    res.json({ success: true, data: acts });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/tour-intel/opening-acts/strategic/:artistId
router.get('/opening-acts/strategic/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const acts = await findStrategicOpeningActs(req.params.artistId);
    res.json({ success: true, data: acts });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/tour-intel/festivals/search?genre=rock&country=MX&name=vive
router.get('/festivals/search', authenticate, async (req: Request, res: Response) => {
  try {
    const results = searchFestivals({
      genre: req.query.genre as string | undefined,
      countryCode: req.query.country as string | undefined,
      name: req.query.name as string | undefined,
    });
    res.json({ success: true, data: results, count: results.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/tour-intel/festivals/upcoming?genre=electronic&limit=10
router.get('/festivals/upcoming', authenticate, async (req: Request, res: Response) => {
  try {
    const genre = req.query.genre as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const results = getUpcomingFestivals(genre, limit);
    res.json({ success: true, data: results, count: results.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/tour-intel/venues?city=Miami&genre=electronic&minCapacity=200
router.get('/venues', authenticate, async (req: Request, res: Response) => {
  try {
    const city = req.query.city as string;
    const genre = req.query.genre as string;
    const minCapacity = parseInt(req.query.minCapacity as string) || 100;
    if (!city || !genre) {
      return res.status(400).json({ success: false, error: 'city and genre are required' });
    }
    const results = searchVenuesByGenre(city, genre, minCapacity);
    res.json({ success: true, data: results, count: results.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    res.status(500).json({ success: false, error: message });
  }
});

// ─── Live Events (Songkick + Bandsintown) ───────────────────────────────────

// GET /api/tour-intel/events/artist?name=Bad+Bunny
router.get('/events/artist', authenticate, async (req: Request, res: Response) => {
  try {
    const name = req.query.name as string | undefined;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, error: 'Query param "name" is required' });
    }
    const result = await getArtistLiveEvents(name.trim());
    res.json({ success: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/tour-intel/events/nearby?location=Miami&genre=reggaeton
router.get('/events/nearby', authenticate, async (req: Request, res: Response) => {
  try {
    const location = req.query.location as string | undefined;
    if (!location?.trim()) {
      return res.status(400).json({ success: false, error: 'Query param "location" is required' });
    }
    const genre = req.query.genre as string | undefined;
    const result = await getNearbyLiveEvents(location.trim(), genre);
    res.json({ success: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /api/tour-intel/events/sources — which live-event APIs are configured
router.get('/events/sources', authenticate, async (_req: Request, res: Response) => {
  const sources = getLiveEventSources();
  res.json({
    success: true,
    sources,
    configured: sources.filter(s => s.configured).map(s => s.name),
  });
});

// ─── Tour Routing Optimizer ─────────────────────────────────────────────────

/**
 * POST /api/tour-intel/routing/optimize
 * Body: { cities: [{ name, countryCode?, lat?, lng? }], anchor?: boolean }
 * Returns an optimised tour stop order with distances, travel modes, and rest-day suggestions.
 */
router.post('/routing/optimize', authenticate, async (req: Request, res: Response) => {
  try {
    const { cities, anchor } = req.body as {
      cities: Array<{ name: string; countryCode?: string; lat?: number; lng?: number }>;
      anchor?: boolean;
    };

    if (!Array.isArray(cities) || cities.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Body must include a "cities" array with at least 2 entries',
      });
    }

    if (cities.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 cities per request',
      });
    }

    // Validate city entries
    for (const c of cities) {
      if (typeof c.name !== 'string' || !c.name.trim()) {
        return res.status(400).json({ success: false, error: 'Each city must have a non-empty "name" string' });
      }
    }

    const result = await optimizeTourRoute(cities, { anchor });
    res.json({ success: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
