/**
 * Boostify Artist Hunter Agent — Lead Scoring & Validation Engine
 * 
 * Scores discovered artist leads (0-100) based on:
 * - Contact completeness & quality
 * - Digital presence & professionalism
 * - Activity signals
 * - Commercial potential for Boostify
 * - Platform alignment
 * 
 * Target: 50k active artists by end of 2026
 */

import { db, pool } from '../../db';
import { musicIndustryContacts, activationScores } from '../../../db/schema';
import { eq, sql, and, isNotNull, gt, lt, desc, asc, inArray, or, like } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────

export interface LeadScore {
  contactId: number;
  score: number; // 0-100
  breakdown: ScoreBreakdown;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  boostifyOpportunity: string;
  recommendedChannel: string;
}

export interface ScoreBreakdown {
  contactQuality: number;    // 0-25: email valid, name quality, phone, social links
  digitalPresence: number;   // 0-25: spotify, IG, youtube, bandcamp, website
  activitySignals: number;   // 0-20: monthly listeners, followers, recent activity
  commercialPotential: number; // 0-20: genre demand, market, platform needs
  platformAlignment: number; // 0-10: needs video, marketing, distribution (Boostify services)
}

export interface ScoredLead {
  id: number;
  fullName: string;
  email: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  companyName: string | null;
  industry: string | null;
  genre: string | null;
  score: number;
  tier: string;
  status: string;
  importSource: string | null;
  createdAt: Date;
  opportunity: string;
  channel: string;
  masterJson: Record<string, any> | null;
  profileImageUrl: string | null;
  boostifyImageUrl: string | null;
  dataCompleteness: number | null;
  emailsSent: number;
  opensCount: number;
  clicksCount: number;
}

export interface HunterStats {
  totalLeads: number;
  scoredLeads: number;
  unscoredLeads: number;
  byTier: { tier: string; count: number }[];
  byStatus: { status: string; count: number }[];
  bySource: { source: string; count: number }[];
  byCountry: { country: string; count: number }[];
  weeklyGrowth: { week: string; count: number }[];
  goalProgress: { current: number; target: number; percent: number };
  avgScore: number;
  hotLeads: number;
}

// ─── Scoring Constants ───────────────────────────────────────────

const HIGH_DEMAND_GENRES = new Set([
  'hip hop', 'rap', 'trap', 'r&b', 'pop', 'latin', 'reggaeton',
  'afrobeats', 'electronic', 'edm', 'indie', 'k-pop', 'drill',
]);

const BOOSTIFY_SERVICE_COUNTRIES = new Set([
  'united states', 'mexico', 'colombia', 'brazil', 'argentina', 'spain',
  'united kingdom', 'france', 'germany', 'nigeria', 'south africa',
  'canada', 'chile', 'peru', 'dominican republic', 'puerto rico',
  'india', 'south korea', 'japan', 'australia',
]);

// ─── Score a single lead ─────────────────────────────────────────

