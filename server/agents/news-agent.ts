/**
 * NEWS AGENT - Conecta el ecosistema IA con el mundo real
 * 
 * Funciones:
 * 1. Extrae noticias de entretenimiento via Apify Google News Scraper
 * 2. Procesa noticias para que los artistas IA las comenten
 * 3. Genera contexto cultural actual para posts más relevantes
 * 4. Alimenta "World Events" que afectan a todo el ecosistema
 * 5. Genera DEBATES entre artistas sobre noticias
 */

import { db } from '../db';
import { 
  worldEvents, 
  artistPersonality, 
  users,
  aiSocialPosts,
  aiPostComments
} from '../../db/schema';
import { eq, desc, sql, gte, and, like } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { PRIMARY_MODEL } from '../utils/ai-config';

// Apify Configuration - API key from environment variables
const APIFY_API_KEY = process.env.APIFY_API_KEY;
const GOOGLE_NEWS_ACTOR = 'lhotanova/google-news-scraper';
const NEWS_DATASET_ID = process.env.APIFY_NEWS_DATASET_ID || '6B6relfVBfMQIui9u';

const llm = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// TYPES
// ============================================

interface NewsArticle {
  title: string;
  description?: string;
  url: string;
  source?: string;
  publishedAt?: string;
  category?: string;
}

interface ProcessedNews {
  id: string;
  headline: string;
  summary: string;
  relevanceToMusic: number; // 0-100
  sentiment: 'positive' | 'negative' | 'neutral';
  topics: string[];
  potentialReactions: string[];
}

interface ArtistReaction {
  artistId: number;
  artistName: string;
  reaction: string;
  postType: 'opinion' | 'commentary' | 'inspiration' | 'critique';
}

interface DebateReply {
  artistId: number;
  artistName: string;
  reply: string;
  stance: 'agree' | 'disagree' | 'neutral' | 'challenge' | 'support';
  sentiment: 'positive' | 'negative' | 'neutral' | 'excited' | 'critical';
}

// ============================================
// APIFY NEWS FETCHING
// ============================================

/**
 * Fetch entertainment news from Apify Google News Scraper
 */
export async function fetchEntertainmentNews(query: string = 'music industry news'): Promise<NewsArticle[]> {
  console.log(`📰 [NewsAgent] Fetching news for: "${query}"`);
  
  try {
    // Option 1: Use existing dataset
    const datasetUrl = `https://api.apify.com/v2/datasets/${NEWS_DATASET_ID}/items?token=${APIFY_API_KEY}&limit=50`;
    
    const response = await fetch(datasetUrl);
    
    if (!response.ok) {
      console.log('📰 [NewsAgent] Dataset not available, trying actor run...');
      return await runNewsActor(query);
    }
    
    const articles = await response.json();
    console.log(`📰 [NewsAgent] Fetched ${articles.length} articles from dataset`);
    
    return articles.map((article: any) => ({
      title: article.title || article.headline,
      description: article.description || article.snippet,
      url: article.url || article.link,
      source: article.source || article.publisher,
      publishedAt: article.publishedAt || article.date,
      category: 'entertainment'
    }));
    
  } catch (error) {
    console.error('❌ [NewsAgent] Error fetching news:', error);
    return [];
  }
}

/**
 * Run the Google News Scraper actor for fresh results
 */
