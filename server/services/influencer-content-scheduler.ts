/**
 * Influencer Content Scheduler — Auto-generates influencer content on schedule
 *
 * Checks influencer_schedule_config for active artists,
 * generates content based on their frequency setting (daily/weekly/biweekly/custom).
 * Follows the same pattern as startDailyNewsScheduler, startDiscoveryScheduler, etc.
 */

import { logger } from '../utils/logger';
import { db } from '../../db';
import { influencerScheduleConfig, influencerVoiceProfiles, influencerAvatarProfiles } from '../../db/schema';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { runInfluencerPipeline } from './influencer-pipeline';

const SCHEDULER_INTERVAL_MS = 30 * 60 * 1000; // Check every 30 minutes
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the influencer content auto-generation scheduler
 */
export function startInfluencerContentScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  logger.info('[InfluencerScheduler] Starting content scheduler (30-min interval)');

  // Run immediately on start (after 10s delay to let DB connect)
  setTimeout(() => {
    checkAndGenerateContent().catch(err => {
      logger.error(`[InfluencerScheduler] Initial run error: ${err.message}`);
    });
  }, 10000);

  // Then check every 30 minutes
  schedulerTimer = setInterval(() => {
    checkAndGenerateContent().catch(err => {
      logger.error(`[InfluencerScheduler] Interval run error: ${err.message}`);
    });
  }, SCHEDULER_INTERVAL_MS);
}

/**
 * Stop the scheduler
 */
export function stopInfluencerContentScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('[InfluencerScheduler] Scheduler stopped');
  }
}

/**
 * Check all active schedules and generate content where due
 */
async function checkAndGenerateContent() {
  try {
    const now = new Date();

    // Find active schedules where nextScheduledAt is in the past (or null)
    const dueSchedules = await db.select()
      .from(influencerScheduleConfig)
      .where(and(
        eq(influencerScheduleConfig.isActive, true),
        eq(influencerScheduleConfig.autoGenerate, true),
      ));

    let generated = 0;

    for (const schedule of dueSchedules) {
      // Check if it's time to generate
      if (schedule.nextScheduledAt && new Date(schedule.nextScheduledAt) > now) {
        continue; // Not due yet
      }

      // Check artist has voice + avatar setup
      const [voice] = await db.select().from(influencerVoiceProfiles)
        .where(eq(influencerVoiceProfiles.userId, schedule.userId)).limit(1);
      
      if (!voice) {
        logger.debug(`[InfluencerScheduler] User ${schedule.userId}: no voice profile, skipping`);
        continue;
      }

      // Pick a random topic from their configured topics
      const topics = (schedule.topics as string[]) || ['trending'];
      const topic = topics[Math.floor(Math.random() * topics.length)];

      logger.info(`[InfluencerScheduler] Generating content for user ${schedule.userId}, topic: ${topic}`);

      try {
        // Run pipeline (don't await — let it run in background)
        runInfluencerPipeline(schedule.userId, {
          topic,
          contentType: 'entertainment',
          targetDurationSec: 60,
        }).then(result => {
          if (result.success) {
            logger.info(`[InfluencerScheduler] Content ${result.contentId} generated for user ${schedule.userId}`);
          } else {
            logger.warn(`[InfluencerScheduler] Pipeline failed for user ${schedule.userId}: ${result.error}`);
          }
        }).catch(err => {
          logger.error(`[InfluencerScheduler] Pipeline error for user ${schedule.userId}: ${err.message}`);
        });

        generated++;

        // Update next scheduled time
        const nextDate = calculateNextScheduledDate(schedule.frequency as string, schedule.customIntervalHours);
        await db.update(influencerScheduleConfig)
          .set({
            lastGeneratedAt: now,
            nextScheduledAt: nextDate,
            updatedAt: now,
          })
          .where(eq(influencerScheduleConfig.id, schedule.id));
      } catch (genErr: any) {
        logger.error(`[InfluencerScheduler] Error generating for user ${schedule.userId}: ${genErr.message}`);
      }
    }

    if (generated > 0) {
      logger.info(`[InfluencerScheduler] Triggered ${generated} content generation(s)`);
    }
  } catch (error: any) {
    logger.error(`[InfluencerScheduler] checkAndGenerateContent error: ${error.message}`);
  }
}

function calculateNextScheduledDate(frequency: string, customHours?: number | null): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'biweekly':
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case 'custom':
      return new Date(now.getTime() + (customHours || 168) * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}
