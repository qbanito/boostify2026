/**
 * Event-Driven News Orchestrator
 * ────────────────────────────────
 * Generates one polished news article per significant platform event
 * (song release, artist debut, tokenization, milestone, etc.), improves it
 * with OpenAI gpt-4o, generates a reliable cover image, persists to the
 * newsArticles table, auto-publishes to social & extension, distributes
 * via newsletter + industry contacts, and maintains a synchronized
 * publication calendar that respects the artist's release cadence.
 *
 * Key design decisions:
 * - Sequential processing via an in-memory queue to avoid parallel spam
 * - Centralized FAL-first image pipeline, with OpenAI image fallback only if explicitly enabled
 * - gpt-4o for article text (richer than gpt-4o-mini used previously)
 * - Calendar entries saved to Firestore for frontend timeline display
 * - Full distribution pipeline: Boostify News page → social → newsletter → industry
 */

import OpenAI from 'openai';
import { db } from '../db';
import { newsArticles, newsGenerationLogs, songs, users, artistNews } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { sendArticleNewsletter, sendArticleToIndustryContacts } from './news-newsletter';
import { autoPublishArticle } from './news-generator';
import { generateNewsImage } from './news-image-generator';
import { PRIMARY_MODEL } from '../utils/ai-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY });

// ── Event Types ────────────────────────────────────────────────
export type NewsEventType =
  | 'song_released'
  | 'artist_debut'
  | 'song_tokenized'
  | 'album_complete'
  | 'merch_launched'
  | 'crowdfunding_started'
  | 'milestone_reached'
  | 'collaboration_announced'
  | 'distribution_live';

export interface NewsEventPayload {
  type: NewsEventType;
  artistId: number;
  artistName: string;
  artistBio?: string;
  genre?: string;
  songId?: number;
  songTitle?: string;
  /** Lyrics of the song being promoted — used to generate coherent articles */
  songLyrics?: string;
  albumTitle?: string;
  details?: Record<string, any>;
  /** Optional override — skip newsletter distribution (useful during initial batch generation) */
  skipDistribution?: boolean;
  /** Optional — schedule for future instead of immediate publish */
  scheduledFor?: Date;
}

// ── Sequential Queue ───────────────────────────────────────────
const eventQueue: NewsEventPayload[] = [];
let isProcessing = false;

/**
 * Public entry point — enqueue an event for news generation.
 * Events are processed one-at-a-time in FIFO order.
 */
export function enqueueNewsEvent(event: NewsEventPayload): void {
  eventQueue.push(event);
  console.log(`📰 [News-Orchestrator] Queued "${event.type}" for ${event.artistName} (queue length: ${eventQueue.length})`);
  drainQueue();
}

async function drainQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (eventQueue.length > 0) {
    const event = eventQueue.shift()!;
    try {
      await processNewsEvent(event);
    } catch (err: any) {
      console.error(`❌ [News-Orchestrator] Failed to process "${event.type}" for ${event.artistName}:`, err.message);
    }
    // Small cooldown between articles to avoid API rate limits
    await sleep(3000);
  }

  isProcessing = false;
}