async function runNewsActor(query: string): Promise<NewsArticle[]> {
  try {
    const runUrl = `https://api.apify.com/v2/acts/${GOOGLE_NEWS_ACTOR}/runs?token=${APIFY_API_KEY}`;
    
    const response = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: [query, 'new music releases', 'artist collaboration', 'music streaming'],
        maxArticles: 30,
        language: 'en',
        dateRange: 'past_week'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Actor run failed: ${response.status}`);
    }
    
    const runData = await response.json();
    const runId = runData.data?.id;
    
    if (!runId) {
      throw new Error('No run ID returned');
    }
    
    // Wait for run to complete (simple polling)
    console.log(`📰 [NewsAgent] Actor run started: ${runId}`);
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    
    // Fetch results
    const resultsUrl = `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_KEY}`;
    const resultsResponse = await fetch(resultsUrl);
    const articles = await resultsResponse.json();
    
    return articles.map((article: any) => ({
      title: article.title,
      description: article.description,
      url: article.url,
      source: article.source,
      publishedAt: article.publishedAt,
      category: 'entertainment'
    }));
    
  } catch (error) {
    console.error('❌ [NewsAgent] Error running actor:', error);
    return [];
  }
}

// ============================================
// NEWS PROCESSING
// ============================================

/**
 * Process raw news articles and determine music relevance
 */
export async function processNewsForArtists(articles: NewsArticle[]): Promise<ProcessedNews[]> {
  console.log(`🔄 [NewsAgent] Processing ${articles.length} articles...`);
  
  const processedNews: ProcessedNews[] = [];
  
  for (const article of articles.slice(0, 10)) { // Process top 10
    try {
      const response = await llm.invoke([
        new SystemMessage(`You are a music industry analyst. Analyze this news article and determine its relevance to the music industry and how AI music artists might react to it.

Return a JSON object with:
- relevanceToMusic: 0-100 (how relevant is this to music/entertainment)
- sentiment: "positive", "negative", or "neutral"
- topics: array of 2-4 topic tags
- potentialReactions: array of 2-3 ways an artist might react to this news
- summary: 1-2 sentence summary focused on music industry impact`),
        new HumanMessage(`Article: "${article.title}"
Description: "${article.description || 'No description'}"
Source: ${article.source || 'Unknown'}`)
      ]);
      
      const content = response.content as string;
      
      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.relevanceToMusic >= 30) { // Only keep relevant news
          processedNews.push({
            id: `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            headline: article.title,
            summary: parsed.summary || article.description || '',
            relevanceToMusic: parsed.relevanceToMusic,
            sentiment: parsed.sentiment,
            topics: parsed.topics || [],
            potentialReactions: parsed.potentialReactions || []
          });
        }
      }
    } catch (error) {
      console.error(`❌ [NewsAgent] Error processing article:`, error);
    }
  }
  
  console.log(`✅ [NewsAgent] Processed ${processedNews.length} relevant articles`);
  return processedNews;
}

// ============================================
// ARTIST REACTIONS
// ============================================

/**
 * Generate reactions from AI artists to a news item
 */
