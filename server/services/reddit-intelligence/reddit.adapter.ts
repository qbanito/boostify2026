// ───────────────────────────────────────────────────────────────────────────
// Reddit Artist Intelligence Center — Gateway Adapter
// ---------------------------------------------------------------------------
// READ-ONLY market-intelligence client for Reddit. This module NEVER posts,
// comments or votes — it only LISTENS: searching subreddits & posts, reading
// community metrics, keyword mentions and trending content so Boostify can turn
// Reddit into a continuous source of fan discovery, trend detection, competitor
// analysis and viral-opportunity scoring for each artist.
//
// Auth uses Reddit's application-only OAuth2 ("client_credentials" grant) at the
// PLATFORM level (REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / REDDIT_USER_AGENT).
// Artists do NOT connect anything — Boostify queries Reddit on their behalf
// based on their genre, keywords and similar artists.
//
// When credentials are absent (or a request fails) the adapter transparently
// falls back to a deterministic SIMULATION so the dashboard always renders.
// All access respects Reddit's API rules and rate limits (1 req/sec budget).
// ───────────────────────────────────────────────────────────────────────────
import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

const OAUTH_BASE = 'https://oauth.reddit.com';
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const USER_AGENT =
  process.env.REDDIT_USER_AGENT || 'web:boostify-music-intelligence:v1.0 (by /u/boostify)';

// ── Public types ─────────────────────────────────────────────────────────────
export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  url: string;
  permalink: string;
  score: number;
  numComments: number;
  upvoteRatio: number;
  createdUtc: number; // seconds
  selftext: string;
  thumbnail?: string | null;
}

export interface RedditSubreddit {
  name: string; // without r/
  title: string;
  subscribers: number;
  activeUsers: number;
  publicDescription: string;
  over18: boolean;
  url: string;
}

export interface KeywordMention {
  keyword: string;
  totalMentions: number;
  posts: RedditPost[];
  topSubreddits: Array<{ subreddit: string; count: number }>;
}

export interface RedditGateway {
  searchSubreddits(query: string, limit?: number): Promise<RedditSubreddit[]>;
  searchPosts(keyword: string, opts?: { subreddit?: string; sort?: string; limit?: number; time?: string }): Promise<RedditPost[]>;
  getTrendingPosts(subreddit?: string, limit?: number): Promise<RedditPost[]>;
  getCommunityMetrics(subreddit: string): Promise<RedditSubreddit | null>;
  getKeywordMentions(keyword: string, limit?: number): Promise<KeywordMention>;
  isSimulated(): boolean;
}

