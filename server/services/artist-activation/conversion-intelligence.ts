/**
 * Conversion Intelligence — Detects hot leads, triggers upgrade offers,
 * manages segment transitions, and auto-enrolls in appropriate sequences.
 */

import { db } from '../../db';
import { activationScores, activationEvents, dripSequences, musicIndustryContacts } from '../../db/schema';
import { eq, and, gt, lt, sql, lte } from 'drizzle-orm';
import { enrollInSequence } from './drip-engine';
import { trackEvent } from './activation-tracker';

// ─── Segment Transition Rules ────────────────────────────────────

interface TransitionAction {
  enrollSequence?: string;
  trackEvent?: string;
}

const TRANSITION_RULES: Record<string, TransitionAction> = {
  // When someone goes from cold → warming (score 20+)
  'cold→warming': {},
  // When someone goes from warming → engaged (score 45+)
  'warming→engaged': {
    enrollSequence: 'value_showcase',
  },
  // When someone goes from engaged → hot (score 70+)
  'engaged→hot': {
    enrollSequence: 'upgrade_nudge',
    trackEvent: 'upgrade_offered',
  },
};

// ─── Process segment transitions ─────────────────────────────────

export async function processSegmentTransitions(batchSize: number = 100): Promise<number> {
  let transitions = 0;

  try {
    // Get all scores and recalculate segments
    const scores = await db.select()
      .from(activationScores)
      .where(
        and(
          sql`current_plan = 'none' OR current_plan = 'free'`,
          gt(activationScores.score, 0),
        )
      )
      .limit(batchSize);

    for (const record of scores) {
      const expectedSegment = calculateSegment(record.score, record.currentPlan || 'none');

      if (expectedSegment !== record.segment) {
        const transitionKey = `${record.segment}→${expectedSegment}`;
        const rule = TRANSITION_RULES[transitionKey];

        // Update segment
        await db.update(activationScores)
          .set({ segment: expectedSegment as any, updatedAt: new Date() })
          .where(eq(activationScores.id, record.id));

        // Execute transition actions
        if (rule?.enrollSequence && record.contactId) {
          await enrollInSequence(record.contactId, rule.enrollSequence as any, 0);
        }
        if (rule?.trackEvent) {
          await trackEvent(record.email, rule.trackEvent, { from: record.segment, to: expectedSegment }, record.contactId || undefined);
        }

        transitions++;
      }
    }
  } catch (err) {
    console.error('[ConversionIntel] Transition error:', err);
  }

  if (transitions > 0) {
    console.log(`[ConversionIntel] Processed ${transitions} segment transitions`);
  }
  return transitions;
}

function calculateSegment(score: number, plan: string): string {
  if (plan !== 'none' && plan !== 'free') return 'converted';
  if (score >= 70) return 'hot';
  if (score >= 45) return 'engaged';
  if (score >= 20) return 'warming';
  return 'cold';
}

// ─── Detect inactive users for win-back ──────────────────────────

export async function detectInactiveForWinBack(): Promise<number> {
  let enrolled = 0;

  try {
    // Users who had activity but none in last 14 days
    const inactive = await db.execute(sql`
      SELECT asc2.email, asc2.contact_id, asc2.score
      FROM activation_scores asc2
      WHERE asc2.last_activity_at < NOW() - INTERVAL '14 days'
        AND asc2.last_activity_at IS NOT NULL
        AND asc2.score >= 20
        AND (asc2.current_plan = 'none' OR asc2.current_plan = 'free')
        AND asc2.segment != 'churned'
        AND NOT EXISTS (
          SELECT 1 FROM drip_sequences ds
          WHERE ds.contact_id = asc2.contact_id
          AND ds.sequence_type = 'win_back'
          AND (ds.status = 'active' OR ds.status = 'completed')
        )
      LIMIT 50
    `);

    for (const row of inactive.rows) {
      if (row.contact_id) {
        const success = await enrollInSequence(row.contact_id as number, 'win_back', 0);
        if (success) enrolled++;
      }
    }

    if (enrolled > 0) {
      console.log(`[ConversionIntel] Enrolled ${enrolled} inactive users in win_back`);
    }
  } catch (err) {
    console.error('[ConversionIntel] Win-back detection error:', err);
  }

  return enrolled;
}