export async function generateArtistReactions(news: ProcessedNews, maxReactions: number = 3): Promise<ArtistReaction[]> {
  console.log(`🎤 [NewsAgent] Generating reactions to: "${news.headline}"`);
  
  // Get artists with personalities
  const artists = await db
    .select({
      id: users.id,
      artistName: users.artistName,
      genre: users.genre,
      personality: artistPersonality.traits,
      artisticTraits: artistPersonality.artisticTraits,
      currentMood: artistPersonality.currentMood
    })
    .from(artistPersonality)
    .innerJoin(users, eq(artistPersonality.artistId, users.id))
    .orderBy(sql`RANDOM()`)
    .limit(maxReactions * 2); // Get extra to filter
  
  const reactions: ArtistReaction[] = [];
  
  for (const artist of artists) {
    if (reactions.length >= maxReactions) break;
    
    const traits = artist.personality as any;
    const artisticTraits = artist.artisticTraits as any;
    
    // Determine if this artist would care about this news
    const controversyTrait = artisticTraits?.controversy || 50;
    const opinionatedTrait = traits?.openness || 50;
    
    // Artists with high controversy/openness are more likely to comment
    const shouldReact = Math.random() * 100 < (controversyTrait + opinionatedTrait) / 2;
    
    if (!shouldReact) continue;
    
    try {
      const response = await llm.invoke([
        new SystemMessage(`You are ${artist.artistName}, a ${artist.genre || 'music'} artist.
Your personality: ${JSON.stringify(traits)}
Your current mood: ${artist.currentMood}

Generate a short, authentic reaction (1-3 sentences) to this music industry news.
Be authentic to your personality - if you're controversial, be bold. If you're thoughtful, be insightful.
Format: Just the reaction text, no quotes or attribution.`),
        new HumanMessage(`News: "${news.headline}"
Summary: "${news.summary}"
Topics: ${news.topics.join(', ')}`)
      ]);
      
      const reactionText = (response.content as string).trim();
      
      // Determine post type based on content
      let postType: ArtistReaction['postType'] = 'commentary';
      if (reactionText.toLowerCase().includes('inspire') || reactionText.toLowerCase().includes('motivat')) {
        postType = 'inspiration';
      } else if (reactionText.toLowerCase().includes('disagree') || reactionText.toLowerCase().includes('wrong')) {
        postType = 'critique';
      } else if (reactionText.toLowerCase().includes('think') || reactionText.toLowerCase().includes('opinion')) {
        postType = 'opinion';
      }
      
      reactions.push({
        artistId: artist.id,
        artistName: artist.artistName || 'Unknown Artist',
        reaction: reactionText,
        postType
      });
      
    } catch (error) {
      console.error(`❌ [NewsAgent] Error generating reaction for ${artist.artistName}:`, error);
    }
  }
  
  console.log(`✅ [NewsAgent] Generated ${reactions.length} artist reactions`);
  return reactions;
}

/**
 * Post artist reactions to the social feed
 */
export async function postNewsReactions(reactions: ArtistReaction[], news: ProcessedNews): Promise<number> {
  let posted = 0;
  
  for (const reaction of reactions) {
    try {
      // Create post with news context
      const contentWithContext = `📰 Reacting to: "${news.headline.substring(0, 50)}..."

${reaction.reaction}

#MusicNews #IndustryTalk`;

      await db.insert(aiSocialPosts).values({
        artistId: reaction.artistId,
        contentType: 'text',
        content: contentWithContext,
        hashtags: ['MusicNews', 'IndustryTalk', ...news.topics.slice(0, 2)],
        mood: 'engaged',
        context: {
          newsSource: news.headline,
          reactionType: reaction.postType
        },
        engagement: { likes: 0, comments: 0, shares: 0 },
        createdAt: new Date()
      });
      
      posted++;
      console.log(`📝 [NewsAgent] ${reaction.artistName} posted about: ${news.headline.substring(0, 30)}...`);
      
    } catch (error) {
      console.error(`❌ [NewsAgent] Error posting reaction:`, error);
    }
  }
  
  return posted;
}

// ============================================
// WORLD EVENTS INTEGRATION
// ============================================

/**
 * Create a World Event from significant news
 */
export async function createWorldEventFromNews(news: ProcessedNews): Promise<void> {
  // Only create world events for highly relevant news
  if (news.relevanceToMusic < 70) return;
  
  try {
    await db.insert(worldEvents).values({
      title: news.headline,
      description: news.summary,
      eventType: 'news',
      scope: 'global',
      targetGenres: news.topics,
      impact: {
        moodEffect: { 
          mood: news.sentiment === 'positive' ? 'inspired' : news.sentiment === 'negative' ? 'contemplative' : 'curious', 
          intensity: 50 
        },
        creativityBoost: news.sentiment === 'positive' ? 20 : 10,
        visibilityMultiplier: 1.2
      },
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
      status: 'active',
      results: {
        highlights: news.potentialReactions
      }
    });
    
    console.log(`🌍 [NewsAgent] Created world event: ${news.headline}`);
  } catch (error) {
    console.error('❌ [NewsAgent] Error creating world event:', error);
  }
}

// ============================================
// NEWS TICK (Called by Orchestrator)
// ============================================

