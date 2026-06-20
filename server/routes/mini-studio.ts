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
import { isAuthenticated, getUserId } from '../middleware/clerk-auth';
import { db, FieldValue } from '../firebase';
import { db as pgDb } from '../../db';
import { users as pgUsers } from '../../db/schema';
import { eq, or, isNull } from 'drizzle-orm';
import { isAdminEmail } from '../../shared/constants';
import {
  generateAudio,
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
    const result = await generateAudio(body);
    res.json(result);
  } catch (err: any) {
    console.error('[mini-studio] generate failed:', err);
    res.status(500).json({ success: false, error: err?.message });
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
      return res.json({ success: true, ...out });
    }
  } catch (err) {
    console.warn('[mini-studio] voice-ai-service.separateStems unavailable:', (err as Error).message);
  }
  // Graceful fallback: queued
  res.json({
    success: true,
    queued: true,
    message: 'Stem separation queued. No live separator configured.',
    audioUrl,
  });
});

// ---------------------------------------------------------------
// Export
// ---------------------------------------------------------------

router.post('/export', isAuthenticated, async (req: Request, res: Response) => {
  const { projectId, songId = null, formats = ['wav-24'], target } = req.body || {};
  if (!projectId) return res.status(400).json({ success: false, error: 'projectId required' });
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });
  const ref = db.collection(COL).doc(projectId);
  const doc = await ref.get();
  if (doc.exists && (doc.data() as any).userId === userId) {
    await ref.update({
      status: 'export-queued',
      exportFormats: formats,
      exportTarget: target || null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  if (songId) {
    const access = await assertSongAccess(userId, String(songId));
    if (access.ok) await access.ref.update({ miniStudioProjectId: projectId, exportStatus: 'queued', updatedAt: FieldValue.serverTimestamp() });
  }
  res.json({
    success: true,
    projectId,
    songId,
    target: target || null,
    exports: formats.map((f: string) => ({
      format: f,
      url: null,
      status: 'queued',
    })),
    note: 'Export queued. Hook to render worker for actual file delivery.',
  });
});

// ---------------------------------------------------------------
// Upload vocal recording (base64 → Firebase Storage)
// ---------------------------------------------------------------

router.post('/upload-recording', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'unauthenticated' });
    const { base64Audio, mimeType = 'audio/webm', projectId = null, artistId = null, title = 'Vocal Recording' } = req.body || {};
    if (!base64Audio || typeof base64Audio !== 'string') {
      return res.status(400).json({ success: false, error: 'base64Audio required' });
    }

    const { storage: fbStorage } = await import('../firebase');
    if (!fbStorage) {
      // Fallback: return the base64 as a data URL (dev only, large but functional)
      return res.json({ success: true, audioUrl: `data:${mimeType};base64,${base64Audio}`, provider: 'dataurl', note: 'Firebase Storage not configured — using data URL fallback.' });
    }

    const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
    const filename = `recordings/${userId}/${projectId || 'session'}/${Date.now()}-vocal.${ext}`;
    const bucket = fbStorage.bucket();
    const file = bucket.file(filename);
    const buffer = Buffer.from(base64Audio, 'base64');
    await file.save(buffer, { contentType: mimeType, metadata: { cacheControl: 'public, max-age=31536000' } });
    await file.makePublic();
    const audioUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

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
