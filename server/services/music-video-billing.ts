import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  creditTransactions,
  musicVideoCreditReservations,
  musicVideoProjects,
  userCredits,
} from '../db/schema';
import { CREDIT_PACKAGES, TIER_CREDIT_ALLOCATIONS } from '../../shared/credit-pricing';
import { getUserBalance } from './credit-engine';

export const MUSIC_VIDEO_MARKUP = 3;
const ADMIN_EMAIL = 'convoycubano@gmail.com';

const maxPurchaseBonus = Math.max(
  0,
  ...Object.values(TIER_CREDIT_ALLOCATIONS).map((tier) => tier.bonusCreditsOnPurchase || 0),
);

/**
 * Conservative cash value of a wallet credit. It accounts for the cheapest
 * package and the largest purchase bonus, so a nominal 3x quote remains close
 * to a real 3x cash margin even when discounted credits fund the operation.
 */
export const MUSIC_VIDEO_EFFECTIVE_CREDIT_USD = Math.min(
  ...CREDIT_PACKAGES.map((pkg) => pkg.priceUsd / (pkg.credits * (1 + maxPurchaseBonus / 100))),
);

export type MusicVideoStage =
  | 'script'
  | 'transcription'
  | 'image'
  | 'video'
  | 'lipsync'
  | 'render';

export interface MusicVideoQuoteInput {
  sceneCount?: number;
  clipDurationSeconds?: number;
  videoModel?: string;
  resolution?: '480p' | '720p' | '1080p';
  imageModel?: string;
  imageQuality?: string;
  includeScript?: boolean;
  includeTranscription?: boolean;
  includeLipSync?: boolean;
  lipSyncSeconds?: number;
  renderMinutes?: number;
}

export interface MusicVideoQuoteItem {
  stage: MusicVideoStage;
  label: string;
  provider: string;
  model: string;
  quantity: number;
  unit: string;
  providerCostUsd: number;
  credits: number;
}

const roundUsd = (value: number) => Number(value.toFixed(6));

export function creditsForMusicVideoCost(providerCostUsd: number): number {
  if (!Number.isFinite(providerCostUsd) || providerCostUsd <= 0) return 0;
  return Math.ceil((providerCostUsd * MUSIC_VIDEO_MARKUP) / MUSIC_VIDEO_EFFECTIVE_CREDIT_USD);
}

export function getWanCostPerSecond(resolution: string): number {
  if (resolution === '480p') return 0.05;
  if (resolution === '720p') return 0.10;
  return 0.20;
}

export function getKlingCost(model: string, durationSeconds: number): number {
  const seconds = Math.max(1, durationSeconds);
  if (model.includes('v3/pro')) return 0.112 * seconds;
  if (model.includes('o3')) return 0.168 * seconds;
  if (model.includes('2.5')) return 0.07 * seconds;
  if (model.includes('2.6')) return 0.07 * seconds;
  if (model.includes('o1')) return 0.10 * seconds;
  return 0.09 * seconds;
}

export function getMusicVideoImageEstimate(model: string, quality = 'high', referenceCount = 0): number {
  if (model.includes('flux-2-pro')) return 0.045;
  if (model.includes('flux-3')) return 0.09;
  const baseByQuality: Record<string, number> = {
    low: 0.08,
    medium: 0.18,
    high: 0.35,
    xhigh: 0.60,
    max: 0.90,
    auto: 0.35,
  };
  return (baseByQuality[quality] || baseByQuality.high) + Math.min(0.08, referenceCount * 0.01);
}

export function calculateOpenAIImageCostFromUsage(usage: any, fallbackCost: number): number {
  if (!usage || typeof usage !== 'object') return fallbackCost;
  const inputDetails = usage.input_tokens_details || usage.input_tokens_detail || {};
  const textInput = Number(inputDetails.text_tokens ?? usage.text_input_tokens ?? 0);
  const imageInput = Number(inputDetails.image_tokens ?? usage.image_input_tokens ?? 0);
  const totalInput = Number(usage.input_tokens ?? 0);
  const unclassifiedInput = Math.max(0, totalInput - textInput - imageInput);
  const output = Number(usage.output_tokens ?? usage.image_output_tokens ?? 0);
  const calculated = ((textInput + unclassifiedInput) * 5 + imageInput * 8 + output * 30) / 1_000_000;
  return calculated > 0 ? calculated : fallbackCost;
}

function videoProviderCost(model: string, resolution: string, seconds: number): number {
  if (model.includes('wan-3.0')) return getWanCostPerSecond(resolution) * seconds;
  if (model.includes('seedance-2.0/fast')) return 0.2419 * seconds;
  if (model.includes('seedance-2.0/mini')) return 0.144 * seconds;
  if (model.includes('pixverse')) return 0.12 * seconds;
  return getKlingCost(model, seconds);
}

