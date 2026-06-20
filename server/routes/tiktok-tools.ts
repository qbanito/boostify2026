/**
 * TikTok Growth Tools - Backend Endpoints
 * Powered by OpenAI GPT-4o-mini
 * 
 * Features:
 * 1. Reel Script Creator — AI-generated scripts with hooks, scenes, captions
 * 2. Trend Scanner — Discover viral trends in your niche
 * 3. Caption & Hashtag Generator — Optimized captions with CTAs
 * 4. Content Calendar Planner — Multi-day posting schedule
 * 5. Viral Score Analyzer — Predict viral potential of a video idea
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Initialize OpenAI client
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';
const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to call OpenAI and extract JSON response
async function callOpenAI(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [
      { role: 'system', content: 'You are a TikTok growth expert and viral content strategist. Always respond with valid JSON only, no markdown fences.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.8,
  });
  return response.choices[0]?.message?.content || '{}';
}

function parseJSON(text: string): any {
  try {
    // Strip markdown fences if present
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// 1. REEL SCRIPT CREATOR
// ═══════════════════════════════════════════════════════
router.post('/tiktok-reel-script', async (req: Request, res: Response) => {
  try {
    const { topic, style, duration, artistName, genre } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const prompt = `Create a complete TikTok reel script for an artist.

Topic/Idea: "${topic}"
Style: ${style || 'trending'}
Duration: ${duration || '30'} seconds
${artistName ? `Artist Name: ${artistName}` : ''}
${genre ? `Genre: ${genre}` : ''}

Generate a JSON object with:
{
  "hook": "A powerful first-3-seconds hook that stops the scroll",
  "scenes": [
    {
      "timestamp": "0:00-0:03",
      "visual": "What the viewer sees",
      "text": "On-screen text overlay",
      "audio": "Voiceover or sound description"
    }
  ],
  "caption": "The full caption text for the post",
  "hashtags": ["#hashtag1", "#hashtag2", ...up to 10 relevant hashtags],
  "music": "Suggested TikTok sound or song name",
  "duration": "${duration || '30'} seconds",
  "viralScore": 75 (number 0-100 predicting viral potential)
}

Include 4-6 scenes that match the duration. Make the hook attention-grabbing.
Use trending TikTok formats and music references. Make it specific to the artist's genre if provided.`;

    const raw = await callOpenAI(prompt);
    const result = parseJSON(raw);

    if (!result) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error generating TikTok reel script:', error);
    res.status(500).json({ error: 'Failed to generate reel script' });
  }
});

// ═══════════════════════════════════════════════════════
// 2. TREND SCANNER
// ═══════════════════════════════════════════════════════
router.post('/tiktok-trends', async (req: Request, res: Response) => {
  try {
    const { niche, artistName } = req.body;

    if (!niche) {
      return res.status(400).json({ error: 'Niche is required' });
    }

    const prompt = `Analyze current TikTok trends for the niche: "${niche}"
${artistName ? `For artist: ${artistName}` : ''}

Return a JSON object:
{
  "trends": [
    {
      "trend": "Name/description of the trend",
      "category": "Sound | Format | Challenge | Effect | Storytelling",
      "velocity": "rising" | "peaked" | "declining",
      "confidence": 85 (number 0-100),
      "hashtags": ["#trend1", "#trend2", "#trend3"],
      "suggestedAngles": ["How this artist could use this trend", "Another creative angle"],
      "bestPostTime": "7-9 PM EST",
      "estimatedReach": "50K-200K views"
    }
  ]
}

Provide exactly 6 trends. Include a mix of rising and peaked trends.
Focus on trends that a music artist could realistically use.
Consider current TikTok algorithm preferences (watch time, shares, saves).`;

    const raw = await callOpenAI(prompt);
    const result = parseJSON(raw);

    if (!result) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error scanning TikTok trends:', error);
    res.status(500).json({ error: 'Failed to scan trends' });
  }
});

// ═══════════════════════════════════════════════════════
// 3. CAPTION & HASHTAG GENERATOR
// ═══════════════════════════════════════════════════════
router.post('/tiktok-captions', async (req: Request, res: Response) => {
  try {
    const { topic, style, artistName, genre } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const prompt = `Generate 3 TikTok captions for this video:

Topic: "${topic}"
Tone/Style: ${style || 'engaging'}
${artistName ? `Artist: ${artistName}` : ''}
${genre ? `Genre: ${genre}` : ''}

Return JSON:
{
  "captions": [
    {
      "caption": "The main caption body text (2-3 sentences max, TikTok style)",
      "hashtags": ["#tag1", "#tag2", ...8-12 hashtags mixing popular + niche],
      "hook": "The first line that appears before 'see more' (must stop the scroll)",
      "cta": "Call to action (e.g., 'Follow for more' or 'Save this for later')",
      "style": "${style || 'engaging'}",
      "engagementScore": 82 (number 0-100 predicting engagement)
    }
  ]
}

Each caption should have a different approach:
1. One with a question hook
2. One with a bold statement
3. One with a story/emotional hook

Use Gen-Z language naturally. Include emojis where appropriate.
Mix hashtag sizes: 3-4 large (1M+ posts), 3-4 medium (100K-1M), 3-4 niche (<100K).`;

    const raw = await callOpenAI(prompt);
    const result = parseJSON(raw);

    if (!result) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error generating TikTok captions:', error);
    res.status(500).json({ error: 'Failed to generate captions' });
  }
});

// ═══════════════════════════════════════════════════════
// 4. CONTENT CALENDAR PLANNER
// ═══════════════════════════════════════════════════════
router.post('/tiktok-calendar', async (req: Request, res: Response) => {
  try {
    const { niche, days, artistName, genre } = req.body;

    if (!niche) {
      return res.status(400).json({ error: 'Niche is required' });
    }

    const numDays = Math.min(Math.max(parseInt(days) || 7, 3), 30);

    const prompt = `Create a ${numDays}-day TikTok content calendar for:

Niche: "${niche}"
${artistName ? `Artist: ${artistName}` : ''}
${genre ? `Genre: ${genre}` : ''}

Return JSON:
{
  "calendar": [
    {
      "day": "Day 1 - Monday",
      "time": "7:00 PM",
      "concept": "Brief description of the video concept",
      "hook": "The opening hook text/action",
      "sound": "Suggested trending sound or original audio",
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "format": "Lip-sync | Dance | Transition | Talking head | Skit | BTS | Duet | Tutorial",
      "estimatedViews": "5K-20K"
    }
  ]
}

Rules:
- Vary formats across the week (no two consecutive days same format)
- Optimal posting times based on TikTok data (usually 7-9 PM, noon, or 10 AM)
- Include 1-2 "tentpole" posts (higher effort, higher viral potential) per week
- Include trending sounds when possible
- Mix promotional content (20%) with entertainment/value content (80%)
- Consider the 80/20 rule: 80% entertainment, 20% promotion`;

    const raw = await callOpenAI(prompt);
    const result = parseJSON(raw);

    if (!result) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error generating TikTok calendar:', error);
    res.status(500).json({ error: 'Failed to generate calendar' });
  }
});

// ═══════════════════════════════════════════════════════
// 5. VIRAL SCORE ANALYZER
// ═══════════════════════════════════════════════════════
router.post('/tiktok-viral-score', async (req: Request, res: Response) => {
  try {
    const { description, hashtags, artistName, genre } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Video description is required' });
    }

    const prompt = `Analyze the viral potential of this TikTok video:

Description: "${description}"
${hashtags ? `Planned Hashtags: ${hashtags}` : ''}
${artistName ? `Artist: ${artistName}` : ''}
${genre ? `Genre: ${genre}` : ''}

Return JSON:
{
  "score": 72 (number 0-100, realistic viral potential score),
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "improvements": [
    "Specific actionable improvement 1",
    "Specific actionable improvement 2",
    "Specific actionable improvement 3",
    "Specific actionable improvement 4"
  ],
  "optimalLength": "15-30 seconds",
  "bestPostTimes": ["7 PM EST", "12 PM EST", "10 AM EST"],
  "hashtagStrategy": ["#fyp", "#music", "#viral", "#newartist", "#${genre || 'indie'}"],
  "soundRecommendation": ["Use trending sound X", "Original audio works for this content"],
  "estimatedReach": {
    "min": 5000,
    "max": 50000
  }
}

Be realistic with scores. Consider:
- Hook strength (first 1-3 seconds)
- Watch-time potential (will people watch to the end?)
- Shareability (would someone send this to a friend?)
- Save potential (is this useful/inspiring enough to save?)
- Comment bait (does this trigger responses?)
- TikTok algorithm factors (completion rate, shares > likes)`;

    const raw = await callOpenAI(prompt);
    const result = parseJSON(raw);

    if (!result) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error analyzing TikTok viral score:', error);
    res.status(500).json({ error: 'Failed to analyze viral potential' });
  }
});

export default router;
