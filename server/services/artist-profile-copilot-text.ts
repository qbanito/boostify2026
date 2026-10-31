import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../db/schema';
import { copilotTextChangesSchema, type ProfileTextChanges } from '../../shared/artist-profile-copilot';

export async function prepareCopilotTextSave(artistId: number, ownerId: string, rawChanges: ProfileTextChanges) {
  const changes = copilotTextChangesSchema.parse(rawChanges);
  const [artist] = await db.select({
    id: users.id, clerkId: users.clerkId, generatedBy: users.generatedBy, firestoreId: users.firestoreId,
    biography: users.biography, artistName: users.artistName, genre: users.genre, genres: users.genres, location: users.location,
  }).from(users).where(eq(users.id, artistId)).limit(1);
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, ownerId)).limit(1);
  if (!artist || !owner || (artist.clerkId !== ownerId && artist.id !== owner.id && artist.generatedBy !== owner.id)) throw new Error('You no longer own this artist profile.');

  // A field-level compare protects a manual edit made while the AI was writing.
  const conditions: SQL[] = [eq(users.id, artistId)];
  conditions.push(artist.id === owner.id ? eq(users.id, owner.id) : artist.clerkId === ownerId ? eq(users.clerkId, ownerId) : eq(users.generatedBy, owner.id));
  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (changes.biography !== undefined) {
    patch.biography = changes.biography;
    conditions.push(artist.biography === null ? isNull(users.biography) : eq(users.biography, artist.biography));
  }
  if (changes.displayName !== undefined) {
    patch.artistName = changes.displayName;
    conditions.push(artist.artistName === null ? isNull(users.artistName) : eq(users.artistName, artist.artistName));
  }
  if (changes.genre !== undefined) {
    patch.genre = changes.genre; patch.genres = [changes.genre];
    conditions.push(artist.genre === null ? isNull(users.genre) : eq(users.genre, artist.genre));
    conditions.push(artist.genres === null ? isNull(users.genres) : eq(users.genres, artist.genres));
  }
  if (changes.location !== undefined) {
    patch.location = changes.location;
    conditions.push(artist.location === null ? isNull(users.location) : eq(users.location, artist.location));
  }

  return {
    changes,
    commit: async () => {
      const updated = await db.update(users).set(patch).where(and(...conditions)).returning({ id: users.id });
      if (!updated.length) throw new Error('The profile text changed while writing. Read the current text before retrying.');
      let mirrorSynced = true;
      if (artist.firestoreId) {
        try {
          const { db: firestore } = await import('../firebase');
          const mirror = { ...changes, ...(changes.displayName ? { name: changes.displayName } : {}), updatedAt: new Date() };
          await firestore.collection('users').doc(artist.firestoreId).set(mirror, { merge: true });
        } catch {
          mirrorSynced = false;
          console.warn('[copilot] Profile text saved in PostgreSQL; legacy mirror could not sync.', { artistId });
        }
      }
      return { saved: true, changes, mirrorSynced };
    },
  };
}
