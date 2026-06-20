/**
 * Boostify News API Routes
 * 
 * Endpoints for listing, reading, generating, and managing news articles.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { newsArticles, newsGenerationLogs, newsComments, newsCommentLikes, newsReactions, newsDebates, newsDebatePositions, newsDebateVotes, users } from '../../db/schema';
import { eq, desc, and, gte, lte, gt, ilike, sql, count, asc } from 'drizzle-orm';
import { generateDailyArticle, autoPublishArticle, generateArtistNews } from '../services/news-generator';
import { sendArticleNewsletter, sendNewsDigest } from '../services/news-newsletter';
import { authenticate } from '../middleware/auth';
import sharp from 'sharp';

const router = Router();

// ── Helper: resolve req.user → pg user id (number) ──
async function resolvePgUserId(reqUser: any): Promise<number | null> {
  if (!reqUser) return null;
  // Direct numeric id
  if (typeof reqUser.id === 'number') return reqUser.id;
  if (typeof reqUser.id === 'string' && /^\d+$/.test(reqUser.id)) return parseInt(reqUser.id);
  // Try lookups by clerkId / replitId / email
  try {
    const lookups: any[] = [];
    if (reqUser.id) lookups.push(eq(users.clerkId, String(reqUser.id)), eq(users.replitId, String(reqUser.id)));
    if (reqUser.uid) lookups.push(eq(users.clerkId, String(reqUser.uid)), eq(users.replitId, String(reqUser.uid)));
    if (reqUser.email) lookups.push(eq(users.email, String(reqUser.email)));
    for (const cond of lookups) {
      const [u] = await db.select({ id: users.id }).from(users).where(cond).limit(1);
      if (u?.id) return u.id;
    }
  } catch { /* ignore */ }
  return null;
}

// Returns true when the requester is the artist who owns the article OR an admin.
async function canManageArticle(reqUser: any, articleId: number): Promise<{ allowed: boolean; reason?: string }> {
  if (!reqUser) return { allowed: false, reason: 'unauthenticated' };
  if (reqUser.isAdmin) return { allowed: true };
  const [art] = await db
    .select({ generatedBy: newsArticles.generatedBy })
    .from(newsArticles)
    .where(eq(newsArticles.id, articleId))
    .limit(1);
  if (!art) return { allowed: false, reason: 'not-found' };
  const match = (art.generatedBy || '').match(/^artist:(\d+)$/);
  if (!match) return { allowed: false, reason: 'admin-only' };
  const ownerPgId = parseInt(match[1]);
  const reqPgId = await resolvePgUserId(reqUser);
  if (reqPgId && reqPgId === ownerPgId) return { allowed: true };
  return { allowed: false, reason: 'not-owner' };
}

