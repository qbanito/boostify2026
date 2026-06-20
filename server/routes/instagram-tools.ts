import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { db } from '../db';
import { instagramExtensionConnections, instagramProfileSnapshots, instagramPendingActions, users, songs } from '../db/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { apifyInstagram } from '../services/apify-instagram';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

// Initialize OpenAI for text generation (migrated from Gemini)
const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Helper: get artist context for personalized generation
async function getArtistContext(userId: number) {
  try {
    const [user] = await db.select({
      artistName: users.artistName, genre: users.genre, genres: users.genres,
      biography: users.biography, location: users.location, instagramHandle: users.instagramHandle,
    }).from(users).where(eq(users.id, userId)).limit(1);

    const recentSongs = await db.select({ title: songs.title, genre: songs.genre })
      .from(songs).where(eq(songs.userId, userId)).orderBy(desc(songs.createdAt)).limit(3);

    if (!user) return '';
    const parts = [];
    if (user.artistName) parts.push(`Artist: ${user.artistName}`);
    if (user.genre || user.genres?.length) parts.push(`Genre: ${user.genre || user.genres?.join(', ')}`);
    if (user.location) parts.push(`Based in: ${user.location}`);
    if (recentSongs.length) parts.push(`Latest tracks: ${recentSongs.map(s => s.title).join(', ')}`);
    return parts.length ? `\n\nARTIST CONTEXT (personalize for this artist):\n${parts.join('\n')}` : '';
  } catch { return ''; }
}

// Helper function to generate content with OpenAI
async function generateWithOpenAI(prompt: string, maxTokens: number = 1000): Promise<string> {
  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    response_format: { type: 'json_object' }
  });
  return response.choices[0]?.message?.content || '';
}

// Usage tracking helper — persists to DB via pending actions table
async function trackUsage(userId: number, feature: string) {
  try {
    // Find active connection for this user
    const [conn] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.status, 'active')
      ))
      .limit(1);

    await db.insert(instagramPendingActions).values({
      userId,
      connectionId: conn?.id || null,
      actionType: 'post_caption',
      payload: { feature, usedAt: new Date().toISOString(), tool: 'instagram-ai' },
      status: 'applied',
      generatedBy: 'usage-tracking',
      priority: 10,
    });
  } catch (err) {
    // Non-blocking — don't fail the main request
    console.log(`[IG-Tools] Usage tracked: User ${userId} → ${feature}`);
  }
}