// ─── Detect engaged users for referral push ──────────────────────

export async function detectEngagedForReferral(): Promise<number> {
  let enrolled = 0;

  try {
    // Active users with score > 50 who completed landing_builder and haven't had referral push
    const engaged = await db.execute(sql`
      SELECT asc2.email, asc2.contact_id
      FROM activation_scores asc2
      WHERE asc2.score >= 50
        AND asc2.last_activity_at > NOW() - INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM drip_sequences ds
          WHERE ds.contact_id = asc2.contact_id
          AND ds.sequence_type = 'referral_push'
        )
      LIMIT 30
    `);

    for (const row of engaged.rows) {
      if (row.contact_id) {
        const success = await enrollInSequence(row.contact_id as number, 'referral_push', 0);
        if (success) enrolled++;
      }
    }
  } catch (err) {
    console.error('[ConversionIntel] Referral detection error:', err);
  }

  return enrolled;
}

// ─── Get conversion funnel data ──────────────────────────────────
// Optional `rangeDays` scopes email/activation counts to NOW() - N days.
// `discovered` and `paying` remain lifetime totals (they reflect the stock,
// not the flow).
export async function getConversionFunnel(rangeDays?: number | null) {
  try {
    const rangeFilter = rangeDays
      ? sql`AND created_at >= NOW() - (${String(rangeDays)} || ' days')::interval`
      : sql``;

    const [
      totalDiscovered,
      totalEmailed,
      totalClicked,
      totalSignedUp,
      totalActive,
      totalPaying,
      funnelBySource,
    ] = await Promise.all([
      db.execute(sql`SELECT count(*) as cnt FROM music_industry_contacts WHERE email IS NOT NULL`),
      db.execute(sql`SELECT count(DISTINCT email) as cnt FROM activation_events WHERE event_type = 'email_sent' ${rangeFilter}`),
      db.execute(sql`SELECT count(DISTINCT email) as cnt FROM activation_events WHERE (event_type = 'email_clicked' OR event_type = 'magic_link_clicked') ${rangeFilter}`),
      db.execute(sql`SELECT count(DISTINCT email) as cnt FROM activation_events WHERE event_type = 'account_created' ${rangeFilter}`),
      db.execute(sql`SELECT count(*) as cnt FROM activation_scores WHERE score >= 20 AND (current_plan != 'none')`),
      db.execute(sql`SELECT count(*) as cnt FROM activation_scores WHERE current_plan NOT IN ('none', 'free') AND current_plan IS NOT NULL`),
      db.execute(sql`
        SELECT mic.import_source as source,
          count(*) as total,
          count(CASE WHEN asc2.score >= 20 THEN 1 END) as engaged,
          count(CASE WHEN asc2.current_plan NOT IN ('none', 'free') THEN 1 END) as paid
        FROM music_industry_contacts mic
        LEFT JOIN activation_scores asc2 ON asc2.contact_id = mic.id
        WHERE mic.email IS NOT NULL
        GROUP BY mic.import_source
        ORDER BY total DESC
        LIMIT 20
      `),
    ]);

    return {
      discovered: parseInt(totalDiscovered.rows[0]?.cnt as string || '0'),
      emailed: parseInt(totalEmailed.rows[0]?.cnt as string || '0'),
      clicked: parseInt(totalClicked.rows[0]?.cnt as string || '0'),
      signedUp: parseInt(totalSignedUp.rows[0]?.cnt as string || '0'),
      active: parseInt(totalActive.rows[0]?.cnt as string || '0'),
      paying: parseInt(totalPaying.rows[0]?.cnt as string || '0'),
      bySource: funnelBySource.rows,
      rangeDays: rangeDays ?? null,
    };
  } catch (err) {
    console.error('[ConversionIntel] Funnel error:', err);
    return { discovered: 0, emailed: 0, clicked: 0, signedUp: 0, active: 0, paying: 0, bySource: [], rangeDays: rangeDays ?? null };
  }
}
