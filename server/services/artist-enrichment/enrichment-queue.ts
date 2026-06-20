/**
 * Artist Enrichment — Queue Manager
 * Manages the enrichment queue: enqueuing, dequeuing, batch processing,
 * retry logic, and status tracking
 */

import { db } from '../../db';
import { artistEnrichmentQueue, artistEnrichmentLog, users } from '../../db/schema';
import { eq, and, sql, desc, asc, lt, isNull, inArray } from 'drizzle-orm';
import { collectArtistData } from './data-collector';
import { analyzeArtistData } from './profile-analyzer';
import { buildArtistProfile } from './profile-builder';

// ─── Types ──────────────────────────────────────────────────────

export interface EnqueueOptions {
  artistId: number;
  source?: 'signup' | 'discovery' | 'manual' | 'import';
  priority?: number; // 1-100
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
  total: number;
  avgCompleteness: number;
  avgConfidence: number;
  totalCostUsd: number;
}

export interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  durationMs: number;
  costEstimate: number;
}

// ─── Enqueue Artist ─────────────────────────────────────────────

export async function enqueueArtistEnrichment(options: EnqueueOptions): Promise<{ queued: boolean; reason?: string }> {
  const { artistId, source = 'discovery', priority = 50 } = options;

  try {
    // Check if already in queue
    const [existing] = await db.select({ id: artistEnrichmentQueue.id, status: artistEnrichmentQueue.status })
      .from(artistEnrichmentQueue)
      .where(eq(artistEnrichmentQueue.artistId, artistId))
      .limit(1);

    if (existing) {
      // Re-enqueue if previously failed and has retries left
      if (existing.status === 'failed') {
        await db.update(artistEnrichmentQueue)
          .set({ status: 'pending', priority, errorLog: null })
          .where(eq(artistEnrichmentQueue.id, existing.id));
        return { queued: true, reason: 'Re-queued after failure' };
      }
      return { queued: false, reason: `Already in queue (status: ${existing.status})` };
    }

    // Check artist exists
    const [artist] = await db.select({ id: users.id, artistName: users.artistName })
      .from(users)
      .where(eq(users.id, artistId))
      .limit(1);

    if (!artist) {
      return { queued: false, reason: 'Artist not found' };
    }

    // Insert into queue
    await db.insert(artistEnrichmentQueue).values({
      artistId,
      status: 'pending',
      priority,
      source,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
    });

    console.log(`[Enrichment] ➕ Enqueued artist ${artistId} (${artist.artistName}) — source: ${source}, priority: ${priority}`);
    return { queued: true };
  } catch (err: any) {
    console.error('[Enrichment] Enqueue error:', err.message);
    return { queued: false, reason: err.message };
  }
}

// ─── Log Enrichment Action ──────────────────────────────────────

async function logAction(
  artistId: number,
  queueId: number | null,
  action: string,
  source: string,
  data?: any,
  tokensUsed?: number,
  costUsd?: number,
  durationMs?: number
): Promise<void> {
  try {
    await db.insert(artistEnrichmentLog).values({
      artistId,
      queueId,
      action,
      source,
      data: data || null,
      tokensUsed: tokensUsed || 0,
      costUsd: costUsd?.toFixed(5) || '0',
      durationMs: durationMs || 0,
      createdAt: new Date(),
    });
  } catch {
    // Non-critical, don't throw
  }
}

// ─── Process Single Artist ──────────────────────────────────────

