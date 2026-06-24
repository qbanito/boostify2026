/**
 * 🎭 Character Sheet Engine
 *
 * Generates a DEFINITIVE visual character sheet (model sheet) for an artist —
 * turnaround (front / 3-4 / side / back) + head studies + a cinematic hero
 * portrait — anchored on the artist's REAL photo via Flux Kontext so face +
 * wardrobe stay identical across every angle.
 *
 * The result is persisted in TWO places:
 *   1. Firestore `artistCharacterSheets/{artistId}`  → full sheet + views (for the UI / polling).
 *   2. The artist's ArtistBrandProfile (`artistBrandProfiles/{artistId}`)  → so EVERY
 *      module that already reads the brand profile (smart-merch, fan-club, hologram,
 *      social-media, blueprint…) instantly inherits the locked identity + canonical refs.
 *
 * This is the single highest-leverage point for cross-workflow visual consistency.
 */
import sharp from 'sharp';
import axios from 'axios';
import { eq } from 'drizzle-orm';
import { db as firestoreDb } from '../firebase';
import { db as pgDb } from '../db';
import { users } from '../db/schema';
import { logger } from '../utils/logger';
import { mirrorUrlToFirebase } from './storage-mirror';
import { generateKontextImage } from './flux-kontext-generator';
import { loadBrandProfile } from './artist-brand-profile';
import {
  generateCharacterSheet,
  buildCanonicalViewPrompts,
  type CharacterSheet,
  type CanonicalView,
} from './character-sheet-generator';

export interface CharacterSheetView {
  key: string;
  label: string;
  category: 'turnaround' | 'head' | 'portrait';
  url: string;
}

export interface CharacterSheetRecord {
  artistId: string;
  status: 'processing' | 'ready' | 'failed';
  sheet: CharacterSheet | null;
  views: CharacterSheetView[];
  posterUrl: string | null;
  heroRef: string | null;
  sourcePhoto: string | null;
  updatedAt: number;
  error?: string;
  version: number;
}

const COLLECTION = 'artistCharacterSheets';
const STALE_MS = 15 * 60 * 1000;

function docRef(artistId: string) {
  return firestoreDb.collection(COLLECTION).doc(String(artistId));
}