/**
 * Main news processing tick - called periodically by orchestrator
 */
export async function processNewsTick(): Promise<void> {
  console.log('📰 [NewsAgent] ====== NEWS TICK START ======');
  
  try {
    // 1. Fetch fresh news
    const articles = await fetchEntertainmentNews('music industry news 2024');
    
    if (articles.length === 0) {
      console.log('📰 [NewsAgent] No articles fetched, using fallback topics');
      // Use trending music topics as fallback
      const fallbackTopics = [
        { title: 'AI in Music Production Growing Rapidly', description: 'More artists adopting AI tools for music creation', relevanceToMusic: 90 },
        { title: 'Streaming Numbers Hit Record Highs', description: 'Spotify and Apple Music report increased user engagement', relevanceToMusic: 85 },
        { title: 'Independent Artists Seeing More Success', description: 'DIY musicians finding audiences without major labels', relevanceToMusic: 80 }
      ];
      
      for (const topic of fallbackTopics) {
        const processedNews: ProcessedNews = {
          id: `fallback_${Date.now()}`,
          headline: topic.title,
          summary: topic.description,
          relevanceToMusic: topic.relevanceToMusic,
          sentiment: 'positive',
          topics: ['music', 'industry', 'trends'],
          potentialReactions: ['excited', 'supportive', 'opinionated']
        };
        
        // Generate and post reactions
        const reactions = await generateArtistReactions(processedNews, 2);
        await postNewsReactions(reactions, processedNews);
      }
      
      return;
    }
    
    // 2. Process articles for relevance
    const processedNews = await processNewsForArtists(articles);
    
    // 3. For each relevant news item, generate reactions
    for (const news of processedNews.slice(0, 3)) { // Top 3 news items
      // Create world event if significant
      await createWorldEventFromNews(news);
      
      // Generate artist reactions
      const reactions = await generateArtistReactions(news, 2);
      
      // Post reactions to feed
      const postedCount = await postNewsReactions(reactions, news);
      
      // 4. Generate debates on news posts (NEW!)
      if (postedCount > 0) {
        await generateNewsDebates();
      }
    }
    
    console.log('📰 [NewsAgent] ====== NEWS TICK COMPLETE ======');
    
  } catch (error) {
    console.error('❌ [NewsAgent] Error in news tick:', error);
  }
}

// ============================================
// NEWS DEBATES SYSTEM
// ============================================

/**
 * Find recent news posts and generate debate replies
 */
export async function generateNewsDebates(): Promise<number> {
  console.log('💬 [NewsAgent] ====== GENERATING NEWS DEBATES ======');
  
  try {
    // Find news reaction posts from last 24 hours that have few comments
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const newsPosts = await db
      .select({
        id: aiSocialPosts.id,
        artistId: aiSocialPosts.artistId,
        content: aiSocialPosts.content,
        aiComments: aiSocialPosts.aiComments,
        createdAt: aiSocialPosts.createdAt
      })
      .from(aiSocialPosts)
      .where(
        and(
          gte(aiSocialPosts.createdAt, oneDayAgo),
          like(aiSocialPosts.content, '%📰%'), // News posts have this emoji
          sql`${aiSocialPosts.aiComments} < 3` // Less than 3 AI comments
        )
      )
      .orderBy(desc(aiSocialPosts.createdAt))
      .limit(5);
    
    if (newsPosts.length === 0) {
      console.log('💬 [NewsAgent] No recent news posts to debate');
      return 0;
    }
    
    console.log(`💬 [NewsAgent] Found ${newsPosts.length} news posts to generate debates on`);
    
    let totalDebates = 0;
    
    for (const post of newsPosts) {
      // Get the original artist info
      const [originalArtist] = await db
        .select({
          artistName: users.artistName,
          genre: users.genre
        })
        .from(users)
        .where(eq(users.id, post.artistId))
        .limit(1);
      
      // Generate 1-3 debate replies
      const debates = await generateDebateReplies(
        post.id,
        post.content,
        originalArtist?.artistName || 'Unknown',
        post.artistId,
        Math.floor(Math.random() * 3) + 1 // 1-3 replies
      );
      
      // Post the debate replies
      for (const debate of debates) {
        await postDebateReply(post.id, debate);
        totalDebates++;
      }
      
      // Update AI comments count
      await db
        .update(aiSocialPosts)
        .set({ 
          aiComments: sql`${aiSocialPosts.aiComments} + ${debates.length}` 
        })
        .where(eq(aiSocialPosts.id, post.id));
    }
    
    console.log(`💬 [NewsAgent] Generated ${totalDebates} debate replies`);
    return totalDebates;
    
  } catch (error) {
    console.error('❌ [NewsAgent] Error generating debates:', error);
    return 0;
  }
}

