/**
 * VideoService → Artist Bootstrap
 * --------------------------------------------------------------
 * When a lead fills the Video Service form we already create a
 * skeleton user via `ensureArtistProfile`. That profile, however,
 * is generic (basic bio, no hero banner, no master JSON). The lead
 * may never come back to enrich it manually — yet they ARE one of
 * our most qualified prospects (they paid $99 to reserve a video).
 *
 * This service upgrades the auto-created profile into a fully
 * presentable landing page so the lead stays connected to Boostify
 * tools and feels treated like a real client from day 1:
 *
 *   1. Generates an enhanced 3:4 PROFILE PORTRAIT (nano-banana)
 *   2. Generates a cinematic 16:9 HERO BANNER (nano-banana)
 *   3. Writes a personalized 3-tier BIOGRAPHY (OpenAI, with
 *      template fallback if no API key)
 *   4. Seeds the canonical MASTER JSON used by every AI module
 *      (news, merch, social posts, business plan, etc.)
 *   5. Forces a STRATEGIC MINIMAL profile layout — only the
 *      modules that matter on day 1 are visible/expanded;
 *      advanced widgets stay available but collapsed/hidden.
 *
 * All updates are best-effort; any individual failure is logged
 * and downgrades the result instead of throwing.
 */

import { db } from '../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import {
  editImageWithNanoBanana,
  generateImageWithNanoBanana,
} from './fal-service';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

// ── OpenAI (lazy + optional) ─────────────────────────────────────
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY
  ? createTrackedOpenAI({ apiKey: OPENAI_API_KEY })
  : null;

// ── Public input ──────────────────────────────────────────────────
export interface BootstrapArtistFromLeadOptions {
  userId: number;
  artistName: string;
  /** Public URL of the original reference photo uploaded in the form (optional). */
  originalImageUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  instagramHandle?: string | null;
  spotifyUrl?: string | null;
  genre?: string | null;
  aesthetic?: string | null;
  videoType?: string | null;
  description?: string | null;
  songName?: string | null;
  lang?: 'es' | 'en';
  videoServiceProjectId?: number;
  /** USD amount of the video service project — used to flag premium leads. */
  calculatedPrice?: number | null;
}

export interface BootstrapArtistResult {
  profileImageUrl: string | null;
  heroBannerUrl: string | null;
  biography: string;
  masterJsonSeeded: boolean;
  layoutApplied: boolean;
}

// ── Strategic minimal default layout for fresh video-service leads
// Day-1 profile shows ONLY what tells a coherent story:
//   • Songs/Videos (their music)
//   • Social-hub (links + presence)
//   • Merchandise (monetization invitation)
// Right column keeps Information, Social-media, Spotify and
// Statistics. Everything else stays installed but hidden so the
// artist can opt-in from the editor.
const STRATEGIC_DEFAULT_LAYOUT = {
  // Order kept identical to the canonical default so the editor
  // stays consistent — only `visibility` is tightened.
  order: [
    'influencer-module',
    'songs',
    'videos',
    'social-hub',
    'news',
    'social-posts',
    'merchandise',
    'galleries',
    'downloads',
    'tokenization',
    'monetize-cta',
    'analytics',
    'earnings',
    'crowdfunding',
    'sponsors',
    'venueBooking',
    'explicit-content',
    'aas-engine',
    'viral-products',
    'brand-collabs',
    'business-plan',
  ],
  visibility: {
    'influencer-module': false,
    'songs': true,
    'videos': true,
    'social-hub': true,
    'news': false,
    'social-posts': false,
    'merchandise': true,
    'galleries': false,
    'downloads': false,
    'tokenization': false,
    'monetize-cta': false,
    'analytics': false,
    'earnings': false,
    'crowdfunding': false,
    'sponsors': false,
    'venueBooking': false,
    'explicit-content': false,
    'aas-engine': false,
    'viral-products': false,
    'brand-collabs': false,
    'business-plan': false,
  } as Record<string, boolean>,
  expanded: {
    'songs': true,
    'videos': true,
    'social-hub': true,
    'merchandise': false,
  } as Record<string, boolean>,
  rightOrder: [
    'information',
    'social-media',
    'spotify',
    'statistics',
    'qr-card',
    'economic-engine',
    'crypto-community',
    'physical-cards',
    'tokenized-music',
    'premium-tools',
    'upcoming-shows',
  ],
  rightVisibility: {
    'information': true,
    'social-media': true,
    'spotify': true,
    'statistics': true,
    'qr-card': false,
    'economic-engine': false,
    'crypto-community': false,
    'physical-cards': false,
    'tokenized-music': false,
    'premium-tools': false,
    'upcoming-shows': false,
  } as Record<string, boolean>,
  rightExpanded: {
    'information': true,
    'social-media': true,
    'spotify': true,
    'statistics': false,
  } as Record<string, boolean>,
  colorTheme: null as string | null,
};

