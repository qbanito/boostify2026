/**
 * Boostify News Generator Engine
 * 
 * Generates daily AI articles about Boostify's technologies and innovations.
 * Uses OpenAI for text and a centralized FAL-first image pipeline for covers.
 */

import { db } from '../db';
import { newsArticles, newsGenerationLogs, instagramPendingActions, instagramExtensionConnections, users } from '../../db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { sendArticleNewsletter, sendArticleToIndustryContacts } from './news-newsletter';
import { generateNewsImage } from './news-image-generator';
import { callAI } from '../utils/smart-ai';
import { buildSkillsOnlyPrompt } from '../utils/ai-skills-injector';

// ── Topic Pool ─────────────────────────────────────────────────
const TOPIC_POOL = [
  {
    topic: "Autonomous Artist Systems",
    category: "autonomous-artists" as const,
    angles: [
      "How autonomous agents are replacing traditional music management",
      "The rise of AI-powered artist decision-making",
      "From manual promotion to intelligent self-reinforcing growth",
      "Why the autonomous artist will outperform managed artists by 2027",
      "Agent-to-agent economies: when music systems negotiate with each other",
    ]
  },
  {
    topic: "AI Music Generation",
    category: "ai-music" as const,
    angles: [
      "The evolution of AI-composed music and what it means for creators",
      "How Boostify's music generator creates studio-quality tracks in minutes",
      "Voice cloning and AI vocals: the next frontier in music creation",
      "AI mastering vs human mastering: a new paradigm",
      "Why AI-generated music is not replacing artists — it's amplifying them",
    ]
  },
  {
    topic: "Web3 & Blockchain in Music",
    category: "web3" as const,
    angles: [
      "How tokenized music rights are creating new revenue streams",
      "BoostiSwap: decentralized music collaboration marketplace",
      "Copyright certification on Polygon: permanent, verifiable ownership",
      "BTF Token economy: powering the next creative economy",
      "NFT music: beyond hype toward real utility and royalties",
    ]
  },
  {
    topic: "Platform Technology",
    category: "technology" as const,
    angles: [
      "Inside Boostify's multi-agent architecture for music growth",
      "Real-time analytics: how data drives smarter music careers",
      "Chrome extension ecosystem: Instagram, Spotify, YouTube automation",
      "How Boostify processes 100+ API integrations seamlessly",
      "The infrastructure behind autonomous content generation",
    ]
  },
  {
    topic: "Music Industry Innovation",
    category: "innovation" as const,
    angles: [
      "Why the music industry's manual model is collapsing",
      "The future of sync licensing: AI-powered matching and negotiation",
      "Virtual record labels: how AI manages entire artist rosters",
      "Podcast studios, music videos, and merch — all from one platform",
      "How intelligent marketing replaces spray-and-pray promotion",
    ]
  },
  {
    topic: "Platform Vision",
    category: "industry-vision" as const,
    angles: [
      "The future of music will not be managed manually",
      "Building infrastructure for the next generation of creative entities",
      "Why platforms that prepare for agent-to-agent economies will lead",
      "From passive tools to active operational architecture",
      "The sovereign artist: a new category of creative independence",
    ]
  },
  {
    topic: "Platform Updates",
    category: "platform-updates" as const,
    angles: [
      "New feature: AI-powered choreography and motion transfer",
      "Boostify's social network: connecting artists with intelligent matching",
      "New integration: venue outreach with automated booking proposals",
      "Distribution orchestrator: publish music to every platform at once",
      "Artist Intelligence Engine: cross-platform analytics in real time",
    ]
  },
  {
    topic: "Partnerships & Ecosystem",
    category: "partnerships" as const,
    angles: [
      "How Boostify connects artists with sponsors through AI matching",
      "Building the music industry's most comprehensive creator toolkit",
      "Artist activation engine: from signup to first revenue in 48 hours",
      "Crowdfunding meets tokenization: new funding models for artists",
      "How Boostify's education platform creates industry-ready professionals",
    ]
  }
];

// ── Select Daily Topic ─────────────────────────────────────────
function selectDailyTopic(): { topic: string; angle: string; category: string } {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const topicGroup = TOPIC_POOL[dayOfYear % TOPIC_POOL.length];
  const angleIndex = Math.floor(dayOfYear / TOPIC_POOL.length) % topicGroup.angles.length;
  return {
    topic: topicGroup.topic,
    angle: topicGroup.angles[angleIndex],
    category: topicGroup.category,
  };
}

