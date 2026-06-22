/**
 * Artist Career Suite — Tool Registry (artist-scoped)
 *
 * Registers tools that read the artist's OWN data + scoped memory/goals.
 * Tools pull `ctx.artistId` (set by the artist runtime) and only ever
 * touch rows belonging to that artist.
 *
 * IMPORTANT: This file MUST be imported once on server boot so the tools
 * register into the shared registry inside c-suite/tools.ts.
 */

import { z } from 'zod';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  users,
  songs,
  merchandise,
  salesTransactions,
  artistSuiteMemory,
  artistSuiteGoals,
  artistSuiteThreads,
} from '../../db/schema';
import { registerTool, type ToolContext } from '../c-suite/tools';
import { generateHiggsfieldImage, isHiggsfieldConfigured } from '../higgsfield-service';

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function requireArtistId(ctx: ToolContext): string {
  if (!ctx.artistId) {
    throw new Error('artistId missing in tool context (artist-scoped tool called outside artist runtime).');
  }
  return ctx.artistId;
}

/** Resolve the numeric users.id for a string artistId (which may be the
 *  numeric id-as-string OR a clerk id OR a slug). Returns null if not found. */
async function resolveUserPk(artistId: string): Promise<number | null> {
  const asInt = Number.parseInt(artistId, 10);
  if (Number.isFinite(asInt) && String(asInt) === artistId) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, asInt))
      .limit(1);
    if (u) return u.id;
  }
  // fallback: try clerk id
  const [byClerk] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, artistId))
    .limit(1);
  if (byClerk) return byClerk.id;
  // fallback: slug
  const [bySlug] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.slug, artistId))
    .limit(1);
  return bySlug?.id ?? null;
}

// ---------------------------------------------------------------
// READ-ONLY ARTIST DATA TOOLS  (autonomy 3)
// ---------------------------------------------------------------

registerTool({
  id: 'queryMyArtistOverview',
  description:
    'Snapshot of THIS artist: profile fields (name, genre, country), counts of songs / merch / videos, social links, account creation date. Always call this FIRST when the artist asks anything about themselves.',
  schema: z.object({}),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async (_input, ctx) => {
    const artistId = requireArtistId(ctx);
    const pk = await resolveUserPk(artistId);
    if (pk == null) {
      return { found: false, artistId, hint: 'No matching user row — artistId may be a Firestore-only AI artist.' };
    }
    const [u] = await db
      .select({
        id: users.id,
        artistName: users.artistName,
        username: users.username,
        email: users.email,
        role: users.role,
        genre: users.genre,
        genres: users.genres,
        country: users.country,
        location: users.location,
        biography: users.biography,
        website: users.website,
        instagram: users.instagramHandle,
        twitter: users.twitterHandle,
        youtube: users.youtubeChannel,
        spotifyUrl: users.spotifyUrl,
        tiktokUrl: users.tiktokUrl,
        isAIGenerated: users.isAIGenerated,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, pk))
      .limit(1);

    const [{ songCount }] = await db
      .select({ songCount: count() })
      .from(songs)
      .where(eq(songs.userId, pk));
    const [{ merchCount }] = await db
      .select({ merchCount: count() })
      .from(merchandise)
      .where(eq(merchandise.userId, pk));
    const [{ totalPlays }] = await db
      .select({ totalPlays: sql<number>`COALESCE(SUM(${songs.plays}), 0)::int` })
      .from(songs)
      .where(eq(songs.userId, pk));

    return {
      found: true,
      profile: u,
      counts: { songs: songCount, merch: merchCount, totalPlays },
    };
  },
});