// ── Core Processing ────────────────────────────────────────────
async function processNewsEvent(event: NewsEventPayload): Promise<void> {
  console.log(`📰 [News-Orchestrator] Processing "${event.type}" for ${event.artistName}...`);

  // 1. Enrich context if missing
  const context = await enrichEventContext(event);

  // 2. Generate high-quality article with gpt-4o
  const article = await generateArticle(event, context);

  // 3. Generate cover image with the centralized FAL-first news image generator
  //    (cascade: flux-pro/kontext → nano-banana-2/edit → seedream/v4/edit → flux/dev → ...)
  const image = await generateNewsImage({
    title: article.title,
    artistName: event.artistName,
    genre: context.genre,
    category: event.type,
    context: article.summary || article.subtitle,
    referenceImageUrl: context.profileImage || null,
    aspectRatio: '16:9',
  });

  // 4. Inject image into HTML
  let finalHtml = article.htmlContent;
  if (finalHtml.includes('<!-- IMAGE_BREAK -->')) {
    finalHtml = finalHtml.replace(
      '<!-- IMAGE_BREAK -->',
      `<figure class="news-inline-image">
        <img src="${image.imageUrl}" alt="${article.title}" loading="lazy"
             style="width:100%;border-radius:12px;margin:2rem 0;" />
      </figure>`,
    );
  }

  // 5. Determine status & timing
  const isScheduled = event.scheduledFor && event.scheduledFor > new Date();
  const status = isScheduled ? 'scheduled' : 'published';
  const publishedAt = isScheduled ? null : new Date();

  // 6. Save to newsArticles
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
    category: 'artist-news',
    tags: article.tags,
    readTimeMinutes: article.readTimeMinutes,
    status,
    publishedAt,
    scheduledFor: isScheduled ? event.scheduledFor : null,
    generatedBy: `artist-${event.artistId}`,
    aiModel: `${PRIMARY_MODEL} + ${image.provider}`,
  }).returning();

  console.log(`💾 [News-Orchestrator] Article saved: ID=${saved.id}, slug=${slug}, status=${status}`);

  // 7. Also save to artistNews for artist profile page
  try {
    await db.insert(artistNews).values({
      userId: event.artistId,
      title: article.title,
      content: article.plainContent,
      summary: article.summary,
      imageUrl: image.imageUrl || '',
      category: mapEventToArtistNewsCategory(event.type),
      isPublished: !isScheduled,
    });
  } catch (err: any) {
    console.warn(`⚠️ [News-Orchestrator] artistNews insert failed:`, err.message);
  }

  // 8. Log generation
  await db.insert(newsGenerationLogs).values({
    articleId: saved.id,
    topic: event.type,
    prompt: article.promptUsed,
    textmodel: PRIMARY_MODEL,
    imageModel: image.provider,
    textTokensUsed: article.tokensUsed,
    success: true,
  }).catch(() => {});

  // 9. Save calendar entry to Firestore
  await saveCalendarEntry(event, saved.id, slug, status, publishedAt || event.scheduledFor || new Date());

  // 10. Auto-publish & distribute (only for immediately published articles)
  if (status === 'published' && !event.skipDistribution) {
    // Social & extension
    try {
      const pubResult = await autoPublishArticle(saved.id);
      console.log(`📢 [News-Orchestrator] Auto-published to: ${pubResult.channels.join(', ') || 'none'}`);
    } catch (err: any) {
      console.warn(`⚠️ [News-Orchestrator] Auto-publish failed:`, err.message);
    }

    // Newsletter to subscribers
    try {
      const nlResult = await sendArticleNewsletter(saved.id);
      console.log(`📧 [News-Orchestrator] Newsletter: ${nlResult.sent}/${nlResult.total}`);
    } catch (err: any) {
      console.warn(`⚠️ [News-Orchestrator] Newsletter failed:`, err.message);
    }

    // Industry contacts (rotated 20 daily)
    try {
      const outreach = await sendArticleToIndustryContacts(saved.id);
      console.log(`🏭 [News-Orchestrator] Industry outreach: ${outreach.sent} sent`);
    } catch (err: any) {
      console.warn(`⚠️ [News-Orchestrator] Industry outreach failed:`, err.message);
    }
  }

  console.log(`✅ [News-Orchestrator] Completed "${event.type}" for ${event.artistName} → article #${saved.id}`);
}