// ── Generate Article Text ──────────────────────────────────────
async function generateArticleText(topic: string, angle: string): Promise<{
  title: string;
  subtitle: string;
  summary: string;
  htmlContent: string;
  tags: string[];
  readTimeMinutes: number;
  tokensUsed: number;
}> {
  const baseSystemPrompt = `You are the editorial voice of Boostify — a visionary music technology platform building autonomous infrastructure for artists. 
Write compelling, thought-leadership articles that position Boostify as the future of the music industry. 
Your tone is confident, forward-looking, and technically informed but accessible.
You write in a clean, modern editorial style with short paragraphs, strategic line breaks, and bold statements.
Always reference Boostify's real technologies: AI music generation, autonomous agents, blockchain copyright, Chrome extensions for Instagram/Spotify/YouTube, tokenization (BTF token, BoostiSwap), virtual record labels, AI-powered analytics, and the Autonomous Artist Survival System (AAS).`;

  const systemPrompt = buildSkillsOnlyPrompt('news', baseSystemPrompt);

  const userPrompt = `Write a professional article about: "${angle}"

Topic area: ${topic}

Requirements:
1. Return a JSON object with these exact fields:
   - "title": A powerful, compelling headline (max 80 chars)
   - "subtitle": A secondary headline that expands on the title (max 120 chars)  
   - "summary": A 2-sentence summary for previews (max 200 chars)
   - "htmlContent": The full article as clean HTML. Use <h2>, <h3>, <p>, <blockquote>, <ul>/<li>, <strong>, <em> tags. Include at least 8-12 paragraphs. Add a <!-- IMAGE_BREAK --> comment where a supporting image should be inserted. Make it at least 800 words.
   - "tags": Array of 5-8 relevant tags (lowercase, no #)
   - "readTimeMinutes": Estimated read time as integer

Style guide:
- Short, impactful paragraphs (2-4 sentences max)
- Use blockquotes for key statements
- Bold important concepts
- Reference specific Boostify features naturally
- End with a forward-looking conclusion about the future Boostify is building
- Do NOT use generic filler — every sentence should carry meaning`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  // Resilient generation: the smart router already cascades
  // (Gemini/OpenRouter → z.ai GLM → Llama → OpenAI), but a fallback model can
  // occasionally return slightly malformed JSON. We parse defensively and, if
  // that fails, force the z.ai GLM model first (free + reliable, our explicit
  // fallback) and finally OpenAI gpt-4o-mini — so an article ALWAYS generates.
  const attempts: Array<{ label: string; forceModel?: string }> = [
    { label: 'news-generator-article' },                       // smart router (incl. z.ai)
    { label: 'news-generator-article-zai', forceModel: 'glm-4.5-flash' }, // z.ai fallback
    { label: 'news-generator-article-openai', forceModel: 'gpt-4o-mini' }, // OpenAI fallback
  ];

  let content: any = null;
  let lastError: any = null;
  for (const { label, forceModel } of attempts) {
    try {
      const rawContent = await callAI('description', messages, {
        temperature: 0.8,
        maxTokens: 4000,
        requireJSON: true,
        label,
        ...(forceModel ? { forceModel } : {}),
      });
      const parsed = safeParseArticleJson(rawContent);
      if (parsed && (parsed.title || parsed.htmlContent)) {
        content = parsed;
        if (forceModel) console.log(`[News-Gen] article JSON recovered via forced model: ${forceModel}`);
        break;
      }
      lastError = new Error('Model returned unparseable / empty article JSON');
    } catch (err: any) {
      lastError = err;
      console.warn(`[News-Gen] article attempt "${label}" failed: ${err?.message || err}`);
    }
  }

  if (!content) {
    throw new Error(`Article text generation failed across all models: ${lastError?.message || 'unknown error'}`);
  }

  const tokensUsed = 0; // tracked inside callAI via api_usage_log

  return {
    title: content.title || angle,
    subtitle: content.subtitle || '',
    summary: content.summary || '',
    htmlContent: content.htmlContent || '<p>Article generation failed.</p>',
    tags: Array.isArray(content.tags) ? content.tags : ['boostify', 'music-tech'],
    readTimeMinutes: content.readTimeMinutes || 5,
    tokensUsed,
  };
}

