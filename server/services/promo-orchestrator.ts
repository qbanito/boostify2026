/**
 * 🚀 Promo Pack Orchestrator (Sprint 1: images only)
 *
 * Generates 3 distinct promo packs for a song using:
 *  - FLUX CONTEXT PRO (fal-ai/flux-pro/kontext) with reference image
 *  - 3 different style presets (cinematic / editorial / street by default)
 *  - GPT for distinct creative direction prompts per pack
 *
 * Each pack = 1 image (Sprint 1). Sprint 2 will add hook video + spoken promo.
 * Generated images are saved to both PostgreSQL (promo_assets) and
 * Firestore (image_galleries) so they appear in the artist's gallery section.
 */
import { randomUUID } from 'crypto';
import { db } from '../db';
import { songs, promoAssets, users, type ArtistLora } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { generateKontextImage } from './flux-kontext-generator';
import { mirrorUrlToFirebase } from './storage-mirror';
import { getStyle, type PromoStyle } from './promo-style-presets';
import type { CharacterSheet } from './character-sheet-generator';
import { generateViralPromoConcepts } from './improved-promo-generator';
import { db as firestoreDb } from '../firebase';

const DEFAULT_STYLES: PromoStyle[] = ['cinematic', 'editorial_photography', 'street_documentary'];

interface PackConcept {
  styleId: PromoStyle;
  styleLabel: string;
  basePrompt: string;
  hookLine: string;
  action: string;
  environment: string;
  wardrobe: string;
  camera: string;
}

async function generateCreativeConcepts(args: {
  songTitle: string;
  insights: any;
  styles: PromoStyle[];
  characterSheet?: CharacterSheet | null;
}): Promise<PackConcept[]> {
  const concepts = await generateViralPromoConcepts({
    songTitle: args.songTitle,
    songMood: args.insights?.mood,
    songThemes: args.insights?.themes,
    songSummary: args.insights?.summary,
    styles: args.styles,
    characterSheet: args.characterSheet || null,
  });

  const mapped: PackConcept[] = concepts.map((c) => ({
    styleId: c.styleId,
    styleLabel: c.styleLabel,
    basePrompt: c.basePrompt,
    hookLine: c.hookLine,
    action: c.action,
    environment: c.environment,
    wardrobe: c.wardrobe,
    camera: c.camera,
  }));

  // Backfill if GPT returned fewer than expected
  while (mapped.length < args.styles.length) {
    const styleId = args.styles[mapped.length];
    const fallbackSubject = args.characterSheet?.base_prompt
      ? args.characterSheet.base_prompt + '. '
      : 'the artist ';
    mapped.push({
      styleId,
      styleLabel: getStyle(styleId).label,
      basePrompt: `${fallbackSubject}performing live with the energy of "${args.songTitle}"`,
      hookLine: `New single — ${args.songTitle}`,
      action: 'performing live',
      environment: 'on stage',
      wardrobe: args.characterSheet?.signature_outfit || 'signature outfit',
      camera: 'medium 3/4 shot, 50mm',
    });
  }
  return mapped.slice(0, args.styles.length);
}

export interface GeneratePackArgs {
  songId: number;
  artistId: number;
  lora?: ArtistLora | null;
  styles?: PromoStyle[];
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9' | '3:4';
  createdBy?: number;
}

export interface GeneratedPack {
  packId: string;
  styleId: PromoStyle;
  styleLabel: string;
  hookLine: string;
  imageUrl: string;
  prompt: string;
  assetId: number;
}

