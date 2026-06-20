/**
 * SENTIMENT TRACKER — Multi-Source Crypto Sentiment Aggregator
 *
 * Sources (all free, no auth required):
 *   - Reddit public API — r/CryptoCurrency, r/Bitcoin, r/ethereum, r/polygon
 *   - Cryptopanic RSS feed — crypto news sentiment
 *   - Alternative.me Fear & Greed (existing price-feeds integration)
 *
 * Adapted approach from: atilaahmettaner/tradingview-mcp market_sentiment tool
 * Used by: market-intelligence.ts (report enrichment), market-hunter.ts (trade gate)
 *
 * All functions fail SILENTLY — sentiment is advisory, never blocking.
 */

import { getFearGreedIndex } from './price-feeds';

const REDDIT_API = 'https://www.reddit.com';
const CRYPTOPANIC_RSS = 'https://cryptopanic.com/news/rss/?kind=news&regions=en';

// ============================================
// TYPES
// ============================================

export interface RedditPost {
  title: string;
  score: number;
  numComments: number;
  url: string;
  created: number;
}

export interface RedditSentiment {
  subreddit: string;
  score: number;       // -1 to +1
  bullishPosts: number;
  bearishPosts: number;
  neutralPosts: number;
  topPosts: RedditPost[];
  sampleSize: number;
}

export interface NewsItem {
  title: string;
  source: string;
  publishedAt: string;
  sentimentScore: number;  // -1 to +1
  url: string;
}

export interface NewsSentiment {
  headlines: NewsItem[];
  overallScore: number;   // -1 to +1
  bullishCount: number;
  bearishCount: number;
}

export type SentimentLabel = 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';

export interface CombinedSentimentSignal {
  signal: SentimentLabel;
  score: number;          // 0-100 (maps to Alternative.me scale)
  fearGreed: number;
  redditScore: number;    // -1 to +1 combined
  newsScore: number;      // -1 to +1
  details: string[];
  shouldAvoidEntry: boolean;
  calculatedAt: string;
}

// ============================================
// KEYWORD SENTIMENT SCORING
// ============================================

const BULLISH_WORDS = new Set([
  'bull', 'bullish', 'moon', 'mooning', 'pump', 'pumping', 'rally', 'breakout',
  'buy', 'buying', 'long', 'support', 'bounce', 'recovery', 'green', 'ath',
  'accumulate', 'accumulating', 'hodl', 'hold', 'dip', 'undervalued',
  'adoption', 'partnership', 'launch', 'upgrade', 'milestone', 'positive',
]);

const BEARISH_WORDS = new Set([
  'bear', 'bearish', 'dump', 'dumping', 'crash', 'crashing', 'fall', 'falling',
  'sell', 'selling', 'short', 'resistance', 'breakdown', 'dead', 'red', 'loss',
  'hack', 'hacked', 'scam', 'fraud', 'ban', 'banned', 'regulation', 'sec',
  'lawsuit', 'investigation', 'negative', 'fear', 'panic', 'rekt', 'rug',
]);

/** Score a text string: +1 to -1 */
function scoreText(text: string): number {
  const words = text.toLowerCase().split(/\W+/);
  let bullCount = 0;
  let bearCount = 0;

  for (const word of words) {
    if (BULLISH_WORDS.has(word)) bullCount++;
    if (BEARISH_WORDS.has(word)) bearCount++;
  }

  const total = bullCount + bearCount;
  if (total === 0) return 0;
  return (bullCount - bearCount) / total;
}

/** Classify score as bullish/bearish/neutral */
function classifyScore(score: number): 'bullish' | 'bearish' | 'neutral' {
  if (score > 0.1) return 'bullish';
  if (score < -0.1) return 'bearish';
  return 'neutral';
}

// ============================================
// REDDIT SENTIMENT
// ============================================

const CRYPTO_SUBREDDITS = ['CryptoCurrency', 'Bitcoin', 'ethereum', 'maticnetwork'];