/**
 * Defensive JSON parse for AI article output. Handles raw JSON, markdown-fenced
 * blocks, and extra prose around the object that some fallback models add.
 */
function safeParseArticleJson(raw: string | null | undefined): any | null {
  if (!raw) return null;
  const text = String(raw).trim();
  // 1) direct parse
  try { return JSON.parse(text); } catch { /* continue */ }
  // 2) strip ```json ... ``` fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* continue */ }
  }
  // 3) grab the first balanced {...} block
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* continue */ }
  }
  return null;
}

// ── Generate Cover Image (centralized FAL-first service) ───────
async function generateCoverImage(title: string, category: string): Promise<{
  imageUrl: string;
  prompt: string;
  provider: "openai" | "fal" | "fallback";
}> {
  const imagePrompt = `A cinematic, ultra-modern editorial cover image for a music technology article titled "${title}". 
Style: Dark, futuristic, with neon orange and deep purple accent lighting. 
Elements: Abstract digital waveforms, neural network patterns, music notes dissolving into data streams. 
Category: ${category}. 
Mood: Visionary, cutting-edge, premium tech aesthetic. 
No text or words in the image. High contrast, 16:9 aspect ratio feel, magazine-quality.`;
  try {
    const result = await generateNewsImage({
      title,
      artistName: 'Boostify',
      category,
      context: imagePrompt,
      aspectRatio: '16:9',
    });
    const provider = result.provider.startsWith('fal')
      ? 'fal'
      : result.provider.startsWith('openai')
        ? 'openai'
        : 'fallback';
    return { imageUrl: result.imageUrl, prompt: result.prompt, provider };
  } catch (err: any) {
    console.warn('[News-Gen] centralized news image generation failed:', err.message);
  }

  // Final fallback: placeholder
  return {
    imageUrl: `https://placehold.co/1536x1024/1a1a2e/f97316?text=${encodeURIComponent(title.slice(0, 30))}`,
    prompt: imagePrompt,
    provider: 'fallback',
  };
}

// ── Generate Slug ──────────────────────────────────────────────
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    + '-' + Date.now().toString(36);
}

// ── Main Generation Pipeline ───────────────────────────────────
export async function generateDailyArticle(forceTopicOverride?: { topic: string; angle: string; category: string }): Promise<{
  success: boolean;
  articleId?: number;
  title?: string;
  error?: string;
}> {
  const { topic, angle, category } = forceTopicOverride || selectDailyTopic();

  console.log(`[News-Gen] Starting article generation: "${angle}" (${category})`);

  try {
    // 1. Generate article text
    const article = await generateArticleText(topic, angle);
    console.log(`[News-Gen] Text generated: "${article.title}" (${article.tokensUsed} tokens)`);

    // 2. Generate cover image
    const image = await generateCoverImage(article.title, category);
    console.log(`[News-Gen] Image generated via ${image.provider}`);

    // 3. Inject cover image into HTML content
    let finalHtml = article.htmlContent;
    if (finalHtml.includes('<!-- IMAGE_BREAK -->')) {
      finalHtml = finalHtml.replace(
        '<!-- IMAGE_BREAK -->',
        `<figure class="news-inline-image">
          <img src="${image.imageUrl}" alt="${article.title}" loading="lazy" style="width:100%;border-radius:12px;margin:2rem 0;" />
        </figure>`
      );
    }

    // 4. Save to database
    const slug = generateSlug(article.title);
    const [saved] = await db.insert(newsArticles).values({
      slug,
      title: article.title,
      subtitle: article.subtitle,
      summary: article.summary,
      htmlContent: finalHtml,
      coverImageUrl: image.imageUrl,
      coverImagePrompt: image.prompt,
      imageProvider: image.provider,
      category: category as any,
      tags: article.tags,
      readTimeMinutes: article.readTimeMinutes,
      status: 'published',
      publishedAt: new Date(),
      generatedBy: 'ai-engine',
      aiModel: 'smart-router + ' + image.provider,
    }).returning();

    // 5. Log generation
    await db.insert(newsGenerationLogs).values({
      articleId: saved.id,
      topic,
      prompt: angle,
      textmodel: 'smart-router',
      imageModel: image.provider === 'openai' ? 'gpt-image-1' : image.provider === 'fal' ? 'fal-centralized' : 'placeholder',
      textTokensUsed: article.tokensUsed,
      success: true,
    });

    console.log(`[News-Gen] ✅ Article saved: ID=${saved.id}, slug=${slug}`);

    return { success: true, articleId: saved.id, title: article.title };
  } catch (error: any) {
    console.error('[News-Gen] ❌ Generation failed:', error);

    // Log failure
    await db.insert(newsGenerationLogs).values({
      topic,
      prompt: angle,
      textmodel: 'smart-router',
      imageModel: 'unknown',
      success: false,
      errorMessage: error.message,
    }).catch(() => {});

    return { success: false, error: error.message };
  }
}

