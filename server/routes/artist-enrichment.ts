/**
 * Artist Enrichment Agent — API Routes
 * Admin endpoints for managing the enrichment queue
 */

import { Router } from 'express';
import {
  enqueueArtistEnrichment,
  processBatch,
  getQueueStats,
  getQueueItems,
  getArtistEnrichmentHistory,
  retryEnrichment,
  autoEnqueueUnenrichedArtists,
  processEnrichmentJob,
} from '../services/artist-enrichment';

const router = Router();

// GET /api/artist-enrichment/status — Queue statistics
router.get('/status', async (_req, res) => {
  try {
    const stats = await getQueueStats();
    res.json({ success: true, ...stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/artist-enrichment/queue — List queue items
router.get('/queue', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const items = await getQueueItems(status, limit, offset);
    const stats = await getQueueStats();

    res.json({ success: true, items, stats, limit, offset });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/artist-enrichment/enqueue/:artistId — Enqueue specific artist
router.post('/enqueue/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const priority = parseInt(req.body.priority as string) || 50;
    const source = (req.body.source as string) || 'manual';

    const result = await enqueueArtistEnrichment({
      artistId,
      priority,
      source: source as any,
    });

    res.json({ success: result.queued, reason: result.reason });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/artist-enrichment/process — Trigger batch processing
router.post('/process', async (req, res) => {
  try {
    const batchSize = Math.min(parseInt(req.body.batchSize as string) || 5, 20);
    const result = await processBatch(batchSize);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/artist-enrichment/process/:queueId — Process single job
router.post('/process/:queueId', async (req, res) => {
  try {
    const queueId = parseInt(req.params.queueId);
    if (isNaN(queueId)) {
      return res.status(400).json({ success: false, error: 'Invalid queue ID' });
    }

    const result = await processEnrichmentJob(queueId);
    res.json({ success: result.success, error: result.error });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/artist-enrichment/log/:artistId — Get enrichment history for artist
router.get('/log/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const history = await getArtistEnrichmentHistory(artistId);
    res.json({ success: true, history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/artist-enrichment/retry/:queueId — Retry failed enrichment
router.post('/retry/:queueId', async (req, res) => {
  try {
    const queueId = parseInt(req.params.queueId);
    if (isNaN(queueId)) {
      return res.status(400).json({ success: false, error: 'Invalid queue ID' });
    }

    const result = await retryEnrichment(queueId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/artist-enrichment/auto-enqueue — Auto-enqueue unenriched artists
router.post('/auto-enqueue', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.body.limit as string) || 50, 200);
    const enqueued = await autoEnqueueUnenrichedArtists(limit);
    res.json({ success: true, enqueued });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