/** Fetch hot posts from a subreddit (public JSON API) */
async function fetchSubredditPosts(subreddit: string, limit = 25): Promise<RedditPost[]> {
  const url = `${REDDIT_API}/r/${subreddit}/hot.json?limit=${limit}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: {
      'User-Agent': 'BoostifyMusicBot/1.0 (by /u/boostifybot)',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Reddit r/${subreddit}: ${res.status}`);

  const data = await res.json() as any;
  const posts: RedditPost[] = [];

  for (const child of (data?.data?.children ?? [])) {
    const d = child?.data;
    if (!d?.title) continue;
    posts.push({
      title: d.title,
      score: d.score ?? 0,
      numComments: d.num_comments ?? 0,
      url: d.url ?? '',
      created: d.created_utc ?? 0,
    });
  }

  return posts;
}

/** Analyze sentiment of a single subreddit */
async function analyzeSubreddit(subreddit: string, coins: string[]): Promise<RedditSentiment | null> {
  try {
    const posts = await fetchSubredditPosts(subreddit, 25);

    // Filter to posts mentioning the target coins (or all if no filter)
    const relevant = coins.length > 0
      ? posts.filter(p => coins.some(c => p.title.toLowerCase().includes(c.toLowerCase())))
      : posts;

    const sample = relevant.length > 5 ? relevant : posts.slice(0, 15);

    let bullish = 0, bearish = 0, neutral = 0;
    let weightedScore = 0;
    let totalWeight = 0;

    for (const post of sample) {
      const s = scoreText(post.title);
      const weight = Math.log(1 + Math.max(1, post.score));  // weight by upvotes
      weightedScore += s * weight;
      totalWeight += weight;
      const c = classifyScore(s);
      if (c === 'bullish') bullish++;
      else if (c === 'bearish') bearish++;
      else neutral++;
    }

    return {
      subreddit,
      score: totalWeight > 0 ? weightedScore / totalWeight : 0,
      bullishPosts: bullish,
      bearishPosts: bearish,
      neutralPosts: neutral,
      topPosts: sample.slice(0, 5),
      sampleSize: sample.length,
    };
  } catch {
    return null;
  }
}

/** Get aggregated Reddit sentiment for specific crypto coins */
export async function getCryptoRedditSentiment(
  coins: string[] = ['bitcoin', 'ethereum', 'polygon', 'matic'],
): Promise<{ score: number; bullish: number; bearish: number; topPosts: RedditPost[] } | null> {
  try {
    const results = await Promise.allSettled(
      CRYPTO_SUBREDDITS.map(sub => analyzeSubreddit(sub, coins)),
    );

    const sentiments = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<RedditSentiment>).value);

    if (sentiments.length === 0) return null;

    const avgScore = sentiments.reduce((s, r) => s + r.score, 0) / sentiments.length;
    const totalBullish = sentiments.reduce((s, r) => s + r.bullishPosts, 0);
    const totalBearish = sentiments.reduce((s, r) => s + r.bearishPosts, 0);
    const topPosts = sentiments.flatMap(r => r.topPosts).sort((a, b) => b.score - a.score).slice(0, 10);

    return { score: avgScore, bullish: totalBullish, bearish: totalBearish, topPosts };
  } catch {
    return null;
  }
}

// ============================================
// NEWS SENTIMENT (Cryptopanic RSS)
// ============================================

/** Parse a minimal RSS feed (no xml parser dep — use regex) */
function parseRSSItems(xml: string): Array<{ title: string; pubDate: string; link: string }> {
  const items: Array<{ title: string; pubDate: string; link: string }> = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block) ?? [])[1]?.trim() ?? '';
    const pubDate = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block) ?? [])[1]?.trim() ?? '';
    const link = (/<link>([\s\S]*?)<\/link>/.exec(block) ?? [])[1]?.trim() ?? '';
    if (title) items.push({ title, pubDate, link });
  }

  return items.slice(0, 20);
}

