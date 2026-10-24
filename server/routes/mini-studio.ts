/**
 * Mini Studio — DAW project + AI generation REST API
 * --------------------------------------------------------------
 * Mounted at /api/mini-studio (alongside lyrics router).
 *
 *  GET    /projects                    → list current user's projects
 *  POST   /projects                    → create project
 *  GET    /projects/:id                → load full project
 *  PUT    /projects/:id                → save project state
 *  DELETE /projects/:id                → delete
 *
 *  POST   /generate                    → generic AI audio generation
 *                                        body: { kind, prompt?, bpm?, key?, ... }
 *  POST   /agents/:agent/run           → quick-action invocation
 *
 *  GET    /mastering/presets           → list mastering presets
 *  POST   /master                      → apply mastering preset (metadata)
 *  POST   /separate-stems              → 4-stem separation
 *  POST   /export                      → render & export project
 *  POST   /release                     → kick song-monetization-pipeline
 */

import { Router, Request, Response } from 'express';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { isAuthenticated, getUserId } from '../middleware/clerk-auth';
import { db, FieldValue } from '../firebase';
import { db as pgDb } from '../../db';
import { users as pgUsers, songs as pgSongs } from '../../db/schema';
import { and, desc, eq, or, isNull } from 'drizzle-orm';
import { isAdminEmail } from '../../shared/constants';
import {
  generateAudio,
  getAudioGenerationProviderStatus,
  MASTERING_PRESETS,
  getMasteringPreset,
  type MSGenerationKind,
  type MSGenerationRequest,
} from '../services/mini-studio-service';

const router = Router();

const COL = 'mini_studio_projects';
const SONGS_COL = 'songs';
const USERS_COL = 'users';

const docToObject = (doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) => ({
  id: doc.id,
  ...(doc.data() || {}),
});

router.get('/providers', isAuthenticated, (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, audioGeneration: getAudioGenerationProviderStatus() });
});

async function getUserArtistDocs(userId: string) {
  const users = new Map<string, any>();
  const addArtist = (artist: any, keyHint?: string) => {
    const key = String(keyHint || artist.firestoreId || artist.id || artist.uid || artist.pgId || artist.postgresId || '');
    if (key) users.set(key, artist);
  };
  const addSnap = (snap: FirebaseFirestore.QuerySnapshot) => {
    snap.docs.forEach((doc) => addArtist(docToObject(doc), doc.id));
  };

  const direct = await db.collection(USERS_COL).doc(userId).get();
  if (direct.exists) addArtist(docToObject(direct), direct.id);

  const lookups: Array<[string, any]> = [
    ['uid', userId],
    ['id', userId],
    ['userId', userId],
    ['ownerId', userId],
    ['createdBy', userId],
  ];

  await Promise.allSettled(
    lookups.map(([field, value]) =>
      db.collection(USERS_COL).where(field, '==', value).limit(20).get()
        .then(addSnap)
        .catch((err: Error) => console.warn(`[mini-studio] users lookup ${field} failed:`, err.message))
    )
  );

  if (users.size === 0) {
    addArtist({
      id: userId,
      uid: userId,
      artistName: 'Mi Artista',
      name: 'Mi Artista',
    }, userId);
  }

  return Array.from(users.values());
}

async function getPgMyArtistDocs(clerkUserId: string, email?: string) {
  try {
    const userRecord = await pgDb
      .select({ id: pgUsers.id })
      .from(pgUsers)
      .where(eq(pgUsers.clerkId, clerkUserId))
      .limit(1);

    if (userRecord.length === 0) return [];

    const pgUserId = userRecord[0].id;
    const whereClause = isAdminEmail(email)
      ? or(eq(pgUsers.id, pgUserId), eq(pgUsers.generatedBy, pgUserId), isNull(pgUsers.generatedBy))
      : or(eq(pgUsers.id, pgUserId), eq(pgUsers.generatedBy, pgUserId));

    const artistsFromPg = await pgDb.select().from(pgUsers).where(whereClause);
    return artistsFromPg.map((artist: any) => ({
      id: artist.firestoreId || String(artist.id),
      firestoreId: artist.firestoreId || null,
      pgId: artist.id,
      postgresId: artist.id,
      artistName: artist.artistName || artist.name || artist.displayName,
      name: artist.artistName || artist.name || artist.displayName,
      slug: artist.slug,
      genre: Array.isArray(artist.genres) ? artist.genres[0] : artist.genre,
      primaryGenre: Array.isArray(artist.genres) ? artist.genres[0] : artist.primaryGenre,
      profileImage: artist.profileImage,
      coverImage: artist.coverImage,
      source: 'my-artists',
    }));
  } catch (err) {
    console.warn('[mini-studio] pg my-artists lookup failed:', (err as Error).message);
    return [];
  }
}