// ── Enrich Event Context ───────────────────────────────────────
async function enrichEventContext(event: NewsEventPayload): Promise<{
  biography: string;
  genre: string;
  songTitle?: string;
  songLyrics?: string;
  recentSongs: Array<{ title: string; lyrics?: string }>;
  profileImage?: string | null;
}> {
  let biography = event.artistBio || '';
  let genre = event.genre || '';
  let profileImage: string | null = null;
  const recentSongs: Array<{ title: string; lyrics?: string }> = [];

  // Always fetch profile image (and any missing bio/genre) for face-fidelity in cover art
  try {
    const [artist] = await db.select({
      biography: users.biography,
      genre: users.genre,
      profileImage: users.profileImage,
    }).from(users).where(eq(users.id, event.artistId)).limit(1);

    if (artist) {
      biography = biography || artist.biography || '';
      genre = genre || (artist.genre as string) || '';
      profileImage = artist.profileImage || null;
    }
  } catch { /* ok */ }

  // Fetch recent songs with lyrics for context
  try {
    const recent = await db.select({ title: songs.title, lyrics: songs.lyrics })
      .from(songs)
      .where(eq(songs.userId, event.artistId))
      .orderBy(desc(songs.createdAt))
      .limit(5);
    recentSongs.push(...recent.map(s => ({ title: s.title, lyrics: s.lyrics || undefined })));
  } catch { /* ok */ }

  // Fetch song title and lyrics if songId provided but missing
  let songTitle = event.songTitle;
  let songLyrics = event.songLyrics;
  if (event.songId && (!songTitle || !songLyrics)) {
    try {
      const [s] = await db.select({ title: songs.title, lyrics: songs.lyrics }).from(songs).where(eq(songs.id, event.songId)).limit(1);
      songTitle = songTitle || s?.title;
      songLyrics = songLyrics || s?.lyrics || undefined;
    } catch { /* ok */ }
  }

  return { biography, genre, songTitle, songLyrics, recentSongs, profileImage };
}

// ── Article Generation ─────────────────────────────────────────

/** Extract clean lyric lines from raw Lyria 3 output (removes timestamps, section tags, metadata) */
function extractCleanLyrics(rawLyrics: string | undefined, maxLines = 6): string {
  if (!rawLyrics) return '';
  const clean = rawLyrics
    .split('\n')
    .filter(line => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith('[[')) return false;        // Section tags like [[A0]]
      if (/^\[\d/.test(t)) return false;            // Timestamps like [10.0:]
      if (t.startsWith('[:')) return false;          // Continuation timestamps
      if (/^(mosic|bpm|duration|good_crop)/.test(t)) return false; // Metadata
      if (t.length < 5) return false;               // Too short
      return true;
    })
    .slice(0, maxLines)
    .join('\n');
  return clean;
}

/** Build a lyrics context block for article prompts */
function buildLyricsContext(ctx: any): string {
  const parts: string[] = [];
  
  // Current song lyrics
  if (ctx.songLyrics) {
    const clean = extractCleanLyrics(ctx.songLyrics, 8);
    if (clean) {
      parts.push(`\nSong lyrics excerpt (use these to describe the song's themes, emotions, and story — quote specific lines):\n${clean}`);
    }
  }
  
  // Other recent songs for broader context
  const otherSongs = (ctx.recentSongs || [])
    .filter((s: any) => s.lyrics && s.title !== ctx.songTitle)
    .slice(0, 2);
  if (otherSongs.length > 0) {
    const others = otherSongs.map((s: any) => {
      const excerpt = extractCleanLyrics(s.lyrics, 3);
      return excerpt ? `  "${s.title}": ${excerpt.replace(/\n/g, ' / ')}` : `  "${s.title}"`;
    }).join('\n');
    parts.push(`\nOther releases by this artist:\n${others}`);
  }
  
  return parts.join('\n');
}