export async function processEnrichmentJob(queueId: number): Promise<{ success: boolean; error?: string }> {
  // Fetch queue item
  const [job] = await db.select()
    .from(artistEnrichmentQueue)
    .where(eq(artistEnrichmentQueue.id, queueId))
    .limit(1);

  if (!job) return { success: false, error: 'Job not found' };
  if (job.status === 'completed') return { success: true };
  if (job.attempts >= job.maxAttempts) {
    await db.update(artistEnrichmentQueue)
      .set({ status: 'failed', errorLog: 'Max attempts reached' })
      .where(eq(artistEnrichmentQueue.id, queueId));
    return { success: false, error: 'Max attempts reached' };
  }

  // Mark as processing
  await db.update(artistEnrichmentQueue)
    .set({ status: 'processing', startedAt: new Date(), attempts: job.attempts + 1 })
    .where(eq(artistEnrichmentQueue.id, queueId));

  try {
    // Get artist info
    const [artist] = await db.select({
      id: users.id,
      artistName: users.artistName,
      email: users.email,
      genre: users.genre,
      biography: users.biography,
      instagramHandle: users.instagramHandle,
      spotifyUrl: users.spotifyUrl,
      youtubeChannel: users.youtubeChannel,
    }).from(users).where(eq(users.id, job.artistId)).limit(1);

    if (!artist) {
      await db.update(artistEnrichmentQueue)
        .set({ status: 'skipped', errorLog: 'Artist not found in users table' })
        .where(eq(artistEnrichmentQueue.id, queueId));
      return { success: false, error: 'Artist not found' };
    }

    const artistName = artist.artistName || 'Unknown';
    console.log(`[Enrichment] 🔄 Processing: ${artistName} (ID: ${artist.id})`);

    // Extract existing Spotify ID from URL
    let existingSpotifyId: string | undefined;
    if (artist.spotifyUrl) {
      const match = artist.spotifyUrl.match(/artist\/([a-zA-Z0-9]+)/);
      if (match) existingSpotifyId = match[1];
    }

    // STEP 1: Collect data from all sources
    const collectStart = Date.now();
    const collectedData = await collectArtistData(artistName, {
      email: artist.email || undefined,
      genre: artist.genre || undefined,
      existingInstagram: artist.instagramHandle || undefined,
      existingSpotify: existingSpotifyId,
      existingYouTube: artist.youtubeChannel || undefined,
    });

    await logAction(artist.id, queueId, 'data_collected', 'multi',
      { sourcesFound: collectedData.sourcesFound, sourcesChecked: collectedData.sourcesChecked },
      0, 0.003, Date.now() - collectStart
    );

    // Log individual source results
    if (collectedData.spotify) {
      await logAction(artist.id, queueId, 'spotify_found', 'spotify',
        { name: collectedData.spotify.name, followers: collectedData.spotify.followers, genres: collectedData.spotify.genres });
    }
    if (collectedData.instagram) {
      await logAction(artist.id, queueId, 'ig_scraped', 'instagram',
        { username: collectedData.instagram.username, followers: collectedData.instagram.followersCount, verified: collectedData.instagram.isVerified });
    }
    if (collectedData.youtube) {
      await logAction(artist.id, queueId, 'youtube_found', 'youtube',
        { channel: collectedData.youtube.channelName, subs: collectedData.youtube.subscribers });
    }

    // STEP 2: Analyze with GPT
    const analyzeStart = Date.now();
    const analyzedProfile = await analyzeArtistData(artistName, collectedData, artist.biography || undefined);
    await logAction(artist.id, queueId, 'profile_analyzed', 'gpt',
      { confidence: analyzedProfile.dataConfidence, careerStage: analyzedProfile.careerStage },
      analyzedProfile.tokensUsed, (analyzedProfile.tokensUsed / 1_000_000) * 0.15, Date.now() - analyzeStart
    );

    // STEP 3: Build profile (generate bio + image + update DB)
    const buildStart = Date.now();
    const buildResult = await buildArtistProfile(artist.id, analyzedProfile, collectedData);
    await logAction(artist.id, queueId, 'profile_built', 'multi',
      { updatedFields: buildResult.updatedFields, biographyGenerated: buildResult.biographyGenerated, imageGenerated: buildResult.imageGenerated },
      buildResult.tokensUsed, buildResult.costEstimate, Date.now() - buildStart
    );

    if (buildResult.biographyGenerated) {
      await logAction(artist.id, queueId, 'bio_generated', 'gemini', null, 0, 0.001);
    }
    if (buildResult.imageGenerated) {
      await logAction(artist.id, queueId, 'image_generated', 'fal', null, 0, 0.01);
    }

    // STEP 4: Update queue record
    await db.update(artistEnrichmentQueue).set({
      status: buildResult.success ? 'completed' : 'failed',
      rawData: {
        spotify: collectedData.spotify || undefined,
        instagram: collectedData.instagram || undefined,
        youtube: collectedData.youtube || undefined,
        google: collectedData.google || undefined,
        website: collectedData.website || undefined,
      },
      analyzedData: {
        verifiedName: analyzedProfile.verifiedName,
        verifiedGenres: analyzedProfile.verifiedGenres,
        biography: analyzedProfile.biography,
        socialLinks: analyzedProfile.socialLinks,
        bestPhotoUrl: analyzedProfile.bestPhotoUrl,
        photoUrls: analyzedProfile.photoUrls,
        careerStage: analyzedProfile.careerStage,
        dataConfidence: analyzedProfile.dataConfidence,
        crossReferenceNotes: analyzedProfile.crossReferenceNotes,
      },
      dataCompletenessScore: Math.round(analyzedProfile.dataConfidence),
      sourcesChecked: collectedData.sourcesChecked,
      sourcesFound: collectedData.sourcesFound,
      completedAt: new Date(),
      errorLog: buildResult.errors.length > 0 ? buildResult.errors.join('; ') : null,
    }).where(eq(artistEnrichmentQueue.id, queueId));

    console.log(`[Enrichment] ✅ Completed: ${artistName} — confidence: ${analyzedProfile.dataConfidence}%, fields: ${buildResult.updatedFields.join(', ') || 'none'}`);
    return { success: true };

  } catch (err: any) {
    const errorMsg = err.message || 'Unknown error';
    console.error(`[Enrichment] ❌ Failed job ${queueId}:`, errorMsg);

    await db.update(artistEnrichmentQueue).set({
      status: job.attempts + 1 >= job.maxAttempts ? 'failed' : 'pending',
      errorLog: errorMsg.substring(0, 500),
    }).where(eq(artistEnrichmentQueue.id, queueId));

    await logAction(job.artistId, queueId, 'error', 'system', { error: errorMsg.substring(0, 200) });
    return { success: false, error: errorMsg };
  }
}