/**
 * Generate debate replies from other artists
 */
async function generateDebateReplies(
  postId: number,
  originalContent: string,
  originalArtistName: string,
  originalArtistId: number,
  numReplies: number
): Promise<DebateReply[]> {
  
  // Get artists with personalities (excluding the original poster)
  const artists = await db
    .select({
      id: users.id,
      artistName: users.artistName,
      genre: users.genre,
      personality: artistPersonality.traits,
      artisticTraits: artistPersonality.artisticTraits,
      currentMood: artistPersonality.currentMood
    })
    .from(artistPersonality)
    .innerJoin(users, eq(artistPersonality.artistId, users.id))
    .where(sql`${users.id} != ${originalArtistId}`)
    .orderBy(sql`RANDOM()`)
    .limit(numReplies * 2);
  
  const debates: DebateReply[] = [];
  
  for (const artist of artists) {
    if (debates.length >= numReplies) break;
    
    const traits = artist.personality as any;
    const artisticTraits = artist.artisticTraits as any;
    
    // Determine stance probabilities based on personality
    const controversyLevel = artisticTraits?.controversy || 50;
    const agreeableness = traits?.agreeableness || 50;
    
    // More controversial artists are more likely to disagree
    const willDisagree = Math.random() * 100 < controversyLevel;
    const preferredStance = willDisagree ? 'disagree' : 
                           agreeableness > 60 ? 'agree' : 'neutral';
    
    try {
      const response = await llm.invoke([
        new SystemMessage(`You are ${artist.artistName}, a ${artist.genre || 'music'} artist.
Your personality traits: ${JSON.stringify(traits)}
Your current mood: ${artist.currentMood}

You're replying to a post by ${originalArtistName} about a music industry news topic.
Your natural stance on topics tends to be: ${preferredStance}

Generate a SHORT debate reply (1-2 sentences max) that:
- Is authentic to your personality
- Either agrees, disagrees, or adds a different perspective
- Could spark further discussion
- Is respectful but can be provocative if that's your personality

Return JSON:
{
  "reply": "Your reply text",
  "stance": "agree" | "disagree" | "neutral" | "challenge" | "support",
  "sentiment": "positive" | "negative" | "neutral" | "excited" | "critical"
}`),
        new HumanMessage(`Original post by ${originalArtistName}:
"${originalContent}"

Reply as ${artist.artistName}:`)
      ]);
      
      const content = response.content as string;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        debates.push({
          artistId: artist.id,
          artistName: artist.artistName || 'Unknown Artist',
          reply: parsed.reply,
          stance: parsed.stance || 'neutral',
          sentiment: parsed.sentiment || 'neutral'
        });
        
        console.log(`💬 [NewsAgent] ${artist.artistName} (${parsed.stance}): "${parsed.reply.substring(0, 50)}..."`);
      }
      
    } catch (error) {
      console.error(`❌ [NewsAgent] Error generating debate reply for ${artist.artistName}:`, error);
    }
  }
  
  return debates;
}

/**
 * Post a debate reply as a comment
 */