export function computeLeadScore(contact: {
  email?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  mobileNumber?: string | null;
  linkedin?: string | null;
  companyWebsite?: string | null;
  genre?: string | null;
  keywords?: string | null;
  country?: string | null;
  city?: string | null;
  importSource?: string | null;
  jobTitle?: string | null;
}): LeadScore {
  const b: ScoreBreakdown = {
    contactQuality: 0,
    digitalPresence: 0,
    activitySignals: 0,
    commercialPotential: 0,
    platformAlignment: 0,
  };

  // ── Contact Quality (0-25) ──
  if (contact.email) b.contactQuality += 10;
  if (contact.fullName && contact.fullName.length > 3) b.contactQuality += 4;
  if (contact.firstName && contact.lastName) b.contactQuality += 3;
  if (contact.phone || contact.mobileNumber) b.contactQuality += 4;
  if (contact.city) b.contactQuality += 2;
  if (contact.country) b.contactQuality += 2;

  // ── Digital Presence (0-25) ──
  const kw = (contact.keywords || '').toLowerCase();
  if (kw.includes('spotify') || kw.includes('open.spotify.com')) b.digitalPresence += 7;
  if (kw.includes('instagram') || kw.includes('@')) b.digitalPresence += 5;
  if (kw.includes('youtube') || kw.includes('youtu.be')) b.digitalPresence += 5;
  if (kw.includes('tiktok')) b.digitalPresence += 4;
  if (kw.includes('bandcamp')) b.digitalPresence += 3;
  if (kw.includes('soundcloud')) b.digitalPresence += 3;
  if (contact.linkedin) b.digitalPresence += 2;
  if (contact.companyWebsite) b.digitalPresence += 3;
  b.digitalPresence = Math.min(25, b.digitalPresence);

  // ── Activity Signals (0-20) ──
  if (kw.includes('monthly listeners')) b.activitySignals += 6;
  if (kw.includes('followers')) b.activitySignals += 4;
  if (kw.includes('new release') || kw.includes('2024') || kw.includes('2025') || kw.includes('2026')) {
    b.activitySignals += 5;
  }
  if (contact.importSource?.includes('spotify')) b.activitySignals += 3;
  if (contact.importSource?.includes('instagram')) b.activitySignals += 2;
  if (contact.importSource?.includes('youtube')) b.activitySignals += 3;
  if (contact.importSource?.includes('tiktok')) b.activitySignals += 2;
  b.activitySignals = Math.min(20, b.activitySignals);

  // ── Commercial Potential (0-20) ──
  const genre = (contact.genre || kw).toLowerCase();
  for (const g of HIGH_DEMAND_GENRES) {
    if (genre.includes(g)) { b.commercialPotential += 8; break; }
  }
  const country = (contact.country || '').toLowerCase();
  if (BOOSTIFY_SERVICE_COUNTRIES.has(country)) b.commercialPotential += 6;
  if (contact.jobTitle?.toLowerCase().includes('independent') || contact.jobTitle?.toLowerCase().includes('artist')) {
    b.commercialPotential += 6;
  }
  b.commercialPotential = Math.min(20, b.commercialPotential);

  // ── Platform Alignment (0-10) ──
  // Artists without strong digital presence need Boostify more
  if (b.digitalPresence < 10) b.platformAlignment += 4; // needs marketing help
  if (!kw.includes('youtube') && !kw.includes('video')) b.platformAlignment += 3; // needs video
  if (!kw.includes('distribution') && !kw.includes('distrokid')) b.platformAlignment += 3; // needs distribution
  b.platformAlignment = Math.min(10, b.platformAlignment);

  const score = b.contactQuality + b.digitalPresence + b.activitySignals + b.commercialPotential + b.platformAlignment;

  const tier = score >= 80 ? 'S' : score >= 60 ? 'A' : score >= 40 ? 'B' : score >= 20 ? 'C' : 'D';

  const opportunity = score >= 60
    ? 'High-value prospect — full Boostify suite'
    : score >= 40
    ? 'Medium prospect — video + marketing tools'
    : score >= 20
    ? 'Emerging artist — free tier conversion'
    : 'Low priority — nurture drip';

  const channel = contact.email
    ? 'email'
    : kw.includes('instagram')
    ? 'instagram_dm'
    : kw.includes('spotify')
    ? 'spotify_pitch'
    : 'web_form';

  return { contactId: 0, score, breakdown: b, tier, boostifyOpportunity: opportunity, recommendedChannel: channel };
}

// ─── Batch score unscored leads ──────────────────────────────────

