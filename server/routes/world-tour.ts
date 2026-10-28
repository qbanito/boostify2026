import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../db/schema';
import { authenticate, type AuthUser } from '../middleware/auth';
import { TourError, tourContext, requireTourArtist, requireTourProject, createTourProject, queueTourFrames,
  approveTourFrames, queueTourRender, refreshTourProject, startWorldTourWorker } from '../services/world-tour-service';
import { listTourProjects, addTourReference } from '../services/world-tour-store';
import { publicTourShows } from '../services/world-tour-prompts';
import { saveTourAsset } from '../services/world-tour-media';

const router = Router();
const actor = (req: Request) => (req as Request & { user: AuthUser }).user;
const handled = (action: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response) => {
  Promise.resolve(action(req, res)).catch((error) => {
    if (!(error instanceof TourError)) console.error('[world-tour] Route error:', error.message);
    res.status(error instanceof TourError ? error.status : 500).json({ success: false,
      error: error instanceof TourError ? error.message : 'World Tour Studio is temporarily unavailable. Please try again.' });
  });
};

router.get('/artists/:artistId/shows', handled(async (req, res) => {
  const id = Number(req.params.artistId);
  if (!Number.isInteger(id) || id <= 0) throw new TourError('Invalid artist profile.');
  const [artist] = await db.select({ id: users.id, published: users.isPublished, layout: users.profileLayout }).from(users).where(eq(users.id, id)).limit(1);
  if (!artist) throw new TourError('Artist profile not found.', 404);
  if (!artist.published || artist.layout?.visibility?.['world-tour'] !== true) return res.json({ success: true, shows: [] });
  const shows = (await listTourProjects(id)).flatMap(publicTourShows).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 24);
  res.json({ success: true, shows });
}));

router.get('/artists/:artistId/context', authenticate, handled(async (req, res) => {
  res.json({ success: true, ...(await tourContext(actor(req), Number(req.params.artistId))) });
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
router.post('/artists/:artistId/reference', authenticate, handled(async (req, res) => {
  const artistId = Number(req.params.artistId);
  await requireTourArtist(actor(req), artistId);
  await new Promise<void>((resolve, reject) => upload.single('image')(req, res, (error: any) => error ? reject(new TourError('Upload one image smaller than 10 MB.')) : resolve()));
  if (!req.file) throw new TourError('Choose a face reference image.');
  let buffer: Buffer;
  try { buffer = await sharp(req.file.buffer, { limitInputPixels: 30_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 94 }).toBuffer(); }
  catch { throw new TourError('Upload a valid JPG, PNG or WebP photograph.'); }
  const id = randomUUID();
  const url = await saveTourAsset(buffer, `${artistId}/references/${id}.jpg`, 'image/jpeg');
  await addTourReference(id, artistId, url);
  res.json({ success: true, url });
}));

router.post('/projects', authenticate, handled(async (req, res) => {
  res.status(201).json({ success: true, project: await createTourProject(actor(req), req.body) });
}));
router.get('/projects/:projectId', authenticate, handled(async (req, res) => {
  const project = await requireTourProject(actor(req), req.params.projectId);
  res.json({ success: true, project: await refreshTourProject(project) });
}));
router.post('/projects/:projectId/frames', authenticate, handled(async (req, res) => {
  res.status(202).json({ success: true, project: await queueTourFrames(actor(req), req.params.projectId, req.body) });
}));
router.patch('/projects/:projectId/approval', authenticate, handled(async (req, res) => {
  res.json({ success: true, project: await approveTourFrames(actor(req), req.params.projectId, req.body.indices, req.body.videoPrompt) });
}));
router.post('/projects/:projectId/render', authenticate, handled(async (req, res) => {
  res.status(202).json({ success: true, project: await queueTourRender(actor(req), req.params.projectId, req.body) });
}));

// Only resumes paid stages explicitly requested by a user. It never creates marketing tasks or messages.
startWorldTourWorker();
export default router;
