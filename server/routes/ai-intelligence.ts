/**
 * AI Intelligence Routes
 * 
 * Endpoints para los nuevos agentes:
 * - News Agent: Noticias de entretenimiento y reacciones
 * - Whisper Agent: Análisis de letras y generación de historias de video
 * - Outreach Agent: Outreach automatizado a la industria
 */

import { Router, Request, Response } from 'express';
import { isAdminEmail } from '../../shared/constants';

// Import agents
import { 
  fetchEntertainmentNews, 
  processNewsForArtists, 
  generateArtistReactions,
  postNewsReactions,
  processNewsTick
} from '../agents/news-agent';

import {
  transcribeAudio,
  transcribeFromUrl,
  analyzeLyrics,
  generateVideoStory,
  generateVideoStoryForSong
} from '../agents/whisper-agent';

import {
  selectArtistsForOutreach,
  generatePersonalizedEmail,
  executeOutreachCampaign,
  processOutreachTick,
  sendTestEmail
} from '../agents/outreach-agent';

import { db } from '../db';
import { outreachEmailLog } from '../../db/schema';
import { sql, gte } from 'drizzle-orm';

const router = Router();

// ============================================
// NEWS AGENT ENDPOINTS
// ============================================

/**
 * GET /api/ai-intelligence/news
 * Fetch latest entertainment news
 */