const EVENT_PROMPTS: Record<NewsEventType, (e: NewsEventPayload, ctx: any) => string> = {
  song_released: (e, ctx) =>
    `Write a professional press-style news article announcing that ${e.artistName}, a ${ctx.genre} artist, has just released a new single "${ctx.songTitle || e.songTitle || 'their latest track'}". 
Artist biography: ${ctx.biography || 'An innovative artist on the Boostify platform.'}
${ctx.recentSongs.length > 1 ? `Previous releases include: ${ctx.recentSongs.slice(1).map((s: any) => s.title || s).join(', ')}` : ''}${buildLyricsContext(ctx)}
Make it feel like a Billboard or Pitchfork news piece — exciting, professional, with quotes and context.
If lyrics are provided, analyze the song's themes and emotional content to write a richer, more specific review. Quote memorable lines.`,

  artist_debut: (e, ctx) =>
    `Write an exciting debut announcement article about ${e.artistName}, a brand new ${ctx.genre} artist who has just launched on Boostify Music. 
Biography: ${ctx.biography}
First releases: ${ctx.recentSongs.map((s: any) => s.title || s).join(', ')}${buildLyricsContext(ctx)}
Frame this as a rising-star story. Mention their unique sound, artistic vision, and the automated ecosystem powering their career.
If lyrics are provided, reference specific themes and lines that showcase the artist's voice and vision.`,

  song_tokenized: (e, ctx) =>
    `Write a Web3/music industry news article about ${e.artistName} tokenizing their song "${ctx.songTitle || 'latest release'}" as an ERC-1155 token on Polygon blockchain via Boostify's BTF-2300 protocol. 
${buildLyricsContext(ctx)}
Explain what this means for fans (fractional ownership, royalty sharing) and why this is the future of music monetization.`,

  album_complete: (e, ctx) =>
    `Write a major album announcement article for ${e.artistName} who has completed a new ${ctx.genre} album "${e.albumTitle || 'their debut album'}". 
Tracklist: ${ctx.recentSongs.map((s: any) => s.title || s).join(', ')}
Biography: ${ctx.biography}${buildLyricsContext(ctx)}
Frame this as a landmark moment, discuss the creative journey and what fans can expect.
If lyrics are provided, discuss the album's thematic arc — how the songs connect to each other and tell a larger story.`,

  merch_launched: (e, ctx) =>
    `Write a lifestyle/merchandise news piece about ${e.artistName} launching their official merchandise line on Boostify's print-on-demand store. 
Describe the collection (t-shirts, hoodies, accessories with AI-generated designs that match their ${ctx.genre} aesthetic). 
Make it aspirational and collector-worthy.`,

  crowdfunding_started: (e, ctx) =>
    `Write a community-focused article about ${e.artistName} launching a crowdfunding campaign on Boostify. 
${e.details?.goal ? `Goal: $${e.details.goal}` : ''}
Explain how fans can support the artist directly and what backers will receive (exclusive content, early access, token rewards).`,

  milestone_reached: (e, ctx) =>
    `Write a celebratory article about ${e.artistName} reaching a significant milestone: ${e.details?.milestone || 'a major streaming achievement'}. 
Biography: ${ctx.biography}
Put this in context of their journey and the ${ctx.genre} scene.`,

  collaboration_announced: (e, ctx) =>
    `Write a news article about ${e.artistName} announcing a collaboration ${e.details?.collaborator ? `with ${e.details.collaborator}` : ''}. 
Genre: ${ctx.genre}. Frame the creative synergy and what fans can expect.`,

  distribution_live: (e, ctx) =>
    `Write a news article about ${e.artistName}'s music going live on major streaming platforms (Spotify, Apple Music, Amazon Music, YouTube Music, Tidal, Deezer). 
Song: "${ctx.songTitle || 'their latest release'}"${buildLyricsContext(ctx)}
Explain the multi-platform availability and how listeners can find the music everywhere.`,
};

interface GeneratedArticle {
  title: string;
  subtitle: string;
  summary: string;
  htmlContent: string;
  plainContent: string;
  tags: string[];
  readTimeMinutes: number;
  tokensUsed: number;
  promptUsed: string;
}

