import { randomUUID } from 'crypto';
import { runTourStage } from './world-tour-runner';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { users, songs } from '../../db/schema';
import { db as firestore } from '../firebase';
import { canManagePodcastArtist as canManageArtist } from './podcast-clip-policy';
import { getCreditCostFromUsd, getUserBalance } from './credit-engine';
import { settleTourCredits } from './world-tour-billing';
import { downloadTourMedia, prepareTourAudio, finishTourVideo, saveTourAsset } from './world-tour-media';
import { createTourFrames, createTourVideoPrompt, tourIdentity, tourBoardError, tourVideoInput } from './world-tour-prompts';
import { ensureTourStore, loadTourProject, listTourProjects, saveNewTourProject, mutateTourProject,
  leaseTourOperation, updateTourOperation, releaseTourOperation, pendingTourOperations, tourReferences, existingTourOperations } from './world-tour-store';
import { WORLD_TOUR_COST_USD as COST, WORLD_TOUR_IMAGE_MODEL, WORLD_TOUR_VIDEO_MODEL, WORLD_TOUR_SYNC_MODEL,
  WORLD_TOUR_HERO_INDEX as HERO, WORLD_TOUR_DESTINATIONS, type TourProject, type TourSong } from '../../shared/world-tour';

const falKey = () => process.env.FAL_KEY || process.env.FAL_AI_KEY || process.env.FAL_API_KEY || '';
const operationFalKey = (op: any) => op.keySlot === 'backup' ? process.env.FAL_KEY_BACKUP || falKey() : falKey();
export class TourError extends Error { constructor(message: string, public status = 400) { super(message); } }

export async function requireTourArtist(actor: any, artistId: number) {
  if (!Number.isInteger(artistId) || artistId <= 0) throw new TourError('Invalid artist profile.');
  const [artist] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
  if (!artist) throw new TourError('Artist profile not found.', 404);
  if (!canManageArtist(actor || {}, { id: Number(artist.id), generatedBy: artist.generatedBy })) throw new TourError('You can only create shows for an artist profile you manage.', 403);
  return artist;
}

export async function requireTourProject(actor: any, id: string): Promise<TourProject> {
  const project = await loadTourProject(id);
  if (!project) throw new TourError('Tour project not found.', 404);
  await requireTourArtist(actor, project.artistId);
  return project;
}