async function getSongsForOwnerIds(ownerIds: string[]) {
  const songs = new Map<string, any>();
  const addSnap = (snap: FirebaseFirestore.QuerySnapshot) => {
    snap.docs.forEach((doc) => songs.set(doc.id, docToObject(doc)));
  };

  const uniqueOwnerIds = Array.from(new Set(ownerIds.filter(Boolean)));
  await Promise.allSettled(
    uniqueOwnerIds.flatMap((ownerId) =>
      ['artistId', 'userId'].map((field) =>
        db.collection(SONGS_COL).where(field, '==', ownerId).limit(100).get()
          .then(addSnap)
          .catch((err: Error) => console.warn(`[mini-studio] songs lookup ${field}=${ownerId} failed:`, err.message))
      )
    )
  );

  return Array.from(songs.values()).map((song) => ({
    ...song,
    title: song.title || song.name || 'Sin título',
    name: song.name || song.title || 'Sin título',
    audioUrl: song.audioUrl || song.audioURL || song.fileUrl || song.url || song.streamUrl || song.musicUrl || null,
  })).sort((a, b) => {
    const ta = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
    const tb = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });
}

async function getPgGeneratedSongs(clerkUserId: string) {
  try {
    const [user] = await pgDb.select({ id: pgUsers.id }).from(pgUsers).where(eq(pgUsers.clerkId, clerkUserId)).limit(1);
    if (!user) return [];
    const rows = await pgDb.select().from(pgSongs)
      .where(and(eq(pgSongs.userId, user.id), eq(pgSongs.generatedWithAI, true)))
      .orderBy(desc(pgSongs.createdAt)).limit(100);
    return rows.map((song: any) => ({
      ...song,
      id: `pg-generated-${song.id}`,
      postgresId: song.id,
      artistId: String(song.userId),
      userId: clerkUserId,
      title: song.title || 'Untitled',
      name: song.title || 'Untitled',
      audioUrl: song.audioUrl,
      source: 'postgres-generated',
    }));
  } catch (err) {
    console.warn('[mini-studio] generated Postgres songs lookup failed:', (err as Error).message);
    return [];
  }
}

async function getLibrary(userId: string, email?: string) {
  const artistMap = new Map<string, any>();
  const addArtist = (artist: any) => {
    const key = String(artist.firestoreId || artist.id || artist.uid || artist.pgId || artist.postgresId || '');
    if (key) artistMap.set(key, { ...artistMap.get(key), ...artist });
  };
  (await getUserArtistDocs(userId)).forEach(addArtist);
  (await getPgMyArtistDocs(userId, email)).forEach(addArtist);

  const artists = Array.from(artistMap.values());
  const ownerIds = artists.flatMap((artist) => [
    String(artist.id || ''),
    String(artist.uid || ''),
    String(artist.firestoreId || ''),
    String(artist.pgId || artist.postgresId || ''),
  ]);
  ownerIds.push(userId);

  const songs = await getSongsForOwnerIds(ownerIds);
  const pgGeneratedSongs = await getPgGeneratedSongs(userId);
  for (const song of pgGeneratedSongs) {
    const existingIndex = songs.findIndex((existing: any) => String(existing.id) === String(song.id));
    if (existingIndex < 0) songs.push(song);
    else songs[existingIndex] = { ...song, ...songs[existingIndex], postgresId: song.postgresId };
  }
  const normalizedArtists = artists.map((artist) => {
    const ids = new Set([
      String(artist.id || ''),
      String(artist.uid || ''),
      String(artist.firestoreId || ''),
      String(artist.pgId || artist.postgresId || ''),
    ].filter(Boolean));
    const artistSongs = songs.filter((song) => ids.has(String(song.artistId || '')) || ids.has(String(song.userId || '')));
    return {
      id: String(artist.firestoreId || artist.id),
      firestoreId: artist.firestoreId || artist.id,
      pgId: artist.pgId || artist.postgresId || null,
      name: artist.artistName || artist.name || artist.displayName || artist.username || 'Mi Artista',
      genre: artist.genre || artist.primaryGenre || (Array.isArray(artist.genres) ? artist.genres[0] : null),
      image: artist.profileImage || artist.profileImageUrl || artist.photoURL || null,
      songs: artistSongs,
    };
  });

  return { artists: normalizedArtists, songs };
}

