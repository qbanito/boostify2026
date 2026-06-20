/**
 * My Universe API Routes
 *
 * Lets an artist owner select which of their artists appear on their
 * public "My Universe" discography landing page.
 *
 * GET  /api/my-universe/settings          → authenticated — get owner's settings
 * PUT  /api/my-universe/settings          → authenticated — save visible artist IDs
 * GET  /api/my-universe/public/:userId    → public — landing page data
 */

import { Router, Request, Response } from 'express';
import { db as pgDb } from '../db';
import { db as firestoreDb } from '../firebase';
import { users, songs } from '../../db/schema';
import { eq, inArray, or } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { trackedOpenAI } from '../utils/tracked-openai';

const router = Router();

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getUserPgId(req: Request): Promise<number | null> {
  const clerkId = (req as any).auth?.userId;
  if (clerkId) {
    const [u] = await pgDb.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (u) return u.id;
  }
  const rawId = (req as any).user?.id;
  if (!rawId) return null;
  const numId = Number(rawId);
  if (!isNaN(numId) && numId > 0) return numId;
  const [u] = await pgDb.select({ id: users.id }).from(users)
    .where(or(eq(users.clerkId, String(rawId)), eq(users.firestoreId, String(rawId))))
    .limit(1);
  return u?.id ?? null;
}

const settingsCollection = () => firestoreDb.collection('my_universe_settings');

async function getSettings(userId: number) {
  const doc = await settingsCollection().doc(String(userId)).get();
  if (!doc.exists) {
    return { visibleArtistIds: [], isPublic: true, title: '', bio: '', theme: 'dark' };
  }
  return doc.data() as {
    visibleArtistIds: number[];
    isPublic: boolean;
    title: string;
    bio: string;
    theme: string;
  };
}

async function buildArtistList(ownerPgId: number, visibleIds: number[]) {
  // Fetch all artists owned by this user
  const owned = await pgDb.select({
    id: users.id,
    artistName: users.artistName,
    name: users.username,
    slug: users.slug,
    profileImage: users.profileImage,
    coverImage: users.coverImage,
    biography: users.biography,
    genres: users.genres,
    country: users.country,
    spotifyUrl: users.spotifyUrl,
    isAIGenerated: users.isAIGenerated,
  }).from(users).where(
    or(eq(users.id, ownerPgId), eq(users.generatedBy, ownerPgId))
  );

  // If no visible IDs set, show all by default
  // Normalise to numbers in case Firestore returned string-encoded IDs
  const numericVisibleIds = visibleIds.map(Number).filter((n) => !isNaN(n));
  const filtered = numericVisibleIds.length === 0
    ? owned
    : owned.filter((a) => numericVisibleIds.includes(Number(a.id)));

  return filtered;
}

// ─── GET /settings ────────────────────────────────────────────────────────────