// ── Auto-Publish to Social Network & Extension ─────────────────
export async function autoPublishArticle(articleId: number): Promise<{ published: boolean; channels: string[] }> {
  const channels: string[] = [];

  try {
    const [article] = await db.select().from(newsArticles).where(eq(newsArticles.id, articleId)).limit(1);
    if (!article) return { published: false, channels: [] };

    // 1. Publish to Boostify Social Network (Firestore)
    try {
      const admin = require('firebase-admin');
      const firestore = admin.firestore();
      
      const socialPost = {
        authorId: 'boostify-official',
        authorName: 'Boostify',
        authorAvatar: '/boostify-logo.png',
        type: 'article',
        content: `📰 ${article.title}\n\n${article.summary}\n\nRead more on Boostify News →`,
        mediaUrl: article.coverImageUrl,
        mediaType: 'image',
        articleSlug: article.slug,
        articleUrl: `/news/${article.slug}`,
        tags: article.tags || [],
        likes: 0,
        comments: 0,
        shares: 0,
        isOfficial: true,
        isPinned: true,
        createdAt: admin.firestore.Timestamp.now(),
      };

      const docRef = await firestore.collection('social_posts').add(socialPost);
      channels.push('social-network');
      
      await db.update(newsArticles)
        .set({ 
          publishedToSocial: true,
          socialPostIds: { firestore: docRef.id },
        })
        .where(eq(newsArticles.id, articleId));
    } catch (err: any) {
      console.warn('[News-Gen] Social publish failed:', err.message);
    }

    // 2. Queue to Chrome Extension for Instagram posting
    try {
      // Find active extension connections (use first admin/official account)
      const connections = await db.select()
        .from(instagramExtensionConnections)
        .where(eq(instagramExtensionConnections.status, 'active'))
        .limit(3);

      for (const conn of connections) {
        const caption = `🚀 ${article.title}\n\n${article.subtitle || article.summary}\n\n🔗 Read the full article on Boostify\n\n${(article.tags || []).map((t: string) => `#${t.replace(/\s+/g, '')}`).join(' ')} #Boostify #MusicTech #FutureOfMusic`;

        await db.insert(instagramPendingActions).values({
          userId: conn.userId,
          connectionId: conn.id,
          actionType: 'post_caption',
          payload: {
            caption,
            imageUrl: article.coverImageUrl,
            source: 'news-auto-publish',
            articleId: article.id,
            articleSlug: article.slug,
          },
          status: 'pending',
          generatedBy: 'news-engine',
          priority: 1,
        });
      }

      if (connections.length > 0) {
        channels.push('instagram-extension');
        await db.update(newsArticles)
          .set({ publishedToExtension: true })
          .where(eq(newsArticles.id, articleId));
      }
    } catch (err: any) {
      console.warn('[News-Gen] Extension queue failed:', err.message);
    }

    // 3. Trigger AI agent reactions in Social Network
    try {
      const { generateNewsReactions, generateNewsDebate } = await import('../agents/social-agent');
      const { emitAgentEvent, AgentEventType } = await import('../agents/events');
      
      const reactionCount = await generateNewsReactions({
        id: article.id,
        title: article.title,
        summary: article.summary || '',
        category: article.category || 'general',
        tags: article.tags as string[] || [],
      });

      if (reactionCount > 0) {
        channels.push('ai-social-reactions');
        console.log(`[News-Gen] ${reactionCount} AI agents reacted to the article`);
      }

      // 4. Auto-generate debate from the article
      const debateResult = await generateNewsDebate({
        id: article.id,
        title: article.title,
        summary: article.summary || '',
        category: article.category || 'general',
        tags: article.tags as string[] || [],
      });

      if (debateResult > 0) {
        channels.push('news-debate');
        console.log(`[News-Gen] Debate generated with ${debateResult} contributions`);
      }

      // Emit NEWS_PUBLISHED event
      emitAgentEvent({
        type: AgentEventType.NEWS_PUBLISHED,
        artistId: 0, // System event
        payload: {
          articleId: article.id,
          title: article.title,
          category: article.category,
          reactions: reactionCount,
        },
        timestamp: new Date(),
      });
    } catch (err: any) {
      console.warn('[News-Gen] AI social reactions failed:', err.message);
    }

    return { published: channels.length > 0, channels };
  } catch (error: any) {
    console.error('[News-Gen] Auto-publish error:', error);
    return { published: false, channels: [] };
  }
}