async function assertSongAccess(userId: string, songId: string) {
  const { artists } = await getLibrary(userId);
  const allowedIds = new Set<string>([userId]);
  artists.forEach((artist: any) => {
    allowedIds.add(String(artist.id));
    if (artist.firestoreId) allowedIds.add(String(artist.firestoreId));
    if (artist.pgId) allowedIds.add(String(artist.pgId));
  });
  const ref = db.collection(SONGS_COL).doc(songId);
  const doc = await ref.get();
  if (!doc.exists) return { ok: false, status: 404, error: 'song not found' as const, ref, data: null };
  const data: any = doc.data();
  const owns = allowedIds.has(String(data.artistId || '')) || allowedIds.has(String(data.userId || ''));
  if (!owns) return { ok: false, status: 403, error: 'forbidden' as const, ref, data };
  return { ok: true, status: 200, error: null, ref, data };
}

// ---------------------------------------------------------------
// Artist library + songs (Firestore)
// ---------------------------------------------------------------

router.get('/library', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });
    const library = await getLibrary(userId, (req as any).user?.email);
    res.json({ success: true, ...library });
  } catch (err: any) {
    console.error('[mini-studio] library failed:', err);
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.post('/songs', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });
    const { artistId, title, name, audioUrl = null, coverArt = null, duration = null, genre = null, lyrics = null, source = 'mini-studio', projectId = null, meta = {} } = req.body || {};
    if (!artistId) return res.status(400).json({ success: false, error: 'artistId required' });
    if (!title && !name) return res.status(400).json({ success: false, error: 'title required' });

    const ref = await db.collection(SONGS_COL).add({
      artistId: String(artistId),
      userId,
      title: title || name,
      name: name || title,
      audioUrl,
      coverArt,
      duration,
      genre,
      lyrics,
      source,
      miniStudioProjectId: projectId,
      generatedWithAI: source.includes('ai') || source.includes('mini-studio'),
      isPublished: false,
      plays: 0,
      meta,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const doc = await ref.get();
    res.json({ success: true, song: { id: ref.id, ...doc.data() } });
  } catch (err: any) {
    console.error('[mini-studio] create song failed:', err);
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.post('/songs/import-generated/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const clerkUserId = getUserId(req);
    if (!clerkUserId) return res.status(401).json({ success: false, error: 'unauthenticated' });
    const numericSongId = Number(req.params.id);
    if (!Number.isInteger(numericSongId) || numericSongId <= 0) return res.status(400).json({ success: false, error: 'invalid song id' });

    const [owner] = await pgDb.select({ id: pgUsers.id }).from(pgUsers).where(eq(pgUsers.clerkId, clerkUserId)).limit(1);
    if (!owner) return res.status(404).json({ success: false, error: 'account not found' });
    const [song] = await pgDb.select().from(pgSongs).where(and(
      eq(pgSongs.id, numericSongId),
      eq(pgSongs.userId, owner.id),
      eq(pgSongs.generatedWithAI, true),
    )).limit(1);
    if (!song) return res.status(404).json({ success: false, error: 'generated song not found' });

    const songRef = db.collection(SONGS_COL).doc(`pg-generated-${song.id}`);
    const existing = await songRef.get();
    if (existing.exists) {
      const data: any = existing.data();
      if (data.userId !== clerkUserId) return res.status(403).json({ success: false, error: 'song access denied' });
      return res.json({ success: true, song: { id: songRef.id, ...data } });
    }

    const mirror = {
      artistId: String(song.userId),
      userId: clerkUserId,
      title: song.title,
      name: song.title,
      audioUrl: song.audioUrl,
      coverArt: song.coverArt || null,
      duration: song.duration || null,
      genre: song.genre || null,
      lyrics: song.lyrics || null,
      source: 'music-generator',
      postgresSongId: song.id,
      generatedWithAI: true,
      isPublished: Boolean(song.isPublished),
      plays: song.plays || 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await songRef.set(mirror);
    res.json({ success: true, song: { id: songRef.id, ...mirror } });
  } catch (err: any) {
    console.error('[mini-studio] generated song import failed:', err);
    res.status(500).json({ success: false, error: err?.message || 'could not import generated song' });
  }
});

router.put('/songs/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });
    const access = await assertSongAccess(userId, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });
    const allowed = ['title', 'name', 'audioUrl', 'coverArt', 'duration', 'genre', 'lyrics', 'isrc', 'upc', 'composers', 'miniStudioProjectId', 'releaseStatus'];
    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    await access.ref.update(patch);
    const fresh = await access.ref.get();
    res.json({ success: true, song: { id: fresh.id, ...fresh.data() } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ---------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------

router.get('/projects', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });
    const snap = await db
      .collection(COL)
      .where('userId', '==', userId)
      .limit(50)
      .get();
    // Sort in-memory to avoid requiring a composite Firestore index
    const projects = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const tb = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
    res.json({ success: true, projects });
  } catch (err: any) {
    console.error('[mini-studio] list projects failed:', err);
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.post('/projects', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });
    const { name = 'Untitled', bpm = 122, key = 'A minor', tracks = [], markers = [], artistId = null, songId = null, clips = [], plugins = {}, masterChain = {}, lyrics = '', sessionState = {} } = req.body || {};
    const ref = await db.collection(COL).add({
      userId,
      artistId,
      songId,
      name,
      bpm,
      key,
      tracks,
      markers,
      clips,
      plugins,
      masterChain,
      lyrics,
      sessionState,
      status: 'draft',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (songId) {
      const access = await assertSongAccess(userId, String(songId));
      if (access.ok) await access.ref.update({ miniStudioProjectId: ref.id, updatedAt: FieldValue.serverTimestamp() });
    }
    const doc = await ref.get();
    res.json({ success: true, project: { id: ref.id, ...doc.data() } });
  } catch (err: any) {
    console.error('[mini-studio] create project failed:', err);
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.get('/projects/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const doc = await db.collection(COL).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'not found' });
    const data: any = doc.data();
    if (data.userId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });
    res.json({ success: true, project: { id: doc.id, ...data } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.put('/projects/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const ref = db.collection(COL).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'not found' });
    if ((doc.data() as any).userId !== userId)
      return res.status(403).json({ success: false, error: 'forbidden' });
    const allowed = ['name', 'bpm', 'key', 'artistId', 'songId', 'tracks', 'markers', 'clips', 'plugins', 'masterChain', 'status', 'lyrics', 'sessionState'];
    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    await ref.update(patch);
    if (patch.songId) {
      const access = await assertSongAccess(userId || '', String(patch.songId));
      if (access.ok) await access.ref.update({ miniStudioProjectId: req.params.id, updatedAt: FieldValue.serverTimestamp() });
    }
    const fresh = await ref.get();
    res.json({ success: true, project: { id: ref.id, ...fresh.data() } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.delete('/projects/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const ref = db.collection(COL).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'not found' });
    if ((doc.data() as any).userId !== userId)
      return res.status(403).json({ success: false, error: 'forbidden' });
    await ref.delete();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ---------------------------------------------------------------
// Generation
// ---------------------------------------------------------------

const VALID_KINDS: MSGenerationKind[] = [
  'beat', 'bassline', 'synth', 'pad', 'vocal', 'hook', 'fx', 'intro', 'outro', 'remix',
];

router.post('/generate', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as MSGenerationRequest;
    if (!body.kind || !VALID_KINDS.includes(body.kind)) {
      return res.status(400).json({ success: false, error: `kind must be one of ${VALID_KINDS.join(', ')}` });
    }
    // fal needs a fetchable URL for audio-to-audio remix. Mini Studio keeps
    // recordings private, so mint a short-lived read URL only for this job.
    if (body.kind === 'remix' && body.reference?.startsWith('/api/mini-studio/recordings/')) {
      const match = body.reference.match(/^\/api\/mini-studio\/recordings\/([^/]+)\/([^/]+)\/([^/?#]+)$/);
      const userId = getUserId(req);
      if (!match || decodeURIComponent(match[1]) !== userId) {
        return res.status(403).json({ success: false, error: 'The selected recording is not accessible to this account.' });
      }
      const { storage: fbStorage } = await import('../firebase');
      if (!fbStorage) return res.status(503).json({ success: false, error: 'Audio storage is unavailable for remixing.' });
      const storagePath = `recordings/${userId}/${decodeURIComponent(match[2])}/${decodeURIComponent(match[3])}`;
      const [signedUrl] = await fbStorage.bucket().file(storagePath).getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
      body.reference = signedUrl;
    }
    const result = await generateAudio(body);
    res.json(result);
  } catch (err: any) {
    console.error('[mini-studio] generate failed:', err);
    res.status(err?.statusCode || 500).json({ success: false, error: err?.message });
  }
});

// ---------------------------------------------------------------
// Agent quick actions
// ---------------------------------------------------------------

router.post('/agents/:agent/run', isAuthenticated, async (req: Request, res: Response) => {
  const agent = req.params.agent;
  const body = req.body || {};
  try {
    switch (agent) {
      case 'producer':
        // Compose a multi-step plan + immediately generate a beat as starter
        return res.json({
          success: true,
          agent,
          plan: [
            'Analyze references and define structure',
            'Generate skeleton beat',
            'Add bassline + pads',
            'Suggest arrangement edits',
          ],
          starter: await generateAudio({ kind: 'beat', bpm: body.bpm, styleTags: body.styleTags }),
        });
      case 'songwriter':
        return res.json({
          success: true,
          agent,
          message: 'Use POST /api/mini-studio/lyrics/generate for full lyrics workflow.',
        });
      case 'beatmaker':
        return res.json({ success: true, agent, result: await generateAudio({ kind: 'beat', ...body }) });
      case 'vocal-coach':
        return res.json({
          success: true,
          agent,
          tips: [
            'Open vowels on the chorus hook for projection',
            'Add diaphragm breath every 2 bars',
            'Apply slight chest mix on the bridge',
          ],
        });
      case 'mix-engineer':
        return res.json({
          success: true,
          agent,
          chain: ['HPF 80Hz', 'EQ low-mid carve', 'Comp 3:1 -6dB GR', 'Bus glue', 'Reverb send 22%'],
        });
      case 'mastering-engineer':
        return res.json({
          success: true,
          agent,
          presets: MASTERING_PRESETS,
        });
      case 'stem-separator':
        return res.json({
          success: true,
          agent,
          message: 'Call POST /api/mini-studio/separate-stems with audioUrl.',
        });
      case 'release-assistant':
        return res.json({
          success: true,
          agent,
          checklist: [
            'Generate cover art',
            'Render visualizer',
            'Schedule distribution',
            'Auto-create social posts',
            'Pitch for sync licensing',
          ],
        });
      default:
        return res.status(404).json({ success: false, error: 'unknown agent' });
    }
  } catch (err: any) {
    console.error(`[mini-studio] agent ${agent} failed:`, err);
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ---------------------------------------------------------------
// Mastering
// ---------------------------------------------------------------

router.get('/mastering/presets', (_req: Request, res: Response) => {
  res.json({ success: true, presets: MASTERING_PRESETS });
});

router.post('/master', isAuthenticated, async (req: Request, res: Response) => {
  const { presetId = 'spotify', projectId, measured: clientMeasured } = req.body || {};
  const preset = getMasteringPreset(presetId);
  if (!preset) return res.status(400).json({ success: false, error: 'invalid preset' });

  // Prefer the loudness the client actually measured in real time (Web Audio
  // LoudnessMeter); fall back to the preset targets when unavailable.
  const measured = {
    integratedLufs: Number.isFinite(clientMeasured?.integratedLufs) && clientMeasured.integratedLufs > -70
      ? Number(clientMeasured.integratedLufs)
      : preset.targetLufs,
    truePeakDb: Number.isFinite(clientMeasured?.truePeakDb) && clientMeasured.truePeakDb > -70
      ? Number(clientMeasured.truePeakDb)
      : preset.truePeakDb,
    dynamicRangeLU: Number.isFinite(clientMeasured?.dynamicRangeLU) ? Number(clientMeasured.dynamicRangeLU) : 7.4,
  };

  // Persist the mastering snapshot to the project when available (additive).
  if (projectId) {
    try {
      const userId = getUserId(req);
      const ref = db.collection(COL).doc(String(projectId));
      const doc = await ref.get();
      if (doc.exists && (doc.data() as any).userId === userId) {
        await ref.update({
          mastering: { presetId, preset, measured, updatedAt: Date.now() },
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('[mini-studio] master persist skipped:', (err as Error).message);
    }
  }

  res.json({
    success: true,
    projectId: projectId || null,
    preset,
    measured,
    masteredUrl: null,
    note: 'Mastering targets stored. Real-time loudness measured on client; offline render available via WAV export.',
  });
});

// ---------------------------------------------------------------
// Stem separation (delegate)
// ---------------------------------------------------------------

router.post('/separate-stems', isAuthenticated, async (req: Request, res: Response) => {
  const { audioUrl } = req.body || {};
  if (!audioUrl) return res.status(400).json({ success: false, error: 'audioUrl required' });
  try {
    // Lazy import to avoid circular and keep startup fast
    const { separateStems } = await import('../services/voice-ai-service');
    if (typeof separateStems === 'function') {
      const out = await separateStems(audioUrl);
      const stems = Array.isArray(out?.stems) ? out.stems : [];
      if (out?.success && stems.some((stem: any) => stem?.audioUrl && stem.audioUrl !== audioUrl)) {
        return res.json({ success: true, ...out });
      }
      return res.status(503).json({ success: false, error: out?.error || 'Stem separation is unavailable: configure a supported audio-separation provider.' });
    }
  } catch (err: any) {
    console.warn('[mini-studio] voice-ai-service.separateStems unavailable:', (err as Error).message);
    return res.status(503).json({ success: false, error: err?.message || 'Stem separation provider unavailable.' });
  }
  return res.status(503).json({ success: false, error: 'Stem separation provider is not available.' });
});

// ---------------------------------------------------------------
// Export
// ---------------------------------------------------------------

router.post('/export', isAuthenticated, async (req: Request, res: Response) => {
  return res.status(501).json({ success: false, error: 'Server-side export is not configured. Use the WAV export in the Mini Studio, which renders the loaded source in your browser.' });
});

// ---------------------------------------------------------------
// Upload vocal recording as multipart/form-data (large recordings do not go
// through the JSON parser). Keep legacy base64 support for older clients.
// ---------------------------------------------------------------

router.post('/upload-recording', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });
    const { base64Audio, projectId = null, artistId = null, title = 'Vocal Recording' } = req.body || {};
    const uploaded = (req as any).files?.audio;
    const audioFile = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    const mimeType = audioFile?.mimetype || req.body?.mimeType || 'audio/webm';
    if (!audioFile && (!base64Audio || typeof base64Audio !== 'string')) {
      return res.status(400).json({ success: false, error: 'audio file required' });
    }
    if (!String(mimeType).toLowerCase().startsWith('audio/')) {
      return res.status(415).json({ success: false, error: 'Only audio recordings can be uploaded here.' });
    }
    if (projectId) {
      const project = await db.collection(COL).doc(String(projectId)).get();
      if (!project.exists || (project.data() as any)?.userId !== userId) {
        return res.status(403).json({ success: false, error: 'project access denied' });
      }
    }

    const { storage: fbStorage } = await import('../firebase');
    if (!fbStorage) {
      return res.status(503).json({ success: false, error: 'Recording storage is unavailable. The take is still in this browser; configure Firebase Storage before closing this session.' });
    }

    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : mimeType.includes('wav') ? 'wav' : 'webm';
    const storagePath = `recordings/${userId}/${projectId || 'session'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-vocal.${ext}`;
    const bucket = fbStorage.bucket();
    const file = bucket.file(storagePath);
    const destination = file.createWriteStream({ metadata: { contentType: mimeType, cacheControl: 'private, max-age=0, no-store' } });
    const source = audioFile?.tempFilePath
      ? createReadStream(audioFile.tempFilePath)
      : Readable.from([audioFile?.data?.length ? audioFile.data : Buffer.from(base64Audio, 'base64')]);
    await new Promise<void>((resolve, reject) => {
      destination.once('finish', resolve);
      destination.once('error', reject);
      source.once('error', reject);
      source.pipe(destination);
    });
    const audioUrl = `/api/mini-studio/recordings/${encodeURIComponent(userId)}/${encodeURIComponent(String(projectId || 'session'))}/${encodeURIComponent(storagePath.split('/').pop()!)}`;

    let songId: string | null = null;

    // Optionally auto-save as a song entry
    if (artistId) {
      const songRef = await db.collection('songs').add({
        artistId: String(artistId),
        userId,
        title: String(title),
        name: String(title),
        audioUrl,
        source: 'mini-studio-vocal',
        miniStudioProjectId: projectId,
        generatedWithAI: false,
        isPublished: false,
        plays: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      songId = songRef.id;
    }

    res.json({ success: true, audioUrl, provider: 'firebase-storage', songId });
  } catch (err: any) {
    console.error('[mini-studio] upload-recording failed:', err);
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.get('/recordings/:ownerId/:projectId/:fileName', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { ownerId, projectId, fileName } = req.params;
    if (!/^[\w.-]+$/.test(fileName) || !/^[\w.-]+$/.test(projectId)) {
      return res.status(403).json({ success: false, error: 'recording access denied' });
    }
    if (userId !== ownerId) {
      const audioUrl = `/api/mini-studio/recordings/${encodeURIComponent(ownerId)}/${encodeURIComponent(projectId)}/${encodeURIComponent(fileName)}`;
      const published = await db.collection(SONGS_COL).where('audioUrl', '==', audioUrl).limit(5).get();
      const isPublished = published.docs.some((song: any) => {
        const data = song.data() || {};
        return data.isPublished === true || data.published === true || data.status === 'published';
      });
      if (!isPublished) return res.status(userId ? 403 : 401).json({ success: false, error: 'recording access denied' });
    }
    const { storage: fbStorage } = await import('../firebase');
    if (!fbStorage) return res.status(503).json({ success: false, error: 'Recording storage unavailable' });
    const object = fbStorage.bucket().file(`recordings/${ownerId}/${projectId}/${fileName}`);
    const [metadata] = await object.getMetadata();
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const size = Number(metadata.size || 0);
    const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    let streamOptions: { start?: number; end?: number } = {};
    if (range && size > 0) {
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[2] && range[1] ? Math.min(size - 1, Number(range[2])) : size - 1;
      if (start >= size || end < start) return res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
      streamOptions = { start, end };
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', String(end - start + 1));
    } else if (size > 0) {
      res.setHeader('Content-Length', String(size));
    }
    res.setHeader('Accept-Ranges', 'bytes');
    object.createReadStream(streamOptions).on('error', (error: any) => {
      if (!res.headersSent) res.status(error?.code === 404 ? 404 : 502);
      res.end();
    }).pipe(res);
  } catch (err: any) {
    res.status(err?.code === 404 ? 404 : 500).json({ success: false, error: 'Could not load recording' });
  }
});

// ---------------------------------------------------------------
// Release (monetization pipeline kickoff)
// ---------------------------------------------------------------

router.post('/release', isAuthenticated, async (req: Request, res: Response) => {
  const { projectId, songId = null, channels = ['distrokid'] } = req.body || {};
  if (!projectId) return res.status(400).json({ success: false, error: 'projectId required' });
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });
    const ref = db.collection(COL).doc(projectId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'project not found' });
    if ((doc.data() as any).userId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });
    await ref.update({
      status: 'release-queued',
      songId,
      releaseChannels: channels,
      releasedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (songId) {
      const access = await assertSongAccess(userId, String(songId));
      if (access.ok) {
        await access.ref.update({
          releaseStatus: 'queued',
          distributionChannels: channels,
          miniStudioProjectId: projectId,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    // Optional: trigger song-monetization-pipeline if available
    try {
      const mod: any = await import('../services/song-monetization-pipeline');
      if (typeof mod?.kickoffPipeline === 'function') {
        await mod.kickoffPipeline({ projectId, songId, channels });
      }
    } catch {
      /* pipeline service not present in this build */
    }
    res.json({ success: true, projectId, songId, channels, status: 'release-queued' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

export default router;
