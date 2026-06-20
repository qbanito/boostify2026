/**
 * Electronic Press Kit (EPK) Routes
 * --------------------------------------------------------------------
 * Architecture:
 *   1) The artist's persisted `users.masterJson` is the source of truth for
 *      identity, visual DNA, narrative, business model, etc. We build the
 *      EPK on top of it (no AI re-invention when the data already exists).
 *   2) We reuse images already stored in `artist_profile_images` (press,
 *      concept, reference, banner, profile, generated). Only when slots
 *      are still empty we generate with OpenAI Images (gpt-image-1).
 *   3) Final EPK document is persisted in `artist_epks` (one row per artist)
 *      so the public HTML / PDF endpoints don't trigger AI calls again.
 *   4) Public, print-friendly HTML is served at `/api/epk/:slug/html`. The
 *      "Download PDF" UX uses the browser's "Save as PDF" via window.print().
 */

import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { buildSkillsOnlyPrompt } from '../utils/ai-skills-injector';
import { db } from '../db';
import { users, artistEpks, artistProfileImages, songs, artistMedia } from '@db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { isAdminEmail } from '../../shared/constants';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { editImageWithGPTImage1 } from '../services/fal-service';

const router = express.Router();

const openai = process.env.OPENAI_API_KEY
  ? createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ───────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────

interface EPKContact {
  label: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface EPKPressPhoto {
  url: string;
  caption: string;
  source: 'db' | 'openai' | 'fallback';
}

interface EPKTrack {
  title: string;
  audioUrl: string;
  coverArt?: string;
  duration?: string;
  genre?: string;
  releaseDate?: string;
  plays?: number;
  isFeatured?: boolean;
}

interface EPKVideo {
  title: string;
  url: string;
  thumbnail?: string;
  description?: string;
  isLoop?: boolean;
}

interface EPKBandMember {
  name: string;
  role: string;
}

interface EPKTechnicalSheet {
  bandSize?: string;
  members?: EPKBandMember[];
  instrumentation?: string[];
  liveSetupDuration?: string;
  vocalRange?: string;
  primaryKey?: string;
  bpmRange?: string;
  language?: string[];
  influencesShort?: string;
  preferredVenues?: string;
  technicalRider?: string[];
  hospitalityRider?: string[];
}

interface EPKData {
  // Identity
  artistName: string;
  realName?: string;
  tagline?: string;
  genre: string[];
  location?: string;
  nationality?: string;

  // Bio variants
  oneLineBio?: string;
  shortBio?: string;
  pressRelease: string;
  artistQuote?: string;

  // Press collateral
  achievements: string[];
  factSheet: { label: string; value: string }[];
  influences?: string[];
  notableMoments?: string[];

  // Visuals
  profileImage?: string;
  coverImage?: string;
  referenceImage?: string;
  pressPhotos: EPKPressPhoto[];
  gallery?: string[];

  // Audio / video highlights
  mainSong?: { name: string; url: string };
  mainVideo?: { title: string; url: string };
  tracks?: EPKTrack[];
  videos?: EPKVideo[];

  // Band / technical
  technicalSheet?: EPKTechnicalSheet;

  // Contacts
  contacts: EPKContact[];

  // Links
  socialLinks: {
    spotify?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    youtube?: string;
    website?: string;
  };
  boostifyLinks: {
    profile?: string;
    epk?: string;
    qr?: string;
  };

  // Audit / source
  meta: {
    builtFromMasterJson: boolean;
    masterJsonVersion?: string;
    generatedAt: string;
    language?: 'en' | 'es';
  };
}

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

function getBaseUrl(req?: Request): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.get('host');
    // In production the host header is the real domain — trust it over any
    // hardcoded fallback so the EPK links always match the live domain.
    if (host && !host.startsWith('localhost') && !host.startsWith('127.')) {
      return `${proto}://${host}`;
    }
  }
  return process.env.NODE_ENV === 'production' ? 'https://boostifymusic.com' : 'http://localhost:5000';
}

function buildEpkSlug(artistName: string, userId: number): string {
  const base = (artistName || `artist-${userId}`)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || `artist-${userId}`;
  return `${base}-${userId}`;
}

/**
 * True when the URL points at a still image (jpg/png/webp/gif/avif/heic).
 * Many "banner" rows in the DB are actually `.mp4` loop videos, so without
 * this guard we'd embed a video URL inside an <img> tag and the EPK photos
 * would render as broken images.
 */
function isImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  // Reject obvious video/audio extensions.
  if (/\.(mp4|webm|mov|m4v|ogv|avi|mkv|mp3|wav|m4a|ogg|flac)$/i.test(clean)) return false;
  // Accept obvious image extensions.
  if (/\.(jpg|jpeg|png|webp|gif|avif|heic|heif|bmp|svg)$/i.test(clean)) return true;
  // Firebase storage URLs frequently encode the filename in a `/o/<name>` path,
  // so look for a video extension anywhere in the URL too.
  if (/\.(mp4|webm|mov|m4v|ogv|avi|mkv|mp3|wav|m4a|ogg|flac)(%3F|\?|%23|#|$)/i.test(url)) return false;
  // Permit data URIs and unknown extensions (most CDN URLs don't carry an
  // extension at all; we assume they're images by default).
  if (url.startsWith('data:image/')) return true;
  return true;
}

/**
 * Pull existing artist images from `artist_profile_images` so we can recycle
 * them as press photos before falling back to AI generation.
 */
async function loadDbImagesForUser(userId: number): Promise<{
  press: string[];
  references: string[];
  generated: string[];
  banners: string[];
  concepts: string[];
}> {
  const rows = await db
    .select()
    .from(artistProfileImages)
    .where(eq(artistProfileImages.artistProfileId, userId));

  const buckets = {
    press: [] as string[],
    references: [] as string[],
    generated: [] as string[],
    banners: [] as string[],
    concepts: [] as string[],
  };
  for (const r of rows) {
    if (!r.imageUrl || !isImageUrl(r.imageUrl)) continue;
    if (r.imageType === 'reference') buckets.references.push(r.imageUrl);
    else if (r.imageType === 'banner') buckets.banners.push(r.imageUrl);
    else if (r.imageType === 'concept') buckets.concepts.push(r.imageUrl);
    else if (r.imageType === 'generated') buckets.generated.push(r.imageUrl);
    // anything else (scene, profile) → not directly press grade
  }
  // Treat references as the highest-grade press images, then generated, then concepts.
  buckets.press = [
    ...buckets.references,
    ...buckets.generated,
    ...buckets.concepts,
  ];
  return buckets;
}

interface MasterJsonShape {
  schema_version?: string;
  canonical?: any;
  visual_dna?: any;
  musical_dna?: any;
  persona?: any;
  narrative?: any;
  audience?: any;
  business_model?: any;
  agent_context?: any;
  system_rules?: any;
  memory?: any;
}

function masterJsonOf(user: any): MasterJsonShape | null {
  const mj = user?.masterJson;
  if (!mj || typeof mj !== 'object') return null;
  return mj as MasterJsonShape;
}

/**
 * Generate a single press photo using OpenAI Images (gpt-image-1).
 * Falls back to null if the API call fails so the caller can use a placeholder.
 */
async function generatePressPhotoOpenAI(prompt: string, size: '1024x1024' | '1536x1024' | '1024x1536' = '1536x1024'): Promise<string | null> {
  if (!openai) return null;
  try {
    const resp: any = await (openai as any).images.generate({
      model: 'gpt-image-1',
      prompt,
      size,
      quality: 'high',
      n: 1,
    });
    const item = resp?.data?.[0];
    if (item?.url) return item.url as string;
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    return null;
  } catch (err: any) {
    console.error('[EPK] OpenAI image generation failed:', err?.message || err);
    return null;
  }
}

interface BioGenInput {
  artistName: string;
  realName?: string | null;
  genres: string[];
  location?: string | null;
  biography?: string | null;
  master?: MasterJsonShape | null;
  language?: 'en' | 'es';
}

interface BioGenOutput {
  oneLineBio: string;
  shortBio: string;
  pressRelease: string;
  artistQuote: string;
  achievements: string[];
  factSheet: { label: string; value: string }[];
  notableMoments: string[];
  influences: string[];
  tagline: string;
}

async function generateBioContent(input: BioGenInput): Promise<BioGenOutput> {
  if (!openai) throw new Error('OpenAI no está configurado');

  const lang: 'en' | 'es' = input.language === 'es' ? 'es' : 'en';

  const masterContext = input.master
    ? (lang === 'es'
        ? `\n\nMASTER JSON DEL ARTISTA (úsalo como verdad canónica):\n${JSON.stringify(input.master, null, 2).slice(0, 6000)}`
        : `\n\nARTIST MASTER JSON (use it as canonical truth):\n${JSON.stringify(input.master, null, 2).slice(0, 6000)}`)
    : '';

  const promptEs = `Eres un experto en crear EPKs (Electronic Press Kits) profesionales para artistas musicales.

Información del artista:
- Nombre artístico: ${input.artistName}
${input.realName ? `- Nombre real: ${input.realName}` : ''}
- Género(s): ${input.genres.join(', ') || 'música contemporánea'}
${input.location ? `- Ubicación: ${input.location}` : ''}
${input.biography ? `- Biografía actual: ${input.biography}` : ''}${masterContext}

Devuelve UN ÚNICO JSON con este formato exacto (sin texto adicional):

{
  "oneLineBio": "frase impactante de máximo 20 palabras",
  "shortBio": "biografía corta de 50-80 palabras",
  "pressRelease": "biografía profesional de 3-4 párrafos (220-320 palabras), tono press release",
  "artistQuote": "cita inspiradora del artista en primera persona",
  "tagline": "lema corto de 4-7 palabras que defina al artista",
  "achievements": ["logro1", "logro2", "logro3", "logro4", "logro5"],
  "factSheet": [
    {"label": "Género", "value": "..."},
    {"label": "Origen", "value": "..."},
    {"label": "Años activo", "value": "..."},
    {"label": "Sello", "value": "..."},
    {"label": "Influencias", "value": "..."},
    {"label": "Fanbase principal", "value": "..."}
  ],
  "notableMoments": ["3-5 momentos destacados de la carrera o el sonido"],
  "influences": ["3-5 artistas o referencias musicales"]
}

REGLAS:
- TODO el texto DEBE estar escrito en español.
- Coherente con el género y el master JSON si está presente.
- Profesional, sin clichés vacíos.
- Si falta información, infiere de forma creíble; nunca dejes campos vacíos.
- PROHIBIDO incluir como influencias a: Silvio Rodríguez, Pablo Milanés, ni ningún artista de la Nueva Trova Cubana.`;

  const promptEn = `You are an expert at creating professional EPKs (Electronic Press Kits) for music artists.

Artist information:
- Stage name: ${input.artistName}
${input.realName ? `- Real name: ${input.realName}` : ''}
- Genre(s): ${input.genres.join(', ') || 'contemporary music'}
${input.location ? `- Location: ${input.location}` : ''}
${input.biography ? `- Current biography: ${input.biography}` : ''}${masterContext}

Return ONE single JSON with this exact format (no extra text):

{
  "oneLineBio": "punchy phrase, max 20 words",
  "shortBio": "short biography of 50-80 words",
  "pressRelease": "professional biography of 3-4 paragraphs (220-320 words), press-release tone",
  "artistQuote": "inspiring quote from the artist in first person",
  "tagline": "short tagline of 4-7 words that defines the artist",
  "achievements": ["achievement1", "achievement2", "achievement3", "achievement4", "achievement5"],
  "factSheet": [
    {"label": "Genre", "value": "..."},
    {"label": "Origin", "value": "..."},
    {"label": "Years active", "value": "..."},
    {"label": "Label", "value": "..."},
    {"label": "Influences", "value": "..."},
    {"label": "Core fanbase", "value": "..."}
  ],
  "notableMoments": ["3-5 standout moments of the career or the sound"],
  "influences": ["3-5 artists or musical references"]
}

RULES:
- ALL text MUST be written in English.
- Consistent with the genre and the master JSON if present.
- Professional, no empty clichés.
- If information is missing, infer it credibly; never leave fields empty.
- FORBIDDEN to include as influences: Silvio Rodríguez, Pablo Milanés, or any Nueva Trova Cubana artist.`;

  const prompt = lang === 'es' ? promptEs : promptEn;
  const systemPrompt = lang === 'es'
    ? buildSkillsOnlyPrompt('electronic-press-kit', 'Eres un experto en EPKs profesionales. Devuelves SOLO JSON válido.')
    : buildSkillsOnlyPrompt('electronic-press-kit', 'You are an expert in professional EPKs. You return ONLY valid JSON.');

  const result = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });
  const text = result.choices[0]?.message?.content || '{}';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('La IA no devolvió JSON válido');
  const parsed = JSON.parse(match[0]);
  return {
    oneLineBio: parsed.oneLineBio || '',
    shortBio: parsed.shortBio || '',
    pressRelease: parsed.pressRelease || input.biography || '',
    artistQuote: parsed.artistQuote || '',
    tagline: parsed.tagline || '',
    achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    factSheet: Array.isArray(parsed.factSheet) ? parsed.factSheet : [],
    notableMoments: Array.isArray(parsed.notableMoments) ? parsed.notableMoments : [],
    influences: Array.isArray(parsed.influences)
      ? parsed.influences.filter((inf: string) =>
          !/(silvio\s*rodr[ií]gu[e]z|pablo\s*milan[eé]s|nueva\s*trova)/i.test(inf)
        )
      : [],
  };
}

