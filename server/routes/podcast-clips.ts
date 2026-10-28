import { Router, type Request, type Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { users, songs, musicVideoProjects } from '../../db/schema';
import { authenticate } from '../middleware/auth';
import { chargeCreditsFromUsd, addCredits, getUserBalance, getCreditCostFromUsd } from '../services/credit-engine';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { db as firestore, FieldValue } from '../firebase';
import { canManagePodcastArtist, toPublicPodcastClip } from '../services/podcast-clip-policy';

const router = Router();
const MODEL = 'alibaba/wan-3.0/reference-to-video';
const COLLECTION = 'podcast_clip_jobs';
const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || '';
const openai = createTrackedOpenAI(
  process.env.OPENAI_API_KEY ? { apiKey: process.env.OPENAI_API_KEY } : undefined,
);
const STYLE_PROMPTS: Record<string, string> = {
  studio: 'intimate warm podcast studio, close microphone framing, amber practical lights, honest conversational energy',
  backstage: 'candid backstage interview after a live show, documentary handheld camera, subtle stage lights and tour atmosphere',
  radio: 'vintage radio booth, analog gear, nostalgic warm film grain, intimate late-night interview',
  neon: 'stylish night-time podcast set with saturated neon lights, urban reflections, energetic modern camera movement',
  rooftop: 'relaxed rooftop conversation at golden hour, expansive city skyline, cinematic natural light and gentle camera drift',
  editorial: 'refined editorial podcast portrait, clean composition, softbox lighting, premium music magazine visual language',
  lofi: 'calm lo-fi listening room, soft window light, muted colors, gentle grain and reflective conversation',
  street: 'fast-paced street interview outside a music venue, lively crowd bokeh, natural handheld framing, authentic candid moment',
  vinyl: 'record-listening podcast corner with vinyl records and album sleeves, rich tactile detail, warm nostalgic lighting',
  future: 'immersive futuristic podcast set, restrained holographic accents, atmospheric blue light, elegant experimental visual design',
};

// Public playback requires no session. Drafts and job/account data are never returned.
router.get('/artists/:artistId/clips', async (req: Request, res: Response) => {
  try {
    const artistId = Number(req.params.artistId);
    if (!Number.isInteger(artistId) || artistId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid artist profile.' });
    }
    const [artist] = await db.select({ id: users.id, profileLayout: users.profileLayout })
      .from(users).where(eq(users.id, artistId)).limit(1);
    if (!artist) return res.status(404).json({ success: false, error: 'Artist profile not found.' });
    const layout = artist.profileLayout as { visibility?: Record<string, boolean> } | null;
    if (layout?.visibility?.['podcast-clips'] !== true) return res.json({ success: true, clips: [] });

    // A single-field query works with existing Firestore indexes; completion is filtered below.
    const jobs = await firestore.collection(COLLECTION).where('artistId', '==', artistId).get();
    const clips = jobs.docs.map((doc: any) => toPublicPodcastClip(doc.id, doc.data()))
      .filter((clip: any) => clip !== null)
      .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 24);
    res.json({ success: true, clips });
  } catch (error: any) {
    console.error('[podcast-clips] Public feed error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Podcast episodes are temporarily unavailable.' });
  }
});
router.get('/estimate', authenticate, async (_req: Request, res: Response) => {
  try {
    const internalCostUsd = 30 * 0.05;
    const credits = await getCreditCostFromUsd(internalCostUsd);
    res.json({ success: true, model: 'Wan 3.0', duration: 30, resolution: '720p', credits });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Could not calculate the credit estimate.' });
  }
});

function ownerId(req: Request): string {
  const user = (req as any).user;
  return String(user?.uid || user?.id || '');
}

async function getArtistContext(req: Request, artistId: number) {
  const user = (req as any).user;
  const userId = Number(user?.id);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(artistId) || artistId <= 0) return null;
  const [artist] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
  if (!artist) return null;
  if (!canManagePodcastArtist(user, artist)) return null;
  const [artistSongs, videoProjects] = await Promise.all([
    db.select({ title: songs.title, genre: songs.genre, mood: songs.mood, lyrics: songs.lyrics, description: songs.description })
      .from(songs).where(eq(songs.userId, artistId)).orderBy(desc(songs.createdAt)).limit(8),
    artist.email
      ? db.select({ projectName: musicVideoProjects.projectName, songName: musicVideoProjects.songName, concept: musicVideoProjects.selectedConcept })
        .from(musicVideoProjects).where(eq(musicVideoProjects.userEmail, artist.email)).orderBy(desc(musicVideoProjects.createdAt)).limit(5)
      : Promise.resolve([]),
  ]);
  return { artist, songs: artistSongs, videos: videoProjects };
}