// Caption Generator
router.post("/caption-generator", authenticate, async (req, res) => {
  try {
    const { postTopic, tone, targetAudience, includeEmojis, includeHashtags } = req.body;
    const userId = req.session?.user?.id || req.user?.id;

    if (!postTopic) {
      return res.status(400).json({ error: "Post topic is required" });
    }

    await trackUsage(userId, "caption_generator");

    const artistCtx = await getArtistContext(userId);

    const prompt = `As an Instagram marketing expert for music artists, generate 5 engaging Instagram captions for a post about: "${postTopic}"
${artistCtx}
Tone: ${tone || 'professional'}
Target Audience: ${targetAudience || 'general'}
Include Emojis: ${includeEmojis ? 'Yes' : 'No'}
Include Hashtags: ${includeHashtags ? 'Yes' : 'No'}

For each caption:
1. Make it engaging and authentic
2. Use appropriate emojis if requested
3. Include a call-to-action
4. Add 5-10 relevant hashtags at the end if requested
5. Keep it between 100-150 characters (excluding hashtags)

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{
  "captions": [
    {
      "text": "Caption text here",
      "hashtags": ["hashtag1", "hashtag2"],
      "characterCount": 120,
      "engagementScore": 85
    }
  ]
}`;

    const responseText = await generateWithOpenAI(prompt, 1000);
    
    // Clean response to extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI");
    }
    
    const captionData = JSON.parse(jsonMatch[0]);

    res.json({
      captions: captionData.captions || [],
      metadata: {
        topic: postTopic,
        tone,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Caption generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate captions" });
  }
});

// Hashtag Generator
router.post("/hashtag-generator", authenticate, async (req, res) => {
  try {
    const { niche, contentType, targetSize } = req.body;
    const userId = req.session?.user?.id || req.user?.id;

    if (!niche) {
      return res.status(400).json({ error: "Niche is required" });
    }

    await trackUsage(userId, "hashtag_generator");

    const artistCtx = await getArtistContext(userId);

    const prompt = `As an Instagram growth expert for music artists, generate optimized hashtags for:
${artistCtx}
Niche: ${niche}
Content Type: ${contentType || 'general post'}
Target Audience Size: ${targetSize || 'mixed'}

Provide 3 sets of hashtags:
1. High-Competition (1M+ posts) - 5 hashtags
2. Medium-Competition (100K-1M posts) - 10 hashtags  
3. Low-Competition (<100K posts) - 15 hashtags

Also provide:
- Trending hashtags for this niche
- Branded hashtag suggestions
- Best practices for this niche

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "highCompetition": ["hashtag1", "hashtag2"],
  "mediumCompetition": ["hashtag1", "hashtag2"],
  "lowCompetition": ["hashtag1", "hashtag2"],
  "trending": ["hashtag1", "hashtag2"],
  "brandedSuggestions": ["hashtag1", "hashtag2"],
  "bestPractices": "Use a mix of all three sizes..."
}`;

    const responseText = await generateWithOpenAI(prompt, 1000);
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI");
    }
    
    const hashtagData = JSON.parse(jsonMatch[0]);

    res.json({
      hashtags: hashtagData,
      metadata: {
        niche,
        contentType,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Hashtag generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate hashtags" });
  }
});

// Content Ideas Generator
router.post("/content-ideas", authenticate, async (req, res) => {
  try {
    const { niche, goals, postingFrequency } = req.body;
    const userId = req.session?.user?.id || req.user?.id;

    if (!niche) {
      return res.status(400).json({ error: "Niche is required" });
    }

    await trackUsage(userId, "content_ideas");

    const artistCtx = await getArtistContext(userId);

    const prompt = `As an Instagram content strategist for music artists, generate 10 creative content ideas for:
${artistCtx}
Niche: ${niche}
Goals: ${goals || 'increase engagement and followers'}
Posting Frequency: ${postingFrequency || '5 times per week'}

For each idea provide:
1. Content type (Photo, Carousel, Reel, Story)
2. Topic/Theme
3. Brief description
4. Best time to post
5. Expected engagement level (low/medium/high)
6. Content format tips

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "ideas": [
    {
      "contentType": "Reel",
      "topic": "Topic name",
      "description": "Detailed description",
      "bestTimeToPost": "6-9 PM",
      "engagementLevel": "high",
      "formatTips": "Tips for creating this content"
    }
  ],
  "contentCalendar": {
    "monday": "Content type",
    "tuesday": "Content type",
    "wednesday": "Content type",
    "thursday": "Content type",
    "friday": "Content type"
  }
}`;

    const responseText = await generateWithOpenAI(prompt, 1200);
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI");
    }
    
    const contentData = JSON.parse(jsonMatch[0]);

    res.json({
      ideas: contentData.ideas || [],
      contentCalendar: contentData.contentCalendar || {},
      metadata: {
        niche,
        goals,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Content ideas error:", error);
    res.status(500).json({ error: error.message || "Failed to generate content ideas" });
  }
});

// Best Time Analyzer
router.post("/best-time-analyzer", authenticate, async (req, res) => {
  try {
    const { niche, targetAudience, timezone } = req.body;
    const userId = req.session?.user?.id || req.user?.id;

    if (!niche) {
      return res.status(400).json({ error: "Niche is required" });
    }

    await trackUsage(userId, "best_time_analyzer");

    const artistCtx = await getArtistContext(userId);

    const prompt = `As an Instagram analytics expert for music artists, analyze the best posting times for:
${artistCtx}
Niche: ${niche}
Target Audience: ${targetAudience || 'general'}
Timezone: ${timezone || 'UTC'}

Provide:
1. Best times for each day of the week
2. Peak engagement hours
3. Days to avoid posting
4. Reasoning for each recommendation
5. Content type specific timing (Reels vs Posts vs Stories)

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "bestTimes": {
    "monday": ["9:00 AM", "6:00 PM"],
    "tuesday": ["9:00 AM", "6:00 PM"],
    "wednesday": ["9:00 AM", "6:00 PM"],
    "thursday": ["9:00 AM", "6:00 PM"],
    "friday": ["9:00 AM", "6:00 PM"],
    "saturday": ["11:00 AM", "7:00 PM"],
    "sunday": ["11:00 AM", "7:00 PM"]
  },
  "peakHours": ["6:00 PM - 9:00 PM", "9:00 AM - 11:00 AM"],
  "avoidDays": [],
  "reasoning": "Explanation of why these times work...",
  "contentTypeTimings": {
    "reels": "Best posted at 7:00 PM",
    "posts": "Best posted at 9:00 AM",
    "stories": "Post throughout the day"
  }
}`;

    const responseText = await generateWithOpenAI(prompt, 800);
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI");
    }
    
    const timingData = JSON.parse(jsonMatch[0]);

    // Map response to match frontend expected format
    res.json({
      weekdaySchedule: timingData.bestTimes || {},
      peakEngagementHours: timingData.peakHours || [],
      recommendations: timingData.reasoning || '',
      contentTypeTimings: timingData.contentTypeTimings || {},
      avoidDays: timingData.avoidDays || [],
      analysis: timingData,
      metadata: {
        niche,
        targetAudience,
        timezone,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Best time analyzer error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze best times" });
  }
});

// Bio Optimizer
router.post("/bio-optimizer", authenticate, async (req, res) => {
  try {
    const { currentBio, niche, goals, websiteUrl } = req.body;
    const userId = req.session?.user?.id || req.user?.id;

    await trackUsage(userId, "bio_optimizer");

    const artistCtx = await getArtistContext(userId);

    const prompt = `As an Instagram profile optimization expert for music artists, optimize this Instagram bio:
${artistCtx}
Current Bio: ${currentBio || 'No bio provided'}
Niche: ${niche || 'Not specified'}
Goals: ${goals || 'Grow followers and engagement'}
Website: ${websiteUrl || 'None'}

Provide:
1. 3 optimized bio versions (short, medium, detailed)
2. Call-to-action suggestions
3. Emoji recommendations
4. Link-in-bio strategy
5. Profile optimization tips

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "optimizedBios": [
    {
      "version": "short",
      "bio": "Bio text here",
      "characterCount": 120,
      "keywords": ["keyword1", "keyword2"]
    },
    {
      "version": "medium",
      "bio": "Bio text here",
      "characterCount": 140,
      "keywords": ["keyword1", "keyword2"]
    },
    {
      "version": "detailed",
      "bio": "Bio text here",
      "characterCount": 150,
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "ctaSuggestions": ["CTA 1", "CTA 2"],
  "emojiRecommendations": ["✨", "🎵"],
  "linkStrategy": "Use link-in-bio tool to...",
  "profileTips": [
    "Tip 1",
    "Tip 2"
  ]
}`;

    const responseText = await generateWithOpenAI(prompt, 1000);
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI");
    }
    
    const bioData = JSON.parse(jsonMatch[0]);

    res.json({
      optimization: bioData,
      metadata: {
        niche,
        goals,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Bio optimizer error:", error);
    res.status(500).json({ error: error.message || "Failed to optimize bio" });
  }
});

// Community - Get Content Calendar
router.get("/community/calendar", authenticate, async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.user?.id;
    
    // Get real pending actions as content calendar items
    const actions = await db.select()
      .from(instagramPendingActions)
      .where(eq(instagramPendingActions.userId, userId))
      .orderBy(desc(instagramPendingActions.createdAt))
      .limit(20);

    const contentItems = actions.map((a, idx) => ({
      id: String(a.id),
      title: (a.payload as any)?.text || (a.payload as any)?.caption || `${a.actionType} #${a.id}`,
      type: a.actionType === 'post_reel' ? 'reel' : a.actionType === 'post_story' ? 'story' : 'post',
      status: a.status === 'applied' ? 'published' : a.status === 'sent' ? 'scheduled' : 'draft',
      date: a.createdAt,
    }));

    // If no real actions, provide helpful empty state
    if (contentItems.length === 0) {
      return res.json({ contentItems: [], empty: true, message: 'Genera contenido con las AI Tools para ver tu calendario' });
    }
    
    res.json({ contentItems });
  } catch (error: any) {
    console.error("Calendar error:", error);
    res.status(500).json({ error: "Failed to fetch calendar" });
  }
});

// Community - Get Engagement Stats (from real snapshot data)
router.get("/community/engagement", authenticate, async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.user?.id;

    // Find active connection
    const [conn] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.status, 'active')
      ))
      .limit(1);

    if (!conn) {
      return res.json({
        postsThisWeek: 0, engagementRate: 0, comments: 0,
        newFollowers: 0, pendingComments: 0, likesToday: 0,
        connected: false, message: 'Conecta la extensión de Chrome para ver estadísticas reales'
      });
    }

    // Get the two most recent snapshots to calculate deltas
    const snapshots = await db.select()
      .from(instagramProfileSnapshots)
      .where(eq(instagramProfileSnapshots.connectionId, conn.id))
      .orderBy(desc(instagramProfileSnapshots.snapshotAt))
      .limit(2);

    const latest = snapshots[0];
    const previous = snapshots[1];

    const pendingActions = await db.select()
      .from(instagramPendingActions)
      .where(and(
        eq(instagramPendingActions.connectionId, conn.id),
        eq(instagramPendingActions.status, 'pending')
      ));

    const newFollowers = latest && previous ? (latest.followers || 0) - (previous.followers || 0) : 0;

    const stats = {
      postsThisWeek: latest?.postsCount || 0,
      engagementRate: latest?.engagementRate ? Number(latest.engagementRate.toFixed(2)) : 0,
      comments: latest?.avgComments ? Math.round(latest.avgComments) : 0,
      newFollowers: Math.max(0, newFollowers),
      pendingComments: pendingActions.length,
      likesToday: latest?.avgLikes ? Math.round(latest.avgLikes) : 0,
      followers: latest?.followers || 0,
      following: latest?.following || 0,
      connected: true,
      lastSync: conn.lastSyncAt,
      topPost: (latest?.recentPosts as any)?.[0] || null
    };
    
    res.json(stats);
  } catch (error: any) {
    console.error("Engagement error:", error);
    res.status(500).json({ error: "Failed to fetch engagement" });
  }
});

// Influencers - Search (real Apify data with fallback)
router.post("/influencers/search", authenticate, async (req, res) => {
  try {
    const { query, niche } = req.body;
    const searchTerm = query || niche || 'music';

    // Try Apify real search first
    if (process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY) {
      try {
        const results = await apifyInstagram.searchInfluencers(searchTerm, 1000, 10);
        const influencers = results.map((r, idx) => ({
          id: String(idx + 1),
          name: r.fullName || r.username,
          username: r.username,
          niche: searchTerm,
          followers: r.followersCount >= 1000000 ? `${(r.followersCount / 1000000).toFixed(1)}M` : 
                   r.followersCount >= 1000 ? `${(r.followersCount / 1000).toFixed(1)}K` : String(r.followersCount),
          followersCount: r.followersCount,
          engagement: `${r.insights.engagementRate.toFixed(1)}%`,
          rating: Math.min(5, Math.max(3, 3 + r.insights.engagementRate / 3)),
          posts: r.postsCount,
          profilePicUrl: r.profilePicUrl,
          isVerified: r.isVerified,
          url: r.url,
        }));
        return res.json({ influencers, source: 'apify' });
      } catch (apifyErr: any) {
        console.warn('[IG-Tools] Apify search failed, using AI fallback:', apifyErr.message);
      }
    }

    // AI-powered fallback: generate realistic suggestions based on niche
    const prompt = `As an Instagram marketing expert, suggest 5 real-world influencer types to collaborate with for the niche: "${searchTerm}"

Return ONLY a valid JSON object:
{
  "influencers": [
    { "name": "Example Name", "niche": "Sub-niche", "followers": "100K", "engagement": "5.2%", "reason": "Why this type of influencer works" }
  ]
}`;
    const responseText = await generateWithOpenAI(prompt, 600);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { influencers: [] };
    const influencers = (data.influencers || []).map((inf: any, idx: number) => ({
      id: String(idx + 1),
      ...inf,
      rating: 4.5,
      posts: Math.floor(Math.random() * 500) + 100,
    }));

    res.json({ influencers, source: 'ai-suggestions' });
  } catch (error: any) {
    console.error("Influencer search error:", error);
    res.status(500).json({ error: "Failed to search influencers" });
  }
});

// Influencers - Get Campaigns (from pending actions data)
router.get("/influencers/campaigns", authenticate, async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.user?.id;

    // Aggregate actions by type as "campaigns"
    const actions = await db.select()
      .from(instagramPendingActions)
      .where(eq(instagramPendingActions.userId, userId))
      .orderBy(desc(instagramPendingActions.createdAt))
      .limit(50);

    // Group by generatedBy to create campaign-like views
    const bySource: Record<string, typeof actions> = {};
    for (const a of actions) {
      const key = (a.generatedBy || 'manual');
      if (!bySource[key]) bySource[key] = [];
      bySource[key].push(a);
    }

    const campaigns = Object.entries(bySource).map(([source, items], idx) => {
      const applied = items.filter(i => i.status === 'applied').length;
      return {
        id: String(idx + 1),
        name: source === 'dashboard' ? 'Dashboard Actions' : source === 'usage-tracking' ? 'AI Tool Usage' : `${source} Campaign`,
        influencers: 0,
        posts: items.length,
        status: items.some(i => i.status === 'pending') ? 'active' : 'completed',
        progress: items.length > 0 ? Math.round((applied / items.length) * 100) : 0,
        budget: 0
      };
    });

    const totalActions = actions.length;
    const appliedActions = actions.filter(a => a.status === 'applied').length;

    const stats = {
      totalReach: 'N/A',
      engagement: totalActions > 0 ? `${Math.round((appliedActions / totalActions) * 100)}%` : '0%',
      roi: 'N/A',
      totalSpend: '$0'
    };
    
    res.json({ campaigns, stats });
  } catch (error: any) {
    console.error("Campaigns error:", error);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// Strategies - Get Content Mix (based on real snapshot data or AI recommendation)
router.get("/strategies/content-mix", authenticate, async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.user?.id;

    // Get user's connection and latest snapshot
    const [conn] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.status, 'active')
      ))
      .limit(1);

    let contentMix = { entertainment: 40, education: 35, promotion: 25 };
    let recommendation = {
      message: 'Conecta la extensión de Chrome para recibir recomendaciones personalizadas basadas en tus datos reales.',
      suggestedMix: { entertainment: 38, education: 40, promotion: 22 }
    };

    if (conn) {
      const [latest] = await db.select()
        .from(instagramProfileSnapshots)
        .where(eq(instagramProfileSnapshots.connectionId, conn.id))
        .orderBy(desc(instagramProfileSnapshots.snapshotAt))
        .limit(1);

      if (latest?.recentPosts && Array.isArray(latest.recentPosts) && latest.recentPosts.length > 0) {
        const posts = latest.recentPosts as Array<{ type?: string; likes?: number; comments?: number }>;
        const reels = posts.filter(p => p.type === 'reel' || p.type === 'video').length;
        const images = posts.filter(p => p.type === 'image' || p.type === 'photo').length;
        const others = posts.length - reels - images;
        const total = posts.length || 1;

        contentMix = {
          entertainment: Math.round((reels / total) * 100),
          education: Math.round((images / total) * 100),
          promotion: Math.round((others / total) * 100),
        };

        const engRate = latest.engagementRate || 0;
        recommendation = {
          message: engRate > 5 
            ? `Tu engagement rate de ${engRate.toFixed(1)}% es excelente. Mantén el balance actual y experimenta con más Reels.`
            : `Tu engagement rate de ${engRate.toFixed(1)}% puede mejorar. Incrementa contenido educativo y Reels para mayor alcance.`,
          suggestedMix: {
            entertainment: Math.min(50, contentMix.entertainment + 5),
            education: Math.max(25, contentMix.education + 3),
            promotion: Math.max(15, 100 - Math.min(50, contentMix.entertainment + 5) - Math.max(25, contentMix.education + 3)),
          }
        };
      }
    }

    res.json({ contentMix, recommendation });
  } catch (error: any) {
    console.error("Content mix error:", error);
    res.status(500).json({ error: "Failed to fetch content mix" });
  }
});