export async function scoreUnscoredLeads(batchSize = 500): Promise<{ scored: number; avgScore: number }> {
  try {
    // Get contacts that don't have an activation_score yet
    const unscored = await db.execute(sql`
      SELECT c.id, c.email, c.full_name, c.first_name, c.last_name, 
             c.phone, c.mobile_number, c.linkedin, c.company_website,
             c.keywords, c.country, c.city, c.import_source, c.job_title
      FROM music_industry_contacts c
      LEFT JOIN activation_scores a ON a.contact_id = c.id
      WHERE a.id IS NULL
      ORDER BY c.created_at DESC
      LIMIT ${batchSize}
    `);

    if (!unscored.rows.length) return { scored: 0, avgScore: 0 };

    let totalScore = 0;
    let scored = 0;

    for (const row of unscored.rows) {
      const result = computeLeadScore({
        email: row.email as string,
        fullName: row.full_name as string,
        firstName: row.first_name as string,
        lastName: row.last_name as string,
        phone: row.phone as string,
        mobileNumber: row.mobile_number as string,
        linkedin: row.linkedin as string,
        companyWebsite: row.company_website as string,
        keywords: row.keywords as string,
        country: row.country as string,
        city: row.city as string,
        importSource: row.import_source as string,
        jobTitle: row.job_title as string,
      });

      const segment = result.score >= 70 ? 'hot'
        : result.score >= 50 ? 'engaged'
        : result.score >= 30 ? 'warming'
        : 'cold';

      const email = (row.email as string) || `contact_${row.id}@placeholder.internal`;

      try {
        await db.execute(sql`
          INSERT INTO activation_scores (contact_id, email, score, segment, signals, created_at, updated_at)
          VALUES (
            ${row.id as number},
            ${email},
            ${result.score},
            ${segment},
            ${JSON.stringify({ ...result.breakdown, tier: result.tier, opportunity: result.boostifyOpportunity, channel: result.recommendedChannel })}::jsonb,
            NOW(), NOW()
          )
          ON CONFLICT (email) DO UPDATE SET
            score = EXCLUDED.score,
            segment = EXCLUDED.segment,
            signals = EXCLUDED.signals,
            updated_at = NOW()
        `);
        totalScore += result.score;
        scored++;
      } catch (err: any) {
        // Skip individual errors (constraint violations etc.)
      }
    }

    return { scored, avgScore: scored > 0 ? Math.round(totalScore / scored) : 0 };
  } catch (err: any) {
    console.error('[HunterScoring] Batch score error:', err.message);
    return { scored: 0, avgScore: 0 };
  }
}

// ─── Re-score contacts with engagement data ─────────────────────
// Combines the base contact score with real engagement signals
// (opens, clicks, bounces) to produce an updated hybrid score.
// Runs periodically (e.g., every 24h) to keep scores fresh.

export async function rescoreEngagedLeads(batchSize = 500): Promise<{ rescored: number; avgScore: number }> {
  try {
    // Get contacts that HAVE an activation_score AND have engagement signals
    const engaged = await db.execute(sql`
      SELECT c.id, c.email, c.full_name, c.first_name, c.last_name,
             c.phone, c.mobile_number, c.linkedin, c.company_website,
             c.keywords, c.country, c.city, c.import_source, c.job_title,
             c.opens_count, c.clicks_count, c.emails_sent, c.status as contact_status,
             a.score as current_score, a.signals as current_signals,
             a.updated_at as score_updated_at
      FROM music_industry_contacts c
      INNER JOIN activation_scores a ON a.contact_id = c.id
      WHERE a.updated_at < NOW() - INTERVAL '24 hours'
        AND c.status NOT IN ('bounced', 'unsubscribed')
      ORDER BY a.updated_at ASC
      LIMIT ${batchSize}
    `);

    if (!engaged.rows.length) return { rescored: 0, avgScore: 0 };

    let totalScore = 0;
    let rescored = 0;

    for (const row of engaged.rows) {
      // Re-compute base score from contact data
      const base = computeLeadScore({
        email: row.email as string,
        fullName: row.full_name as string,
        firstName: row.first_name as string,
        lastName: row.last_name as string,
        phone: row.phone as string,
        mobileNumber: row.mobile_number as string,
        linkedin: row.linkedin as string,
        companyWebsite: row.company_website as string,
        keywords: row.keywords as string,
        country: row.country as string,
        city: row.city as string,
        importSource: row.import_source as string,
        jobTitle: row.job_title as string,
      });

      // Add engagement bonus (from real email data)
      const opens = (row.opens_count as number) || 0;
      const clicks = (row.clicks_count as number) || 0;
      const emailsSent = (row.emails_sent as number) || 0;

      let engagementBonus = 0;
      if (opens > 0) engagementBonus += Math.min(10, opens * 3); // Up to +10 for opens
      if (clicks > 0) engagementBonus += Math.min(15, clicks * 5); // Up to +15 for clicks
      if (emailsSent > 0 && opens === 0) engagementBonus -= 5; // Penalty: sent but never opened

      // Signals from activation events (already accumulated by trackEvent)
      const signals = (row.current_signals || {}) as Record<string, number>;
      const magicClicks = signals.magic_link_clicked || 0;
      const profileCompleted = signals.profile_completed || 0;
      if (magicClicks > 0) engagementBonus += 15;
      if (profileCompleted > 0) engagementBonus += 20;

      const finalScore = Math.max(0, Math.min(100, base.score + engagementBonus));

      const segment = finalScore >= 70 ? 'hot'
        : finalScore >= 50 ? 'engaged'
        : finalScore >= 30 ? 'warming'
        : 'cold';

      const email = (row.email as string) || `contact_${row.id}@placeholder.internal`;

      try {
        await db.execute(sql`
          UPDATE activation_scores SET
            score = ${finalScore},
            segment = ${segment},
            signals = ${JSON.stringify({
              ...base.breakdown,
              tier: base.tier,
              opportunity: base.boostifyOpportunity,
              channel: base.recommendedChannel,
              engagementBonus,
              opens,
              clicks,
              magicClicks,
              profileCompleted,
              ...signals,
            })}::jsonb,
            updated_at = NOW()
          WHERE contact_id = ${row.id as number}
        `);
        totalScore += finalScore;
        rescored++;
      } catch (err: any) {
        // Skip individual errors
      }
    }

    if (rescored > 0) {
      console.log(`[HunterScoring] Re-scored ${rescored} contacts (avg: ${Math.round(totalScore / rescored)})`);
    }
    return { rescored, avgScore: rescored > 0 ? Math.round(totalScore / rescored) : 0 };
  } catch (err: any) {
    console.error('[HunterScoring] Re-score error:', err.message);
    return { rescored: 0, avgScore: 0 };
  }
}

