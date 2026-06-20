/**
 * Agent Brain — AI-powered decision engine for the Artist Hunter Agent
 * 
 * Provides:
 * 1. AI-enhanced lead scoring (contextual analysis via GPT)
 * 2. Smart sequence selection (picks optimal drip based on profile)
 * 3. AI email personalization (custom subject lines + openers)
 * 4. Decision logging (every AI decision is recorded for audit)
 * 
 * Uses GPT-4o-mini for cost efficiency (~$0.15/1M input tokens)
 */

import { createTrackedOpenAI } from '../../utils/tracked-openai';
import { db } from '../../db';
import { agentDecisions, musicIndustryContacts, activationScores } from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';

const openai = createTrackedOpenAI();
const MODEL = 'gpt-4o-mini';

// ─── Types ───────────────────────────────────────────────────────

export interface AIScoreResult {
  aiScore: number; // 0-100
  reasoning: string;
  suggestedSequence: SequenceRecommendation;
  tags: string[]; // e.g. ["high-potential", "needs-video", "latin-market"]
  personalizedOpener: string; // First paragraph for email
  personalizedSubject: string; // Custom subject line
}

export type SequenceRecommendation =
  | 'welcome_cold'
  | 'landing_builder'
  | 'value_showcase'
  | 'upgrade_nudge'
  | 'win_back'
  | 'referral_push';

export interface AgentDecision {
  decisionType: string;
  contactId?: number;
  input: Record<string, any>;
  output: Record<string, any>;
  reasoning: string;
  model: string;
  tokensUsed: number;
  durationMs: number;
}

// ─── AI Lead Scoring ─────────────────────────────────────────────

export async function aiScoreLead(contact: {
  id: number;
  fullName: string;
  email?: string | null;
  country?: string | null;
  city?: string | null;
  keywords?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  importSource?: string | null;
  genre?: string | null;
  opensCount?: number;
  clicksCount?: number;
  emailsSent?: number;
  baseScore?: number;
}): Promise<AIScoreResult | null> {
  const start = Date.now();

  try {
    const prompt = buildScoringPrompt(contact);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SCORING_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      score: number;
      reasoning: string;
      sequence: string;
      tags: string[];
      subject: string;
      opener: string;
    };

    const result: AIScoreResult = {
      aiScore: Math.max(0, Math.min(100, parsed.score)),
      reasoning: parsed.reasoning,
      suggestedSequence: validateSequence(parsed.sequence),
      tags: parsed.tags || [],
      personalizedSubject: parsed.subject || '',
      personalizedOpener: parsed.opener || '',
    };

    // Log the decision
    await logDecision({
      decisionType: 'ai_score',
      contactId: contact.id,
      input: {
        name: contact.fullName,
        country: contact.country,
        genre: contact.genre || contact.keywords?.split(',')[0],
        source: contact.importSource,
        baseScore: contact.baseScore,
      },
      output: result,
      reasoning: result.reasoning,
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
      durationMs: Date.now() - start,
    });

    return result;
  } catch (err: any) {
    console.error('[AgentBrain] AI scoring error:', err.message);
    return null;
  }
}

// ─── Batch AI Scoring (for high-value leads only) ────────────────

export async function aiBatchScoreLeads(batchSize = 20): Promise<{ scored: number; avgAiScore: number }> {
  try {
    // Only AI-score leads with base score >= 40 (B tier+) that haven't been AI-scored yet
    const leads = await db.execute(sql`
      SELECT c.id, c.full_name, c.email, c.country, c.city, c.keywords,
             c.job_title, c.company_name, c.import_source,
             c.opens_count, c.clicks_count, c.emails_sent,
             a.score as base_score, a.signals
      FROM music_industry_contacts c
      INNER JOIN activation_scores a ON a.contact_id = c.id
      WHERE a.score >= 40
        AND c.status NOT IN ('bounced', 'unsubscribed')
        AND (a.signals->>'aiScored') IS NULL
      ORDER BY a.score DESC
      LIMIT ${batchSize}
    `);

    if (!leads.rows.length) return { scored: 0, avgAiScore: 0 };

    let totalScore = 0;
    let scored = 0;

    for (const row of leads.rows) {
      const result = await aiScoreLead({
        id: row.id as number,
        fullName: row.full_name as string,
        email: row.email as string,
        country: row.country as string,
        city: row.city as string,
        keywords: row.keywords as string,
        jobTitle: row.job_title as string,
        companyName: row.company_name as string,
        importSource: row.import_source as string,
        opensCount: (row.opens_count as number) || 0,
        clicksCount: (row.clicks_count as number) || 0,
        emailsSent: (row.emails_sent as number) || 0,
        baseScore: row.base_score as number,
      });

      if (result) {
        // Blend AI score with base score: 40% base + 60% AI
        const blendedScore = Math.round((row.base_score as number) * 0.4 + result.aiScore * 0.6);
        const finalScore = Math.max(0, Math.min(100, blendedScore));

        const segment = finalScore >= 70 ? 'hot'
          : finalScore >= 50 ? 'engaged'
          : finalScore >= 30 ? 'warming'
          : 'cold';

        // Update activation_scores with AI-enhanced data
        const existingSignals = (row.signals || {}) as Record<string, any>;
        await db.execute(sql`
          UPDATE activation_scores SET
            score = ${finalScore},
            segment = ${segment},
            signals = ${JSON.stringify({
              ...existingSignals,
              aiScored: true,
              aiScore: result.aiScore,
              aiReasoning: result.reasoning,
              aiTags: result.tags,
              suggestedSequence: result.suggestedSequence,
              personalizedSubject: result.personalizedSubject,
              personalizedOpener: result.personalizedOpener,
              blendedFrom: { base: row.base_score, ai: result.aiScore },
            })}::jsonb,
            updated_at = NOW()
          WHERE contact_id = ${row.id as number}
        `);

        totalScore += finalScore;
        scored++;
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 300));
    }

    if (scored > 0) {
      console.log(`[AgentBrain] AI-scored ${scored} leads (avg: ${Math.round(totalScore / scored)})`);
    }
    return { scored, avgAiScore: scored > 0 ? Math.round(totalScore / scored) : 0 };
  } catch (err: any) {
    console.error('[AgentBrain] Batch AI score error:', err.message);
    return { scored: 0, avgAiScore: 0 };
  }
}

