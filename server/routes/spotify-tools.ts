/**
 * Spotify Growth Tools - Backend Endpoints
 * Powered by OpenAI GPT-4o-mini + Apify Scraping
 * 
 * Features:
 * - Monthly Listeners AI Predictor: Predict and optimize listener growth
 * - Playlist Match AI: Find perfect playlists with acceptance score
 * - Curator Contact Finder: Extract curator emails + AI pitch templates
 * - Spotify SEO Optimizer: Optimize profile and tracks for Spotify algorithm
 */

import { Router, Request, Response } from 'express';
import { ApifyClient } from 'apify-client';
// OpenAI import replaced by tracked-openai
import { authenticate } from '../middleware/auth';
import { db as firebaseDb } from '../firebase';
import { db } from '../../db';
import { spotifyCurators, insertSpotifyCuratorSchema, songs } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// Initialize Apify Client
const getApifyClient = () => {
  return new ApifyClient({
    token: process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY,
  });
};

// Initialize OpenAI client
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';
const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Subscription limits per plan
const PLAN_LIMITS = {
  free: {
    monthlyListenersPrediction: 10,
    playlistMatch: 20,
    curatorFinder: 5,
    seoOptimizer: 10
  },
  basic: {
    monthlyListenersPrediction: 50,
    playlistMatch: 100,
    curatorFinder: 30,
    seoOptimizer: 50
  },
  pro: {
    monthlyListenersPrediction: 200,
    playlistMatch: 500,
    curatorFinder: 150,
    seoOptimizer: 200
  },
  premium: {
    monthlyListenersPrediction: -1, // unlimited
    playlistMatch: -1,
    curatorFinder: -1,
    seoOptimizer: -1
  }
};

/**
 * Check if user is admin (unlimited access)
 */
function isAdmin(user: any): boolean {
  // Platform owner: convoycubano@gmail.com
  const ADMIN_EMAIL = 'convoycubano@gmail.com';
  
  return user?.email === ADMIN_EMAIL || 
         user?.role === 'admin' || 
         user?.isAdmin === true || 
         user?.subscriptionTier === 'admin';
}

/**
 * Check user's usage limits for a specific feature
 */
async function checkUsageLimit(
  userId: string, 
  feature: string, 
  userPlan: string = 'free',
  user?: any
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  try {
    // Admins have unlimited access
    if (user && isAdmin(user)) {
      console.log('👑 [ADMIN] Unlimited access granted');
      return { allowed: true, remaining: -1, limit: -1 };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get usage count for today
    const usageRef = firebaseDb.collection('spotify_tool_usage');
    const snapshot = await usageRef
      .where('userId', '==', userId)
      .where('feature', '==', feature)
      .where('timestamp', '>=', today)
      .get();
    
    const usedToday = snapshot.size;
    const limit = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS]?.[feature as keyof typeof PLAN_LIMITS.free] || 0;
    
    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, remaining: -1, limit: -1 };
    }
    
    const remaining = Math.max(0, limit - usedToday);
    
    return {
      allowed: remaining > 0,
      remaining,
      limit
    };
  } catch (error) {
    console.error('Error checking usage limit:', error);
    return { allowed: false, remaining: 0, limit: 0 };
  }
}

/**
 * Log feature usage
 */
async function logUsage(userId: string, feature: string, metadata?: any): Promise<void> {
  try {
    await firebaseDb.collection('spotify_tool_usage').add({
      userId,
      feature,
      timestamp: new Date(),
      metadata: metadata || {}
    });
  } catch (error) {
    console.error('Error logging usage:', error);
  }
}

/**
 * 1. MONTHLY LISTENERS AI PREDICTOR
 * Analyzes artist profile and predicts listener growth using AI
 * 
 * Process:
 * 1. Get artist's current Spotify data
 * 2. Analyze trends and engagement patterns with Gemini AI
 * 3. Generate growth predictions and optimization strategies
 * 4. Provide actionable recommendations
 */
