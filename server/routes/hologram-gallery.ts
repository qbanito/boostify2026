/**
 * Hologram Gallery — AI Image Generation
 *
 * Generates 6 hologram-show images of the artist using FAL Flux Pro Kontext
 * (image-to-image). The artist's profile image is used as the visual reference
 * so the generated images actually look like the artist performing in a hologram.
 *
 * Generated gallery is saved to Firestore `image_galleries` with
 * singleName: "Hologram Show" so it shows up in the artist's profile galleries.
 *
 * Endpoints:
 *   POST /:artistId/generate        — generate (or regenerate) hologram gallery
 *   GET  /:artistId/gallery         — fetch existing hologram gallery for this artist
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { db as firestoreDb, storage } from '../firebase';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { users } from '../db/schema';
import { artistBlueprints } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { autoRigFromImage, isTripoConfigured, TRIPO_PRESET_ANIMATIONS } from '../services/tripo-rig-service';
import { rigExistingModel, isMeshyConfigured } from '../services/meshy-rig-service';

const router = Router();

const FAL_API_KEY = process.env.FAL_API_KEY || '';
const FAL_BASE_URL = 'https://fal.run';
const HOLOGRAM_GALLERY_NAME = 'Hologram Show';

// ─── Hologram scene prompts ───────────────────────────────────────────────────
// Each prompt instructs FAL Flux Pro Kontext to transform the artist's portrait
// into a specific hologram show scene.

const HOLOGRAM_PROMPTS = [
  `Transform this person into a breathtaking holographic performer on a futuristic concert stage. Apply a stunning cyan and electric-blue holographic glow effect across the entire body, add subtle holographic grid-line overlays, laser beams shooting from behind, volumetric fog rising from the stage floor, dark arena atmosphere. The person's face and identity remain fully recognizable. Premium concert production quality, cinematic lighting. Aspect ratio 16:9 concert stage photography.`,

  `Full-body holographic projection of this person floating 10 meters above a massive concert stage arena. Purple and cyan translucent hologram colors, the body slightly transparent with holographic shimmer and interference patterns, 50,000 fans visible in silhouette below, professional concert lighting rigs visible, epic scale. The person is recognizable. Photorealistic Pepper's Ghost hologram technology visual, dramatic concert photography.`,

  `Close-up holographic portrait of this person: their face and features remain perfectly recognizable, but surrounded by a cyan neon holographic glow, digital scan lines running across the face, futuristic HUD display elements and data overlays in the background, dark background with subtle grid lines, glowing holographic edges on the face and hair, cyberpunk hologram display aesthetic. High-resolution digital art portrait.`,

  `Wide-angle establishing shot: this person projected as a giant 20-foot hologram on an enormous concert stage, Pepper's Ghost projection technology effect making them look ghostly translucent and glowing, massive LED screen backdrop behind showing their face, 80,000 seat arena packed with fans waving phone lights, smoke machines, laser grid cutting through the air, professional concert production. The person's identity is clearly visible in the hologram.`,

  `Multiple floating holographic projection panels showing this person simultaneously — like a Minority Report style holographic interface. Three large translucent hologram screens showing the person in different poses (center, left, right), cyan-to-purple gradient color scheme for each hologram panel, dark stage background with a grid floor reflection, futuristic ambient atmosphere. Each panel clearly shows the person's face and form.`,

  `This person as the star of a spectacular holographic concert performance: dynamic full-body pose, electric neon light trails of cyan and magenta following their movement, professional stage fog and laser beams slicing the air, pyrotechnic explosions in background, the body surrounded by a holographic shimmer and glow effect, cinematic concert photography composition. The person is fully recognizable. Ultra-wide stage shot, epic concert scale, photorealistic hologram projection effect.`,
];

// ─── Immersive 3D environments (360° equirectangular panoramas) ───────────────
// Pure VENUE panoramas — NO performer. These are mapped onto an inside-out
// sphere in the viewer (scene.background + scene.environment) so the artist's
// 3D avatar stands INSIDE a real, light-emitting world. Generated at the widest
// aspect ratio available and prompted as seamless equirectangular panoramas.

interface EnvironmentPrompt {
  style: string;   // matches the viewer stageStyle vibe
  label: string;   // shown in the UI
  prompt: string;
}

const ENVIRONMENT_PROMPTS: EnvironmentPrompt[] = [
  {
    style: 'concert',
    label: 'Stadium Arena',
    prompt: `Seamless 360 degree equirectangular VR panorama of a colossal empty concert arena seen from center stage. 80,000 seats curving all the way around filled with fans holding glowing phone lights, giant LED screens, massive overhead lighting truss with hundreds of moving-head spotlights, volumetric haze, deep blue and magenta stage wash, reflective glossy stage floor. No performer, empty stage center. Photorealistic, ultra wide spherical projection, equirectangular 2:1, cinematic concert production.`,
  },
  {
    style: 'club',
    label: 'Neon Nightclub',
    prompt: `Seamless 360 degree equirectangular VR panorama inside a futuristic neon nightclub. Glowing pink and purple LED wall panels wrapping the whole room, laser beams crisscrossing through fog, mirrored ceiling, a dark reflective dancefloor, neon signage, intimate moody cyberpunk atmosphere all around. No people in the center. Photorealistic, ultra wide spherical projection, equirectangular 2:1.`,
  },
  {
    style: 'cosmic',
    label: 'Deep Space',
    prompt: `Seamless 360 degree equirectangular VR panorama of deep outer space: a vast galaxy with swirling purple and blue nebula clouds, millions of stars in every direction, a glowing distant planet, cosmic dust, ethereal volumetric god rays. Surreal dreamlike cosmic stage in zero gravity. Photorealistic space art, ultra wide spherical projection, equirectangular 2:1.`,
  },
  {
    style: 'lab',
    label: 'Holo Lab',
    prompt: `Seamless 360 degree equirectangular VR panorama inside a sleek futuristic holographic laboratory / sci-fi command bridge. Glowing teal and cyan holographic data screens floating all around, clean white and dark metal surfaces, soft volumetric lighting, reflective floor with a subtle grid, high-tech ambient atmosphere wrapping 360 degrees. No people. Photorealistic, ultra wide spherical projection, equirectangular 2:1.`,
  },
  {
    style: 'concert',
    label: 'Sunset Festival',
    prompt: `Seamless 360 degree equirectangular VR panorama of an open-air music festival main stage at golden-hour sunset. Dramatic orange and pink sky with clouds wrapping the horizon 360 degrees, huge festival crowd silhouettes, towering stage rigging with warm spotlights, palm trees, lens flares, warm cinematic glow. No performer, empty stage. Photorealistic, ultra wide spherical projection, equirectangular 2:1.`,
  },
  {
    style: 'club',
    label: 'Cyber City',
    prompt: `Seamless 360 degree equirectangular VR panorama of a rooftop stage in a neon cyberpunk megacity at night. Towering skyscrapers covered in holographic billboards and neon signs surrounding 360 degrees, flying drones, rain-slick reflective rooftop, electric blue and pink city glow, volumetric fog, Blade Runner atmosphere. No people. Photorealistic, ultra wide spherical projection, equirectangular 2:1.`,
  },
];


// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Upload an image URL to Firebase Storage and return a permanent URL
 */
async function downloadAndStoreImage(
  sourceUrl: string,
  artistId: string,
  index: number,
): Promise<string> {
  const response = await axios.get(sourceUrl, {
    responseType: 'arraybuffer',
    timeout: 60_000,
  });

  const buffer = Buffer.from(response.data);
  const mimeType = response.headers['content-type'] || 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const fileName = `hologram-gallery/${artistId}/${Date.now()}-scene-${index}.${ext}`;

  const file = storage.bucket().file(fileName);
  await file.save(buffer, { contentType: mimeType, public: true });

  return `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
}

/**
 * Store a generated 360° environment panorama to Firebase Storage.
 */
async function downloadAndStoreEnvironment(
  sourceUrl: string,
  artistId: string,
  index: number,
): Promise<string> {
  const response = await axios.get(sourceUrl, { responseType: 'arraybuffer', timeout: 60_000 });
  const buffer = Buffer.from(response.data);
  const mimeType = response.headers['content-type'] || 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const fileName = `hologram-environments/${artistId}/${Date.now()}-env-${index}.${ext}`;
  const file = storage.bucket().file(fileName);
  await file.save(buffer, { contentType: mimeType, public: true });
  return `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
}

/**
 * Generate a single 360° equirectangular environment panorama (text-to-image,
 * widest aspect ratio, NO performer). Falls back across FAL models.
 */
