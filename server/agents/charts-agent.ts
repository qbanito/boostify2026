/**
 * BOOSTIFY AUTONOMOUS AGENTS - Charts Agent
 * 
 * "Billboard-style Weekly Charts for the AI Music Universe"
 * 
 * This agent:
 * - Calculates weekly rankings based on plays, likes, comments, audience engagement
 * - Generates AI summaries of chart movements 
 * - Tracks position changes (risers, fallers, new entries)
 * - Runs every ~60 ticks (1 hour) to update charts
 */

import { db } from '../db';
import {
  weeklyCharts,
  aiSocialPosts,
  audienceComments,
  aiPostComments,
  songs,
  users,
  type InsertWeeklyChart,
  type SelectWeeklyChart,
} from '../../db/schema';
import { eq, and, desc, sql, gte, inArray, count as drizzleCount } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { PRIMARY_MODEL } from '../utils/ai-config';

const llm = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.7,
  maxTokens: 300,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// CHART CALCULATION
// ============================================

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Calculate weekly chart rankings for top songs/artists
 */
export async function calculateWeeklyCharts(): Promise<SelectWeeklyChart | null> {
  try {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    console.log(`📊 [Charts] Calculating charts for Week ${weekNumber}, ${year}...`);

    // Get all posts from the last week with engagement data
    const recentPosts = await db
      .select({
        artistId: aiSocialPosts.artistId,
        likes: aiSocialPosts.likes,
        comments: aiSocialPosts.comments,
        shares: aiSocialPosts.shares,
        aiLikes: aiSocialPosts.aiLikes,
        aiComments: aiSocialPosts.aiComments,
        reachScore: aiSocialPosts.reachScore,
        contentType: aiSocialPosts.contentType,
      })
      .from(aiSocialPosts)
      .where(gte(aiSocialPosts.createdAt, oneWeekAgo));

    // Get audience comment counts per artist
    const audienceActivity = await db
      .select({
        postId: audienceComments.postId,
        commentCount: sql<number>`count(*)::int`,
      })
      .from(audienceComments)
      .where(gte(audienceComments.createdAt, oneWeekAgo))
      .groupBy(audienceComments.postId);

    const audienceCountByPost = new Map<number, number>();
    for (const a of audienceActivity) {
      audienceCountByPost.set(a.postId, a.commentCount);
    }

    // Aggregate scores per artist
    const artistScores = new Map<number, {
      plays: number;
      likes: number;
      comments: number;
      shares: number;
      audienceEngagement: number;
      postCount: number;
    }>();

    for (const post of recentPosts) {
      const existing = artistScores.get(post.artistId) || {
        plays: 0, likes: 0, comments: 0, shares: 0, audienceEngagement: 0, postCount: 0
      };
      existing.likes += (post.likes || 0) + (post.aiLikes || 0);
      existing.comments += (post.comments || 0) + (post.aiComments || 0);
      existing.shares += post.shares || 0;
      existing.plays += post.reachScore || 0;
      existing.postCount += 1;
      if (post.contentType === 'song_release') {
        existing.plays += 50; // Bonus for releasing music
      }
      artistScores.set(post.artistId, existing);
    }

    // Get artist info
    const artistIds = Array.from(artistScores.keys());
    if (artistIds.length === 0) {
      console.log('📊 [Charts] No activity this week, skipping chart calculation');
      return null;
    }

    const artistInfo = await db
      .select({ id: users.id, username: users.username, profileImageUrl: users.profileImageUrl })
      .from(users)
      .where(inArray(users.id, artistIds));

    const artistMap = new Map(artistInfo.map(a => [a.id, a]));

    // Get previous chart to track position changes
    const previousChart = await db
      .select()
      .from(weeklyCharts)
      .where(eq(weeklyCharts.chartType, 'top_songs'))
      .orderBy(desc(weeklyCharts.calculatedAt))
      .limit(1);

    const prevRankings = new Map<number, number>();
    if (previousChart.length > 0 && Array.isArray(previousChart[0].rankings)) {
      for (const r of previousChart[0].rankings as any[]) {
        prevRankings.set(r.artistId, r.position);
      }
    }

    // Calculate final scores and sort
    const scoredArtists = Array.from(artistScores.entries()).map(([artistId, data]) => {
      const score = 
        data.plays * 1 +
        data.likes * 3 +
        data.comments * 5 +
        data.shares * 4 +
        data.audienceEngagement * 2 +
        data.postCount * 2;
      
      return { artistId, score, ...data };
    }).sort((a, b) => b.score - a.score);

    // Build rankings (top 20)
    const rankings = scoredArtists.slice(0, 20).map((artist, idx) => {
      const info = artistMap.get(artist.artistId);
      const position = idx + 1;
      const previousPosition = prevRankings.get(artist.artistId) ?? null;
      
      let change: 'up' | 'down' | 'same' | 'new' = 'new';
      if (previousPosition !== null) {
        if (previousPosition > position) change = 'up';
        else if (previousPosition < position) change = 'down';
        else change = 'same';
      }

      return {
        position,
        artistId: artist.artistId,
        artistName: info?.username || `Artist #${artist.artistId}`,
        coverUrl: info?.profileImageUrl || undefined,
        score: artist.score,
        plays: artist.plays,
        likes: artist.likes,
        comments: artist.comments,
        previousPosition,
        change,
      };
    });

    // Find biggest mover
    let biggestMover = '';
    let maxJump = 0;
    for (const r of rankings) {
      if (r.previousPosition !== null && r.change === 'up') {
        const jump = r.previousPosition - r.position;
        if (jump > maxJump) {
          maxJump = jump;
          biggestMover = `${r.artistName} subió de #${r.previousPosition} a #${r.position} (+${jump})`;
        }
      }
    }

    // Generate AI summary
    let weekSummary = '';
    try {
      const top5 = rankings.slice(0, 5).map(r => `#${r.position} ${r.artistName} (${r.score}pts)`).join(', ');
      const response = await llm.invoke([
        new HumanMessage(
          `Eres un presentador de charts de música urbana/latina. Genera un resumen CORTO y emocionante (máx 2 frases) del chart semanal de Boostify. ` +
          `Top 5: ${top5}. ${biggestMover ? `Mayor salto: ${biggestMover}.` : ''} ` +
          `Usa lenguaje de radio/TV musical. En español.`
        )
      ]);
      weekSummary = typeof response.content === 'string' ? response.content : '';
    } catch (e) {
      weekSummary = `🔥 Semana ${weekNumber}: ${rankings[0]?.artistName || 'N/A'} domina el chart con ${rankings[0]?.score || 0} puntos!`;
    }

    // Save chart
    const [chart] = await db.insert(weeklyCharts).values({
      weekNumber,
      year,
      chartType: 'top_songs',
      rankings,
      weekSummary,
      highlightArtistId: rankings[0]?.artistId,
      biggestMover: biggestMover || null,
      calculatedAt: now,
    }).returning();

    console.log(`📊 [Charts] Chart saved! #1: ${rankings[0]?.artistName} with ${rankings[0]?.score} pts`);
    return chart;
  } catch (error) {
    console.error('❌ [Charts] Error calculating charts:', error);
    return null;
  }
}

/**
 * Get the current (latest) chart
 */
export async function getCurrentChart(chartType: string = 'top_songs'): Promise<SelectWeeklyChart | null> {
  const [chart] = await db
    .select()
    .from(weeklyCharts)
    .where(eq(weeklyCharts.chartType, chartType))
    .orderBy(desc(weeklyCharts.calculatedAt))
    .limit(1);
  
  return chart || null;
}

/**
 * Get chart history (last N weeks)
 */
export async function getChartHistory(weeks: number = 4): Promise<SelectWeeklyChart[]> {
  return db
    .select()
    .from(weeklyCharts)
    .where(eq(weeklyCharts.chartType, 'top_songs'))
    .orderBy(desc(weeklyCharts.calculatedAt))
    .limit(weeks);
}

/**
 * Process charts tick - called by orchestrator
 */
export async function processChartsTick(): Promise<void> {
  console.log('📊 [Charts] Processing charts tick...');
  await calculateWeeklyCharts();
}