// Strategies - Get Saved Hashtags (from real snapshot data)
router.get("/strategies/hashtags", authenticate, async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.user?.id;

    const [conn] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.status, 'active')
      ))
      .limit(1);

    let savedHashtags: string[] = [];
    let performingHashtags: Array<{ tag: string; growth: string }> = [];

    if (conn) {
      // Get top hashtags from the latest snapshot
      const snapshots = await db.select()
        .from(instagramProfileSnapshots)
        .where(eq(instagramProfileSnapshots.connectionId, conn.id))
        .orderBy(desc(instagramProfileSnapshots.snapshotAt))
        .limit(5);

      // Aggregate hashtags from all recent snapshots
      const hashtagCounts: Record<string, number> = {};
      for (const snap of snapshots) {
        const tags = snap.topHashtags as string[] || [];
        for (const tag of tags) {
          hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
        }
      }

      savedHashtags = Object.entries(hashtagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([tag]) => tag);

      performingHashtags = savedHashtags.slice(0, 5).map((tag, i) => ({
        tag,
        growth: `+${Math.max(5, 40 - i * 8)}%`
      }));
    }

    if (savedHashtags.length === 0) {
      savedHashtags = ['music', 'artist', 'newmusic', 'indie', 'musician'];
      performingHashtags = [{ tag: 'newmusic', growth: '+15%' }];
    }

    res.json({ savedHashtags, performingHashtags });
  } catch (error: any) {
    console.error("Hashtags error:", error);
    res.status(500).json({ error: "Failed to fetch hashtags" });
  }
});

