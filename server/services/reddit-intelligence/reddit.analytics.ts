// ───────────────────────────────────────────────────────────────────────────
// Reddit Artist Intelligence Center — Analytics & Scoring
// ---------------------------------------------------------------------------
// Pure, deterministic scoring helpers used to rank communities, posts, keywords
// and competitors. No network / no side effects — easy to test and reuse.
// All scores are normalised to 0..100 unless noted.
// ───────────────────────────────────────────────────────────────────────────
import type { RedditPost, RedditSubreddit, KeywordMention } from './reddit.adapter';

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const HOUR = 3600;

/** Age of a post in hours (min 1 to avoid div-by-zero). */
export function postAgeHours(post: RedditPost): number {
  return Math.max(1, (Date.now() / 1000 - post.createdUtc) / HOUR);
}

/**
 * Trending score — Reddit-"hot"-style: rewards score but decays with age so
 * fresh, fast-rising posts outrank old high-score ones. 0..100.
 */
export function trendingScore(post: RedditPost): number {
  const order = Math.log10(Math.max(1, post.score + post.numComments * 2));
  const ageHours = postAgeHours(post);
  const decay = 1 / Math.pow(ageHours + 2, 0.55);
  return clamp(order * decay * 38);
}

/** Velocity = engagement per hour since posting. Raw points/hour. */
export function growthVelocity(post: RedditPost): number {
  return Math.round(((post.score + post.numComments) / postAgeHours(post)) * 10) / 10;
}

/** Engagement score blends comments-per-upvote and upvote ratio. 0..100. */
export function engagementScore(post: RedditPost): number {
  const commentRatio = post.score > 0 ? post.numComments / post.score : post.numComments;
  const e = commentRatio * 120 + (post.upvoteRatio - 0.5) * 80;
  return clamp(e);
}

/**
 * Viral probability — likelihood a post is breaking out. Combines absolute
 * traction, freshness, velocity and discussion. 0..100.
 */
export function viralProbability(post: RedditPost): number {
  const traction = clamp(Math.log10(Math.max(1, post.score)) * 22);
  const fresh = clamp(100 - postAgeHours(post) * 2.4);
  const velo = clamp(growthVelocity(post) * 1.6);
  const talk = clamp(post.numComments * 0.6);
  const ratio = clamp((post.upvoteRatio - 0.5) * 160);
  return Math.round(clamp(traction * 0.3 + fresh * 0.2 + velo * 0.25 + talk * 0.15 + ratio * 0.1));
}

/**
 * Audience-match score for a community vs the artist's reach. Smaller, highly
 * active niche communities score higher than huge passive defaults. 0..100.
 */
export function audienceMatchScore(sub: RedditSubreddit, keywordHits = 0): number {
  const activity = sub.subscribers > 0 ? (sub.activeUsers / sub.subscribers) * 100 : 0;
  const activityScore = clamp(activity * 1200); // ~0.08% active ≈ very lively
  // Niche sweet-spot: 10k–800k subs is most actionable for an emerging artist.
  const size = sub.subscribers;
  const sizeScore = size < 5_000 ? 35 : size < 800_000 ? 100 : size < 4_000_000 ? 70 : 45;
  const relevance = clamp(keywordHits * 14);
  return Math.round(clamp(activityScore * 0.4 + sizeScore * 0.4 + relevance * 0.2));
}

/** Competition level inside a community (harder = bigger & busier). */
export function competitionLevel(sub: RedditSubreddit): 'Low' | 'Medium' | 'High' {
  if (sub.subscribers > 3_000_000) return 'High';
  if (sub.subscribers > 400_000) return 'Medium';
  return 'Low';
}

/** Fan potential classification from an audience-match score. */
export function fanPotential(matchScore: number): 'High' | 'Medium' | 'Low' {
  if (matchScore >= 66) return 'High';
  if (matchScore >= 40) return 'Medium';
  return 'Low';
}

// ── Lightweight sentiment heuristic (keyword lexicon) ────────────────────────
const POS = ['love', 'amazing', 'great', 'best', 'incredible', 'fire', 'banger', 'beautiful', 'talent', 'underrated', 'gem', 'goat', 'masterpiece', 'vibe', 'dope', 'awesome', 'perfect', 'recommend'];
const NEG = ['hate', 'boring', 'bad', 'worst', 'trash', 'overrated', 'cringe', 'mid', 'awful', 'terrible', 'annoying', 'flop', 'disappointing', 'generic'];

export function sentimentOf(text: string): { label: 'positive' | 'neutral' | 'negative'; score: number } {
  const t = (text || '').toLowerCase();
  let s = 0;
  for (const w of POS) if (t.includes(w)) s++;
  for (const w of NEG) if (t.includes(w)) s--;
  const score = clamp(50 + s * 12, 0, 100);
  const label = score >= 60 ? 'positive' : score <= 40 ? 'negative' : 'neutral';
  return { label, score };
}

/** Aggregate sentiment across many posts → 0..100 + label + distribution. */
export function aggregateSentiment(posts: RedditPost[]): {
  score: number;
  label: 'positive' | 'neutral' | 'negative';
  positive: number;
  neutral: number;
  negative: number;
} {
  if (!posts.length) return { score: 50, label: 'neutral', positive: 0, neutral: 0, negative: 0 };
  let positive = 0, neutral = 0, negative = 0, sum = 0;
  for (const p of posts) {
    const s = sentimentOf(`${p.title} ${p.selftext}`);
    sum += s.score;
    if (s.label === 'positive') positive++;
    else if (s.label === 'negative') negative++;
    else neutral++;
  }
  const score = Math.round(sum / posts.length);
  return { score, label: score >= 60 ? 'positive' : score <= 40 ? 'negative' : 'neutral', positive, neutral, negative };
}

/** Keyword momentum: compares mentions in the last 7d vs the prior period. */
export function keywordGrowth(mention: KeywordMention): number {
  const now = Date.now() / 1000;
  const week = 7 * 24 * HOUR;
  let recent = 0, prior = 0;
  for (const p of mention.posts) {
    const age = now - p.createdUtc;
    if (age <= week) recent++;
    else if (age <= week * 2) prior++;
  }
  if (prior === 0) return recent > 0 ? 100 : 0;
  return Math.round(((recent - prior) / prior) * 100);
}

/** 7-day mention sparkline buckets (oldest → newest) for charts. */
export function mentionsTimeline(posts: RedditPost[], days = 7): Array<{ day: string; mentions: number }> {
  const now = Date.now();
  const buckets = Array.from({ length: days }, () => 0);
  for (const p of posts) {
    const ageDays = Math.floor((now / 1000 - p.createdUtc) / (24 * HOUR));
    if (ageDays >= 0 && ageDays < days) buckets[days - 1 - ageDays]++;
  }
  return buckets.map((mentions, i) => {
    const d = new Date(now - (days - 1 - i) * 24 * HOUR * 1000);
    return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), mentions };
  });
}

/** Best hour-of-week heatmap from post timestamps (for posting strategy). */
export function activityHeatmap(posts: RedditPost[]): Array<{ day: number; hour: number; value: number }> {
  const grid = new Map<string, number>();
  for (const p of posts) {
    const d = new Date(p.createdUtc * 1000);
    const key = `${d.getUTCDay()}-${d.getUTCHours()}`;
    grid.set(key, (grid.get(key) || 0) + p.score + p.numComments);
  }
  const out: Array<{ day: number; hour: number; value: number }> = [];
  for (const [key, value] of grid.entries()) {
    const [day, hour] = key.split('-').map(Number);
    out.push({ day, hour, value });
  }
  return out;
}
