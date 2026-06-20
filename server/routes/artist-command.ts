/**
 * Artist Command Engine — API routes (/api/artist-command)
 *
 * Flow:
 *   POST /                      → parse command, create artistCommands doc +
 *                                 artistTasks docs, kick off async execution,
 *                                 return { commandId } immediately.
 *   GET  /:commandId            → poll command + its tasks (status/progress).
 *   GET  /artist/:artistId/history → recent commands for an artist.
 *
 * Persistence:
 *   Firestore collection `artistCommands/{commandId}`
 *   Firestore collection `artistTasks/{taskId}` (linked by commandId)
 *
 * Long operations run OUTSIDE the request via a fire-and-forget executor that
 * streams status into Firestore (TaskQueue). The client polls GET /:commandId.
 */
import { Router, Request, Response } from 'express';
import { db, FieldValue, storage } from '../firebase';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { routeCommand } from '../services/artist-command/intent-router';
import {
  planModules, runPlan, moduleLabel, moduleIcon,
  type ModuleKey, type ModuleResult,
} from '../services/artist-command/module-orchestrator';

const router = Router();

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

interface TaskDoc {
  id: string;
  commandId: string;
  artistId: string;
  moduleKey: ModuleKey;
  label: string;
  icon: string;
  order: number;
  status: TaskStatus;
  output: ModuleResult | null;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

function nowMs() { return Date.now(); }

/** Persist a generated image (data: URL) to Storage and return a public URL. */
async function persistImageIfDataUrl(result: ModuleResult, folder: string): Promise<ModuleResult> {
  if (result.type !== 'image' || !result.imageUrl) return result;
  if (!result.imageUrl.startsWith('data:')) return result; // already a hosted URL
  try {
    if (!storage) return result;
    const match = result.imageUrl.match(/^data:(.+?);base64,(.*)$/);
    if (!match) return result;
    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const ext = contentType.split('/')[1] || 'png';
    const fileName = `${folder}/${nowMs()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bucket = storage.bucket();
    const file = bucket.file(fileName);
    await file.save(buffer, { metadata: { contentType }, validation: false });
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
    return { ...result, imageUrl: publicUrl };
  } catch (e: any) {
    logger.error('[artist-command] image persist failed:', e?.message);
    return result;
  }
}

/**
 * Background executor — runs the planned modules and streams status to Firestore.
 * Never throws to the caller; all failures are recorded per-task.
 */
async function executeCommand(opts: {
  commandId: string;
  artistId: string;
  artistName: string;
  artistImageUrl?: string | null;
  genre?: string;
  plan: ModuleKey[];
  params: any;
}) {
  const { commandId, artistId, artistName, artistImageUrl, genre, plan, params } = opts;
  const commandRef = db.collection('artistCommands').doc(commandId);

  try {
    await commandRef.update({ status: 'running', startedAt: nowMs(), updatedAt: nowMs() });

    const total = plan.length;
    let completed = 0;

    const taskRefFor = (key: ModuleKey) =>
      db.collection('artistTasks').doc(`${commandId}__${key}`);

    const results = await runPlan(
      plan,
      { artistName, artistImageUrl, genre, params },
      {
        onTaskStart: async (key) => {
          await taskRefFor(key).set({ status: 'running', startedAt: nowMs() }, { merge: true });
          await commandRef.update({ currentModule: key, updatedAt: nowMs() });
        },
        onTaskDone: async (key, result) => {
          const persisted = await persistImageIfDataUrl(result, `artist-commands/${artistId}/${commandId}`);
          completed += 1;
          await taskRefFor(key).set({
            status: 'completed',
            output: persisted,
            finishedAt: nowMs(),
          }, { merge: true });
          await commandRef.update({
            progress: Math.round((completed / total) * 100),
            updatedAt: nowMs(),
            [`results.${key}`]: persisted,
          });
        },
        onTaskFail: async (key, error) => {
          completed += 1;
          await taskRefFor(key).set({
            status: 'failed', error, finishedAt: nowMs(),
          }, { merge: true });
          await commandRef.update({
            progress: Math.round((completed / total) * 100),
            updatedAt: nowMs(),
          });
        },
      },
    );

    const anyOk = Object.keys(results).length > 0;
    await commandRef.update({
      status: anyOk ? 'completed' : 'failed',
      progress: 100,
      finishedAt: nowMs(),
      updatedAt: nowMs(),
      currentModule: FieldValue.delete(),
    });
  } catch (err: any) {
    logger.error('[artist-command] executor crashed:', err?.message);
    await commandRef.update({
      status: 'failed', error: String(err?.message || err).slice(0, 500), updatedAt: nowMs(),
    }).catch(() => {});
  }
}

// ─── POST / — submit a command ───────────────────────────────────────────────
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!db) return res.status(503).json({ success: false, error: 'Firestore unavailable' });

    const userId = String((req as any).user?.id ?? (req as any).user?.uid ?? 'anon');
    const {
      command,
      source = 'text',
      artistId,
      artistName: artistNameInput,
      artistImageUrl,
      genre,
    } = req.body || {};

    if (!command || typeof command !== 'string' || command.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'command is required' });
    }
    if (!artistId) {
      return res.status(400).json({ success: false, error: 'artistId is required' });
    }

    const parsed = await routeCommand(command);
    const resolvedArtistName = (parsed.artistName || artistNameInput || 'Artist').toString();
    const plan = planModules(parsed);

    const commandRef = db.collection('artistCommands').doc();
    const commandId = commandRef.id;
    const createdAt = nowMs();

    await commandRef.set({
      id: commandId,
      ownerId: userId,
      artistId: String(artistId),
      artistName: resolvedArtistName,
      rawCommand: command.trim(),
      source: source === 'voice' ? 'voice' : 'text',
      intent: parsed.intent,
      params: parsed.params,
      confidence: parsed.confidence,
      parseSource: parsed.source,
      modulePlan: plan,
      results: {},
      status: 'pending',
      progress: 0,
      createdAt,
      updatedAt: createdAt,
    });

    // Create one task doc per module (deterministic ids → easy updates).
    const batch = db.batch();
    plan.forEach((key, order) => {
      const taskRef = db.collection('artistTasks').doc(`${commandId}__${key}`);
      const task: TaskDoc = {
        id: `${commandId}__${key}`,
        commandId,
        artistId: String(artistId),
        moduleKey: key,
        label: moduleLabel(key),
        icon: moduleIcon(key),
        order,
        status: 'pending',
        output: null,
        error: null,
        startedAt: null,
        finishedAt: null,
      };
      batch.set(taskRef, task);
    });
    await batch.commit();

    // Fire-and-forget — runs outside the request lifecycle.
    executeCommand({
      commandId,
      artistId: String(artistId),
      artistName: resolvedArtistName,
      artistImageUrl: artistImageUrl || null,
      genre: parsed.params.genre || genre,
      plan,
      params: parsed.params,
    }).catch((e) => logger.error('[artist-command] execute error:', e?.message));

    return res.json({
      success: true,
      commandId,
      intent: parsed.intent,
      params: parsed.params,
      modulePlan: plan.map((key) => ({ key, label: moduleLabel(key), icon: moduleIcon(key) })),
    });
  } catch (err: any) {
    logger.error('[artist-command] POST error:', err?.message);
    return res.status(500).json({ success: false, error: 'Failed to start command' });
  }
});

// ─── GET /:commandId — poll status ───────────────────────────────────────────
router.get('/:commandId', authenticate, async (req: Request, res: Response) => {
  try {
    if (!db) return res.status(503).json({ success: false, error: 'Firestore unavailable' });
    const { commandId } = req.params;

    const commandSnap = await db.collection('artistCommands').doc(commandId).get();
    if (!commandSnap.exists) {
      return res.status(404).json({ success: false, error: 'command not found' });
    }
    const command = commandSnap.data();

    const tasksSnap = await db.collection('artistTasks')
      .where('commandId', '==', commandId).get();
    const tasks = tasksSnap.docs
      .map((d) => d.data())
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

    return res.json({ success: true, command, tasks });
  } catch (err: any) {
    logger.error('[artist-command] GET error:', err?.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch command' });
  }
});

// ─── GET /artist/:artistId/history — recent commands ─────────────────────────
router.get('/artist/:artistId/history', authenticate, async (req: Request, res: Response) => {
  try {
    if (!db) return res.status(503).json({ success: false, error: 'Firestore unavailable' });
    const { artistId } = req.params;
    const snap = await db.collection('artistCommands')
      .where('artistId', '==', String(artistId))
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    const commands = snap.docs.map((d) => d.data());
    return res.json({ success: true, commands });
  } catch (err: any) {
    // Likely a missing composite index — degrade gracefully.
    logger.error('[artist-command] history error:', err?.message);
    return res.json({ success: true, commands: [] });
  }
});

export default router;