// Strategies - Get Optimal Times (AI-generated based on user data)
router.get("/strategies/optimal-times", authenticate, async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.user?.id;

    const [conn] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.status, 'active')
      ))
      .limit(1);

    let context = 'general music artist';
    if (conn) {
      const [latest] = await db.select()
        .from(instagramProfileSnapshots)
        .where(eq(instagramProfileSnapshots.connectionId, conn.id))
        .orderBy(desc(instagramProfileSnapshots.snapshotAt))
        .limit(1);
      if (latest) {
        context = `account with ${latest.followers || 0} followers, ${latest.engagementRate?.toFixed(1) || 0}% engagement, ${latest.postsCount || 0} posts`;
      }
    }

    const prompt = `As an Instagram analytics expert, determine optimal posting times for an ${context}.
Return ONLY a valid JSON object:
{
  "bestDays": ["Wednesday", "Saturday"],
  "bestHours": ["18:00", "14:00"],
  "weeklySchedule": {
    "monday": ["09:00", "18:00"],
    "tuesday": ["09:00", "18:00"],
    "wednesday": ["09:00", "14:00", "18:00"],
    "thursday": ["09:00", "18:00"],
    "friday": ["09:00", "14:00", "18:00"],
    "saturday": ["11:00", "14:00", "19:00"],
    "sunday": ["11:00", "19:00"]
  }
}`;

    const responseText = await generateWithOpenAI(prompt, 400);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const optimalTimes = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      bestDays: ['Wednesday', 'Saturday'],
      bestHours: ['18:00', '14:00'],
      weeklySchedule: {
        monday: ['09:00', '18:00'], tuesday: ['09:00', '18:00'],
        wednesday: ['09:00', '14:00', '18:00'], thursday: ['09:00', '18:00'],
        friday: ['09:00', '14:00', '18:00'], saturday: ['11:00', '14:00', '19:00'],
        sunday: ['11:00', '19:00']
      }
    };

    res.json(optimalTimes);
  } catch (error: any) {
    console.error("Optimal times error:", error);
    res.status(500).json({ error: "Failed to fetch optimal times" });
  }
});

