import { db } from '@db';
import { achievements, userAchievements } from '@db/schema';
import { eq, and } from 'drizzle-orm';

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