export function calculateMusicVideoQuote(input: MusicVideoQuoteInput = {}) {
  const sceneCount = Math.min(200, Math.max(1, Math.round(Number(input.sceneCount) || 40)));
  const clipDuration = Math.min(30, Math.max(2, Number(input.clipDurationSeconds) || 5));
  const videoModel = input.videoModel || 'alibaba/wan-3.0/reference-to-video';
  const resolution = input.resolution || '1080p';
  const imageModel = input.imageModel || 'openai/gpt-image-2.5/sunburst';
  const imageQuality = input.imageQuality || 'high';
  const items: MusicVideoQuoteItem[] = [];

  const add = (item: Omit<MusicVideoQuoteItem, 'credits'>) => items.push({
    ...item,
    providerCostUsd: roundUsd(item.providerCostUsd),
    credits: creditsForMusicVideoCost(item.providerCostUsd),
  });

  if (input.includeScript !== false) {
    add({ stage: 'script', label: 'Narrative master script', provider: 'openai', model: 'gpt-6-astra', quantity: 1, unit: 'script', providerCostUsd: 0.80 });
  }
  if (input.includeTranscription !== false) {
    add({ stage: 'transcription', label: 'Lyrics transcription', provider: 'openai', model: 'whisper', quantity: 1, unit: 'song', providerCostUsd: 0.04 });
  }

  const imageUnitCost = getMusicVideoImageEstimate(imageModel, imageQuality);
  add({
    stage: 'image', label: 'Storyboard frames', provider: imageModel.startsWith('openai') ? 'openai' : 'fal',
    model: imageModel, quantity: sceneCount, unit: 'image', providerCostUsd: imageUnitCost * sceneCount,
  });

  const totalVideoSeconds = sceneCount * clipDuration;
  add({
    stage: 'video', label: 'Generated video clips', provider: 'fal', model: videoModel,
    quantity: totalVideoSeconds, unit: 'second', providerCostUsd: videoProviderCost(videoModel, resolution, totalVideoSeconds),
  });

  if (input.includeLipSync) {
    const lipSyncSeconds = Math.max(1, Number(input.lipSyncSeconds) || totalVideoSeconds * 0.35);
    add({ stage: 'lipsync', label: 'Performance lip sync', provider: 'fal', model: 'fal-ai/pixverse/lipsync', quantity: lipSyncSeconds, unit: 'second', providerCostUsd: lipSyncSeconds * 0.02 });
  }
  const renderMinutes = Math.max(1, Number(input.renderMinutes) || Math.ceil(totalVideoSeconds / 60));
  add({ stage: 'render', label: 'Final cloud render', provider: 'shotstack', model: 'final-render', quantity: renderMinutes, unit: 'minute', providerCostUsd: renderMinutes * 0.08 });

  const providerCostUsd = roundUsd(items.reduce((sum, item) => sum + item.providerCostUsd, 0));
  const credits = items.reduce((sum, item) => sum + item.credits, 0);
  return {
    quoteVersion: 'music-video-v1',
    currency: 'usd',
    markupMultiplier: MUSIC_VIDEO_MARKUP,
    effectiveCreditUsd: MUSIC_VIDEO_EFFECTIVE_CREDIT_USD,
    sceneCount,
    clipDurationSeconds: clipDuration,
    providerCostUsd,
    customerPriceUsd: roundUsd(providerCostUsd * MUSIC_VIDEO_MARKUP),
    credits,
    items,
  };
}

function scopedIdempotencyKey(userEmail: string, stage: string, key?: string) {
  const raw = `${userEmail.toLowerCase()}|${stage}|${key || randomUUID()}`;
  return createHash('sha256').update(raw).digest('hex');
}

export async function reserveMusicVideoCredits(options: {
  userEmail: string;
  stage: MusicVideoStage;
  provider: string;
  model: string;
  estimatedCostUsd: number;
  projectId?: number | null;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}) {
  const userEmail = options.userEmail.trim().toLowerCase();
  if (!userEmail) throw new Error('A verified account email is required.');
  const key = scopedIdempotencyKey(userEmail, options.stage, options.idempotencyKey);
  const credits = userEmail === ADMIN_EMAIL ? 0 : creditsForMusicVideoCost(options.estimatedCostUsd);

  const [existing] = await db.select().from(musicVideoCreditReservations)
    .where(eq(musicVideoCreditReservations.idempotencyKey, key)).limit(1);
  if (existing) return { ...existing, reused: true };

  await getUserBalance(userEmail);
  try {
    return await db.transaction(async (tx) => {
      const [reservation] = await tx.insert(musicVideoCreditReservations).values({
        userEmail,
        projectId: options.projectId || null,
        stage: options.stage,
        provider: options.provider,
        model: options.model,
        idempotencyKey: key,
        estimatedCostUsd: String(options.estimatedCostUsd),
        markupMultiplier: String(MUSIC_VIDEO_MARKUP),
        effectiveCreditUsd: String(MUSIC_VIDEO_EFFECTIVE_CREDIT_USD),
        reservedCredits: credits,
        metadata: options.metadata || {},
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }).returning();

      if (credits > 0) {
        const [wallet] = await tx.update(userCredits).set({
          credits: sql`${userCredits.credits} - ${credits}`,
          updatedAt: new Date(),
        }).where(sql`${userCredits.userEmail} = ${userEmail} AND ${userCredits.credits} >= ${credits}`)
          .returning({ credits: userCredits.credits });
        if (!wallet) throw new Error(`Insufficient credits. ${credits} credits are required.`);
        await tx.insert(creditTransactions).values({
          userEmail,
          amount: -credits,
          type: 'deduction',
          description: `Music Video reservation #${reservation.id}: ${options.stage} (${options.model})`,
          relatedProjectId: options.projectId || null,
        });
      }
      return { ...reservation, reused: false };
    });
  } catch (error: any) {
    if (String(error?.code) === '23505') {
      const [reservation] = await db.select().from(musicVideoCreditReservations)
        .where(eq(musicVideoCreditReservations.idempotencyKey, key)).limit(1);
      if (reservation) return { ...reservation, reused: true };
    }
    throw error;
  }
}

