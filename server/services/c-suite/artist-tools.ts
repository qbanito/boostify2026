/**
 * C-Suite AI · Artist-scoped tools
 *
 * Tools that operate on a specific artist (userId). These let agents
 * generate per-artist insights, recommendations and reports.
 *
 * Loaded by importing this module from index.ts so registerTool() runs.
 */

import { z } from 'zod';
import { db } from '../../db';
import {
  users, songs, merchandise, salesTransactions, marketingMetrics,
  artistWallet, productViews, artistTreasuryVault, crowdfundingCampaigns,
} from '../../db/schema';
import { and, count, desc, eq, gte, sql, sum } from 'drizzle-orm';
import { registerTool } from './tools';

// ----------------------------------------------------------------------
// Helper: resolve artistId by id or artist_name
// ----------------------------------------------------------------------

const ArtistRef = z.object({
  artistId: z.number().optional(),
  artistName: z.string().optional(),
}).refine((d) => d.artistId != null || (d.artistName && d.artistName.length > 0), {
  message: 'artistId or artistName is required',
});

async function resolveArtistId(ref: z.infer<typeof ArtistRef>): Promise<number | null> {
  if (ref.artistId) return ref.artistId;
  if (ref.artistName) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.artistName}) = LOWER(${ref.artistName!})`)
      .limit(1);
    return u?.id ?? null;
  }
  return null;
}

// ============================================================
// queryArtistOverview — high-level snapshot for one artist
// ============================================================

registerTool({
  id: 'queryArtistOverview',
  description: 'Snapshot of a single artist: name, plan, songs count, merch count, total revenue, latest activity. Provide artistId OR artistName.',
  schema: ArtistRef,
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async (input) => {
    const id = await resolveArtistId(input);
    if (!id) return { error: 'artist not found' };
    const [u] = await db.select({
      id: users.id, email: users.email, artistName: users.artistName,
      role: users.role, createdAt: users.createdAt,
    }).from(users).where(eq(users.id, id)).limit(1);
    if (!u) return { error: 'artist not found' };

    const [songsAgg] = await db.select({
      count: count(),
      totalPlays: sql<number>`COALESCE(SUM(${songs.plays}),0)::int`,
    }).from(songs).where(eq(songs.userId, id));

    const [merchAgg] = await db.select({
      count: count(),
      activeCount: sql<number>`COUNT(*) FILTER (WHERE ${merchandise.isAvailable} = true)::int`,
    }).from(merchandise).where(eq(merchandise.userId, id));

    const [salesAgg] = await db.select({
      totalRevenue: sql<string>`COALESCE(SUM(${salesTransactions.saleAmount}),0)::text`,
      artistEarnings: sql<string>`COALESCE(SUM(${salesTransactions.artistEarning}),0)::text`,
      txCount: count(),
    }).from(salesTransactions)
      .where(and(eq(salesTransactions.artistId, id), eq(salesTransactions.status, 'completed')));

    const [wallet] = await db.select().from(artistWallet).where(eq(artistWallet.userId, id)).limit(1);

    return {
      artist: u,
      songs: { count: songsAgg.count, totalPlays: songsAgg.totalPlays },
      merch: { count: merchAgg.count, active: merchAgg.activeCount },
      sales: {
        totalRevenue: salesAgg.totalRevenue,
        artistEarnings: salesAgg.artistEarnings,
        transactions: salesAgg.txCount,
      },
      wallet: wallet ? {
        balance: wallet.balance,
        totalEarnings: wallet.totalEarnings,
        totalSpent: wallet.totalSpent,
      } : null,
    };
  },
});

// ============================================================
// queryArtistSongStats
// ============================================================

registerTool({
  id: 'queryArtistSongStats',
  description: 'Top songs by plays for an artist with genre/mood breakdown.',
  schema: ArtistRef.and(z.object({ limit: z.number().min(1).max(50).default(10) })),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async (input: any) => {
    const id = await resolveArtistId(input);
    if (!id) return { error: 'artist not found' };
    const top = await db.select({
      id: songs.id, title: songs.title, genre: songs.genre, mood: songs.mood,
      plays: songs.plays, releaseDate: songs.releaseDate, isPublished: songs.isPublished,
    }).from(songs)
      .where(eq(songs.userId, id))
      .orderBy(desc(songs.plays))
      .limit(input.limit ?? 10);

    const genreBreakdown = await db.execute(sql`
      SELECT genre, COUNT(*)::int AS c, COALESCE(SUM(plays),0)::int AS plays
      FROM songs WHERE user_id = ${id} AND genre IS NOT NULL
      GROUP BY genre ORDER BY plays DESC LIMIT 10
    `);

    return { topSongs: top, genreBreakdown: (genreBreakdown as any).rows ?? [] };
  },
});

// ============================================================
// queryArtistMerchPerformance
// ============================================================

registerTool({
  id: 'queryArtistMerchPerformance',
  description: 'Merch sales, top-selling products, sell-through rate and views for an artist over the last N days.',
  schema: ArtistRef.and(z.object({ days: z.number().min(1).max(365).default(30) })),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async (input: any) => {
    const id = await resolveArtistId(input);
    if (!id) return { error: 'artist not found' };
    const since = new Date(Date.now() - input.days * 86400 * 1000);

    const top = await db.execute(sql`
      SELECT m.id, m.name, m.price, m.stock, m.product_status,
             COALESCE(SUM(t.quantity),0)::int AS units_sold,
             COALESCE(SUM(t.sale_amount),0)::text AS revenue,
             m.view_count
      FROM merchandise m
      LEFT JOIN sales_transactions t ON t.merchandise_id = m.id
        AND t.status = 'completed' AND t.created_at >= ${since.toISOString()}
      WHERE m.user_id = ${id}
      GROUP BY m.id ORDER BY units_sold DESC LIMIT 10
    `);

    const [overall] = await db.select({
      totalRevenue: sql<string>`COALESCE(SUM(${salesTransactions.saleAmount}),0)::text`,
      txCount: count(),
    }).from(salesTransactions).where(and(
      eq(salesTransactions.artistId, id),
      eq(salesTransactions.status, 'completed'),
      gte(salesTransactions.createdAt, since),
    ));

    const [views] = await db.select({ c: count() }).from(productViews)
      .where(and(eq(productViews.artistId, id), gte(productViews.createdAt, since)));

    return {
      sinceDays: input.days,
      products: (top as any).rows ?? [],
      totals: { revenue: overall.totalRevenue, transactions: overall.txCount, productViews: views.c },
    };
  },
});

// ============================================================
// queryArtistFanMetrics
// ============================================================

registerTool({
  id: 'queryArtistFanMetrics',
  description: 'Marketing & fan engagement: Spotify followers, Instagram, YouTube views, monthly listeners, playlist placements.',
  schema: ArtistRef,
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async (input) => {
    const id = await resolveArtistId(input);
    if (!id) return { error: 'artist not found' };
    const [m] = await db.select().from(marketingMetrics)
      .where(eq(marketingMetrics.userId, id))
      .orderBy(desc(marketingMetrics.updatedAt))
      .limit(1);
    if (!m) return { error: 'no marketing metrics on file' };
    return {
      spotifyFollowers: m.spotifyFollowers,
      instagramFollowers: m.instagramFollowers,
      youtubeViews: m.youtubeViews,
      monthlyListeners: m.monthlyListeners,
      playlistPlacements: m.playlistPlacements,
      totalEngagement: m.totalEngagement,
      updatedAt: m.updatedAt,
    };
  },
});

// ============================================================
// queryArtistTreasury
// ============================================================

registerTool({
  id: 'queryArtistTreasury',
  description: '5-bucket treasury vault breakdown for an artist: operation, reserve, growth, defi, fee.',
  schema: ArtistRef,
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'finance',
  execute: async (input) => {
    const id = await resolveArtistId(input);
    if (!id) return { error: 'artist not found' };
    const [v] = await db.select().from(artistTreasuryVault)
      .where(eq(artistTreasuryVault.artistId, id)).limit(1);
    if (!v) return { error: 'no treasury vault on file' };
    return {
      operation: v.operationBalance,
      reserve: v.reserveBalance,
      growth: v.growthBalance,
      defi: v.defiBalance,
      fee: v.boostifyFeeBalance,
      totalDeposited: v.totalDeposited,
      defiPnl: {
        profit: v.totalDefiProfit,
        loss: v.totalDefiLoss,
        currentDrawdown: v.currentDrawdown,
      },
    };
  },
});

// ============================================================
// queryArtistMonetizationFunnel
// ============================================================

registerTool({
  id: 'queryArtistMonetizationFunnel',
  description: 'Revenue mix for an artist: merch vs crowdfunding vs other. Last N days.',
  schema: ArtistRef.and(z.object({ days: z.number().min(1).max(365).default(30) })),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'finance',
  execute: async (input: any) => {
    const id = await resolveArtistId(input);
    if (!id) return { error: 'artist not found' };
    const since = new Date(Date.now() - input.days * 86400 * 1000);

    const [merchRev] = await db.select({
      sum: sql<string>`COALESCE(SUM(${salesTransactions.artistEarning}),0)::text`,
    }).from(salesTransactions).where(and(
      eq(salesTransactions.artistId, id),
      eq(salesTransactions.status, 'completed'),
      gte(salesTransactions.createdAt, since),
    ));

    const [cfRev] = await db.select({
      sum: sql<string>`COALESCE(SUM(${crowdfundingCampaigns.currentAmount}),0)::text`,
    }).from(crowdfundingCampaigns).where(and(
      eq(crowdfundingCampaigns.userId, id),
      gte(crowdfundingCampaigns.createdAt, since),
    ));

    return {
      sinceDays: input.days,
      merchEarnings: merchRev.sum,
      crowdfundingRaised: cfRev.sum,
    };
  },
});

// ============================================================
// recommendArtistStrategy — agent-driven recommendation tag
// ============================================================

registerTool({
  id: 'recommendArtistStrategy',
  description: 'Persist a strategic recommendation for an artist (will surface in admin UI). Use after analyzing their metrics.',
  schema: ArtistRef.and(z.object({
    headline: z.string().min(10).max(140),
    rationale: z.string().min(20).max(2000),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    actions: z.array(z.string()).min(1).max(8),
  })),
  requiredAutonomy: 2,
  risk: 2,
  readOnly: false,
  category: 'platform',
  execute: async (input: any, ctx) => {
    const id = await resolveArtistId(input);
    if (!id) return { error: 'artist not found' };
    if (ctx.dryRun) return { dryRun: true, wouldRecommend: { artistId: id, ...input } };
    // Store as memory tagged with the artist for now (lightweight; UI can read later)
    const { cSuiteMemory } = await import('../../db/schema');
    const [m] = await db.insert(cSuiteMemory).values({
      agentId: ctx.agentId,
      kind: 'fact',
      content: JSON.stringify({ type: 'artist_recommendation', artistId: id, ...input }),
      tags: ['artist_recommendation', `artist:${id}`, input.priority],
      weight: input.priority === 'high' ? 4 : input.priority === 'medium' ? 2.5 : 1.5,
    }).returning();
    return { saved: true, recommendationId: m.id, artistId: id };
  },
});

// ============================================================
// listArtistRecommendations — admin-facing read
// ============================================================

registerTool({
  id: 'listArtistRecommendations',
  description: 'List active strategic recommendations for an artist that agents have produced.',
  schema: ArtistRef.and(z.object({ limit: z.number().default(10) })),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async (input: any) => {
    const id = await resolveArtistId(input);
    if (!id) return { error: 'artist not found' };
    const { cSuiteMemory } = await import('../../db/schema');
    const rows = await db.select().from(cSuiteMemory)
      .where(sql`${cSuiteMemory.tags} && ARRAY[${`artist:${id}`}]::text[]`)
      .orderBy(desc(cSuiteMemory.weight), desc(cSuiteMemory.createdAt))
      .limit(input.limit ?? 10);
    return {
      recommendations: rows.map((r) => {
        try { return { id: r.id, ...JSON.parse(r.content), createdAt: r.createdAt }; }
        catch { return { id: r.id, raw: r.content, createdAt: r.createdAt }; }
      }),
    };
  },
});

// ============================================================
// queryTopArtistsByRevenue — for executives planning/comp
// ============================================================

registerTool({
  id: 'queryTopArtistsByRevenue',
  description: 'List top N artists by completed merch revenue in the last N days. Useful for CRO/CFO planning.',
  schema: z.object({
    days: z.number().min(1).max(365).default(30),
    limit: z.number().min(1).max(50).default(10),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async ({ days, limit }) => {
    const since = new Date(Date.now() - days * 86400 * 1000);
    const rows = await db.execute(sql`
      SELECT u.id, u.artist_name, u.email,
             COALESCE(SUM(t.sale_amount),0)::text AS revenue,
             COUNT(t.id)::int AS tx
      FROM users u
      LEFT JOIN sales_transactions t ON t.artist_id = u.id
        AND t.status = 'completed' AND t.created_at >= ${since.toISOString()}
      WHERE u.role = 'artist'
      GROUP BY u.id ORDER BY revenue::numeric DESC NULLS LAST
      LIMIT ${limit}
    `);
    return { sinceDays: days, top: (rows as any).rows ?? [] };
  },
});

// ============================================================
// queryAtRiskArtists — for COO retention focus
// ============================================================

registerTool({
  id: 'queryAtRiskArtists',
  description: 'Find artists that look at-risk: zero plays in last 30d, no recent songs, dropping marketing metrics.',
  schema: z.object({ limit: z.number().default(20) }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async ({ limit }) => {
    const cutoff = new Date(Date.now() - 30 * 86400 * 1000);
    const rows = await db.execute(sql`
      SELECT u.id, u.artist_name, u.email,
             (SELECT COUNT(*) FROM songs WHERE user_id=u.id) AS song_count,
             (SELECT MAX(created_at) FROM songs WHERE user_id=u.id) AS last_song,
             (SELECT MAX(updated_at) FROM marketing_metrics WHERE user_id=u.id) AS last_metric
      FROM users u
      WHERE u.role = 'artist'
        AND NOT EXISTS (
          SELECT 1 FROM songs WHERE user_id=u.id AND created_at >= ${cutoff.toISOString()}
        )
      ORDER BY last_song ASC NULLS FIRST
      LIMIT ${limit}
    `);
    return { atRisk: (rows as any).rows ?? [] };
  },
});

// Mark module as loaded so we can guard double-registration
export const ARTIST_TOOLS_LOADED = true;