// ─── PUBLIC: List published articles ────────────────────────────
router.get('/articles', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 12, 50);
    const category = req.query.category as string;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    const artistId = req.query.artistId as string;

    const conditions = [eq(newsArticles.status, 'published')];
    if (category) conditions.push(eq(newsArticles.category, category));
    if (artistId) conditions.push(eq(newsArticles.generatedBy, `artist:${artistId}`));

    const articles = await db.select({
      id: newsArticles.id,
      slug: newsArticles.slug,
      title: newsArticles.title,
      subtitle: newsArticles.subtitle,
      summary: newsArticles.summary,
      coverImageUrl: newsArticles.coverImageUrl,
      category: newsArticles.category,
      tags: newsArticles.tags,
      readTimeMinutes: newsArticles.readTimeMinutes,
      publishedAt: newsArticles.publishedAt,
      views: newsArticles.views,
      likes: newsArticles.likes,
      shares: newsArticles.shares,
    }).from(newsArticles)
      .where(and(...conditions))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [{ total }] = await db.select({ total: count() })
      .from(newsArticles)
      .where(and(...conditions));

    res.json({
      success: true,
      articles,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (error: any) {
    console.error('[News API] List error:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// ─── PUBLIC: Get single article by slug ─────────────────────────
router.get('/articles/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const [article] = await db.select()
      .from(newsArticles)
      .where(and(eq(newsArticles.slug, slug), eq(newsArticles.status, 'published')))
      .limit(1);

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Increment views
    await db.update(newsArticles)
      .set({ views: sql`${newsArticles.views} + 1` })
      .where(eq(newsArticles.id, article.id));

    // Get related articles (same category, excluding current)
    const related = await db.select({
      id: newsArticles.id,
      slug: newsArticles.slug,
      title: newsArticles.title,
      summary: newsArticles.summary,
      coverImageUrl: newsArticles.coverImageUrl,
      category: newsArticles.category,
      publishedAt: newsArticles.publishedAt,
      readTimeMinutes: newsArticles.readTimeMinutes,
    }).from(newsArticles)
      .where(and(
        eq(newsArticles.status, 'published'),
        eq(newsArticles.category, article.category as any),
        sql`${newsArticles.id} != ${article.id}`
      ))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(3);

    res.json({
      success: true,
      article: { ...article, views: (article.views || 0) + 1 },
      related,
    });
  } catch (error: any) {
    console.error('[News API] Article error:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// ─── PUBLIC: Serve article cover image (for OG tags) ────────────
router.get('/articles/:id/image', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [article] = await db.select({ coverImageUrl: newsArticles.coverImageUrl, title: newsArticles.title })
      .from(newsArticles)
      .where(eq(newsArticles.id, id))
      .limit(1);

    if (!article?.coverImageUrl) {
      return res.status(404).send('Image not found');
    }

    const img = article.coverImageUrl;
    // OG mode produces an exact 1200x630 (Facebook/LinkedIn/Twitter recommended)
    // Default mode produces 1200px-wide proportional (good for newsletter + general use)
    const ogMode = req.query.og === '1' || req.query.size === 'og';
    const buildPipeline = (buf: Buffer) => {
      const pipeline = sharp(buf);
      if (ogMode) {
        return pipeline.resize({ width: 1200, height: 630, fit: 'cover', position: 'attention' })
          .jpeg({ quality: 85, progressive: true });
      }
      return pipeline.resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true });
    };

    // If it's a data URI, extract, compress with sharp, and serve as JPEG
    if (img.startsWith('data:image/')) {
      const match = img.match(/^data:image\/\w+;base64,(.+)$/);
      if (match) {
        const rawBuf = Buffer.from(match[1], 'base64');
        const compressed = await buildPipeline(rawBuf).toBuffer();
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(compressed);
      }
    }

    // If it's a URL, fetch, compress, and serve
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const imgResp = await fetch(img, { signal: controller.signal });
      clearTimeout(timeout);
      if (imgResp.ok) {
        const buf = Buffer.from(await imgResp.arrayBuffer());
        const compressed = await buildPipeline(buf).toBuffer();
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(compressed);
      }
    } catch { /* fall through */ }
    return res.redirect(img);
  } catch (error: any) {
    res.status(500).send('Error');
  }
});

// ─── PUBLIC: Like an article ────────────────────────────────────
router.post('/articles/:id/like', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(newsArticles)
      .set({ likes: sql`${newsArticles.likes} + 1` })
      .where(eq(newsArticles.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to like article' });
  }
});

// ─── PUBLIC: Share tracking ─────────────────────────────────────
router.post('/articles/:id/share', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(newsArticles)
      .set({ shares: sql`${newsArticles.shares} + 1` })
      .where(eq(newsArticles.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to track share' });
  }
});

// ─── PUBLIC: Get categories with counts ─────────────────────────
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await db.select({
      category: newsArticles.category,
      count: count(),
    }).from(newsArticles)
      .where(eq(newsArticles.status, 'published'))
      .groupBy(newsArticles.category);

    res.json({ success: true, categories });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ─── ARTIST: Generate article personalized to an artist ────────
router.post('/generate/artist', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, topic, angle, category } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const result = await generateArtistNews(Number(userId), { topic, angle, category });

    if (result.success && result.articleId) {
      const pubResult = await autoPublishArticle(result.articleId);
      return res.json({
        success: true,
        articleId: result.articleId,
        title: result.title,
        autoPublished: pubResult.channels,
      });
    }

    res.status(500).json({ success: false, error: result.error });
  } catch (error: any) {
    console.error('[News API] Artist generate error:', error);
    res.status(500).json({ error: 'Failed to generate article' });
  }
});

// ─── ADMIN: Generate article on demand ──────────────────────────
router.post('/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { topic, angle, category } = req.body;
    const override = topic && angle ? { topic, angle, category: category || 'technology' } : undefined;
    
    const result = await generateDailyArticle(override);

    if (result.success && result.articleId) {
      // Auto-publish
      const pubResult = await autoPublishArticle(result.articleId);
      return res.json({
        success: true,
        articleId: result.articleId,
        title: result.title,
        autoPublished: pubResult.channels,
      });
    }

    res.status(500).json({ success: false, error: result.error });
  } catch (error: any) {
    console.error('[News API] Generate error:', error);
    res.status(500).json({ error: 'Failed to generate article' });
  }
});

