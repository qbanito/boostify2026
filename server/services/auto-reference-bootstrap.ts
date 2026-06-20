/**
 * 🤖 Auto Reference Bootstrap
 *
 * For artists without uploaded photos: build a CharacterSheet from their
 * profile, render 6 consistent reference images using FLUX CONTEXT PRO
 * (fal-ai/flux-pro/kontext) with the artist's profile image as reference,
 * store them in Firebase, then submit a flux-kontext-trainer job to produce
 * a personal LoRA.
 *
 * This makes the Promote button work for AUTO-GENERATED artists too.
 */
import { db } from '../db';
import { artistLoras, users } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../utils/logger';
import {
  generateCharacterSheet,
  buildBootstrapPrompts,
  type CharacterSheet,
} from './character-sheet-generator';
import { generateKontextImage } from './flux-kontext-generator';
import { mirrorUrlToFirebase } from './storage-mirror';
import { submitLoraTraining } from './flux-trainer';

function slugifyTrigger(name: string, artistId: number): string {
  const base = (name || 'artist')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18);
  return `${base || 'artist'}_${artistId}`;
}

export interface BootstrapResult {
  loraRowId: number;
  trainingJobId: string;
  triggerWord: string;
  referenceImages: string[];
  characterSheet: CharacterSheet;
}

/**
 * Run the full bootstrap pipeline.
 * Returns the artist_loras row id and the training job id so the caller
 * can poll for completion.
 */
export async function autoBootstrapArtistLora(artistId: number): Promise<BootstrapResult> {
  const [user] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
  if (!user) throw new Error(`User ${artistId} not found`);

  // 1. Build character sheet from profile
  logger.info('[Bootstrap] generating character sheet', { artistId });
  const sheet = await generateCharacterSheet({
    artistName: (user as any).artistName,
    realName: (user as any).realName,
    biography: (user as any).biography,
    genre: (user as any).genre,
    country: (user as any).country,
    aestheticStyle: (user as any).aestheticStyle,
    visualStyle: (user as any).visualStyle,
    profileImageUrl: (user as any).profileImage || (user as any).profileImageUrl,
  });

  // 2. Generate 6 consistent reference shots using FLUX CONTEXT PRO
  const prompts = buildBootstrapPrompts(sheet);
  const profileImageUrl = (user as any).profileImage || (user as any).profileImageUrl || null;
  logger.info('[Bootstrap] generating 6 reference images with FLUX CONTEXT PRO', { artistId, hasProfileRef: !!profileImageUrl });

  const results = await Promise.allSettled(
    prompts.map((p) =>
      generateKontextImage({
        basePrompt: p.prompt,
        style: 'cinematic',
        referenceImageUrl: profileImageUrl || undefined,
        aspectRatio: (p.aspect as any) || '4:5',
        numImages: 1,
      }),
    ),
  );

  const referenceImages: string[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value?.imageUrls?.[0]) {
      // Re-mirror to a dedicated folder so we own the URL forever
      try {
        const mirrored = await mirrorUrlToFirebase(
          r.value.imageUrls[0],
          `lora-references/artist-${artistId}`,
        );
        referenceImages.push(mirrored);
      } catch {
        referenceImages.push(r.value.imageUrls[0]); // use original URL if mirroring fails
      }
    }
  }

  if (referenceImages.length < 4) {
    throw new Error(
      `Bootstrap produced only ${referenceImages.length}/6 images. Try again or upload manually.`,
    );
  }

  // 3. Trigger word + create artist_loras row in 'training' state
  const triggerWord = slugifyTrigger((user as any).artistName || (user as any).username, artistId);

  const [row] = await db
    .insert(artistLoras)
    .values({
      artistId,
      triggerWord,
      referenceImages: referenceImages as any,
      characterSheet: sheet as any,
      status: 'pending',
    })
    .returning();

  // 4. Submit training job
  logger.info('[Bootstrap] submitting LoRA training', { artistId, triggerWord });
  const submitted = await submitLoraTraining({
    imageUrls: referenceImages,
    triggerWord,
    steps: 1000,
  });

  await db
    .update(artistLoras)
    .set({
      trainingJobId: submitted.requestId,
      status: 'training',
      updatedAt: new Date(),
    })
    .where(eq(artistLoras.id, row.id));

  return {
    loraRowId: row.id,
    trainingJobId: submitted.requestId,
    triggerWord,
    referenceImages,
    characterSheet: sheet,
  };
}

/**
 * Get the latest LoRA for an artist (any status).
 */
export async function getLatestArtistLora(artistId: number) {
  const [row] = await db
    .select()
    .from(artistLoras)
    .where(eq(artistLoras.artistId, artistId))
    .orderBy(desc(artistLoras.createdAt))
    .limit(1);
  return row || null;
}