/** Get sentiment from financial news headlines */
export async function getFinancialNewsFeed(): Promise<NewsSentiment | null> {
  try {
    const res = await fetch(CRYPTOPANIC_RSS, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'BoostifyMusicBot/1.0' },
    });
    if (!res.ok) throw new Error(`CryptoPanic RSS: ${res.status}`);

    const xml = await res.text();
    const items = parseRSSItems(xml);

    const headlines: NewsItem[] = items.map(item => {
      const score = scoreText(item.title);
      return {
        title: item.title,
        source: 'cryptopanic',
        publishedAt: item.pubDate,
        sentimentScore: score,
        url: item.link,
      };
    });

    const bullishCount = headlines.filter(h => h.sentimentScore > 0.1).length;
    const bearishCount = headlines.filter(h => h.sentimentScore < -0.1).length;
    const overallScore = headlines.length > 0
      ? headlines.reduce((s, h) => s + h.sentimentScore, 0) / headlines.length
      : 0;

    return { headlines, overallScore, bullishCount, bearishCount };
  } catch {
    return null;
  }
}

// ============================================
// COMBINED SIGNAL — Main Entry Point
// ============================================

/**
 * Aggregate Fear & Greed + Reddit + News into a single sentiment signal.
 * Returns Alternative.me-compatible 0-100 scale.
 */
export async function getCombinedSentimentSignal(): Promise<CombinedSentimentSignal> {
  const [fgResult, redditResult, newsResult] = await Promise.allSettled([
    getFearGreedIndex(),
    getCryptoRedditSentiment(),
    getFinancialNewsFeed(),
  ]);

  const fg = fgResult.status === 'fulfilled' ? fgResult.value : null;
  const reddit = redditResult.status === 'fulfilled' ? redditResult.value : null;
  const news = newsResult.status === 'fulfilled' ? newsResult.value : null;

  const fearGreed = fg?.value ?? 50;
  const redditScore = reddit?.score ?? 0;
  const newsScore = news?.overallScore ?? 0;

  // Weighted composite: Fear/Greed 60%, Reddit 25%, News 15%
  // Convert reddit/news (-1 to +1) → 0-100 scale
  const redditNorm = (redditScore + 1) / 2 * 100;
  const newsNorm = (newsScore + 1) / 2 * 100;

  const compositeScore = Math.round(
    fearGreed * 0.6 + redditNorm * 0.25 + newsNorm * 0.15,
  );

  let signal: SentimentLabel;
  if (compositeScore <= 20) signal = 'extreme_fear';
  else if (compositeScore <= 40) signal = 'fear';
  else if (compositeScore <= 60) signal = 'neutral';
  else if (compositeScore <= 80) signal = 'greed';
  else signal = 'extreme_greed';

  // Entry avoidance: extreme conditions in either direction
  const shouldAvoidEntry = signal === 'extreme_fear' || signal === 'extreme_greed';

  const details: string[] = [];
  if (fg) details.push(`Fear/Greed: ${fearGreed} (${fg.classification})`);
  if (reddit) details.push(`Reddit: ${redditScore >= 0 ? '+' : ''}${(redditScore * 100).toFixed(0)}% sentiment (${reddit.bullish}B/${reddit.bearish}B)`);
  if (news) details.push(`News: ${newsScore >= 0 ? '+' : ''}${(newsScore * 100).toFixed(0)}% (${news.bullishCount}B/${news.bearishCount}B headlines)`);

  console.log(`💭 [SentimentTracker] ${signal.toUpperCase()} (${compositeScore}) | ${details.join(' | ')}`);

  return {
    signal,
    score: compositeScore,
    fearGreed,
    redditScore,
    newsScore,
    details,
    shouldAvoidEntry,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Should we avoid opening new trades given current sentiment?
 * True = avoid entry (extreme conditions)
 */
export function shouldAvoidTradeEntry(sentiment: CombinedSentimentSignal): boolean {
  return sentiment.shouldAvoidEntry;
}

/**
 * Get a human-readable sentiment summary
 */
export function summarizeSentiment(sentiment: CombinedSentimentSignal): string {
  const label = sentiment.signal.replace('_', ' ').toUpperCase();
  return `${label} (${sentiment.score}/100) — ${sentiment.details.join(', ')}`;
}