router.get('/news', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string || 'music industry news';
    const articles = await fetchEntertainmentNews(query);
    
    res.json({
      success: true,
      count: articles.length,
      articles
    });
  } catch (error: any) {
    console.error('Error fetching news:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-intelligence/news/process
 * Process news and generate artist reactions
 */
router.post('/news/process', async (req: Request, res: Response) => {
  try {
    // Verify admin
    const userEmail = (req as any).user?.email;
    if (!isAdminEmail(userEmail)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    
    const { articles } = req.body;
    
    if (!articles || !Array.isArray(articles)) {
      return res.status(400).json({ error: 'articles array required' });
    }
    
    const processedNews = await processNewsForArtists(articles);
    
    res.json({
      success: true,
      processed: processedNews.length,
      news: processedNews
    });
  } catch (error: any) {
    console.error('Error processing news:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-intelligence/news/react
 * Generate artist reactions to a specific news item
 */
router.post('/news/react', async (req: Request, res: Response) => {
  try {
    const { headline, summary, topics, maxReactions } = req.body;
    
    if (!headline) {
      return res.status(400).json({ error: 'headline required' });
    }
    
    const news = {
      id: `manual_${Date.now()}`,
      headline,
      summary: summary || headline,
      relevanceToMusic: 80,
      sentiment: 'neutral' as const,
      topics: topics || ['music'],
      potentialReactions: []
    };
    
    const reactions = await generateArtistReactions(news, maxReactions || 3);
    
    res.json({
      success: true,
      reactions
    });
  } catch (error: any) {
    console.error('Error generating reactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-intelligence/news/tick
 * Manually trigger a news tick (admin only)
 */
router.post('/news/tick', async (req: Request, res: Response) => {
  try {
    const userEmail = (req as any).user?.email;
    if (!isAdminEmail(userEmail)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    
    await processNewsTick();
    
    res.json({
      success: true,
      message: 'News tick processed'
    });
  } catch (error: any) {
    console.error('Error in news tick:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WHISPER AGENT ENDPOINTS
// ============================================

/**
 * POST /api/ai-intelligence/transcribe
 * Transcribe audio from URL
 */
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioUrl } = req.body;
    
    if (!audioUrl) {
      return res.status(400).json({ error: 'audioUrl required' });
    }
    
    const transcription = await transcribeFromUrl(audioUrl);
    
    if (!transcription) {
      return res.status(500).json({ error: 'Transcription failed' });
    }
    
    res.json({
      success: true,
      transcription
    });
  } catch (error: any) {
    console.error('Error transcribing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-intelligence/analyze-lyrics
 * Analyze song lyrics
 */
router.post('/analyze-lyrics', async (req: Request, res: Response) => {
  try {
    const { lyrics, songTitle, artistName } = req.body;
    
    if (!lyrics || !songTitle) {
      return res.status(400).json({ error: 'lyrics and songTitle required' });
    }
    
    const analysis = await analyzeLyrics(lyrics, songTitle, artistName || 'Unknown Artist');
    
    if (!analysis) {
      return res.status(500).json({ error: 'Analysis failed' });
    }
    
    res.json({
      success: true,
      analysis
    });
  } catch (error: any) {
    console.error('Error analyzing lyrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-intelligence/generate-video-story
 * Generate complete video story/treatment
 */
router.post('/generate-video-story', async (req: Request, res: Response) => {
  try {
    const { lyrics, songTitle, artistName, artistStyle, songDuration } = req.body;
    
    if (!lyrics || !songTitle) {
      return res.status(400).json({ error: 'lyrics and songTitle required' });
    }
    
    const story = await generateVideoStory(
      lyrics,
      songTitle,
      artistName || 'Unknown Artist',
      artistStyle,
      songDuration
    );
    
    if (!story) {
      return res.status(500).json({ error: 'Story generation failed' });
    }
    
    res.json({
      success: true,
      story
    });
  } catch (error: any) {
    console.error('Error generating video story:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-intelligence/generate-video-story/:songId
 * Generate video story for existing song in database
 */
router.post('/generate-video-story/:songId', async (req: Request, res: Response) => {
  try {
    const songId = parseInt(req.params.songId);
    
    if (isNaN(songId)) {
      return res.status(400).json({ error: 'Invalid songId' });
    }
    
    const story = await generateVideoStoryForSong(songId);
    
    if (!story) {
      return res.status(500).json({ error: 'Story generation failed - check if song has lyrics' });
    }
    
    res.json({
      success: true,
      story
    });
  } catch (error: any) {
    console.error('Error generating video story for song:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// OUTREACH AGENT ENDPOINTS
// ============================================

/**
 * GET /api/ai-intelligence/outreach/daily-limit
 * Get current daily email limit status
 */
router.get('/outreach/daily-limit', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(outreachEmailLog)
      .where(gte(outreachEmailLog.sentAt, today));
    
    const sentToday = result[0]?.count || 0;
    const maxPerDay = 10; // MAX_EMAILS_PER_DAY constant
    
    res.json({
      success: true,
      dailyLimit: maxPerDay,
      sentToday,
      remaining: Math.max(0, maxPerDay - sentToday),
      limitReached: sentToday >= maxPerDay
    });
  } catch (error: any) {
    console.error('Error checking daily limit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai-intelligence/outreach/artists
 * Get top artists for outreach
 */
router.get('/outreach/artists', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const artists = await selectArtistsForOutreach(limit);
    
    res.json({
      success: true,
      count: artists.length,
      artists
    });
  } catch (error: any) {
    console.error('Error selecting artists:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-intelligence/outreach/preview-email
 * Preview a personalized outreach email
 */
router.post('/outreach/preview-email', async (req: Request, res: Response) => {
  try {
    const { contactName, contactEmail, contactRole, contactCompany, contactInterests } = req.body;
    
    if (!contactName || !contactEmail) {
      return res.status(400).json({ error: 'contactName and contactEmail required' });
    }
    
    const artists = await selectArtistsForOutreach(3);
    
    if (artists.length === 0) {
      return res.status(404).json({ error: 'No artists available for outreach' });
    }
    
    const email = await generatePersonalizedEmail(
      {
        name: contactName,
        email: contactEmail,
        role: contactRole,
        company: contactCompany,
        interests: contactInterests
      },
      artists
    );
    
    if (!email) {
      return res.status(500).json({ error: 'Email generation failed' });
    }
    
    res.json({
      success: true,
      email,
      artistsUsed: artists.map(a => ({ id: a.artistId, name: a.artistName }))
    });
  } catch (error: any) {
    console.error('Error previewing email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-intelligence/outreach/campaign
 * Execute outreach campaign (admin only)
 */
router.post('/outreach/campaign', async (req: Request, res: Response) => {
  try {
    const userEmail = (req as any).user?.email;
    if (!isAdminEmail(userEmail)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    
    const { artistIds, contactLimit, dryRun } = req.body;
    
    const results = await executeOutreachCampaign(
      artistIds || [],
      contactLimit || 10,
      dryRun !== false // Default to dry run for safety
    );
    
    res.json({
      success: true,
      totalContacts: results.length,
      emailsSent: results.filter(r => r.emailSent).length,
      results
    });
  } catch (error: any) {
    console.error('Error executing campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-intelligence/outreach/test-email
 * Send a test email to verify the system (admin only)
 */
router.post('/outreach/test-email', async (req: Request, res: Response) => {
  try {
    const userEmail = (req as any).user?.email;
    if (!isAdminEmail(userEmail)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    
    const { email, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address required' });
    }
    
    const result = await sendTestEmail(email, name || 'Test Recipient');
    
    if (result.success) {
      res.json({
        success: true,
        message: `Test email sent to ${email}`,
        messageId: result.messageId,
        emailContent: result.emailContent
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error sending test email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai-intelligence/outreach/tick
 * Manually trigger outreach tick (admin only)
 */
router.post('/outreach/tick', async (req: Request, res: Response) => {
  try {
    const userEmail = (req as any).user?.email;
    if (!isAdminEmail(userEmail)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    
    await processOutreachTick();
    
    res.json({
      success: true,
      message: 'Outreach tick processed'
    });
  } catch (error: any) {
    console.error('Error in outreach tick:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// COMBINED INTELLIGENCE STATUS
// ============================================

/**
 * GET /api/ai-intelligence/status
 * Get status of all intelligence agents
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const artists = await selectArtistsForOutreach(3);
    
    res.json({
      success: true,
      agents: {
        newsAgent: {
          status: 'active',
          description: 'Fetches entertainment news and generates artist reactions',
          lastRun: null // Would track this in production
        },
        whisperAgent: {
          status: 'active',
          description: 'Transcribes audio and generates video stories from lyrics',
          capabilities: ['transcription', 'lyrics_analysis', 'video_story_generation']
        },
        outreachAgent: {
          status: 'active',
          description: 'Sends personalized emails to music industry contacts',
          artistsReady: artists.length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error getting status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