// ── Image generation ──────────────────────────────────────────────
async function generateProfilePortrait(
  artistName: string,
  originalImageUrl: string | null,
  aesthetic: string,
  genre: string,
): Promise<string | null> {
  const prompt =
    `Editorial 3:4 portrait of "${artistName}", ${genre} recording artist, ` +
    `${aesthetic} aesthetic. Professional studio lighting, sharp focus on the face, ` +
    `magazine-cover quality, polished skin retouch, vibrant but tasteful color grade, ` +
    `subtle bokeh background, premium music-press style. Preserve the original ` +
    `identity and facial features.`;
  try {
    if (originalImageUrl) {
      const r = await editImageWithNanoBanana(originalImageUrl, prompt, {
        aspectRatio: '3:4',
        strength: 0.55,
      });
      if (r.success && r.imageUrl) return r.imageUrl;
    }
    const r = await generateImageWithNanoBanana(prompt, { aspectRatio: '3:4' });
    return r.success && r.imageUrl ? r.imageUrl : null;
  } catch (err) {
    console.error('[ArtistBootstrap] profile portrait failed:', err);
    return null;
  }
}

async function generateHeroBanner(
  artistName: string,
  originalImageUrl: string | null,
  aesthetic: string,
  genre: string,
): Promise<string | null> {
  const prompt =
    `Cinematic 16:9 hero banner for music artist "${artistName}". ` +
    `${genre} genre, ${aesthetic} aesthetic. Wide cinematic composition, ` +
    `dramatic atmospheric lighting, volumetric haze, rich colors, depth of field, ` +
    `concert/stage or editorial environment, the artist confidently centered or ` +
    `slightly off-center with negative space for overlay text. Spectacular, ` +
    `attention-grabbing, premium music-festival poster quality. Preserve the ` +
    `artist's facial identity from the reference image.`;
  try {
    if (originalImageUrl) {
      const r = await editImageWithNanoBanana(originalImageUrl, prompt, {
        aspectRatio: '16:9',
        strength: 0.7,
      });
      if (r.success && r.imageUrl) return r.imageUrl;
    }
    const r = await generateImageWithNanoBanana(prompt, { aspectRatio: '16:9' });
    return r.success && r.imageUrl ? r.imageUrl : null;
  } catch (err) {
    console.error('[ArtistBootstrap] hero banner failed:', err);
    return null;
  }
}

// ── Biography generation ──────────────────────────────────────────
interface BioBundle {
  short: string;   // ≤140 chars (twitter-style)
  medium: string;  // ~3 sentences (profile card)
  long: string;    // 1–2 paragraphs (about page)
}

function fallbackBio(
  artistName: string,
  genre: string,
  aesthetic: string,
  songName: string,
  lang: 'es' | 'en',
): BioBundle {
  if (lang === 'en') {
    const short = `${artistName} — ${genre || 'independent'} artist crafting a ${aesthetic || 'bold'} sound.`;
    const medium = `${artistName} is a ${genre || 'genre-bending'} artist whose ${aesthetic || 'distinctive'} sonic palette pushes the boundaries of contemporary music. ${songName ? `With "${songName}" leading the moment, ` : ''}every release is a step deeper into a personal universe of rhythm and emotion. Boostify partners with ${artistName} to bring that vision to a global stage.`;
    const long = `${medium}\n\nFrom day-one fans to industry insiders, ${artistName} connects through honesty, energy and craft. The Boostify platform powers ${artistName}'s music distribution, fan economy and AI-driven creative tools — turning each track into an experience and each listener into a community member.`;
    return { short, medium, long };
  }
  const short = `${artistName} — artista ${genre || 'independiente'} con un sonido ${aesthetic || 'auténtico'}.`;
  const medium = `${artistName} es un/a artista ${genre || 'multigénero'} con una propuesta ${aesthetic || 'distintiva'} que empuja los límites de la música actual. ${songName ? `Con "${songName}" marcando el presente, ` : ''}cada lanzamiento es un paso más dentro de un universo personal de ritmo y emoción. Boostify acompaña a ${artistName} para llevar esa visión a una audiencia global.`;
  const long = `${medium}\n\nDesde sus primeros fans hasta la industria, ${artistName} conecta con honestidad, energía y oficio. La plataforma Boostify potencia su distribución musical, su economía de fans y sus herramientas creativas con IA — transformando cada canción en una experiencia y cada oyente en parte de la comunidad.`;
  return { short, medium, long };
}