async function generateEnvironmentImage(prompt: string, index: number): Promise<string | null> {
  if (!FAL_API_KEY) {
    console.warn('[HoloGallery] FAL_API_KEY not configured for environments');
    return null;
  }
  const headers = { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' };

  // Primary: nano-banana-2 text-to-image at 21:9 (widest panoramic ratio).
  try {
    const res = await axios.post(
      `${FAL_BASE_URL}/fal-ai/nano-banana-2`,
      { prompt, aspect_ratio: '21:9', num_images: 1, output_format: 'jpeg' },
      { headers, timeout: 120_000 },
    );
    const url = res.data?.images?.[0]?.url;
    if (url) return url;
  } catch (err: any) {
    console.warn(`[HoloGallery] env nano-banana failed (#${index + 1}), trying flux:`, err.response?.data?.detail || err.message);
  }

  // Fallback: flux-pro text-to-image.
  try {
    const res = await axios.post(
      `${FAL_BASE_URL}/fal-ai/flux-pro/kontext/text-to-image`,
      { prompt, aspect_ratio: '21:9', output_format: 'jpeg', safety_tolerance: '6', num_images: 1 },
      { headers, timeout: 120_000 },
    );
    return res.data?.images?.[0]?.url || null;
  } catch (err: any) {
    console.error(`[HoloGallery] env image #${index + 1} failed:`, err.response?.data?.detail || err.message);
    return null;
  }
}

/**
 * Estimate a depth map for an environment image (FAL MiDaS depth). The viewer
 * uses it to displace a sphere → real parallax so the world feels 3D, not flat.
 * Returns the temp FAL url (or null). Falls back across known FAL depth models.
 */
async function generateDepthMap(imageUrl: string, index: number): Promise<string | null> {
  if (!FAL_API_KEY) return null;
  const headers = { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' };
  const models = ['fal-ai/imageutils/depth', 'fal-ai/imageutils/marigold-depth'];
  for (const model of models) {
    try {
      const res = await axios.post(
        `${FAL_BASE_URL}/${model}`,
        { image_url: imageUrl },
        { headers, timeout: 120_000 },
      );
      const url = res.data?.image?.url || res.data?.images?.[0]?.url || res.data?.depth?.url;
      if (url) return url;
    } catch (err: any) {
      console.warn(`[HoloGallery] depth ${model} failed (#${index + 1}):`, err.response?.data?.detail || err.message);
    }
  }
  return null;
}

/**
 * Store a generated depth map to Firebase Storage (PNG, grayscale).
 */
async function downloadAndStoreDepth(
  sourceUrl: string,
  artistId: string,
  index: number,
): Promise<string> {
  const response = await axios.get(sourceUrl, { responseType: 'arraybuffer', timeout: 60_000 });
  const buffer = Buffer.from(response.data);
  const mimeType = response.headers['content-type'] || 'image/png';
  const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
  const fileName = `hologram-environments/${artistId}/${Date.now()}-depth-${index}.${ext}`;
  const file = storage.bucket().file(fileName);
  await file.save(buffer, { contentType: mimeType, public: true });
  return `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
}

/**
 * Download a 3D model (GLB) from a URL and store it permanently in Firebase
 * Storage. Returns the public URL.
 */
async function downloadAndStoreModel(
  sourceUrl: string,
  artistId: string,
  format: 'glb' | 'fbx' | 'obj' = 'glb',
  options: { compress?: boolean; quality?: 'web' | 'balanced' | 'hq' } = {},
): Promise<string> {
  const response = await axios.get(sourceUrl, {
    responseType: 'arraybuffer',
    timeout: 120_000,
  });

  const CONTENT_TYPES: Record<string, string> = {
    glb: 'model/gltf-binary',
    fbx: 'application/octet-stream',
    obj: 'model/obj',
  };

  let buffer = Buffer.from(response.data);

  // Compress heavy Hunyuan GLBs (Draco geometry + WebP textures) before upload.
  if (format === 'glb' && options.compress !== false) {
    try {
      const { compressGlb } = await import('../services/glb-compress');
      const r = await compressGlb(buffer, { quality: options.quality ?? 'balanced' });
      if (r.compressed) {
        console.log(
          `[HoloGallery] [3D] GLB compressed ${(r.originalBytes / 1e6).toFixed(1)}MB → ${(r.compressedBytes / 1e6).toFixed(1)}MB (${options.quality ?? 'balanced'})`,
        );
        buffer = r.buffer;
      }
    } catch (e) {
      console.warn('[HoloGallery] [3D] GLB compression skipped:', (e as Error)?.message);
    }
  }

  const fileName = `hologram-characters/${artistId}/${Date.now()}-character.${format}`;

  const file = storage.bucket().file(fileName);
  await file.save(buffer, { contentType: CONTENT_TYPES[format] || 'application/octet-stream', public: true });

  return `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
}

/**
 * FAL queue helpers — image-to-3D / video models run async via the queue API.
 * submit → poll status → fetch result.
 *
 * Key failover: FAL bills per ACCOUNT and each API key belongs to a different
 * account. We try the Principal key first and, only when the SUBMIT fails for
 * an auth/balance/lock reason (no charge incurred yet), retry with the Backup
 * key. The key that accepted the job is returned so polling uses the same one.
 */
const FAL_KEYS: string[] = [
  process.env.FAL_API_KEY || '',
  process.env.FAL_KEY_BACKUP || '',
  process.env.FAL_KEY || '',
  process.env.FAL_AI_KEY || '',
].filter((k, i, arr) => k && arr.indexOf(k) === i);

/** True when an error means the key/account can't be used (safe to fail over — no charge). */
function isFalKeyUsableError(err: any): boolean {
  const status = err?.response?.status;
  const detail = String(err?.response?.data?.detail || err?.message || '').toLowerCase();
  return (
    status === 401 || status === 403 || status === 402 ||
    detail.includes('locked') || detail.includes('balance') ||
    detail.includes('exhausted') || detail.includes('unauthorized') || detail.includes('forbidden')
  );
}

async function falQueueSubmit(
  endpoint: string,
  input: Record<string, unknown>,
): Promise<{ requestId: string; statusUrl: string; responseUrl: string; apiKey: string }> {
  if (FAL_KEYS.length === 0) throw new Error('No FAL API key configured');
  let lastErr: any = null;
  for (let i = 0; i < FAL_KEYS.length; i++) {
    const apiKey = FAL_KEYS[i];
    try {
      const res = await axios.post(`https://queue.fal.run/${endpoint}`, input, {
        headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 60_000,
      });
      const requestId = res.data?.request_id;
      if (!requestId) throw new Error('FAL queue submit returned no request_id');
      // FAL returns status/response URLs that use the BASE app id (e.g. fal-ai/hunyuan-3d),
      // NOT the full sub-path. Use them directly to avoid 405s on multi-segment endpoints.
      const statusUrl = res.data?.status_url || `https://queue.fal.run/${endpoint}/requests/${requestId}/status`;
      const responseUrl = res.data?.response_url || `https://queue.fal.run/${endpoint}/requests/${requestId}`;
      if (i > 0) console.log(`[HoloGallery] FAL failover: submitted with backup key #${i + 1}.`);
      return { requestId, statusUrl, responseUrl, apiKey };
    } catch (err: any) {
      lastErr = err;
      // Only fail over to the next key when nothing was billed (auth/balance/lock).
      if (i < FAL_KEYS.length - 1 && isFalKeyUsableError(err)) {
        console.warn(`[HoloGallery] FAL key #${i + 1} unusable (${err?.response?.data?.detail || err?.message}); trying next key…`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('FAL queue submit failed');
}

async function falQueuePoll(statusUrl: string, responseUrl: string, maxWaitMs = 300_000, apiKey = FAL_KEYS[0] || ''): Promise<any> {
  const deadline = Date.now() + maxWaitMs;
  let delay = 4000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 12_000);

    const statusRes = await axios.get(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
      timeout: 30_000,
    });
    const status = statusRes.data?.status;
    if (status === 'COMPLETED') {
      const resultRes = await axios.get(responseUrl, {
        headers: { Authorization: `Key ${apiKey}` },
        timeout: 30_000,
      });
      return resultRes.data;
    }
    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(`FAL 3D job failed: ${statusUrl}`);
    }
  }
  throw new Error(`FAL 3D job timed out: ${statusUrl}`);
}


async function generateHologramImage(
  referenceImages: string[],
  artistName: string,
  artistGenre: string,
  prompt: string,
  index: number,
): Promise<string | null> {
  if (!FAL_API_KEY) {
    console.warn('[HoloGallery] FAL_API_KEY not configured');
    return null;
  }

  const headers = {
    Authorization: `Key ${FAL_API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    if (referenceImages.length > 0) {
      // Primary: nano-banana-2/edit with up to 3 real photos of the artist.
      // Rotate which gallery photo leads so the 6 scenes stay varied.
      const lead = referenceImages[index % referenceImages.length];
      const refs = Array.from(new Set([lead, ...referenceImages])).slice(0, 3);
      try {
        const response = await axios.post(
          `${FAL_BASE_URL}/fal-ai/nano-banana-2/edit`,
          {
            prompt: `The person in the reference image(s) — keep their exact face, identity and likeness fully recognizable. ${prompt}`,
            image_urls: refs,
            aspect_ratio: '16:9',
            num_images: 1,
            output_format: 'jpeg',
          },
          { headers, timeout: 120_000 },
        );
        const url = response.data?.images?.[0]?.url;
        if (url) return url;
      } catch (err: any) {
        console.warn(`[HoloGallery] nano-banana-2/edit failed for image ${index + 1}, trying kontext:`, err.response?.data?.detail || err.message);
      }

      // Secondary: flux-pro/kontext with single reference
      const response = await axios.post(
        `${FAL_BASE_URL}/fal-ai/flux-pro/kontext`,
        {
          prompt,
          image_url: lead,
          aspect_ratio: '16:9',
          output_format: 'jpeg',
          guidance_scale: 3.5,
          num_inference_steps: 28,
          safety_tolerance: '6',
        },
        { headers, timeout: 120_000 },
      );
      const url = response.data?.images?.[0]?.url;
      return url || null;
    }

    // Fallback: text-to-image without reference
    const textPrompt = `${prompt} The artist is named ${artistName}, ${artistGenre} music artist. Full professional quality.`;
    const response = await axios.post(
      `${FAL_BASE_URL}/fal-ai/flux-pro/kontext/text-to-image`,
      {
        prompt: textPrompt,
        aspect_ratio: '16:9',
        output_format: 'jpeg',
        safety_tolerance: '6',
        num_images: 1,
      },
      { headers, timeout: 120_000 },
    );
    const imageUrl = response.data?.images?.[0]?.url;
    return imageUrl || null;
  } catch (err: any) {
    console.error(`[HoloGallery] FAL image ${index + 1} failed:`, err.response?.data?.detail || err.message);
    return null;
  }
}

/**
 * Get artist context from EVERY available source:
 * PostgreSQL users table → Superstar Blueprint → masterJson →
 * Firestore (generated_artists / users) → image_galleries reference photos.
 */
interface ArtistContext {
  name: string;
  genre: string;
  biography: string;
  profileImage: string | null;
  country: string;
  era: string;
  archetype: string;
  visualStyle: string;
  referenceImages: string[];
}

async function fetchGalleryReferenceImages(artistId: string, limit = 8): Promise<string[]> {
  try {
    const galleriesRef = firestoreDb.collection('image_galleries');
    const queries: Promise<any>[] = [galleriesRef.where('userId', '==', artistId).get()];
    const numId = Number(artistId);
    if (!isNaN(numId)) queries.push(galleriesRef.where('userId', '==', numId).get());

    const snapshots = await Promise.all(queries);
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const snap of snapshots) {
      snap.forEach((doc: any) => {
        if (seen.has(doc.id)) return;
        seen.add(doc.id);
        const data = doc.data() as any;
        if (data.source === 'hologram') return; // skip our own generated output
        const imgs = Array.isArray(data?.generatedImages) ? data.generatedImages : [];
        for (const img of imgs) {
          if (!img || img.isVideo) continue;
          const url = typeof img === 'string' ? img : img.url;
          if (typeof url === 'string' && /^https?:\/\//.test(url)) urls.push(url);
        }
        const refs = Array.isArray(data?.referenceImageUrls) ? data.referenceImageUrls : [];
        for (const url of refs) {
          if (typeof url === 'string' && /^https?:\/\//.test(url)) urls.push(url);
        }
      });
    }
    return Array.from(new Set(urls)).slice(0, limit);
  } catch (e) {
    console.warn('[HoloGallery] gallery refs fetch failed:', (e as Error)?.message);
    return [];
  }
}

async function getArtistData(artistId: string): Promise<ArtistContext> {
  const ctx: ArtistContext = {
    name: 'Artist', genre: 'Music', biography: '', profileImage: null,
    country: '', era: '', archetype: '', visualStyle: '', referenceImages: [],
  };

  // 1. PostgreSQL users table (numeric id or slug)
  let pgUserId: number | null = null;
  try {
    const numId = Number(artistId);
    const [pgUser] = await db
      .select({
        id: users.id,
        artistName: users.artistName,
        username: users.username,
        biography: users.biography,
        genre: users.genre,
        genres: users.genres,
        country: users.country,
        profileImage: users.profileImage,
        profileImageUrl: users.profileImageUrl,
        masterJson: users.masterJson,
      })
      .from(users)
      .where(!isNaN(numId) && /^\d+$/.test(artistId) ? eq(users.id, numId) : eq(users.slug, artistId))
      .limit(1);

    if (pgUser) {
      pgUserId = pgUser.id;
      ctx.name = pgUser.artistName || pgUser.username || ctx.name;
      ctx.genre = pgUser.genre || (pgUser.genres as string[])?.[0] || ctx.genre;
      ctx.biography = pgUser.biography || '';
      ctx.country = pgUser.country || '';
      ctx.profileImage = pgUser.profileImage || pgUser.profileImageUrl || null;

      // masterJson extras
      const mj = pgUser.masterJson as any;
      if (mj) {
        ctx.era = mj.currentEra || mj.era || ctx.era;
        ctx.archetype = mj.brandArchetype || mj.archetype || ctx.archetype;
        ctx.visualStyle = mj.visualIdentity?.primaryStyle || mj.visualStyle || ctx.visualStyle;
      }
    }
  } catch (e) {
    console.warn('[HoloGallery] PG user lookup failed:', (e as Error)?.message);
  }

  // 2. Superstar Blueprint (richest brand context)
  if (pgUserId !== null) {
    try {
      const [bp] = await db
        .select({
          currentEra: artistBlueprints.currentEra,
          primaryGenre: artistBlueprints.primaryGenre,
          brandArchetype: artistBlueprints.brandArchetype,
          blueprintJson: artistBlueprints.blueprintJson,
        })
        .from(artistBlueprints)
        .where(eq(artistBlueprints.artistId, pgUserId))
        .limit(1);
      if (bp) {
        ctx.era = bp.currentEra || ctx.era;
        ctx.genre = bp.primaryGenre || ctx.genre;
        ctx.archetype = bp.brandArchetype || ctx.archetype;
        const bj = bp.blueprintJson as any;
        ctx.visualStyle = bj?.modules?.brand?.visualIdentity?.primaryStyle || ctx.visualStyle;
      }
    } catch { /* blueprint optional */ }
  }

  // 3. Firestore fallbacks (AI artists / firebase users)
  if (ctx.name === 'Artist' || !ctx.profileImage) {
    try {
      const genSnap = await firestoreDb.collection('generated_artists').doc(artistId).get().catch(() => null);
      if (genSnap?.exists) {
        const d = genSnap.data()!;
        ctx.name = ctx.name === 'Artist' ? (d.canonical?.artist_name || d.name || d.artistName || ctx.name) : ctx.name;
        ctx.genre = ctx.genre === 'Music' ? (d.canonical?.genre || d.genres?.[0] || d.genre || ctx.genre) : ctx.genre;
        ctx.biography = ctx.biography || d.canonical?.biography_short || d.biography || '';
        ctx.profileImage = ctx.profileImage || d.profileImage || d.canonical?.image_url || d.coverImage || null;
      } else {
        const userSnap = await firestoreDb.collection('users').where('uid', '==', artistId).limit(1).get().catch(() => null);
        if (userSnap && !userSnap.empty) {
          const d = userSnap.docs[0].data();
          ctx.name = ctx.name === 'Artist' ? (d.artistName || d.displayName || d.name || ctx.name) : ctx.name;
          ctx.genre = ctx.genre === 'Music' ? (d.genres?.[0] || d.genre || ctx.genre) : ctx.genre;
          ctx.biography = ctx.biography || d.biography || '';
          ctx.profileImage = ctx.profileImage || d.profileImage || d.photoURL || null;
        }
      }
    } catch { /* firestore optional */ }
  }

  // 4. Real photos pool: profile image + image_galleries (PG id + raw id)
  const galleryIds = new Set<string>([artistId]);
  if (pgUserId !== null) galleryIds.add(String(pgUserId));
  const galleryRefLists = await Promise.all(Array.from(galleryIds).map((id) => fetchGalleryReferenceImages(id)));
  ctx.referenceImages = Array.from(
    new Set([ctx.profileImage, ...galleryRefLists.flat()].filter((u): u is string => !!u))
  ).slice(0, 8);

  return ctx;
}

/**
 * Build a short artist-context string injected into every prompt so
 * the generated scenes stay coherent with the artist's brand.
 */
function buildPromptContext(artist: ArtistContext): string {
  const parts: string[] = [`${artist.name}, ${artist.genre} music artist`];
  if (artist.country) parts.push(`from ${artist.country}`);
  if (artist.era) parts.push(`${artist.era} era`);
  if (artist.archetype) parts.push(`${artist.archetype} brand archetype`);
  if (artist.visualStyle) parts.push(`${artist.visualStyle} visual aesthetic`);
  return parts.join(', ');
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /:artistId/gallery
 * Returns the existing hologram gallery for this artist, if any.
 */
router.get('/:artistId/gallery', async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    // Always fetch artist info so the frontend can display the real name
    // even before any gallery has been generated.
    const artist = await getArtistData(artistId);

    const snap = await firestoreDb
      .collection('image_galleries')
      .where('userId', '==', artistId)
      .where('source', '==', 'hologram')
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json({ success: true, gallery: null, artistInfo: artist });
    }

    const gallery = { id: snap.docs[0].id, ...snap.docs[0].data() };
    return res.json({ success: true, gallery, artistInfo: artist });
  } catch (err: any) {
    console.error('[HoloGallery] Error fetching gallery:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /:artistId/environments
 * Returns the generated 360° immersive environments for this artist, if any.
 */
router.get('/:artistId/environments', async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    const snap = await firestoreDb.collection('hologram_environments').doc(String(artistId)).get();
    if (!snap.exists) return res.json({ success: true, environments: [] });
    const data = snap.data() || {};
    return res.json({ success: true, environments: data.environments || [], status: data.status || 'ready' });
  } catch (err: any) {
    console.error('[HoloGallery] Error fetching environments:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Core generation pipeline for the immersive 360° environments. Exported so a
 * trusted local script can trigger it without the Clerk HTTP auth layer.
 */
export async function generateEnvironments(
  artistId: string,
  force = false,
): Promise<{ environments: any[]; alreadyExists?: boolean }> {
  const docRef = firestoreDb.collection('hologram_environments').doc(String(artistId));

  if (!FAL_API_KEY) {
    throw new Error('Image generation is not configured (FAL key missing).');
  }

  if (!force) {
    const existing = await docRef.get();
    if (existing.exists && (existing.data()?.environments?.length || 0) > 0) {
      return { environments: existing.data()!.environments, alreadyExists: true };
    }
  }

  console.log(`[HoloGallery] Generating ${ENVIRONMENT_PROMPTS.length} immersive 3D environments for ${artistId}`);

  const environments: any[] = [];
  const batchSize = 2;
  for (let i = 0; i < ENVIRONMENT_PROMPTS.length; i += batchSize) {
    const batch = ENVIRONMENT_PROMPTS.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (envp, batchIdx) => {
        const globalIdx = i + batchIdx;
        const tempUrl = await generateEnvironmentImage(envp.prompt, globalIdx);
        if (!tempUrl) return null;
        let permanentUrl = tempUrl;
        try {
          permanentUrl = await downloadAndStoreEnvironment(tempUrl, artistId, globalIdx);
        } catch {
          permanentUrl = tempUrl;
        }
        // Estimate + store a depth map so the viewer can build a 3D parallax world.
        let depthUrl: string | null = null;
        try {
          const tempDepth = await generateDepthMap(permanentUrl, globalIdx);
          if (tempDepth) depthUrl = await downloadAndStoreDepth(tempDepth, artistId, globalIdx).catch(() => tempDepth);
        } catch { /* depth optional — falls back to flat skybox */ }
        console.log(`[HoloGallery] ✅ Environment ${globalIdx + 1}/${ENVIRONMENT_PROMPTS.length} ready (${envp.label})${depthUrl ? ' +depth' : ''}`);
        return {
          id: `holo-env-${Date.now()}-${globalIdx}`,
          url: permanentUrl,
          depthUrl,
          label: envp.label,
          style: envp.style,
          prompt: envp.prompt.slice(0, 200),
          format: 'equirectangular',
          createdAt: new Date().toISOString(),
          index: globalIdx,
        };
      }),
    );
    results.forEach((r) => { if (r) environments.push(r); });
    if (i + batchSize < ENVIRONMENT_PROMPTS.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  if (environments.length === 0) {
    throw new Error('No environments could be generated. Check the FAL key.');
  }

  await docRef.set(
    { artistId: String(artistId), environments, status: 'ready', updatedAt: new Date().toISOString() },
    { merge: true },
  );

  console.log(`[HoloGallery] ✅ Saved ${environments.length} immersive environments`);
  return { environments };
}

/**
 * Add depth maps to EXISTING environments without re-rendering the images
 * (cheap — only runs depth estimation). Exported for the local trigger script.
 */
export async function addEnvironmentDepth(
  artistId: string,
  force = false,
  limit = 0,
): Promise<{ environments: any[]; updated: number }> {
  const docRef = firestoreDb.collection('hologram_environments').doc(String(artistId));
  if (!FAL_API_KEY) throw new Error('Image generation is not configured (FAL key missing).');

  const snap = await docRef.get();
  if (!snap.exists) throw new Error('No environments found for this artist. Generate them first.');
  const environments: any[] = snap.data()?.environments || [];
  if (environments.length === 0) throw new Error('No environments to process.');

  let updated = 0;
  for (const env of environments) {
    if (limit > 0 && updated >= limit) break; // cap to save credits
    if (env.depthUrl && !force) continue;
    if (!env.url) continue;
    try {
      const tempDepth = await generateDepthMap(env.url, env.index ?? 0);
      if (tempDepth) {
        env.depthUrl = await downloadAndStoreDepth(tempDepth, artistId, env.index ?? 0).catch(() => tempDepth);
        updated += 1;
        console.log(`[HoloGallery] ✅ Depth added for "${env.label}"`);
      }
    } catch (e) {
      console.warn(`[HoloGallery] depth failed for "${env.label}":`, (e as Error)?.message);
    }
  }

  await docRef.set(
    { artistId: String(artistId), environments, status: 'ready', updatedAt: new Date().toISOString() },
    { merge: true },
  );
  console.log(`[HoloGallery] ✅ Depth pass complete — ${updated} updated`);
  return { environments, updated };
}

/**
 * POST /:artistId/environments/generate
 * Generate (or regenerate) the set of immersive 360° environments. These are
 * mapped as an equirectangular skybox + IBL in the viewer so the avatar stands
 * inside a real, light-emitting world.
 * Body: { forceRegenerate?: boolean }
 */
router.post('/:artistId/environments/generate', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { forceRegenerate = false } = req.body || {};

  try {
    const { environments, alreadyExists } = await generateEnvironments(artistId, forceRegenerate);
    res.json({ success: true, environments, alreadyExists, count: environments.length });
  } catch (err: any) {
    console.error('[HoloGallery] Environments generate error:', err.message);
    const code = /not configured/.test(err.message) ? 503 : 500;
    res.status(code).json({ success: false, error: err.message });
  }
});

/**
 * POST /:artistId/environments/add-depth
 * Add depth maps to existing environments (no image re-render). Body: { force? }
 */
router.post('/:artistId/environments/add-depth', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { force = false, limit = 0 } = req.body || {};
  try {
    const { environments, updated } = await addEnvironmentDepth(artistId, force, Number(limit) || 0);
    res.json({ success: true, environments, updated });
  } catch (err: any) {
    console.error('[HoloGallery] Environments add-depth error:', err.message);
    const code = /not configured/.test(err.message) ? 503 : 500;
    res.status(code).json({ success: false, error: err.message });
  }
});


/**
 * POST /:artistId/generate
 * Generate (or regenerate) the hologram gallery for this artist.
 * Body: { forceRegenerate?: boolean }
 */
router.post('/:artistId/generate', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { forceRegenerate = false } = req.body;

  try {
    // Check if gallery already exists
    if (!forceRegenerate) {
      const existing = await firestoreDb
        .collection('image_galleries')
        .where('userId', '==', artistId)
        .where('source', '==', 'hologram')
        .limit(1)
        .get();

      if (!existing.empty) {
        const gallery = { id: existing.docs[0].id, ...existing.docs[0].data() };
        return res.json({ success: true, gallery, alreadyExists: true });
      }
    }

    // Get artist data from all sources (PG + blueprint + masterJson + Firestore + galleries)
    const artist = await getArtistData(artistId);
    const promptContext = buildPromptContext(artist);

    console.log(`[HoloGallery] Generating hologram gallery for ${artist.name} (${artistId})`);
    console.log(`[HoloGallery] References: ${artist.referenceImages.length} (profile: ${artist.profileImage ? 'yes' : 'no'}) | context: ${promptContext}`);

    // Generate 6 hologram images in parallel batches of 2
    const generatedImages: any[] = [];
    const batchSize = 2;

    for (let i = 0; i < HOLOGRAM_PROMPTS.length; i += batchSize) {
      const batch = HOLOGRAM_PROMPTS.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (prompt, batchIdx) => {
          const globalIdx = i + batchIdx;
          const tempUrl = await generateHologramImage(
            artist.referenceImages,
            artist.name,
            artist.genre,
            `${prompt} Artist context: ${promptContext}.`,
            globalIdx,
          );

          if (!tempUrl) {
            console.warn(`[HoloGallery] Image ${globalIdx + 1} failed — skipping`);
            return null;
          }

          // Store permanently in Firebase Storage
          let permanentUrl = tempUrl;
          try {
            permanentUrl = await downloadAndStoreImage(tempUrl, artistId, globalIdx);
          } catch {
            permanentUrl = tempUrl; // Use FAL URL as fallback
          }

          console.log(`[HoloGallery] ✅ Image ${globalIdx + 1}/6 ready`);

          return {
            id: `holo-img-${Date.now()}-${globalIdx}`,
            url: permanentUrl,
            prompt: prompt.slice(0, 200),
            createdAt: new Date().toISOString(),
            isVideo: false,
            scene: globalIdx + 1,
          };
        }),
      );

      results.forEach((r) => { if (r) generatedImages.push(r); });

      // Small pause between batches
      if (i + batchSize < HOLOGRAM_PROMPTS.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (generatedImages.length === 0) {
      return res.status(500).json({ success: false, error: 'No hologram images could be generated. Check FAL_API_KEY and artist profile image.' });
    }

    // Build gallery document
    const galleryId = uuidv4();
    const now = new Date().toISOString();

    const gallery = {
      id: galleryId,
      userId: artistId,
      singleName: HOLOGRAM_GALLERY_NAME,
      artistName: artist.name,
      basePrompt: `Hologram concert show AI gallery for ${artist.name}`,
      styleInstructions: 'Holographic concert stage, cyan-purple glow, laser grid, arena scale',
      referenceImageUrls: artist.referenceImages,
      generatedImages,
      source: 'hologram',
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    };

    // Delete old hologram galleries for this artist first (prevent duplicates)
    const old = await firestoreDb
      .collection('image_galleries')
      .where('userId', '==', artistId)
      .where('source', '==', 'hologram')
      .get();
    await Promise.all(old.docs.map((d: any) => d.ref.delete()));

    // Save to Firestore
    await firestoreDb.collection('image_galleries').doc(galleryId).set(gallery);

    console.log(`[HoloGallery] ✅ Gallery saved — ${generatedImages.length} images`);

    res.json({
      success: true,
      gallery,
      imageCount: generatedImages.length,
    });
  } catch (err: any) {
    console.error('[HoloGallery] Generate error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /:artistId/generate-custom
 * Generate a single hologram image with a custom prompt.
 * Body: { prompt: string }
 * Returns: { success, imageUrl }
 */
router.post('/:artistId/generate-custom', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ success: false, error: 'prompt is required' });
  }

  try {
    const artist = await getArtistData(artistId);
    const imageUrl = await generateHologramImage(
      artist.referenceImages,
      artist.name,
      artist.genre,
      `${prompt.trim()} Artist context: ${buildPromptContext(artist)}.`,
      0,
    );

    if (!imageUrl) {
      return res.status(500).json({ success: false, error: 'Image generation failed. Check FAL_API_KEY.' });
    }

    // Persist to Firebase Storage
    let permanentUrl = imageUrl;
    try {
      permanentUrl = await downloadAndStoreImage(imageUrl, artistId, Date.now());
    } catch {
      permanentUrl = imageUrl;
    }

    res.json({ success: true, imageUrl: permanentUrl });
  } catch (err: any) {
    console.error('[HoloGallery] Custom generate error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /:artistId/stats
 * Returns quick stats about the artist's hologram gallery.
 */
router.get('/:artistId/stats', async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    const snap = await firestoreDb
      .collection('image_galleries')
      .where('userId', '==', artistId)
      .where('source', '==', 'hologram')
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json({ success: true, stats: { imageCount: 0, hasGallery: false, createdAt: null } });
    }

    const d = snap.docs[0].data();
    return res.json({
      success: true,
      stats: {
        imageCount: (d.generatedImages || []).length,
        hasGallery: true,
        createdAt: d.createdAt || null,
        updatedAt: d.updatedAt || null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /:artistId/avatar
 * Returns the stored holographic avatar for this artist, if any.
 */
router.get('/:artistId/avatar', async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    const doc = await firestoreDb.collection('hologram_avatars').doc(String(artistId)).get();
    if (!doc.exists) return res.json({ success: true, avatar: null });
    return res.json({ success: true, avatar: doc.data() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /:artistId/avatar
 * Generates a futuristic full-body holographic AVATAR of the artist using
 * FAL nano-banana-2/edit (image-to-image with the artist's real photos).
 * The avatar is stored permanently and used by the Hologram Show Engine.
 * Body: { forceRegenerate?: boolean }
 */
router.post('/:artistId/avatar', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { forceRegenerate = false } = req.body;

  try {
    if (!forceRegenerate) {
      const existing = await firestoreDb.collection('hologram_avatars').doc(String(artistId)).get();
      if (existing.exists) {
        return res.json({ success: true, avatar: existing.data(), alreadyExists: true });
      }
    }

    const artist = await getArtistData(artistId);
    if (artist.referenceImages.length === 0) {
      return res.status(400).json({ success: false, error: 'No reference photos found. Upload a profile photo or generate gallery images first.' });
    }
    if (!FAL_API_KEY) {
      return res.status(503).json({ success: false, error: 'FAL_API_KEY not configured' });
    }

    const avatarPrompt =
      `The person in the reference image(s) — keep their exact face, identity and likeness fully recognizable. ` +
      `Transform them into a stunning photorealistic full-body 3D holographic digital avatar, standing in a confident pose facing the camera, ` +
      `entire body wrapped in a translucent cyan-blue holographic shimmer with subtle wireframe scan lines, glowing particle effects rising around them, ` +
      `dark studio background with a reflective grid floor, dramatic rim lighting in cyan and purple, futuristic digital-human aesthetic. ` +
      `Artist context: ${buildPromptContext(artist)}. Vertical full-body portrait, ultra high detail, 8K.`;

    console.log(`[HoloGallery] Generating avatar for ${artist.name} with ${artist.referenceImages.length} refs`);

    const response = await axios.post(
      `${FAL_BASE_URL}/fal-ai/nano-banana-2/edit`,
      {
        prompt: avatarPrompt,
        image_urls: artist.referenceImages.slice(0, 3),
        aspect_ratio: '3:4',
        num_images: 1,
        output_format: 'jpeg',
      },
      {
        headers: { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 120_000,
      },
    );

    const tempUrl = response.data?.images?.[0]?.url;
    if (!tempUrl) {
      return res.status(500).json({ success: false, error: 'Avatar generation failed. Try again.' });
    }

    let permanentUrl = tempUrl;
    try {
      permanentUrl = await downloadAndStoreImage(tempUrl, `${artistId}/avatar`, 0);
    } catch { /* keep FAL url */ }

    const avatar = {
      artistId: String(artistId),
      artistName: artist.name,
      url: permanentUrl,
      model: 'fal-ai/nano-banana-2/edit',
      referenceCount: artist.referenceImages.length,
      createdAt: new Date().toISOString(),
    };

    await firestoreDb.collection('hologram_avatars').doc(String(artistId)).set(avatar);

    console.log(`[HoloGallery] ✅ Avatar saved for ${artist.name}`);
    return res.json({ success: true, avatar });
  } catch (err: any) {
    console.error('[HoloGallery] Avatar generate error:', err.response?.data?.detail || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /:artistId/character-3d
 * Returns the stored 3D character (GLB) for this artist, if any.
 */
router.get('/:artistId/character-3d', async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    const doc = await firestoreDb.collection('hologram_characters').doc(String(artistId)).get();
    if (!doc.exists) return res.json({ success: true, character: null });
    return res.json({ success: true, character: doc.data() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /:artistId/character-3d/performances
 * Returns the artist's library of generated singing performances. Each entry is
 * a reusable motion clip (the captured performance motion timeline + its video/
 * audio) that the avatar can replay — surfaced in the Hologram Showcase and the
 * HoloStage animation session. Public read (mirrors GET /character-3d).
 */
router.get('/:artistId/character-3d/performances', async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    const doc = await firestoreDb.collection('hologram_characters').doc(String(artistId)).get();
    if (!doc.exists) return res.json({ success: true, performances: [] });
    const data: any = doc.data();
    const clips: any[] = Array.isArray(data?.performanceClips) ? data.performanceClips : [];
    // Back-compat: surface a pre-library single performance as one clip.
    if (clips.length === 0 && data?.motionTimeline) {
      clips.push({
        id: data.latestPerformanceId || 'latest',
        songTitle: 'Singing performance',
        videoUrl: data.performanceVideoUrl || null,
        audioUrl: data.performanceAudioUrl || null,
        clipStart: data.performanceClipStart ?? 0,
        clipDuration: data.performanceClipDuration ?? null,
        duration: data.motionTimeline?.duration ?? 0,
        frameCount: data.motionTimeline?.frameCount ?? 0,
        avgEnergy: data.motionTimeline?.avgEnergy ?? 0,
        mode: data.perfMode || 'omnihuman',
        lipsynced: !!data.perfLipsynced,
        hasMotion: true,
        motionTimeline: data.motionTimeline,
        createdAt: data.performanceAt || new Date().toISOString(),
      });
    }
    return res.json({ success: true, performances: clips });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /:artistId/character-3d
 * Builds a real 3D character (GLB) of the artist:
 *   1. Generates a clean full-body A-pose "3D-ready" image from the artist's
 *      real photos (neutral background, flat lighting — best input for image-to-3D).
 *   2. Feeds that image to FAL Hunyuan 3D v3.1 Pro (image-to-3D) to
 *      produce a textured, PBR humanoid GLB.
 *   3. Stores the GLB permanently and saves metadata in `hologram_characters`.
 * The result is consumed by the Hologram Show Engine (model-viewer).
 * Body: { forceRegenerate?: boolean }
 */
/**
 * Core 3D character generation pipeline (no HTTP layer) so it can be invoked from
 * the authenticated route OR a trusted local/admin script.
 * Returns { character } on success, or { alreadyExists, character } if it exists,
 * or throws with a `.statusCode` for client-facing errors.
 */
export async function generateCharacter3D(
  artistId: string | number,
  forceRegenerate = false,
  options: { pose?: 'a-pose' | 't-pose'; quality?: 'web' | 'balanced' | 'hq' } = {},
): Promise<{ character: any; alreadyExists?: boolean }> {
  if (!FAL_API_KEY) {
    const e: any = new Error('FAL_API_KEY not configured');
    e.statusCode = 503;
    throw e;
  }

  if (!forceRegenerate) {
    const existing = await firestoreDb.collection('hologram_characters').doc(String(artistId)).get();
    if (existing.exists) {
      return { character: existing.data(), alreadyExists: true };
    }
  }

  const artist = await getArtistData(String(artistId));
  if (artist.referenceImages.length === 0) {
    const e: any = new Error('No reference photos found. Upload a profile photo or generate gallery images first.');
    e.statusCode = 400;
    throw e;
  }

  const pose = options.pose ?? 'a-pose';
  const quality = options.quality ?? 'balanced';

  // ── Step 1: generate a clean, full-body, rig-ready pose image ──
    // Image-to-3D models AND Mixamo auto-rigging need a neutral, symmetrical
    // pose, plain background and flat even lighting. Anything dynamic (crossed
    // arms, hands in pockets, dance poses, cropped limbs) produces broken meshes
    // and a rig that can't be auto-weighted.
    const poseSpec =
      pose === 't-pose'
        ? `standing in a perfect symmetrical T-pose: both arms fully extended straight out horizontally to the sides at exact shoulder height (90° from the torso), palms facing down, fingers straight and slightly spread, legs straight and together`
        : `standing in a relaxed symmetrical A-pose: both arms straight and angled about 40 degrees away from the torso, hands open with palms facing the body and fingers slightly spread (not touching the legs), legs straight and separated to shoulder width`;

    const posePrompt =
      `The person in the reference image(s) — keep their exact face, identity, hairstyle and likeness fully recognizable. ` +
      `A single full-body shot from the top of the head to the feet, ${poseSpec}, facing the camera directly and perfectly centered, ` +
      `weight evenly on both feet, head looking straight forward, neutral expression. ` +
      `Plain seamless light-gray studio backdrop, soft even flat lighting with no harsh shadows and no rim light, sharp focus, photorealistic, ` +
      `the entire body, hands and outfit fully visible inside the frame with margin around the silhouette. ` +
      `Artist: ${artist.name}, ${artist.genre}. Vertical full-body portrait. ` +
      `Do NOT crop the head, hands or feet. No props, no microphone, no text, no extra people, no motion blur, arms must not cross or touch the body.`;

    console.log(`[HoloGallery] [3D] Generating ${pose} image for ${artist.name}`);
    const poseResp = await axios.post(
      `${FAL_BASE_URL}/fal-ai/nano-banana-2/edit`,
      {
        prompt: posePrompt,
        image_urls: artist.referenceImages.slice(0, 3),
        aspect_ratio: '3:4',
        num_images: 1,
        output_format: 'png',
      },
      { headers: { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 120_000 },
    );
    const poseImageUrl = poseResp.data?.images?.[0]?.url;
    if (!poseImageUrl) {
      const e: any = new Error('3D-ready image generation failed. Try again.');
      e.statusCode = 500;
      throw e;
    }

    // Persist the source image (so we can regenerate the 3D without re-billing the pose step)
    let poseImagePermanent = poseImageUrl;
    try {
      poseImagePermanent = await downloadAndStoreImage(poseImageUrl, `${artistId}/3d-source`, 0);
    } catch { /* keep FAL url */ }

    // ── Step 2: image → 3D model via FAL Hunyuan 3D v3.1 Pro (queue, async) ──
    console.log(`[HoloGallery] [3D] Submitting Hunyuan 3D v3.1 Pro image-to-3D job for ${artist.name}`);
    const HUNYUAN_ENDPOINT = 'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d';
    const { statusUrl, responseUrl, apiKey } = await falQueueSubmit(HUNYUAN_ENDPOINT, {
      input_image_url: poseImageUrl,
      generate_type: 'Normal',   // textured model
      enable_pbr: true,          // metallic / roughness / normal textures
      face_count: 500000,
    });

    const result = await falQueuePoll(statusUrl, responseUrl, 300_000, apiKey);
    const modelUrl =
      result?.model_glb?.url ||
      result?.model_urls?.glb?.url ||
      result?.model_mesh?.url ||
      result?.model?.url ||
      null;

    if (!modelUrl) {
      console.error('[HoloGallery] [3D] Hunyuan returned no model URL:', JSON.stringify(result).slice(0, 300));
      const e: any = new Error('3D model generation failed. Please try again.');
      e.statusCode = 500;
      throw e;
    }

    // Mixamo-friendly source formats (FBX preferred, OBJ fallback) for auto-rigging + animation.
    const fbxSourceUrl = result?.model_urls?.fbx?.url || null;
    const objSourceUrl = result?.model_urls?.obj?.url || null;

    // ── Step 3: store the GLB permanently + save metadata ──
    let glbPermanent = modelUrl;
    try {
      glbPermanent = await downloadAndStoreModel(modelUrl, String(artistId), 'glb', { quality });
    } catch (e) {
      console.warn('[HoloGallery] [3D] GLB store failed, using FAL url:', (e as Error)?.message);
    }

    // Persist the Mixamo-ready FBX (and OBJ) so the artist can rig & animate the model.
    let fbxPermanent: string | null = fbxSourceUrl;
    if (fbxSourceUrl) {
      try {
        fbxPermanent = await downloadAndStoreModel(fbxSourceUrl, String(artistId), 'fbx');
      } catch (e) {
        console.warn('[HoloGallery] [3D] FBX store failed, using FAL url:', (e as Error)?.message);
      }
    }
    let objPermanent: string | null = objSourceUrl;
    if (objSourceUrl) {
      try {
        objPermanent = await downloadAndStoreModel(objSourceUrl, String(artistId), 'obj');
      } catch (e) {
        console.warn('[HoloGallery] [3D] OBJ store failed, using FAL url:', (e as Error)?.message);
      }
    }

    const character = {
      artistId: String(artistId),
      artistName: artist.name,
      glbUrl: glbPermanent,
      fbxUrl: fbxPermanent,          // Mixamo-ready (auto-rig + animations)
      objUrl: objPermanent,          // Mixamo fallback format
      sourceImageUrl: poseImagePermanent,
      thumbnailUrl: poseImagePermanent,
      model: HUNYUAN_ENDPOINT,
      rigged: false,
      mixamoReady: !!(fbxPermanent || objPermanent),
      format: 'glb',
      pose,
      quality,
      compressed: true,
      referenceCount: artist.referenceImages.length,
      createdAt: new Date().toISOString(),
    };

    await firestoreDb.collection('hologram_characters').doc(String(artistId)).set(character);

    console.log(`[HoloGallery] [3D] ✅ Character GLB saved for ${artist.name}`);
    return { character };
}

router.post('/:artistId/character-3d', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { forceRegenerate = false, pose, quality } = req.body || {};
  const validPose = pose === 't-pose' || pose === 'a-pose' ? pose : undefined;
  const validQuality = ['web', 'balanced', 'hq'].includes(quality) ? quality : undefined;
  try {
    const result = await generateCharacter3D(artistId, forceRegenerate, {
      pose: validPose,
      quality: validQuality,
    });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    const status = err.statusCode || 500;
    console.error('[HoloGallery] character-3d error:', err.response?.data?.detail || err.message);
    res.status(status).json({ success: false, error: err.message || '3D generation failed' });
  }
});

/**
 * POST /:artistId/character-3d/animated
 * Attaches a Mixamo-rigged & animated model to the artist's hologram character.
 * Accepts either a converted glTF/GLB (.glb) OR a Mixamo "with skin" FBX (.fbx)
 * — the viewer can load both (FBX via FBXLoader). The profile + holostage then
 * play the animated model instead of the static one.
 * Body: { animatedUrl?: string, animatedGlbUrl?: string }
 */
router.post('/:artistId/character-3d/animated', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const body = req.body || {};
  const animatedUrl: string = body.animatedUrl || body.animatedGlbUrl || '';

  try {
    const isGlb = /^https?:\/\/.+\.glb(\?.*)?$/i.test(animatedUrl);
    const isFbx = /^https?:\/\/.+\.fbx(\?.*)?$/i.test(animatedUrl);
    if (!animatedUrl || typeof animatedUrl !== 'string' || (!isGlb && !isFbx)) {
      return res.status(400).json({ success: false, error: 'A valid public .glb or .fbx URL is required.' });
    }
    const format: 'glb' | 'fbx' = isFbx ? 'fbx' : 'glb';

    const docRef = firestoreDb.collection('hologram_characters').doc(String(artistId));
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ success: false, error: 'No 3D character found. Generate the 3D model first.' });
    }

    // Store the animated model permanently (best-effort; keep source URL on failure).
    // Don't Draco-compress FBX (compression only applies to GLB).
    let animatedPermanent = animatedUrl;
    try {
      animatedPermanent = await downloadAndStoreModel(animatedUrl, String(artistId), format);
    } catch (e) {
      console.warn('[HoloGallery] [3D] Animated model store failed, using source url:', (e as Error)?.message);
    }

    await docRef.set(
      {
        animatedGlbUrl: animatedPermanent,   // back-compat field consumed by viewers
        animatedUrl: animatedPermanent,
        animatedFormat: format,
        rigged: true,
        animatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    const updated = (await docRef.get()).data();
    console.log(`[HoloGallery] [3D] ✅ Mixamo-animated ${format.toUpperCase()} attached for ${artistId}`);
    return res.json({ success: true, character: updated });
  } catch (err: any) {
    console.error('[HoloGallery] character-3d/animated error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to attach animated model' });
  }
});

// ─── Tripo auto-rigging (API-driven alternative to manual Mixamo) ──────────────
// Tracks in-flight jobs in-memory to avoid duplicate concurrent rigs per artist.
const activeRigJobs = new Set<string>();
const RIG_STALE_MS = 15 * 60 * 1000; // a 'processing' doc older than this is considered dead

/**
 * Runs the full Tripo pipeline in the background and writes the result back to
 * the character doc. Kept off the request lifecycle because the 3-stage pipeline
 * (image→mesh→rig→retarget) can exceed the HTTP timeout.
 */
async function runAutoRigJob(artistId: string, imageUrl: string, animation: string | null) {
  const docRef = firestoreDb.collection('hologram_characters').doc(String(artistId));
  try {
    const result = await autoRigFromImage({
      imageUrl,
      animation,
      outFormat: 'glb',
      onStage: (stage, taskId) => {
        console.log(`[HoloGallery] [Tripo] ${artistId} stage=${stage} task=${taskId}`);
        docRef.set({ rigStage: stage }, { merge: true }).catch(() => {});
      },
    });

    // Persist the rigged / animated GLB(s) before Tripo's URLs expire (~minutes).
    let riggedPermanent: string | null = result.riggedUrl;
    if (result.riggedUrl) {
      try {
        riggedPermanent = await downloadAndStoreModel(result.riggedUrl, String(artistId), 'glb', { quality: 'balanced' });
      } catch (e) {
        console.warn('[HoloGallery] [Tripo] rigged store failed, using source url:', (e as Error)?.message);
      }
    }
    let animatedPermanent: string | null = result.animatedUrl;
    if (result.animatedUrl) {
      try {
        animatedPermanent = await downloadAndStoreModel(result.animatedUrl, String(artistId), 'glb', { quality: 'balanced' });
      } catch (e) {
        console.warn('[HoloGallery] [Tripo] animated store failed, using source url:', (e as Error)?.message);
      }
    }

    const patch: Record<string, unknown> = {
      rigProvider: 'tripo',
      rigSkeleton: result.skeleton,
      rigAnimation: result.animation,
      riggedGlbUrl: riggedPermanent,
      mixamoReady: result.skeleton === 'mixamo',
      rigged: true,
      rigStatus: 'ready',
      rigStage: 'done',
      rigError: null,
      riggedAt: new Date().toISOString(),
    };
    // In "animate" mode the baked GLB becomes the model the viewer plays.
    if (animatedPermanent) {
      patch.animatedGlbUrl = animatedPermanent;
      patch.animatedUrl = animatedPermanent;
      patch.animatedFormat = 'glb';
    }

    await docRef.set(patch, { merge: true });
    console.log(`[HoloGallery] [Tripo] ✅ Auto-rig (${result.mode}/${result.skeleton}) complete for ${artistId}`);
  } catch (err: any) {
    console.error('[HoloGallery] [Tripo] auto-rig job failed:', err?.message);
    await docRef
      .set({ rigStatus: 'failed', rigStage: null, rigError: err?.message || 'Auto-rig failed' }, { merge: true })
      .catch(() => {});
  } finally {
    activeRigJobs.delete(String(artistId));
  }
}

/**
 * POST /:artistId/character-3d/auto-rig
 * One-click auto-rigging via the Tripo3D API — no manual Mixamo upload needed.
 * Builds a riggable mesh from the artist's clean pose image, rigs it, and
 * (optionally) bakes a preset animation onto it.
 * Body: { animation?: string | 'none' }  — a Tripo preset (e.g. "preset:idle").
 *   • animation present → Tripo-skeleton rig + baked animation (plays immediately)
 *   • animation absent/'none' → Mixamo-compatible skeleton (use any Mixamo clip)
 * Returns immediately with { status: 'processing' }; poll GET /character-3d.
 */
router.post('/:artistId/character-3d/auto-rig', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const body = req.body || {};
  const rawAnim = typeof body.animation === 'string' ? body.animation.trim() : '';
  const animation =
    rawAnim && rawAnim !== 'none' && (TRIPO_PRESET_ANIMATIONS as readonly string[]).includes(rawAnim)
      ? rawAnim
      : null;

  try {
    if (!isTripoConfigured()) {
      return res.status(503).json({ success: false, error: 'Auto-rigging is not configured (TRIPO_API_KEY missing).' });
    }

    const docRef = firestoreDb.collection('hologram_characters').doc(String(artistId));
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, error: 'No 3D character found. Generate the 3D model first.' });
    }
    const character: any = snap.data();
    const imageUrl: string = character?.sourceImageUrl || character?.thumbnailUrl || '';
    if (!imageUrl) {
      return res.status(400).json({ success: false, error: 'No pose image available to rig. Regenerate the 3D model first.' });
    }

    // Guard against duplicate concurrent jobs (in-memory + stale doc check).
    const startedAt = character?.rigStartedAt ? Date.parse(character.rigStartedAt) : 0;
    const isStale = !startedAt || Date.now() - startedAt > RIG_STALE_MS;
    if (activeRigJobs.has(String(artistId)) || (character?.rigStatus === 'processing' && !isStale)) {
      return res.status(409).json({ success: false, error: 'Auto-rig already in progress.', status: 'processing' });
    }

    activeRigJobs.add(String(artistId));
    await docRef.set(
      {
        rigStatus: 'processing',
        rigProvider: 'tripo',
        rigStage: 'model',
        rigError: null,
        rigAnimation: animation,
        rigStartedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Fire-and-forget; client polls GET /character-3d for rigStatus.
    void runAutoRigJob(String(artistId), imageUrl, animation);

    return res.json({
      success: true,
      status: 'processing',
      mode: animation ? 'animate' : 'rig',
      animation,
    });
  } catch (err: any) {
    activeRigJobs.delete(String(artistId));
    console.error('[HoloGallery] character-3d/auto-rig error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to start auto-rig' });
  }
});

// ─── Meshy rigging (rigs the EXISTING GLB without regenerating the mesh) ───────
/**
 * Runs the Meshy rigging pipeline on the artist's already-stored GLB, then writes
 * the rigged (and optionally baked-animation) GLB back to the character doc.
 * Kept off the request lifecycle — rigging can exceed the HTTP timeout.
 */
async function runMeshyRigJob(artistId: string, modelUrl: string, animation: 'walking' | 'running' | null) {
  const docRef = firestoreDb.collection('hologram_characters').doc(String(artistId));
  try {
    const result = await rigExistingModel({
      modelUrl,
      onStage: (stage, taskId) => {
        console.log(`[HoloGallery] [Meshy] ${artistId} stage=${stage} task=${taskId}`);
        docRef.set({ rigStage: stage }, { merge: true }).catch(() => {});
      },
    });

    // Pick the baked animation the artist requested (if Meshy returned one).
    const animatedSource =
      animation === 'walking' ? result.walkingGlbUrl
      : animation === 'running' ? result.runningGlbUrl
      : null;

    // Persist results before Meshy's URLs expire.
    let riggedPermanent: string | null = result.riggedGlbUrl;
    if (result.riggedGlbUrl) {
      try {
        riggedPermanent = await downloadAndStoreModel(result.riggedGlbUrl, String(artistId), 'glb', { quality: 'balanced' });
      } catch (e) {
        console.warn('[HoloGallery] [Meshy] rigged store failed, using source url:', (e as Error)?.message);
      }
    }
    let animatedPermanent: string | null = animatedSource;
    if (animatedSource) {
      try {
        animatedPermanent = await downloadAndStoreModel(animatedSource, String(artistId), 'glb', { quality: 'balanced' });
      } catch (e) {
        console.warn('[HoloGallery] [Meshy] animated store failed, using source url:', (e as Error)?.message);
      }
    }

    const patch: Record<string, unknown> = {
      rigProvider: 'meshy',
      rigSkeleton: 'mixamo',
      rigAnimation: animation,
      riggedGlbUrl: riggedPermanent,
      mixamoReady: true,
      rigged: true,
      rigStatus: 'ready',
      rigStage: 'done',
      rigError: null,
      riggedAt: new Date().toISOString(),
    };
    if (animatedPermanent) {
      patch.animatedGlbUrl = animatedPermanent;
      patch.animatedUrl = animatedPermanent;
      patch.animatedFormat = 'glb';
    }

    await docRef.set(patch, { merge: true });
    console.log(`[HoloGallery] [Meshy] ✅ Rig complete for ${artistId} (anim=${animation || 'none'})`);
  } catch (err: any) {
    console.error('[HoloGallery] [Meshy] rig job failed:', err?.message);
    await docRef
      .set({ rigStatus: 'failed', rigStage: null, rigError: err?.message || 'Meshy rig failed' }, { merge: true })
      .catch(() => {});
  } finally {
    activeRigJobs.delete(String(artistId));
  }
}

/**
 * POST /:artistId/character-3d/meshy-rig
 * One-click rigging of the EXISTING GLB via Meshy — no regeneration, no manual
 * Mixamo upload. Returns a Mixamo-compatible skeleton + optional baked anim.
 * Body: { animation?: 'walking' | 'running' | 'none' }
 * Returns immediately with { status: 'processing' }; poll GET /character-3d.
 */
router.post('/:artistId/character-3d/meshy-rig', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const body = req.body || {};
  const rawAnim = typeof body.animation === 'string' ? body.animation.trim().toLowerCase() : '';
  const animation: 'walking' | 'running' | null =
    rawAnim === 'walking' || rawAnim === 'running' ? rawAnim : null;

  try {
    if (!isMeshyConfigured()) {
      return res.status(503).json({ success: false, error: 'Meshy rigging is not configured (MESHY_API_KEY missing).' });
    }

    const docRef = firestoreDb.collection('hologram_characters').doc(String(artistId));
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, error: 'No 3D character found. Generate the 3D model first.' });
    }
    const character: any = snap.data();
    // Meshy rigs the existing textured GLB directly (the base mesh, not an animated one).
    const modelUrl: string = character?.glbUrl || '';
    if (!modelUrl) {
      return res.status(400).json({ success: false, error: 'No GLB model available to rig. Generate the 3D model first.' });
    }

    // Guard against duplicate concurrent jobs (in-memory + stale doc check).
    const startedAt = character?.rigStartedAt ? Date.parse(character.rigStartedAt) : 0;
    const isStale = !startedAt || Date.now() - startedAt > RIG_STALE_MS;
    if (activeRigJobs.has(String(artistId)) || (character?.rigStatus === 'processing' && !isStale)) {
      return res.status(409).json({ success: false, error: 'A rig job is already in progress.', status: 'processing' });
    }

    activeRigJobs.add(String(artistId));
    await docRef.set(
      {
        rigStatus: 'processing',
        rigProvider: 'meshy',
        rigStage: 'rig',
        rigError: null,
        rigAnimation: animation,
        rigStartedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Fire-and-forget; client polls GET /character-3d for rigStatus.
    void runMeshyRigJob(String(artistId), modelUrl, animation);

    return res.json({
      success: true,
      status: 'processing',
      provider: 'meshy',
      animation,
    });
  } catch (err: any) {
    activeRigJobs.delete(String(artistId));
    console.error('[HoloGallery] character-3d/meshy-rig error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to start Meshy rig' });
  }
});

// ─── Singing performance (video → motion transfer) ────────────────────────────
// Generates a short video of the artist singing from their clean pose image,
// extracts a high-level MOTION TIMELINE from it, and stores both on the
// character doc. The viewer replays the timeline on the avatar, synced to the
// artist's song — a "motion-style" transfer that works on any GLB.
const activePerfJobs = new Set<string>();
const PERF_STALE_MS = 15 * 60 * 1000;

/**
 * Generate a singing/performance video from a still image via FAL image-to-video.
 * Tries Kling v3 Standard (queue) first, falls back to Wan v2.6. Returns a temp
 * FAL video URL (expires within hours) or null.
 */
async function generateSingingVideo(imageUrl: string, prompt: string): Promise<string | null> {
  if (!FAL_API_KEY) {
    console.warn('[HoloGallery] [Perf] FAL_API_KEY not configured for video');
    return null;
  }

  // Primary: Kling v3 Standard image-to-video (good motion, economical, queue).
  try {
    const { statusUrl, responseUrl, apiKey } = await falQueueSubmit(
      'fal-ai/kling-video/v3/standard/image-to-video',
      {
        image_url: imageUrl,
        prompt,
        duration: '5',
        aspect_ratio: '9:16',
        negative_prompt:
          'extra limbs, deformed hands, distorted face, identity change, camera cuts, scene change, text, watermark',
      },
    );
    const result = await falQueuePoll(statusUrl, responseUrl, 300_000, apiKey);
    const url = result?.video?.url || result?.video_url || result?.videos?.[0]?.url;
    if (url) return url;
  } catch (err: any) {
    console.warn('[HoloGallery] [Perf] Kling v3 standard failed, trying Wan:', err?.response?.data?.detail || err?.message);
  }

  // Fallback: Wan v2.6 image-to-video.
  try {
    const { statusUrl, responseUrl, apiKey } = await falQueueSubmit(
      'fal-ai/wan/v2.6/image-to-video',
      {
        image_url: imageUrl,
        prompt,
        resolution: '480p',
        aspect_ratio: '9:16',
        num_frames: 81,
      },
    );
    const result = await falQueuePoll(statusUrl, responseUrl, 300_000, apiKey);
    const url = result?.video?.url || result?.video_url || result?.videos?.[0]?.url;
    if (url) return url;
  } catch (err: any) {
    console.error('[HoloGallery] [Perf] Wan v2.6 failed:', err?.response?.data?.detail || err?.message);
  }

  return null;
}

/** Store a generated performance video to Firebase Storage (permanent URL). */
async function downloadAndStorePerformanceVideo(sourceUrl: string, artistId: string): Promise<string> {
  const response = await axios.get(sourceUrl, { responseType: 'arraybuffer', timeout: 180_000 });
  const buffer = Buffer.from(response.data);
  const mimeType = response.headers['content-type'] || 'video/mp4';
  const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
  const fileName = `hologram-characters/${artistId}/${Date.now()}-performance.${ext}`;
  const file = storage.bucket().file(fileName);
  await file.save(buffer, { contentType: mimeType, public: true });
  return `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
}

/** Store the prepared audio clip to Firebase Storage (permanent public URL). */
async function storePerformanceAudio(buffer: Buffer, artistId: string): Promise<string> {
  const fileName = `hologram-characters/${artistId}/${Date.now()}-performance-clip.mp3`;
  const file = storage.bucket().file(fileName);
  await file.save(buffer, { contentType: 'audio/mpeg', public: true });
  return `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
}

/**
 * Audio-driven singing video via ByteDance OmniHuman.
 * Feeds the clean pose image + the song's audio clip; OmniHuman drives lips,
 * facial expression AND body motion from the audio waveform, so the result is
 * frame-accurately in sync with the song. Returns a temp FAL video URL or null.
 */
async function generateOmniHumanVideo(imageUrl: string, audioUrl: string): Promise<string | null> {
  if (!FAL_API_KEY) return null;
  // Prefer v1.5 (improved motion/audio), fall back to base OmniHuman.
  // IMPORTANT (cost-safety): only fall back when the SUBMIT itself fails (no
  // charge yet — e.g. model unavailable / balance). If a job was accepted but
  // the poll fails/times out, we must NOT submit a second job: FAL already
  // billed the first one, so a retry would double-charge.
  const endpoints = ['fal-ai/bytedance/omnihuman/v1.5', 'fal-ai/bytedance/omnihuman'];
  for (const endpoint of endpoints) {
    let submitted: { statusUrl: string; responseUrl: string } | null = null;
    try {
      submitted = await falQueueSubmit(endpoint, { image_url: imageUrl, audio_url: audioUrl });
    } catch (err: any) {
      console.warn(`[HoloGallery] [Perf] OmniHuman ${endpoint} submit failed (no charge), trying fallback:`, err?.response?.data?.detail || err?.message);
      continue; // safe to try the next endpoint — nothing was billed
    }
    try {
      const result = await falQueuePoll(submitted.statusUrl, submitted.responseUrl, 420_000, submitted.apiKey);
      const url = result?.video?.url || result?.video_url || result?.videos?.[0]?.url;
      if (url) return url;
      console.warn(`[HoloGallery] [Perf] OmniHuman ${endpoint} returned no url — NOT retrying (already billed).`);
      return null;
    } catch (err: any) {
      console.error(`[HoloGallery] [Perf] OmniHuman ${endpoint} poll failed AFTER submit — NOT retrying to avoid double charge:`, err?.response?.data?.detail || err?.message);
      return null; // job was accepted/billed; never resubmit
    }
  }
  return null;
}

/**
 * Refine an existing performance video's lips against the audio with
 * Sync Lipsync 2.0 for pixel-tight mouth sync. Returns the refined video URL,
 * or the original on failure (graceful — OmniHuman is already well synced).
 */
async function refineLipsync(videoUrl: string, audioUrl: string, pro = false): Promise<string> {
  if (!FAL_API_KEY) return videoUrl;
  try {
    const { statusUrl, responseUrl, apiKey } = await falQueueSubmit('fal-ai/sync-lipsync/v2', {
      video_url: videoUrl,
      audio_url: audioUrl,
      model: pro ? 'lipsync-2-pro' : 'lipsync-2',
      sync_mode: 'cut_off',
    });
    const result = await falQueuePoll(statusUrl, responseUrl, 420_000, apiKey);
    const url = result?.video?.url || result?.video_url || result?.videos?.[0]?.url;
    return url || videoUrl;
  } catch (err: any) {
    console.warn('[HoloGallery] [Perf] sync-lipsync failed, keeping OmniHuman output:', err?.response?.data?.detail || err?.message);
    return videoUrl;
  }
}

/**
 * Background job: generate the singing video, extract its motion timeline, and
 * persist both to the character doc. Kept off the request lifecycle because
 * video generation + decoding can exceed the HTTP timeout.
 *
 * When `audioUrl` is provided we run the high-fidelity AUDIO-DRIVEN pipeline:
 *   song → trim clip (≤30s) → OmniHuman (lip + body synced to audio) →
 *   sync-lipsync refine → store video + the exact clip → extract motion.
 * The viewer plays back that same clip so the avatar motion, the lip-synced
 * video and the song stay perfectly aligned. Without audio it falls back to a
 * prompt-driven image-to-video clip (Kling/Wan) + procedural motion.
 */
async function runSingingPerformanceJob(
  artistId: string,
  imageUrl: string,
  prompt: string,
  opts: { audioUrl?: string; startSec?: number; clipDuration?: number; lipsyncPro?: boolean; songTitle?: string } = {},
) {
  const docRef = firestoreDb.collection('hologram_characters').doc(String(artistId));
  try {
    let tempVideoUrl: string | null = null;
    let performanceAudioUrl: string | null = null;
    let clipDuration = 0;
    let clipStartSec = 0;
    let lipsynced = false;

    if (opts.audioUrl) {
      // ── Audio-driven pipeline (OmniHuman + sync-lipsync) ──────────────────
      docRef.set({ perfStage: 'audio', perfMode: 'omnihuman' }, { merge: true }).catch(() => {});
      const { prepareAudioClip } = await import('../services/motion-extract-service');
      const clip = await prepareAudioClip(opts.audioUrl, opts.startSec ?? 0, opts.clipDuration ?? 8);
      if (!clip) throw new Error('Could not prepare the song audio clip.');
      clipDuration = clip.duration;
      clipStartSec = clip.startSec;
      performanceAudioUrl = await storePerformanceAudio(clip.buffer, String(artistId));

      docRef.set({ perfStage: 'video', performanceAudioUrl }, { merge: true }).catch(() => {});
      const omniUrl = await generateOmniHumanVideo(imageUrl, performanceAudioUrl);
      if (!omniUrl) throw new Error('OmniHuman returned no video.');

      docRef.set({ perfStage: 'lipsync' }, { merge: true }).catch(() => {});
      tempVideoUrl = await refineLipsync(omniUrl, performanceAudioUrl, !!opts.lipsyncPro);
      lipsynced = tempVideoUrl !== omniUrl;
    } else {
      // ── Prompt-driven fallback (no audio available) ───────────────────────
      docRef.set({ perfStage: 'video', perfMode: 'image-to-video' }, { merge: true }).catch(() => {});
      tempVideoUrl = await generateSingingVideo(imageUrl, prompt);
    }

    if (!tempVideoUrl) throw new Error('Video generation returned no result');

    // Persist the video before FAL's temp URL expires.
    let videoUrl = tempVideoUrl;
    try {
      videoUrl = await downloadAndStorePerformanceVideo(tempVideoUrl, String(artistId));
    } catch (e) {
      console.warn('[HoloGallery] [Perf] video store failed, using source url:', (e as Error)?.message);
    }

    docRef.set({ perfStage: 'motion', performanceVideoUrl: videoUrl }, { merge: true }).catch(() => {});

    // Extract the high-level motion timeline from the (temp) video — decoding
    // the FAL url directly avoids a second round-trip to storage.
    const { extractMotionTimeline } = await import('../services/motion-extract-service');
    const timeline = await extractMotionTimeline(tempVideoUrl);
    const safeTimeline = timeline ? JSON.parse(JSON.stringify(timeline)) : null;

    // Append this performance to the character's reusable clip library (newest
    // first, capped) so every generated performance becomes a selectable
    // animation in the showcase + the HoloStage animation session.
    let performanceClips: any[] = [];
    try {
      const cur = await docRef.get();
      const existing = cur.data()?.performanceClips;
      performanceClips = Array.isArray(existing) ? existing : [];
    } catch { /* start fresh */ }
    const clip = {
      id: uuidv4(),
      songTitle: (opts.songTitle && opts.songTitle.trim()) || (opts.audioUrl ? 'Singing performance' : 'Performance'),
      videoUrl,
      audioUrl: performanceAudioUrl || null,
      clipStart: clipStartSec,
      clipDuration: clipDuration || null,
      duration: safeTimeline?.duration ?? (clipDuration || 0),
      frameCount: safeTimeline?.frameCount ?? 0,
      avgEnergy: safeTimeline?.avgEnergy ?? 0,
      mode: opts.audioUrl ? 'omnihuman' : 'image-to-video',
      lipsynced,
      hasMotion: !!safeTimeline,
      motionTimeline: safeTimeline,
      createdAt: new Date().toISOString(),
    };
    performanceClips = [clip, ...performanceClips].slice(0, 12);

    await docRef.set(
      {
        performanceVideoUrl: videoUrl,
        performanceAudioUrl: performanceAudioUrl || null,
        performanceClipStart: clipStartSec,
        performanceClipDuration: clipDuration || null,
        perfMode: opts.audioUrl ? 'omnihuman' : 'image-to-video',
        perfLipsynced: lipsynced,
        motionTimeline: safeTimeline,
        performanceClips,
        latestPerformanceId: clip.id,
        perfStatus: 'ready',
        perfStage: 'done',
        perfError: timeline ? null : 'Could not extract motion (the avatar will use procedural singing).',
        performanceAt: new Date().toISOString(),
      },
      { merge: true },
    );
    console.log(`[HoloGallery] [Perf] ✅ Singing performance ready for ${artistId} (mode=${opts.audioUrl ? 'omnihuman' : 'i2v'}, lipsync=${lipsynced}, frames=${timeline?.frameCount ?? 0})`);
  } catch (err: any) {
    console.error('[HoloGallery] [Perf] singing performance job failed:', err?.message);
    await docRef
      .set({ perfStatus: 'failed', perfStage: null, perfError: err?.message || 'Performance generation failed' }, { merge: true })
      .catch(() => {});
  } finally {
    activePerfJobs.delete(String(artistId));
  }
}

/**
 * Trusted, awaitable trigger for the singing-performance pipeline — same code
 * path as the POST endpoint but without the Clerk HTTP layer, so a local
 * operator (e.g. scripts/generate-singing-performance.ts) can run it directly.
 */
export async function triggerSingingPerformance(
  artistId: string,
  opts: { audioUrl?: string; startSec?: number; duration?: number; lipsyncPro?: boolean; prompt?: string; songTitle?: string } = {},
) {
  const docRef = firestoreDb.collection('hologram_characters').doc(String(artistId));
  const snap = await docRef.get();
  if (!snap.exists) throw new Error('No 3D character found. Generate the 3D model first.');
  const character: any = snap.data();
  const imageUrl: string = character?.sourceImageUrl || character?.thumbnailUrl || '';
  if (!imageUrl) throw new Error('No pose image available. Regenerate the 3D model first.');

  const artistName = character?.artistName ? `, the artist ${character.artistName},` : '';
  const prompt =
    (opts.prompt || '').trim() ||
    `The person${artistName} performing live and singing passionately into a microphone. ` +
      `Natural full-body stage performance: rhythmic head movement, expressive hand and arm gestures, ` +
      `subtle weight-shifting and swaying to the beat, emotive facial expression while singing. ` +
      `Keep the exact same face, identity, outfit and pose framing. Single continuous shot, no camera cuts, ` +
      `steady framing, full body visible.`;

  const audioUrl = typeof opts.audioUrl === 'string' && /^https?:\/\//i.test(opts.audioUrl) ? opts.audioUrl : '';
  await docRef.set(
    { perfStatus: 'processing', perfStage: audioUrl ? 'audio' : 'video', perfMode: audioUrl ? 'omnihuman' : 'image-to-video', perfError: null, perfStartedAt: new Date().toISOString() },
    { merge: true },
  );
  await runSingingPerformanceJob(String(artistId), imageUrl, prompt, {
    audioUrl,
    startSec: opts.startSec ?? 0,
    clipDuration: opts.duration ?? 8,
    lipsyncPro: !!opts.lipsyncPro,
    songTitle: opts.songTitle,
  });
  const after = await docRef.get();
  return after.data();
}

/**
 * POST /:artistId/character-3d/singing-performance
 * Generates a singing video of the artist and extracts a motion timeline the
 * avatar can replay (synced to the song in the viewer).
 * Body: {
 *   prompt?: string,        // optional custom performance description (no-audio mode)
 *   audioUrl?: string,      // song URL → enables OmniHuman audio-driven lipsync
 *   startSec?: number,      // clip offset into the song (default 0)
 *   duration?: number,      // clip length, capped at 30s (OmniHuman limit)
 *   lipsyncPro?: boolean,   // use lipsync-2-pro for sharper mouth detail
 * }
 * Returns immediately with { status: 'processing' }; poll GET /character-3d.
 */
router.post('/:artistId/character-3d/singing-performance', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const body = req.body || {};
  const customPrompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 600) : '';
  const audioUrl = typeof body.audioUrl === 'string' && /^https?:\/\//i.test(body.audioUrl) ? body.audioUrl.trim() : '';
  const startSec = Number.isFinite(body.startSec) ? Math.max(0, Number(body.startSec)) : 0;
  const duration = Number.isFinite(body.duration) ? Math.max(2, Math.min(30, Number(body.duration))) : 8;
  const lipsyncPro = !!body.lipsyncPro;
  const songTitle = typeof body.songTitle === 'string' ? body.songTitle.trim().slice(0, 120) : '';

  try {
    if (!FAL_API_KEY) {
      return res.status(503).json({ success: false, error: 'Video generation is not configured (FAL key missing).' });
    }

    const docRef = firestoreDb.collection('hologram_characters').doc(String(artistId));
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, error: 'No 3D character found. Generate the 3D model first.' });
    }
    const character: any = snap.data();
    const imageUrl: string = character?.sourceImageUrl || character?.thumbnailUrl || '';
    if (!imageUrl) {
      return res.status(400).json({ success: false, error: 'No pose image available. Regenerate the 3D model first.' });
    }

    // Guard against duplicate concurrent jobs (in-memory + stale doc check).
    const startedAt = character?.perfStartedAt ? Date.parse(character.perfStartedAt) : 0;
    const isStale = !startedAt || Date.now() - startedAt > PERF_STALE_MS;
    if (activePerfJobs.has(String(artistId)) || (character?.perfStatus === 'processing' && !isStale)) {
      return res.status(409).json({ success: false, error: 'A performance is already being generated.', status: 'processing' });
    }

    // Default prompt: an energetic but identity-preserving singing performance.
    const artistName = character?.artistName ? `, the artist ${character.artistName},` : '';
    const prompt =
      customPrompt ||
      `The person${artistName} performing live and singing passionately into a microphone. ` +
        `Natural full-body stage performance: rhythmic head movement, expressive hand and arm gestures, ` +
        `subtle weight-shifting and swaying to the beat, emotive facial expression while singing. ` +
        `Keep the exact same face, identity, outfit and pose framing. Single continuous shot, no camera cuts, ` +
        `steady framing, full body visible.`;

    activePerfJobs.add(String(artistId));
    await docRef.set(
      {
        perfStatus: 'processing',
        perfStage: audioUrl ? 'audio' : 'video',
        perfMode: audioUrl ? 'omnihuman' : 'image-to-video',
        perfError: null,
        perfStartedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Fire-and-forget; client polls GET /character-3d for perfStatus.
    void runSingingPerformanceJob(String(artistId), imageUrl, prompt, {
      audioUrl,
      startSec,
      clipDuration: duration,
      lipsyncPro,
      songTitle,
    });

    return res.json({ success: true, status: 'processing', mode: audioUrl ? 'omnihuman' : 'image-to-video' });
  } catch (err: any) {
    activePerfJobs.delete(String(artistId));
    console.error('[HoloGallery] character-3d/singing-performance error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to start performance generation' });
  }
});

export default router;