// ── Artist-Specific News Generator ────────────────────────────
/**
 * Generate a news article personalized to a specific artist using their masterJson.
 */
export async function generateArtistNews(
  userId: number,
  options: { topic?: string; angle?: string; category?: string }
): Promise<{ success: boolean; articleId?: number; title?: string; error?: string }> {
  // 1. Fetch artist's masterJson and name from DB
  const [user] = await db
    .select({
      masterJson: users.masterJson,
      artistName: users.artistName,
      profileImage: users.profileImage,
      coverImage: users.coverImage,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { success: false, error: 'Artist not found' };

  const mj: any = user.masterJson || {};
  const artistName: string = user.artistName || mj?.canonical?.artist_name || 'Artist';

  // 2. Build rich artist context from masterJson
  const genre: string = mj?.canonical?.primary_genre || mj?.musical_dna?.genre_tags?.[0] || '';
  const aesthetic: string = mj?.visual_dna?.aesthetic_keywords?.join(', ') || '';
  const currentChapter: string = mj?.narrative?.current_chapter || '';
  const lyricThemes: string = (mj?.musical_dna?.lyric_themes || []).join(', ');
  const artisticGoals: string = (mj?.agent_context?.artist_goals || []).join('; ');
  const audienceProfile: string = mj?.audience?.primary_demographic || '';
  const uniqueVoice: string = mj?.persona?.voice_tone || '';
  const influences: string = (mj?.musical_dna?.sonic_influences || []).join(', ');
  const businessModel: string = mj?.business_model?.primary_revenue_streams
    ? Object.keys(mj.business_model.primary_revenue_streams).join(', ')
    : '';

  const artistContext = [
    `Artist Name: ${artistName}`,
    genre && `Genre: ${genre}`,
    aesthetic && `Visual Aesthetic: ${aesthetic}`,
    currentChapter && `Current Narrative Chapter: "${currentChapter}"`,
    lyricThemes && `Lyric Themes: ${lyricThemes}`,
    uniqueVoice && `Artist Voice/Tone: ${uniqueVoice}`,
    influences && `Influences: ${influences}`,
    audienceProfile && `Target Audience: ${audienceProfile}`,
    artisticGoals && `Goals: ${artisticGoals}`,
    businessModel && `Revenue Focus: ${businessModel}`,
  ].filter(Boolean).join('\n');

  // 3. Pick topic/angle — use provided values or derive from masterJson
  const category = options.category || 'artist-news';
  const topic = options.topic || `${artistName} — Artist Feature`;
  const angle = options.angle || (currentChapter
    ? `${artistName}'s journey: ${currentChapter}`
    : `The rise of ${artistName} in the ${genre || 'independent'} music scene`);

  console.log(`[News-Gen] 🎵 Artist article for ${artistName}: "${angle}"`);

  try {
    // 4. Generate text with artist-enriched prompt
    const systemPrompt = `You are the editorial voice of Boostify — a visionary AI music platform.
Write compelling editorial articles about independent artists who use AI technology to build their careers.
Your tone is journalistic, inspiring, and forward-looking.
You write clean, modern prose with short paragraphs and bold statements.
Reference the artist's real traits and journey — make this feel personal and authentic.
Also connect how Boostify's technology (AI music, autonomous agents, blockchain copyright, tokenization) empowers this artist.`;

    const userPrompt = `Write a professional feature article about this artist:

ARTIST PROFILE:
${artistContext}

ARTICLE ANGLE: "${angle}"
TOPIC: ${topic}

Requirements:
1. Return a JSON object with:
   - "title": Compelling headline featuring the artist name (max 80 chars)
   - "subtitle": Expands on headline with intrigue (max 120 chars)
   - "summary": 2-sentence preview capturing their essence (max 200 chars)
   - "htmlContent": Full article as clean HTML using <h2>, <h3>, <p>, <blockquote>, <ul>/<li>, <strong>, <em>. At least 8 paragraphs, 600+ words. Add <!-- IMAGE_BREAK --> where a photo should go.
   - "tags": 5-8 relevant tags (lowercase, no #) — include artist name, genre, etc.
   - "readTimeMinutes": estimated reading time as integer

Style guide:
- Write AS IF this artist is a real up-and-coming star (because they are)
- Reference their actual genre, aesthetic, themes, and goals
- Include a section on how AI/Boostify amplifies their work
- End with a forward-looking vision for their career`;

    const rawContent = await callAI(
      'bio',
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.85, maxTokens: 4000, requireJSON: true, label: 'news-generator-artist' }
    );

    const content = JSON.parse(rawContent || '{}');

    const article = {
      title: content.title || `${artistName} — The Future Sounds Like This`,
      subtitle: content.subtitle || '',
      summary: content.summary || '',
      htmlContent: content.htmlContent || '<p>Article generation failed.</p>',
      tags: content.tags || [artistName.toLowerCase().replace(/\s+/g, '-'), genre, 'boostify'].filter(Boolean),
      readTimeMinutes: content.readTimeMinutes || 5,
    };

    // 5. Generate cover image — use the artist-aware cascade with their real face
    const referenceImageUrl: string | null =
      (user as any).profileImage ||
      (user as any).profileImageUrl ||
      mj?.visual_dna?.reference_image_url ||
      mj?.master_design_url ||
      null;
    const brandColors: string[] = mj?.visual_dna?.brand_colors || mj?.brand?.palette || [];

    const imagePrompt = `Editorial cover photo for "${article.title}". Artist: ${artistName}. Genre: ${genre || 'independent music'}. Aesthetic: ${aesthetic || 'cinematic, documentary'}. Brand palette: ${brandColors.join(', ') || 'orange, dark gray, white'}. NO text in image.`;

    const image = await generateNewsImage({
      title: article.title,
      artistName,
      genre,
      category,
      context: article.summary || angle,
      referenceImageUrl,
      aspectRatio: '16:9',
    }).then((r) => ({ imageUrl: r.imageUrl, prompt: r.prompt, provider: (r.provider.startsWith('fal') ? 'fal' : r.provider.startsWith('openai') ? 'openai' : 'fallback') as 'openai' | 'fal' | 'fallback' }))
      .catch(() => ({
        imageUrl: `https://placehold.co/1536x1024/1a1a2e/f97316?text=${encodeURIComponent(artistName)}`,
        prompt: imagePrompt,
        provider: 'fallback' as const,
      }));

    // Inject image
    let finalHtml = article.htmlContent;
    if (finalHtml.includes('<!-- IMAGE_BREAK -->')) {
      finalHtml = finalHtml.replace(
        '<!-- IMAGE_BREAK -->',
        `<figure class="news-inline-image">
          <img src="${image.imageUrl}" alt="${article.title}" loading="lazy" style="width:100%;border-radius:12px;margin:2rem 0;" />
        </figure>`
      );
    }

    // 6. Save to DB tagged with artistId via generatedBy
    const slug = generateSlug(article.title);
    const [saved] = await db.insert(newsArticles).values({
      slug,
      title: article.title,
      subtitle: article.subtitle,
      summary: article.summary,
      htmlContent: finalHtml,
      coverImageUrl: image.imageUrl,
      coverImagePrompt: imagePrompt,
      imageProvider: image.provider,
      category: category as any,
      tags: article.tags,
      readTimeMinutes: article.readTimeMinutes,
      status: 'published',
      publishedAt: new Date(),
      generatedBy: `artist:${userId}`,
      aiModel: 'smart-router + ' + image.provider,
    }).returning();

    // 7. Log
    await db.insert(newsGenerationLogs).values({
      articleId: saved.id,
      topic,
      prompt: angle,
      textmodel: 'smart-router',
      imageModel: image.provider === 'openai' ? 'gpt-image-1' : image.provider === 'fal' ? 'fal-centralized' : 'placeholder',
      textTokensUsed: tokensUsed,
      success: true,
    });

    console.log(`[News-Gen] ✅ Artist article saved: ID=${saved.id}, slug=${slug}`);
    return { success: true, articleId: saved.id, title: article.title };
  } catch (error: any) {
    console.error('[News-Gen] ❌ Artist article generation failed:', error);
    await db.insert(newsGenerationLogs).values({
      topic,
      prompt: angle,
      textmodel: 'smart-router',
      imageModel: 'unknown',
      success: false,
      errorMessage: error.message,
    }).catch(() => {});
    return { success: false, error: error.message };
  }
}

// ── Daily Scheduler ────────────────────────────────────────────
let dailyInterval: ReturnType<typeof setInterval> | null = null;

export function startDailyNewsScheduler() {
  if (dailyInterval) return;

  console.log('[News-Gen] 📰 Daily news scheduler started');

  // Check every hour if we need to generate today's article
  dailyInterval = setInterval(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if we already generated an article today
      const existing = await db.select({ id: newsArticles.id })
        .from(newsArticles)
        .where(gte(newsArticles.createdAt, today))
        .limit(1);

      if (existing.length === 0) {
        console.log('[News-Gen] No article today — generating...');
        const result = await generateDailyArticle();
        if (result.success && result.articleId) {
          // Auto-publish after generation
          const pubResult = await autoPublishArticle(result.articleId);
          console.log(`[News-Gen] Auto-published to: ${pubResult.channels.join(', ') || 'none'}`);
          // Send newsletter to registered recipients
          try {
            const nlResult = await sendArticleNewsletter(result.articleId);
            console.log(`[News-Gen] Newsletter sent: ${nlResult.sent}/${nlResult.total} recipients`);
          } catch (nlErr: any) {
            console.warn('[News-Gen] Newsletter send failed:', nlErr.message);
          }
          // Send to 20 music industry contacts from Supabase
          try {
            const outreach = await sendArticleToIndustryContacts(result.articleId);
            console.log(`[News-Gen] Industry outreach: ${outreach.sent} sent, ${outreach.failed} failed`);
          } catch (outErr: any) {
            console.warn('[News-Gen] Industry outreach failed:', outErr.message);
          }
        }
      }
    } catch (err: any) {
      console.error('[News-Gen] Scheduler error:', err.message);
    }
  }, 60 * 60 * 1000); // Every hour

  // Also run immediately on startup (with 30s delay to let server initialize)
  setTimeout(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await db.select({ id: newsArticles.id })
        .from(newsArticles)
        .where(gte(newsArticles.createdAt, today))
        .limit(1);

      if (existing.length === 0) {
        console.log('[News-Gen] Initial check — generating today\'s article...');
        const result = await generateDailyArticle();
        if (result.success && result.articleId) {
          const pubResult = await autoPublishArticle(result.articleId);
          console.log(`[News-Gen] Auto-published to: ${pubResult.channels.join(', ') || 'none'}`);
          // Send newsletter to registered recipients
          try {
            const nlResult = await sendArticleNewsletter(result.articleId);
            console.log(`[News-Gen] Newsletter sent: ${nlResult.sent}/${nlResult.total} recipients`);
          } catch (nlErr: any) {
            console.warn('[News-Gen] Newsletter send failed:', nlErr.message);
          }
          // Send to 20 music industry contacts from Supabase
          try {
            const outreach = await sendArticleToIndustryContacts(result.articleId);
            console.log(`[News-Gen] Industry outreach: ${outreach.sent} sent, ${outreach.failed} failed`);
          } catch (outErr: any) {
            console.warn('[News-Gen] Industry outreach failed:', outErr.message);
          }
        }
      } else {
        console.log('[News-Gen] Today\'s article already exists, skipping initial generation');
      }
    } catch (err: any) {
      console.error('[News-Gen] Initial generation failed:', err.message);
    }
  }, 30000);
}

export function stopDailyNewsScheduler() {
  if (dailyInterval) {
    clearInterval(dailyInterval);
    dailyInterval = null;
    console.log('[News-Gen] Daily scheduler stopped');
  }
}