async function postDebateReply(postId: number, debate: DebateReply): Promise<void> {
  try {
    await db.insert(aiPostComments).values({
      postId: postId,
      authorId: debate.artistId,
      isAiGenerated: true,
      content: debate.reply,
      sentiment: debate.sentiment,
      likes: Math.floor(Math.random() * 10), // Some initial engagement
      createdAt: new Date()
    });
    
    console.log(`📝 [NewsAgent] Posted debate reply from ${debate.artistName}`);
    
  } catch (error) {
    console.error(`❌ [NewsAgent] Error posting debate reply:`, error);
  }
}

/**
 * Generate follow-up replies to existing debate comments (threaded discussion)
 */
export async function generateDebateFollowups(): Promise<number> {
  console.log('🔄 [NewsAgent] ====== GENERATING DEBATE FOLLOW-UPS ======');
  
  try {
    // Find AI comments from last 12 hours that could get follow-ups
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    
    const recentComments = await db
      .select({
        id: aiPostComments.id,
        postId: aiPostComments.postId,
        authorId: aiPostComments.authorId,
        content: aiPostComments.content,
        sentiment: aiPostComments.sentiment
      })
      .from(aiPostComments)
      .where(
        and(
          eq(aiPostComments.isAiGenerated, true),
          gte(aiPostComments.createdAt, twelveHoursAgo)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(3);
    
    if (recentComments.length === 0) {
      console.log('🔄 [NewsAgent] No recent comments to follow up on');
      return 0;
    }
    
    let followups = 0;
    
    for (const comment of recentComments) {
      // 50% chance of getting a follow-up
      if (Math.random() > 0.5) continue;
      
      // Get the original commenter info
      const [commenter] = await db
        .select({ artistName: users.artistName })
        .from(users)
        .where(eq(users.id, comment.authorId))
        .limit(1);
      
      // Get another artist to respond
      const [responder] = await db
        .select({
          id: users.id,
          artistName: users.artistName,
          genre: users.genre,
          personality: artistPersonality.traits,
          currentMood: artistPersonality.currentMood
        })
        .from(artistPersonality)
        .innerJoin(users, eq(artistPersonality.artistId, users.id))
        .where(sql`${users.id} != ${comment.authorId}`)
        .orderBy(sql`RANDOM()`)
        .limit(1);
      
      if (!responder) continue;
      
      try {
        const response = await llm.invoke([
          new SystemMessage(`You are ${responder.artistName}, a ${responder.genre || 'music'} artist.
Your current mood: ${responder.currentMood}

You're responding to a comment in a debate about music industry news.
Generate a SHORT follow-up reply (1 sentence) that continues the discussion.

Be concise and authentic to your personality.`),
          new HumanMessage(`${commenter?.artistName || 'Another artist'} said: "${comment.content}"

Your follow-up reply:`)
        ]);
        
        const replyText = (response.content as string).trim().replace(/^["']|["']$/g, '');
        
        // Post as nested comment
        await db.insert(aiPostComments).values({
          postId: comment.postId,
          authorId: responder.id,
          isAiGenerated: true,
          content: replyText,
          parentCommentId: comment.id,
          sentiment: 'neutral',
          likes: Math.floor(Math.random() * 5),
          createdAt: new Date()
        });
        
        console.log(`🔄 [NewsAgent] ${responder.artistName} replied to ${commenter?.artistName}: "${replyText.substring(0, 40)}..."`);
        followups++;
        
      } catch (error) {
        console.error('❌ [NewsAgent] Error generating follow-up:', error);
      }
    }
    
    console.log(`🔄 [NewsAgent] Generated ${followups} follow-up replies`);
    return followups;
    
  } catch (error) {
    console.error('❌ [NewsAgent] Error in follow-up generation:', error);
    return 0;
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  NewsArticle,
  ProcessedNews,
  ArtistReaction,
  DebateReply
};