async function generateBiography(
  artistName: string,
  genre: string,
  aesthetic: string,
  videoType: string,
  description: string,
  songName: string,
  lang: 'es' | 'en',
): Promise<BioBundle> {
  if (!openai) return fallbackBio(artistName, genre, aesthetic, songName, lang);
  try {
    const sys = lang === 'en'
      ? `You write professional, magnetic biographies for music artists. Avoid clichés and platitudes. Write in third person. Always return strict JSON.`
      : `Escribes biografías profesionales y magnéticas para artistas musicales. Evita clichés y frases vacías. Escribe en tercera persona. Devuelve siempre JSON estricto.`;
    const userPrompt = lang === 'en'
      ? `Artist: ${artistName}\nGenre: ${genre || 'unspecified'}\nAesthetic: ${aesthetic || 'unspecified'}\nVideo project type: ${videoType || 'music_video'}\nFlagship song: ${songName || 'n/a'}\nArtist's own brief: ${description || 'n/a'}\n\nReturn strict JSON: { "short": "<≤140 chars, hook one-liner>", "medium": "<3 sentences for the profile card>", "long": "<1-2 paragraphs for the about page, ~120-180 words>" }. No markdown, no extra keys.`
      : `Artista: ${artistName}\nGénero: ${genre || 'no especificado'}\nEstética: ${aesthetic || 'no especificada'}\nTipo de proyecto de video: ${videoType || 'music_video'}\nCanción principal: ${songName || 'n/d'}\nBrief del propio artista: ${description || 'n/d'}\n\nDevuelve JSON estricto: { "short": "<≤140 caracteres, gancho>", "medium": "<3 oraciones para la tarjeta de perfil>", "long": "<1-2 párrafos para la sección about, ~120-180 palabras>" }. Sin markdown, sin claves extra.`;

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userPrompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    const bundle: BioBundle = {
      short: typeof parsed.short === 'string' && parsed.short.trim()
        ? parsed.short.trim().slice(0, 200)
        : fallbackBio(artistName, genre, aesthetic, songName, lang).short,
      medium: typeof parsed.medium === 'string' && parsed.medium.trim()
        ? parsed.medium.trim()
        : fallbackBio(artistName, genre, aesthetic, songName, lang).medium,
      long: typeof parsed.long === 'string' && parsed.long.trim()
        ? parsed.long.trim()
        : fallbackBio(artistName, genre, aesthetic, songName, lang).long,
    };
    return bundle;
  } catch (err) {
    console.error('[ArtistBootstrap] OpenAI bio failed, using fallback:', err);
    return fallbackBio(artistName, genre, aesthetic, songName, lang);
  }
}

// ── Master JSON seed ──────────────────────────────────────────────
function buildMasterJsonSeed(opts: BootstrapArtistFromLeadOptions, bio: BioBundle, profileImageUrl: string | null, heroBannerUrl: string | null) {
  const now = new Date().toISOString();
  const isPremium =
    typeof opts.calculatedPrice === 'number' && opts.calculatedPrice >= 5000;
  return {
    meta: {
      version: '1.0.0',
      schemaVersion: 'v1',
      source: 'videoservice-lead',
      videoServiceProjectId: opts.videoServiceProjectId ?? null,
      createdAt: now,
      updatedAt: now,
      enrichmentStatus: 'seeded',
      leadStage: 'video-service-reservation',
      isPremiumLead: isPremium,
    },
    identity: {
      artistName: opts.artistName,
      primaryLanguage: opts.lang || 'es',
      bio: {
        short: bio.short,
        medium: bio.medium,
        long: bio.long,
      },
    },
    visual: {
      profileImage: profileImageUrl,
      heroBanner: heroBannerUrl,
      referenceImages: opts.originalImageUrl
        ? [{ url: opts.originalImageUrl, source: 'videoservice-form' }]
        : [],
      aesthetic: opts.aesthetic || null,
    },
    contact: {
      email: opts.email || null,
      phone: opts.phone || null,
    },
    platforms: {
      instagram: opts.instagramHandle
        ? {
            handle: opts.instagramHandle,
            url: opts.instagramHandle.startsWith('http')
              ? opts.instagramHandle
              : `https://instagram.com/${opts.instagramHandle.replace(/^@/, '')}`,
          }
        : null,
      spotify: opts.spotifyUrl ? { url: opts.spotifyUrl } : null,
    },
    music: {
      genres: opts.genre ? [opts.genre] : [],
      featuredSong: opts.songName || null,
    },
    project: {
      videoType: opts.videoType || null,
      aesthetic: opts.aesthetic || null,
      brief: opts.description || null,
      calculatedPrice: opts.calculatedPrice ?? null,
    },
    boostify: {
      onboardedVia: 'videoservice',
      premiumAccessSuggested: isPremium,
      keepConnectedTo: ['ai-tools', 'merch-generator', 'news-generator', 'social-posts', 'business-plan'],
    },
  };
}