export async function generatePromoPacks(
  args: GeneratePackArgs,
): Promise<{ packs: GeneratedPack[] }> {
  const [song] = await db.select().from(songs).where(eq(songs.id, args.songId)).limit(1);
  if (!song) throw new Error(`Song ${args.songId} not found`);

  // Resolve artist profile image for FLUX CONTEXT PRO reference
  const [artist] = await db.select().from(users).where(eq(users.id, args.artistId)).limit(1);
  const referenceImageUrl = (artist as any)?.profileImage || (artist as any)?.profileImageUrl || null;

  const insights = (song.analysisJson as any)?.insights || null;
  const styles = args.styles ?? DEFAULT_STYLES;
  const characterSheet = (args.lora?.characterSheet as CharacterSheet | null) ?? null;

  // 1. Creative concepts (3 distinct visual ideas, locked to character sheet)
  const concepts = await generateCreativeConcepts({
    songTitle: song.title || `Song #${args.songId}`,
    insights,
    styles,
    characterSheet,
  });

  // 2. Generate one image per concept in parallel using FLUX CONTEXT PRO
  const packResults = await Promise.allSettled(
    concepts.map(async (concept) => {
      const packId = randomUUID();
      const out = await generateKontextImage({
        basePrompt: concept.basePrompt,
        style: concept.styleId,
        triggerWord: args.lora?.triggerWord,
        referenceImageUrl: referenceImageUrl || undefined,
        aspectRatio: args.aspectRatio ?? '4:5',
        numImages: 1,
      });

      const remoteUrl = out.imageUrls[0];
      const ownedUrl = await mirrorUrlToFirebase(
        remoteUrl,
        `promo-assets/song-${args.songId}/images`,
      );

      const [asset] = await db
        .insert(promoAssets)
        .values({
          songId: args.songId,
          artistId: args.artistId,
          packId,
          type: 'image',
          style: concept.styleId,
          url: ownedUrl,
          thumbnailUrl: ownedUrl,
          prompt: out.prompt,
          model: 'fal-ai/flux-pro/kontext',
          costCents: 5,
          metadata: {
            hookLine: concept.hookLine,
            seed: out.seed,
            action: concept.action,
            environment: concept.environment,
            wardrobe: concept.wardrobe,
            camera: concept.camera,
            // pin so videos generated from this image stay coherent
            characterSheetSnapshot: characterSheet,
          },
          status: 'ready',
          createdBy: args.createdBy,
        })
        .returning();

      // Save to Firestore image_galleries so it appears in the artist's gallery section
      try {
        const userId = String(args.artistId);
        const galleryId = `promo-song-${args.songId}`;
        const galleryRef = firestoreDb.collection('image_galleries').doc(galleryId);
        const galleryDoc = await galleryRef.get();

        const newImage = {
          id: `promo-${asset.id}`,
          url: ownedUrl,
          prompt: out.prompt,
          createdAt: new Date().toISOString(),
        };

        if (galleryDoc.exists) {
          await galleryRef.update({
            generatedImages: [...(galleryDoc.data()?.generatedImages || []), newImage],
            updatedAt: new Date().toISOString(),
          });
        } else {
          await galleryRef.set({
            userId,
            singleName: song.title || `Song #${args.songId}`,
            artistName: (artist as any)?.artistName || (artist as any)?.username || 'Artist',
            basePrompt: out.prompt,
            styleInstructions: concept.styleLabel,
            referenceImageUrls: referenceImageUrl ? [referenceImageUrl] : [],
            generatedImages: [newImage],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: true,
          });
        }
        logger.info('[PromoOrchestrator] saved to Firestore gallery', { galleryId, assetId: asset.id });
      } catch (fsErr: any) {
        logger.warn('[PromoOrchestrator] failed to save to Firestore gallery', { err: fsErr?.message });
      }

      const generated: GeneratedPack = {
        packId,
        styleId: concept.styleId,
        styleLabel: concept.styleLabel,
        hookLine: concept.hookLine,
        imageUrl: ownedUrl,
        prompt: out.prompt,
        assetId: asset.id,
      };
      return generated;
    }),
  );

  const packs: GeneratedPack[] = [];
  for (const r of packResults) {
    if (r.status === 'fulfilled') packs.push(r.value);
    else logger.error('[PromoOrchestrator] pack failed', { reason: (r.reason as any)?.message });
  }

  if (packs.length === 0) {
    throw new Error('All promo packs failed to generate');
  }
  return { packs };
}
