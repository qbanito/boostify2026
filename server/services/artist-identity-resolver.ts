import { or, eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../db/schema';

export interface ArtistIdentity {
  rawArtistId: string;
  numericId: number | null;
  firestoreId: string | null;
  slug: string | null;
  username: string | null;
  clerkId: string | null;
  artistName: string | null;
  textIds: string[];
}

function uniqueStrings(values: Array<string | number | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
  }
  return [...seen];
}

export async function resolveArtistIdentity(artistId: string | number): Promise<ArtistIdentity> {
  const rawArtistId = String(artistId ?? '').trim();
  const numericId = /^\d+$/.test(rawArtistId) ? Number(rawArtistId) : null;

  let artist: {
    id: number;
    firestoreId: string | null;
    slug: string | null;
    username: string | null;
    clerkId: string | null;
    artistName: string | null;
  } | null = null;

  try {
    const conditions = numericId
      ? [eq(users.id, numericId), eq(users.firestoreId, rawArtistId), eq(users.slug, rawArtistId), eq(users.username, rawArtistId), eq(users.clerkId, rawArtistId)]
      : [eq(users.firestoreId, rawArtistId), eq(users.slug, rawArtistId), eq(users.username, rawArtistId), eq(users.clerkId, rawArtistId)];

    const rows = await db
      .select({
        id: users.id,
        firestoreId: users.firestoreId,
        slug: users.slug,
        username: users.username,
        clerkId: users.clerkId,
        artistName: users.artistName,
      })
      .from(users)
      .where(or(...conditions))
      .limit(1);

    artist = rows[0] ?? null;
  } catch {
    artist = null;
  }

  const resolvedNumericId = artist?.id ?? numericId;
  const textIds = uniqueStrings([
    rawArtistId,
    resolvedNumericId,
    artist?.firestoreId,
    artist?.slug,
    artist?.username,
    artist?.clerkId,
  ]);

  return {
    rawArtistId,
    numericId: resolvedNumericId ?? null,
    firestoreId: artist?.firestoreId ?? null,
    slug: artist?.slug ?? null,
    username: artist?.username ?? null,
    clerkId: artist?.clerkId ?? null,
    artistName: artist?.artistName ?? null,
    textIds,
  };
}