async function generateArticle(event: NewsEventPayload, ctx: any): Promise<GeneratedArticle> {
  const promptBuilder = EVENT_PROMPTS[event.type] || EVENT_PROMPTS.song_released;
  const eventContext = promptBuilder(event, ctx);

  const systemPrompt = `You are an elite music journalist writing for Boostify Music's official newsroom. 
Your articles appear on the platform's main News page and are distributed to industry professionals.
Write with the quality of Billboard, Pitchfork, and Rolling Stone — compelling, vivid, authoritative.
Each article should feel important and newsworthy. Use short, punchy paragraphs.
Always include at least one quoted statement (attributed to the artist or Boostify).
Reference specific Boostify technologies naturally when relevant (AI music generation, blockchain tokenization, automated distribution, merchandise, smart playlists).`;

  const userPrompt = `${eventContext}

Return a JSON object:
{
  "title": "Powerful headline, max 80 chars",
  "subtitle": "Secondary headline expanding the title, max 120 chars",
  "summary": "2-sentence preview summary, max 200 chars",
  "htmlContent": "Full article as clean HTML using <h2>, <h3>, <p>, <blockquote>, <ul>, <strong>, <em>. At least 6-8 paragraphs (500+ words). Include <!-- IMAGE_BREAK --> where a supporting image should go.",
  "tags": ["tag1", "tag2", ...5-8 tags],
  "readTimeMinutes": number
}`;

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
    temperature: 0.8,
  });

  const content = JSON.parse(response.choices[0]?.message?.content || '{}');
  const tokensUsed = response.usage?.total_tokens || 0;

  // Extract plain text from HTML for artistNews.content
  const plainContent = (content.htmlContent || '')
    .replace(/<[^>]+>/g, '')
    .replace(/<!--.*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title: content.title || `${event.artistName} — ${event.type.replace(/_/g, ' ')}`,
    subtitle: content.subtitle || '',
    summary: content.summary || plainContent.slice(0, 200),
    htmlContent: content.htmlContent || `<p>${plainContent}</p>`,
    plainContent,
    tags: [
      ...(content.tags || []),
      event.artistName.toLowerCase(),
      ctx.genre?.toLowerCase(),
    ].filter(Boolean),
    readTimeMinutes: content.readTimeMinutes || 4,
    tokensUsed,
    promptUsed: eventContext.slice(0, 500),
  };
}

// ── Cover Image Generation (centralized FAL-first service) ─────
async function generateCoverImage(
  title: string,
  event: NewsEventPayload,
): Promise<{ imageUrl: string; prompt: string; provider: 'openai' | 'fal' | 'fallback' }> {
  const imagePrompt = buildImagePrompt(title, event);

  try {
    const result = await generateNewsImage({
      title,
      artistName: event.artistName,
      genre: event.genre,
      category: event.type,
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
    console.warn('[News-Orchestrator] centralized news image generation failed:', err.message);
  }

  console.warn('[News-Orchestrator] All image providers failed — using placeholder');
  return {
    imageUrl: `https://placehold.co/1536x1024/1a1a2e/f97316?text=${encodeURIComponent(title.slice(0, 30))}`,
    prompt: imagePrompt,
    provider: 'fallback',
  };
}

function buildImagePrompt(title: string, event: NewsEventPayload): string {
  const base = `A cinematic, ultra-modern editorial cover image for a music news article titled "${title}". 
Style: Dark moody atmosphere with neon orange and deep purple accent lighting. 
Mood: Premium, editorial, magazine-quality.
No text or words in the image. 16:9 landscape composition.`;

  const typeSpecific: Record<NewsEventType, string> = {
    song_released: 'Elements: Vinyl record or digital waveform being launched, dynamic energy, musical notes exploding outward.',
    artist_debut: 'Elements: Spotlight on an empty stage, curtain rising, powerful debut moment, anticipation.',
    song_tokenized: 'Elements: Blockchain nodes connecting to musical symbols, digital tokens floating, futuristic crypto-music fusion.',
    album_complete: 'Elements: Stack of vinyl records or a golden album, celebration confetti, completion achievement.',
    merch_launched: 'Elements: Fashion-forward t-shirts and hoodies on display, streetwear aesthetic, premium merchandise showcase.',
    crowdfunding_started: 'Elements: Community of supporters, hands reaching toward a glowing music goal, funding thermometer, unity.',
    milestone_reached: 'Elements: Trophy or golden milestone marker, streaming numbers flowing, celebration fireworks.',
    collaboration_announced: 'Elements: Two microphones merging, handshake, creative sparks between two artistic energies.',
    distribution_live: 'Elements: Music notes flowing to multiple platform icons, worldwide distribution visualization, global reach.',
  };

  return `${base}\n${typeSpecific[event.type] || ''}`;
}

// ── Download & Store as Permanent Base64 ───────────────────────
async function downloadToPermanentBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const ct = resp.headers.get('content-type') || 'image/png';
    return `data:${ct};base64,${Buffer.from(buffer).toString('base64')}`;
  } catch {
    return null;
  }
}