// ─── Get comprehensive hunter stats ─────────────────────────────

export async function getHunterStats(): Promise<HunterStats> {
  try {
    const [
      totalRes, scoredRes, byStatusRes, bySourceRes, byCountryRes,
      weeklyRes, avgScoreRes, hotRes, tierRes,
    ] = await Promise.all([
      db.execute(sql`SELECT count(*) as cnt FROM music_industry_contacts`),
      db.execute(sql`SELECT count(*) as cnt FROM activation_scores WHERE contact_id IS NOT NULL`),
      db.execute(sql`SELECT status, count(*) as cnt FROM music_industry_contacts GROUP BY status ORDER BY cnt DESC`),
      db.execute(sql`SELECT import_source as source, count(*) as cnt FROM music_industry_contacts GROUP BY import_source ORDER BY cnt DESC LIMIT 10`),
      db.execute(sql`SELECT country, count(*) as cnt FROM music_industry_contacts WHERE country IS NOT NULL GROUP BY country ORDER BY cnt DESC LIMIT 15`),
      db.execute(sql`
        SELECT date_trunc('week', created_at)::text as week, count(*) as cnt
        FROM music_industry_contacts
        WHERE created_at > NOW() - INTERVAL '12 weeks'
        GROUP BY 1 ORDER BY 1
      `),
      db.execute(sql`SELECT COALESCE(AVG(score), 0) as avg FROM activation_scores WHERE contact_id IS NOT NULL`),
      db.execute(sql`SELECT count(*) as cnt FROM activation_scores WHERE score >= 60 AND contact_id IS NOT NULL`),
      db.execute(sql`
        SELECT 
          CASE 
            WHEN score >= 80 THEN 'S'
            WHEN score >= 60 THEN 'A'  
            WHEN score >= 40 THEN 'B'
            WHEN score >= 20 THEN 'C'
            ELSE 'D'
          END as tier,
          count(*) as cnt
        FROM activation_scores WHERE contact_id IS NOT NULL
        GROUP BY 1 ORDER BY 1
      `),
    ]);

    const total = parseInt(totalRes.rows[0]?.cnt as string || '0');
    const scored = parseInt(scoredRes.rows[0]?.cnt as string || '0');

    return {
      totalLeads: total,
      scoredLeads: scored,
      unscoredLeads: total - scored,
      byTier: (tierRes.rows || []).map((r: any) => ({ tier: r.tier, count: parseInt(r.cnt) })),
      byStatus: (byStatusRes.rows || []).map((r: any) => ({ status: r.status || 'new', count: parseInt(r.cnt) })),
      bySource: (bySourceRes.rows || []).map((r: any) => ({ source: r.source || 'unknown', count: parseInt(r.cnt) })),
      byCountry: (byCountryRes.rows || []).map((r: any) => ({ country: r.country, count: parseInt(r.cnt) })),
      weeklyGrowth: (weeklyRes.rows || []).map((r: any) => ({ week: r.week, count: parseInt(r.cnt) })),
      goalProgress: {
        current: total,
        target: 50000,
        percent: Math.round((total / 50000) * 100),
      },
      avgScore: Math.round(parseFloat(avgScoreRes.rows[0]?.avg as string || '0')),
      hotLeads: parseInt(hotRes.rows[0]?.cnt as string || '0'),
    };
  } catch (err: any) {
    console.error('[HunterStats] Error:', err.message);
    return {
      totalLeads: 0, scoredLeads: 0, unscoredLeads: 0,
      byTier: [], byStatus: [], bySource: [], byCountry: [], weeklyGrowth: [],
      goalProgress: { current: 0, target: 50000, percent: 0 },
      avgScore: 0, hotLeads: 0,
    };
  }
}