// ─── Smart Sequence Selection ────────────────────────────────────

export function selectOptimalSequence(contact: {
  score: number;
  tier: string;
  opensCount?: number;
  clicksCount?: number;
  emailsSent?: number;
  signals?: Record<string, any>;
}): SequenceRecommendation {
  const { score, signals } = contact;

  // If AI already suggested a sequence, use it
  if (signals?.suggestedSequence) {
    return signals.suggestedSequence as SequenceRecommendation;
  }

  // Smart rule-based fallback
  if (score >= 70) return 'upgrade_nudge'; // Hot leads → push for conversion
  if (score >= 50) return 'value_showcase'; // Engaged → show full platform value
  if (score >= 35) return 'landing_builder'; // Warming → help them build their page
  return 'welcome_cold'; // Cold → standard welcome funnel
}

// ─── AI Email Personalization ────────────────────────────────────

export async function personalizeEmail(contact: {
  id: number;
  fullName: string;
  email: string;
  genre?: string | null;
  country?: string | null;
  keywords?: string | null;
  signals?: Record<string, any>;
}, originalSubject: string, sequenceType: string, step: number): Promise<{ subject: string; opener: string } | null> {
  // Check if we already have AI-generated content in signals
  if (contact.signals?.personalizedSubject && step === 0) {
    return {
      subject: contact.signals.personalizedSubject,
      opener: contact.signals.personalizedOpener || '',
    };
  }

  // Only personalize step 0 (first contact) and step 2 (follow-up) to save API costs
  if (step !== 0 && step !== 2) return null;

  const start = Date.now();

  try {
    const genre = contact.genre || contact.keywords?.split(',')[0]?.trim() || 'music';
    const name = contact.fullName.split(' ')[0] || contact.fullName;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: EMAIL_PERSONALIZATION_PROMPT },
        {
          role: 'user',
          content: `Artist: ${name}
Genre: ${genre}
Country: ${contact.country || 'Unknown'}
Sequence: ${sequenceType} (step ${step})
Original subject: ${originalSubject}
Keywords: ${contact.keywords || 'none'}

Generate a personalized subject line and opening paragraph.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { subject: string; opener: string };

    await logDecision({
      decisionType: 'personalize_email',
      contactId: contact.id,
      input: { name, genre, country: contact.country, sequenceType, step },
      output: parsed,
      reasoning: `Personalized ${sequenceType} step ${step} for ${genre} artist from ${contact.country}`,
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
      durationMs: Date.now() - start,
    });

    return parsed;
  } catch (err: any) {
    console.error('[AgentBrain] Personalization error:', err.message);
    return null;
  }
}

// ─── Decision Logger ─────────────────────────────────────────────

async function logDecision(decision: AgentDecision): Promise<void> {
  try {
    await db.insert(agentDecisions).values({
      decisionType: decision.decisionType,
      contactId: decision.contactId || null,
      input: decision.input,
      output: decision.output,
      reasoning: decision.reasoning,
      model: decision.model,
      tokensUsed: decision.tokensUsed,
      durationMs: decision.durationMs,
    });
  } catch (err) {
    // Non-critical — don't break the pipeline for logging
    console.error('[AgentBrain] Decision log error:', err);
  }
}

// ─── System Prompts ──────────────────────────────────────────────

const SCORING_SYSTEM_PROMPT = `You are the Boostify Artist Hunter Agent — an AI that evaluates music industry leads for a platform that offers free landing pages, AI art generation, music video creation, and distribution tools.

IMPORTANT: Classify the lead's entity type correctly:
- "solo-artist" — individual musician/singer/songwriter
- "band" — music group, duo, trio, collective
- "producer" — music producer, beatmaker
- "dj" — disc jockey
- "record-label" — record label, music entertainment company (e.g. Sony Music, Universal)
- "podcast" — music podcast, radio show
- "venue" — concert venue, club, arena
- "festival" — music festival
- "management" — artist management, talent agency
- "media" — music magazine, blog, press
- "distributor" — music distribution company

Score the lead 0-100 based on:
- Contact quality (email, name, socials)
- Digital presence (Spotify, Instagram, YouTube, Bandcamp)
- Activity signals (recent releases, followers, monthly listeners)
- Commercial potential (genre demand, market, independence)
- Platform fit (needs video? marketing? distribution?)
- Entity type (solo artists and bands score highest for platform fit)

Also recommend:
- The best email sequence: welcome_cold, landing_builder, value_showcase, upgrade_nudge
- Tags describing the lead (e.g. "latin-market", "needs-video", "high-followers", "record-label", "not-an-artist")
- A personalized email subject line (under 60 chars, includes emoji)
- A personalized opening paragraph (2-3 sentences, warm & professional, mention their genre/country)

Respond ONLY in JSON:
{
  "score": <number 0-100>,
  "entityType": "<entity type from list above>",
  "reasoning": "<1-2 sentence explanation>",
  "sequence": "<sequence_name>",
  "tags": ["tag1", "tag2"],
  "subject": "<personalized subject line>",
  "opener": "<personalized opening paragraph>"
}`;

const EMAIL_PERSONALIZATION_PROMPT = `You personalize outreach emails for Boostify Music — a platform for independent artists offering free landing pages, AI art, music video tools, and distribution.

Write engaging, non-spammy content. Be warm, professional, and music-industry aware. Reference the artist's genre and country naturally. Keep it authentic — no hype or clickbait.

Respond ONLY in JSON:
{
  "subject": "<personalized subject, max 60 chars, include one emoji>",
  "opener": "<2-3 sentence personalized opening paragraph>"
}`;

// ─── Helper Functions ────────────────────────────────────────────

function buildScoringPrompt(contact: Record<string, any>): string {
  const parts = [`Lead: ${contact.fullName}`];
  if (contact.email) parts.push(`Email: ${contact.email}`);
  if (contact.country) parts.push(`Country: ${contact.country}`);
  if (contact.city) parts.push(`City: ${contact.city}`);
  if (contact.genre) parts.push(`Genre: ${contact.genre}`);
  if (contact.keywords) parts.push(`Keywords: ${contact.keywords}`);
  if (contact.jobTitle) parts.push(`Title: ${contact.jobTitle}`);
  if (contact.companyName) parts.push(`Company: ${contact.companyName}`);
  if (contact.companyDescription) parts.push(`Description: ${contact.companyDescription}`);
  if (contact.importSource) parts.push(`Source: ${contact.importSource}`);
  if (contact.baseScore) parts.push(`Base score: ${contact.baseScore}/100`);
  if (contact.opensCount) parts.push(`Email opens: ${contact.opensCount}`);
  if (contact.clicksCount) parts.push(`Email clicks: ${contact.clicksCount}`);
  if (contact.emailsSent) parts.push(`Emails sent: ${contact.emailsSent}`);
  return parts.join('\n');
}

function validateSequence(seq: string): SequenceRecommendation {
  const valid: SequenceRecommendation[] = [
    'welcome_cold', 'landing_builder', 'value_showcase',
    'upgrade_nudge', 'win_back', 'referral_push',
  ];
  return valid.includes(seq as SequenceRecommendation) ? seq as SequenceRecommendation : 'welcome_cold';
}

// ─── Stats ───────────────────────────────────────────────────────

export async function getAgentBrainStats() {
  try {
    const [totalDecisions, todayDecisions, aiScoredLeads, avgTokens] = await Promise.all([
      db.execute(sql`SELECT count(*) as cnt FROM agent_decisions`),
      db.execute(sql`SELECT count(*) as cnt FROM agent_decisions WHERE created_at > NOW() - INTERVAL '24 hours'`),
      db.execute(sql`SELECT count(*) as cnt FROM activation_scores WHERE (signals->>'aiScored')::boolean = true`),
      db.execute(sql`SELECT COALESCE(AVG(tokens_used), 0) as avg FROM agent_decisions WHERE created_at > NOW() - INTERVAL '24 hours'`),
    ]);

    return {
      totalDecisions: parseInt(totalDecisions.rows[0]?.cnt as string || '0'),
      decisionsToday: parseInt(todayDecisions.rows[0]?.cnt as string || '0'),
      aiScoredLeads: parseInt(aiScoredLeads.rows[0]?.cnt as string || '0'),
      avgTokensPerDecision: Math.round(parseFloat(avgTokens.rows[0]?.avg as string || '0')),
    };
  } catch (err) {
    console.error('[AgentBrain] Stats error:', err);
    return { totalDecisions: 0, decisionsToday: 0, aiScoredLeads: 0, avgTokensPerDecision: 0 };
  }
}