// ───────────────────────────────────────────────────────────────────────
// POST /api/epk/generate
// Builds (or rebuilds) the EPK for an artist and persists it.
// ───────────────────────────────────────────────────────────────────────
router.post('/generate', authenticate, async (req: Request, res: Response) => {
  try {
    if (!openai) {
      return res.status(503).json({ success: false, message: 'OpenAI no está configurado' });
    }

    const clerkUserId = (req as any).user?.id as string | undefined;
    const userEmail = (req as any).user?.email as string | undefined;
    if (!clerkUserId) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }
    const isAdmin = isAdminEmail(userEmail);

    // Resolve the requesting user's PG id
    const [requester] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    // Resolve the target artist (own profile or :artistId)
    const { artistId, language } = req.body || {};
    const epkLang: 'en' | 'es' = String(language || '').toLowerCase() === 'es' ? 'es' : 'en';
    let targetUser: any = null;

    if (artistId) {
      const numericId = Number.parseInt(String(artistId));
      if (!Number.isNaN(numericId)) {
        [targetUser] = await db.select().from(users).where(eq(users.id, numericId)).limit(1);
      }
      if (!targetUser) {
        [targetUser] = await db.select().from(users).where(eq(users.firestoreId, String(artistId))).limit(1);
      }
    } else {
      [targetUser] = await db.select().from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
    }
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Artista no encontrado' });
    }

    const isOwner = targetUser.clerkId === clerkUserId;
    const isGenerator = !!(requester?.id && targetUser.generatedBy === requester.id);
    if (!isAdmin && !isOwner && !isGenerator) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para generar este EPK' });
    }

    const master = masterJsonOf(targetUser);
    const canonical = master?.canonical || {};
    const artistName: string = targetUser.artistName || canonical.artist_name || (targetUser.email?.split('@')[0]) || 'Artista';
    const genres: string[] = (targetUser.genres && targetUser.genres.length ? targetUser.genres : (master?.musical_dna?.secondary_genres || [])).slice(0, 6);
    if (master?.musical_dna?.primary_genre && !genres.includes(master.musical_dna.primary_genre)) {
      genres.unshift(master.musical_dna.primary_genre);
    }
    const location: string | undefined = targetUser.location || canonical.city_of_origin || undefined;
    const biography: string | undefined = targetUser.biography || canonical.biography_long || canonical.biography_short || undefined;

    console.log(`[EPK] Generating for artist=${artistName} (id=${targetUser.id}) — masterJson=${!!master}`);

    // 1) Generate textual content with OpenAI (master JSON aware)
    const bio = await generateBioContent({
      artistName,
      realName: targetUser.realName,
      genres,
      location,
      biography,
      master,
      language: epkLang,
    });

    // 2) Recycle images from DB
    const dbImages = await loadDbImagesForUser(targetUser.id);

    // 3) Pick main song / video from songs table (fast + reliable)
    let mainSong: { name: string; url: string } | undefined;
    const tracks: EPKTrack[] = [];
    try {
      const topSongs = await db
        .select()
        .from(songs)
        .where(eq(songs.userId, targetUser.id))
        .orderBy(desc(songs.isSingle), desc(songs.plays), desc(songs.createdAt))
        .limit(6);
      for (const s of topSongs) {
        if (!s.audioUrl || String(s.audioUrl).startsWith('ipfs://')) continue;
        tracks.push({
          title: s.title || 'Untitled',
          audioUrl: s.audioUrl,
          coverArt: s.coverArt || undefined,
          duration: s.duration || undefined,
          genre: s.genre || undefined,
          releaseDate: s.releaseDate ? new Date(s.releaseDate as any).toISOString() : undefined,
          plays: s.plays || 0,
          isFeatured: !!s.isSingle,
        });
      }
      const featured = tracks.find((t) => t.isFeatured) || tracks[0];
      if (featured) mainSong = { name: featured.title, url: featured.audioUrl };
    } catch (e) {
      console.warn('[EPK] Could not fetch songs:', (e as any)?.message);
    }

    // 3b) Load published videos (artist_media + loopVideoUrl)
    const videos: EPKVideo[] = [];
    try {
      const mediaRows = await db
        .select()
        .from(artistMedia)
        .where(and(eq(artistMedia.userId, targetUser.id), eq(artistMedia.isPublished, true)))
        .orderBy(desc(artistMedia.createdAt))
        .limit(4);
      for (const m of mediaRows) {
        if (!m.storagePath) continue;
        videos.push({
          title: m.title || 'Performance',
          url: m.storagePath,
          thumbnail: m.thumbnail || undefined,
          description: m.description || undefined,
        });
      }
    } catch (e) {
      console.warn('[EPK] Could not fetch artist videos:', (e as any)?.message);
    }
    if (targetUser.loopVideoUrl && !videos.some((v) => v.url === targetUser.loopVideoUrl)) {
      videos.unshift({ title: 'Profile Loop', url: targetUser.loopVideoUrl, isLoop: true });
    }

    // 4) Build press photos cascade: DB first → fill with OpenAI gpt-image-1
    // We aim for up to 5 distinct press photos so the gallery isn't monotonous,
    // pulling as many unique images as the artist already has in the DB before
    // falling back to AI generation for any remaining slots.
    const pressPhotos: EPKPressPhoto[] = [];
    const dbPool = Array.from(
      new Set([...dbImages.press, ...dbImages.banners].filter(isImageUrl))
    );
    const captions = [
      'Hero Portrait',
      'Performance Shot',
      'Editorial Session',
      'Backstage Moment',
      'Studio Session',
    ];

    // Real photos of THIS artist, used as identity references so the AI keeps
    // the same face/person instead of inventing a different artist.
    const artistReferenceImages = Array.from(
      new Set(
        [
          targetUser.profileImage,
          targetUser.profileImageUrl,
          ...dbImages.references,
          ...dbImages.generated,
          targetUser.coverImage,
          ...dbImages.concepts,
        ].filter(isImageUrl)
      )
    ).slice(0, 4);

    for (let i = 0; i < captions.length; i++) {
      if (dbPool[i]) {
        pressPhotos.push({ url: dbPool[i], caption: captions[i], source: 'db' });
      } else {
        const visualHint = master?.visual_dna?.aesthetic
          || master?.visual_dna?.image_prompt_base
          || `${genres[0] || 'modern'} music artist, professional press kit photography`;
        const fashion = (master?.visual_dna?.fashion_keywords || []).join(', ');
        const physical = master?.visual_dna?.physical_description || '';
        // Identity-locked prompts: when we have reference photos we instruct the
        // model to preserve the EXACT same person/face from the references.
        const identityLock = artistReferenceImages.length
          ? `Keep the EXACT same person, face, facial features, skin tone, hair and identity as shown in the reference photo(s) of ${artistName}. Do NOT invent a different person. `
          : '';
        const promptVariants = [
          `${identityLock}Professional EPK hero portrait of ${artistName}, ${physical}, ${visualHint}, ${fashion}, magazine cover quality, dramatic studio lighting, sharp focus, photorealistic`,
          `${identityLock}${artistName} performing on stage as ${genres[0] || 'music'} artist, ${visualHint}, ${fashion}, dynamic energy, professional concert photography, photojournalism style, photorealistic`,
          `${identityLock}Editorial press session of ${artistName}, ${physical}, ${visualHint}, ${fashion}, creative composition, fashion magazine spread quality, photorealistic`,
          `${identityLock}Candid backstage moment of ${artistName}, ${physical}, ${visualHint}, ${fashion}, intimate behind-the-scenes atmosphere, natural lighting, documentary photography, photorealistic`,
          `${identityLock}${artistName} in a recording studio, ${physical}, ${visualHint}, ${fashion}, working at the mixing console with microphones, warm ambient lighting, lifestyle music photography, photorealistic`,
        ];
        const promptForSlot = promptVariants[i] || promptVariants[0];

        let aiUrl: string | null = null;
        // 1) Preferred: gpt-image-1 EDIT with the artist's real photos → keeps likeness.
        if (artistReferenceImages.length) {
          try {
            const edit = await editImageWithGPTImage1(artistReferenceImages, promptForSlot, {
              size: '1536x1024',
              quality: 'high',
              outputFolder: 'epk-press',
            });
            if (edit?.success && edit.imageUrl) aiUrl = edit.imageUrl;
          } catch (e) {
            console.warn('[EPK] gpt-image-1 edit failed, falling back to text-to-image:', (e as any)?.message);
          }
        }
        // 2) Fallback: pure text-to-image (no likeness) only if no references / edit failed.
        if (!aiUrl) {
          aiUrl = await generatePressPhotoOpenAI(promptForSlot, '1536x1024');
        }

        if (aiUrl) {
          pressPhotos.push({ url: aiUrl, caption: captions[i], source: 'openai' });
        } else {
          const fallbackUrl = [targetUser.coverImage, targetUser.profileImage].find(isImageUrl) || '';
          pressPhotos.push({
            url: fallbackUrl,
            caption: captions[i],
            source: 'fallback',
          });
        }
      }
    }

    // 4b) Build a wider photo gallery (dedupe against pressPhotos URLs)
    const usedUrls = new Set(pressPhotos.map((p) => p.url));
    const gallerySource = [
      ...dbImages.references,
      ...dbImages.generated,
      ...dbImages.concepts,
      ...dbImages.banners,
    ].filter(isImageUrl);
    const gallery: string[] = [];
    for (const u of gallerySource) {
      if (usedUrls.has(u)) continue;
      gallery.push(u);
      usedUrls.add(u);
      if (gallery.length >= 12) break;
    }

    // 4c) Technical sheet (band/live setup) sourced from masterJson
    const persona = (master as any)?.persona || {};
    const live = (master as any)?.business_model?.live || (master as any)?.business_model?.live_show || {};
    const musical = (master as any)?.musical_dna || {};
    const memberList: EPKBandMember[] = Array.isArray(persona?.band_members)
      ? persona.band_members
          .map((m: any) => (typeof m === 'string'
            ? { name: m, role: '' }
            : { name: m?.name || '', role: m?.role || m?.instrument || '' }))
          .filter((m: any) => m.name)
      : [];
    const technicalSheet: EPKTechnicalSheet = {
      bandSize: persona?.band_size || (memberList.length ? `${memberList.length}-piece` : undefined),
      members: memberList.length ? memberList : undefined,
      instrumentation: Array.isArray(musical?.instrumentation) ? musical.instrumentation.slice(0, 12) : undefined,
      liveSetupDuration: live?.set_duration || live?.duration || undefined,
      vocalRange: musical?.vocal_range || persona?.vocal_range || undefined,
      primaryKey: musical?.primary_key || musical?.key || undefined,
      bpmRange: musical?.bpm_range || (musical?.bpm ? String(musical.bpm) : undefined),
      language: Array.isArray(musical?.languages) ? musical.languages.slice(0, 4) : undefined,
      influencesShort: (Array.isArray(musical?.influences) ? musical.influences.slice(0, 5).join(' · ') : undefined),
      preferredVenues: live?.preferred_venues || live?.venues || undefined,
      technicalRider: Array.isArray(live?.technical_rider) ? live.technical_rider.slice(0, 8) : undefined,
      hospitalityRider: Array.isArray(live?.hospitality_rider) ? live.hospitality_rider.slice(0, 6) : undefined,
    };
    // Drop empty fields
    Object.keys(technicalSheet).forEach((k) => {
      const v = (technicalSheet as any)[k];
      if (v == null || (Array.isArray(v) && v.length === 0) || v === '') delete (technicalSheet as any)[k];
    });

    // 5) Contacts
    const contacts: EPKContact[] = [
      { label: 'Booking & Press', name: artistName, email: targetUser.email || undefined, phone: targetUser.phone || undefined },
    ];

    // 6) Compose final EPK doc
    const baseUrl = getBaseUrl(req);
    const slug = buildEpkSlug(artistName, targetUser.id);

    const epkData: EPKData = {
      artistName,
      realName: targetUser.realName || canonical.real_name || undefined,
      tagline: canonical.tagline || bio.tagline,
      genre: genres,
      location,
      nationality: canonical.nationality,

      oneLineBio: bio.oneLineBio,
      shortBio: bio.shortBio,
      pressRelease: bio.pressRelease,
      artistQuote: bio.artistQuote,

      achievements: bio.achievements,
      factSheet: bio.factSheet,
      influences: bio.influences,
      notableMoments: bio.notableMoments,

      profileImage: [targetUser.profileImage, targetUser.profileImageUrl].find(isImageUrl) || undefined,
      coverImage: [targetUser.coverImage, dbImages.banners[0], dbImages.references[0], dbImages.generated[0]].find(isImageUrl) || undefined,
      referenceImage: dbImages.references[0],
      pressPhotos,
      gallery,

      mainSong,
      mainVideo: videos[0] ? { title: videos[0].title, url: videos[0].url } : undefined,
      tracks,
      videos,

      technicalSheet: Object.keys(technicalSheet).length ? technicalSheet : undefined,

      contacts,

      socialLinks: {
        spotify: targetUser.spotifyUrl || undefined,
        instagram: targetUser.instagramHandle ? `https://instagram.com/${String(targetUser.instagramHandle).replace(/^@/, '')}` : undefined,
        facebook: targetUser.facebookUrl || undefined,
        tiktok: targetUser.tiktokUrl || undefined,
        youtube: targetUser.youtubeChannel || undefined,
        website: targetUser.website || undefined,
      },
      boostifyLinks: {
        profile: targetUser.slug ? `${baseUrl}/artist/${targetUser.slug}` : undefined,
        epk: `${baseUrl}/api/epk/${slug}/html`,
      },

      meta: {
        builtFromMasterJson: !!master,
        masterJsonVersion: master?.schema_version,
        generatedAt: new Date().toISOString(),
        language: epkLang,
      },
    };

    // 7) Persist (upsert by userId)
    const [existing] = await db
      .select()
      .from(artistEpks)
      .where(eq(artistEpks.userId, targetUser.id))
      .limit(1);

    if (existing) {
      await db
        .update(artistEpks)
        .set({
          slug,
          epkData: epkData as any,
          masterSnapshot: (master as any) || null,
          version: (existing.version || 1) + 1,
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(artistEpks.id, existing.id));
    } else {
      await db.insert(artistEpks).values({
        userId: targetUser.id,
        slug,
        epkData: epkData as any,
        masterSnapshot: (master as any) || null,
        version: 1,
        isPublic: true,
      });
    }

    return res.json({ success: true, epk: epkData, slug });
  } catch (error: any) {
    console.error('[EPK GENERATE ERROR]', error);
    return res.status(500).json({ success: false, message: error?.message || 'Error al generar EPK' });
  }
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/epk/by-artist/:artistId
// Returns the persisted EPK for an artist (owner/admin/anyone-public).
// ───────────────────────────────────────────────────────────────────────
router.get('/by-artist/:artistId', async (req: Request, res: Response) => {
  try {
    const numericId = Number.parseInt(req.params.artistId);
    if (Number.isNaN(numericId)) return res.status(400).json({ success: false, message: 'artistId inválido' });
    const [row] = await db
      .select()
      .from(artistEpks)
      .where(eq(artistEpks.userId, numericId))
      .limit(1);
    if (!row) return res.status(404).json({ success: false, message: 'EPK no generado' });
    return res.json({ success: true, epk: row.epkData, slug: row.slug, version: row.version, generatedAt: row.generatedAt });
  } catch (err: any) {
    console.error('[EPK BY-ARTIST ERROR]', err);
    return res.status(500).json({ success: false, message: 'Error al obtener EPK' });
  }
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/epk/:slug/html  →  Public, print-friendly press kit page.
// Browser "Save as PDF" works flawlessly with the @media print rules.
// ───────────────────────────────────────────────────────────────────────
router.get('/:slug/html', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const [row] = await db
      .select()
      .from(artistEpks)
      .where(eq(artistEpks.slug, slug))
      .limit(1);
    if (!row || !row.isPublic) {
      // No public EPK for this slug. Rather than dead-ending on an "EPK not
      // found" page (e.g. a profile "Listen Now" CTA whose EPK was never
      // generated), send the visitor to the artist's public profile.
      if (slug) {
        res.redirect(302, `/artist/${encodeURIComponent(slug)}`);
        return;
      }
      res.status(404).type('html').send('<h1>EPK not found</h1>');
      return;
    }
    // Increment view counter best-effort
    db.update(artistEpks)
      .set({ views: (row.views || 0) + 1, lastViewedAt: new Date() })
      .where(eq(artistEpks.id, row.id))
      .catch(() => {});

    const epk = row.epkData as EPKData;
    res.type('html').send(renderEpkHtml(epk, slug));
  } catch (err: any) {
    console.error('[EPK HTML ERROR]', err);
    res.status(500).type('html').send('<h1>Error rendering EPK</h1>');
  }
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/epk/preview/:userId — basic info (no AI) for previews.
// (Kept for backward compatibility with existing UI.)
// ───────────────────────────────────────────────────────────────────────
router.get('/preview/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (Number.isNaN(userId)) return res.status(400).json({ success: false, message: 'userId inválido' });
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({
      success: true,
      epk: {
        artistName: user.artistName || user.email?.split('@')[0] || 'Artista',
        realName: user.realName || undefined,
        genre: user.genres || [],
        location: user.location || undefined,
        biography: user.biography || '',
        profileImage: user.profileImage || user.profileImageUrl || undefined,
        coverImage: user.coverImage || undefined,
        socialLinks: {
          spotify: user.spotifyUrl || undefined,
          instagram: user.instagramHandle || undefined,
          facebook: user.facebookUrl || undefined,
          tiktok: user.tiktokUrl || undefined,
          youtube: user.youtubeChannel || undefined,
          website: user.website || undefined,
        },
      },
    });
  } catch (err: any) {
    console.error('[EPK PREVIEW ERROR]', err);
    res.status(500).json({ success: false, message: 'Error al obtener vista previa del EPK' });
  }
});

