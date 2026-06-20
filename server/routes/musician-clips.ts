import { Router } from 'express';
import { db } from '../db';
import { musicianClips, musicVideoProjects } from '../db/schema';
import { insertMusicianClipSchema, type InsertMusicianClip } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { generateImageWithNanoBanana, editImageWithNanoBanana } from '../services/fal-service';
import { logger } from '../utils/logger';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '' });

router.post('/api/musician-clips/generate-description', async (req, res) => {
  try {
    const { instrument, scriptContext, timestamp, director, concept } = req.body;

    if (!instrument || !scriptContext) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const prompt = `You are creating a musician character for a music video.

Video Concept: ${concept || 'Not specified'}
Director Style: ${director?.name || 'Not specified'} - ${director?.style || 'Modern cinematic'}
Instrument: ${instrument}
Scene Context: ${scriptContext}
Timestamp: ${timestamp}s

Generate a detailed, vivid description for a ${instrument} player that fits perfectly into this scene. The description should be ready to use for AI image generation.

Include:
- Physical appearance (age, gender, style)
- Outfit/clothing style that matches the video's aesthetic
- Instrument details (color, brand, style)
- Lighting and mood
- Camera angle (close-up, medium shot, etc.)
- Background/setting
- Pose and expression while playing

Keep it consistent with the video's overall aesthetic and make it cinematic.
Format as a single, detailed paragraph optimized for AI image generation.`;

    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.8,
    });
    
    const description = result.choices[0]?.message?.content?.trim() || '';
    
    if (!description) {
      throw new Error('No description generated from AI');
    }

    res.json({
      description,
      instrument,
      timestamp,
    });
  } catch (error: any) {
    logger.error('Error generating musician description:', error);
    res.status(500).json({ error: error.message || 'Failed to generate description' });
  }
});

router.post('/api/musician-clips/generate-image', async (req, res) => {
  try {
    const { description, faceReferenceUrl } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    logger.log('🎸 Generating musician image with FAL nano-banana...');
    logger.log('📝 Description:', description);
    
    let finalPrompt = `${description}\n\nPhotorealistic, cinematic quality, professional lighting, 8K resolution.`;
    
    if (faceReferenceUrl) {
      logger.log('👤 Using face reference for musician generation');
      const result = await editImageWithNanoBanana([faceReferenceUrl], finalPrompt);
      
      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || 'Failed to generate image with face reference');
      }
      
      return res.json({
        imageUrl: result.imageUrl,
        success: true,
      });
    }

    const result = await generateImageWithNanoBanana(finalPrompt);
    
    if (!result.success || !result.imageUrl) {
      throw new Error(result.error || 'Failed to generate image');
    }

    res.json({
      imageUrl: result.imageUrl,
      success: true,
    });
  } catch (error: any) {
    logger.error('Error generating musician image:', error);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
});

router.post('/api/musician-clips/save', async (req, res) => {
  try {
    const validatedData = insertMusicianClipSchema.parse(req.body);

    const [musicianClip] = await db
      .insert(musicianClips)
      .values({
        ...validatedData,
        status: 'completed',
      })
      .returning();

    res.json({
      success: true,
      musicianClip,
    });
  } catch (error: any) {
    logger.error('Error saving musician clip:', error);
    res.status(500).json({ error: error.message || 'Failed to save musician clip' });
  }
});

router.get('/api/musician-clips/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const clips = await db
      .select()
      .from(musicianClips)
      .where(eq(musicianClips.projectId, parseInt(projectId)));

    res.json(clips);
  } catch (error: any) {
    logger.error('Error fetching musician clips:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch musician clips' });
  }
});

router.delete('/api/musician-clips/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .delete(musicianClips)
      .where(eq(musicianClips.id, parseInt(id)));

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting musician clip:', error);
    res.status(500).json({ error: error.message || 'Failed to delete musician clip' });
  }
});

export default router;