/** Resolve the minimal artist context we need to build a sheet. */
async function resolveArtistForSheet(artistId: string): Promise<{
  name: string;
  genre: string;
  biography: string;
  country: string;
  profileImage: string | null;
  visualStyle: string;
}> {
  const ctx = {
    name: 'Artist',
    genre: 'Music',
    biography: '',
    country: '',
    profileImage: null as string | null,
    visualStyle: '',
  };

  // 1) Postgres users (numeric id or slug)
  try {
    const numId = Number(artistId);
    const isNumeric = !isNaN(numId) && /^\d+$/.test(artistId);
    const [pgUser] = await pgDb
      .select({
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
      .where(isNumeric ? eq(users.id, numId) : eq(users.slug, artistId))
      .limit(1);
    if (pgUser) {
      ctx.name = pgUser.artistName || pgUser.username || ctx.name;
      ctx.genre = pgUser.genre || (pgUser.genres as string[])?.[0] || ctx.genre;
      ctx.biography = pgUser.biography || '';
      ctx.country = pgUser.country || '';
      ctx.profileImage = pgUser.profileImage || pgUser.profileImageUrl || null;
      const mj = pgUser.masterJson as any;
      if (mj) ctx.visualStyle = mj.visualIdentity?.primaryStyle || mj.visualStyle || '';
    }
  } catch (e) {
    logger.warn('[CharacterSheetEngine] PG lookup failed', { error: (e as Error)?.message });
  }

  // 2) Brand profile (richest visual context + the canonical photo)
  try {
    const brand = await loadBrandProfile(artistId);
    if (brand) {
      if (ctx.name === 'Artist') ctx.name = brand.artistName || ctx.name;
      if (ctx.genre === 'Music') ctx.genre = brand.genre || ctx.genre;
      ctx.visualStyle = ctx.visualStyle || brand.visualStyle || '';
      ctx.profileImage = ctx.profileImage || brand.referenceImages?.artistPhoto || null;
    }
  } catch { /* brand profile optional */ }

  // 3) Firestore fallbacks (AI-generated artists)
  if (ctx.name === 'Artist' || !ctx.profileImage) {
    try {
      const gen = await firestoreDb.collection('generated_artists').doc(String(artistId)).get();
      if (gen.exists) {
        const d = gen.data()!;
        if (ctx.name === 'Artist') ctx.name = d.canonical?.artist_name || d.artistName || d.name || ctx.name;
        if (ctx.genre === 'Music') ctx.genre = d.canonical?.genre || d.genres?.[0] || d.genre || ctx.genre;
        ctx.biography = ctx.biography || d.canonical?.biography_short || d.biography || '';
        ctx.profileImage = ctx.profileImage || d.profileImage || d.canonical?.image_url || null;
      }
    } catch { /* optional */ }
  }

  return ctx;
}

/** Generate one canonical view with Flux Kontext, anchored on the real photo. Never throws. */
async function generateView(
  view: CanonicalView,
  referenceImageUrl: string | null,
  artistId: string,
): Promise<CharacterSheetView | null> {
  try {
    const out = await generateKontextImage({
      basePrompt: view.prompt,
      style: 'cinematic',
      referenceImageUrl: referenceImageUrl || undefined,
      aspectRatio: view.aspect,
      numImages: 1,
    });
    const tempUrl = out.imageUrls[0];
    if (!tempUrl) return null;
    const permanent = await mirrorUrlToFirebase(
      tempUrl,
      `character-sheet/artist-${artistId}`,
      `${view.key}.jpg`,
    ).catch(() => tempUrl);
    return { key: view.key, label: view.label, category: view.category, url: permanent };
  } catch (e) {
    logger.warn('[CharacterSheetEngine] view failed', { view: view.key, error: (e as Error)?.message });
    return null;
  }
}

/** Best-effort DENXEL-style contact sheet poster (turnaround row + heads + portrait). */
async function composePosterSheet(
  views: CharacterSheetView[],
  sheet: CharacterSheet,
  artistId: string,
): Promise<string | null> {
  try {
    const W = 1600;
    const H = 2000;
    const bg = await sharp({
      create: { width: W, height: H, channels: 3, background: { r: 14, g: 13, b: 18 } },
    }).png().toBuffer();

    async function fetchResized(url: string, w: number, h: number): Promise<Buffer | null> {
      try {
        const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 60_000 });
        return await sharp(Buffer.from(r.data)).resize(w, h, { fit: 'cover' }).png().toBuffer();
      } catch {
        return null;
      }
    }

    const turnarounds = views.filter((v) => v.category === 'turnaround').slice(0, 4);
    const heads = views.filter((v) => v.category === 'head').slice(0, 2);
    const portrait = views.find((v) => v.category === 'portrait');

    const composites: sharp.OverlayOptions[] = [];

    // Top row: turnaround (4 cells)
    const tW = Math.floor((W - 60) / 4);
    const tH = Math.floor(tW * 1.33);
    for (let i = 0; i < turnarounds.length; i++) {
      const buf = await fetchResized(turnarounds[i].url, tW - 12, tH);
      if (buf) composites.push({ input: buf, left: 30 + i * tW, top: 200 });
    }

    // Middle: cinematic portrait (left) + 2 heads (right column)
    const pY = 200 + tH + 40;
    if (portrait) {
      const pW = Math.floor((W - 60) * 0.58);
      const pH = Math.floor(pW * 1.25);
      const buf = await fetchResized(portrait.url, pW, pH);
      if (buf) composites.push({ input: buf, left: 30, top: pY });
    }
    const hW = Math.floor((W - 60) * 0.40);
    const hH = Math.floor(hW);
    for (let i = 0; i < heads.length; i++) {
      const buf = await fetchResized(heads[i].url, hW, hH);
      if (buf) composites.push({ input: buf, left: W - 30 - hW, top: pY + i * (hH + 20) });
    }

    // Palette swatches
    const palette = (sheet.signature_palette || sheet.color_palette || []).slice(0, 6);

    const esc = (s: string) =>
      String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const swatchSvg = palette
      .map((c, i) => {
        const safe = /^#?[0-9a-fA-F]{3,8}$/.test(c) ? (c.startsWith('#') ? c : `#${c}`) : '#888888';
        return `<rect x="${30 + i * 180}" y="1820" width="160" height="80" rx="10" fill="${safe}" stroke="#ffffff22"/>`;
      })
      .join('');

    const overlaySvg = `
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .title { fill:#f5efe2; font-family:'DejaVu Sans',sans-serif; font-weight:700; }
          .sub { fill:#c9a96a; font-family:'DejaVu Sans',sans-serif; font-weight:700; }
          .tag { fill:#9aa0aa; font-family:'DejaVu Sans',sans-serif; }
        </style>
        <text x="30" y="90" class="title" font-size="58">${esc(sheet.artistName)}</text>
        <text x="30" y="140" class="sub" font-size="26" letter-spacing="6">CHARACTER SHEET · VISUAL IDENTITY LOCK</text>
        <text x="30" y="185" class="tag" font-size="20">${esc((sheet.aesthetic_tags || []).slice(0, 4).join('  ·  '))}</text>
        ${swatchSvg}
      </svg>`;
    composites.push({ input: Buffer.from(overlaySvg), left: 0, top: 0 });

    const poster = await sharp(bg).composite(composites).jpeg({ quality: 88 }).toBuffer();
    const url = await mirrorUrlToFirebaseBuffer(poster, `character-sheet/artist-${artistId}`, 'poster.jpg');
    return url;
  } catch (e) {
    logger.warn('[CharacterSheetEngine] poster compose failed', { error: (e as Error)?.message });
    return null;
  }
}