// ─── Search leads with filters ───────────────────────────────────

export async function searchLeads(filters: {
  query?: string;
  country?: string;
  source?: string;
  status?: string;
  minScore?: number;
  maxScore?: number;
  tier?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ leads: ScoredLead[]; total: number }> {
  const limit = Math.min(filters.limit || 50, 200);
  const offset = filters.offset || 0;
  const sortDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
  const sortBy = ['score', 'created_at', 'full_name', 'country'].includes(filters.sortBy || '')
    ? filters.sortBy! : 'created_at';

  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  if (filters.query) {
    params.push(`%${filters.query}%`);
    conditions.push(`(c.full_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.keywords ILIKE $${params.length})`);
  }
  if (filters.country) {
    params.push(filters.country);
    conditions.push(`c.country = $${params.length}`);
  }
  if (filters.source) {
    params.push(filters.source);
    conditions.push(`c.import_source = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`c.status = $${params.length}`);
  }
  if (filters.minScore !== undefined) {
    params.push(filters.minScore);
    conditions.push(`COALESCE(a.score, 0) >= $${params.length}`);
  }
  if (filters.maxScore !== undefined) {
    params.push(filters.maxScore);
    conditions.push(`COALESCE(a.score, 0) <= $${params.length}`);
  }
  if (filters.tier) {
    const tierMap: Record<string, [number, number]> = {
      'S': [80, 100], 'A': [60, 79], 'B': [40, 59], 'C': [20, 39], 'D': [0, 19],
    };
    const range = tierMap[filters.tier];
    if (range) {
      params.push(range[0], range[1]);
      conditions.push(`COALESCE(a.score, 0) >= $${params.length - 1} AND COALESCE(a.score, 0) <= $${params.length}`);
    }
  }

  const where = conditions.join(' AND ');

  try {
    const sortColumn = sortBy === 'score' ? 'COALESCE(a.score, 0)' 
      : sortBy === 'full_name' ? 'c.full_name'
      : sortBy === 'country' ? 'c.country'
      : 'c.created_at';

    const query = `
      SELECT c.id, c.full_name, c.email, c.country, c.city, c.state, c.company_name,
             c.industry, c.keywords, c.status, c.import_source, c.created_at,
             c.master_json, c.profile_image_url, c.boostify_image_url,
             c.data_completeness, c.emails_sent, c.opens_count, c.clicks_count,
             COALESCE(a.score, 0) as score,
             a.signals
      FROM music_industry_contacts c
      LEFT JOIN activation_scores a ON a.contact_id = c.id
      WHERE ${where}
      ORDER BY ${sortColumn} ${sortDir}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = `
      SELECT count(*) as cnt
      FROM music_industry_contacts c
      LEFT JOIN activation_scores a ON a.contact_id = c.id
      WHERE ${where}
    `;

    const [dataRes, countRes] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params),
    ]);

    const leads: ScoredLead[] = (dataRes.rows || []).map((r: any) => {
      const score = parseInt(r.score || '0');
      const tier = score >= 80 ? 'S' : score >= 60 ? 'A' : score >= 40 ? 'B' : score >= 20 ? 'C' : 'D';
      const signals = r.signals || {};
      const mj = r.master_json || null;
      const mjGenre = Array.isArray(mj?.music?.genres) && mj.music.genres.length ? mj.music.genres[0] : null;
      return {
        id: r.id,
        fullName: r.full_name || '',
        email: r.email,
        country: r.country,
        city: r.city,
        state: r.state,
        companyName: r.company_name,
        industry: r.industry,
        genre: mjGenre || extractGenre(r.keywords),
        score,
        tier,
        status: r.status || 'new',
        importSource: r.import_source,
        createdAt: r.created_at,
        opportunity: signals.opportunity || mj?.opportunities?.[0]?.title || '',
        channel: signals.channel || 'email',
        masterJson: mj,
        profileImageUrl: r.profile_image_url || null,
        boostifyImageUrl: r.boostify_image_url || null,
        dataCompleteness: r.data_completeness != null ? Number(r.data_completeness) : null,
        emailsSent: Number(r.emails_sent || 0),
        opensCount: Number(r.opens_count || 0),
        clicksCount: Number(r.clicks_count || 0),
      };
    });

    return { leads, total: parseInt(countRes.rows[0]?.cnt as string || '0') };
  } catch (err: any) {
    console.error('[HunterSearch] Error:', err.message);
    return { leads: [], total: 0 };
  }
}