router.post('/script', authenticate, async (req: Request, res: Response) => {
  try {
    if (!openai.apiKey) return res.status(503).json({ success: false, error: 'Script generation is not configured right now.' });
    const artistId = Number(req.body?.artistId);
    const styleId = String(req.body?.styleId || 'studio');
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.slice(0, 500) : '';
    const language = ['es', 'en', 'pt'].includes(req.body?.language) ? req.body.language : 'es';
    const context = await getArtistContext(req, artistId);
    if (!context) return res.status(403).json({ success: false, error: 'You can only create clips for an artist profile you manage.' });

    const knownMusic = context.songs.map((song) => ({ title: song.title, genre: song.genre, mood: song.mood, description: song.description, lyricExcerpt: song.lyrics?.slice(0, 240) }));
    const profileVideos = Array.isArray(context.artist.topYoutubeVideos)
      ? context.artist.topYoutubeVideos.slice(0, 5).map((video: any) => ({ title: video.title, type: video.type }))
      : [];
    const knownVideos = [
      ...context.videos.map((video) => ({ project: video.projectName, song: video.songName, concept: video.concept })),
      ...profileVideos,
    ];
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', temperature: 0.9, max_tokens: 220,
      messages: [
        { role: 'system', content: `Write a spoken script for a roughly 30-second music podcast clip (60-75 words). Make it entertaining, natural, and centered on one clear idea. Use this visual direction as inspiration: ${STYLE_PROMPTS[styleId] || STYLE_PROMPTS.studio}. Write in ${language}. Use only facts explicitly present in the profile, songs, or videos. Do not invent biography, achievements, collaborations, or quotes. If information is missing, ask an open question or talk about creativity and process without attributing facts. Return only spoken words, without headings or camera directions.` },
        { role: 'user', content: JSON.stringify({ artist: context.artist.artistName || context.artist.username || 'Artist', biography: context.artist.biography || '', genres: context.artist.genres || context.artist.genre || '', songs: knownMusic, videoProjects: knownVideos, requestedTopic: topic || "Suggest a fresh, entertaining angle inspired by the artist's music." }) },
      ],
    });
    const script = response.choices[0]?.message?.content?.trim();
    if (!script) return res.status(502).json({ success: false, error: 'The script could not be prepared.' });
    res.json({ success: true, script, contextSources: { songs: knownMusic.length, videoProjects: knownVideos.length, biography: !!context.artist.biography } });
  } catch (error: any) {
    console.error('[podcast-clips] Script error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Script generation is temporarily unavailable. Please try again.' });
  }
});

router.post('/generate', authenticate, async (req: Request, res: Response) => {
  let chargedCredits = 0;
  const userEmail = String((req as any).user?.email || '').trim().toLowerCase();
  try {
    const artistId = Number(req.body?.artistId);
    const context = await getArtistContext(req, artistId);
    if (!context) return res.status(403).json({ success: false, error: 'You can only create clips for an artist profile you manage.' });
    if (!FAL_KEY) return res.status(503).json({ success: false, error: 'La conexión con Fal no está configurada en el servidor.' });
    if (!userEmail) return res.status(401).json({ success: false, error: 'No se pudo verificar el correo de tu cuenta.' });
    const script = typeof req.body?.script === 'string' ? req.body.script.trim().slice(0, 1200) : '';
    const styleId = String(req.body?.styleId || 'studio');
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.slice(0, 500) : '';
    const language = ['es', 'en', 'pt'].includes(req.body?.language) ? req.body.language : 'es';
    const stylePrompt = STYLE_PROMPTS[styleId];
    if (!stylePrompt || script.length < 10) return res.status(400).json({ success: false, error: 'Selecciona un estilo y añade un guion válido.' });

    const duration = 30;
    const resolution = '720p';
    const internalCostUsd = duration * 0.05; // Current Fal rate for this endpoint; refresh if pricing changes.
    const cost = await getCreditCostFromUsd(internalCostUsd);
    const balance = await getUserBalance(userEmail);
    if (!balance.isAdmin && balance.credits < cost) {
      return res.status(402).json({ success: false, error: `Necesitas ${cost} créditos para este clip; tu saldo actual es ${balance.credits}.`, requiredCredits: cost, remainingCredits: balance.credits });
    }

    const artist = context.artist;
    const refs = [artist.profileImage, artist.coverImage].filter((url): url is string => typeof url === 'string' && url.startsWith('https://')).slice(0, 2);
    const songsSummary = context.songs.map((song) => `${song.title}${song.genre ? ` (${song.genre})` : ''}${song.mood ? `, ${song.mood}` : ''}`).join('; ');
    const prompt = `Create a 30-second vertical artist podcast clip. Visual direction: ${stylePrompt}. The artist shown in the reference image is the subject; preserve their recognizable appearance and do not change identity. Natural direct-to-camera podcast delivery, expressive but believable face and gestures, clean editorial composition, crisp readable frame, no visible text or logos. Artist: ${artist.artistName || artist.username || 'musician'}. Music identity: ${(artist.genres || []).join(', ') || artist.genre || 'use the provided artist profile'}${songsSummary ? `. Music catalog: ${songsSummary}` : ''}. Topic: ${topic || 'artist story and music'} . Spoken script / dialogue in ${language}: “${script}”. Maintain one coherent visual setup for the whole clip.`;
    const charge = await chargeCreditsFromUsd(userEmail, internalCostUsd, `Podcast Clip — ${artist.artistName || artist.username || 'Artist'} · Wan 3.0 · 30s 720p`);
    if (!charge.success) return res.status(402).json({ success: false, error: charge.error || 'Saldo insuficiente.', requiredCredits: charge.creditsCharged, remainingCredits: charge.remainingBalance });
    chargedCredits = charge.creditsCharged;
    const falResponse = await fetch(`https://queue.fal.run/${MODEL}`, {
      method: 'POST', headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, duration, resolution, aspect_ratio: '9:16', audio: true, reference_image_urls: refs, enable_prompt_expansion: true, enable_thinking: false, enable_safety_checker: true }),
    });
    const falData = await falResponse.json().catch(() => ({}));
    if (!falResponse.ok || !falData.request_id) throw new Error(falData.detail || falData.error || 'Fal no pudo iniciar la generación.');

    const requestId = String(falData.request_id);
    await firestore.collection(COLLECTION).doc(requestId).set({
      requestId, ownerId: ownerId(req), userEmail, artistId, model: MODEL,
      title: topic.trim().slice(0, 120) || `${artist.artistName || artist.username || 'Artist'} - Podcast episode`,
      styleId, posterUrl: refs[0] || null,
      estimatedCredits: chargedCredits, estimatedCostUsd: internalCostUsd,
      statusUrl: falData.status_url || `https://queue.fal.run/${MODEL}/requests/${requestId}/status`,
      responseUrl: falData.response_url || `https://queue.fal.run/${MODEL}/requests/${requestId}`,
      status: 'IN_QUEUE', refunded: false, createdAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, job: { requestId, status: 'IN_QUEUE', estimatedCredits: chargedCredits, remainingCredits: charge.remainingBalance } });
  } catch (error: any) {
    if (chargedCredits > 0 && userEmail) {
      try { await addCredits(userEmail, chargedCredits, 'refund', 'Refund — Podcast Clip generation could not start'); }
      catch (refundError: any) { console.error('[podcast-clips] Credit refund failed:', refundError?.message || refundError); }
    }
    console.error('[podcast-clips] Generation submit error:', error?.message || error);
    res.status(500).json({ success: false, error: error?.message || 'No se pudo iniciar la generación.' });
  }
});

