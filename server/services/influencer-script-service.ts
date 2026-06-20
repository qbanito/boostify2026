/**
 * Influencer Script Service — AI-powered script generation for influencer content
 *
 * Uses OpenAI GPT-4o to generate engaging scripts based on:
 * - Artist personality & genre
 * - Trending topics
 * - Content type (educational, entertainment, review, etc.)
 * - Target duration (30s, 60s, 90s)
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { db } from '../../db';
import { users, artistPersonality, influencerContent } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { buildSkillsOnlyPrompt } from '../utils/ai-skills-injector';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY });

export interface ScriptGenerationResult {
  success: boolean;
  title?: string;
  script?: string;
  hook?: string;
  cta?: string;
  hashtags?: string[];
  estimatedDurationSec?: number;
  topic?: string;
  error?: string;
}

export interface TopicSuggestion {
  topic: string;
  contentType: string;
  hook: string;
  viralPotential: 'low' | 'medium' | 'high';
}

const CONTENT_TOPICS = [
  'music_production_tips',
  'industry_secrets',
  'behind_the_scenes',
  'gear_reviews',
  'trending_reaction',
  'music_theory_made_easy',
  'artist_motivation',
  'how_i_made_this_song',
  'genre_evolution',
  'collaboration_stories',
  'fan_engagement',
  'music_business',
  'viral_trends',
  'storytelling',
  'hot_takes',
];

/**
 * Generate a full influencer script for a given topic
 */
export async function generateInfluencerScript(
  userId: number,
  options: {
    topic?: string;
    contentType?: string;
    targetDurationSec?: number;
    language?: string;
    customPrompt?: string;
  } = {}
): Promise<ScriptGenerationResult> {
  try {
    // Get artist info for personalization
    const [artist] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!artist) {
      return { success: false, error: 'Artist not found' };
    }

    // Get personality if exists
    const [personality] = await db.select()
      .from(artistPersonality)
      .where(eq(artistPersonality.artistId, userId))
      .limit(1);

    const artistName = artist.artistName || artist.username || 'Artist';
    const genre = (artist as any).genre || 'music';
    const bio = artist.biography || '';
    const topic = options.topic || CONTENT_TOPICS[Math.floor(Math.random() * CONTENT_TOPICS.length)];
    const contentType = options.contentType || 'entertainment';
    const targetDuration = options.targetDurationSec || 60;
    const language = options.language || 'en';

    // Calculate approximate word count (avg ~150 words/min spoken)
    const targetWords = Math.round((targetDuration / 60) * 150);

    const personalityContext = personality
      ? `Personality traits: ${personality.traits || 'charismatic, passionate'}. Communication style: ${personality.communicationStyle || 'engaging'}. Mood: ${personality.currentMood || 'confident'}.`
      : 'Personality: charismatic, passionate about music, engaging speaker.';

    const systemPrompt = buildSkillsOnlyPrompt(
      'influencer-module',
      `You are an expert viral content scriptwriter for social media (TikTok, Instagram Reels, YouTube Shorts).
You write scripts that are engaging, authentic, and designed to hook viewers within the first 3 seconds.

Artist Profile:
- Name: ${artistName}
- Genre: ${genre}
- Bio: ${bio}
${personalityContext}

Rules:
- Write in first person as the artist
- Start with a powerful hook (question, bold statement, or surprising fact)
- Keep sentences short and punchy
- Include natural pauses marked with [PAUSE]
- End with a clear CTA (call to action)
- Target approximately ${targetWords} words (~${targetDuration} seconds spoken)
- Language: ${language === 'es' ? 'Spanish' : language === 'en' ? 'English' : language}
- Content type: ${contentType}
- Be authentic, not salesy
- Add emotional variety (humor, surprise, vulnerability, confidence)`,
    );

    const userPrompt = options.customPrompt
      ? `Create a viral script about: ${options.customPrompt}\nTopic category: ${topic}`
      : `Create a viral ${contentType} script about "${topic.replace(/_/g, ' ')}" that would resonate with ${genre} music fans. Make it personal to ${artistName}'s journey and expertise.`;

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return { success: false, error: 'Empty response from OpenAI' };
    }

    const parsed = JSON.parse(raw);

    return {
      success: true,
      title: parsed.title || `${artistName} on ${topic.replace(/_/g, ' ')}`,
      script: parsed.script || parsed.content || raw,
      hook: parsed.hook || '',
      cta: parsed.cta || parsed.call_to_action || '',
      hashtags: parsed.hashtags || [],
      estimatedDurationSec: parsed.estimated_duration_sec || targetDuration,
      topic,
    };
  } catch (error: any) {
    logger.error(`[InfluencerScript] Generation error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Suggest trending topics for an artist based on their genre
 */
export async function suggestTopics(
  userId: number,
  count: number = 5
): Promise<TopicSuggestion[]> {
  try {
    const [artist] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const artistName = artist?.artistName || 'Artist';
    const genre = (artist as any)?.genre || 'music';

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a viral content strategist. Suggest ${count} trending content topics for a ${genre} artist named ${artistName}. Each topic should have high engagement potential on TikTok/Instagram Reels.`,
        },
        {
          role: 'user',
          content: `Suggest ${count} viral content ideas. Return JSON: { "topics": [{ "topic": "...", "contentType": "educational|entertainment|review|trending|opinion|behind_scenes|promo|reaction|tips", "hook": "opening line", "viralPotential": "low|medium|high" }] }`,
        },
      ],
      temperature: 0.9,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return parsed.topics || [];
  } catch (error: any) {
    logger.error(`[InfluencerScript] Topic suggestion error: ${error.message}`);
    return [];
  }
}

/**
 * Save a generated script as draft influencer content
 */
export async function saveScriptAsDraft(
  userId: number,
  script: ScriptGenerationResult,
  contentType: string = 'entertainment'
) {
  const [inserted] = await db.insert(influencerContent).values({
    userId,
    title: script.title || 'Untitled',
    scriptText: script.script || '',
    topic: script.topic || 'general',
    contentType: contentType as any,
    hashtags: script.hashtags || [],
    targetDurationSec: script.estimatedDurationSec || 60,
    status: 'script_ready',
  }).returning();

  return inserted;
}
