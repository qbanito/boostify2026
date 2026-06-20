/**
 * Worker job handlers
 * ===================
 * Registers serializable handlers for the BullMQ worker. Both the web process
 * (for the inline fallback path) and the dedicated worker import this module.
 *
 * RULES for a handler:
 *   • Import only SERVICES (not Express route modules) so the worker bundle
 *     stays lean and free of HTTP/circular-import side effects.
 *   • `data` must be plain JSON (it crossed a Redis boundary) — pass ids and
 *     primitives, then re-fetch rich objects from the DB inside the handler.
 *   • Be idempotent where possible: a job can be retried after a crash.
 */
import { defineJob } from './index';

// ── Platform events (auto-promote to socials, notify followers) ──────────────
// Heavy fan-out work; safe to run on the worker.
defineJob('platform-event:emit', async (data: { type: string; payload: any; autoPromote?: boolean }) => {
  const { emitPlatformEvent } = await import('../services/platform-events-service');
  await emitPlatformEvent(data.type as any, data.payload, !!data.autoPromote);
});

defineJob('platform-event:process', async (data: { limit?: number }) => {
  const { processPlatformEvents } = await import('../services/platform-events-service');
  return processPlatformEvents(data?.limit ?? 20);
});

// ── Song analysis pipeline (audio features, mood, BPM…) ──────────────────────
defineJob('song-analysis:run', async (data: { songId: number }) => {
  const { analyzeSongAndStore } = await import('../services/song-analysis-pipeline');
  await analyzeSongAndStore(Number(data.songId));
});

/*
 * MIGRATION TEMPLATE — moving a route's fire-and-forget block to the worker:
 *
 *   // server/queue/jobs.ts
 *   defineJob('music-video:render', async (data: { purchaseId: string }) => {
 *     const { renderMusicVideoBundle } = await import('../services/<media-service>');
 *     return renderMusicVideoBundle(data.purchaseId);
 *   });
 *
 *   // in the route
 *   void runOrEnqueue('music-video:render', { purchaseId }, () =>
 *     renderMusicVideoBundle(purchaseId));
 *
 * Until a handler is registered here, `runOrEnqueue` automatically runs the
 * block inline, so wiring a call site is always safe to ship on its own.
 */
