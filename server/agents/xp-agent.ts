/**
 * BOOSTIFY - XP & Reputation System Agent
 * 
 * "Listeners → Fans → Tastemakers → Curators → Moguls"
 * 
 * This agent:
 * - Awards XP for user actions (comments, discoveries, predictions)
 * - Manages level progression  
 * - Tastemakers+ can influence AI artist production budgets
 * - Tracks streaks and achievements
 */

import { db } from '../db';
import {
  userXP,
  xpTransactions,
  users,
  type InsertUserXP,
  type SelectUserXP,
} from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// ============================================
// LEVEL DEFINITIONS
// ============================================

interface LevelDefinition {
  level: number;
  name: 'listener' | 'fan' | 'tastemaker' | 'curator' | 'mogul';
  displayName: string;
  minXP: number;
  icon: string;
  color: string;
  perks: string[];
}

export const LEVELS: LevelDefinition[] = [
  { 
    level: 1, name: 'listener', displayName: 'Listener', 
    minXP: 0, icon: '🎧', color: '#9CA3AF',
    perks: ['Acceso al feed', 'Comentar posts']
  },
  { 
    level: 2, name: 'fan', displayName: 'Fan', 
    minXP: 100, icon: '⭐', color: '#60A5FA',
    perks: ['Badge exclusivo', 'Votar en encuestas', 'Ver stories first']
  },
  { 
    level: 3, name: 'tastemaker', displayName: 'Tastemaker', 
    minXP: 500, icon: '🔥', color: '#F59E0B',
    perks: ['Influir en budgets de artistas', 'Sugerir collaboraciones', 'Badge dorado']
  },
  { 
    level: 4, name: 'curator', displayName: 'Curator', 
    minXP: 2000, icon: '💎', color: '#8B5CF6',
    perks: ['Crear playlists destacadas', 'Acceso a datos de artistas', 'Badge diamante']
  },
  { 
    level: 5, name: 'mogul', displayName: 'Mogul', 
    minXP: 10000, icon: '👑', color: '#EF4444',
    perks: ['Control sobre dirección de artistas', 'Crear artistas IA premium', 'Badge de corona', 'Acceso VIP']
  },
];

// ============================================
// XP AWARDS
// ============================================

const XP_REWARDS: Record<string, number> = {
  comment_posted: 5,
  debate_participated: 10,
  artist_discovered_early: 25,
  prediction_correct: 50,
  prediction_wrong: 5,
  poll_voted: 3,
  poll_created: 10,
  story_viewed: 1,
  chart_predicted: 15,
  artist_managed: 20,
  artist_created: 30,
  clip_liked: 2,
  clip_shared: 5,
  daily_login: 10,
  streak_bonus: 25,
  level_up_bonus: 100,
  achievement_earned: 50,
  beef_predicted: 20,
  collab_suggested: 10,
  trending_first_react: 15,
};

/**
 * Award XP to a user for an action
 */
export async function awardXP(
  userId: number,
  reason: keyof typeof XP_REWARDS,
  description?: string,
  relatedEntityType?: string,
  relatedEntityId?: number
): Promise<{ newXP: number; levelUp: boolean; newLevel?: LevelDefinition } | null> {
  try {
    const amount = XP_REWARDS[reason] || 5;

    // Ensure user has an XP record
    let [xpRecord] = await db
      .select()
      .from(userXP)
      .where(eq(userXP.userId, userId));

    if (!xpRecord) {
      [xpRecord] = await db.insert(userXP).values({
        userId,
        totalXP: 0,
        level: 1,
        levelName: 'listener',
      }).returning();
    }

    const newTotalXP = (xpRecord.totalXP || 0) + amount;

    // Check for level up
    const currentLevel = LEVELS.find(l => l.level === xpRecord.level) || LEVELS[0];
    const newLevel = LEVELS.slice().reverse().find(l => newTotalXP >= l.minXP) || LEVELS[0];
    const levelUp = newLevel.level > currentLevel.level;

    // Update XP breakdown
    const xpField = getXPField(reason);
    const updateData: any = {
      totalXP: newTotalXP,
      totalInteractions: sql`${userXP.totalInteractions} + 1`,
      updatedAt: new Date(),
    };

    if (levelUp) {
      updateData.level = newLevel.level;
      updateData.levelName = newLevel.name;
      updateData.canInfluenceBudgets = newLevel.level >= 3; // Tastemaker+
    }

    // Update daily streak
    const today = new Date().toISOString().split('T')[0];
    if (xpRecord.lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (xpRecord.lastActiveDate === yesterday) {
        updateData.dailyStreak = (xpRecord.dailyStreak || 0) + 1;
        updateData.longestStreak = sql`GREATEST(${userXP.longestStreak}, ${(xpRecord.dailyStreak || 0) + 1})`;
      } else {
        updateData.dailyStreak = 1;
      }
      updateData.lastActiveDate = today;
    }

    await db.update(userXP)
      .set(updateData)
      .where(eq(userXP.userId, userId));

    // Log the transaction
    await db.insert(xpTransactions).values({
      userId,
      amount,
      reason: reason as any,
      description: description || `+${amount} XP por ${reason}`,
      relatedEntityType,
      relatedEntityId,
    });

    // If level up, award bonus XP
    if (levelUp) {
      await db.insert(xpTransactions).values({
        userId,
        amount: XP_REWARDS.level_up_bonus,
        reason: 'level_up_bonus' as any,
        description: `🎉 ¡Subiste a nivel ${newLevel.level}: ${newLevel.displayName}! +${XP_REWARDS.level_up_bonus} XP bonus`,
      });

      await db.update(userXP)
        .set({ totalXP: newTotalXP + XP_REWARDS.level_up_bonus })
        .where(eq(userXP.userId, userId));
    }

    return {
      newXP: newTotalXP + (levelUp ? XP_REWARDS.level_up_bonus : 0),
      levelUp,
      newLevel: levelUp ? newLevel : undefined,
    };
  } catch (error) {
    console.error('❌ [XP] Error awarding XP:', error);
    return null;
  }
}