/** Upload a raw buffer to Firebase Storage (mirror helper only takes URLs). */
async function mirrorUrlToFirebaseBuffer(
  buffer: Buffer,
  folder: string,
  filename: string,
): Promise<string | null> {
  try {
    const { storage } = await import('../firebase');
    const path = `${folder}/${filename}`;
    const bucket = storage.bucket();
    const file = bucket.file(path);
    await file.save(buffer, { metadata: { contentType: 'image/jpeg' }, validation: false });
    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
      bucket.name,
    )}/o/${encodeURIComponent(path)}?alt=media`;
  } catch (e) {
    logger.warn('[CharacterSheetEngine] buffer upload failed', { error: (e as Error)?.message });
    return null;
  }
}

/**
 * Write the locked identity + canonical refs INTO the artist's brand profile so
 * every existing consumer (loadBrandProfile / getReferenceImageUrls /
 * buildBrandPromptBlock) inherits them with zero per-module changes.
 */
async function injectIntoBrandProfile(
  artistId: string,
  sheet: CharacterSheet,
  views: CharacterSheetView[],
  heroRef: string | null,
): Promise<void> {
  try {
    const canonicalUrls = views.map((v) => v.url).filter(Boolean);
    const block = {
      identityLock: sheet.identity_lock || sheet.base_prompt || '',
      signatureOutfit: sheet.signature_outfit || '',
      headStudyNotes: sheet.head_study_notes || '',
      signaturePalette: sheet.signature_palette || sheet.color_palette || [],
      wardrobe: sheet.wardrobe || [],
      props: sheet.props || [],
      materials: sheet.materials || [],
      vibeKeywords: sheet.vibe_keywords || [],
      views: views.map((v) => ({ key: v.key, label: v.label, category: v.category, url: v.url })),
      posterUrl: null,
      primaryRef: heroRef || canonicalUrls[0] || null,
      generatedAt: new Date().toISOString(),
      version: 1,
    };
    // Merge-set: only touch the characterSheet block; merge canonical refs into additional[].
    const existing = await firestoreDb.collection('artistBrandProfiles').doc(String(artistId)).get();
    const prevAdditional: string[] = existing.exists
      ? (existing.data()?.referenceImages?.additional || [])
      : [];
    const mergedAdditional = Array.from(new Set([...canonicalUrls, ...prevAdditional])).slice(0, 8);

    await firestoreDb
      .collection('artistBrandProfiles')
      .doc(String(artistId))
      .set(
        {
          characterSheet: block,
          referenceImages: { additional: mergedAdditional },
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    logger.info('[CharacterSheetEngine] injected into brand profile', { artistId, refs: canonicalUrls.length });
  } catch (e) {
    logger.warn('[CharacterSheetEngine] brand-profile injection failed', { error: (e as Error)?.message });
  }
}

/** Read the persisted character sheet record (for UI / polling). */
export async function getArtistCharacterSheet(artistId: string): Promise<CharacterSheetRecord | null> {
  try {
    const snap = await docRef(artistId).get();
    if (!snap.exists) return null;
    return snap.data() as CharacterSheetRecord;
  } catch {
    return null;
  }
}

/**
 * Generate (or regenerate) the artist's master character sheet.
 * Designed to run fire-and-forget; status is tracked in Firestore for polling.
 */
export async function generateArtistCharacterSheet(
  artistId: string,
  opts: { force?: boolean } = {},
): Promise<CharacterSheetRecord> {
  const ref = docRef(artistId);

  // Idempotency / concurrency guard
  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data() as CharacterSheetRecord;
    if (!opts.force && data.status === 'ready' && (data.views?.length || 0) > 0) {
      return data;
    }
    if (data.status === 'processing' && Date.now() - (data.updatedAt || 0) < STALE_MS) {
      return data; // a job is already running
    }
  }

  const base: CharacterSheetRecord = {
    artistId: String(artistId),
    status: 'processing',
    sheet: null,
    views: [],
    posterUrl: null,
    heroRef: null,
    sourcePhoto: null,
    updatedAt: Date.now(),
    version: 1,
  };
  await ref.set(base, { merge: true });

  try {
    const artist = await resolveArtistForSheet(artistId);
    base.sourcePhoto = artist.profileImage;

    // 1) Structured sheet (callAI cascade → z.ai fallback)
    const sheet = await generateCharacterSheet({
      artistName: artist.name,
      biography: artist.biography,
      genre: artist.genre,
      country: artist.country,
      visualStyle: artist.visualStyle,
      profileImageUrl: artist.profileImage,
    });

    // 2) Canonical views (parallel, anchored on the real photo)
    const viewPrompts = buildCanonicalViewPrompts(sheet);
    const results = await Promise.all(
      viewPrompts.map((v) => generateView(v, artist.profileImage, artistId)),
    );
    const views = results.filter((v): v is CharacterSheetView => !!v);

    if (views.length === 0) {
      throw new Error('No canonical views could be generated (image provider exhausted?)');
    }

    const heroRef = views.find((v) => v.category === 'portrait')?.url
      || views.find((v) => v.key === 'turnaround_front')?.url
      || views[0].url;

    // 3) Best-effort poster
    const posterUrl = await composePosterSheet(views, sheet, artistId);

    // 4) Persist record + inject into brand profile (the cross-workflow win)
    const record: CharacterSheetRecord = {
      ...base,
      status: 'ready',
      sheet,
      views,
      posterUrl,
      heroRef,
      updatedAt: Date.now(),
    };
    await ref.set(record, { merge: true });
    await injectIntoBrandProfile(artistId, sheet, views, heroRef);

    logger.info('[CharacterSheetEngine] ready', { artistId, views: views.length, poster: !!posterUrl });
    return record;
  } catch (e: any) {
    logger.error('[CharacterSheetEngine] failed', { artistId, error: e?.message });
    const failed: CharacterSheetRecord = {
      ...base,
      status: 'failed',
      updatedAt: Date.now(),
      error: e?.message || 'generation failed',
    };
    await ref.set(failed, { merge: true });
    return failed;
  }
}