// ── Public entrypoint ─────────────────────────────────────────────
export async function bootstrapArtistFromLead(
  opts: BootstrapArtistFromLeadOptions,
): Promise<BootstrapArtistResult> {
  const lang: 'es' | 'en' = opts.lang === 'en' ? 'en' : 'es';
  const aesthetic = opts.aesthetic || (lang === 'en' ? 'cinematic' : 'cinematográfica');
  const genre = opts.genre || (lang === 'en' ? 'urban' : 'urbano');

  // Run image gens + bio in parallel — they are independent.
  const [profileImageUrl, heroBannerUrl, bio] = await Promise.all([
    generateProfilePortrait(opts.artistName, opts.originalImageUrl || null, aesthetic, genre),
    generateHeroBanner(opts.artistName, opts.originalImageUrl || null, aesthetic, genre),
    generateBiography(
      opts.artistName,
      genre,
      aesthetic,
      opts.videoType || '',
      opts.description || '',
      opts.songName || '',
      lang,
    ),
  ]);

  const masterJson = buildMasterJsonSeed(opts, bio, profileImageUrl, heroBannerUrl);

  // Persist into the users row. We never overwrite a non-empty
  // `coverImage` / `profileImage` set by the artist themselves.
  let layoutApplied = false;
  let masterJsonSeeded = false;
  try {
    const [existing] = await db
      .select({
        profileImage: users.profileImage,
        coverImage: users.coverImage,
        biography: users.biography,
        profileLayout: users.profileLayout,
        masterJson: users.masterJson,
      })
      .from(users)
      .where(eq(users.id, opts.userId))
      .limit(1);

    const updates: Record<string, unknown> = {};

    if (profileImageUrl && !existing?.profileImage) {
      updates.profileImage = profileImageUrl;
    }
    if (heroBannerUrl && !existing?.coverImage) {
      updates.coverImage = heroBannerUrl;
    }
    if (!existing?.biography || existing.biography.length < 80) {
      updates.biography = bio.long;
    }
    if (opts.genre && !existing) {
      updates.genre = opts.genre;
    }
    if (opts.instagramHandle) {
      updates.instagramHandle = opts.instagramHandle.replace(/^@/, '');
    }
    if (opts.spotifyUrl) {
      updates.spotifyUrl = opts.spotifyUrl;
    }
    if (opts.email) {
      updates.email = opts.email;
    }
    if (opts.phone) {
      updates.phone = opts.phone;
    }

    // Always seed the master JSON (merge with anything already there)
    const prev = (existing?.masterJson as Record<string, unknown>) || {};
    updates.masterJson = { ...prev, ...masterJson };
    masterJsonSeeded = true;

    // Apply strategic layout only if no layout was customized yet.
    if (!existing?.profileLayout) {
      updates.profileLayout = STRATEGIC_DEFAULT_LAYOUT as any;
      layoutApplied = true;
    }

    updates.updatedAt = new Date();

    await db.update(users).set(updates as any).where(eq(users.id, opts.userId));
    console.log(
      `✅ [ArtistBootstrap] user #${opts.userId} (${opts.artistName}) — ` +
        `profile=${!!profileImageUrl} hero=${!!heroBannerUrl} bio=${bio.long.length}c ` +
        `masterJson=${masterJsonSeeded} layout=${layoutApplied}`,
    );
  } catch (err) {
    console.error('[ArtistBootstrap] DB update failed:', err);
  }

  return {
    profileImageUrl,
    heroBannerUrl,
    biography: bio.long,
    masterJsonSeeded,
    layoutApplied,
  };
}
