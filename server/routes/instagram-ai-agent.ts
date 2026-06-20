/**
 * Instagram AI Agent Routes
 * 
 * Integrates OpenClaw with the Instagram Boost page.
 * Provides a conversational AI assistant that helps users
 * improve their Instagram accounts with personalized advice.
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getOpenClawGateway } from '../services/openclaw-gateway';
import { db } from '../db';
import {
  users,
  songs,
  artistMedia,
  instagramExtensionConnections,
  instagramProfileSnapshots,
  instagramPendingActions,
  marketingMetrics,
} from '@db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

// ─── System prompt for the Instagram Growth Agent ───────────

function buildSystemPrompt(artistContext: any): string {
  const ctx = artistContext;
  const profileBlock = ctx.profile
    ? `
ARTIST PROFILE:
- Name: ${ctx.profile.name || 'Unknown'}
- Genre: ${ctx.profile.genre || 'Not specified'}
- Bio: ${ctx.profile.bio || 'No bio'}
- Instagram: ${ctx.profile.instagramHandle || 'Not connected'}
- Followers: ${ctx.profile.followers ?? 'Unknown'}
- Following: ${ctx.profile.following ?? 'Unknown'}
- Posts: ${ctx.profile.postsCount ?? 'Unknown'}
- Engagement Rate: ${ctx.profile.engagementRate ?? 'Unknown'}
- Avg Likes: ${ctx.profile.avgLikes ?? 'Unknown'}
- Avg Comments: ${ctx.profile.avgComments ?? 'Unknown'}
`
    : 'ARTIST PROFILE: Not available — the user has not connected their Instagram yet.';

  const songsBlock = ctx.recentSongs?.length
    ? `\nRECENT RELEASES:\n${ctx.recentSongs.map((s: any) => `- "${s.title}" (${s.releaseDate || 'no date'})`).join('\n')}`
    : '';

  const marketingBlock = ctx.marketing
    ? `\nMARKETING METRICS:\n- Total reach: ${ctx.marketing.reach}\n- Engagement: ${ctx.marketing.engagement}\n- Click-throughs: ${ctx.marketing.clicks}`
    : '';

  return `You are BoostBot, an expert Instagram growth strategist embedded in the Boostify platform.
You specialize in helping music artists grow their Instagram presence.

YOUR CAPABILITIES:
1. Analyze Instagram profiles and give actionable audit feedback
2. Suggest content strategy (posting frequency, content mix, themes)
3. Recommend optimal posting times based on the artist's audience
4. Create caption ideas and hashtag strategies
5. Advise on Reels strategy and trending audio
6. Help plan content calendars
7. Suggest engagement tactics (stories, polls, collabs, DM strategy)
8. Diagnose why an account might be stuck or losing followers
9. Recommend growth tactics specific to music artists
10. Explain Instagram algorithm changes and how to adapt

RULES:
- Be concise and actionable. No fluff.
- Give specific, numbered action items when possible.
- If the user's profile data is available, personalize every recommendation.
- If data is missing, ask clarifying questions.
- Use metric benchmarks for music artists (e.g., 3-5% engagement is good).
- Always tie recommendations back to growing their music career.
- Respond in the same language the user writes in.
- When suggesting captions or hashtags, provide ready-to-use examples.
- Format responses with markdown for readability.

${profileBlock}
${songsBlock}
${marketingBlock}

Current date: ${new Date().toLocaleDateString()}
`;
}

// ─── Fetch artist context from DB ───────────────────────────

async function getArtistContext(userId: any) {
  const context: any = {};

  try {
    // Resolve numeric user ID
    let numericId: number | null = null;
    if (typeof userId === 'number') {
      numericId = userId;
    } else if (typeof userId === 'string') {
      const parsed = parseInt(userId, 10);
      if (!isNaN(parsed)) {
        numericId = parsed;
      } else {
        // Clerk ID
        const [row] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, userId)).limit(1);
        numericId = row?.id ?? null;
      }
    }

    if (!numericId) return context;

    // User profile
    const [user] = await db.select().from(users).where(eq(users.id, numericId)).limit(1);
    if (user) {
      context.profile = {
        name: user.username || user.displayName,
        genre: (user as any).genre || null,
        bio: (user as any).biography || null,
        instagramHandle: (user as any).instagramHandle || null,
      };
    }

    // Instagram data from snapshots (joined through connection)
    const [conn] = await db
      .select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, numericId),
        eq(instagramExtensionConnections.status, 'active'),
      ))
      .limit(1);

    if (conn) {
      const [snapshot] = await db
        .select()
        .from(instagramProfileSnapshots)
        .where(eq(instagramProfileSnapshots.connectionId, conn.id))
        .orderBy(desc(instagramProfileSnapshots.snapshotAt))
        .limit(1);

      if (snapshot) {
        context.profile = {
          ...context.profile,
          followers: snapshot.followers,
          following: snapshot.following,
          postsCount: snapshot.postsCount,
          engagementRate: snapshot.engagementRate,
          avgLikes: snapshot.avgLikes,
          avgComments: snapshot.avgComments,
        };
      }
    }

    // Recent songs
    const recentSongs = await db
      .select({ title: songs.title, releaseDate: songs.releaseDate })
      .from(songs)
      .where(eq(songs.userId, numericId))
      .orderBy(desc(songs.createdAt))
      .limit(5);
    if (recentSongs.length > 0) {
      context.recentSongs = recentSongs;
    }

    // Marketing metrics
    const [metrics] = await db
      .select()
      .from(marketingMetrics)
      .where(eq(marketingMetrics.userId, numericId))
      .orderBy(desc(marketingMetrics.updatedAt))
      .limit(1);
    if (metrics) {
      context.marketing = {
        instagramFollowers: metrics.instagramFollowers,
        totalEngagement: metrics.totalEngagement,
        websiteVisits: metrics.websiteVisits,
      };
    }
  } catch (err) {
    console.error('[IG AI Agent] Error fetching artist context:', err);
  }

  return context;
}

// ─── Conversation history (in-memory, per user session) ─────

const conversationHistory = new Map<string, Array<{ role: string; content: string }>>();
const MAX_HISTORY = 20;

function getHistory(sessionKey: string): Array<{ role: string; content: string }> {
  return conversationHistory.get(sessionKey) || [];
}

function addToHistory(sessionKey: string, role: string, content: string): void {
  const history = getHistory(sessionKey);
  history.push({ role, content });
  // Keep only last N messages
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
  conversationHistory.set(sessionKey, history);
}

// ─── POST /api/instagram/ai-agent/chat ──────────────────────

router.post('/chat', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { message, artistId, tabContext } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required and must be a string' });
    }

    // Sanitize input
    const cleanMessage = message.slice(0, 2000).replace(/[<>]/g, '');
    const sessionKey = `ig-agent-${userId}-${artistId || 'default'}`;

    // Build context
    const artistContext = await getArtistContext(artistId || userId);
    if (tabContext) {
      artistContext.currentTab = tabContext;
    }

    // Try OpenClaw gateway first
    const gateway = getOpenClawGateway();
    const gwStatus = gateway.status;

    let response: string;

    if (gwStatus.enabled && gwStatus.running) {
      // Route through OpenClaw gateway
      try {
        const history = getHistory(sessionKey);
        const systemPrompt = buildSystemPrompt(artistContext);

        const result = await gateway.sendMessage(
          JSON.stringify({
            system: systemPrompt,
            history: history.slice(-10),
            message: cleanMessage,
          }),
          sessionKey,
        );

        response = result?.response || result?.message || result?.content || 
          'Sorry, I couldn\'t process that. Please try again.';
      } catch (gwErr: any) {
        console.warn('[IG AI Agent] OpenClaw gateway error, falling back to direct:', gwErr.message);
        response = await fallbackResponse(cleanMessage, artistContext, sessionKey);
      }
    } else {
      // Fallback: direct OpenAI call
      response = await fallbackResponse(cleanMessage, artistContext, sessionKey);
    }

    // Store in conversation history
    addToHistory(sessionKey, 'user', cleanMessage);
    addToHistory(sessionKey, 'assistant', response);

    res.json({
      success: true,
      response,
      gatewayUsed: gwStatus.enabled && gwStatus.running,
    });
  } catch (err: any) {
    console.error('[IG AI Agent] Error:', err);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// ─── POST /api/instagram/ai-agent/audit ─────────────────────

router.post('/audit', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { artistId } = req.body;
    const context = await getArtistContext(artistId || userId);

    if (!context.profile?.followers && !context.profile?.instagramHandle) {
      return res.json({
        success: true,
        audit: {
          status: 'no-data',
          message: 'Connect your Instagram account first to get a personalized audit. Go to the Extension tab to connect.',
        },
      });
    }

    // Generate audit using conversation endpoint
    const auditPrompt = `Give me a complete Instagram profile audit for this artist. Include:
1. **Profile Score** (out of 100)
2. **Strengths** (what's working)
3. **Weaknesses** (what needs improvement)
4. **Quick Wins** (3 things to do this week)
5. **Content Strategy** (recommended content mix)
6. **Hashtag Strategy** (specific hashtag groups to rotate)
7. **Growth Projection** (realistic goals for 30/60/90 days)

Be specific and data-driven. Use the profile data I have.`;

    const sessionKey = `ig-audit-${userId}`;
    const gateway = getOpenClawGateway();
    const gwStatus = gateway.status;

    let auditResponse: string;

    if (gwStatus.enabled && gwStatus.running) {
      try {
        const systemPrompt = buildSystemPrompt(context);
        const result = await gateway.sendMessage(
          JSON.stringify({ system: systemPrompt, message: auditPrompt }),
          sessionKey,
        );
        auditResponse = result?.response || result?.message || result?.content || '';
      } catch {
        auditResponse = await fallbackResponse(auditPrompt, context, sessionKey);
      }
    } else {
      auditResponse = await fallbackResponse(auditPrompt, context, sessionKey);
    }

    res.json({
      success: true,
      audit: {
        status: 'complete',
        content: auditResponse,
        generatedAt: new Date().toISOString(),
        profileData: {
          followers: context.profile?.followers,
          engagementRate: context.profile?.engagementRate,
          postsCount: context.profile?.postsCount,
        },
      },
    });
  } catch (err: any) {
    console.error('[IG AI Agent] Audit error:', err);
    res.status(500).json({ error: 'Failed to generate audit' });
  }
});

// ─── GET /api/instagram/ai-agent/suggestions ────────────────

router.get('/suggestions', authenticate, async (req: Request, res: Response) => {
  try {
    // Return contextual quick-action suggestions
    res.json({
      success: true,
      suggestions: [
        { id: 'audit', icon: 'target', label: 'Audit my profile', prompt: 'Give me a full audit of my Instagram profile' },
        { id: 'captions', icon: 'pen', label: 'Generate captions', prompt: 'Write 3 engaging captions for my next post' },
        { id: 'hashtags', icon: 'hash', label: 'Find hashtags', prompt: 'What are the best hashtags for my niche?' },
        { id: 'reels', icon: 'play', label: 'Reels strategy', prompt: 'What Reels should I create this week?' },
        { id: 'growth', icon: 'trending-up', label: 'Growth plan', prompt: 'Create a 30-day Instagram growth plan for me' },
        { id: 'timing', icon: 'clock', label: 'Best time to post', prompt: 'When should I post for maximum engagement?' },
        { id: 'stuck', icon: 'alert', label: 'Why am I stuck?', prompt: 'My account isn\'t growing. Diagnose the problem and give me solutions.' },
        { id: 'bio', icon: 'user', label: 'Optimize my bio', prompt: 'Rewrite my Instagram bio to convert more visitors into followers' },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// ─── DELETE /api/instagram/ai-agent/history ──────────────────

router.delete('/history', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { artistId } = req.body || {};
  const sessionKey = `ig-agent-${userId}-${artistId || 'default'}`;
  conversationHistory.delete(sessionKey);
  res.json({ success: true });
});

// ─── Fallback: Direct OpenAI ────────────────────────────────

async function fallbackResponse(
  message: string,
  artistContext: any,
  sessionKey: string,
): Promise<string> {
  const { createTrackedOpenAI } = await import('../utils/tracked-openai');
  const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

  if (!process.env.OPENAI_API_KEY) {
    return generateOfflineResponse(message);
  }

  const systemPrompt = buildSystemPrompt(artistContext);
  const history = getHistory(sessionKey);

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages,
      max_tokens: 1500,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'I couldn\'t generate a response. Please try again.';
  } catch (err: any) {
    console.error('[IG AI Agent] OpenAI fallback error:', err.message);
    return generateOfflineResponse(message);
  }
}

// ─── Offline fallback with pattern matching ─────────────────

function generateOfflineResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('audit') || lower.includes('perfil') || lower.includes('profile')) {
    return `## Quick Profile Tips

To give you a full audit, I need your Instagram connected. But here are universal tips:

1. **Bio**: Use a clear value proposition + CTA + link in bio
2. **Profile pic**: High-quality, recognizable (face or logo)
3. **Highlights**: Organize into Music, Behind Scenes, Press, Merch
4. **Content mix**: 40% entertainment, 35% educational, 25% promotional
5. **Posting**: Aim for 4-7 posts/week + daily Stories

Connect your Instagram in the **Extension** tab for personalized insights.`;
  }

  if (lower.includes('hashtag') || lower.includes('tag')) {
    return `## Hashtag Strategy for Music Artists

Use **3 groups** of 10 hashtags, rotate them:

**Group A (Broad):** #newmusic #indieartist #musicproducer #spotifyplaylist #soundcloud
**Group B (Niche):** Use your genre + subgenre tags
**Group C (Community):** #supportindieartists #undergroundmusic #musiccommunity

**Rules:**
- Mix sizes: 3 big (1M+), 4 medium (100K-1M), 3 small (<100K)
- Put hashtags in the first comment, not the caption
- Track which groups get the best reach in Reports tab`;
  }

  if (lower.includes('reel') || lower.includes('video')) {
    return `## Reels Strategy for Musicians

**Top performing Reels formats:**
1. 🎵 Song snippet with lyrics overlay (15-30s)
2. 🎬 Studio behind-the-scenes (raw, authentic)
3. 🎤 "POV: When [relatable music moment]" trends
4. 📝 Songwriting process reveal
5. 🔄 Before/after production comparison

**Tips:**
- Hook in first 1.5 seconds
- Use trending audio when relevant
- Post Reels 3-5x per week
- Optimal length: 15-30 seconds for music content`;
  }

  if (lower.includes('grow') || lower.includes('crec') || lower.includes('follow')) {
    return `## 30-Day Growth Plan

**Week 1:** Foundation
- Optimize bio, profile pic, and highlights
- Set up content pillars (3-4 themes)
- Post 1 Reel daily

**Week 2:** Engagement
- Spend 20 min/day engaging with similar artists
- Start collaboration DMs (aim for 5/week)
- Launch a weekly Story series

**Week 3:** Amplify
- Cross-post best Reels to TikTok
- Start sharing on music subreddits/forums
- Do an IG Live with another artist

**Week 4:** Analyze & adjust
- Review analytics — double down on what works
- Cut content types with <2% engagement
- Plan next month based on data`;
  }

  return `I'm your **BoostBot** Instagram growth assistant. I can help you with:

- 🎯 **Profile audit** — analyze what's working and what isn't
- ✍️ **Captions** — generate engaging post captions
- #️⃣ **Hashtags** — find the best tags for your niche
- 🎬 **Reels** — strategy for viral short-form content
- 📈 **Growth plan** — 30/60/90 day roadmap
- ⏰ **Posting times** — when your audience is most active
- 🔧 **Troubleshooting** — diagnose why growth has stalled

Just ask me anything about growing your Instagram!`;
}

// ─── POST /api/instagram/ai-agent/execute ───────────────────
// This is the ACTION ENGINE. Instead of just chatting, it EXECUTES
// real tools and returns structured results that can be pushed
// to the Chrome extension.

interface ActionResult {
  success: boolean;
  action: string;
  data: any;
  queuedToExtension?: boolean;
  actionId?: number;
  error?: string;
}

router.post('/execute', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { action, params = {}, autoQueue = false } = req.body;
    if (!action) return res.status(400).json({ error: 'action is required' });

    // Resolve numeric user id
    let numericId: number | null = null;
    if (typeof userId === 'number') {
      numericId = userId;
    } else {
      const parsed = parseInt(userId, 10);
      if (!isNaN(parsed)) {
        numericId = parsed;
      } else {
        const [row] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, userId)).limit(1);
        numericId = row?.id ?? null;
      }
    }

    if (!numericId) return res.status(404).json({ error: 'User not found' });

    // Find active IG connection for queueing
    const [conn] = await db
      .select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, numericId),
        eq(instagramExtensionConnections.status, 'active'),
      ))
      .limit(1);

    const artistContext = await getArtistContext(numericId);
    let result: ActionResult;

    switch (action) {
      case 'generate_captions': {
        const topic = params.topic || params.postTopic || artistContext.profile?.genre || 'music';
        const tone = params.tone || 'engaging';
        result = await executeGenerateCaptions(numericId, topic, tone, params, conn, autoQueue);
        break;
      }
      case 'generate_hashtags': {
        const niche = params.niche || artistContext.profile?.genre || 'music';
        result = await executeGenerateHashtags(numericId, niche, params, conn, autoQueue);
        break;
      }
      case 'generate_content_ideas': {
        const niche = params.niche || artistContext.profile?.genre || 'music';
        result = await executeContentIdeas(numericId, niche, params);
        break;
      }
      case 'analyze_best_times': {
        const niche = params.niche || artistContext.profile?.genre || 'music';
        result = await executeBestTimes(numericId, niche, params);
        break;
      }
      case 'optimize_bio': {
        result = await executeOptimizeBio(numericId, params, artistContext, conn, autoQueue);
        break;
      }
      case 'full_audit': {
        result = await executeFullAudit(numericId, artistContext);
        break;
      }
      case 'growth_plan': {
        result = await executeGrowthPlan(numericId, artistContext);
        break;
      }
      case 'reels_ideas': {
        result = await executeReelsIdeas(numericId, artistContext);
        break;
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    res.json(result);
  } catch (err: any) {
    console.error('[IG AI Agent] Execute error:', err);
    res.status(500).json({ error: 'Failed to execute action', details: err.message });
  }
});

// ─── Action Executors ───────────────────────────────────────

async function callToolEndpoint(path: string, body: any, userId: number): Promise<any> {
  // Internal call to existing tool endpoints — reuse their logic directly
  const { createTrackedOpenAI } = await import('../utils/tracked-openai');
  const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

  try {
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: body.prompt }],
      max_tokens: body.maxTokens || 1500,
      response_format: body.jsonMode ? { type: 'json_object' } : undefined,
    });
    return response.choices[0]?.message?.content || '';
  } catch (err: any) {
    console.error(`[IG AI Agent] Tool call failed:`, err.message);
    return null;
  }
}

async function queueToExtension(
  userId: number,
  connectionId: number | null,
  actionType: 'post_caption' | 'update_bio' | 'schedule_post' | 'reply_comment' | 'follow_user' | 'use_hashtags' | 'post_story' | 'post_reel',
  payload: any,
  generatedBy: string = 'ai-agent',
): Promise<number | null> {
  try {
    const [action] = await db.insert(instagramPendingActions).values({
      userId,
      connectionId: connectionId ?? null,
      actionType: actionType as any,
      payload,
      generatedBy,
      priority: 3,
    } as any).returning();
    return action.id;
  } catch (err) {
    console.error('[IG AI Agent] Queue action error:', err);
    return null;
  }
}

async function executeGenerateCaptions(
  userId: number, topic: string, tone: string, params: any, conn: any, autoQueue: boolean,
): Promise<ActionResult> {
  const prompt = `As an Instagram marketing expert for music artists, generate 5 engaging captions for a post about: "${topic}"
Tone: ${tone}. Target: ${params.targetAudience || 'music fans'}.
Include emojis. Include a call-to-action. Add 5-8 hashtags at the end.
Return ONLY valid JSON: { "captions": [{ "text": "...", "hashtags": ["..."], "engagementScore": 85 }] }`;

  const raw = await callToolEndpoint('/caption-generator', { prompt, maxTokens: 1500, jsonMode: true }, userId);
  if (!raw) return { success: false, action: 'generate_captions', data: null, error: 'AI service unavailable' };

  try {
    const parsed = JSON.parse(raw);
    const captions = parsed.captions || [];

    let actionId: number | null = null;
    if (autoQueue && captions[0] && conn) {
      actionId = await queueToExtension(userId, conn.id, 'post_caption', {
        caption: captions[0].text,
        hashtags: captions[0].hashtags,
        source: 'ai-agent',
      });
    }

    return {
      success: true,
      action: 'generate_captions',
      data: { captions, topic, tone },
      queuedToExtension: !!actionId,
      actionId: actionId || undefined,
    };
  } catch {
    return { success: true, action: 'generate_captions', data: { raw, topic }, queuedToExtension: false };
  }
}

async function executeGenerateHashtags(
  userId: number, niche: string, params: any, conn: any, autoQueue: boolean,
): Promise<ActionResult> {
  const prompt = `As an Instagram hashtag expert for music artists, generate 30 hashtags for: "${niche}"
Content type: ${params.contentType || 'general post'}.
Group them into: high_volume (1M+ posts), medium_volume (100K-1M), low_volume (<100K niche).
Return ONLY valid JSON: { "groups": { "high_volume": ["#tag1"], "medium_volume": ["#tag2"], "low_volume": ["#tag3"] }, "recommended_set": ["#top15hashtags"] }`;

  const raw = await callToolEndpoint('/hashtag-generator', { prompt, maxTokens: 1200, jsonMode: true }, userId);
  if (!raw) return { success: false, action: 'generate_hashtags', data: null, error: 'AI service unavailable' };

  try {
    const parsed = JSON.parse(raw);
    let actionId: number | null = null;
    if (autoQueue && parsed.recommended_set && conn) {
      actionId = await queueToExtension(userId, conn.id, 'post_caption', {
        hashtags: parsed.recommended_set,
        source: 'ai-agent-hashtags',
      });
    }
    return {
      success: true,
      action: 'generate_hashtags',
      data: parsed,
      queuedToExtension: !!actionId,
      actionId: actionId || undefined,
    };
  } catch {
    return { success: true, action: 'generate_hashtags', data: { raw }, queuedToExtension: false };
  }
}

async function executeContentIdeas(userId: number, niche: string, params: any): Promise<ActionResult> {
  const prompt = `As an Instagram content strategist for music artists in the "${niche}" genre, generate 7 content ideas for this week.
Goals: ${params.goals || 'grow followers and engagement'}.
For each idea include: title, format (Reel/Carousel/Story/Post), description, estimated engagement, best day to post.
Return ONLY valid JSON: { "ideas": [{ "title": "...", "format": "Reel", "description": "...", "estimatedEngagement": "high", "bestDay": "Monday" }] }`;

  const raw = await callToolEndpoint('/content-ideas', { prompt, maxTokens: 1500, jsonMode: true }, userId);
  if (!raw) return { success: false, action: 'generate_content_ideas', data: null, error: 'AI service unavailable' };

  try {
    return { success: true, action: 'generate_content_ideas', data: JSON.parse(raw) };
  } catch {
    return { success: true, action: 'generate_content_ideas', data: { raw } };
  }
}

async function executeBestTimes(userId: number, niche: string, params: any): Promise<ActionResult> {
  const prompt = `As an Instagram analytics expert, analyze the best posting times for a music artist in the "${niche}" genre.
Timezone: ${params.timezone || 'UTC'}. Audience: ${params.audience || 'global music fans'}.
Return ONLY valid JSON: { "bestTimes": [{ "day": "Monday", "times": ["9:00 AM", "6:00 PM"], "reason": "..." }], "worstTimes": [{ "day": "...", "times": ["..."] }], "summary": "..." }`;

  const raw = await callToolEndpoint('/best-time-analyzer', { prompt, maxTokens: 1200, jsonMode: true }, userId);
  if (!raw) return { success: false, action: 'analyze_best_times', data: null, error: 'AI service unavailable' };

  try {
    return { success: true, action: 'analyze_best_times', data: JSON.parse(raw) };
  } catch {
    return { success: true, action: 'analyze_best_times', data: { raw } };
  }
}

async function executeOptimizeBio(
  userId: number, params: any, artistContext: any, conn: any, autoQueue: boolean,
): Promise<ActionResult> {
  const currentBio = params.currentBio || artistContext.profile?.bio || '';
  const prompt = `As an Instagram bio optimization expert for music artists, create 3 bio options.
Current bio: "${currentBio}"
Artist: ${artistContext.profile?.name || 'Unknown'}, Genre: ${artistContext.profile?.genre || 'music'}
Goals: ${params.goals || 'convert visitors to followers and listeners'}.
Each bio: max 150 chars, include value proposition, CTA, and relevant emoji.
Return ONLY valid JSON: { "bios": [{ "text": "...", "characterCount": 120, "focus": "streaming" }] }`;

  const raw = await callToolEndpoint('/bio-optimizer', { prompt, maxTokens: 800, jsonMode: true }, userId);
  if (!raw) return { success: false, action: 'optimize_bio', data: null, error: 'AI service unavailable' };

  try {
    const parsed = JSON.parse(raw);
    let actionId: number | null = null;
    if (autoQueue && parsed.bios?.[0] && conn) {
      actionId = await queueToExtension(userId, conn.id, 'update_bio', {
        bio: parsed.bios[0].text,
        source: 'ai-agent-bio',
      });
    }
    return {
      success: true,
      action: 'optimize_bio',
      data: parsed,
      queuedToExtension: !!actionId,
      actionId: actionId || undefined,
    };
  } catch {
    return { success: true, action: 'optimize_bio', data: { raw }, queuedToExtension: false };
  }
}

async function executeFullAudit(userId: number, artistContext: any): Promise<ActionResult> {
  const hasData = artistContext.profile?.followers || artistContext.profile?.engagementRate;
  if (!hasData) {
    return {
      success: true,
      action: 'full_audit',
      data: {
        status: 'no-data',
        message: 'Connect your Instagram via the Extension tab to get a personalized audit.',
        genericTips: [
          'Optimize your bio with a clear CTA',
          'Use a consistent color palette and aesthetic',
          'Post Reels 3-5 times per week',
          'Engage with 20 accounts daily in your niche',
          'Use 20-25 hashtags mixing high, medium, and low competition',
        ],
      },
    };
  }

  const prompt = `Perform a complete Instagram audit for this music artist:
Name: ${artistContext.profile?.name || 'Unknown'}
Followers: ${artistContext.profile?.followers || '?'}
Engagement Rate: ${artistContext.profile?.engagementRate || '?'}%
Avg Likes: ${artistContext.profile?.avgLikes || '?'}
Avg Comments: ${artistContext.profile?.avgComments || '?'}
Posts: ${artistContext.profile?.postsCount || '?'}
Genre: ${artistContext.profile?.genre || 'music'}

Return ONLY valid JSON:
{
  "score": 72,
  "grade": "B",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "quickWins": [{ "action": "...", "impact": "high", "effort": "low" }],
  "contentMix": { "reels": 40, "carousels": 25, "stories": 25, "posts": 10 },
  "growthProjection": { "30days": "+X followers", "60days": "+X", "90days": "+X" }
}`;

  const raw = await callToolEndpoint('/audit', { prompt, maxTokens: 1500, jsonMode: true }, userId);
  if (!raw) return { success: false, action: 'full_audit', data: null, error: 'AI service unavailable' };

  try {
    return { success: true, action: 'full_audit', data: { status: 'complete', ...JSON.parse(raw) } };
  } catch {
    return { success: true, action: 'full_audit', data: { status: 'complete', raw } };
  }
}

async function executeGrowthPlan(userId: number, artistContext: any): Promise<ActionResult> {
  const prompt = `Create a detailed 30-day Instagram growth plan for a music artist.
Artist: ${artistContext.profile?.name || 'Unknown'}, Genre: ${artistContext.profile?.genre || 'music'}
Current followers: ${artistContext.profile?.followers || 'unknown'}
Engagement: ${artistContext.profile?.engagementRate || 'unknown'}%

Return ONLY valid JSON:
{
  "plan": {
    "week1": { "theme": "...", "tasks": [{ "day": "Mon", "action": "...", "type": "Reel|Story|Post|Carousel|Engagement", "priority": "high" }] },
    "week2": { "theme": "...", "tasks": [{ "day": "Mon", "action": "...", "type": "...", "priority": "..." }] },
    "week3": { "theme": "...", "tasks": [...] },
    "week4": { "theme": "...", "tasks": [...] }
  },
  "expectedResults": "...",
  "kpis": ["...", "..."]
}`;

  const raw = await callToolEndpoint('/growth-plan', { prompt, maxTokens: 2000, jsonMode: true }, userId);
  if (!raw) return { success: false, action: 'growth_plan', data: null, error: 'AI service unavailable' };

  try {
    return { success: true, action: 'growth_plan', data: JSON.parse(raw) };
  } catch {
    return { success: true, action: 'growth_plan', data: { raw } };
  }
}

async function executeReelsIdeas(userId: number, artistContext: any): Promise<ActionResult> {
  const prompt = `Generate 5 trending Reel ideas for a music artist on Instagram.
Artist: ${artistContext.profile?.name || 'Unknown'}, Genre: ${artistContext.profile?.genre || 'music'}

For each Reel: title, hook (first 1.5s), concept, trending audio suggestion, estimated views potential, script outline.
Return ONLY valid JSON:
{
  "reels": [{ "title": "...", "hook": "...", "concept": "...", "audioSuggestion": "...", "viewsPotential": "10K-50K", "script": "..." }]
}`;

  const raw = await callToolEndpoint('/reels-ideas', { prompt, maxTokens: 1500, jsonMode: true }, userId);
  if (!raw) return { success: false, action: 'reels_ideas', data: null, error: 'AI service unavailable' };

  try {
    return { success: true, action: 'reels_ideas', data: JSON.parse(raw) };
  } catch {
    return { success: true, action: 'reels_ideas', data: { raw } };
  }
}

export default router;
