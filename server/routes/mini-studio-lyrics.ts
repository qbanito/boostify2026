/**
 * Mini Studio — Lyrics Generation
 * --------------------------------------------------------------
 * POST /api/mini-studio/lyrics/generate
 *   { topic, genre?, mood?, language?, structure? } → { lyrics }
 *
 * POST /api/mini-studio/lyrics/rewrite
 *   { lyrics, instruction } → { lyrics }
 */

import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/clerk-auth';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { buildLyricMasterpieceRules, type ArtistContext } from '../utils/masterpiece-rules';

const router = Router();

const openai = process.env.OPENAI_API_KEY
  ? createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SYSTEM_PROMPT = `You are a professional songwriter. Write original song lyrics with:
- Clear section markers like [Verse 1], [Pre-Chorus], [Chorus], [Bridge], [Outro]
- Natural rhythm and singable phrasing (not academic prose)
- Vivid imagery, emotional honesty, memorable hook
- Respect the user's language, genre, and mood constraints
- Do NOT copy existing copyrighted lyrics. Always output ORIGINAL work.`;

router.post('/lyrics/generate', isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!openai) return res.status(503).json({ success: false, error: 'OpenAI not configured' });

    const { topic, genre = 'pop', mood = 'uplifting', language = 'en', structure = 'verse-chorus-verse-chorus-bridge-chorus', artistName } = req.body || {};
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ success: false, error: 'topic is required' });
    }

    const ctx: ArtistContext = { artistName: artistName || 'the artist', genre, mood };
    const masterpieceBlock = buildLyricMasterpieceRules(ctx, 'full-song');

    const systemPrompt = `${SYSTEM_PROMPT}\n\n${masterpieceBlock}`;

    const userMsg = `Write an original song.
Topic / theme: ${topic}
Genre: ${genre}
Mood: ${mood}
Language: ${language}
Structure: ${structure}

Aim for 24-40 lines total. Use section tags in square brackets.`;

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.9,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
    });
    const lyrics = completion.choices[0]?.message?.content?.trim() || '';
    if (!lyrics) return res.status(502).json({ success: false, error: 'No lyrics returned' });
    return res.json({ success: true, lyrics });
  } catch (err: any) {
    console.error('[mini-studio] lyrics/generate failed:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Generation failed' });
  }
});

router.post('/lyrics/rewrite', isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!openai) return res.status(503).json({ success: false, error: 'OpenAI not configured' });
    const { lyrics, instruction, genre, mood, artistName } = req.body || {};
    if (!lyrics || !instruction) {
      return res.status(400).json({ success: false, error: 'lyrics and instruction are required' });
    }

    const ctx: ArtistContext = { artistName: artistName || 'the artist', genre: genre || null, mood: mood || null };
    const masterpieceBlock = buildLyricMasterpieceRules(ctx, 'rewrite');
    const rewriteSystemPrompt = `${SYSTEM_PROMPT}\n\n${masterpieceBlock}`;

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.85,
      messages: [
        { role: 'system', content: rewriteSystemPrompt },
        { role: 'user', content: `Rewrite the following lyrics. Instruction: ${instruction}\n\nOriginal:\n${lyrics}` },
      ],
    });
    const out = completion.choices[0]?.message?.content?.trim() || '';
    return res.json({ success: true, lyrics: out });
  } catch (err: any) {
    console.error('[mini-studio] lyrics/rewrite failed:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Rewrite failed' });
  }
});

export default router;