// ─── ADMIN: Send newsletter for specific article ─────────────────
router.post('/newsletter/send', authenticate, async (req: Request, res: Response) => {
  try {
    const { articleId, emails } = req.body;
    if (!articleId) {
      return res.status(400).json({ error: 'articleId is required' });
    }
    const result = await sendArticleNewsletter(parseInt(articleId), emails);
    res.json(result);
  } catch (error: any) {
    console.error('[News API] Newsletter send error:', error);
    res.status(500).json({ error: 'Failed to send newsletter' });
  }
});

// ─── ADMIN: Send digest of latest articles ───────────────────────
router.post('/newsletter/digest', authenticate, async (req: Request, res: Response) => {
  try {
    const { days, emails } = req.body;
    const result = await sendNewsDigest(days || 7, emails);
    res.json(result);
  } catch (error: any) {
    console.error('[News API] Digest send error:', error);
    res.status(500).json({ error: 'Failed to send digest' });
  }
});

// ─── ADMIN: Get generation logs ─────────────────────────────────
router.get('/logs', authenticate, async (_req: Request, res: Response) => {
  try {
    const logs = await db.select()
      .from(newsGenerationLogs)
      .orderBy(desc(newsGenerationLogs.generatedAt))
      .limit(50);

    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ─── ADMIN: Update article status ───────────────────────────────
router.patch('/articles/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updates: any = { status, updatedAt: new Date() };
    if (status === 'published' && !req.body.keepDate) {
      updates.publishedAt = new Date();
    }

    await db.update(newsArticles).set(updates).where(eq(newsArticles.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// ─── ADMIN/OWNER: Delete article ───────────────────────────────
router.delete('/articles/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const perm = await canManageArticle((req as any).user, id);
    if (!perm.allowed) {
      const code = perm.reason === 'not-found' ? 404 : 403;
      return res.status(code).json({ error: perm.reason || 'Not allowed' });
    }
    await db.delete(newsArticles).where(eq(newsArticles.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// ─── ADMIN: Force auto-publish an existing article ──────────────
router.post('/articles/:id/publish', authenticate, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await autoPublishArticle(id);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to publish article' });
  }
});

// ─── ADMIN/OWNER: Full article edit (title, subtitle, summary, htmlContent, tags, category, coverImageUrl) ──
router.put('/articles/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const perm = await canManageArticle((req as any).user, id);
    if (!perm.allowed) {
      const code = perm.reason === 'not-found' ? 404 : 403;
      return res.status(code).json({ error: perm.reason || 'Not allowed' });
    }
    const allowed = ['title', 'subtitle', 'summary', 'htmlContent', 'tags', 'category', 'coverImageUrl', 'readTimeMinutes', 'slug', 'status'];
    const updates: any = { updatedAt: new Date() };
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
    await db.update(newsArticles).set(updates).where(eq(newsArticles.id, id));
    const [updated] = await db.select().from(newsArticles).where(eq(newsArticles.id, id)).limit(1);
    res.json({ success: true, article: updated });
  } catch (error: any) {
    console.error('[News API] Update error:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// ─── ADMIN: Regenerate cover image (artist-coherent when possible) ──
router.post('/articles/:id/regenerate-image', authenticate, async (req: Request, res: Response) => {
  try {
    const { generateNewsImage } = await import('../services/news-image-generator');
    const id = parseInt(req.params.id);
    const [article] = await db.select().from(newsArticles).where(eq(newsArticles.id, id)).limit(1);
    if (!article) return res.status(404).json({ error: 'Article not found' });

    // Try to resolve artist context if generatedBy === artist:<userId>
    let artistName = 'Boostify Artist';
    let genre: string | null = null;
    let referenceImageUrl: string | null = null;
    const m = (article.generatedBy || '').match(/^artist:(\d+)$/);
    if (m) {
      const userId = Number(m[1]);
      const [u] = await db.select({
        artistName: users.artistName,
        masterJson: users.masterJson,
        profileImage: users.profileImage,
        profileImageUrl: users.profileImageUrl,
      }).from(users).where(eq(users.id, userId)).limit(1);
      if (u) {
        const mj: any = u.masterJson || {};
        artistName = u.artistName || mj?.canonical?.artist_name || artistName;
        genre = mj?.canonical?.primary_genre || mj?.musical_dna?.genre_tags?.[0] || null;
        referenceImageUrl = u.profileImage || u.profileImageUrl || mj?.master_design_url || null;
      }
    }

    const result = await generateNewsImage({
      title: article.title,
      artistName: req.body?.artistName || artistName,
      genre: req.body?.genre || genre,
      category: article.category,
      context: req.body?.context || article.summary,
      referenceImageUrl: req.body?.referenceImageUrl ?? referenceImageUrl,
      aspectRatio: '16:9',
    });

    await db.update(newsArticles)
      .set({
        coverImageUrl: result.imageUrl,
        coverImagePrompt: result.prompt,
        imageProvider: (result.provider.startsWith('fal') ? 'fal' : result.provider.startsWith('openai') ? 'openai' : 'fallback') as any,
        updatedAt: new Date(),
      })
      .where(eq(newsArticles.id, id));

    res.json({ success: true, imageUrl: result.imageUrl, provider: result.provider });
  } catch (error: any) {
    console.error('[News API] Regenerate image error:', error);
    res.status(500).json({ error: 'Failed to regenerate image', message: error?.message });
  }
});

// ─── ADMIN: Regenerate full content for an artist article (keeps slug + id) ──
router.post('/articles/:id/regenerate-content', authenticate, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [article] = await db.select().from(newsArticles).where(eq(newsArticles.id, id)).limit(1);
    if (!article) return res.status(404).json({ error: 'Article not found' });

    const m = (article.generatedBy || '').match(/^artist:(\d+)$/);
    if (!m) return res.status(400).json({ error: 'Only artist articles support regenerate-content. Use the /generate endpoint for general topics.' });

    const userId = Number(m[1]);
    const result = await generateArtistNews(userId, {
      topic: req.body?.topic,
      angle: req.body?.angle,
      category: article.category as any,
    });
    if (!result.success || !result.articleId) return res.status(500).json({ error: result.error || 'Generation failed' });

    // Copy NEW article's content into the existing article and delete the duplicate
    const [fresh] = await db.select().from(newsArticles).where(eq(newsArticles.id, result.articleId)).limit(1);
    if (fresh) {
      await db.update(newsArticles)
        .set({
          title: fresh.title,
          subtitle: fresh.subtitle,
          summary: fresh.summary,
          htmlContent: fresh.htmlContent,
          coverImageUrl: fresh.coverImageUrl,
          coverImagePrompt: fresh.coverImagePrompt,
          imageProvider: fresh.imageProvider,
          tags: fresh.tags,
          readTimeMinutes: fresh.readTimeMinutes,
          aiModel: fresh.aiModel,
          updatedAt: new Date(),
        })
        .where(eq(newsArticles.id, id));
      await db.delete(newsArticles).where(eq(newsArticles.id, fresh.id));
    }

    const [updated] = await db.select().from(newsArticles).where(eq(newsArticles.id, id)).limit(1);
    res.json({ success: true, article: updated });
  } catch (error: any) {
    console.error('[News API] Regenerate content error:', error);
    res.status(500).json({ error: 'Failed to regenerate content', message: error?.message });
  }
});

// ─── PUBLIC: Server-rendered SHARE PAGE with full OG/Twitter meta tags ──
// Use this URL when sharing on Facebook/LinkedIn/Twitter for rich embeds.
// Path: /api/news/share/:slug   (also mounted as /news-share/:slug below)
function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

router.get('/share/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const [article] = await db.select()
      .from(newsArticles)
      .where(and(eq(newsArticles.slug, slug), eq(newsArticles.status, 'published')))
      .limit(1);
    if (!article) {
      res.status(404).set('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><meta charset="utf-8"><title>Not found</title><h1>Article not found</h1>');
      return;
    }

    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
    const base = `${proto}://${host}`;
    const articleUrl = `${base}/news?article=${encodeURIComponent(article.slug)}`;
    const ogImage = `${base}/api/news/articles/${article.id}/image?og=1`;
    const title = escapeHtml(article.title);
    const desc = escapeHtml(article.summary || article.subtitle || `Read "${article.title}" on Boostify Music.`);
    const publishedTime = article.publishedAt ? new Date(article.publishedAt).toISOString() : '';
    const tags = (article.tags || []).map((t: string) => `<meta property="article:tag" content="${escapeHtml(t)}" />`).join('');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Boostify News</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${articleUrl}" />

<!-- Open Graph -->
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Boostify Music" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${articleUrl}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:secure_url" content="${ogImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${title}" />
${publishedTime ? `<meta property="article:published_time" content="${publishedTime}" />` : ''}
${article.category ? `<meta property="article:section" content="${escapeHtml(article.category)}" />` : ''}
${tags}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@boostifymusic" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${ogImage}" />

<!-- JSON-LD -->
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'NewsArticle',
  headline: article.title,
  description: article.summary || article.subtitle || '',
  image: [ogImage],
  datePublished: publishedTime || undefined,
  dateModified: article.updatedAt ? new Date(article.updatedAt).toISOString() : undefined,
  author: { '@type': 'Organization', name: 'Boostify Music' },
  publisher: {
    '@type': 'Organization',
    name: 'Boostify Music',
    logo: { '@type': 'ImageObject', url: `${base}/logo.png` },
  },
  mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
  articleSection: article.category || undefined,
  keywords: (article.tags || []).join(', ') || undefined,
})}
</script>

<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif; background: #0a0a0a; color: #f5f5f5; }
.wrap { max-width: 760px; margin: 0 auto; padding: 32px 20px 80px; }
.brand { display: flex; align-items: center; gap: 10px; color: #f97316; font-weight: 700; letter-spacing: .02em; margin-bottom: 24px; }
.brand .dot { width: 10px; height: 10px; border-radius: 50%; background: #f97316; }
h1 { font-size: clamp(28px, 4vw, 44px); line-height: 1.15; margin: 0 0 14px; }
.subtitle { color: #d4d4d4; font-size: 18px; margin: 0 0 18px; }
.meta { color: #9ca3af; font-size: 13px; margin: 0 0 28px; display: flex; gap: 14px; flex-wrap: wrap; }
.meta .pill { background: rgba(249,115,22,.12); color: #f97316; padding: 4px 10px; border-radius: 999px; }
.cover { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 16px; display: block; margin: 0 0 28px; box-shadow: 0 30px 60px -30px rgba(249,115,22,.4); }
.body :is(h2,h3) { color: #fff; margin-top: 1.6em; }
.body p { color: #e5e5e5; }
.body a { color: #fb923c; }
.body img { max-width: 100%; border-radius: 12px; margin: 1.5rem 0; }
.body blockquote { border-left: 3px solid #f97316; margin: 1.5rem 0; padding: .25rem 0 .25rem 1rem; color: #f5f5f5; }
.cta { margin-top: 40px; text-align: center; }
.cta a { background: #f97316; color: #0a0a0a; text-decoration: none; padding: 14px 26px; border-radius: 999px; font-weight: 700; display: inline-block; }
footer { color: #6b7280; text-align: center; margin-top: 60px; font-size: 13px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand"><span class="dot"></span> BOOSTIFY NEWS</div>
  <h1>${title}</h1>
  ${article.subtitle ? `<p class="subtitle">${escapeHtml(article.subtitle)}</p>` : ''}
  <div class="meta">
    ${article.category ? `<span class="pill">${escapeHtml(String(article.category))}</span>` : ''}
    ${publishedTime ? `<span>${new Date(publishedTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>` : ''}
    ${article.readTimeMinutes ? `<span>${article.readTimeMinutes} min read</span>` : ''}
  </div>
  <img class="cover" src="${ogImage}" alt="${title}" />
  <div class="body">${article.htmlContent || ''}</div>
  <div class="cta"><a href="${articleUrl}">Read on Boostify →</a></div>
  <footer>© ${new Date().getFullYear()} Boostify Music · AI-powered music platform</footer>
</div>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.send(html);
  } catch (error: any) {
    console.error('[News API] Share page error:', error);
    res.status(500).set('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><meta charset="utf-8"><title>Error</title><h1>Server error</h1>');
  }
});

// ═══════════════════════════════════════════════════════════════
// NEWS INTERACTIONS — Comments, Reactions & Debates
// ═══════════════════════════════════════════════════════════════

// Helper: resolve numeric user ID from auth (Clerk sends string)
async function resolveUserId(authId: string | number): Promise<number | null> {
  if (typeof authId === 'number') return authId;
  const [user] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, authId))
    .limit(1);
  return user?.id ?? null;
}

// ─── COMMENTS: Get comments for an article ──────────────────────
router.get('/articles/:id/comments', async (req: Request, res: Response) => {
  try {
    const articleId = parseInt(req.params.id);
    const comments = await db.select({
      id: newsComments.id,
      articleId: newsComments.articleId,
      userId: newsComments.userId,
      parentId: newsComments.parentId,
      content: newsComments.content,
      likes: newsComments.likes,
      isPinned: newsComments.isPinned,
      isEdited: newsComments.isEdited,
      createdAt: newsComments.createdAt,
      userName: users.username,
      userImage: users.profileImage,
      artistName: users.artistName,
    }).from(newsComments)
      .leftJoin(users, eq(newsComments.userId, users.id))
      .where(and(
        eq(newsComments.articleId, articleId),
        eq(newsComments.status, 'active')
      ))
      .orderBy(desc(newsComments.isPinned), asc(newsComments.createdAt));

    res.json({ success: true, comments });
  } catch (error: any) {
    console.error('[News API] Comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// ─── COMMENTS: Post a comment ───────────────────────────────────
router.post('/articles/:id/comments', authenticate, async (req: Request, res: Response) => {
  try {
    const articleId = parseInt(req.params.id);
    const { content, parentId } = req.body;
    const authId = (req.user as any)?.id;
    if (!authId) return res.status(401).json({ error: 'Not authenticated' });
    if (!content || content.trim().length === 0) return res.status(400).json({ error: 'Content is required' });
    if (content.length > 2000) return res.status(400).json({ error: 'Comment too long (max 2000 chars)' });

    const userId = await resolveUserId(authId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const [comment] = await db.insert(newsComments).values({
      articleId,
      userId,
      parentId: parentId ? parseInt(parentId) : null,
      content: content.trim(),
    }).returning();

    // Get user info for response
    const [user] = await db.select({
      userName: users.username,
      userImage: users.profileImage,
      artistName: users.artistName,
    }).from(users).where(eq(users.id, userId)).limit(1);

    res.json({ success: true, comment: { ...comment, ...user } });
  } catch (error: any) {
    console.error('[News API] Post comment error:', error);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// ─── COMMENTS: Like a comment ───────────────────────────────────
router.post('/comments/:id/like', authenticate, async (req: Request, res: Response) => {
  try {
    const commentId = parseInt(req.params.id);
    const authId = (req.user as any)?.id;
    if (!authId) return res.status(401).json({ error: 'Not authenticated' });

    const userId = await resolveUserId(authId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    // Check if already liked
    const [existing] = await db.select({ id: newsCommentLikes.id })
      .from(newsCommentLikes)
      .where(and(eq(newsCommentLikes.commentId, commentId), eq(newsCommentLikes.userId, userId)))
      .limit(1);

    if (existing) {
      // Unlike
      await db.delete(newsCommentLikes).where(eq(newsCommentLikes.id, existing.id));
      await db.update(newsComments)
        .set({ likes: sql`GREATEST(${newsComments.likes} - 1, 0)` })
        .where(eq(newsComments.id, commentId));
      return res.json({ success: true, liked: false });
    }

    await db.insert(newsCommentLikes).values({ commentId, userId });
    await db.update(newsComments)
      .set({ likes: sql`${newsComments.likes} + 1` })
      .where(eq(newsComments.id, commentId));
    res.json({ success: true, liked: true });
  } catch (error: any) {
    console.error('[News API] Like comment error:', error);
    res.status(500).json({ error: 'Failed to like comment' });
  }
});

// ─── REACTIONS: Get reactions for an article ────────────────────
router.get('/articles/:id/reactions', async (req: Request, res: Response) => {
  try {
    const articleId = parseInt(req.params.id);
    const reactions = await db.select({
      reaction: newsReactions.reaction,
      count: count(),
    }).from(newsReactions)
      .where(eq(newsReactions.articleId, articleId))
      .groupBy(newsReactions.reaction);

    res.json({ success: true, reactions });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

// ─── REACTIONS: Add/toggle reaction ─────────────────────────────
router.post('/articles/:id/reactions', authenticate, async (req: Request, res: Response) => {
  try {
    const articleId = parseInt(req.params.id);
    const { reaction } = req.body;
    const authId = (req.user as any)?.id;
    if (!authId) return res.status(401).json({ error: 'Not authenticated' });

    const validReactions = ['fire', 'lightbulb', 'music', 'clap', 'rocket'];
    if (!validReactions.includes(reaction)) return res.status(400).json({ error: 'Invalid reaction' });

    const userId = await resolveUserId(authId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    // Check if already reacted with same reaction
    const [existing] = await db.select({ id: newsReactions.id })
      .from(newsReactions)
      .where(and(
        eq(newsReactions.articleId, articleId),
        eq(newsReactions.userId, userId),
        eq(newsReactions.reaction, reaction)
      ))
      .limit(1);

    if (existing) {
      await db.delete(newsReactions).where(eq(newsReactions.id, existing.id));
      return res.json({ success: true, added: false });
    }

    await db.insert(newsReactions).values({ articleId, userId, reaction });
    res.json({ success: true, added: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

// ─── DEBATES: Get debates for an article ────────────────────────
router.get('/articles/:id/debates', async (req: Request, res: Response) => {
  try {
    const articleId = parseInt(req.params.id);
    const debates = await db.select({
      id: newsDebates.id,
      topic: newsDebates.topic,
      description: newsDebates.description,
      status: newsDebates.status,
      participantCount: newsDebates.participantCount,
      createdAt: newsDebates.createdAt,
      closesAt: newsDebates.closesAt,
      createdByName: users.artistName,
      createdByImage: users.profileImage,
    }).from(newsDebates)
      .leftJoin(users, eq(newsDebates.createdBy, users.id))
      .where(eq(newsDebates.articleId, articleId))
      .orderBy(desc(newsDebates.createdAt));

    // For each debate, get positions with counts
    const debatesWithPositions = await Promise.all(debates.map(async (debate) => {
      const positions = await db.select({
        id: newsDebatePositions.id,
        stance: newsDebatePositions.stance,
        argument: newsDebatePositions.argument,
        votes: newsDebatePositions.votes,
        createdAt: newsDebatePositions.createdAt,
        userName: users.artistName,
        userImage: users.profileImage,
      }).from(newsDebatePositions)
        .leftJoin(users, eq(newsDebatePositions.userId, users.id))
        .where(eq(newsDebatePositions.debateId, debate.id))
        .orderBy(desc(newsDebatePositions.votes));

      const proCount = positions.filter(p => p.stance === 'pro').length;
      const conCount = positions.filter(p => p.stance === 'con').length;
      const proVotes = positions.filter(p => p.stance === 'pro').reduce((s, p) => s + (p.votes || 0), 0);
      const conVotes = positions.filter(p => p.stance === 'con').reduce((s, p) => s + (p.votes || 0), 0);

      return { ...debate, positions, proCount, conCount, proVotes, conVotes };
    }));

    res.json({ success: true, debates: debatesWithPositions });
  } catch (error: any) {
    console.error('[News API] Debates error:', error);
    res.status(500).json({ error: 'Failed to fetch debates' });
  }
});

// ─── DEBATES: Create a debate ───────────────────────────────────
router.post('/articles/:id/debates', authenticate, async (req: Request, res: Response) => {
  try {
    const articleId = parseInt(req.params.id);
    const { topic, description } = req.body;
    const authId = (req.user as any)?.id;
    if (!authId) return res.status(401).json({ error: 'Not authenticated' });
    if (!topic || topic.trim().length === 0) return res.status(400).json({ error: 'Topic is required' });
    if (topic.length > 200) return res.status(400).json({ error: 'Topic too long (max 200 chars)' });

    const userId = await resolveUserId(authId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const [debate] = await db.insert(newsDebates).values({
      articleId,
      topic: topic.trim(),
      description: description?.trim() || null,
      createdBy: userId,
    }).returning();

    res.json({ success: true, debate });
  } catch (error: any) {
    console.error('[News API] Create debate error:', error);
    res.status(500).json({ error: 'Failed to create debate' });
  }
});

// ─── DEBATES: Add a position/argument ───────────────────────────
router.post('/debates/:id/positions', authenticate, async (req: Request, res: Response) => {
  try {
    const debateId = parseInt(req.params.id);
    const { stance, argument } = req.body;
    const authId = (req.user as any)?.id;
    if (!authId) return res.status(401).json({ error: 'Not authenticated' });
    if (!['pro', 'con'].includes(stance)) return res.status(400).json({ error: 'Stance must be pro or con' });
    if (!argument || argument.trim().length === 0) return res.status(400).json({ error: 'Argument is required' });
    if (argument.length > 1000) return res.status(400).json({ error: 'Argument too long (max 1000 chars)' });

    const userId = await resolveUserId(authId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const [position] = await db.insert(newsDebatePositions).values({
      debateId,
      userId,
      stance,
      argument: argument.trim(),
    }).returning();

    // Increment participant count
    await db.update(newsDebates)
      .set({ participantCount: sql`${newsDebates.participantCount} + 1` })
      .where(eq(newsDebates.id, debateId));

    const [user] = await db.select({
      userName: users.artistName,
      userImage: users.profileImage,
    }).from(users).where(eq(users.id, userId)).limit(1);

    res.json({ success: true, position: { ...position, ...user } });
  } catch (error: any) {
    console.error('[News API] Add position error:', error);
    res.status(500).json({ error: 'Failed to add position' });
  }
});

// ─── DEBATES: Vote on a position ────────────────────────────────
router.post('/positions/:id/vote', authenticate, async (req: Request, res: Response) => {
  try {
    const positionId = parseInt(req.params.id);
    const authId = (req.user as any)?.id;
    if (!authId) return res.status(401).json({ error: 'Not authenticated' });

    const userId = await resolveUserId(authId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    // Check if already voted
    const [existing] = await db.select({ id: newsDebateVotes.id })
      .from(newsDebateVotes)
      .where(and(eq(newsDebateVotes.positionId, positionId), eq(newsDebateVotes.userId, userId)))
      .limit(1);

    if (existing) {
      await db.delete(newsDebateVotes).where(eq(newsDebateVotes.id, existing.id));
      await db.update(newsDebatePositions)
        .set({ votes: sql`GREATEST(${newsDebatePositions.votes} - 1, 0)` })
        .where(eq(newsDebatePositions.id, positionId));
      return res.json({ success: true, voted: false });
    }

    await db.insert(newsDebateVotes).values({ positionId, userId });
    await db.update(newsDebatePositions)
      .set({ votes: sql`${newsDebatePositions.votes} + 1` })
      .where(eq(newsDebatePositions.id, positionId));
    res.json({ success: true, voted: true });
  } catch (error: any) {
    console.error('[News API] Vote error:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// ─── DEBATES: Auto-generate debate for an article ───────────────
router.post('/articles/:id/debates/generate', async (req: Request, res: Response) => {
  try {
    const articleId = parseInt(req.params.id);
    const [article] = await db.select().from(newsArticles).where(eq(newsArticles.id, articleId)).limit(1);
    if (!article) return res.status(404).json({ error: 'Article not found' });

    const { generateNewsDebate } = await import('../agents/social-agent');
    const result = await generateNewsDebate({
      id: article.id,
      title: article.title,
      summary: article.summary || '',
      category: article.category || 'general',
      tags: article.tags as string[] || [],
    });

    res.json({ success: true, debateContributions: result });
  } catch (error: any) {
    console.error('[News API] Generate debate error:', error);
    res.status(500).json({ error: 'Failed to generate debate' });
  }
});

// ─── DEBATES: Auto-generate debates for all recent articles ─────
router.post('/debates/generate-all', async (req: Request, res: Response) => {
  try {
    // Get articles from last 7 days that don't have debates yet
    const recentArticles = await db.select({
      id: newsArticles.id,
      title: newsArticles.title,
      summary: newsArticles.summary,
      category: newsArticles.category,
      tags: newsArticles.tags,
    }).from(newsArticles)
      .where(gt(newsArticles.publishedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(10);

    const { generateNewsDebate } = await import('../agents/social-agent');
    let totalGenerated = 0;

    for (const article of recentArticles) {
      // Check if debate already exists
      const [existing] = await db.select({ id: newsDebates.id })
        .from(newsDebates)
        .where(eq(newsDebates.articleId, article.id))
        .limit(1);

      if (existing) continue;

      const result = await generateNewsDebate({
        id: article.id,
        title: article.title,
        summary: article.summary || '',
        category: article.category || 'general',
        tags: article.tags as string[] || [],
      });

      totalGenerated += result;
    }

    res.json({ success: true, articlesProcessed: recentArticles.length, totalDebateContributions: totalGenerated });
  } catch (error: any) {
    console.error('[News API] Generate all debates error:', error);
    res.status(500).json({ error: 'Failed to generate debates' });
  }
});

export default router;
