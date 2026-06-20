// ────────────────────────────────────────────────────────────────────
// Boostify StageSync AI — REST API Routes
// ────────────────────────────────────────────────────────────────────
// Live-show production module backend. Persists shows in Firestore
// under shows/{showId} with subcollections songs, setlist,
// visualAssets, cueTimeline, technicalExports, liveSessions, devices.
// ────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { db, FieldValue } from '../firebase';
import { authenticate } from '../middleware/auth';
import {
  repertoireArchitectAgent,
  visualDirectorAgent,
  loopGeneratorAgent,
  stageTechnicalDirectorAgent,
  syncEngineAgent,
  emergencyShowAssistant,
  type ShowMaster,
} from '../services/stage-sync-agents';
import {
  generateDefaultAssetPack,
  listExistingAssets,
  DEFAULT_ASSETS,
} from '../services/stage-sync-asset-pack';

const router = Router();

function shortId(prefix = 'show'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function requireDb(res: Response): boolean {
  if (!db) {
    res.status(503).json({ error: 'Firestore unavailable' });
    return false;
  }
  return true;
}

// ── SHOWS: list / create / get / update / delete ──────────────
router.get('/shows', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = (req.user as any)?.id;
    const ownerFilter = userId ? db.collection('shows').where('ownerId', '==', String(userId)) : db.collection('shows');
    const snap = await ownerFilter.orderBy('createdAt', 'desc').limit(100).get();
    const shows = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, shows });
  } catch (e: any) {
    console.error('[StageSync] list shows', e?.message);
    res.status(500).json({ error: 'Failed to list shows' });
  }
});

router.post('/shows', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = (req.user as any)?.id;
    const showId = req.body?.show_id || shortId('show');
    const payload = {
      ...req.body,
      show_id: showId,
      ownerId: userId ? String(userId) : null,
      status: req.body?.status || 'draft',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection('shows').doc(showId).set(payload);
    res.json({ success: true, showId, show: payload });
  } catch (e: any) {
    console.error('[StageSync] create show', e?.message);
    res.status(500).json({ error: 'Failed to create show' });
  }
});

router.get('/shows/:id', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const doc = await db.collection('shows').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Show not found' });
    const show = { id: doc.id, ...doc.data() };
    // Fetch subcollections in parallel
    const [songsSnap, setlistSnap, visualsSnap, cuesSnap, exportsSnap, sessionsSnap, devicesSnap] = await Promise.all([
      db.collection('shows').doc(req.params.id).collection('songs').get(),
      db.collection('shows').doc(req.params.id).collection('setlist').orderBy('position').get(),
      db.collection('shows').doc(req.params.id).collection('visualAssets').get(),
      db.collection('shows').doc(req.params.id).collection('cueTimeline').get(),
      db.collection('shows').doc(req.params.id).collection('technicalExports').get(),
      db.collection('shows').doc(req.params.id).collection('liveSessions').orderBy('startedAt', 'desc').limit(10).get(),
      db.collection('shows').doc(req.params.id).collection('devices').get(),
    ]);
    res.json({
      success: true,
      show,
      songs: songsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      setlist: setlistSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      visualAssets: visualsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      cueTimeline: cuesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      technicalExports: exportsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      liveSessions: sessionsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      devices: devicesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
    });
  } catch (e: any) {
    console.error('[StageSync] get show', e?.message);
    res.status(500).json({ error: 'Failed to fetch show' });
  }
});

router.patch('/shows/:id', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    await db.collection('shows').doc(req.params.id).set(
      { ...req.body, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update show' });
  }
});

router.delete('/shows/:id', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    await db.collection('shows').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to delete show' });
  }
});

// ── REPERTOIRE / SETLIST ──────────────────────────────────────
router.put('/shows/:id/setlist', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const { setlist } = req.body as { setlist: Array<any> };
    const colRef = db.collection('shows').doc(req.params.id).collection('setlist');
    // Wipe and rewrite (small sets)
    const existing = await colRef.get();
    const batch = db.batch();
    existing.docs.forEach((d: any) => batch.delete(d.ref));
    (setlist || []).forEach((song, idx) => {
      const ref = colRef.doc(String(song.id || song.position || idx + 1));
      batch.set(ref, { ...song, position: song.position ?? idx + 1 });
    });
    await batch.commit();
    await db.collection('shows').doc(req.params.id).set(
      { updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ success: true, count: (setlist || []).length });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to save setlist' });
  }
});