registerTool({
  id: 'queryMyArtistSongStats',
  description:
    'Top songs of THIS artist with play counts, genre, mood, AI provider, release date and analysis status. Use to evaluate catalog performance.',
  schema: z.object({
    limit: z.number().min(1).max(50).default(10),
    sortBy: z.enum(['plays', 'recent']).default('plays'),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async ({ limit, sortBy }, ctx) => {
    const artistId = requireArtistId(ctx);
    const pk = await resolveUserPk(artistId);
    if (pk == null) return { rows: [], hint: 'artist not found in users table' };
    const orderBy = sortBy === 'plays'
      ? desc(songs.plays)
      : desc(songs.createdAt);
    const rows = await db
      .select({
        id: songs.id,
        title: songs.title,
        genre: songs.genre,
        mood: songs.mood,
        plays: songs.plays,
        releaseDate: songs.releaseDate,
        isPublished: songs.isPublished,
        generatedWithAI: songs.generatedWithAI,
        aiProvider: songs.aiProvider,
        analysisStatus: songs.analysisStatus,
        createdAt: songs.createdAt,
      })
      .from(songs)
      .where(eq(songs.userId, pk))
      .orderBy(orderBy)
      .limit(limit);
    const totalPlays = rows.reduce((s, r) => s + (r.plays || 0), 0);
    return { count: rows.length, totalPlaysInResult: totalPlays, songs: rows };
  },
});

registerTool({
  id: 'queryMyArtistMerchPerformance',
  description:
    'Active merchandise products for THIS artist: stock, price, production cost, status, view count. Use to evaluate which products move and which sit.',
  schema: z.object({ limit: z.number().min(1).max(50).default(20) }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async ({ limit }, ctx) => {
    const artistId = requireArtistId(ctx);
    const pk = await resolveUserPk(artistId);
    if (pk == null) return { rows: [] };
    const rows = await db
      .select({
        id: merchandise.id,
        name: merchandise.name,
        category: merchandise.category,
        price: merchandise.price,
        productionCost: merchandise.productionCost,
        stock: merchandise.stock,
        isAvailable: merchandise.isAvailable,
        productStatus: merchandise.productStatus,
        viewCount: merchandise.viewCount,
        aiGeneratedDesign: merchandise.aiGeneratedDesign,
        createdAt: merchandise.createdAt,
      })
      .from(merchandise)
      .where(eq(merchandise.userId, pk))
      .orderBy(desc(merchandise.viewCount))
      .limit(limit);
    return { count: rows.length, products: rows };
  },
});

registerTool({
  id: 'queryMyArtistFanMetrics',
  description:
    'Audience reach & growth signals for THIS artist: aggregate plays, social handles present, profile completeness. Coarse but real numbers — never invent.',
  schema: z.object({}),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'marketing',
  execute: async (_input, ctx) => {
    const artistId = requireArtistId(ctx);
    const pk = await resolveUserPk(artistId);
    if (pk == null) return { found: false };
    const [u] = await db
      .select({
        artistName: users.artistName,
        instagram: users.instagramHandle,
        twitter: users.twitterHandle,
        youtube: users.youtubeChannel,
        spotifyUrl: users.spotifyUrl,
        tiktokUrl: users.tiktokUrl,
        facebook: users.facebookUrl,
        biography: users.biography,
        profileImage: users.profileImage,
        coverImage: users.coverImage,
      })
      .from(users)
      .where(eq(users.id, pk))
      .limit(1);
    const [agg] = await db
      .select({
        totalPlays: sql<number>`COALESCE(SUM(${songs.plays}), 0)::int`,
        publishedSongs: sql<number>`COUNT(*) FILTER (WHERE ${songs.isPublished} = true)::int`,
      })
      .from(songs)
      .where(eq(songs.userId, pk));
    const socials = {
      instagram: !!u?.instagram,
      twitter: !!u?.twitter,
      youtube: !!u?.youtube,
      spotify: !!u?.spotifyUrl,
      tiktok: !!u?.tiktokUrl,
      facebook: !!u?.facebook,
    };
    const filledSocials = Object.values(socials).filter(Boolean).length;
    const profileCompleteness =
      [u?.artistName, u?.biography, u?.profileImage, u?.coverImage].filter(Boolean).length / 4;
    return {
      found: true,
      profile: u,
      aggregate: agg,
      socials,
      filledSocialsCount: filledSocials,
      profileCompleteness: Math.round(profileCompleteness * 100) / 100,
    };
  },
});

registerTool({
  id: 'queryMyArtistTreasury',
  description:
    'Revenue snapshot for THIS artist over the last N days: completed sales transactions sum + count. Returns 0 if no transactions or table unavailable. Never invent figures.',
  schema: z.object({ days: z.number().min(1).max(365).default(30) }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'finance',
  execute: async ({ days }, ctx) => {
    const artistId = requireArtistId(ctx);
    const pk = await resolveUserPk(artistId);
    if (pk == null) return { revenueUsd: 0, txCount: 0, found: false };
    const since = new Date(Date.now() - days * 86400 * 1000);
    try {
      const result = await db.execute(sql`
        SELECT
          COALESCE(SUM(amount_total)/100.0, 0)::float AS revenue_usd,
          COUNT(*)::int AS tx_count
        FROM sales_transactions
        WHERE artist_id = ${pk}
          AND created_at >= ${since.toISOString()}
          AND status = 'completed'
      `);
      const row = (result as any).rows?.[0] ?? {};
      return {
        days,
        since: since.toISOString(),
        revenueUsd: Number(row.revenue_usd ?? 0),
        txCount: Number(row.tx_count ?? 0),
      };
    } catch {
      return { days, since: since.toISOString(), revenueUsd: 0, txCount: 0, note: 'sales_transactions query failed (schema variant?)' };
    }
  },
});

registerTool({
  id: 'queryMyArtistMonetizationFunnel',
  description:
    'Per-channel revenue mix for THIS artist (merch units listed, songs published, AI-design merch share). Use to surface dependency risk.',
  schema: z.object({}),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'finance',
  execute: async (_input, ctx) => {
    const artistId = requireArtistId(ctx);
    const pk = await resolveUserPk(artistId);
    if (pk == null) return { found: false };
    const [songAgg] = await db
      .select({
        published: sql<number>`COUNT(*) FILTER (WHERE ${songs.isPublished} = true)::int`,
        total: sql<number>`COUNT(*)::int`,
      })
      .from(songs)
      .where(eq(songs.userId, pk));
    const [merchAgg] = await db
      .select({
        active: sql<number>`COUNT(*) FILTER (WHERE ${merchandise.isAvailable} = true)::int`,
        aiDesign: sql<number>`COUNT(*) FILTER (WHERE ${merchandise.aiGeneratedDesign} = true)::int`,
        total: sql<number>`COUNT(*)::int`,
      })
      .from(merchandise)
      .where(eq(merchandise.userId, pk));
    return {
      found: true,
      songs: songAgg,
      merch: merchAgg,
      diversification: {
        hasSongs: (songAgg?.published ?? 0) > 0,
        hasMerch: (merchAgg?.active ?? 0) > 0,
      },
    };
  },
});

// ---------------------------------------------------------------
// ARTIST-SCOPED MEMORY  (autonomy 3)
// ---------------------------------------------------------------

registerTool({
  id: 'recallArtistMemory',
  description: 'Recall stored lessons / facts / decisions for THIS artist + this agent.',
  schema: z.object({
    tags: z.array(z.string()).optional(),
    limit: z.number().min(1).max(50).default(10),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'meta',
  execute: async ({ tags, limit }, ctx) => {
    const artistId = requireArtistId(ctx);
    const agentKey = ctx.artistAgentKey;
    if (!agentKey) return { memories: [] };
    const rows = await db
      .select()
      .from(artistSuiteMemory)
      .where(
        and(
          eq(artistSuiteMemory.artistId, artistId),
          eq(artistSuiteMemory.agentKey, agentKey),
        ),
      )
      .orderBy(desc(artistSuiteMemory.weight), desc(artistSuiteMemory.createdAt))
      .limit(limit);
    const filtered = tags?.length
      ? rows.filter((r) => r.tags?.some((t) => tags.includes(t)))
      : rows;
    return {
      memories: filtered.map((m) => ({
        id: m.id,
        kind: m.kind,
        content: m.content,
        tags: m.tags,
        weight: m.weight,
      })),
    };
  },
});

registerTool({
  id: 'rememberArtistFact',
  description: 'Persist an IMPORTANT lesson / fact / decision into THIS artist + agent memory. Use sparingly.',
  schema: z.object({
    kind: z.enum(['lesson', 'fact', 'decision', 'feedback']),
    content: z.string().min(10).max(2000),
    tags: z.array(z.string()).optional(),
    weight: z.number().min(0).max(10).optional(),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: false,
  category: 'meta',
  execute: async ({ kind, content, tags, weight }, ctx) => {
    const artistId = requireArtistId(ctx);
    const agentKey = ctx.artistAgentKey;
    if (!agentKey) throw new Error('artistAgentKey missing in ctx');
    const [m] = await db
      .insert(artistSuiteMemory)
      .values({ artistId, agentKey, kind, content, tags, weight: weight ?? 1.0 })
      .returning();
    return { saved: true, id: m.id };
  },
});

// ---------------------------------------------------------------
// ARTIST-SCOPED GOALS  (autonomy 3)
// ---------------------------------------------------------------

registerTool({
  id: 'listArtistGoals',
  description: 'List goals for THIS artist; optional filters by owner agent or status.',
  schema: z.object({
    ownerAgent: z.string().optional(),
    status: z.enum(['draft', 'on_track', 'at_risk', 'off_track', 'achieved', 'missed']).optional(),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'goals',
  execute: async ({ ownerAgent, status }, ctx) => {
    const artistId = requireArtistId(ctx);
    const filters: any[] = [eq(artistSuiteGoals.artistId, artistId)];
    if (ownerAgent) filters.push(eq(artistSuiteGoals.ownerAgent, ownerAgent));
    if (status) filters.push(eq(artistSuiteGoals.status, status));
    const rows = await db
      .select()
      .from(artistSuiteGoals)
      .where(and(...filters))
      .orderBy(desc(artistSuiteGoals.createdAt))
      .limit(50);
    return { goals: rows };
  },
});

registerTool({
  id: 'checkInOnArtistGoal',
  description: 'Record a check-in on one of THIS artist\'s goals (updates currentValue + status).',
  schema: z.object({
    goalId: z.number(),
    measured: z.number(),
    notes: z.string().min(5).max(2000),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: false,
  category: 'goals',
  execute: async ({ goalId, measured, notes }, ctx) => {
    const artistId = requireArtistId(ctx);
    const [goal] = await db
      .select()
      .from(artistSuiteGoals)
      .where(and(eq(artistSuiteGoals.id, goalId), eq(artistSuiteGoals.artistId, artistId)))
      .limit(1);
    if (!goal) return { error: 'goal not found or not owned by this artist' };
    const target = Number(goal.targetValue);
    const baseline = goal.baseline != null ? Number(goal.baseline) : 0;
    const denom = target - baseline || target || 1;
    const progress = (measured - baseline) / denom;
    let status: typeof goal.status = goal.status;
    if (progress >= 1) status = 'achieved';
    else if (progress >= 0.7) status = 'on_track';
    else if (progress >= 0.4) status = 'at_risk';
    else status = 'off_track';
    if (!ctx.dryRun) {
      await db
        .update(artistSuiteGoals)
        .set({ currentValue: String(measured), status, updatedAt: new Date() })
        .where(eq(artistSuiteGoals.id, goalId));
    }
    return {
      goalId,
      progress: Math.round(progress * 100) / 100,
      status,
      notesRecorded: notes.length,
      dryRun: ctx.dryRun,
    };
  },
});

// ---------------------------------------------------------------
// HANDOFF — between this artist's own personal agents
// ---------------------------------------------------------------

registerTool({
  id: 'handoffToArtistAgent',
  description:
    "Hand off a question to ANOTHER personal agent of THIS SAME artist (e.g. manager → marketing). The target agent runs a fresh turn and replies.",
  schema: z.object({
    targetAgentKey: z.enum(['manager', 'marketing', 'ar', 'merch', 'finance']),
    topic: z.string().min(5).max(200),
    context: z.string().min(10).max(4000),
  }),
  requiredAutonomy: 3,
  risk: 2,
  readOnly: false,
  category: 'meta',
  execute: async ({ targetAgentKey, topic, context }, ctx) => {
    const artistId = requireArtistId(ctx);
    if (ctx.artistAgentKey === targetAgentKey) {
      return { error: 'cannot handoff to self' };
    }
    // Lazy import to avoid circular ref with runtime
    const { runArtistAgentTurn } = await import('./runtime');
    const result = await runArtistAgentTurn({
      artistId,
      agentKey: targetAgentKey as any,
      sessionType: 'personal',
      userMessage: `[handoff from ${ctx.artistAgentKey}] Topic: ${topic}\n\nContext:\n${context}`,
      parentThreadId: ctx.threadId,
      triggeredBy: `agent:${ctx.artistAgentKey}`,
      maxToolCalls: 4,
    });
    return {
      from: targetAgentKey,
      response: result.finalText,
      threadId: result.threadId,
      cost: result.totalCostUsd,
    };
  },
});

// ---------------------------------------------------------------
// CREATIVE — generate branded cover / poster / thumbnail images (Higgsfield)
// ---------------------------------------------------------------

registerTool({
  id: 'generateArtistCoverImage',
  description:
    "Generate a branded COVER / POSTER / THUMBNAIL image for THIS artist using Higgsfield Soul, preserving the artist's REAL likeness from their profile photo when available. Use it for lyric-video covers, YouTube thumbnails, song posters or promo art. Returns a permanent image URL. Costs image credits — call only when an image is actually needed.",
  schema: z.object({
    prompt: z.string().min(10).max(1500).describe('Vivid visual description of the cover/poster scene (style, mood, composition, any title text to render).'),
    aspectRatio: z.enum(['16:9', '1:1', '9:16', '4:5', '3:2']).default('16:9'),
    useArtistLikeness: z.boolean().default(true).describe('Use the artist profile photo as a reference so the artist appears as the hero.'),
    purpose: z.string().max(120).optional().describe('What this image is for, e.g. "lyric video cover", "YouTube thumbnail".'),
  }),
  requiredAutonomy: 2,
  risk: 3,
  readOnly: false,
  category: 'marketing',
  execute: async ({ prompt, aspectRatio, useArtistLikeness, purpose }, ctx) => {
    const artistId = requireArtistId(ctx);
    if (!isHiggsfieldConfigured()) {
      return { generated: false, reason: 'Higgsfield is not configured (missing HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET).' };
    }
    const pk = await resolveUserPk(artistId);
    let referenceImageUrl: string | undefined;
    if (useArtistLikeness && pk != null) {
      const [u] = await db
        .select({ profileImageUrl: users.profileImageUrl, profileImage: users.profileImage })
        .from(users)
        .where(eq(users.id, pk))
        .limit(1);
      const candidate = u?.profileImageUrl || u?.profileImage || undefined;
      if (candidate && /^https?:\/\//.test(candidate)) referenceImageUrl = candidate;
    }

    if (ctx.dryRun) {
      return {
        generated: false,
        dryRun: true,
        plan: { provider: 'higgsfield-soul', aspectRatio, usesLikeness: !!referenceImageUrl, purpose: purpose ?? null },
      };
    }

    const imageUrl = await generateHiggsfieldImage({
      prompt,
      referenceImageUrl,
      aspectRatio,
      folder: 'agent-cover-images',
    });
    if (!imageUrl) {
      return { generated: false, reason: 'Higgsfield returned no image (queue failure, moderation or timeout). Try again or simplify the prompt.' };
    }
    return { generated: true, imageUrl, provider: 'higgsfield-soul', aspectRatio, usedLikeness: !!referenceImageUrl, purpose: purpose ?? null };
  },
});

// ---------------------------------------------------------------
// Boot marker (so we can confirm the file was loaded)
// ---------------------------------------------------------------
console.log('[artist-suite] artist-tools registered: queryMyArtistOverview, queryMyArtistSongStats, queryMyArtistMerchPerformance, queryMyArtistFanMetrics, queryMyArtistTreasury, queryMyArtistMonetizationFunnel, recallArtistMemory, rememberArtistFact, listArtistGoals, checkInOnArtistGoal, handoffToArtistAgent, generateArtistCoverImage');