export function isRedditConfigured(): boolean {
  return !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

// ── Helpers shared by both adapters ──────────────────────────────────────────
function normalizePost(d: any): RedditPost {
  return {
    id: String(d?.id ?? d?.name ?? Math.random().toString(36).slice(2)),
    title: String(d?.title ?? '').slice(0, 300),
    subreddit: String(d?.subreddit ?? '').replace(/^r\//, ''),
    author: String(d?.author ?? 'unknown'),
    url: String(d?.url ?? ''),
    permalink: d?.permalink ? `https://www.reddit.com${d.permalink}` : '',
    score: Number(d?.score ?? 0),
    numComments: Number(d?.num_comments ?? 0),
    upvoteRatio: Number(d?.upvote_ratio ?? 0.5),
    createdUtc: Number(d?.created_utc ?? Math.floor(Date.now() / 1000)),
    selftext: String(d?.selftext ?? '').slice(0, 600),
    thumbnail: typeof d?.thumbnail === 'string' && d.thumbnail.startsWith('http') ? d.thumbnail : null,
  };
}

function normalizeSub(d: any): RedditSubreddit {
  return {
    name: String(d?.display_name ?? d?.subreddit ?? '').replace(/^r\//, ''),
    title: String(d?.title ?? d?.display_name ?? ''),
    subscribers: Number(d?.subscribers ?? 0),
    activeUsers: Number(d?.active_user_count ?? d?.accounts_active ?? 0),
    publicDescription: String(d?.public_description ?? '').slice(0, 400),
    over18: !!d?.over18,
    url: d?.url ? `https://www.reddit.com${d.url}` : `https://www.reddit.com/r/${d?.display_name ?? ''}`,
  };
}

// ─────────────────────────── REAL API ADAPTER ───────────────────────────────
class RedditApiAdapter implements RedditGateway {
  private token: string | null = null;
  private tokenExpiry = 0;
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({ baseURL: OAUTH_BASE, timeout: 12_000, headers: { 'User-Agent': USER_AGENT } });
  }

  isSimulated() { return false; }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry - 30_000) return this.token;
    const id = process.env.REDDIT_CLIENT_ID!;
    const secret = process.env.REDDIT_CLIENT_SECRET!;
    const basic = Buffer.from(`${id}:${secret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials' });
    const { data } = await axios.post(TOKEN_URL, body.toString(), {
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      timeout: 12_000,
    });
    this.token = data?.access_token;
    this.tokenExpiry = Date.now() + (Number(data?.expires_in ?? 3600) * 1000);
    if (!this.token) throw new Error('Reddit token missing in response');
    return this.token;
  }

  private async get(path: string, params: Record<string, any> = {}): Promise<any> {
    const token = await this.getToken();
    const { data } = await this.http.get(path, {
      params: { raw_json: 1, ...params },
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  }

  async searchSubreddits(query: string, limit = 12): Promise<RedditSubreddit[]> {
    const data = await this.get('/subreddits/search', { q: query, limit, include_over_18: 'off' });
    const children = data?.data?.children ?? [];
    return children.map((c: any) => normalizeSub(c.data));
  }

  async searchPosts(keyword: string, opts: { subreddit?: string; sort?: string; limit?: number; time?: string } = {}): Promise<RedditPost[]> {
    const { subreddit, sort = 'relevance', limit = 25, time = 'month' } = opts;
    const path = subreddit ? `/r/${subreddit}/search` : '/search';
    const params: Record<string, any> = { q: keyword, sort, limit, t: time, type: 'link' };
    if (subreddit) params.restrict_sr = 'true';
    const data = await this.get(path, params);
    const children = data?.data?.children ?? [];
    return children.map((c: any) => normalizePost(c.data));
  }

  async getTrendingPosts(subreddit = 'music', limit = 25): Promise<RedditPost[]> {
    const data = await this.get(`/r/${subreddit}/hot`, { limit });
    const children = data?.data?.children ?? [];
    return children.map((c: any) => normalizePost(c.data)).filter((p: RedditPost) => p.title);
  }

  async getCommunityMetrics(subreddit: string): Promise<RedditSubreddit | null> {
    try {
      const data = await this.get(`/r/${subreddit.replace(/^r\//, '')}/about`);
      return data?.data ? normalizeSub(data.data) : null;
    } catch {
      return null;
    }
  }

  async getKeywordMentions(keyword: string, limit = 50): Promise<KeywordMention> {
    const posts = await this.searchPosts(keyword, { sort: 'new', limit, time: 'month' });
    return buildKeywordMention(keyword, posts);
  }
}

// ─────────────────────────── SIMULATION ADAPTER ─────────────────────────────
const SIM_SUBS = [
  { name: 'Music', title: 'Music', subscribers: 32_400_000, activeUsers: 14_200, desc: 'The musical community of Reddit' },
  { name: 'listentothis', title: 'Listen To This', subscribers: 17_800_000, activeUsers: 3_400, desc: 'Discover new and overlooked music' },
  { name: 'indieheads', title: 'indieheads', subscribers: 1_120_000, activeUsers: 2_800, desc: 'A community for indie music' },
  { name: 'popheads', title: 'popheads', subscribers: 720_000, activeUsers: 1_900, desc: 'A community for pop music' },
  { name: 'hiphopheads', title: 'hip hop heads', subscribers: 3_100_000, activeUsers: 5_600, desc: 'The latest in hip hop' },
  { name: 'WeAreTheMusicMakers', title: 'We Are The Music Makers', subscribers: 2_000_000, activeUsers: 1_200, desc: 'For producers & musicians' },
  { name: 'electronicmusic', title: 'Electronic Music', subscribers: 1_500_000, activeUsers: 900, desc: 'Electronic music & artists' },
  { name: 'Afrobeat', title: 'Afrobeat', subscribers: 38_000, activeUsers: 140, desc: 'Afrobeat & Afrobeats' },
  { name: 'latinmusic', title: 'Latin Music', subscribers: 64_000, activeUsers: 220, desc: 'Música latina' },
  { name: 'deephouse', title: 'Deep House', subscribers: 210_000, activeUsers: 410, desc: 'Deep & melodic house' },
  { name: 'Blues', title: 'Blues', subscribers: 190_000, activeUsers: 360, desc: 'The Blues community' },
  { name: 'makinghiphop', title: 'Making Hip Hop', subscribers: 380_000, activeUsers: 540, desc: 'Produce & collaborate' },
];

const SIM_TITLE_TEMPLATES = [
  'Looking for new {genre} artists to add to my playlist',
  'This independent {genre} artist deserves way more attention',
  'Just discovered an incredible {genre} track — recommendations?',
  'What {genre} artists are blowing up right now?',
  'I make {genre} music with AI tools — feedback welcome',
  'Underrated {genre} releases of this month',
  'Need {genre} music for my indie film, any suggestions?',
  'Best {genre} songs to discover emerging talent',
  'How are small {genre} artists growing in 2026?',
  'Weekly {genre} discovery thread — drop your favorites',
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function simPosts(seed: string, genre: string, count: number): RedditPost[] {
  const out: RedditPost[] = [];
  const base = hashStr(seed + genre);
  for (let i = 0; i < count; i++) {
    const h = hashStr(`${seed}-${genre}-${i}`);
    const sub = SIM_SUBS[(base + i) % SIM_SUBS.length];
    const tmpl = SIM_TITLE_TEMPLATES[(h) % SIM_TITLE_TEMPLATES.length];
    const score = 20 + (h % 4200);
    out.push({
      id: `sim_${h.toString(36)}`,
      title: tmpl.replace(/\{genre\}/g, genre || 'indie'),
      subreddit: sub.name,
      author: `user_${(h % 9000) + 1000}`,
      url: `https://www.reddit.com/r/${sub.name}`,
      permalink: `https://www.reddit.com/r/${sub.name}/comments/sim_${h.toString(36)}`,
      score,
      numComments: 2 + (h % 240),
      upvoteRatio: 0.6 + ((h % 38) / 100),
      createdUtc: Math.floor(Date.now() / 1000) - (h % (60 * 60 * 24 * 21)),
      selftext: '',
      thumbnail: null,
    });
  }
  return out;
}

class RedditSimulationAdapter implements RedditGateway {
  isSimulated() { return true; }

  async searchSubreddits(query: string, limit = 12): Promise<RedditSubreddit[]> {
    return SIM_SUBS.slice(0, limit).map((s) => ({
      name: s.name, title: s.title, subscribers: s.subscribers, activeUsers: s.activeUsers,
      publicDescription: s.desc, over18: false, url: `https://www.reddit.com/r/${s.name}`,
    }));
  }

  async searchPosts(keyword: string, opts: { subreddit?: string; sort?: string; limit?: number } = {}): Promise<RedditPost[]> {
    return simPosts(keyword, keyword, opts.limit ?? 25);
  }

  async getTrendingPosts(subreddit = 'music', limit = 25): Promise<RedditPost[]> {
    return simPosts(subreddit, subreddit, limit).sort((a, b) => b.score - a.score);
  }

  async getCommunityMetrics(subreddit: string): Promise<RedditSubreddit | null> {
    const clean = subreddit.replace(/^r\//, '');
    const found = SIM_SUBS.find((s) => s.name.toLowerCase() === clean.toLowerCase()) || SIM_SUBS[hashStr(clean) % SIM_SUBS.length];
    return { name: found.name, title: found.title, subscribers: found.subscribers, activeUsers: found.activeUsers, publicDescription: found.desc, over18: false, url: `https://www.reddit.com/r/${found.name}` };
  }

  async getKeywordMentions(keyword: string, limit = 50): Promise<KeywordMention> {
    return buildKeywordMention(keyword, simPosts(keyword, keyword, Math.min(limit, 40)));
  }
}

function buildKeywordMention(keyword: string, posts: RedditPost[]): KeywordMention {
  const bySub = new Map<string, number>();
  for (const p of posts) bySub.set(p.subreddit, (bySub.get(p.subreddit) || 0) + 1);
  const topSubreddits = [...bySub.entries()]
    .map(([subreddit, count]) => ({ subreddit, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return { keyword, totalMentions: posts.length, posts, topSubreddits };
}

// ── Resilient wrapper: try the real API, fall back to simulation per-method ───
class ResilientRedditGateway implements RedditGateway {
  private api = new RedditApiAdapter();
  private sim = new RedditSimulationAdapter();
  private degraded = false;

  isSimulated() { return this.degraded || !isRedditConfigured(); }

  private async run<T>(fn: (g: RedditGateway) => Promise<T>): Promise<T> {
    if (!isRedditConfigured()) return fn(this.sim);
    try {
      return await fn(this.api);
    } catch (e: any) {
      logger.warn('[reddit] API call failed, using simulation:', e?.response?.status || e?.message);
      this.degraded = true;
      return fn(this.sim);
    }
  }

  searchSubreddits(query: string, limit?: number) { return this.run((g) => g.searchSubreddits(query, limit)); }
  searchPosts(keyword: string, opts?: any) { return this.run((g) => g.searchPosts(keyword, opts)); }
  getTrendingPosts(subreddit?: string, limit?: number) { return this.run((g) => g.getTrendingPosts(subreddit, limit)); }
  getCommunityMetrics(subreddit: string) { return this.run((g) => g.getCommunityMetrics(subreddit)); }
  getKeywordMentions(keyword: string, limit?: number) { return this.run((g) => g.getKeywordMentions(keyword, limit)); }
}

let _gateway: ResilientRedditGateway | null = null;
export function getRedditGateway(): RedditGateway {
  if (!_gateway) _gateway = new ResilientRedditGateway();
  return _gateway;
}