// ───────────────────────────────────────────────────────────────────────
// HTML template (zero-deps, print-optimized)
// ───────────────────────────────────────────────────────────────────────
function escapeHtml(value: any): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEpkHtml(epk: EPKData, slug: string): string {
  const safe = escapeHtml;
  // Drop any URL that isn't a still image (e.g. .mp4 banners persisted from
  // earlier EPK generations) so the press kit never embeds a video as a photo.
  const coverCandidate = [epk.coverImage, epk.profileImage, epk.pressPhotos?.[0]?.url].find(isImageUrl) || '';
  const cover = safe(coverCandidate);
  // Deduplicate: track all URLs already shown so nothing repeats
  const usedUrls = new Set<string>();
  if (coverCandidate) usedUrls.add(coverCandidate);
  const photos = (epk.pressPhotos || [])
    .filter((p) => isImageUrl(p.url) && !usedUrls.has(p.url))
    .map((p) => { usedUrls.add(p.url); return p; });
  const gallery = (epk.gallery || [])
    .filter((url) => isImageUrl(url) && !usedUrls.has(url))
    .map((url) => { usedUrls.add(url); return url; });
  const tracks = (epk.tracks || []).filter((t) => t && t.audioUrl);
  const videos = (epk.videos || []).filter((v) => v && v.url);
  const tech = epk.technicalSheet || {};
  const social = epk.socialLinks || {};
  const socialEntries = Object.entries(social).filter(([, v]) => !!v);
  const factSheet = epk.factSheet || [];
  const achievements = epk.achievements || [];
  const contacts = epk.contacts || [];
  const profileUrl = epk.boostifyLinks?.profile || '';
  const generatedAt = epk.meta?.generatedAt ? new Date(epk.meta.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  const formatPlays = (n?: number) => {
    if (!n || n < 1000) return n ? String(n) : '';
    if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  };
  const formatDate = (iso?: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }); } catch { return ''; }
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>${safe(epk.artistName)} — Electronic Press Kit</title>
  <meta name="description" content="${safe(epk.oneLineBio || epk.shortBio || `Press kit for ${epk.artistName}`)}" />
  <!-- Open Graph (Facebook, LinkedIn, WhatsApp) -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Boostify Music" />
  <meta property="og:url" content="${safe(epk.boostifyLinks?.epk || '')}" />
  <meta property="og:title" content="${safe(epk.artistName)} — Electronic Press Kit" />
  <meta property="og:description" content="${safe(epk.oneLineBio || epk.shortBio || `Official EPK for ${epk.artistName} · ${(epk.genre || []).slice(0,3).join(', ')}`)}" />
  ${coverCandidate ? `<meta property="og:image" content="${safe(coverCandidate)}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta property="og:image:alt" content="${safe(epk.artistName)} Press Kit" />` : ''}
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safe(epk.artistName)} — Electronic Press Kit" />
  <meta name="twitter:description" content="${safe(epk.oneLineBio || epk.shortBio || '')}" />
  ${coverCandidate ? `<meta name="twitter:image" content="${safe(coverCandidate)}" />` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:#08080c; --fg:#fff; --muted:#a8a8b3; --accent:#ea580c; --line:rgba(255,255,255,0.08);
    }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
    a{color:inherit}
    img{max-width:100%;display:block}
    .wrap{max-width:1100px;margin:0 auto;padding:0 24px}
    .toolbar{position:sticky;top:0;z-index:10;background:rgba(8,8,12,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--line);padding:10px 0}
    .toolbar .wrap{display:flex;justify-content:space-between;align-items:center;gap:8px;min-width:0}
    .brand{font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:11px;color:var(--muted);white-space:nowrap;flex-shrink:0}
    .actions{display:flex;gap:6px;align-items:center;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:1px;flex-shrink:1;min-width:0}
    .actions::-webkit-scrollbar{display:none}
    .btn{appearance:none;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#fff;padding:7px 13px;border-radius:999px;font-weight:600;font-size:12px;cursor:pointer;transition:all .2s;text-decoration:none;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;flex-shrink:0}
    .btn:hover{background:rgba(255,255,255,0.14);transform:translateY(-1px)}
    .btn-primary{background:var(--accent);border-color:var(--accent)}
    .btn-primary:hover{background:#ff7a2e}
    @media(max-width:640px){.brand{display:none}.btn{padding:6px 11px;font-size:11px}}

    .hero{position:relative;min-height:85vh;display:flex;align-items:center;overflow:hidden;border-bottom:1px solid var(--line)}
    .hero-bg{position:absolute;inset:0;background:#000}
    .hero-bg img{width:100%;height:100%;object-fit:cover;object-position:center top;opacity:.22;filter:blur(28px) saturate(0.5);transform:scale(1.1)}
    .hero-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(160deg,rgba(8,8,12,0.25) 0%,rgba(8,8,12,0.65) 60%,rgba(8,8,12,1) 100%)}
    .hero-inner{position:relative;padding:80px 0;display:flex;gap:52px;align-items:center;width:100%}
    .hero-photo{flex-shrink:0;width:260px;height:340px;border-radius:22px;overflow:hidden;border:1px solid rgba(255,255,255,0.18);box-shadow:0 28px 72px rgba(0,0,0,0.75),0 0 0 1px rgba(255,255,255,0.06)}
    .hero-photo img{width:100%;height:100%;object-fit:cover;object-position:center top}
    .hero-text{flex:1;min-width:0}
    .eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--muted);margin-bottom:18px}
    h1.name{font-family:'Playfair Display',serif;font-size:clamp(40px,6vw,96px);line-height:.95;font-weight:900;letter-spacing:-0.02em;margin:0 0 18px}
    @media(max-width:700px){.hero-inner{flex-direction:column;align-items:flex-start;padding:60px 0 40px;gap:28px}.hero-photo{width:100%;height:260px;border-radius:16px}h1.name{font-size:clamp(36px,10vw,72px)}}
    .tagline{font-size:clamp(16px,2vw,22px);color:#fff;opacity:.85;max-width:720px;line-height:1.4;margin:0 0 14px}
    .meta-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
    .chip{display:inline-flex;align-items:center;padding:6px 12px;border:1px solid var(--line);border-radius:999px;font-size:12px;color:#fff;background:rgba(255,255,255,0.05)}

    section.block{padding:64px 0;border-bottom:1px solid var(--line)}
    section.block h2{font-family:'Playfair Display',serif;font-size:clamp(28px,4vw,42px);margin:0 0 8px;font-weight:700;letter-spacing:-0.01em}
    section.block .section-sub{color:var(--muted);font-size:13px;letter-spacing:.16em;text-transform:uppercase;margin:0 0 24px}
    .grid{display:grid;gap:24px}
    .grid-2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
    .grid-3{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}

    .quote{font-family:'Playfair Display',serif;font-size:clamp(22px,3vw,34px);font-style:italic;line-height:1.35;color:#fff;border-left:3px solid var(--accent);padding-left:24px;max-width:820px}

    .bio-prose{max-width:820px;font-size:17px;line-height:1.75;color:#dcdce0}
    .bio-prose p{margin:0 0 1em}
    .bio-prose p:first-of-type::first-letter{font-family:'Playfair Display',serif;font-size:64px;line-height:.85;float:left;margin:6px 12px 0 0;color:var(--accent);font-weight:900}

    .fact{display:flex;justify-content:space-between;gap:18px;padding:14px 0;border-bottom:1px dashed var(--line);font-size:14px}
    .fact .label{color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-size:11px}
    .fact .value{font-weight:500;text-align:right}

    .achievements{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
    .ach-card{padding:18px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,0.03)}
    .ach-card .num{color:var(--accent);font-size:11px;letter-spacing:.2em;font-weight:700;margin-bottom:8px}

    .photo-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
    .photo{position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--line);background:#111;min-height:200px;max-height:420px}
    .photo img{width:100%;height:100%;object-fit:contain;object-position:center center;background:#111;display:block;max-height:420px}
    .photo .cap{position:absolute;left:12px;bottom:10px;font-size:11px;color:#fff;background:rgba(0,0,0,0.55);padding:4px 10px;border-radius:999px;backdrop-filter:blur(8px)}

    .gallery-grid{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
    .gallery-item{aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#111;border:1px solid var(--line)}
    .gallery-item img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
    .gallery-item:hover img{transform:scale(1.05)}

    .video-card{position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--line);background:#000}
    .video-card video{width:100%;display:block;background:#000;max-height:80vh}
    .video-card .v-meta{padding:14px 18px;display:flex;justify-content:space-between;gap:12px;align-items:center;background:rgba(255,255,255,0.03)}
    .video-card .v-title{font-weight:600;font-size:14px}
    .video-card .v-desc{font-size:12px;color:var(--muted);margin-top:4px}

    .track-list{display:grid;gap:10px}
    .track{display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,0.03)}
    .track .cover{width:64px;height:64px;border-radius:8px;background:#222;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--muted)}
    .track .cover img{width:100%;height:100%;object-fit:cover}
    .track .meta{min-width:0}
    .track .t-title{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .track .t-sub{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-top:3px}
    .track audio{height:34px}
    @media (max-width: 640px){
      .track{grid-template-columns:48px 1fr;grid-template-rows:auto auto}
      .track .cover{width:48px;height:48px}
      .track audio{grid-column:1 / -1;width:100%}
    }

    .audio-card{display:flex;align-items:center;gap:18px;padding:18px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,0.03)}
    .audio-card audio{flex:1;width:100%}

    .members{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:20px}
    .member{padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,0.03)}
    .member .m-name{font-weight:600;font-size:14px}
    .member .m-role{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--accent);margin-top:3px}

    .rider{margin-top:16px}
    .rider h4{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin:18px 0 8px;font-weight:600}
    .rider ul{margin:0;padding:0 0 0 20px;font-size:14px;line-height:1.7;color:#dcdce0}

    .links{display:flex;flex-wrap:wrap;gap:10px}
    .links a{padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.06);border:1px solid var(--line);text-decoration:none;font-size:13px}
    .links a:hover{background:rgba(255,255,255,0.12)}
    .links a.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}

    footer{padding:40px 0;color:var(--muted);font-size:12px;text-align:center}
    .footer-brand{font-weight:700;letter-spacing:.18em;text-transform:uppercase}

    @media print {
      .toolbar{display:none}
      html,body{background:#fff !important;color:#111 !important}
      :root{--bg:#fff;--fg:#111;--muted:#555;--line:rgba(0,0,0,0.08)}
      .hero{min-height:auto;border-bottom-color:#ddd}
      .hero-bg img{opacity:1;filter:none}
      .hero-bg::after{background:none}
      .hero-inner{padding:36px 0}
      h1.name{color:#111;text-shadow:none}
      .chip{color:#111;background:#f3f3f3;border-color:#ddd}
      section.block{padding:32px 0;page-break-inside:avoid}
      .quote{color:#111}
      .ach-card,.audio-card,.photo,.links a,.video-card,.track,.member,.gallery-item{background:#fff;border-color:#ddd}
      .links a{color:#111}
      .links a.primary{color:#fff}
      .video-card video{display:none}
      a{color:#111;text-decoration:none}
      .bio-prose{color:#111}
      .bio-prose p:first-of-type::first-letter{color:var(--accent)}
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="wrap">
      <div class="brand">Boostify · Electronic Press Kit</div>
      <div class="actions">
        ${profileUrl ? `<a class="btn" href="${safe(profileUrl)}" target="_blank" rel="noopener">↗ Profile</a>` : ''}
        <button class="btn" onclick="(function(b){if(navigator.share){navigator.share({title:document.title,url:location.href})}else{navigator.clipboard.writeText(location.href).then(function(){b.textContent='✓ Copied';setTimeout(function(){b.textContent='Copy Link'},2000)},function(){prompt('Copy:',location.href)})}})(this)">Copy Link</button>
        ${epk.boostifyLinks?.epk ? `<a class="btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(epk.boostifyLinks.epk)}" target="_blank" rel="noopener noreferrer" style="background:rgba(24,119,242,0.18);border-color:rgba(24,119,242,0.45)">f Share</a>` : ''}
        <button class="btn btn-primary" onclick="window.print()">⬇ PDF</button>
      </div>
    </div>
  </div>

  <header class="hero">
    <div class="hero-bg">${cover ? `<img src="${cover}" alt="" />` : ''}</div>
    <div class="wrap hero-inner">
      ${cover ? `<div class="hero-photo"><img src="${cover}" alt="${safe(epk.artistName)}" /></div>` : ''}
      <div class="hero-text">
        <div class="eyebrow">Electronic Press Kit</div>
        <h1 class="name">${safe(epk.artistName)}</h1>
        ${epk.tagline ? `<p class="tagline">${safe(epk.tagline)}</p>` : ''}
        ${epk.oneLineBio ? `<p class="tagline" style="opacity:.7">${safe(epk.oneLineBio)}</p>` : ''}
        <div class="meta-row">
          ${(epk.genre || []).map((g) => `<span class="chip">${safe(g)}</span>`).join('')}
          ${epk.location ? `<span class="chip">📍 ${safe(epk.location)}</span>` : ''}
          ${epk.nationality ? `<span class="chip">🌐 ${safe(epk.nationality)}</span>` : ''}
          ${tech.bandSize ? `<span class="chip">🎸 ${safe(tech.bandSize)}</span>` : ''}
        </div>
      </div>
    </div>
  </header>

  ${epk.pressRelease ? `
  <section class="block">
    <div class="wrap">
      <h2>Biography</h2>
      <div class="section-sub">Official Press Release</div>
      <div class="bio-prose">
        ${epk.pressRelease.split(/\n\n+/).map((p) => `<p>${safe(p)}</p>`).join('')}
      </div>
    </div>
  </section>` : ''}

  ${epk.artistQuote ? `
  <section class="block">
    <div class="wrap">
      <p class="quote">"${safe(epk.artistQuote)}"</p>
      <div class="section-sub" style="margin-top:14px">— ${safe(epk.artistName)}</div>
    </div>
  </section>` : ''}

  ${videos.length ? `
  <section class="block">
    <div class="wrap">
      <h2>Featured Video</h2>
      <div class="section-sub">Performance · Visual identity</div>
      <div class="video-card">
        <video controls preload="metadata" ${videos[0].thumbnail && isImageUrl(videos[0].thumbnail) ? `poster="${safe(videos[0].thumbnail!)}"` : ''} ${videos[0].isLoop ? 'loop muted playsinline' : ''} src="${safe(videos[0].url)}"></video>
        <div class="v-meta">
          <div>
            <div class="v-title">${safe(videos[0].title)}</div>
            ${videos[0].description ? `<div class="v-desc">${safe(videos[0].description)}</div>` : ''}
          </div>
          ${videos.length > 1 ? `<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.14em">+ ${videos.length - 1} more</div>` : ''}
        </div>
      </div>
      ${videos.length > 1 ? `<div class="grid grid-3" style="margin-top:14px">${videos.slice(1, 4).map((v) => `
        <div class="video-card">
          <video controls preload="none" ${v.thumbnail && isImageUrl(v.thumbnail) ? `poster="${safe(v.thumbnail!)}"` : ''} src="${safe(v.url)}"></video>
          <div class="v-meta"><div class="v-title">${safe(v.title)}</div></div>
        </div>`).join('')}</div>` : ''}
    </div>
  </section>` : ''}

  ${tracks.length ? `
  <section class="block">
    <div class="wrap">
      <h2>Music</h2>
      <div class="section-sub">${tracks.length} ${tracks.length === 1 ? 'track' : 'featured tracks'}</div>
      <div class="track-list">
        ${tracks.map((t) => {
          const isImg = isImageUrl(t.coverArt);
          const subParts: string[] = [];
          if (t.isFeatured) subParts.push('★ Featured Single');
          if (t.genre) subParts.push(safe(t.genre));
          if (t.duration) subParts.push(safe(t.duration));
          if (t.releaseDate) subParts.push(safe(formatDate(t.releaseDate)));
          if (t.plays) subParts.push(`${formatPlays(t.plays)} plays`);
          return `<div class="track">
            <div class="cover">${isImg ? `<img src="${safe(t.coverArt!)}" alt="${safe(t.title)}" />` : '🎵'}</div>
            <div class="meta">
              <div class="t-title">${safe(t.title)}</div>
              <div class="t-sub">${subParts.join(' · ')}</div>
            </div>
            <audio controls preload="none" src="${safe(t.audioUrl)}"></audio>
          </div>`;
        }).join('')}
      </div>
    </div>
  </section>` : (epk.mainSong ? `
  <section class="block">
    <div class="wrap">
      <h2>Featured Track</h2>
      <div class="audio-card">
        <div style="font-weight:600">${safe(epk.mainSong.name)}</div>
        <audio controls preload="none" src="${safe(epk.mainSong.url)}"></audio>
      </div>
    </div>
  </section>` : '')}

  ${factSheet.length ? `
  <section class="block">
    <div class="wrap">
      <h2>Fact Sheet</h2>
      <div class="section-sub">Quick reference</div>
      <div class="grid grid-2">
        <div>
          ${factSheet.slice(0, Math.ceil(factSheet.length / 2)).map((f) => `<div class="fact"><span class="label">${safe(f.label)}</span><span class="value">${safe(f.value)}</span></div>`).join('')}
        </div>
        <div>
          ${factSheet.slice(Math.ceil(factSheet.length / 2)).map((f) => `<div class="fact"><span class="label">${safe(f.label)}</span><span class="value">${safe(f.value)}</span></div>`).join('')}
        </div>
      </div>
    </div>
  </section>` : ''}

  ${(tech.members?.length || tech.instrumentation?.length || tech.bpmRange || tech.vocalRange || tech.technicalRider?.length) ? `
  <section class="block">
    <div class="wrap">
      <h2>Technical Sheet</h2>
      <div class="section-sub">Live setup · Rider · Musical specs</div>
      <div class="grid grid-2" style="margin-top:8px">
        <div>
          ${tech.bandSize ? `<div class="fact"><span class="label">Band Size</span><span class="value">${safe(tech.bandSize)}</span></div>` : ''}
          ${tech.liveSetupDuration ? `<div class="fact"><span class="label">Set Duration</span><span class="value">${safe(tech.liveSetupDuration)}</span></div>` : ''}
          ${tech.bpmRange ? `<div class="fact"><span class="label">BPM Range</span><span class="value">${safe(tech.bpmRange)}</span></div>` : ''}
          ${tech.primaryKey ? `<div class="fact"><span class="label">Primary Key</span><span class="value">${safe(tech.primaryKey)}</span></div>` : ''}
          ${tech.vocalRange ? `<div class="fact"><span class="label">Vocal Range</span><span class="value">${safe(tech.vocalRange)}</span></div>` : ''}
          ${tech.language?.length ? `<div class="fact"><span class="label">Languages</span><span class="value">${safe(tech.language.join(', '))}</span></div>` : ''}
          ${tech.preferredVenues ? `<div class="fact"><span class="label">Preferred Venues</span><span class="value">${safe(tech.preferredVenues)}</span></div>` : ''}
          ${tech.influencesShort ? `<div class="fact"><span class="label">Influences</span><span class="value">${safe(tech.influencesShort)}</span></div>` : ''}
        </div>
        <div>
          ${tech.instrumentation?.length ? `<div class="fact"><span class="label">Instrumentation</span><span class="value" style="text-align:right">${safe(tech.instrumentation.join(', '))}</span></div>` : ''}
        </div>
      </div>
      ${tech.members?.length ? `
      <h4 style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin:32px 0 0">Band Members</h4>
      <div class="members">
        ${tech.members.map((m) => `<div class="member"><div class="m-name">${safe(m.name)}</div>${m.role ? `<div class="m-role">${safe(m.role)}</div>` : ''}</div>`).join('')}
      </div>` : ''}
      ${(tech.technicalRider?.length || tech.hospitalityRider?.length) ? `
      <div class="rider">
        ${tech.technicalRider?.length ? `<h4>Technical Rider</h4><ul>${tech.technicalRider.map((r) => `<li>${safe(r)}</li>`).join('')}</ul>` : ''}
        ${tech.hospitalityRider?.length ? `<h4>Hospitality Rider</h4><ul>${tech.hospitalityRider.map((r) => `<li>${safe(r)}</li>`).join('')}</ul>` : ''}
      </div>` : ''}
    </div>
  </section>` : ''}

  ${achievements.length ? `
  <section class="block">
    <div class="wrap">
      <h2>Highlights</h2>
      <div class="section-sub">Career milestones</div>
      <div class="achievements">
        ${achievements.map((a, i) => `<div class="ach-card"><div class="num">${String(i + 1).padStart(2, '0')}</div><div>${safe(a)}</div></div>`).join('')}
      </div>
    </div>
  </section>` : ''}

  ${photos.length ? `
  <section class="block">
    <div class="wrap">
      <h2>Press Photos</h2>
      <div class="section-sub">Hi-res for editorial use</div>
      <div class="photo-grid">
        ${photos.map((p) => `<div class="photo"><img src="${safe(p.url)}" alt="${safe(p.caption)}"/><span class="cap">${safe(p.caption)}</span></div>`).join('')}
      </div>
    </div>
  </section>` : ''}

  ${gallery.length ? `
  <section class="block">
    <div class="wrap">
      <h2>Gallery</h2>
      <div class="section-sub">${gallery.length} additional images</div>
      <div class="gallery-grid">
        ${gallery.map((url) => `<a class="gallery-item" href="${safe(url)}" target="_blank" rel="noopener"><img src="${safe(url)}" loading="lazy" alt="" /></a>`).join('')}
      </div>
    </div>
  </section>` : ''}

  ${(socialEntries.length || profileUrl) ? `
  <section class="block">
    <div class="wrap">
      <h2>Listen & Follow</h2>
      <div class="section-sub">Streaming · Social · Boostify</div>
      <div class="links">
        ${profileUrl ? `<a class="primary" href="${safe(profileUrl)}" target="_blank" rel="noopener">Boostify Profile →</a>` : ''}
        ${socialEntries.map(([k, v]) => `<a href="${safe(v as string)}" target="_blank" rel="noopener">${safe(k.charAt(0).toUpperCase() + k.slice(1))}</a>`).join('')}
      </div>
    </div>
  </section>` : ''}

  ${contacts.length ? `
  <section class="block">
    <div class="wrap">
      <h2>Contact</h2>
      <div class="section-sub">Booking · Press · Management</div>
      ${contacts.map((c) => `
        <div style="display:flex;flex-wrap:wrap;gap:32px;font-size:14px;margin-top:8px">
          <div><span style="color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-size:11px">${safe(c.label)}</span><br/><strong>${safe(c.name || epk.artistName)}</strong></div>
          ${c.email ? `<div><span style="color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-size:11px">Email</span><br/><a href="mailto:${safe(c.email)}">${safe(c.email)}</a></div>` : ''}
          ${c.phone ? `<div><span style="color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-size:11px">Phone</span><br/>${safe(c.phone)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  </section>` : ''}

  <footer>
    <div class="wrap">
      <div class="footer-brand">Boostify Music</div>
      <div style="margin-top:6px">EPK · ${safe(slug)} · ${generatedAt}</div>
      ${profileUrl ? `<div style="margin-top:10px"><a href="${safe(profileUrl)}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;font-weight:600">View full artist profile →</a></div>` : ''}
    </div>
  </footer>
</body>
</html>`;
}

export default router;