function getXPField(reason: string): string {
  if (reason.includes('comment') || reason.includes('debate')) return 'commentXP';
  if (reason.includes('discover') || reason.includes('chart')) return 'discoveryXP';
  if (reason.includes('prediction') || reason.includes('beef_predicted')) return 'predictionXP';
  if (reason.includes('clip') || reason.includes('poll') || reason.includes('story')) return 'socialXP';
  if (reason.includes('manage') || reason.includes('artist')) return 'managementXP';
  if (reason.includes('creat')) return 'creationXP';
  return 'socialXP';
}

// ============================================
// QUERIES
// ============================================

/**
 * Get user's XP and level info
 */
export async function getUserXPProfile(userId: number): Promise<{
  xp: SelectUserXP | null;
  currentLevel: LevelDefinition;
  nextLevel: LevelDefinition | null;
  progressPercent: number;
  recentTransactions: any[];
  rank: number;
} | null> {
  try {
    let [xpRecord] = await db
      .select()
      .from(userXP)
      .where(eq(userXP.userId, userId));

    if (!xpRecord) {
      // Create default XP record
      [xpRecord] = await db.insert(userXP).values({
        userId,
        totalXP: 0,
        level: 1,
        levelName: 'listener',
      }).returning();
    }

    const currentLevel = LEVELS.find(l => l.level === xpRecord.level) || LEVELS[0];
    const nextLevel = LEVELS.find(l => l.level === currentLevel.level + 1) || null;

    const progressPercent = nextLevel
      ? Math.min(100, Math.round(((xpRecord.totalXP - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100))
      : 100;

    // Get recent transactions
    const recentTransactions = await db
      .select()
      .from(xpTransactions)
      .where(eq(xpTransactions.userId, userId))
      .orderBy(desc(xpTransactions.createdAt))
      .limit(10);

    // Get rank
    const rankResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userXP)
      .where(sql`${userXP.totalXP} > ${xpRecord.totalXP}`);

    const rank = (rankResult[0]?.count || 0) + 1;

    return {
      xp: xpRecord,
      currentLevel,
      nextLevel,
      progressPercent,
      recentTransactions,
      rank,
    };
  } catch (error) {
    console.error('❌ [XP] Error getting profile:', error);
    return null;
  }
}

/**
 * Get XP leaderboard
 */
export async function getXPLeaderboard(limit: number = 20): Promise<Array<{
  userId: number;
  username: string | null;
  totalXP: number;
  level: number;
  levelName: string;
  rank: number;
}>> {
  try {
    const leaderboard = await db
      .select({
        userId: userXP.userId,
        totalXP: userXP.totalXP,
        level: userXP.level,
        levelName: userXP.levelName,
      })
      .from(userXP)
      .orderBy(desc(userXP.totalXP))
      .limit(limit);

    // Get usernames
    const userIds = leaderboard.map(l => l.userId);
    if (userIds.length === 0) return [];

    const userInfo = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(sql`${users.id} = ANY(ARRAY[${sql.raw(userIds.join(','))}]::int[])`);

    const userMap = new Map(userInfo.map(u => [u.id, u.username]));

    return leaderboard.map((entry, idx) => ({
      userId: entry.userId,
      username: userMap.get(entry.userId) || `User ${entry.userId}`,
      totalXP: entry.totalXP,
      level: entry.level,
      levelName: entry.levelName || 'listener',
      rank: idx + 1,
    }));
  } catch (error) {
    console.error('❌ [XP] Error getting leaderboard:', error);
    return [];
  }
}