// ── Firestore Calendar Entry ───────────────────────────────────
async function saveCalendarEntry(
  event: NewsEventPayload,
  articleId: number,
  slug: string,
  status: string,
  date: Date,
): Promise<void> {
  try {
    const admin = require('firebase-admin');
    const firestore = admin.firestore();

    // Save to artist's news calendar
    const calendarRef = firestore
      .collection('generated_artists')
      .where('postgresId', '==', event.artistId);
    const docs = await calendarRef.limit(1).get();

    if (!docs.empty) {
      const artistDoc = docs.docs[0].ref;
      await artistDoc.update({
        [`newsCalendar.article_${articleId}`]: {
          articleId,
          slug,
          type: event.type,
          title: event.songTitle || event.artistName,
          status,
          publishDate: date.toISOString(),
          createdAt: new Date().toISOString(),
        },
      });
    }

    // Also save to global news calendar collection
    await firestore.collection('news_calendar').add({
      articleId,
      slug,
      artistId: event.artistId,
      artistName: event.artistName,
      eventType: event.type,
      status,
      publishDate: admin.firestore.Timestamp.fromDate(date),
      createdAt: admin.firestore.Timestamp.now(),
    });
  } catch (err: any) {
    console.warn('[News-Orchestrator] Calendar save failed:', err.message);
  }
}

// ── Publication Calendar Generator ─────────────────────────────
/**
 * Generate a coherent news publication calendar for an artist.
 * Called after artist creation to schedule news around the release cadence.
 *
 * Release cadence:  D0 → D10 → D20
 * News calendar:    D0 (debut) → D1 (behind-the-scenes) → D10 (new single) →
 *                   D12 (tokenization) → D15 (milestone) → D20 (new single) →
 *                   D22 (merch)
 */
export function generateNewsCalendar(
  artistId: number,
  artistName: string,
  genre: string,
  biography: string,
  songTitles: string[],
  firstReleaseDate: Date,
  songLyricsMap?: Record<string, string>,
): NewsEventPayload[] {
  const events: NewsEventPayload[] = [];
  const d = (offsetDays: number) => {
    const date = new Date(firstReleaseDate);
    date.setDate(date.getDate() + offsetDays);
    // Stagger time: 10:00 AM + random 0-4h to avoid all publishing at midnight
    date.setHours(10 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60), 0, 0);
    return date;
  };

  // Helper to get lyrics for a song title
  const getLyrics = (title?: string) => title && songLyricsMap?.[title] ? songLyricsMap[title] : undefined;

  // D0: Artist debut + first single release
  events.push({
    type: 'artist_debut',
    artistId,
    artistName,
    artistBio: biography,
    genre,
    songTitle: songTitles[0],
    songLyrics: getLyrics(songTitles[0]),
    scheduledFor: d(0),
  });

  events.push({
    type: 'song_released',
    artistId,
    artistName,
    artistBio: biography,
    genre,
    songTitle: songTitles[0],
    songLyrics: getLyrics(songTitles[0]),
    scheduledFor: d(1), // Day after debut — first single spotlight
    skipDistribution: true, // Don't spam two emails on day 0-1
  });

  // D5: Tokenization announcement
  events.push({
    type: 'song_tokenized',
    artistId,
    artistName,
    artistBio: biography,
    genre,
    songTitle: songTitles[0],
    songLyrics: getLyrics(songTitles[0]),
    scheduledFor: d(5),
  });

  // D10: Second single
  if (songTitles[1]) {
    events.push({
      type: 'song_released',
      artistId,
      artistName,
      artistBio: biography,
      genre,
      songTitle: songTitles[1],
      songLyrics: getLyrics(songTitles[1]),
      scheduledFor: d(10),
    });
  }

  // D14: Merch launch
  events.push({
    type: 'merch_launched',
    artistId,
    artistName,
    artistBio: biography,
    genre,
    scheduledFor: d(14),
  });

  // D20: Third single
  if (songTitles[2]) {
    events.push({
      type: 'song_released',
      artistId,
      artistName,
      artistBio: biography,
      genre,
      songTitle: songTitles[2],
      songLyrics: getLyrics(songTitles[2]),
      scheduledFor: d(20),
    });
  }

  // D22: Album complete (if 3+ songs)
  if (songTitles.length >= 3) {
    events.push({
      type: 'album_complete',
      artistId,
      artistName,
      artistBio: biography,
      genre,
      albumTitle: `${artistName} — Debut Collection`,
      scheduledFor: d(22),
    });
  }

  // D25: Distribution live
  events.push({
    type: 'distribution_live',
    artistId,
    artistName,
    artistBio: biography,
    genre,
    songTitle: songTitles[0],
    songLyrics: getLyrics(songTitles[0]),
    scheduledFor: d(25),
  });

  return events;
}