export async function artistTourSongs(artist: any): Promise<TourSong[]> {
  const postgres = await db.select().from(songs).where(eq(songs.userId, artist.id)).orderBy(desc(songs.createdAt)).limit(100);
  const result: TourSong[] = postgres.map((song) => ({ id: `pg:${song.id}`, title: song.title, audioUrl: song.audioUrl,
    isSingle: song.isSingle, genre: song.genre || undefined, lyrics: song.lyrics || undefined,
    description: song.description || undefined, duration: song.duration || undefined }));
  const artistIds = Array.from(new Set([String(artist.id), artist.firestoreId, artist.slug].filter(Boolean)));
  const userIds = Array.from(new Set([artist.id, String(artist.id), artist.firestoreId].filter(Boolean)));
  const snapshots = await Promise.allSettled([
    firestore.collection('songs').where('artistId', 'in', artistIds).limit(100).get(),
    firestore.collection('songs').where('userId', 'in', userIds).limit(100).get(),
  ]);
  for (const snapshot of snapshots) if (snapshot.status === 'fulfilled') {
    for (const doc of snapshot.value.docs) {
      const song = doc.data(); const audioUrl = song.audioUrl || song.audio_url || '';
      if (!audioUrl || result.some((item) => item.id === `fs:${doc.id}`)) continue;
      const existing = result.find((item) => item.audioUrl === audioUrl);
      if (existing) { existing.isSingle ||= song.isSingle === true; continue; }
      result.push({ id: `fs:${doc.id}`, title: song.title || song.name || 'Untitled song', audioUrl,
        isSingle: song.isSingle === true, genre: song.genre, lyrics: song.lyrics, description: song.description, duration: song.duration });
    }
  }
  return result.filter((song) => /^https:\/\//.test(song.audioUrl) || song.audioUrl.startsWith('/uploads/'))
    .sort((a, b) => Number(b.isSingle) - Number(a.isSingle));
}

export async function tourQuote(email: string) {
  const admin = (await getUserBalance(email)).isAdmin;
  const price = async (usd: number) => admin ? 0 : getCreditCostFromUsd(usd);
  const [image, video, precisionVideo] = await Promise.all([
    price(COST.image), price(COST.video), price(COST.video + COST.sync),
  ]);
  return { image, storyboard: image * 9, remaining: image * 8, video, precisionVideo, duration: 15, imageModel: WORLD_TOUR_IMAGE_MODEL, videoModel: WORLD_TOUR_VIDEO_MODEL };
}

export async function tourContext(actor: any, artistId: number) {
  const artist = await requireTourArtist(actor, artistId);
  await ensureTourStore();
  const [catalog, refs, projects, quote] = await Promise.all([
    artistTourSongs(artist), tourReferences(artistId), listTourProjects(artistId), tourQuote(String(actor.email || '').toLowerCase()),
  ]);
  return { artistName: artist.artistName || artist.username || 'Artist', songs: catalog,
    faceImages: Array.from(new Set([artist.profileImage, artist.profileImageUrl, ...refs].filter((url): url is string => !!url && /^https:\/\//.test(url)))),
    projects: projects.slice(0, 20).map((project) => ({ id: project.id, destinationId: project.destinationId,
      songTitle: project.song.title, createdAt: project.createdAt, readyFrames: project.frames.filter((frame) => frame.status === 'READY').length })), quote };
}

export async function createTourProject(actor: any, input: any): Promise<TourProject> {
  const artistId = Number(input.artistId);
  const artist = await requireTourArtist(actor, artistId);
  if (!WORLD_TOUR_DESTINATIONS.some((item) => item.id === input.destinationId)) throw new TourError('Choose a concert destination.');
  const context = await tourContext(actor, artistId);
  const song = context.songs.find((item) => item.id === input.songId);
  if (!song) throw new TourError('Choose a song from this artist catalog.');
  const faceUrl = String(input.faceUrl || context.faceImages[0] || '');
  if (!context.faceImages.includes(faceUrl)) throw new TourError('Select or upload a face reference for this artist.');
  const clipStart = Number(input.clipStart || 0);
  if (!Number.isFinite(clipStart) || clipStart < 0 || clipStart > 7200) throw new TourError('Choose a valid song start time.');
  const now = new Date().toISOString();
  const project: TourProject = {
    id: randomUUID(), artistId, artistName: context.artistName, destinationId: input.destinationId,
    song, faceUrl, clipStart, lookDirection: String(input.lookDirection || '').slice(0, 700),
    aspectRatio: input.aspectRatio === '9:16' ? '9:16' : '16:9', frames: [], renders: [], videoPrompt: '', createdAt: now, updatedAt: now,
  };
  project.frames = createTourFrames(project, artist.biography || '');
  project.videoPrompt = createTourVideoPrompt(project);
  await saveNewTourProject(project);
  return project;
}

function requestKey(raw: unknown): string {
  if (typeof raw !== 'string' || !/^[a-zA-Z0-9_-]{16,64}$/.test(raw)) throw new TourError('A valid generation request key is required.');
  return raw;
}

async function budget(actor: any, usd: number, expectedCredits?: number) {
  if (!(falKey() || process.env.FAL_KEY_BACKUP)) throw new TourError('Concert generation is not configured on the server.', 503);
  if (!actor.email) throw new TourError('Your account email could not be verified.', 401);
  const balance = await getUserBalance(String(actor.email).toLowerCase());
  const credits = expectedCredits ?? await getCreditCostFromUsd(usd);
  if (!balance.isAdmin && balance.credits < credits) throw new TourError(`This generation needs ${credits} credits. Your balance is ${balance.credits}.`, 402);
}

export async function queueTourFrames(actor: any, projectId: string, input: any) {
  await requireTourProject(actor, projectId);
  const key = requestKey(input.requestKey);
  const indices = Array.from(new Set<number>(Array.isArray(input.indices) ? input.indices : []));
  if (!indices.length || indices.length > 9 || indices.some((index) => !Number.isInteger(index) || index < 0 || index > 8)) throw new TourError('Choose valid storyboard frames.');
  if (indices.includes(HERO) && indices.length !== 1) throw new TourError('Generate the artist close-up separately before the other frames.');
  const existing = await existingTourOperations(indices.map((index) => `${projectId}-${key}-${index}`));
  const newCount = indices.length - existing.length;
  if (!newCount) return loadTourProject(projectId);
  await budget(actor, COST.image * newCount, (await getCreditCostFromUsd(COST.image)) * newCount);
  const created = await mutateTourProject(projectId, async (project, tx) => {
    const ids: string[] = [];
    if (project.renders.some((render) => !['COMPLETED', 'FAILED'].includes(render.status))) throw new TourError('Wait for the concert render before changing its storyboard.', 409);
    if (indices.includes(HERO) && project.frames.some((frame) => frame.status === 'QUEUED')) throw new TourError('Wait for the current frames before changing the artist anchor.', 409);
    for (const index of indices) {
      const id = `${projectId}-${key}-${index}`;
      const exists = await tx.query('SELECT id FROM world_tour_operations WHERE id=$1', [id]);
      if (exists.rows.length) continue;
      const frame = project.frames[index];
      if (frame.status === 'QUEUED') throw new TourError('This frame is already generating.', 409);
      if (index !== HERO && project.frames[HERO].status !== 'READY') throw new TourError('Generate and approve the artist close-up first.');
      if (index !== HERO && !project.frames[HERO].approved) throw new TourError('Approve the artist close-up before creating the other frames.');
      const custom = input.prompts?.[String(index)];
      if (typeof custom === 'string' && custom.trim()) frame.prompt = custom.trim().slice(0, 6000);
      const refs = [project.faceUrl, ...(index !== HERO ? [project.frames[HERO].imageUrl!] : [])];
      const op = { id, projectId, kind: 'image', index, email: String(actor.email).toLowerCase(), costUsd: COST.image,
        anchorOperationId: index === HERO ? id : project.frames[HERO].operationId,
        status: 'PREPARING', model: WORLD_TOUR_IMAGE_MODEL, createdAt: Date.now(),
        input: { prompt: `${tourIdentity(project)}\n${frame.prompt}`, image_urls: refs, num_images: 1, resolution: '1K', aspect_ratio: project.aspectRatio, output_format: 'jpeg', limit_generations: true } };
      frame.operationId = id; frame.status = 'QUEUED'; frame.approved = false; delete frame.error;
      if (index === HERO) for (const other of project.frames) if (other.index !== HERO) other.approved = false;
      await tx.query('INSERT INTO world_tour_operations(id,project_id,data) VALUES($1,$2,$3::jsonb)', [id, projectId, JSON.stringify(op)]);
      ids.push(id);
    }
    return ids;
  });
  void runTourBatch(created);
  return loadTourProject(projectId);
}

export async function approveTourFrames(actor: any, projectId: string, indices: number[], videoPrompt?: string) {
  await requireTourProject(actor, projectId);
  await mutateTourProject(projectId, async (project) => {
    if (!Array.isArray(indices) || indices.some((index) => !Number.isInteger(index) || !project.frames[index]?.imageUrl || project.frames[index]?.status !== 'READY')) throw new TourError('Only completed images can be approved.');
    if (indices.some((index) => index !== HERO && project.frames[index].anchorOperationId !== project.frames[HERO].operationId)) throw new TourError('Regenerate these shots using the current artist anchor before approving them.');
    for (const index of indices) project.frames[index].approved = true;
    if (typeof videoPrompt === 'string' && videoPrompt.trim()) project.videoPrompt = videoPrompt.trim().slice(0, 12_000);
  });
  return loadTourProject(projectId);
}

export async function queueTourRender(actor: any, projectId: string, input: any) {
  await requireTourProject(actor, projectId);
  const key = requestKey(input.requestKey); const precisionSync = input.precisionSync === true;
  const costUsd = COST.video + (precisionSync ? COST.sync : 0);
  const id = `${projectId}-${key}-render`;
  if ((await existingTourOperations([id])).length) return loadTourProject(projectId);
  await budget(actor, costUsd);
  await mutateTourProject(projectId, async (project, tx) => {
    if ((await tx.query('SELECT id FROM world_tour_operations WHERE id=$1', [id])).rows.length) return;
    const boardError = tourBoardError(project);
    if (boardError) throw new TourError(boardError);
    if (project.renders.some((render) => !['COMPLETED', 'FAILED'].includes(render.status))) throw new TourError('A concert render is already running.', 409);
    const op = { id, projectId, kind: 'render', email: String(actor.email).toLowerCase(), costUsd, precisionSync,
      status: 'PREPARING', phase: 'WAN', model: WORLD_TOUR_VIDEO_MODEL, createdAt: Date.now(),
      faceUrl: project.faceUrl, audioSource: project.song.audioUrl, clipStart: project.clipStart,
      input: tourVideoInput(project) };
    project.renders.unshift({ id, status: 'QUEUED', precisionSync, posterUrl: project.frames[HERO].imageUrl, createdAt: new Date().toISOString() });
    await tx.query('INSERT INTO world_tour_operations(id,project_id,data) VALUES($1,$2,$3::jsonb)', [id, projectId, JSON.stringify(op)]);
  });
  void processTourOperation(id);
  return loadTourProject(projectId);
}

async function submitFal(model: string, input: any) {
  const credentials = [{ slot: 'primary', key: falKey() }, { slot: 'backup', key: process.env.FAL_KEY_BACKUP }].filter((item) => item.key);
  for (let index = 0; index < credentials.length; index++) {
    const credential = credentials[index];
    const response = await fetch(`https://queue.fal.run/${model}`, { method: 'POST',
      headers: { Authorization: `Key ${credential.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(45_000) });
    const data = await response.json().catch(() => ({}));
    if ([401, 403].includes(response.status) && index < credentials.length - 1) continue;
    if (!response.ok || !data.request_id || !/^https:\/\/queue\.fal\.run\//.test(data.status_url || '') || !/^https:\/\/queue\.fal\.run\//.test(data.response_url || '')) {
      console.warn('[world-tour] Fal submission rejected:', model, response.status, JSON.stringify(data.detail || data.error || { returnedFields: Object.keys(data) }).slice(0, 500));
      const error = new Error(`The generation provider could not accept this stage (HTTP ${response.status}).`);
      if (/exhausted balance|insufficient.*balance|top up/i.test(JSON.stringify(data))) Object.assign(error, { code: 'FAL_BALANCE' });
      throw error;
    }
    return { requestId: data.request_id, statusUrl: data.status_url, responseUrl: data.response_url, keySlot: credential.slot };
  }
  throw new Error('The generation provider is not configured.');
}

async function patchRender(op: any, status: any, patch: any = {}) {
  await mutateTourProject(op.projectId, async (project) => {
    const render = project.renders.find((item) => item.id === op.id);
    if (render) Object.assign(render, { status, ...patch });
  });
}

async function failTourOperation(op: any, error: any) {
  const message = /^Insufficient credits/.test(error?.message || '') ? error.message
    : error?.code === 'FAL_BALANCE' ? 'The generation provider needs a balance top-up. Credits charged for this stage are returned automatically.'
    : 'This generation could not finish. Credits charged for this stage are returned automatically.';
  op.status = 'REFUND_PENDING'; op.error = message;
  await updateTourOperation(op);
  await mutateTourProject(op.projectId, async (project) => {
    if (op.kind === 'image') {
      const frame = project.frames[op.index];
      if (frame.operationId === op.id) Object.assign(frame, { status: frame.imageUrl ? 'READY' : 'FAILED', approved: false, error: message });
    } else {
      const render = project.renders.find((item) => item.id === op.id);
      if (render) Object.assign(render, { status: 'FAILED', error: message });
    }
  });
  await settleTourCredits(op.email, op.id, op.costUsd, true);
  op.status = 'FAILED'; await updateTourOperation(op);
}

export async function processTourOperation(id: string) {
  let op: any;
  try {
    op = await leaseTourOperation(id);
    if (!op) return;
    await runTourStage(op, {
      save: updateTourOperation,
      charge: (item) => settleTourCredits(item.email, item.id, item.costUsd),
      prepareAudio: (item) => prepareTourAudio(item.audioSource, item.clipStart, item.id),
      submit: submitFal,
      poll: async (item) => {
        const headers = { Authorization: 'Key ' + operationFalKey(item) };
        const response = await fetch(item.statusUrl, { headers, signal: AbortSignal.timeout(20_000) });
        if (!response.ok) {
          if ([404, 410].includes(response.status)) throw new Error('Provider job expired.');
          return null;
        }
        const status = await response.json();
        if (['FAILED', 'CANCELLED'].includes(status.status)) throw new Error('Provider generation failed.');
        if (status.status !== 'COMPLETED') return null;
        const resultResponse = await fetch(item.responseUrl, { headers, signal: AbortSignal.timeout(30_000) });
        if (!resultResponse.ok && resultResponse.status >= 500) return null;
        const result = await resultResponse.json();
        const url = item.kind === 'image' ? result.images?.[0]?.url : result.video?.url || result.video_url;
        if (!resultResponse.ok || !/^https:\/\//.test(url || '')) throw new Error('Provider returned no usable media.');
        return url;
      },
      faceBase64: async (item) => (await downloadTourMedia(item.faceUrl, 8 * 1024 * 1024)).toString('base64'),
      saveImage: async (item) => saveTourAsset(await downloadTourMedia(item.outputUrl, 20 * 1024 * 1024), item.projectId + '/frames/' + item.id + '.jpg', 'image/jpeg'),
      completeFrame: async (item, url) => mutateTourProject(item.projectId, async (project) => {
        if (project.frames[item.index].operationId === item.id) Object.assign(project.frames[item.index], { status: 'READY', imageUrl: url, approved: false, anchorOperationId: item.anchorOperationId });
      }),
      renderState: patchRender,
      finishVideo: (item) => finishTourVideo(item.outputUrl, item.audioUrl, item.rawVideoUrl, item.id),
      fail: failTourOperation,
      log: (message) => console.error('[world-tour] Stage processing error:', message),
    });
  } catch (error: any) {
    console.error('[world-tour] Stage recovery error:', error.message);
    if (op) await failTourOperation(op, error).catch(() => {});
  } finally { if (op) await releaseTourOperation(id).catch(() => {}); }
}

async function runTourBatch(ids: string[]) {
  const queue = [...ids];
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) await processTourOperation(queue.shift()!);
  }));
}

let sweepRunning = false;
let worker: ReturnType<typeof setInterval> | undefined;
export function startWorldTourWorker() {
  if (worker || process.env.WORLD_TOUR_WORKER_ENABLED === 'false') return;
  worker = setInterval(async () => {
    if (sweepRunning) return;
    sweepRunning = true;
    try { await runTourBatch(await pendingTourOperations()); }
    catch (error: any) { console.error('[world-tour] Recovery worker:', error.message); }
    finally { sweepRunning = false; }
  }, 15_000);
  worker.unref();
}

export async function refreshTourProject(project: TourProject) {
  const ids = [...project.frames.filter((frame) => frame.status === 'QUEUED').map((frame) => frame.operationId!),
    ...project.renders.filter((render) => !['FAILED', 'COMPLETED'].includes(render.status)).map((render) => render.id)];
  void runTourBatch(ids);
  return project;
}
