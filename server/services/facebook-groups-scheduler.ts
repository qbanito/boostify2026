/**
 * Facebook Groups Auto-Publishing Scheduler
 * ---------------------------------------------------------------------------
 * Runs on a periodic interval. For every artist that has TURNED ON autopilot it:
 *   1. Tops up the publishing queue from connected content (respecting the
 *      daily cap + interval), writing AI-captioned items.
 *   2. Promotes 'scheduled' items whose scheduledAt has arrived to 'ready'
 *      (Hybrid mode = surfaces them for the human's one-click publish; it does
 *      NOT auto-post to Facebook).
 *
 * ⚠️ ToS-conscious by design: this scheduler never logs into Facebook or posts
 * unattended. It only PREPARES and surfaces content. The artist performs the
 * final publish from the command center.
 */
import { db as firestore } from '../firebase';
import { preparePublishQueue } from '../routes/facebook-groups';

let tickTimer: ReturnType<typeof setInterval> | null = null;

const INTERVAL_MS = 10 * 60 * 1000; // Every 10 minutes

/** Promote due 'scheduled' items to 'ready' for a single artist. */
async function promoteDueItems(artistId: string): Promise<number> {
  const now = Date.now();
  const snap = await firestore
    .collection('artists').doc(artistId)
    .collection('facebookGroupQueue')
    .where('status', '==', 'scheduled')
    .get();
  let promoted = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as any;
    if ((data.scheduledAt || 0) <= now) {
      await doc.ref.set({ status: 'ready' }, { merge: true });
      promoted++;
    }
  }
  return promoted;
}

async function tick() {
  try {
    // Find artists that have a settings doc with autopilot enabled.
    // NOTE: a collectionGroup query with a `.where('autopilot','==',true)` filter
    // requires a single-field COLLECTION_GROUP index exemption to be created in
    // Firestore (otherwise: FAILED_PRECONDITION). There is exactly ONE settings
    // doc ('config') per artist, so we instead read the whole (tiny) collection
    // group WITHOUT a filter — which needs no special index — and filter for
    // autopilot in memory.
    const settingsSnap = await firestore
      .collectionGroup('facebookGroupSettings')
      .get();

    if (settingsSnap.empty) return;

    const autopilotDocs = settingsSnap.docs.filter((d) => (d.data() as any)?.autopilot === true);
    if (autopilotDocs.length === 0) return;

    for (const settingsDoc of autopilotDocs) {
      // Path: artists/{artistId}/facebookGroupSettings/config
      const artistRef = settingsDoc.ref.parent.parent;
      if (!artistRef) continue;
      const artistId = artistRef.id;
      const artistPk = Number(artistId);

      try {
        // 1. Promote due scheduled items to ready.
        const promoted = await promoteDueItems(artistId);

        // 2. Top up the queue from content (only when numeric artist id maps to PG).
        let prepared = 0;
        if (Number.isFinite(artistPk) && artistPk > 0) {
          const r = await preparePublishQueue(artistId, artistPk, { force: false });
          prepared = r.prepared;
        }

        if (promoted > 0 || prepared > 0) {
          console.log(`📘 [FB-Groups] artist ${artistId}: +${prepared} prepared, ${promoted} promoted to ready`);
        }
      } catch (err: any) {
        console.warn(`[FB-Groups] tick failed for artist ${artistId}:`, err?.message);
      }
    }
  } catch (err: any) {
    console.warn('[FB-Groups] scheduler tick error:', err?.message);
  }
}

export function startFacebookGroupsScheduler() {
  if (tickTimer) return;
  console.log('[FB-Groups] 📘 Facebook Groups auto-publish scheduler started (every 10 min, Hybrid mode)');
  // First tick after a short delay so the server can finish booting.
  setTimeout(() => { tick(); }, 30_000);
  tickTimer = setInterval(tick, INTERVAL_MS);
}