/**
 * Schedule the full news calendar for an artist.
 * Enqueues all events immediately — the queue processes them sequentially.
 * Scheduled events get status='scheduled' and publish later.
 */
export async function scheduleArtistNewsCalendar(
  artistId: number,
  artistName: string,
  genre: string,
  biography: string,
  songTitles: string[],
  firstReleaseDate: Date,
  songLyricsMap?: Record<string, string>,
): Promise<{ total: number; scheduled: number }> {
  const events = generateNewsCalendar(artistId, artistName, genre, biography, songTitles, firstReleaseDate, songLyricsMap);

  console.log(`📅 [News-Orchestrator] Scheduling ${events.length} news articles for ${artistName}`);

  for (const event of events) {
    enqueueNewsEvent(event);
  }

  // Save calendar summary to Firestore
  try {
    const admin = require('firebase-admin');
    const firestore = admin.firestore();

    const docs = await firestore
      .collection('generated_artists')
      .where('postgresId', '==', artistId)
      .limit(1)
      .get();

    if (!docs.empty) {
      await docs.docs[0].ref.update({
        'newsCalendar.schedule': events.map((e, i) => ({
          order: i + 1,
          type: e.type,
          songTitle: e.songTitle || null,
          scheduledFor: e.scheduledFor?.toISOString() || null,
          status: 'pending',
        })),
        'newsCalendar.totalArticles': events.length,
        'newsCalendar.createdAt': new Date().toISOString(),
      });
    }
  } catch (err: any) {
    console.warn('[News-Orchestrator] Calendar summary save failed:', err.message);
  }

  return { total: events.length, scheduled: events.length };
}

// ── Scheduled Article Publisher ────────────────────────────────
/**
 * Check for scheduled articles whose scheduledFor <= now and publish them.
 * Called periodically (every 15 min from the same timer as release-publisher).
 */
export async function publishScheduledArticles(): Promise<number> {
  let published = 0;
  try {
    const now = new Date();
    const dueArticles = await db.select()
      .from(newsArticles)
      .where(eq(newsArticles.status, 'scheduled'));

    for (const article of dueArticles) {
      if (!article.scheduledFor || article.scheduledFor > now) continue;

      // Publish
      await db.update(newsArticles).set({
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(newsArticles.id, article.id));

      console.log(`📰 [News-Orchestrator] Scheduled article published: #${article.id} "${article.title}"`);

      // Auto-publish & distribute
      try {
        await autoPublishArticle(article.id);
      } catch { /* ok */ }

      try {
        await sendArticleNewsletter(article.id);
      } catch { /* ok */ }

      try {
        await sendArticleToIndustryContacts(article.id);
      } catch { /* ok */ }

      published++;

      // Cooldown between publications
      await sleep(5000);
    }
  } catch (err: any) {
    console.error('[News-Orchestrator] Scheduled publish error:', err.message);
  }
  return published;
}

// ── Helpers ────────────────────────────────────────────────────
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    + '-' + Date.now().toString(36);
}

function mapEventToArtistNewsCategory(type: NewsEventType): 'release' | 'performance' | 'collaboration' | 'achievement' | 'lifestyle' {
  const map: Record<NewsEventType, 'release' | 'performance' | 'collaboration' | 'achievement' | 'lifestyle'> = {
    song_released: 'release',
    artist_debut: 'lifestyle',
    song_tokenized: 'achievement',
    album_complete: 'release',
    merch_launched: 'lifestyle',
    crowdfunding_started: 'achievement',
    milestone_reached: 'achievement',
    collaboration_announced: 'collaboration',
    distribution_live: 'release',
  };
  return map[type] || 'release';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