router.get('/settings', authenticate, async (req: Request, res: Response) => {
  try {
    const pgId = await getUserPgId(req);
    if (!pgId) return res.status(401).json({ error: 'Not authenticated' });

    const settings = await getSettings(pgId);

    // Also return the full list of owned artists for the selector
    const allArtists = await pgDb.select({
      id: users.id,
      artistName: users.artistName,
      name: users.username,
      slug: users.slug,
      profileImage: users.profileImage,
      genres: users.genres,
    }).from(users).where(
      or(eq(users.id, pgId), eq(users.generatedBy, pgId))
    );

    return res.json({
      success: true,
      settings,
      allArtists,
      universeUrl: `/universe/${pgId}`,
    });
  } catch (err: any) {
    console.error('my-universe /settings GET error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /settings ────────────────────────────────────────────────────────────

router.put('/settings', authenticate, async (req: Request, res: Response) => {
  try {
    const pgId = await getUserPgId(req);
    if (!pgId) return res.status(401).json({ error: 'Not authenticated' });

    const { visibleArtistIds, isPublic, title, bio, theme } = req.body;

    await settingsCollection().doc(String(pgId)).set({
      visibleArtistIds: Array.isArray(visibleArtistIds) ? visibleArtistIds : [],
      isPublic: isPublic !== false,
      title: title || '',
      bio: bio || '',
      theme: theme || 'dark',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return res.json({ success: true });
  } catch (err: any) {
    console.error('my-universe /settings PUT error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /public/:userId ──────────────────────────────────────────────────────

router.get('/public/:userId', async (req: Request, res: Response) => {
  try {
    const requestedId = parseInt(req.params.userId, 10);
    if (isNaN(requestedId)) return res.status(400).json({ error: 'Invalid userId' });

    // If this is an artist profile created by a parent account, use the parent
    // account's universe settings (e.g., /universe/1405 should load user 33's settings)
    const [artistRecord] = await pgDb
      .select({ id: users.id, generatedBy: users.generatedBy })
      .from(users)
      .where(eq(users.id, requestedId))
      .limit(1);

    const ownerPgId = artistRecord?.generatedBy ?? requestedId;

    const settings = await getSettings(ownerPgId);

    if (!settings.isPublic) {
      return res.status(403).json({ error: 'This universe is private' });
    }

    const artists = await buildArtistList(ownerPgId, settings.visibleArtistIds);

    // Get discography (songs) for each visible artist — songs.userId references users.id
    const artistIds = artists.map((a) => a.id);
    let discography: any[] = [];
    if (artistIds.length > 0) {
      discography = await pgDb.select({
        id: songs.id,
        title: songs.title,
        userId: songs.userId,
        coverArt: songs.coverArt,
        audioUrl: songs.audioUrl,
        genre: songs.genre,
        duration: songs.duration,
        releaseDate: songs.releaseDate,
        plays: songs.plays,
        isSingle: songs.isSingle,
        description: songs.description,
        lyrics: songs.lyrics,
      }).from(songs).where(inArray(songs.userId, artistIds));
    }

    // Get owner info
    const [owner] = await pgDb.select({
      id: users.id,
      artistName: users.artistName,
      profileImage: users.profileImage,
      slug: users.slug,
    }).from(users).where(eq(users.id, ownerPgId)).limit(1);

    return res.json({
      success: true,
      settings: {
        title: settings.title,
        bio: settings.bio,
        theme: settings.theme,
      },
      owner: owner || null,
      artists,
      discography,
    });
  } catch (err: any) {
    console.error('my-universe /public/:userId error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;

// ─── POST /generate-bio ───────────────────────────────────────────────────────

router.post('/generate-bio', authenticate, async (req: Request, res: Response) => {
  try {
    const pgId = await getUserPgId(req);
    if (!pgId) return res.status(401).json({ error: 'Not authenticated' });

    const { artistId, tone = 'press_release', lang = 'es' } = req.body;
    const targetId = artistId ? Number(artistId) : pgId;

    // Validate ownership
    const [artist] = await pgDb.select({
      id: users.id,
      artistName: users.artistName,
      name: users.username,
      biography: users.biography,
      genres: users.genres,
      country: users.country,
      generatedBy: users.generatedBy,
    }).from(users).where(eq(users.id, targetId)).limit(1);

    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    if (artist.id !== pgId && artist.generatedBy !== pgId) {
      return res.status(403).json({ error: 'Not authorized for this artist' });
    }

    // Fetch songs for context (up to 15)
    const artistSongs = await pgDb.select({ title: songs.title, genre: songs.genre, description: songs.description })
      .from(songs).where(eq(songs.userId, targetId)).limit(15);

    const TONES: Record<string, string> = {
      press_release: 'formal press release style, professional, third-person',
      casual:        'friendly and warm tone, approachable, conversational',
      epic:          'cinematic and epic, poetic, powerful, full of emotion',
      minimal:       'minimalist and punchy, 2-3 sentences, no fluff',
      social:        'social media bio, personality-forward, energetic, emojis allowed',
    };
    const LANGS: Record<string, string> = {
      es: 'in Spanish (español)',
      en: 'in English',
      pt: 'in Portuguese (português)',
    };

    const artistNameStr  = artist.artistName || artist.name || 'the artist';
    const bio            = artist.biography?.trim() || '';
    const genres         = (artist.genres || []).join(', ');
    const songList       = artistSongs.map(s => s.title).filter(Boolean).join(', ');

    const prompt = [
      `You are a music biography writer. Generate a ${TONES[tone] ?? TONES.press_release} biography ${LANGS[lang] ?? LANGS.es} for the artist "${artistNameStr}".`,
      '',
      'CONTEXT FROM ARTIST PROFILE:',
      bio        ? `Biography: ${bio}` : '',
      genres     ? `Genres: ${genres}` : '',
      artist.country ? `Country: ${artist.country}` : '',
      songList   ? `Discography (titles): ${songList}` : '',
      '',
      'Write an engaging biography of 3-5 sentences based on the context above. Be specific and highlight what makes this artist unique. Do NOT invent facts not present in the context.',
    ].filter(l => l !== null).join('\n');

    const completion = await trackedOpenAI.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 350,
      temperature: 0.85,
    });

    const generatedBio = completion.choices[0]?.message?.content?.trim() || '';
    return res.json({ success: true, bio: generatedBio });
  } catch (err: any) {
    console.error('my-universe /generate-bio error:', err);
    return res.status(500).json({ error: err.message });
  }
});