router.get('/jobs/:requestId', authenticate, async (req: Request, res: Response) => {
  try {
    const ref = firestore.collection(COLLECTION).doc(req.params.requestId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ success: false, error: 'No se encontró este clip.' });
    const job = snapshot.data() as any;
    if (job.ownerId !== ownerId(req)) return res.status(403).json({ success: false, error: 'No tienes acceso a este clip.' });
    const statusResponse = await fetch(job.statusUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
    const statusData = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) return res.status(statusResponse.status).json({ success: false, error: statusData.detail || 'No se pudo consultar Fal.' });
    if (statusData.status === 'COMPLETED') {
      const resultResponse = await fetch(job.responseUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
      const resultData = await resultResponse.json().catch(() => ({}));
      const videoUrl = resultData.video?.url || resultData.output?.video?.url;
      if (!resultResponse.ok || !videoUrl) {
        let refunded = false;
        await firestore.runTransaction(async (tx) => {
          const fresh = await tx.get(ref);
          if (!fresh.exists || fresh.data()?.refunded) return;
          tx.set(ref, { status: 'FAILED', refunded: true, failedAt: FieldValue.serverTimestamp() }, { merge: true });
          refunded = true;
        });
        if (refunded && Number(job.estimatedCredits) > 0) {
          await addCredits(job.userEmail, Number(job.estimatedCredits), 'refund', 'Refund - Podcast Clip result unavailable');
        }
        return res.json({ success: true, job: { requestId: job.requestId, status: 'FAILED', error: 'Fal finished without returning a playable video. Credits have been refunded.' } });
      }
      await ref.set({ status: 'COMPLETED', videoUrl, completedAt: FieldValue.serverTimestamp() }, { merge: true });
      return res.json({ success: true, job: { requestId: job.requestId, status: 'COMPLETED', videoUrl, estimatedCredits: job.estimatedCredits } });
    }
    if (statusData.status === 'FAILED' || statusData.status === 'CANCELLED') {
      let refunded = false;
      await firestore.runTransaction(async (tx) => {
        const fresh = await tx.get(ref);
        if (!fresh.exists || fresh.data()?.refunded) return;
        tx.set(ref, { status: 'FAILED', refunded: true, failedAt: FieldValue.serverTimestamp() }, { merge: true });
        refunded = true;
      });
      if (refunded && Number(job.estimatedCredits) > 0) {
        await addCredits(job.userEmail, Number(job.estimatedCredits), 'refund', 'Refund — failed Podcast Clip generation');
      }
      return res.json({ success: true, job: { requestId: job.requestId, status: 'FAILED', error: 'La generación falló; los créditos fueron devueltos.' } });
    }
    res.json({ success: true, job: { requestId: job.requestId, status: statusData.status || job.status, estimatedCredits: job.estimatedCredits } });
  } catch (error: any) {
    console.error('[podcast-clips] Poll error:', error?.message || error);
    res.status(500).json({ success: false, error: 'No se pudo consultar el estado del clip.' });
  }
});

export default router;
