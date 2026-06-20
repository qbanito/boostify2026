/**
 * 🔗 Firestore → Postgres lazy song sync
 *
 * Many songs in BOOSTIFY originate in Firestore (legacy / AI-generated catalogs)
 * while the analysis & promotion pipeline (analysisJson, marketing assets, agent
 * tools) lives in Postgres keyed by a numeric `songs.id`.
 *
 * `ensurePgSongFromFirestore` is idempotent: given a Firestore doc id, it returns
 * the matching Postgres `songs.id`, creating a shadow row on first request.
 * Firestore remains the source of truth for playback/UI; we never write back
 * to Firestore here.
 */
import { db } from '../db';
import { songs, users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { db as firestore } from '../firebase';
import { logger } from '../utils/logger';

export interface EnsurePgSongOptions {
  firestoreId: string;
  /** Postgres user id of the requester (used as fallback owner when the
   *  Firestore doc has no resolvable numeric userId). Optional — unauthenticated
   *  callers can omit this; owner will be resolved from the Firestore doc. */
  requesterUserId?: number;
}

/**
 * Returns the Postgres `songs.id` for a Firestore song document, creating a
 * shadow row on first request. Throws if the Firestore doc does not exist or
 * lacks a usable `audioUrl`.
 */
export async function ensurePgSongFromFirestore(
  opts: EnsurePgSongOptions,
): Promise<{ pgId: number; created: boolean }> {
  const { firestoreId, requesterUserId } = opts;
  if (!firestoreId) throw new Error('firestoreId is required');
  if (!firestore) throw new Error('Firestore not configured on server');

  // 1) Cache hit: already linked
  const [existing] = await db
    .select({ id: songs.id })
    .from(songs)
    .where(eq(songs.firestoreId, firestoreId))
    .limit(1);
  if (existing) return { pgId: existing.id, created: false };

  // 2) Read the Firestore doc
  const docRef = firestore.collection('songs').doc(firestoreId);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new Error(`Firestore song not found: ${firestoreId}`);
  }
  const data: any = snap.data() || {};

  const audioUrl: string | undefined = data.audioUrl || data.audio_url || data.url;
  if (!audioUrl || typeof audioUrl !== 'string') {
    throw new Error(`Firestore song ${firestoreId} has no usable audioUrl`);
  }

  const title: string = String(data.title || data.name || 'Untitled');

  // 3) Resolve owner: Firestore stores userId heterogeneously
  //    - sometimes a numeric Postgres id (string-cast)
  //    - sometimes a Clerk user id string ("user_2X...")
  //    - sometimes a Firestore artist doc id (alphanumeric)
  //    Fallback to the authenticated requester so the row always has an owner.
  let ownerUserId: number = requesterUserId ?? 0;
  const rawUserId = data.userId;
  if (typeof rawUserId === 'number' && Number.isFinite(rawUserId)) {
    ownerUserId = rawUserId;
  } else if (typeof rawUserId === 'string' && /^\d+$/.test(rawUserId)) {
    ownerUserId = parseInt(rawUserId, 10);
  } else if (typeof rawUserId === 'string' && rawUserId.length > 0) {
    // Could be a Clerk user ID (e.g. "user_2Xa9bCd...") or a Firestore artist doc ID.
    // Try to look up PG user by clerkId first, then by firestoreId.
    const [byClerk] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, rawUserId))
      .limit(1);
    if (byClerk) {
      ownerUserId = byClerk.id;
    } else {
      const [byFirestore] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firestoreId, rawUserId))
        .limit(1);
      if (byFirestore) ownerUserId = byFirestore.id;
    }
  }

  // Make sure the owner exists in Postgres; otherwise fall back to requester.
  const [ownerRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, ownerUserId))
    .limit(1);
  if (!ownerRow) {
    if (!requesterUserId) {
      throw new Error(`Cannot resolve owner for Firestore song ${firestoreId} — no userId in doc and no authenticated user`);
    }
    ownerUserId = requesterUserId;
  }

  // 4) Insert shadow row. ON CONFLICT on firestoreId handles concurrent calls.
  const releaseDate = data.releaseDate
    ? new Date(typeof data.releaseDate === 'string' ? data.releaseDate : data.releaseDate.toDate?.() ?? data.releaseDate)
    : null;

  try {
    const [inserted] = await db
      .insert(songs)
      .values({
        userId: ownerUserId,
        title,
        audioUrl,
        firestoreId,
        genre: data.genre || null,
        mood: data.mood || null,
        lyrics: data.lyrics || null,
        coverArt: data.coverArt || null,
        artistGender: data.artistGender === 'female' ? 'female' : data.artistGender === 'male' ? 'male' : null,
        generatedWithAI: !!data.generatedWithAI,
        aiProvider: data.aiProvider || null,
        releaseDate: releaseDate && !Number.isNaN(releaseDate.getTime()) ? releaseDate : null,
        analysisStatus: 'pending',
      } as any)
      .onConflictDoNothing({ target: songs.firestoreId })
      .returning({ id: songs.id });

    if (inserted?.id) {
      logger.info(`[FirestoreSongSync] Linked firestoreId=${firestoreId} → pg songs.id=${inserted.id}`);
      return { pgId: inserted.id, created: true };
    }
  } catch (err: any) {
    logger.warn(`[FirestoreSongSync] Insert race/error for ${firestoreId}: ${err?.message}`);
  }

  // Race: another request inserted it concurrently — re-read.
  const [after] = await db
    .select({ id: songs.id })
    .from(songs)
    .where(eq(songs.firestoreId, firestoreId))
    .limit(1);
  if (after) return { pgId: after.id, created: false };

  throw new Error(`Failed to ensure pg shadow for firestoreId=${firestoreId}`);
}
