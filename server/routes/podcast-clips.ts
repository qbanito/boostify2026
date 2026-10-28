import { Router, type Request, type Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { users, songs, musicVideoProjects } from '../../db/schema';
import { authenticate } from '../middleware/auth';
import { addCredits, getUserBalance } from '../services/credit-engine';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { db as firestore, FieldValue } from '../firebase';
import { canManagePodcastArtist, toPublicPodcastClip } from '../services/podcast-clip-policy';
import { randomUUID } from 'crypto';
import { settleTourCredits } from '../services/world-tour-billing';
import { PODCAST_MODELS, PODCAST_TTS_MODEL, studioCreditsFromUsd, studioProviderCostUsd, studioModelById } from '../../shared/artist-studio-models';

const router = Router();
const DEFAULT_MODEL = 'wan-3';
const COLLECTION = 'podcast_clip_jobs';
const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || process.env.FAL_KEY_BACKUP || '';
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
router.get('/estimate', authenticate, async (req: Request, res: Response) => {
  try {
    const model = studioModelById(PODCAST_MODELS, req.query.model) || studioModelById(PODCAST_MODELS, DEFAULT_MODEL)!;
    const chars = Math.max(0, Math.min(1200, Number(req.query.characters) || 0));
    const providerCostUsd = studioProviderCostUsd(model, 30, chars);
    const balance = await getUserBalance(String((req as any).user?.email || '').toLowerCase());
    res.json({ success: true, model: model.id, duration: 30, resolution: '720p', credits: balance.isAdmin ? 0 : studioCreditsFromUsd(providerCostUsd), models: PODCAST_MODELS.map(({ id, name, note }) => ({ id, name, note })) });
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
  if (!canManagePodcastArtist(user, artist as any)) return null;
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
  const chargeId = randomUUID();
  let chargedCredits = 0;
  const userEmail = String((req as any).user?.email || '').trim().toLowerCase();
  try {
    const artistId = Number(req.body?.artistId);
    const context = await getArtistContext(req, artistId);
    if (!context) return res.status(403).json({ success: false, error: 'You can only create clips for an artist profile you manage.' });
    const falKey = FAL_KEY || process.env.FAL_KEY_BACKUP || '';
    if (!falKey) return res.status(503).json({ success: false, error: 'Fal is not configured on the server.' });
    if (!userEmail) return res.status(401).json({ success: false, error: 'Your account email could not be verified.' });
    const script = typeof req.body?.script === 'string' ? req.body.script.trim().slice(0, 1200) : '';
    const styleId = String(req.body?.styleId || 'studio');
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.slice(0, 500) : '';
    const language = ['es', 'en', 'pt'].includes(req.body?.language) ? req.body.language : 'en';
    const stylePrompt = STYLE_PROMPTS[styleId];
    if (!stylePrompt || script.length < 10) return res.status(400).json({ success: false, error: 'Choose a style and add a valid script.' });
    const model = studioModelById(PODCAST_MODELS, req.body?.modelId || DEFAULT_MODEL);
    if (!model) return res.status(400).json({ success: false, error: 'Choose a supported video model.' });
    const duration = 30;
    const providerCostUsd = studioProviderCostUsd(model, duration, script.length);
    const requiredCredits = studioCreditsFromUsd(providerCostUsd);
    const balance = await getUserBalance(userEmail);
    if (!balance.isAdmin && balance.credits < requiredCredits) return res.status(402).json({ success: false, error: 'This clip needs ' + requiredCredits + ' credits; your balance is ' + balance.credits + '.', requiredCredits, remainingCredits: balance.credits });
    const artist = context.artist;
    const refs = [artist.profileImage, artist.coverImage].filter((url): url is string => typeof url === 'string' && url.startsWith('https://')).slice(0, 2);
    if (model.requiresSpeech && !refs[0]) return res.status(400).json({ success: false, error: 'Add an artist portrait to use this lip-sync model.' });
    const songsSummary = context.songs.map((song) => song.title + (song.genre ? ' (' + song.genre + ')' : '') + (song.mood ? ', ' + song.mood : '')).join('; ');
    const prompt = 'Create a realistic 30-second vertical artist podcast clip. Visual direction: ' + stylePrompt + '. Preserve the artist identity in the reference portrait. Natural direct-to-camera delivery, expressive believable face and gestures, clean editorial composition, no visible text or logos. Artist: ' + (artist.artistName || artist.username || 'musician') + '. Music identity: ' + ((artist.genres || []).join(', ') || artist.genre || 'use the artist profile') + (songsSummary ? '. Music catalog: ' + songsSummary : '') + '. Topic: ' + (topic || 'artist story and music') + '. Say this script in ' + language + ': “' + script + '”. Maintain one coherent visual setup.';
    const charge = await settleTourCredits(userEmail, chargeId, providerCostUsd, false, 'Podcast Studio');
    chargedCredits = charge.credits;
    if (!balance.isAdmin && !chargedCredits) return res.status(402).json({ success: false, error: 'Your credit balance could not cover this clip.', requiredCredits, remainingCredits: balance.credits });
    const videoInput: any = model.requiresSpeech
      ? model.id === 'minimax-lipsync' ? { image_url: refs[0], audio_url: '', resolution: '768P', enable_safety_checker: true }
        : model.id === 'sync-lipsync-v3' ? { image_url: refs[0], audio_url: '', enable_safety_checker: true }
          : model.id === 'veed-fabric' ? { image_url: refs[0], audio_url: '', resolution: '720p' }
            : { image_url: refs[0], audio_url: '' }
      : { prompt, duration, resolution: '720p', aspect_ratio: '9:16', audio: true, reference_image_urls: refs, enable_prompt_expansion: true, enable_thinking: false, enable_safety_checker: true };
    const endpoint = model.requiresSpeech ? PODCAST_TTS_MODEL : model.endpoint;
    const stageInput = model.requiresSpeech ? { text: script, language_code: language, apply_text_normalization: 'auto' } : videoInput;
    const falResponse = await fetch('https://queue.fal.run/' + endpoint, {
      method: 'POST', headers: { Authorization: 'Key ' + falKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(stageInput), signal: AbortSignal.timeout(45_000),
    });
    const falData = await falResponse.json().catch(() => ({}));
    if (!falResponse.ok || !falData.request_id || !/^https:\/\/queue\.fal\.run\//.test(falData.status_url || '') || !/^https:\/\/queue\.fal\.run\//.test(falData.response_url || '')) throw new Error('Fal could not start this stage (HTTP ' + falResponse.status + ').');
    const requestId = chargeId;
    await firestore.collection(COLLECTION).doc(requestId).set({
      requestId, providerRequestId: String(falData.request_id), ownerId: ownerId(req), userEmail, artistId,
      model: model.endpoint, modelId: model.id, title: topic.trim().slice(0, 120) || (artist.artistName || artist.username || 'Artist') + ' - Podcast episode',
      styleId, posterUrl: refs[0] || null, estimatedCredits: chargedCredits, estimatedCostUsd: providerCostUsd,
      videoInput, stage: model.requiresSpeech ? 'SPEECH' : 'VIDEO', statusUrl: falData.status_url, responseUrl: falData.response_url,
      status: 'IN_QUEUE', refunded: false, billingId: chargeId, createdAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, job: { requestId, status: 'IN_QUEUE', estimatedCredits: chargedCredits, remainingCredits: charge.remaining } });
  } catch (error: any) {
    if (chargedCredits > 0 && userEmail) {
      try { await settleTourCredits(userEmail, chargeId, 0, true, 'Podcast Studio'); }
      catch (refundError: any) { console.error('[podcast-clips] Credit refund failed:', refundError?.message || refundError); }
    }
    console.error('[podcast-clips] Generation submit error:', error?.message || error);
    res.status(500).json({ success: false, error: error?.message || 'Could not start podcast generation.' });
  }
});

router.get('/jobs/:requestId', authenticate, async (req: Request, res: Response) => {
  try {
    const ref = firestore.collection(COLLECTION).doc(req.params.requestId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ success: false, error: 'No se encontró este clip.' });
    const job = snapshot.data() as any;
    if (job.ownerId !== ownerId(req)) return res.status(403).json({ success: false, error: 'No tienes acceso a este clip.' });
    if (['COMPLETED', 'FAILED'].includes(job.status)) return res.json({ success: true, job: { requestId: job.requestId, status: job.status, videoUrl: job.videoUrl, estimatedCredits: job.estimatedCredits, error: job.error } });
    const falKey = FAL_KEY || process.env.FAL_KEY_BACKUP || '';
    const statusResponse = await fetch(job.statusUrl, { headers: { Authorization: `Key ${falKey}` } });
    const statusData = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) return res.status(statusResponse.status).json({ success: false, error: statusData.detail || 'No se pudo consultar Fal.' });
    if (statusData.status === 'COMPLETED') {
      const resultResponse = await fetch(job.responseUrl, { headers: { Authorization: `Key ${falKey}` } });
      const resultData = await resultResponse.json().catch(() => ({}));
      if (job.stage === 'SPEECH') {
        const audioUrl = resultData.audio?.url || resultData.output?.audio?.url;
        if (!resultResponse.ok || !/^https:\/\//.test(audioUrl || '')) throw new Error('Fal did not return usable narration audio.');
        const videoInput = { ...job.videoInput, audio_url: audioUrl };
        const videoResponse = await fetch(`https://queue.fal.run/${job.model}`, { method: 'POST',
          headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(videoInput), signal: AbortSignal.timeout(45_000) });
        const videoData = await videoResponse.json().catch(() => ({}));
        if (!videoResponse.ok || !videoData.request_id || !/^https:\/\/queue\.fal\.run\//.test(videoData.status_url || '') || !/^https:\/\/queue\.fal\.run\//.test(videoData.response_url || '')) throw new Error('Fal could not start the lip-sync video stage.');
        await ref.set({ stage: 'VIDEO', providerRequestId: String(videoData.request_id), statusUrl: videoData.status_url, responseUrl: videoData.response_url, status: 'IN_QUEUE' }, { merge: true });
        return res.json({ success: true, job: { requestId: job.requestId, status: 'IN_QUEUE', estimatedCredits: job.estimatedCredits } });
      }
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
          if (job.billingId) await settleTourCredits(job.userEmail, job.billingId, 0, true, 'Podcast Studio'); else await addCredits(job.userEmail, Number(job.estimatedCredits), 'refund', 'Refund - Podcast Clip result unavailable');
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
        if (job.billingId) await settleTourCredits(job.userEmail, job.billingId, 0, true, 'Podcast Studio'); else await addCredits(job.userEmail, Number(job.estimatedCredits), 'refund', 'Refund - failed Podcast Clip generation');
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