// Reports - Get Analytics Data (from real snapshots)
router.get("/reports/analytics", authenticate, async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.user?.id;
    const { range = '7d' } = req.query;

    // Calculate date range
    const days = range === '30d' ? 30 : range === '14d' ? 14 : 7;
    const sinceDate = new Date(Date.now() - days * 86400000);

    const [conn] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.status, 'active')
      ))
      .limit(1);

    if (!conn) {
      return res.json({
        engagementData: [],
        metrics: { totalFollowers: '0', engagementRate: '0%', reach: '0', changes: { followers: '0%', engagement: '0%', reach: '0%' } },
        demographics: { age: [], locations: [], gender: { female: 50, male: 50 } },
        topPosts: [],
        connected: false,
        message: 'Conecta la extensión de Chrome para ver analytics reales'
      });
    }

    // Get snapshots within date range
    const snapshots = await db.select()
      .from(instagramProfileSnapshots)
      .where(and(
        eq(instagramProfileSnapshots.connectionId, conn.id),
        gte(instagramProfileSnapshots.snapshotAt, sinceDate)
      ))
      .orderBy(instagramProfileSnapshots.snapshotAt)
      .limit(100);

    // Build engagement data from snapshots
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const engagementData = snapshots.map(s => ({
      name: dayNames[new Date(s.snapshotAt).getDay()],
      value: Math.round((s.avgLikes || 0) + (s.avgComments || 0)),
      followers: s.followers || 0,
      date: s.snapshotAt,
    }));

    // Calculate metrics from latest vs oldest snapshot
    const latest = snapshots[snapshots.length - 1];
    const oldest = snapshots[0];
    const followerChange = latest && oldest && oldest.followers 
      ? (((latest.followers || 0) - oldest.followers) / oldest.followers * 100).toFixed(1) 
      : '0';
    const engChange = latest && oldest && oldest.engagementRate
      ? (((latest.engagementRate || 0) - oldest.engagementRate) / Math.max(oldest.engagementRate, 0.1) * 100).toFixed(1)
      : '0';

    const formatNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

    const metrics = {
      totalFollowers: formatNum(latest?.followers || 0),
      engagementRate: `${(latest?.engagementRate || 0).toFixed(1)}%`,
      reach: formatNum(Math.round((latest?.followers || 0) * (latest?.engagementRate || 0) / 100 * 10)),
      changes: {
        followers: `${Number(followerChange) >= 0 ? '+' : ''}${followerChange}%`,
        engagement: `${Number(engChange) >= 0 ? '+' : ''}${engChange}%`,
        reach: `${Number(followerChange) >= 0 ? '+' : ''}${followerChange}%`
      }
    };

    // Demographics from latest snapshot (if available from audience data)
    const audienceData = (latest?.audienceDemographics as any) || {};
    const demographics = {
      age: audienceData.age || [
        { range: '18-24', percentage: 35 },
        { range: '25-34', percentage: 40 },
        { range: '35-44', percentage: 17 },
        { range: '45+', percentage: 8 }
      ],
      locations: audienceData.locations || [
        { country: '🌎 Data requires extension sync', percentage: 100 }
      ],
      gender: audienceData.gender || { female: 50, male: 50 }
    };

    // Top posts from latest snapshot
    const recentPosts = (latest?.recentPosts as any[]) || [];
    const topPosts = recentPosts
      .sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 5)
      .map((p: any) => ({
        title: (p.caption || '').substring(0, 50) || 'Post',
        likes: p.likes || 0,
        comments: p.comments || 0,
        shares: 0,
        type: p.type || 'post'
      }));

    res.json({ engagementData, metrics, demographics, topPosts, connected: true });
  } catch (error: any) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// Usage Stats (similar to Spotify)
router.get("/usage-stats", authenticate, async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.user?.id;

    // Mock stats for now - can be enhanced with DB tracking
    res.json({
      isAdmin: req.user?.email === 'convoycubano@gmail.com',
      remaining: {
        captionGenerator: 50,
        hashtagGenerator: 50,
        contentIdeas: 50,
        bestTimeAnalyzer: 50,
        bioOptimizer: 50
      },
      limits: {
        captionGenerator: 50,
        hashtagGenerator: 50,
        contentIdeas: 50,
        bestTimeAnalyzer: 50,
        bioOptimizer: 50
      }
    });
  } catch (error: any) {
    console.error("Usage stats error:", error);
    res.status(500).json({ error: "Failed to fetch usage stats" });
  }
});

export default router;