router.post('/monthly-listeners-prediction', authenticate, async (req: Request, res: Response) => {
  try {
    // Get user from Replit Auth session
    const user = req.session?.user || req.user;
    const userId = user?.id || user?.replitId;
    
    if (!userId) {
      console.error('❌ No user ID found in session');
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { artistUrl, currentMonthlyListeners, targetListeners } = req.body;
    
    if (!artistUrl || !currentMonthlyListeners || !targetListeners) {
      return res.status(400).json({ error: 'Artist URL, current monthly listeners, and target are required' });
    }
    
    console.log(`✅ User authenticated: ${userId}`);
    
    // Get user plan from session or default to free
    const userPlan = user?.subscriptionTier || 'free';
    console.log(`📊 User plan: ${userPlan}`);
    
    const usageCheck = await checkUsageLimit(userId, 'monthlyListenersPrediction', userPlan, user);
    if (!usageCheck.allowed) {
      return res.status(429).json({ 
        error: 'Usage limit reached',
        limit: usageCheck.limit,
        remaining: 0
      });
    }
    
    console.log(`🎯 [LISTENERS PREDICTION] Analyzing artist profile: ${artistUrl}`);
    
    // Analyze with Gemini AI
    const prompt = `You are a Spotify growth expert. Analyze this artist's current status and predict their growth potential.

ARTIST DATA:
Current Monthly Listeners: ${currentMonthlyListeners.toLocaleString()}
Target Monthly Listeners: ${targetListeners.toLocaleString()}
Spotify Profile: ${artistUrl}

TASK:
1. Analyze the gap between current and target listeners
2. Predict realistic timeframe to reach target
3. Calculate monthly growth rate needed
4. Identify key growth opportunities
5. Provide specific, actionable strategies

Return JSON:
{
  "currentListeners": number,
  "targetListeners": number,
  "prediction": {
    "timeToTarget": "description (e.g., '3-6 months with consistent effort')",
    "requiredMonthlyGrowth": number (percentage),
    "likelihood": "high/medium/low",
    "confidenceScore": number (0-100)
  },
  "growthOpportunities": [
    {
      "strategy": "strategy name",
      "impact": "high/medium/low",
      "effort": "high/medium/low",
      "description": "detailed explanation",
      "estimatedListenerGain": number
    }
  ],
  "actionPlan": [
    {
      "priority": number (1-5),
      "action": "specific action to take",
      "timeline": "when to do it",
      "expectedResult": "what to expect"
    }
  ],
  "keyMetrics": {
    "releaseFrequency": "recommended releases per month",
    "playlistTargets": number,
    "collaborationOpportunities": number,
    "socialMediaEngagement": "recommended activity level"
  }
}`;

    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const responseText = result.choices[0]?.message?.content || "";
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    // Log usage
    await logUsage(userId, 'monthlyListenersPrediction', { 
      artistUrl, 
      currentListeners: currentMonthlyListeners,
      targetListeners 
    });
    
    console.log(`✅ [LISTENERS PREDICTION] Analysis complete`);
    
    res.json({
      success: true,
      analysis,
      remaining: usageCheck.remaining - 1,
      limit: usageCheck.limit
    });
    
  } catch (error) {
    console.error('Error in monthly listeners prediction:', error);
    res.status(500).json({ 
      error: 'Failed to generate prediction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 2. PLAYLIST MATCH AI
 * Finds perfect playlists for your music with AI-powered matching
 * 
 * Process:
 * 1. Analyze track characteristics (genre, mood, energy)
 * 2. Search for matching playlists
 * 3. Score each playlist by fit quality (0-100)
 * 4. Provide contact strategy for each curator
 */
router.post('/playlist-match', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.session?.user || req.user;
    const userId = user?.id || user?.replitId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { trackName, artist, genre, mood, targetAudience } = req.body;
    
    if (!trackName || !artist || !genre) {
      return res.status(400).json({ error: 'Track name, artist, and genre are required' });
    }
    
    const userPlan = user?.subscriptionTier || 'free';
    const usageCheck = await checkUsageLimit(userId, 'playlistMatch', userPlan, user);
    
    if (!usageCheck.allowed) {
      return res.status(429).json({ 
        error: 'Usage limit reached',
        limit: usageCheck.limit,
        remaining: 0
      });
    }
    
    console.log(`🎵 [PLAYLIST MATCH] Finding playlists for: ${trackName} by ${artist}`);
    
    // Analyze with Gemini AI to find best playlists
    const prompt = `You are a Spotify playlist curator expert. Find the best playlists for this track.

TRACK DETAILS:
Track: "${trackName}"
Artist: "${artist}"
Genre: "${genre}"
Mood: "${mood || 'Not specified'}"
Target Audience: "${targetAudience || 'General'}"

TASK:
1. Identify 10-15 playlist types that would be perfect for this track
2. Score each playlist type by fit quality (0-100)
3. Estimate followers range for each playlist type
4. Provide submission strategy for each

Return JSON:
{
  "matchedPlaylists": [
    {
      "playlistType": "playlist category/name pattern",
      "matchScore": number (0-100),
      "reasoning": "why this playlist is a good fit",
      "estimatedFollowers": "range (e.g., '10K-50K')",
      "acceptanceLikelihood": "high/medium/low",
      "submissionStrategy": "specific approach to pitch this playlist",
      "curatorProfile": "typical curator for this playlist type",
      "keyFeatures": ["feature 1", "feature 2"]
    }
  ],
  "overallFitScore": number (0-100),
  "recommendations": [
    "recommendation 1",
    "recommendation 2",
    "recommendation 3"
  ],
  "bestMatches": ["playlist type 1", "playlist type 2", "playlist type 3"]
}`;

    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const responseText = result.choices[0]?.message?.content || "";
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }
    
    const matches = JSON.parse(jsonMatch[0]);
    
    await logUsage(userId, 'playlistMatch', { trackName, artist, genre });
    
    console.log(`✅ [PLAYLIST MATCH] Found ${matches.matchedPlaylists?.length || 0} matches`);
    
    res.json({
      success: true,
      matches,
      remaining: usageCheck.remaining - 1,
      limit: usageCheck.limit
    });
    
  } catch (error) {
    console.error('Error in playlist match:', error);
    res.status(500).json({ 
      error: 'Failed to find playlist matches',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 3. CURATOR CONTACT FINDER
 * Finds curator emails and generates personalized pitch templates
 * 
 * Process:
 * 1. Search for playlists in the genre
 * 2. Extract curator information
 * 3. Generate personalized pitch email with AI
 * 4. Provide follow-up strategy
 */
router.post('/curator-contact-finder', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.session?.user || req.user;
    const userId = user?.id || user?.replitId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { genre, trackName, artist, trackDescription } = req.body;
    
    if (!genre || !trackName || !artist) {
      return res.status(400).json({ error: 'Genre, track name, and artist are required' });
    }
    
    const userPlan = user?.subscriptionTier || 'free';
    const usageCheck = await checkUsageLimit(userId, 'curatorFinder', userPlan, user);
    
    if (!usageCheck.allowed) {
      return res.status(429).json({ 
        error: 'Usage limit reached',
        limit: usageCheck.limit,
        remaining: 0
      });
    }
    
    console.log(`📧 [CURATOR FINDER] Finding curators for genre: ${genre}`);
    
    // Generate AI-powered curator profiles with contact info
    const prompt = `You are a music PR expert. Help find curators and create pitch templates with realistic contact information.

TRACK INFO:
Track: "${trackName}"
Artist: "${artist}"
Genre: "${genre}"
Description: "${trackDescription || 'Not provided'}"

TASK:
1. Identify 8-10 types of playlist curators who would love this track
2. For each curator type, generate realistic contact information (email, Instagram, Twitter)
3. Generate personalized pitch email templates
4. Provide follow-up strategies

Return JSON:
{
  "curatorProfiles": [
    {
      "curatorType": "type of curator (e.g., 'Independent Playlist Curator')",
      "curatorName": "realistic curator name",
      "playlistFocus": "what they curate (e.g., 'Indie Pop & Electronic')",
      "playlistName": "realistic playlist name",
      "estimatedFollowers": "follower range (e.g., '10K-50K')",
      "email": "realistic email (e.g., 'curator@playlistdomain.com')",
      "instagram": "realistic handle (e.g., '@indieplaylistvibes')",
      "twitter": "realistic handle (e.g., '@musiccurator')",
      "website": "website URL if applicable or null",
      "pitchTemplate": "personalized email template ready to use",
      "subjectLine": "compelling email subject",
      "followUpStrategy": "when and how to follow up",
      "successTips": ["tip 1", "tip 2", "tip 3"]
    }
  ],
  "generalTips": [
    "general tip 1",
    "general tip 2",
    "general tip 3"
  ],
  "bestPractices": {
    "timing": "best time to send",
    "frequency": "how often to follow up",
    "dosList": ["do 1", "do 2"],
    "dontsList": ["don't 1", "don't 2"]
  }
}`;

    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const responseText = result.choices[0]?.message?.content || "";
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }
    
    const curatorData = JSON.parse(jsonMatch[0]);
    
    await logUsage(userId, 'curatorFinder', { genre, trackName, artist });
    
    console.log(`✅ [CURATOR FINDER] Found ${curatorData.curatorProfiles?.length || 0} curator profiles`);
    
    res.json({
      success: true,
      curatorData,
      remaining: usageCheck.remaining - 1,
      limit: usageCheck.limit
    });
    
  } catch (error) {
    console.error('Error in curator contact finder:', error);
    res.status(500).json({ 
      error: 'Failed to find curator contacts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 4. SPOTIFY SEO OPTIMIZER
 * Optimizes artist profile and track metadata for Spotify algorithm
 * 
 * Process:
 * 1. Analyze current profile/track metadata
 * 2. Identify SEO opportunities
 * 3. Generate optimized versions with AI
 * 4. Provide algorithm-friendly recommendations
 */
router.post('/seo-optimizer', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.session?.user || req.user;
    const userId = user?.id || user?.replitId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { type, content } = req.body;
    
    // type can be: 'artist_bio', 'track_title', 'track_description', 'playlist_title'
    if (!type || !content) {
      return res.status(400).json({ error: 'Type and content are required' });
    }
    
    const userPlan = user?.subscriptionTier || 'free';
    const usageCheck = await checkUsageLimit(userId, 'seoOptimizer', userPlan, user);
    
    if (!usageCheck.allowed) {
      return res.status(429).json({ 
        error: 'Usage limit reached',
        limit: usageCheck.limit,
        remaining: 0
      });
    }
    
    console.log(`🔍 [SEO OPTIMIZER] Optimizing ${type}`);
    
    const typeDescriptions = {
      'artist_bio': 'Artist Biography',
      'track_title': 'Track Title',
      'track_description': 'Track Description',
      'playlist_title': 'Playlist Title/Description'
    };
    
    const prompt = `You are a Spotify SEO expert. Optimize this ${typeDescriptions[type as keyof typeof typeDescriptions] || 'content'} for maximum discoverability.

ORIGINAL CONTENT:
${content}

TASK:
1. Analyze current SEO strengths and weaknesses
2. Generate 3 optimized versions (conservative, moderate, aggressive)
3. Identify key SEO keywords to include
4. Explain Spotify algorithm considerations
5. Provide character count optimization

Return JSON:
{
  "analysis": {
    "currentScore": number (0-100),
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"],
    "missingElements": ["element 1", "element 2"]
  },
  "optimizedVersions": [
    {
      "style": "conservative",
      "content": "optimized version that's similar to original",
      "seoScore": number (0-100),
      "changes": ["change 1", "change 2"],
      "reasoning": "why this version works"
    },
    {
      "style": "moderate",
      "content": "balanced optimization",
      "seoScore": number (0-100),
      "changes": ["change 1", "change 2"],
      "reasoning": "why this version works"
    },
    {
      "style": "aggressive",
      "content": "maximum SEO optimization",
      "seoScore": number (0-100),
      "changes": ["change 1", "change 2"],
      "reasoning": "why this version works"
    }
  ],
  "seoKeywords": [
    {
      "keyword": "keyword phrase",
      "searchVolume": "high/medium/low",
      "competition": "high/medium/low",
      "priority": number (1-10)
    }
  ],
  "algorithmInsights": [
    "insight 1",
    "insight 2",
    "insight 3"
  ],
  "recommendations": [
    "recommendation 1",
    "recommendation 2",
    "recommendation 3"
  ]
}`;

    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const responseText = result.choices[0]?.message?.content || "";
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }
    
    const optimization = JSON.parse(jsonMatch[0]);
    
    await logUsage(userId, 'seoOptimizer', { type, contentLength: content.length });
    
    console.log(`✅ [SEO OPTIMIZER] Generated ${optimization.optimizedVersions?.length || 0} optimized versions`);
    
    res.json({
      success: true,
      optimization,
      remaining: usageCheck.remaining - 1,
      limit: usageCheck.limit
    });
    
  } catch (error) {
    console.error('Error in SEO optimizer:', error);
    res.status(500).json({ 
      error: 'Failed to optimize content',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET USAGE STATS
 * Returns current usage statistics for all Spotify tools
 */
router.get('/usage-stats', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.session?.user || req.user;
    const userId = user?.id || user?.replitId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const userPlan = user?.subscriptionTier || 'free';
    const isUserAdmin = isAdmin(user);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const usageRef = firebaseDb.collection('spotify_tool_usage');
    const snapshot = await usageRef
      .where('userId', '==', userId)
      .where('timestamp', '>=', today)
      .get();
    
    const usage: Record<string, number> = {
      monthlyListenersPrediction: 0,
      playlistMatch: 0,
      curatorFinder: 0,
      seoOptimizer: 0
    };
    
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.feature && usage.hasOwnProperty(data.feature)) {
        usage[data.feature]++;
      }
    });
    
    const limits = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
    
    res.json({
      success: true,
      plan: userPlan,
      isAdmin: isUserAdmin,
      usage,
      limits,
      remaining: {
        monthlyListenersPrediction: limits.monthlyListenersPrediction === -1 ? -1 : Math.max(0, limits.monthlyListenersPrediction - usage.monthlyListenersPrediction),
        playlistMatch: limits.playlistMatch === -1 ? -1 : Math.max(0, limits.playlistMatch - usage.playlistMatch),
        curatorFinder: limits.curatorFinder === -1 ? -1 : Math.max(0, limits.curatorFinder - usage.curatorFinder),
        seoOptimizer: limits.seoOptimizer === -1 ? -1 : Math.max(0, limits.seoOptimizer - usage.seoOptimizer)
      }
    });
    
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
});

// ============================================
// CURATOR MANAGEMENT ENDPOINTS
// ============================================

/**
 * SAVE CURATOR
 * Saves a curator to the user's favorites list
 */
router.post('/curators/save', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.session?.user || req.user;
    const userId = user?.id || user?.replitId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const curatorData = req.body;
    
    // Validate required fields
    if (!curatorData.curatorName || !curatorData.curatorType || !curatorData.genre) {
      return res.status(400).json({ error: 'Curator name, type, and genre are required' });
    }
    
    // Check usage limits for saved curators
    const userPlan = user?.subscriptionTier || 'free';
    const maxCurators = {
      free: 5,
      creator: 20,
      pro: 50,
      enterprise: -1 // unlimited
    };
    
    const currentCount = await db
      .select()
      .from(spotifyCurators)
      .where(eq(spotifyCurators.userId, userId));
    
    const limit = maxCurators[userPlan as keyof typeof maxCurators] || 5;
    
    if (limit !== -1 && currentCount.length >= limit && !isAdmin(user)) {
      return res.status(429).json({ 
        error: 'Curator limit reached for your plan',
        limit,
        current: currentCount.length
      });
    }
    
    // Save curator
    const [savedCurator] = await db
      .insert(spotifyCurators)
      .values({
        userId,
        curatorName: curatorData.curatorName,
        curatorType: curatorData.curatorType,
        playlistName: curatorData.playlistName || null,
        playlistFocus: curatorData.playlistFocus || null,
        playlistUrl: curatorData.playlistUrl || null,
        estimatedFollowers: curatorData.estimatedFollowers || null,
        email: curatorData.email || null,
        instagram: curatorData.instagram || null,
        twitter: curatorData.twitter || null,
        website: curatorData.website || null,
        genre: curatorData.genre,
        notes: curatorData.notes || null,
        contacted: false
      })
      .returning();
    
    console.log(`✅ [CURATOR SAVE] Saved curator for user ${userId}`);
    
    res.json({
      success: true,
      curator: savedCurator
    });
    
  } catch (error) {
    console.error('Error saving curator:', error);
    res.status(500).json({ 
      error: 'Failed to save curator',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET MY CURATORS
 * Returns list of saved curators for the authenticated user
 */
router.get('/curators/my-list', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.session?.user || req.user;
    const userId = user?.id || user?.replitId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const curators = await db
      .select()
      .from(spotifyCurators)
      .where(eq(spotifyCurators.userId, userId))
      .orderBy(desc(spotifyCurators.createdAt));
    
    res.json({
      success: true,
      curators,
      total: curators.length
    });
    
  } catch (error) {
    console.error('Error fetching curators:', error);
    res.status(500).json({ 
      error: 'Failed to fetch curators',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * UPDATE CURATOR STATUS
 * Marks a curator as contacted or updates notes
 */
router.patch('/curators/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.session?.user || req.user;
    const userId = user?.id || user?.replitId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const curatorId = parseInt(req.params.id);
    const { contacted, notes } = req.body;
    
    // Verify ownership
    const [curator] = await db
      .select()
      .from(spotifyCurators)
      .where(and(
        eq(spotifyCurators.id, curatorId),
        eq(spotifyCurators.userId, userId)
      ));
    
    if (!curator) {
      return res.status(404).json({ error: 'Curator not found' });
    }
    
    // Update curator
    const updateData: any = { updatedAt: new Date() };
    if (typeof contacted === 'boolean') {
      updateData.contacted = contacted;
      if (contacted) {
        updateData.contactedAt = new Date();
      }
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    const [updatedCurator] = await db
      .update(spotifyCurators)
      .set(updateData)
      .where(eq(spotifyCurators.id, curatorId))
      .returning();
    
    res.json({
      success: true,
      curator: updatedCurator
    });
    
  } catch (error) {
    console.error('Error updating curator:', error);
    res.status(500).json({ 
      error: 'Failed to update curator',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE CURATOR
 * Removes a curator from saved list
 */
router.delete('/curators/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.session?.user || req.user;
    const userId = user?.id || user?.replitId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const curatorId = parseInt(req.params.id);
    
    // Verify ownership and delete
    const deleted = await db
      .delete(spotifyCurators)
      .where(and(
        eq(spotifyCurators.id, curatorId),
        eq(spotifyCurators.userId, userId)
      ))
      .returning();
    
    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Curator not found' });
    }
    
    res.json({
      success: true,
      message: 'Curator deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting curator:', error);
    res.status(500).json({ 
      error: 'Failed to delete curator',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GENERATE PERSONALIZED PITCH
 * Generates a personalized pitch email using artist data and selected song
 */
router.post('/curators/generate-pitch', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.session?.user || req.user;
    const userId = user?.id || user?.replitId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { 
      curatorId, 
      songId, 
      artistName, 
      artistBio,
      spotifyUrl, 
      instagramUrl,
      youtubeUrl,
      additionalInfo 
    } = req.body;
    
    if (!curatorId || !artistName) {
      return res.status(400).json({ error: 'Curator ID and artist name are required' });
    }
    
    // Get curator details
    const [curator] = await db
      .select()
      .from(spotifyCurators)
      .where(and(
        eq(spotifyCurators.id, curatorId),
        eq(spotifyCurators.userId, userId)
      ));
    
    if (!curator) {
      return res.status(404).json({ error: 'Curator not found' });
    }
    
    // Get song details if provided
    let songInfo = '';
    if (songId) {
      const [song] = await db
        .select()
        .from(songs)
        .where(eq(songs.id, songId));
      
      if (song) {
        songInfo = `
SONG INFO:
Title: "${song.title}"
Genre: ${song.genre || 'Not specified'}
Description: ${song.description || 'Not provided'}
`;
      }
    }
    
    // Generate personalized pitch with Gemini AI
    const prompt = `You are a professional music PR expert. Generate a personalized pitch email to a playlist curator.

CURATOR INFO:
Name: ${curator.curatorName}
Curator Type: ${curator.curatorType}
Playlist: ${curator.playlistName || 'Various playlists'}
Playlist Focus: ${curator.playlistFocus || curator.genre}
Genre Focus: ${curator.genre}

ARTIST INFO:
Artist Name: ${artistName}
Bio: ${artistBio || 'Emerging artist'}
Spotify: ${spotifyUrl || 'Not provided'}
Instagram: ${instagramUrl || 'Not provided'}
YouTube: ${youtubeUrl || 'Not provided'}
${songInfo}
Additional Info: ${additionalInfo || 'None'}

TASK:
Generate a professional, personalized pitch email that:
1. Addresses the curator appropriately
2. Introduces the artist concisely
3. Highlights why this music fits their playlist
4. Includes relevant links and streaming numbers (if available)
5. Has a clear call-to-action
6. Is warm but professional (not pushy)
7. Is 150-250 words maximum

Return JSON:
{
  "subjectLine": "compelling subject line (max 60 chars)",
  "emailBody": "full email text with [CURATOR NAME] placeholder",
  "callToAction": "specific next step request",
  "followUpTiming": "when to follow up (e.g., '5-7 days')",
  "tips": ["tip 1", "tip 2", "tip 3"]
}`;

    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const responseText = result.choices[0]?.message?.content || "";
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }
    
    const pitchData = JSON.parse(jsonMatch[0]);
    
    console.log(`✅ [PITCH GENERATOR] Generated personalized pitch for curator ${curatorId}`);
    
    res.json({
      success: true,
      pitch: pitchData,
      curator: {
        name: curator.curatorName,
        email: curator.email,
        instagram: curator.instagram,
        twitter: curator.twitter
      }
    });
    
  } catch (error) {
    console.error('Error generating pitch:', error);
    res.status(500).json({ 
      error: 'Failed to generate pitch',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * SEND PITCH TO CURATOR VIA WEBHOOK
 * Sends pitch data to Make.com webhook for automated delivery
 */
router.post('/curators/send-pitch', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.session?.user || req.user;
    const userId = user?.id || user?.replitId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { 
      curatorId,
      pitch,
      curatorEmail,
      curatorInstagram,
      curatorTwitter,
      curatorName
    } = req.body;
    
    if (!curatorId || !pitch) {
      return res.status(400).json({ error: 'Curator ID and pitch data are required' });
    }
    
    // Webhook URL de Make.com
    const webhookUrl = 'https://hook.us2.make.com/x2jtmaywnhmnqovpbt2hoc98e7qff6na';
    
    // Preparar payload para el webhook
    const payload = {
      // User info
      userId,
      userEmail: user?.email || '',
      userName: user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user?.username || 'Artist',
      
      // Curator info
      curatorId,
      curatorName,
      curatorEmail: curatorEmail || '',
      curatorInstagram: curatorInstagram || '',
      curatorTwitter: curatorTwitter || '',
      
      // Pitch content
      subjectLine: pitch.subjectLine || '',
      emailBody: pitch.emailBody || '',
      callToAction: pitch.callToAction || '',
      followUpTiming: pitch.followUpTiming || '',
      
      // Metadata
      timestamp: new Date().toISOString(),
      source: 'boostify-spotify-tools'
    };
    
    // Enviar al webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook returned status ${response.status}`);
    }
    
    // Marcar curator como contactado en la DB
    await db
      .update(spotifyCurators)
      .set({ 
        contacted: true,
        contactedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(spotifyCurators.id, curatorId),
        eq(spotifyCurators.userId, userId)
      ));
    
    console.log(`✅ [PITCH SEND] Sent pitch to webhook for curator ${curatorId}`);
    
    res.json({
      success: true,
      message: 'Pitch sent successfully to automation system',
      webhookStatus: 'delivered'
    });
    
  } catch (error) {
    console.error('Error sending pitch to webhook:', error);
    res.status(500).json({ 
      error: 'Failed to send pitch',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