export async function bindMusicVideoProviderRequest(reservationId: number, providerRequestId: string) {
  const [reservation] = await db.update(musicVideoCreditReservations).set({
    providerRequestId,
    updatedAt: new Date(),
  }).where(and(
    eq(musicVideoCreditReservations.id, reservationId),
    eq(musicVideoCreditReservations.status, 'reserved'),
  )).returning();
  return reservation || null;
}

export async function getOwnedMusicVideoReservation(userEmail: string, providerRequestId: string) {
  const [reservation] = await db.select().from(musicVideoCreditReservations).where(and(
    eq(musicVideoCreditReservations.userEmail, userEmail.trim().toLowerCase()),
    eq(musicVideoCreditReservations.providerRequestId, providerRequestId),
  )).limit(1);
  return reservation || null;
}

export async function settleMusicVideoReservation(
  reservationId: number,
  actualCostUsd?: number,
  metadata?: Record<string, any>,
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${reservationId})`);
    const [current] = await tx.select().from(musicVideoCreditReservations)
      .where(eq(musicVideoCreditReservations.id, reservationId)).limit(1);
    if (!current || current.status !== 'reserved') return current || null;

    const desired = creditsForMusicVideoCost(actualCostUsd ?? Number(current.estimatedCostUsd));
    const settledCredits = Math.min(current.reservedCredits, desired);
    const refundCredits = Math.max(0, current.reservedCredits - settledCredits);
    if (refundCredits > 0) {
      await tx.update(userCredits).set({
        credits: sql`${userCredits.credits} + ${refundCredits}`,
        updatedAt: new Date(),
      }).where(eq(userCredits.userEmail, current.userEmail));
      await tx.insert(creditTransactions).values({
        userEmail: current.userEmail,
        amount: refundCredits,
        type: 'refund',
        description: `Music Video reservation #${current.id}: unused credit release`,
        relatedProjectId: current.projectId,
      });
    }

    const [updated] = await tx.update(musicVideoCreditReservations).set({
      status: 'settled',
      actualCostUsd: String(actualCostUsd ?? Number(current.estimatedCostUsd)),
      settledCredits,
      refundedCredits: refundCredits,
      metadata: { ...((current.metadata as any) || {}), ...(metadata || {}) },
      updatedAt: new Date(),
    }).where(and(
      eq(musicVideoCreditReservations.id, current.id),
      eq(musicVideoCreditReservations.status, 'reserved'),
    )).returning();

    if (current.projectId && settledCredits > 0) {
      await tx.update(musicVideoProjects).set({
        creditsUsed: sql`${musicVideoProjects.creditsUsed} + ${settledCredits}`,
        updatedAt: new Date(),
      }).where(eq(musicVideoProjects.id, current.projectId));
    }
    return updated || current;
  });
}

export async function refundMusicVideoReservation(reservationId: number, errorMessage?: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${reservationId})`);
    const [current] = await tx.select().from(musicVideoCreditReservations)
      .where(eq(musicVideoCreditReservations.id, reservationId)).limit(1);
    if (!current || current.status !== 'reserved') return current || null;
    if (current.reservedCredits > 0) {
      await tx.update(userCredits).set({
        credits: sql`${userCredits.credits} + ${current.reservedCredits}`,
        updatedAt: new Date(),
      }).where(eq(userCredits.userEmail, current.userEmail));
      await tx.insert(creditTransactions).values({
        userEmail: current.userEmail,
        amount: current.reservedCredits,
        type: 'refund',
        description: `Music Video reservation #${current.id}: provider failure refund`,
        relatedProjectId: current.projectId,
      });
    }
    const [updated] = await tx.update(musicVideoCreditReservations).set({
      status: 'refunded',
      refundedCredits: current.reservedCredits,
      errorMessage: errorMessage?.slice(0, 2000),
      updatedAt: new Date(),
    }).where(and(
      eq(musicVideoCreditReservations.id, current.id),
      eq(musicVideoCreditReservations.status, 'reserved'),
    )).returning();
    return updated || current;
  });
}

export async function listMusicVideoBilling(userEmail: string, limit = 50) {
  return db.select().from(musicVideoCreditReservations)
    .where(eq(musicVideoCreditReservations.userEmail, userEmail.trim().toLowerCase()))
    .orderBy(desc(musicVideoCreditReservations.createdAt))
    .limit(Math.min(100, Math.max(1, limit)));
}