function extractGenre(keywords: string | null): string | null {
  if (!keywords) return null;
  const genreWords = ['hip hop', 'rap', 'trap', 'r&b', 'pop', 'rock', 'indie', 'electronic',
    'edm', 'reggaeton', 'latin', 'afrobeats', 'jazz', 'country', 'folk', 'metal',
    'punk', 'soul', 'funk', 'house', 'techno', 'drill', 'k-pop', 'dancehall'];
  const kw = keywords.toLowerCase();
  for (const g of genreWords) {
    if (kw.includes(g)) return g;
  }
  return null;
}

// ─── Save discovery run to DB ────────────────────────────────────

export async function saveDiscoveryRun(run: {
  runId: string;
  sources: string[];
  rawLeads: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  scored: number;
  sourceDetails: any[];
  config: Record<string, any>;
  durationMs: number;
  error?: string;
}): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO discovery_runs (
        run_id, status, sources, raw_leads, inserted, duplicates, invalid, scored,
        source_details, config, error_message, duration_ms, started_at, completed_at
      ) VALUES (
        ${run.runId},
        ${run.error ? 'failed' : 'completed'},
        ${JSON.stringify(run.sources)}::jsonb,
        ${run.rawLeads},
        ${run.inserted},
        ${run.duplicates},
        ${run.invalid},
        ${run.scored},
        ${JSON.stringify(run.sourceDetails)}::jsonb,
        ${JSON.stringify(run.config)}::jsonb,
        ${run.error || null},
        ${run.durationMs},
        NOW() - (${run.durationMs} || ' milliseconds')::interval,
        NOW()
      )
    `);
  } catch (err: any) {
    console.error('[HunterScoring] Save run error:', err.message);
  }
}

// ─── Get recent runs from DB ─────────────────────────────────────

export async function getRecentRuns(limit = 20): Promise<any[]> {
  try {
    const res = await db.execute(sql`
      SELECT * FROM discovery_runs
      ORDER BY started_at DESC
      LIMIT ${limit}
    `);
    return res.rows || [];
  } catch {
    return [];
  }
}

// ─── Update lead status ──────────────────────────────────────────

export async function updateLeadStatus(contactId: number, status: string): Promise<boolean> {
  try {
    await db.execute(sql`
      UPDATE music_industry_contacts SET status = ${status}, updated_at = NOW()
      WHERE id = ${contactId}
    `);
    return true;
  } catch {
    return false;
  }
}
