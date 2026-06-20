/**
 * Audience Capture Engine — core service
 * Powers hook generation, content scoring, auto-regeneration and pattern memory.
 */
import { db } from '../db';
import {
  audienceProfiles,
  contentPillarsConfig,
  contentCaptureScores,
  contentMemory,
  contentExperiments,
  dailyContentPlans,
} from '../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { callAI } from '../utils/smart-ai';
import type {
  AudienceProfile,
  ContentPillarConfig,
  ContentCaptureScore,
  ContentMemoryEntry,
  DailyContentPlan,
  AudienceCaptureGenerateRequest,
  AudienceCaptureGenerateResponse,
  HookGenerationRequest,
  HookGenerationResponse,
  WinningPatterns,
  Platform,
} from '../../shared/types/audience-capture';
import { v4 as uuidv4 } from 'uuid';

// ─── Audience Profile ─────────────────────────────────────────────────────────

export async function getAudienceProfile(artistId: number) {
  const rows = await db
    .select()
    .from(audienceProfiles)
    .where(eq(audienceProfiles.artistId, artistId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertAudienceProfile(artistId: number, data: Partial<AudienceProfile>) {
  const existing = await getAudienceProfile(artistId);
  if (existing) {
    const [updated] = await db
      .update(audienceProfiles)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(audienceProfiles.artistId, artistId))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(audienceProfiles)
    .values({ artistId, ...(data as any) })
    .returning();
  return created;
}

// ─── Content Pillars ──────────────────────────────────────────────────────────

export async function getContentPillars(artistId: number) {
  return db
    .select()
    .from(contentPillarsConfig)
    .where(eq(contentPillarsConfig.artistId, artistId));
}

export async function upsertContentPillar(artistId: number, pillar: string, data: Partial<ContentPillarConfig>) {
  const existing = await db
    .select()
    .from(contentPillarsConfig)
    .where(
      and(
        eq(contentPillarsConfig.artistId, artistId),
        eq(contentPillarsConfig.pillar, pillar as any),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(contentPillarsConfig)
      .set(data as any)
      .where(
        and(
          eq(contentPillarsConfig.artistId, artistId),
          eq(contentPillarsConfig.pillar, pillar as any),
        ),
      )
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(contentPillarsConfig)
    .values({ artistId, pillar: pillar as any, ...data } as any)
    .returning();
  return created;
}

// ─── Content Scoring ──────────────────────────────────────────────────────────

const SCORE_WEIGHTS = {
  hookStrength: 0.25,
  retentionPotential: 0.20,
  identityAlignment: 0.20,
  sharePotential: 0.10,
  commentTrigger: 0.10,
  conversionIntent: 0.10,
  platformFit: 0.05,
};

export async function scoreContent(
  artistId: number,
  content: {
    hook: string;
    script: string;
    caption: string;
    cta: string;
    platform: Platform;
  },
  audienceProfile?: any,
): Promise<ContentCaptureScore> {
  const profile = audienceProfile ?? (await getAudienceProfile(artistId));

  const profileContext = profile
    ? `
Artist archetype: ${profile.archetype}
Artist promise: ${profile.promise}
Visual identity: ${profile.visualIdentity}
Tone: ${profile.tone}
Audience interests: ${(profile.interests ?? []).join(', ')}
Emotional triggers: ${(profile.emotionalTriggers ?? []).join(', ')}`
    : 'No audience profile configured.';

  const prompt = `You are a content performance expert for music artists on social media.
Score the following content piece for artist ID ${artistId} on a scale of 0-100 for each metric.

${profileContext}

PLATFORM: ${content.platform}
HOOK: ${content.hook}
SCRIPT: ${content.script}
CAPTION: ${content.caption}
CTA: ${content.cta}

Return ONLY a JSON object with these exact keys (integers 0-100):
{
  "hookStrength": ...,
  "retentionPotential": ...,
  "identityAlignment": ...,
  "sharePotential": ...,
  "commentTrigger": ...,
  "conversionIntent": ...,
  "platformFit": ...
}`;

  let scores = {
    hookStrength: 70,
    retentionPotential: 70,
    identityAlignment: 70,
    sharePotential: 65,
    commentTrigger: 65,
    conversionIntent: 60,
    platformFit: 75,
  };

  try {
    const raw = await callAI('content', [{ role: 'user', content: prompt }], {
      requireJSON: true,
      temperature: 0.2,
      label: 'audience-capture-score',
    });
    const parsed = JSON.parse(raw);
    scores = {
      hookStrength: clamp(parsed.hookStrength ?? 70),
      retentionPotential: clamp(parsed.retentionPotential ?? 70),
      identityAlignment: clamp(parsed.identityAlignment ?? 70),
      sharePotential: clamp(parsed.sharePotential ?? 65),
      commentTrigger: clamp(parsed.commentTrigger ?? 65),
      conversionIntent: clamp(parsed.conversionIntent ?? 60),
      platformFit: clamp(parsed.platformFit ?? 75),
    };
  } catch (err) {
    logger.warn('[AudienceCaptureEngine] score fallback to defaults', { artistId, err });
  }

  const overall = Math.round(
    scores.hookStrength * SCORE_WEIGHTS.hookStrength +
    scores.retentionPotential * SCORE_WEIGHTS.retentionPotential +
    scores.identityAlignment * SCORE_WEIGHTS.identityAlignment +
    scores.sharePotential * SCORE_WEIGHTS.sharePotential +
    scores.commentTrigger * SCORE_WEIGHTS.commentTrigger +
    scores.conversionIntent * SCORE_WEIGHTS.conversionIntent +
    scores.platformFit * SCORE_WEIGHTS.platformFit,
  );

  const contentRef = uuidv4();
  const [saved] = await db
    .insert(contentCaptureScores)
    .values({
      artistId,
      contentRef,
      ...scores,
      overallScore: overall,
      platform: content.platform,
      regeneratedCount: 0,
      rawContent: content as any,
    })
    .returning();

  return {
    ...saved,
    platform: saved.platform as Platform,
  };
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

// ─── Generate Content ─────────────────────────────────────────────────────────

export async function generateContent(
  req: AudienceCaptureGenerateRequest,
  regenerationAttempt = 0,
): Promise<AudienceCaptureGenerateResponse> {
  const profile = await getAudienceProfile(req.artistId);
  const memory = await getWinningPatterns(req.artistId);

  const profileContext = profile
    ? `
Artist archetype: ${profile.archetype}
Promise: ${profile.promise}
Visual identity: ${profile.visualIdentity}
Tone: ${profile.tone}
Primary audience: ${profile.primaryAgeRange}, ${(profile.languages ?? []).join('/')}
Locations: ${(profile.locations ?? []).join(', ')}
Interests: ${(profile.interests ?? []).join(', ')}
Emotional triggers: ${(profile.emotionalTriggers ?? []).join(', ')}`
    : '';

  const memoryContext =
    memory.bestHooks.length > 0
      ? `
Known winning hooks for this artist: "${memory.bestHooks.slice(0, 3).join('" | "')}"
Winning CTAs: "${memory.bestCtas.slice(0, 3).join('" | "')}"`
      : '';

  const prompt = `You are a master content strategist for music artists.
Create one piece of social media content for a music artist.

${profileContext}
${memoryContext}

PLATFORM: ${req.platform}
GOAL: ${req.goal.replace(/_/g, ' ')}
CONTENT TYPE: ${req.contentType.replace(/_/g, ' ')}
LANGUAGE: ${req.language ?? 'es'}
DURATION: ${req.duration ?? '30s'}

Requirements:
- The hook MUST stop the scroll in the first 1-3 seconds
- Use the HOOK + IDENTITY + EMOTION + ACTION formula
- The CTA must push ONE specific action
- Generate 4-6 relevant hashtags
- Keep the script tight for the given duration

Return ONLY a JSON object:
{
  "hook": "...",
  "script": "...",
  "visualPrompt": "...",
  "caption": "...",
  "cta": "...",
  "hashtags": ["...", "..."]
}`;

  let generated = {
    hook: '',
    script: '',
    visualPrompt: '',
    caption: '',
    cta: '',
    hashtags: [] as string[],
  };

  try {
    const raw = await callAI('content', [{ role: 'user', content: prompt }], {
      requireJSON: true,
      temperature: 0.8,
      label: 'audience-capture-generate',
    });
    const parsed = JSON.parse(raw);
    generated = {
      hook: parsed.hook ?? '',
      script: parsed.script ?? '',
      visualPrompt: parsed.visualPrompt ?? '',
      caption: parsed.caption ?? '',
      cta: parsed.cta ?? '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    };
  } catch (err) {
    logger.error('[AudienceCaptureEngine] generate failed', { artistId: req.artistId, err });
    throw err;
  }

  const scoreResult = await scoreContent(req.artistId, {
    hook: generated.hook,
    script: generated.script,
    caption: generated.caption,
    cta: generated.cta,
    platform: req.platform,
  }, profile);

  // Auto-regenerate if score < 80 (max 3 attempts)
  if (scoreResult.overallScore < 80 && regenerationAttempt < 3) {
    logger.info('[AudienceCaptureEngine] score below 80, regenerating', {
      artistId: req.artistId,
      score: scoreResult.overallScore,
      attempt: regenerationAttempt + 1,
    });
    const regen = await generateContent(req, regenerationAttempt + 1);
    return { ...regen, wasRegenerated: true };
  }

  return {
    hook: generated.hook,
    script: generated.script,
    visualPrompt: generated.visualPrompt,
    caption: generated.caption,
    cta: generated.cta,
    hashtags: generated.hashtags,
    score: {
      hookStrength: scoreResult.hookStrength,
      retentionPotential: scoreResult.retentionPotential,
      identityAlignment: scoreResult.identityAlignment,
      conversionIntent: scoreResult.conversionIntent,
      overall: scoreResult.overallScore,
    },
    wasRegenerated: regenerationAttempt > 0,
  };
}

// ─── Hook Generation ──────────────────────────────────────────────────────────

export async function generateHooks(req: HookGenerationRequest): Promise<HookGenerationResponse> {
  const profile = await getAudienceProfile(req.artistId);
  const memory = await getWinningPatterns(req.artistId);

  const profileContext = profile
    ? `Artist archetype: ${profile.archetype} | Tone: ${profile.tone} | Triggers: ${(profile.emotionalTriggers ?? []).join(', ')}`
    : '';
  const memoryContext =
    memory.losingHooks.length > 0
      ? `Avoid patterns like: "${memory.losingHooks.slice(0, 2).join('" or "')}"`
      : '';

  const typeInstruction = req.hookType && req.hookType !== 'mixed'
    ? `All hooks must be of type: ${req.hookType}`
    : 'Mix different hook types: curiosity, status, emotional, community';

  const prompt = `You are a viral content hook writer for music artists on ${req.platform}.
${profileContext}
${memoryContext}

${typeInstruction}

Write exactly ${req.count} unique hooks. Each hook must:
- Stop the scroll in 1-3 seconds
- Be under 15 words
- Feel authentic, not generic

Hook types:
- curiosity: build intrigue, make them need to know more
- status: aspirational, power, prestige  
- emotional: deep feelings, personal connection
- community: invite belonging, participation

Return ONLY a JSON array:
[
  { "text": "...", "type": "curiosity|status|emotional|community" },
  ...
]`;

  let items: Array<{ text: string; type: string }> = [];
  try {
    const raw = await callAI('content', [{ role: 'user', content: prompt }], {
      requireJSON: true,
      temperature: 0.9,
      label: 'audience-capture-hooks',
    });
    const parsed = JSON.parse(raw);
    items = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.error('[AudienceCaptureEngine] generateHooks failed', { err });
    throw err;
  }

  // Score each hook (light heuristic, no full DB save)
  const hooks = items.map((item, i) => ({
    id: uuidv4(),
    text: item.text ?? '',
    type: (['curiosity', 'status', 'emotional', 'community'].includes(item.type)
      ? item.type
      : 'curiosity') as any,
    score: 70 + Math.round(Math.random() * 20),  // placeholder until real scoring
    platform: req.platform,
  }));

  return { hooks };
}

// ─── Winning Patterns Memory ──────────────────────────────────────────────────

export async function getWinningPatterns(artistId: number): Promise<WinningPatterns> {
  const rows = await db
    .select()
    .from(contentMemory)
    .where(eq(contentMemory.artistId, artistId))
    .orderBy(desc(contentMemory.createdAt))
    .limit(100);

  const bestHooks = rows
    .filter((r) => r.type === 'winning_hook')
    .map((r) => r.value);
  const losingHooks = rows
    .filter((r) => r.type === 'losing_hook')
    .map((r) => r.value);
  const bestCtas = rows
    .filter((r) => r.type === 'winning_cta')
    .map((r) => r.value);
  const bestVisuals = rows
    .filter((r) => r.type === 'winning_format')
    .map((r) => r.value);

  const platformCounts: Record<string, number> = {};
  for (const r of rows) {
    platformCounts[r.platform] = (platformCounts[r.platform] ?? 0) + 1;
  }
  const topPlatforms = (Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p) as Platform[]).slice(0, 3);

  return { artistId, bestHooks, losingHooks, bestCtas, bestVisuals, topPlatforms };
}

export async function saveMemoryEntry(artistId: number, entry: Omit<ContentMemoryEntry, 'artistId'>) {
  const [saved] = await db
    .insert(contentMemory)
    .values({ artistId, ...entry } as any)
    .returning();
  return saved;
}

// ─── Daily Content Plan ───────────────────────────────────────────────────────

export async function getDailyPlan(artistId: number, date: string) {
  const rows = await db
    .select()
    .from(dailyContentPlans)
    .where(
      and(
        eq(dailyContentPlans.artistId, artistId),
        eq(dailyContentPlans.planDate, date),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function generateDailyPlan(artistId: number, date: string): Promise<DailyContentPlan> {
  const profile = await getAudienceProfile(artistId);
  const pillars = await getContentPillars(artistId);
  const activePillars = pillars.filter((p) => p.isActive).map((p) => p.pillar);

  const prompt = `You are a content strategist for a music artist.
Artist profile: ${profile ? JSON.stringify({ archetype: profile.archetype, tone: profile.tone, platforms: profile.platforms }) : 'not configured yet'}
Active content pillars: ${activePillars.join(', ') || 'all'}
Date: ${date}

Create a realistic daily content production plan. Return ONLY JSON:
{
  "hookTests": <number 5-10>,
  "shortReels": <number 2-5>,
  "stories": <number 3-10>,
  "communityPosts": <number 1-3>,
  "conversionPosts": <number 1-2>,
  "adVariations": <number 0-5>,
  "retargetingAssets": <number 0-3>,
  "rationale": "one sentence why this allocation"
}`;

  let planData = {
    hookTests: 5,
    shortReels: 3,
    stories: 5,
    communityPosts: 2,
    conversionPosts: 1,
    adVariations: 0,
    retargetingAssets: 0,
  };

  try {
    const raw = await callAI('content', [{ role: 'user', content: prompt }], {
      requireJSON: true,
      temperature: 0.5,
      label: 'audience-capture-daily-plan',
    });
    const parsed = JSON.parse(raw);
    planData = {
      hookTests: parsed.hookTests ?? 5,
      shortReels: parsed.shortReels ?? 3,
      stories: parsed.stories ?? 5,
      communityPosts: parsed.communityPosts ?? 2,
      conversionPosts: parsed.conversionPosts ?? 1,
      adVariations: parsed.adVariations ?? 0,
      retargetingAssets: parsed.retargetingAssets ?? 0,
    };
  } catch (err) {
    logger.warn('[AudienceCaptureEngine] daily plan fallback to defaults', { err });
  }

  // Upsert
  const existing = await getDailyPlan(artistId, date);
  if (existing) {
    const [updated] = await db
      .update(dailyContentPlans)
      .set({ ...planData, updatedAt: new Date() } as any)
      .where(
        and(
          eq(dailyContentPlans.artistId, artistId),
          eq(dailyContentPlans.planDate, date),
        ),
      )
      .returning();
    return updated as unknown as DailyContentPlan;
  }

  const [created] = await db
    .insert(dailyContentPlans)
    .values({ artistId, planDate: date, ...planData, status: 'draft' })
    .returning();
  return created as unknown as DailyContentPlan;
}
