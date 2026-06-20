/**
 * Lyrics Copywrite Workflow API
 * 
 * CRUD for lyrics projects + AI-assisted draft generation.
 * Tracks human authorship traceability across 7 phases.
 */

import { Router, Request, Response } from 'express';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { lyricsProjects } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { buildLyricMasterpieceRules, type ArtistContext } from '../utils/masterpiece-rules';

const router = Router();

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// ─── List all lyrics projects for authenticated user ───
router.get('/projects', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const projects = await db
      .select()
      .from(lyricsProjects)
      .where(eq(lyricsProjects.userId, userId))
      .orderBy(desc(lyricsProjects.updatedAt));

    res.json(projects);
  } catch (err: any) {
    console.error('[lyrics-workflow] GET /projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// ─── Get single lyrics project ───
router.get('/projects/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project id' });

    const [project] = await db
      .select()
      .from(lyricsProjects)
      .where(and(eq(lyricsProjects.id, projectId), eq(lyricsProjects.userId, userId)));

    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err: any) {
    console.error('[lyrics-workflow] GET /projects/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// ─── Create new lyrics project ───
router.post('/projects', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const body = req.body;

    const [project] = await db
      .insert(lyricsProjects)
      .values({
        userId,
        songTitle: body.songTitle || 'Untitled',
        language: body.language || 'en',
        genre: body.genre,
        theme: body.theme,
        emotion: body.emotion,
        messageCore: body.messageCore,
        personalStory: body.personalStory,
        styleReferences: body.styleReferences || [],
        keywords: body.keywords || [],
        humanOriginalPhrases: body.humanOriginalPhrases || [],
        humanIdeas: body.humanIdeas || [],
        desiredTone: body.desiredTone,
        freeWritingBlock: body.freeWritingBlock,
        looseLines: body.looseLines || [],
        metaphorBank: body.metaphorBank || [],
        hookBank: body.hookBank || [],
        narrativeImages: body.narrativeImages || [],
        structureMap: body.structureMap,
        verseCount: body.verseCount,
        chorusLength: body.chorusLength,
        hookRepetition: body.hookRepetition,
        bridgePosition: body.bridgePosition,
        closingType: body.closingType,
        draftVersions: body.draftVersions || [],
        authorshipMetrics: body.authorshipMetrics,
        finalLyrics: body.finalLyrics,
        authorDeclaration: body.authorDeclaration,
        currentPhase: body.currentPhase || 1,
        status: body.status || 'draft',
      })
      .returning();

    res.status(201).json(project);
  } catch (err: any) {
    console.error('[lyrics-workflow] POST /projects error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ─── Update existing lyrics project (auto-save) ───
router.put('/projects/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project id' });

    // Verify ownership
    const [existing] = await db
      .select({ id: lyricsProjects.id })
      .from(lyricsProjects)
      .where(and(eq(lyricsProjects.id, projectId), eq(lyricsProjects.userId, userId)));

    if (!existing) return res.status(404).json({ error: 'Project not found' });

    const body = req.body;

    const [updated] = await db
      .update(lyricsProjects)
      .set({
        songTitle: body.songTitle,
        language: body.language,
        genre: body.genre,
        theme: body.theme,
        emotion: body.emotion,
        messageCore: body.messageCore,
        personalStory: body.personalStory,
        styleReferences: body.styleReferences,
        keywords: body.keywords,
        humanOriginalPhrases: body.humanOriginalPhrases,
        humanIdeas: body.humanIdeas,
        desiredTone: body.desiredTone,
        freeWritingBlock: body.freeWritingBlock,
        looseLines: body.looseLines,
        metaphorBank: body.metaphorBank,
        hookBank: body.hookBank,
        narrativeImages: body.narrativeImages,
        structureMap: body.structureMap,
        verseCount: body.verseCount,
        chorusLength: body.chorusLength,
        hookRepetition: body.hookRepetition,
        bridgePosition: body.bridgePosition,
        closingType: body.closingType,
        draftVersions: body.draftVersions,
        authorshipMetrics: body.authorshipMetrics,
        finalLyrics: body.finalLyrics,
        authorDeclaration: body.authorDeclaration,
        currentPhase: body.currentPhase,
        status: body.status,
        updatedAt: new Date(),
      })
      .where(eq(lyricsProjects.id, projectId))
      .returning();

    res.json(updated);
  } catch (err: any) {
    console.error('[lyrics-workflow] PUT /projects/:id error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// ─── Delete lyrics project ───
router.delete('/projects/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project id' });

    const [deleted] = await db
      .delete(lyricsProjects)
      .where(and(eq(lyricsProjects.id, projectId), eq(lyricsProjects.userId, userId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[lyrics-workflow] DELETE /projects/:id error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ─── AI Draft Generation ───
router.post('/generate-draft', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { project, mode } = req.body;
    if (!project || !mode) {
      return res.status(400).json({ error: 'project and mode are required' });
    }

    // Build context from human inputs
    const humanContext = [
      project.songTitle ? `Song title: "${project.songTitle}"` : '',
      project.genre ? `Genre: ${project.genre}` : '',
      project.emotion ? `Emotion: ${project.emotion}` : '',
      project.theme ? `Theme: ${project.theme}` : '',
      project.language ? `Language: ${project.language}` : '',
      project.desiredTone ? `Tone: ${project.desiredTone}` : '',
      project.messageCore ? `Core message: ${project.messageCore}` : '',
      project.personalStory ? `Personal story: ${project.personalStory}` : '',
      project.humanIdeas?.length ? `Original ideas: ${project.humanIdeas.join('; ')}` : '',
      project.humanOriginalPhrases?.length ? `Original phrases: ${project.humanOriginalPhrases.join('; ')}` : '',
      project.keywords?.length ? `Keywords: ${project.keywords.join(', ')}` : '',
      project.looseLines?.length ? `Loose lines: ${project.looseLines.join(' / ')}` : '',
      project.hookBank?.length ? `Hooks: ${project.hookBank.join('; ')}` : '',
      project.metaphorBank?.length ? `Metaphors: ${project.metaphorBank.join('; ')}` : '',
      project.freeWritingBlock ? `Free writing: ${project.freeWritingBlock.slice(0, 500)}` : '',
    ].filter(Boolean).join('\n');

    // Structure info
    const structure = project.structureMap;
    const activeSections = structure
      ? Object.entries(structure).filter(([, v]) => v).map(([k]) => k)
      : ['verse1', 'chorus', 'verse2'];

    const structureInfo = `Song structure sections: ${activeSections.join(', ')}
Verse count: ${project.verseCount || 2}
Chorus length: ${project.chorusLength || 'medium'}`;

    // Mode-specific instructions
    const modeInstructions: Record<string, string> = {
      expand: 'Expand the human-written lines into a complete song draft, maintaining the original style and meaning. Add new lines where needed to fill the structure.',
      rhyme: 'Create rhyming variations and improvements for the lines. Ensure proper rhyme scheme (ABAB or AABB) while preserving the meaning.',
      'chorus-variants': 'Generate 3 different chorus variants based on the hooks and theme. Each variant should have a different angle but maintain the core message.',
      metric: 'Adjust the lyrics to maintain consistent syllable count and rhythm. Ensure natural flow when sung. Match the genre rhythm patterns.',
      imagery: 'Enhance the lyrics with vivid imagery, sensory details, and poetic devices. Replace generic phrases with specific, evocative language.',
      'genre-adapt': `Adapt the lyrics to fit the ${project.genre || 'pop'} genre conventions, including typical vocabulary, themes, and structural patterns.`,
    };

    const lyricsMode = mode === 'chorus-variants' ? 'chorus-only' : mode === 'expand' ? 'full-song' : 'rewrite';
    const ctx: ArtistContext = {
      artistName: project.artistName || 'the artist',
      genre: project.genre || null,
      mood: project.emotion || null,
      songTitle: project.songTitle || null,
    };
    const masterpieceBlock = buildLyricMasterpieceRules(ctx, lyricsMode as any);

    const systemPrompt = `You are a professional songwriter assistant. Your role is to help develop lyrics while preserving the human author's creative intent.

IMPORTANT RULES:
- Mark each line clearly with its section: [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Outro]
- Preserve all human-original lines as much as possible
- Any new lines you generate should complement the author's style
- Write in ${project.language === 'es' ? 'Spanish' : project.language === 'pt' ? 'Portuguese' : project.language === 'fr' ? 'French' : 'English'}
- Output ONLY the lyrics with section markers, no explanations

${masterpieceBlock}`;

    const userPrompt = `${modeInstructions[mode] || modeInstructions.expand}

HUMAN CREATIVE INPUT:
${humanContext}

SONG STRUCTURE:
${structureInfo}

Generate the draft lyrics now:`;

    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.8,
    });

    const draft = response.choices[0]?.message?.content || '';

    res.json({
      success: true,
      draft,
      mode,
      tokensUsed: response.usage?.total_tokens || 0,
    });
  } catch (err: any) {
    console.error('[lyrics-workflow] POST /generate-draft error:', err);
    // Return a graceful fallback so the frontend can still work
    res.status(500).json({
      success: false,
      error: 'AI generation failed',
      draft: '',
    });
  }
});

export default router;