// ── DEVICES ───────────────────────────────────────────────────
router.put('/shows/:id/devices', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const { devices } = req.body as { devices: Array<{ id?: string; name: string; type: string; protocol?: string; status?: string }> };
    const colRef = db.collection('shows').doc(req.params.id).collection('devices');
    const existing = await colRef.get();
    const batch = db.batch();
    existing.docs.forEach((d: any) => batch.delete(d.ref));
    (devices || []).forEach((dev, idx) => {
      const id = dev.id || `dev_${idx + 1}`;
      batch.set(colRef.doc(id), { ...dev, id, updatedAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to save devices' });
  }
});

// ── AGENTS — invoke individual agents ─────────────────────────
router.post('/agents/repertoire', authenticate, async (req: Request, res: Response) => {
  try {
    const out = await repertoireArchitectAgent(req.body || {});
    res.json({ success: !!out, data: out });
  } catch (e: any) {
    res.status(500).json({ error: 'Agent failed', message: e?.message });
  }
});

router.post('/agents/visual-director', authenticate, async (req: Request, res: Response) => {
  try {
    const out = await visualDirectorAgent(req.body || {});
    res.json({ success: !!out, data: out });
  } catch (e: any) {
    res.status(500).json({ error: 'Agent failed', message: e?.message });
  }
});

router.post('/agents/loop-generator', authenticate, async (req: Request, res: Response) => {
  try {
    const out = await loopGeneratorAgent(req.body || {});
    res.json({ success: !!out, data: out });
  } catch (e: any) {
    res.status(500).json({ error: 'Agent failed', message: e?.message });
  }
});

router.post('/agents/technical-director', authenticate, async (req: Request, res: Response) => {
  try {
    const out = await stageTechnicalDirectorAgent(req.body || {});
    res.json({ success: !!out, data: out });
  } catch (e: any) {
    res.status(500).json({ error: 'Agent failed', message: e?.message });
  }
});

router.post('/agents/sync-engine', authenticate, async (req: Request, res: Response) => {
  try {
    const out = await syncEngineAgent(req.body || {});
    res.json({ success: !!out, data: out });
  } catch (e: any) {
    res.status(500).json({ error: 'Agent failed', message: e?.message });
  }
});

router.post('/agents/emergency', authenticate, async (req: Request, res: Response) => {
  try {
    const out = await emergencyShowAssistant(req.body || {});
    res.json({ success: !!out, data: out });
  } catch (e: any) {
    res.status(500).json({ error: 'Agent failed', message: e?.message });
  }
});

// ── ORCHESTRATOR — Generate full Show JSON in one call ────────
router.post('/orchestrator/generate-show', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const { artistName, genre, vibe, durationMinutes, brandColors, showTitle, songs } = req.body || {};
    if (!artistName) return res.status(400).json({ error: 'artistName is required' });

    // Run agents in parallel where independent
    const [repertoire, identity] = await Promise.all([
      repertoireArchitectAgent({ artistName, genre, vibe, durationMinutes, songs }),
      visualDirectorAgent({ artistName, genre, showTitle, brandColors, vibe }),
    ]);

    const showId = shortId('show');
    const master: ShowMaster = {
      show_id: showId,
      artist_name: artistName,
      show_title: showTitle || `${artistName} — Live Show`,
      visual_identity: identity || {
        style: 'cinematic neon documentary',
        palette: brandColors || ['#F97316', '#1F2937', '#FFFFFF', '#FCD34D'],
        motion_language: 'slow drift with kinetic punches',
        camera_style: 'handheld 35mm',
        texture_system: 'film grain, ink splash, fluid',
        forbidden_styles: ['cartoonish', '3D plastic', 'AI uncanny faces'],
      },
      technical_setup: {
        screens: ['Main LED wall (16:9)', 'Side IMAG (16:9)'],
        control_protocols: ['OSC', 'MIDI', 'Art-Net', 'Ableton Link'],
        software_targets: ['Resolume', 'TouchDesigner'],
      },
      setlist: repertoire?.setlist || [],
    };

    const userId = (req.user as any)?.id;
    await db.collection('shows').doc(showId).set({
      ...master,
      ownerId: userId ? String(userId) : null,
      status: 'draft',
      rationale: repertoire?.rationale || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Save setlist into subcollection
    if (master.setlist?.length) {
      const batch = db.batch();
      const setlistCol = db.collection('shows').doc(showId).collection('setlist');
      master.setlist.forEach((song, idx) => {
        batch.set(setlistCol.doc(String(song.position || idx + 1)), song);
      });
      await batch.commit();
    }

    res.json({ success: true, showId, master, rationale: repertoire?.rationale });
  } catch (e: any) {
    console.error('[StageSync] orchestrator', e?.message);
    res.status(500).json({ error: 'Orchestrator failed', message: e?.message });
  }
});

// ── ORCHESTRATOR — Generate visual package for a show ─────────
router.post('/shows/:id/visual-package', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const showRef = db.collection('shows').doc(req.params.id);
    const doc = await showRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Show not found' });
    const show: any = doc.data();

    const setlistSnap = await showRef.collection('setlist').orderBy('position').get();
    const setlist = setlistSnap.docs.map((d: any) => d.data());

    // For each song, generate one loop spec for the chorus
    const visualAssets: Array<any> = [];
    for (const song of setlist.slice(0, 8)) {
      const loop = await loopGeneratorAgent({
        songTitle: song.song_title,
        bpm: song.bpm || 100,
        mood: song.mood || 'cinematic',
        visualIdentity: show.visual_identity,
        section: 'chorus',
      });
      if (loop) {
        visualAssets.push({
          songPosition: song.position,
          songTitle: song.song_title,
          ...loop,
        });
      }
    }

    // Persist
    const batch = db.batch();
    const colRef = showRef.collection('visualAssets');
    visualAssets.forEach((va, idx) => {
      batch.set(colRef.doc(`song_${va.songPosition || idx + 1}`), { ...va, updatedAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();

    res.json({ success: true, count: visualAssets.length, visualAssets });
  } catch (e: any) {
    console.error('[StageSync] visual package', e?.message);
    res.status(500).json({ error: 'Visual package failed', message: e?.message });
  }
});

// ── ORCHESTRATOR — Build technical export package ─────────────
router.post('/shows/:id/technical-package', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const showRef = db.collection('shows').doc(req.params.id);
    const doc = await showRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Show not found' });
    const show: any = doc.data();
    const setlistSnap = await showRef.collection('setlist').orderBy('position').get();
    show.setlist = setlistSnap.docs.map((d: any) => d.data());

    const targets = req.body?.targets;
    const result = await stageTechnicalDirectorAgent({ show, targetSoftware: targets });
    if (!result) return res.status(502).json({ error: 'Agent returned no output' });

    const batch = db.batch();
    const colRef = showRef.collection('technicalExports');
    result.exports.forEach((exp, idx) => {
      batch.set(colRef.doc(`export_${idx + 1}`), { ...exp, createdAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();

    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: 'Technical package failed', message: e?.message });
  }
});

// ── LIVE SESSIONS ─────────────────────────────────────────────
router.post('/shows/:id/sessions/start', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const sessionId = shortId('sess');
    await db.collection('shows').doc(req.params.id).collection('liveSessions').doc(sessionId).set({
      sessionId,
      mode: req.body?.mode || 'live', // 'live' | 'rehearsal'
      status: 'running',
      startedAt: FieldValue.serverTimestamp(),
      currentSongPosition: 0,
    });
    res.json({ success: true, sessionId });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to start session' });
  }
});

router.patch('/shows/:id/sessions/:sessionId', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    await db.collection('shows').doc(req.params.id).collection('liveSessions').doc(req.params.sessionId).set(
      { ...req.body, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update session' });
  }
});

router.post('/shows/:id/sessions/:sessionId/end', authenticate, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    await db.collection('shows').doc(req.params.id).collection('liveSessions').doc(req.params.sessionId).set(
      { status: 'ended', endedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// ── TEMPLATES (canned shows for quick-start) ──────────────────
router.get('/templates', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    templates: [
      {
        id: 'intimate-acoustic',
        name: 'Intimate Acoustic Set',
        description: '45 min · 8 songs · warm tungsten visuals · single LED wall',
        defaultDuration: 45,
        defaultVibe: 'warm intimate documentary',
        defaultPalette: ['#F97316', '#1F2937', '#FCD34D', '#FFFFFF'],
      },
      {
        id: 'arena-pop',
        name: 'Arena Pop Spectacle',
        description: '90 min · 14 songs · kinetic generative loops · LED wall + side IMAG',
        defaultDuration: 90,
        defaultVibe: 'kinetic euphoric arena',
        defaultPalette: ['#F97316', '#000000', '#FFFFFF', '#EAB308'],
      },
      {
        id: 'cinematic-electronic',
        name: 'Cinematic Electronic',
        description: '75 min · 12 tracks · slow drift visuals · multi-screen sync',
        defaultDuration: 75,
        defaultVibe: 'cinematic slow-drift electronic',
        defaultPalette: ['#1F2937', '#F97316', '#FFFFFF', '#94A3B8'],
      },
      {
        id: 'rehearsal-mode',
        name: 'Rehearsal Mode',
        description: 'Click track + cue map · no live device sync · safe for testing',
        defaultDuration: 60,
        defaultVibe: 'rehearsal click + cue map',
        defaultPalette: ['#1F2937', '#F97316', '#FFFFFF'],
      },
    ],
  });
});

// ── DEFAULT ASSET PACK (OpenAI gpt-image-1) ────────────────────
// Lists the 11 demo images and their existence on disk.
router.get('/asset-pack', async (_req: Request, res: Response) => {
  const assets = listExistingAssets();
  res.json({
    success: true,
    publicBase: '/stage-sync',
    total: DEFAULT_ASSETS.length,
    existing: assets.filter((a) => a.exists).length,
    assets: DEFAULT_ASSETS.map((spec, i) => ({
      slug: spec.slug,
      kind: spec.kind,
      url: assets[i].url,
      exists: assets[i].exists,
    })),
  });
});

// Generates missing (or all if force=true) demo images via OpenAI.
// Authenticated to avoid abuse (each gpt-image-1 call costs).
router.post('/asset-pack/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const force = !!req.body?.force;
    const only: string[] | undefined = Array.isArray(req.body?.only) ? req.body.only : undefined;
    const out = await generateDefaultAssetPack({ force, only });
    res.json({ success: true, ...out });
  } catch (e: any) {
    console.error('[StageSync] asset-pack generate', e?.message);
    res.status(500).json({ error: e?.message || 'asset_pack_failed' });
  }
});

export default router;
