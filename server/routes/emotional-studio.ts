/**
 * Emotional Studio — API Routes
 *
 * POST /api/emotional-studio/:artistId/analyze-visual   — Silent Emotion analysis
 * POST /api/emotional-studio/:artistId/pain-to-art      — Transform experience into art
 * POST /api/emotional-studio/:artistId/human-layer      — Validate human contributions
 * GET  /api/emotional-studio/:artistId                  — Fetch iconic_identity from blueprint
 */

import { Router, Request, Response } from 'express';
import { callAISimple } from '../utils/smart-ai';
import { buildEmotionalDNA, type ArtistContext } from '../utils/masterpiece-rules';
import { buildSkillsOnlyPrompt } from '../utils/ai-skills-injector';
import { db } from '../../db';
import { users, artistBlueprints } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// ─── GET /api/emotional-studio/:artistId ─────────────────────────────────────
router.get('/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    if (isNaN(artistId)) return res.status(400).json({ success: false, error: 'Invalid artist ID' });

    // Fetch latest completed blueprint
    const [bp] = await db
      .select()
      .from(artistBlueprints)
      .where(eq(artistBlueprints.artistId, artistId))
      .orderBy(desc(artistBlueprints.createdAt))
      .limit(1);

    if (!bp || !bp.blueprintData) {
      return res.json({ success: true, hasData: false, iconicIdentity: null });
    }

    const data = bp.blueprintData as Record<string, unknown>;
    const iconicIdentity = (data.iconic_identity as Record<string, unknown>) || null;

    return res.json({ success: true, hasData: !!iconicIdentity, iconicIdentity });
  } catch (err) {
    console.error('[emotional-studio] GET error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── POST /api/emotional-studio/:artistId/analyze-visual ─────────────────────
router.post('/:artistId/analyze-visual', async (req: Request, res: Response) => {
  try {
    const { imageUrl, artistName, genre, mood } = req.body as {
      imageUrl: string;
      artistName?: string;
      genre?: string;
      mood?: string;
    };

    if (!imageUrl) return res.status(400).json({ success: false, error: 'imageUrl is required' });

    const ctx: ArtistContext = { artistName: artistName || 'the artist', genre, mood };
    const protocol = buildEmotionalDNA(ctx, 'silent-emotion');

    const systemPrompt = buildSkillsOnlyPrompt(
      'emotional-studio',
      `You are a visual communication analyst specializing in emotional impact of images.
${protocol}
Analyze the provided image URL and return a JSON object. Return ONLY valid JSON, no markdown.`,
    );

    const userPrompt = `Analyze this image: ${imageUrl}

Return JSON:
{
  "primaryEmotion": "<the dominant emotion communicated>",
  "emotionScore": <integer 0-100, how clearly the emotion is communicated>,
  "silhouetteReadable": <boolean, is the silhouette recognizable without facial details>,
  "communicatesWithoutText": <boolean, does the image work with text covered>,
  "bodyLanguageNotes": "<what the body language communicates, 1-2 sentences>",
  "improvementNote": "<one specific improvement to strengthen emotional communication>"
}`;

    const raw = await callAISimple('emotional-studio-visual', systemPrompt, userPrompt, { responseFormat: 'json_object' });
    const result = typeof raw === 'string' ? JSON.parse(raw) : raw;

    return res.json({ success: true, analysis: result });
  } catch (err) {
    console.error('[emotional-studio] analyze-visual error:', err);
    return res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

// ─── POST /api/emotional-studio/:artistId/pain-to-art ────────────────────────
router.post('/:artistId/pain-to-art', async (req: Request, res: Response) => {
  try {
    const { experience, artistName, genre, mood } = req.body as {
      experience: string;
      artistName?: string;
      genre?: string;
      mood?: string;
    };

    if (!experience || experience.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'experience must be at least 10 characters' });
    }

    const ctx: ArtistContext = { artistName: artistName || 'the artist', genre, mood };
    const protocol = buildEmotionalDNA(ctx, 'pain-to-art');

    const systemPrompt = buildSkillsOnlyPrompt(
      'emotional-studio',
      `You are an elite music creative director and lyricist.
${protocol}
Transform raw human experience into commercial and artistic material. Return ONLY valid JSON, no markdown.`,
    );

    const userPrompt = `Transform this experience into art for ${artistName || 'the artist'} (${genre || 'music'}):

"${experience}"

Return JSON:
{
  "lyricFragment": "<4-8 lines of original lyrics derived from this experience>",
  "visualConcept": "<1 paragraph describing a music video or cover art concept>",
  "albumConcept": "<album title + 1-sentence concept rooted in this experience>",
  "campaignAngle": "<the marketing angle: what emotion does this campaign make the audience feel?>",
  "universalEmotion": "<the universal emotion this experience taps into>",
  "socialMeaningLayer": {
    "surface": "<the commercial, accessible layer of this content>",
    "depth": "<the social or human truth underneath>"
  }
}`;

    const raw = await callAISimple('emotional-studio-pain-to-art', systemPrompt, userPrompt, { responseFormat: 'json_object' });
    const result = typeof raw === 'string' ? JSON.parse(raw) : raw;

    return res.json({ success: true, result });
  } catch (err) {
    console.error('[emotional-studio] pain-to-art error:', err);
    return res.status(500).json({ success: false, error: 'Generation failed' });
  }
});

// ─── POST /api/emotional-studio/:artistId/human-layer ────────────────────────
router.post('/:artistId/human-layer', async (req: Request, res: Response) => {
  try {
    const {
      songTitle,
      hasHumanVocal,
      hasHumanLyricEdit,
      hasHumanMix,
      hasRealInstrument,
      hasPersonalStory,
      hasManualArtDirection,
    } = req.body as {
      songTitle?: string;
      hasHumanVocal: boolean;
      hasHumanLyricEdit: boolean;
      hasHumanMix: boolean;
      hasRealInstrument: boolean;
      hasPersonalStory: boolean;
      hasManualArtDirection: boolean;
    };

    const layers = [
      { key: 'hasHumanVocal', label: 'Human vocal performance', value: hasHumanVocal, weight: 25 },
      { key: 'hasHumanLyricEdit', label: 'Human lyric editing / authorship', value: hasHumanLyricEdit, weight: 20 },
      { key: 'hasPersonalStory', label: 'Personal story or real experience', value: hasPersonalStory, weight: 20 },
      { key: 'hasHumanMix', label: 'Manual mix / mastering decisions', value: hasHumanMix, weight: 15 },
      { key: 'hasRealInstrument', label: 'Real instrument recorded', value: hasRealInstrument, weight: 10 },
      { key: 'hasManualArtDirection', label: 'Human art direction / visual choices', value: hasManualArtDirection, weight: 10 },
    ];

    const humanScore = layers.reduce((sum, l) => sum + (l.value ? l.weight : 0), 0);
    const missingLayers = layers.filter(l => !l.value).map(l => l.label);

    const status: 'authentic' | 'hybrid' | 'ai-native' =
      humanScore >= 75 ? 'authentic' : humanScore >= 40 ? 'hybrid' : 'ai-native';

    const statusLabel = status === 'authentic' ? 'Authenticated Work' : status === 'hybrid' ? 'Hybrid Work' : 'AI-Native Work';

    const certificate = humanScore >= 40
      ? `🏅 ${statusLabel} — ${humanScore}% Human Layer — "${songTitle || 'Untitled'}" — Boostify Verified`
      : `⚠️ ${statusLabel} — ${humanScore}% Human Layer — Consider adding human elements`;

    return res.json({
      success: true,
      humanScore,
      status,
      certificate,
      missingLayers,
      layers: layers.map(l => ({ label: l.label, active: l.value, weight: l.weight })),
    });
  } catch (err) {
    console.error('[emotional-studio] human-layer error:', err);
    return res.status(500).json({ success: false, error: 'Validation failed' });
  }
});

export default router;