// ─── Process Batch ──────────────────────────────────────────────

export async function processBatch(batchSize: number = 5): Promise<ProcessResult> {
  const startTime = Date.now();
  const result: ProcessResult = {
    processed: 0, succeeded: 0, failed: 0, skipped: 0,
    durationMs: 0, costEstimate: 0,
  };

  try {
    // Fetch pending jobs ordered by priority (highest first)
    const jobs = await db.select({
      id: artistEnrichmentQueue.id,
      artistId: artistEnrichmentQueue.artistId,
      priority: artistEnrichmentQueue.priority,
    })
      .from(artistEnrichmentQueue)
      .where(eq(artistEnrichmentQueue.status, 'pending'))
      .orderBy(desc(artistEnrichmentQueue.priority), asc(artistEnrichmentQueue.createdAt))
      .limit(batchSize);

    if (jobs.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    console.log(`[Enrichment] 📦 Processing batch of ${jobs.length} artists...`);

    // Process sequentially to avoid API rate limits
    for (const job of jobs) {
      result.processed++;
      const jobResult = await processEnrichmentJob(job.id);
      if (jobResult.success) {
        result.succeeded++;
      } else {
        result.failed++;
      }
    }

    result.durationMs = Date.now() - startTime;
    console.log(`[Enrichment] 📦 Batch done: ${result.succeeded}/${result.processed} succeeded (${result.durationMs}ms)`);
    return result;
  } catch (err: any) {
    console.error('[Enrichment] Batch processing error:', err.message);
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

// ─── Queue Stats ────────────────────────────────────────────────

export async function getQueueStats(): Promise<QueueStats> {
  try {
    const statusCounts = await db.select({
      status: artistEnrichmentQueue.status,
      count: sql<number>`count(*)::int`,
    })
      .from(artistEnrichmentQueue)
      .groupBy(artistEnrichmentQueue.status);

    const statsMap: Record<string, number> = {};
    for (const row of statusCounts) {
      statsMap[row.status] = row.count;
    }

    // Average completeness & confidence for completed items
    const [avgScores] = await db.select({
      avgCompleteness: sql<number>`coalesce(avg(data_completeness_score), 0)::int`,
      avgConfidence: sql<number>`coalesce(avg((analyzed_data->>'dataConfidence')::int), 0)`,
    })
      .from(artistEnrichmentQueue)
      .where(eq(artistEnrichmentQueue.status, 'completed'));

    // Total cost from logs
    const [costResult] = await db.select({
      totalCost: sql<number>`coalesce(sum(cost_usd::numeric), 0)::float`,
    })
      .from(artistEnrichmentLog);

    return {
      pending: statsMap.pending || 0,
      processing: statsMap.processing || 0,
      completed: statsMap.completed || 0,
      failed: statsMap.failed || 0,
      skipped: statsMap.skipped || 0,
      total: Object.values(statsMap).reduce((a, b) => a + b, 0),
      avgCompleteness: avgScores?.avgCompleteness || 0,
      avgConfidence: avgScores?.avgConfidence || 0,
      totalCostUsd: costResult?.totalCost || 0,
    };
  } catch (err) {
    console.error('[Enrichment] Stats error:', err);
    return { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, total: 0, avgCompleteness: 0, avgConfidence: 0, totalCostUsd: 0 };
  }
}

// ─── Get Queue Items ────────────────────────────────────────────

export async function getQueueItems(
  status?: string,
  limit: number = 20,
  offset: number = 0
): Promise<any[]> {
  try {
    let query = db.select({
      id: artistEnrichmentQueue.id,
      artistId: artistEnrichmentQueue.artistId,
      status: artistEnrichmentQueue.status,
      priority: artistEnrichmentQueue.priority,
      source: artistEnrichmentQueue.source,
      dataCompletenessScore: artistEnrichmentQueue.dataCompletenessScore,
      sourcesFound: artistEnrichmentQueue.sourcesFound,
      attempts: artistEnrichmentQueue.attempts,
      errorLog: artistEnrichmentQueue.errorLog,
      createdAt: artistEnrichmentQueue.createdAt,
      completedAt: artistEnrichmentQueue.completedAt,
      artistName: users.artistName,
      artistEmail: users.email,
    })
      .from(artistEnrichmentQueue)
      .leftJoin(users, eq(artistEnrichmentQueue.artistId, users.id))
      .orderBy(desc(artistEnrichmentQueue.createdAt))
      .limit(limit)
      .offset(offset);

    if (status) {
      return await (query as any).where(eq(artistEnrichmentQueue.status, status));
    }

    return await query;
  } catch (err) {
    console.error('[Enrichment] Get queue items error:', err);
    return [];
  }
}

// ─── Get Enrichment Log for Artist ──────────────────────────────

export async function getArtistEnrichmentHistory(artistId: number): Promise<any[]> {
  try {
    return await db.select()
      .from(artistEnrichmentLog)
      .where(eq(artistEnrichmentLog.artistId, artistId))
      .orderBy(desc(artistEnrichmentLog.createdAt))
      .limit(50);
  } catch (err) {
    console.error('[Enrichment] Get history error:', err);
    return [];
  }
}

// ─── Retry Failed Job ──────────────────────────────────────────

export async function retryEnrichment(queueId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const [job] = await db.select()
      .from(artistEnrichmentQueue)
      .where(eq(artistEnrichmentQueue.id, queueId))
      .limit(1);

    if (!job) return { success: false, error: 'Job not found' };

    await db.update(artistEnrichmentQueue).set({
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      errorLog: null,
      startedAt: null,
      completedAt: null,
    }).where(eq(artistEnrichmentQueue.id, queueId));

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Auto-Enqueue Unenriched Artists ────────────────────────────

export async function autoEnqueueUnenrichedArtists(limit: number = 50): Promise<number> {
  try {
    // Find artists that are NOT in the enrichment queue yet
    const unenriched = await db.execute(sql`
      SELECT u.id, u.artist_name, u.genre,
        CASE 
          WHEN u.profile_image IS NULL OR u.profile_image LIKE '%ui-avatars%' OR u.profile_image LIKE '%picsum%' THEN 80
          WHEN u.biography IS NULL OR length(u.biography) < 100 THEN 70
          WHEN u.instagram_handle IS NULL AND u.spotify_url IS NULL AND u.youtube_channel IS NULL THEN 60
          ELSE 40
        END as priority
      FROM users u
      WHERE u.role = 'artist'
        AND NOT EXISTS (
          SELECT 1 FROM artist_enrichment_queue aeq WHERE aeq.artist_id = u.id
        )
        AND u.artist_name IS NOT NULL
        AND u.artist_name != ''
        AND length(u.artist_name) > 2
      ORDER BY priority DESC, u.created_at DESC
      LIMIT ${limit}
    `);

    const rows = (unenriched as any).rows || unenriched;
    let enqueued = 0;

    for (const row of rows) {
      const result = await enqueueArtistEnrichment({
        artistId: row.id,
        source: 'discovery',
        priority: row.priority,
      });
      if (result.queued) enqueued++;
    }

    if (enqueued > 0) {
      console.log(`[Enrichment] 📋 Auto-enqueued ${enqueued} unenriched artists`);
    }

    return enqueued;
  } catch (err) {
    console.error('[Enrichment] Auto-enqueue error:', err);
    return 0;
  }
}
