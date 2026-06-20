import { Router } from 'express';
import { db } from '@db';
import { achievements, userAchievements, courses, courseEnrollments } from '@db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get all available achievements
router.get('/api/achievements', async (req, res) => {
  try {
    const allAchievements = await db
      .select()
      .from(achievements)
      .orderBy(achievements.createdAt);

    res.json(allAchievements);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get user's achievements
router.get('/api/user/achievements', authenticate, async (req, res) => {
  try {
    const userAchievementsList = await db
      .select({
        achievement: achievements,
        earnedAt: userAchievements.earnedAt,
        metadata: userAchievements.metadata
      })
      .from(userAchievements)
      .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
      .where(eq(userAchievements.userId, req.user!.id))
      .orderBy(userAchievements.earnedAt);

    res.json(userAchievementsList);
  } catch (error) {
    console.error('Error fetching user achievements:', error);
    res.status(500).json({ error: 'Failed to fetch user achievements' });
  }
});

// Award achievement for course completion
export async function awardCourseCompletionAchievement(userId: number, courseId: number) {
  try {
    // Get course completion achievement
    const [completionAchievement] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.type, 'course_completion'))
      .limit(1);

    if (!completionAchievement) {
      console.error('Course completion achievement not found');
      return;
    }

    // Check if user already has this achievement for this course
    const [existingAchievement] = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, completionAchievement.id),
          eq(userAchievements.courseId, courseId)
        )
      )
      .limit(1);

    if (existingAchievement) {
      return; // User already has this achievement for this course
    }

    // Award the achievement
    await db.insert(userAchievements).values({
      userId,
      achievementId: completionAchievement.id,
      courseId,
      metadata: {
        completionDate: new Date().toISOString()
      }
    });

    console.log(`Awarded course completion achievement to user ${userId} for course ${courseId}`);
  } catch (error) {
    console.error('Error awarding achievement:', error);
  }
}

export default router;
