import express from 'express';
import { agentsService as geminiService } from '../services/openai-agents-service';
import { z } from 'zod';
import { logApiUsage } from '../utils/api-logger';

const router = express.Router();

// Schema validations
const musicLyricsSchema = z.object({
  genre: z.string(),
  mood: z.string(),
  theme: z.string(),
  language: z.string(),
  structure: z.string()
});

const videoScriptSchema = z.object({
  lyrics: z.string(),
  style: z.string(),
  mood: z.string()
});

const marketingStrategySchema = z.object({
  musicGenre: z.string().optional(),
  targetAudience: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  budget: z.string().optional(),
  goals: z.string().optional()
});

const socialMediaSchema = z.object({
  platform: z.string().optional(),
  contentType: z.string().optional(),
  artist: z.string().optional(),
  topic: z.string().optional(),
  tone: z.string().optional()
});

const merchandiseSchema = z.object({
  artistStyle: z.string().optional(),
  brandColors: z.string().optional(),
  targetMarket: z.string().optional(),
  priceRange: z.string().optional()
});

const careerAdviceSchema = z.object({
  currentStage: z.string().optional(),
  goals: z.string().optional(),
  challenges: z.string().optional(),
  timeline: z.string().optional()
});

const imageGenerationSchema = z.object({
  prompt: z.string(),
  referenceImage: z.string().optional(),
  style: z.string().optional(),
  mood: z.string().optional()
});

// Generate music lyrics
router.post('/composer/lyrics', async (req, res) => {
  try {
    const params = musicLyricsSchema.parse(req.body);
    const lyrics = await geminiService.generateMusicLyrics(params);
    
    // Log API usage (estimating ~500 tokens per lyrics generation)
    await logApiUsage({
      apiProvider: 'gemini',
      endpoint: '/composer/lyrics',
      model: 'gemini-2.0-flash',
      promptTokens: 300,
      completionTokens: 200,
      status: 'success'
    });
    
    res.json({
      success: true,
      lyrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating lyrics:', error);
    
    await logApiUsage({
      apiProvider: 'gemini',
      endpoint: '/composer/lyrics',
      model: 'gemini-2.0-flash',
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate lyrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate video script
router.post('/video-director/script', async (req, res) => {
  try {
    const params = videoScriptSchema.parse(req.body);
    const script = await geminiService.generateVideoScript(params);
    
    res.json({
      success: true,
      script,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating script:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate script',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate marketing strategy
router.post('/marketing/strategy', async (req, res) => {
  try {
    const params = marketingStrategySchema.parse(req.body);
    const strategy = await geminiService.generateMarketingStrategy(params);
    
    res.json({
      success: true,
      strategy,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate strategy',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate social media content
router.post('/social-media/content', async (req, res) => {
  try {
    const params = socialMediaSchema.parse(req.body);
    const content = await geminiService.generateSocialMediaContent(params);
    
    res.json({
      success: true,
      content,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating social media content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate content',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate merchandise ideas
router.post('/merchandise/ideas', async (req, res) => {
  try {
    const params = merchandiseSchema.parse(req.body);
    const ideas = await geminiService.generateMerchandiseIdeas(params);
    
    res.json({
      success: true,
      ideas,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating merchandise ideas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate ideas',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate career advice
router.post('/manager/advice', async (req, res) => {
  try {
    const params = careerAdviceSchema.parse(req.body);
    const advice = await geminiService.generateCareerAdvice(params);
    
    res.json({
      success: true,
      advice,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating career advice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate advice',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// General text generation endpoint
router.post('/generate', async (req, res) => {
  try {
    const { prompt, systemInstruction, temperature, model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }
    
    const text = await geminiService.generateText(prompt, {
      systemInstruction,
      temperature,
      model
    });
    
    res.json({
      success: true,
      text,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating text:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate text',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate image using Gemini 2.5 Flash Image (Nano Banana)
router.post('/photographer/generate-image', async (req, res) => {
  try {
    const params = imageGenerationSchema.parse(req.body);
    const imageUrl = await geminiService.generateImage(params);
    
    res.json({
      success: true,
      imageUrl,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate image',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
