/**
 * Boostify News Newsletter Service
 * Sends beautifully formatted news articles via Brevo email
 * Designed for music industry distribution
 */

import { db } from '../db';
import { newsArticles, newsletterOutreachLog } from '../../db/schema';
import { eq, desc, gte, notInArray, inArray } from 'drizzle-orm';
import sharp from 'sharp';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL = 'news@boostifymusic.site';
const FROM_NAME = 'Boostify News';
const SITE_URL = 'https://boostifymusic.com';

// Default newsletter recipients (add more as needed)
const NEWSLETTER_RECIPIENTS = [
  'convoycubano@gmail.com',
];

interface NewsletterArticle {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  htmlContent: string | null;
  coverImageUrl: string | null;
  category: string | null;
  tags: string[] | null;
  readTimeMinutes: number | null;
  publishedAt: Date | null;
}

function getCategoryLabel(category: string | null): string {
  const labels: Record<string, string> = {
    'technology': 'Technology',
    'innovation': 'Innovation',
    'autonomous-artists': 'Autonomous Artists',
    'web3': 'Web3 & Blockchain',
    'ai-music': 'AI Music',
    'platform-updates': 'Platform Updates',
    'industry-vision': 'Industry Vision',
    'partnerships': 'Partnerships',
    'artist-news': 'Artist News',
  };
  return labels[category || ''] || 'News';
}

function getCategoryColor(category: string | null): string {
  const colors: Record<string, string> = {
    'technology': '#3B82F6',
    'innovation': '#A855F7',
    'autonomous-artists': '#F97316',
    'web3': '#10B981',
    'ai-music': '#F59E0B',
    'platform-updates': '#6366F1',
    'industry-vision': '#F43F5E',
    'partnerships': '#8B5CF6',
    'artist-news': '#EC4899',
  };
  return colors[category || ''] || '#F97316';
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getArticlePreview(html: string | null, maxLength: number = 300): string {
  if (!html) return '';
  const text = stripHtmlToText(html);
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
}

function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface EmailAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
  contentId: string;
}

/**
 * Compress the article cover image to a ~100KB JPEG buffer for inline email attachment.
 * This avoids any external server dependency — the image travels inside the email.
 */
async function getCompressedCoverBuffer(coverImageUrl: string | null): Promise<Buffer | null> {
  if (!coverImageUrl) return null;
  try {
    let rawBuf: Buffer;
    if (coverImageUrl.startsWith('data:image/')) {
      const base64Data = coverImageUrl.split(',')[1];
      if (!base64Data) return null;
      rawBuf = Buffer.from(base64Data, 'base64');
    } else if (coverImageUrl.startsWith('http')) {
      const resp = await fetch(coverImageUrl, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) return null;
      rawBuf = Buffer.from(await resp.arrayBuffer());
    } else {
      return null;
    }
    return await sharp(rawBuf)
      .resize({ width: 820, withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
  } catch (e: any) {
    console.warn('[Newsletter] Could not compress cover image:', e.message);
    return null;
  }
}

function buildSingleArticleEmail(article: NewsletterArticle, coverSrc?: string): string {
  const categoryLabel = getCategoryLabel(article.category);
  const categoryColor = getCategoryColor(article.category);
  const articleUrl = `${SITE_URL}/news?article=${article.slug}`;
  const date = formatDate(article.publishedAt);
  const tags = (article.tags || []).slice(0, 8);
  // Use the pre-compressed inline CID image if available; otherwise fall back to server URL
  const imageUrl = coverSrc || `${SITE_URL}/api/news/articles/${article.id}/image`;
  const founderImg = `${SITE_URL}/images/founder.webp`;

  // Strip only images/scripts from body; keep all other HTML intact for the <style> block to style
  const bodyHtml = (article.htmlContent || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>${article.title} — Boostify News</title>
  <style>
    /* ── Reset ── */
    body { margin:0; padding:0; background:#0a0a0a; color:#e2e8f0; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; -webkit-font-smoothing:antialiased; }
    a { color:#f97316; text-decoration:none; }
    img { border:0; display:block; }

    /* ── Article body — mirrors the web prose styles ── */
    .ab h1,.ab h2,.ab h3,.ab h4,.ab h5,.ab h6 {
      font-weight:800; letter-spacing:-0.02em; color:#f97316; line-height:1.25; margin:2.5rem 0 1rem;
    }
    .ab h2 { font-size:26px; border-bottom:3px solid; border-image:linear-gradient(90deg,#f97316,#fbbf24,transparent) 1; padding-bottom:12px; }
    .ab h3 { font-size:22px; color:#fb923c; }
    .ab h4 { font-size:18px; color:#f97316; }
    .ab p  { font-size:17px; line-height:2; color:#9ca3af; margin:0 0 1.75rem; }
    .ab p:first-of-type { font-size:19px; line-height:2; color:#e2e8f0; font-weight:500; }
    .ab p:first-of-type::first-letter {
      font-size:4.5rem; font-weight:800; float:left; line-height:0.75; margin-right:8px; margin-top:6px;
      color:#f97316;
    }
    .ab strong,.ab b { color:#f97316 !important; font-weight:700; }
    .ab em,.ab i { color:#b0b7c3; font-style:italic; }
    .ab a { color:#f97316; border-bottom:1px solid rgba(249,115,22,.35); padding-bottom:1px; }
    .ab ul,.ab ol { margin:1.5rem 0 2rem; padding-left:1.75rem; }
    .ab li { font-size:16.5px; line-height:1.8; color:#9ca3af; margin-bottom:10px; }
    .ab li::marker { color:#f97316; }
    .ab blockquote {
      border-left:4px solid #f97316; background:rgba(249,115,22,.06);
      padding:1.5rem 2rem; margin:2.5rem 0; border-radius:0 12px 12px 0;
      font-size:17px; font-weight:500; line-height:1.8; color:#e2e8f0;
    }
    .ab blockquote p { margin:0; color:#e2e8f0; font-size:17px; }
    .ab hr { border:none; height:1px; background:linear-gradient(90deg,transparent,rgba(249,115,22,.4),transparent); margin:2.5rem 0; }
    .ab code { background:#1f2937; padding:2px 7px; border-radius:6px; font-family:monospace; font-size:14px; color:#fbbf24; }
    .ab pre  { background:#111827; border-radius:12px; padding:20px; overflow-x:auto; margin:0 0 1.75rem; }
    .ab pre code { background:none; padding:0; color:#e2e8f0; }
  </style>
</head>
<body>
<div style="background:#0a0a0a;min-height:100vh;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:820px;width:100%;">

  <!-- ── NAV ──────────────────────────────────────────── -->
  <tr><td style="background:#111111;border-bottom:1px solid #1f2937;padding:18px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">
        <span style="color:#f97316;">⚡</span>&nbsp;BOOSTIFY
        <span style="font-size:10px;font-weight:700;color:#f97316;letter-spacing:2.5px;vertical-align:middle;margin-left:6px;">NEWS</span>
      </td>
      <td style="text-align:right;">
        <a href="${SITE_URL}/news" style="color:#f97316;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">All Articles →</a>
      </td>
    </tr></table>
  </td></tr>

  <!-- ── GRADIENT HEADER (mirrors web article header) ── -->
  <tr><td style="background:linear-gradient(135deg,#111827 0%,#1f2937 50%,#111827 100%);padding:48px 40px 40px;position:relative;border-bottom:1px solid #1f2937;">
    <!-- Category badge -->
    <div style="margin-bottom:20px;">
      <span style="display:inline-block;padding:6px 18px;border-radius:20px;background:rgba(255,255,255,.08);color:#fdba74;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:1px solid rgba(249,115,22,.25);">
        ${categoryLabel}
      </span>
    </div>
    <!-- Title -->
    <h1 style="margin:0 0 16px;font-size:36px;font-weight:900;line-height:1.15;color:#ffffff;letter-spacing:-0.5px;max-width:680px;">
      <a href="${articleUrl}" style="color:#ffffff;text-decoration:none;">${article.title}</a>
    </h1>
    <!-- Subtitle -->
    ${article.subtitle ? `<p style="margin:0 0 28px;font-size:19px;color:rgba(255,255,255,.55);line-height:1.55;max-width:580px;font-weight:400;">${article.subtitle}</p>` : ''}
    <!-- Author row -->
    <table cellpadding="0" cellspacing="0"><tr style="vertical-align:middle;">
      <td style="padding-right:12px;">
        <img src="${founderImg}" alt="Neiver Alvarez" width="38" height="38"
          style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid rgba(249,115,22,.4);" />
      </td>
      <td style="padding-right:20px;">
        <div style="font-size:14px;font-weight:700;color:#ffffff;">Neiver Alvarez</div>
        <div style="font-size:12px;color:rgba(255,255,255,.4);">CEO &amp; Founder</div>
      </td>
      <td style="padding-right:16px;color:rgba(255,255,255,.25);font-size:14px;">|</td>
      <td style="padding-right:16px;font-size:13px;color:rgba(255,255,255,.45);">📅 ${date}</td>
      <td style="font-size:13px;color:rgba(255,255,255,.45);">📖 ${article.readTimeMinutes || 5} min read</td>
    </tr></table>
  </td></tr>

  <!-- ── COVER IMAGE ──────────────────────────────────── -->
  <tr><td style="padding:0;line-height:0;background:#111827;">
    <a href="${articleUrl}">
      <img src="${imageUrl}" alt="${article.title.replace(/"/g, '&quot;')}" width="820"
        style="width:100%;max-width:820px;height:auto;display:block;" />
    </a>
  </td></tr>

  <!-- ── ARTICLE BODY ─────────────────────────────────── -->
  <tr><td style="background:#0d0d0d;padding:48px 40px 32px;">
    <div class="ab">
      ${bodyHtml}
    </div>
  </td></tr>

  <!-- ── CTA ──────────────────────────────────────────── -->
  <tr><td style="background:#0d0d0d;padding:8px 40px 48px;text-align:center;">
    <a href="${articleUrl}"
      style="display:inline-block;padding:18px 52px;background:linear-gradient(135deg,#f97316 0%,#f59e0b 100%);color:#fff;font-size:16px;font-weight:800;text-decoration:none;border-radius:14px;letter-spacing:.5px;">
      Read Full Article on Boostify →
    </a>
  </td></tr>

  <!-- ── AUTHOR SIGN-OFF ──────────────────────────────── -->
  <tr><td style="background:#0d0d0d;padding:0 40px 48px;">
    <div style="background:linear-gradient(135deg,rgba(249,115,22,.2) 0%,rgba(245,158,11,.1) 100%);border:1px solid rgba(249,115,22,.25);border-radius:16px;padding:28px 32px;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr style="vertical-align:top;">
        <td width="72" style="padding-right:20px;">
          <img src="${founderImg}" alt="Neiver Alvarez" width="64" height="64"
            style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid rgba(249,115,22,.4);" />
        </td>
        <td>
          <div style="font-size:17px;font-weight:800;color:#ffffff;margin-bottom:4px;">Neiver Alvarez</div>
          <div style="font-size:13px;color:#f97316;font-weight:600;margin-bottom:12px;">CEO &amp; Founder, Boostify Music</div>
          <p style="margin:0;font-size:14px;color:#9ca3af;line-height:1.7;">
            Building the future of autonomous music. Boostify empowers artists with AI-powered tools
            for creation, distribution, and growth — no labels, no limits.
          </p>
        </td>
      </tr></table>
    </div>
  </td></tr>

  <!-- ── TAGS ─────────────────────────────────────────── -->
  ${tags.length > 0 ? `
  <tr><td style="background:#0d0d0d;padding:0 40px 40px;text-align:center;">
    ${tags.map(t => `<span style="display:inline-block;padding:7px 16px;margin:4px 3px;border-radius:20px;background:#1f2937;color:#9ca3af;font-size:12px;font-weight:500;border:1px solid #374151;">#${t}</span>`).join('')}
  </td></tr>` : ''}

  <!-- ── FOOTER ────────────────────────────────────────── -->
  <tr><td style="background:#111111;border-top:1px solid #1f2937;padding:32px 40px;text-align:center;">
    <div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:6px;">
      <span style="color:#f97316;">⚡</span>&nbsp;Boostify Music
    </div>
    <div style="font-size:13px;color:#6b7280;margin-bottom:14px;">The Future of AI Music</div>
    <div style="margin-bottom:14px;">
      <a href="${SITE_URL}" style="color:#f97316;font-size:13px;">boostifymusic.com</a>
      &nbsp;·&nbsp;
      <a href="${SITE_URL}/news" style="color:#f97316;font-size:13px;">All News</a>
    </div>
    <div style="font-size:11px;color:#374151;">© ${new Date().getFullYear()} Boostify Music Inc. All rights reserved.</div>
  </td></tr>

</table>
</td></tr>
</table>
</div>
</body>
</html>`;
}

function buildDigestEmail(articles: NewsletterArticle[]): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const articleCards = articles.map(article => {
    const categoryLabel = getCategoryLabel(article.category);
    const categoryColor = getCategoryColor(article.category);
    const articleUrl = `${SITE_URL}/news?article=${article.slug}`;
    const preview = getArticlePreview(article.htmlContent, 200);

    return `
    <!-- Article Card -->
    <tr><td style="padding:10px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.05);">
        <tr><td style="padding:24px;">
          <span style="display:inline-block;padding:3px 12px;border-radius:16px;background:${categoryColor}22;color:${categoryColor};font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">
            ${categoryLabel}
          </span>
          <h3 style="margin:10px 0 8px;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">
            <a href="${articleUrl}" style="color:#ffffff;text-decoration:none;">${article.title}</a>
          </h3>
          <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.6;">
            ${preview}
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <a href="${articleUrl}" style="color:#F97316;font-size:13px;font-weight:600;text-decoration:none;">
                  Read more →
                </a>
              </td>
              <td style="padding-left:20px;color:#6b7280;font-size:12px;">
                📖 ${article.readTimeMinutes || 5} min
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boostify News Digest</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#0a0a0a;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:20px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

        <!-- Logo -->
        <tr><td style="padding:30px 20px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                <span style="color:#F97316;">⚡</span> BOOSTIFY
              </td>
              <td style="padding-left:8px;font-size:13px;font-weight:600;color:#F97316;letter-spacing:2px;text-transform:uppercase;vertical-align:middle;">
                NEWS
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Hero Banner -->
        <tr><td>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a0f00 0%,#1a1a2e 50%,#0f0f23 100%);border-radius:16px;overflow:hidden;border:1px solid rgba(249,115,22,0.2);">
            <tr><td style="padding:40px 30px;text-align:center;">
              <p style="margin:0 0 10px;font-size:12px;color:#F97316;font-weight:600;letter-spacing:2px;text-transform:uppercase;">
                📰 News Digest
              </p>
              <h1 style="margin:0 0 10px;font-size:30px;font-weight:800;color:#ffffff;line-height:1.2;">
                Latest from Boostify
              </h1>
              <p style="margin:0;font-size:14px;color:#6b7280;">
                ${today} · ${articles.length} article${articles.length !== 1 ? 's' : ''}
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Articles -->
        ${articleCards}

        <!-- CTA -->
        <tr><td style="padding:24px 0;text-align:center;">
          <a href="${SITE_URL}/news" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#F97316,#F59E0B);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.5px;">
            Browse All Articles →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:30px 20px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
            Powered by <strong style="color:#F97316;">Boostify Music</strong> — The Future of AI Music
          </p>
          <p style="margin:0 0 16px;font-size:12px;color:#4b5563;">
            <a href="${SITE_URL}" style="color:#F97316;text-decoration:none;">boostifymusic.com</a>
          </p>
          <p style="margin:0;font-size:10px;color:#374151;">
            © ${new Date().getFullYear()} Boostify Music Inc. All rights reserved.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendViaResend(to: string, subject: string, htmlContent: string, attachments?: EmailAttachment[]) {
  const body: any = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject,
    html: htmlContent,
  };
  if (attachments?.length) {
    body.attachments = attachments.map(a => ({
      filename: a.filename,
      content: a.content,
      content_type: a.contentType,
      content_id: a.contentId,
    }));
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json() as any;
  if (response.ok && result.id) {
    return { success: true, messageId: result.id, provider: 'resend' };
  }
  return { success: false, error: result.message || JSON.stringify(result), provider: 'resend' };
}

async function sendViaSendGrid(to: string, subject: string, htmlContent: string, attachments?: EmailAttachment[]) {
  const payload: any = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    content: [{ type: 'text/html', value: htmlContent }],
  };
  if (attachments?.length) {
    payload.attachments = attachments.map(a => ({
      content: a.content,
      type: a.contentType,
      filename: a.filename,
      disposition: 'inline',
      content_id: a.contentId,
    }));
  }
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 202) {
    const msgId = response.headers.get('X-Message-Id') || 'ok';
    return { success: true, messageId: msgId, provider: 'sendgrid' };
  }
  const result = await response.json() as any;
  const errMsg = result?.errors?.[0]?.message || JSON.stringify(result);
  return { success: false, error: errMsg, provider: 'sendgrid' };
}

async function sendViaBrevo(to: string, subject: string, htmlContent: string, attachments?: EmailAttachment[]) {
  const payload: any = {
    sender: { email: FROM_EMAIL, name: FROM_NAME },
    to: [{ email: to }],
    subject,
    htmlContent,
  };
  if (attachments?.length) {
    payload.attachment = attachments.map(a => ({
      name: a.filename,
      content: a.content,
      contentId: a.contentId,
    }));
  }
  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json() as any;
  if (result.messageId) {
    return { success: true, messageId: result.messageId, provider: 'brevo' };
  }
  return { success: false, error: result.message || JSON.stringify(result), provider: 'brevo' };
}

async function sendEmail(to: string, subject: string, htmlContent: string, attachments?: EmailAttachment[]) {
  // 1. Try Resend first
  if (RESEND_API_KEY) {
    try {
      const result = await sendViaResend(to, subject, htmlContent, attachments);
      if (result.success) {
        console.log(`[Newsletter] ✅ Sent via Resend to ${to} (${result.messageId})`);
        return result;
      }
      console.warn(`[Newsletter] ⚠️ Resend failed: ${result.error}`);
    } catch (err: any) {
      console.warn(`[Newsletter] ⚠️ Resend error: ${err.message}`);
    }
  }

  // 2. Fallback: SendGrid
  if (SENDGRID_API_KEY) {
    try {
      const result = await sendViaSendGrid(to, subject, htmlContent, attachments);
      if (result.success) {
        console.log(`[Newsletter] ✅ Sent via SendGrid to ${to} (${result.messageId})`);
        return result;
      }
      console.warn(`[Newsletter] ⚠️ SendGrid failed: ${result.error}`);
    } catch (err: any) {
      console.warn(`[Newsletter] ⚠️ SendGrid error: ${err.message}`);
    }
  }

  // 3. Fallback: Brevo
  if (BREVO_API_KEY) {
    try {
      const result = await sendViaBrevo(to, subject, htmlContent, attachments);
      if (result.success) {
        console.log(`[Newsletter] ✅ Sent via Brevo to ${to} (${result.messageId})`);
        return result;
      }
      console.error(`[Newsletter] ❌ Brevo also failed: ${result.error}`);
      return result;
    } catch (err: any) {
      console.error(`[Newsletter] ❌ Brevo error: ${err.message}`);
      return { success: false, error: err.message, provider: 'brevo' };
    }
  }

  console.error('[Newsletter] ❌ No email provider configured');
  return { success: false, error: 'No email provider configured', provider: 'none' };
}

/**
 * Send a single article as a newsletter to all recipients
 */
export async function sendArticleNewsletter(articleId: number, extraRecipients?: string[]) {
  const [article] = await db.select().from(newsArticles).where(eq(newsArticles.id, articleId)).limit(1);
  if (!article) {
    console.error('[Newsletter] Article not found:', articleId);
    return { success: false, error: 'Article not found' };
  }

  // Compress cover image once and embed as inline CID — image travels inside the email,
  // no dependency on any external server being up.
  const imgBuf = await getCompressedCoverBuffer((article as any).coverImageUrl);
  const attachments: EmailAttachment[] | undefined = imgBuf ? [{
    filename: 'cover.jpg', content: imgBuf.toString('base64'),
    contentType: 'image/jpeg', contentId: 'cover',
  }] : undefined;
  const coverSrc = imgBuf ? 'cid:cover' : undefined;

  const html = buildSingleArticleEmail(article as NewsletterArticle, coverSrc);
  const subject = `📰 ${article.title} — Boostify News`;
  const recipients = [...NEWSLETTER_RECIPIENTS, ...(extraRecipients || [])];
  const unique = [...new Set(recipients.map(e => e.toLowerCase()))];

  const results = [];
  for (const email of unique) {
    const result = await sendEmail(email, subject, html, attachments);
    results.push({ email, ...result });
  }

  const sent = results.filter(r => r.success).length;
  console.log(`[Newsletter] Article "${article.title}" sent to ${sent}/${unique.length} recipients`);
  return { success: sent > 0, sent, total: unique.length, results };
}

/**
 * Send a digest of the latest articles
 */
export async function sendNewsDigest(days: number = 7, extraRecipients?: string[]) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const articles = await db.select()
    .from(newsArticles)
    .where(eq(newsArticles.status, 'published'))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(10);

  if (articles.length === 0) {
    console.log('[Newsletter] No articles to send');
    return { success: false, error: 'No articles available' };
  }

  const html = buildDigestEmail(articles as NewsletterArticle[]);
  const subject = `📰 Boostify News Digest — ${articles.length} Latest Articles`;
  const recipients = [...NEWSLETTER_RECIPIENTS, ...(extraRecipients || [])];
  const unique = [...new Set(recipients.map(e => e.toLowerCase()))];

  const results = [];
  for (const email of unique) {
    const result = await sendEmail(email, subject, html);
    results.push({ email, ...result });
  }

  const sent = results.filter(r => r.success).length;
  console.log(`[Newsletter] Digest sent to ${sent}/${unique.length} recipients`);
  return { success: sent > 0, sent, total: unique.length, articlesCount: articles.length, results };
}

/**
 * Send all recent published articles as individual emails (one per article)
 */
export async function sendAllArticlesSeparately(days: number = 30, extraRecipients?: string[]) {
  const articles = await db.select()
    .from(newsArticles)
    .where(eq(newsArticles.status, 'published'))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(20);

  if (articles.length === 0) {
    return { success: false, error: 'No published articles', sent: 0 };
  }

  const recipients = [...NEWSLETTER_RECIPIENTS, ...(extraRecipients || [])];
  const unique = [...new Set(recipients.map(e => e.toLowerCase()))];
  let totalSent = 0;
  const results = [];

  for (const article of articles) {
    const html = buildSingleArticleEmail(article as NewsletterArticle);
    const subject = `📰 ${article.title} — Boostify News`;
    for (const email of unique) {
      const result = await sendEmail(email, subject, html);
      results.push({ articleId: article.id, title: article.title?.substring(0, 50), email, ...result });
      if (result.success) totalSent++;
    }
    // Small delay between emails to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[Newsletter] Sent ${totalSent} individual article emails`);
  return { success: totalSent > 0, sent: totalSent, articlesCount: articles.length, results };
}

/**
 * Send latest article newsletter (called after auto-publish)
 */
export async function sendLatestArticleNewsletter() {
  const [latest] = await db.select()
    .from(newsArticles)
    .where(eq(newsArticles.status, 'published'))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(1);

  if (!latest) return { success: false, error: 'No published articles' };
  return sendArticleNewsletter(latest.id);
}

// ── Supabase connection (music industry leads) ──────────────────
import pg from 'pg';
const { Client: PgClient } = pg;

const SUPABASE_LEADS_URL = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
const DAILY_OUTREACH_LIMIT = 20;

interface IndustryLead {
  email: string;
  personal_email: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  job_title: string | null;
}

/**
 * Fetch leads from Supabase that haven't received this article yet.
 * Rotates through the 7,439 contacts sending 20 new ones per day.
 */
async function getUnsendLeads(articleId: number, limit = DAILY_OUTREACH_LIMIT): Promise<IndustryLead[]> {
  // 1. Get emails already sent for this article id
  const alreadySent = await db.select({ email: newsletterOutreachLog.email })
    .from(newsletterOutreachLog)
    .where(eq(newsletterOutreachLog.articleId, articleId));

  const sentEmails = alreadySent.map(r => r.email.toLowerCase());

  // 2. Query Supabase for leads not in that set
  const client = new PgClient({ connectionString: SUPABASE_LEADS_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    // Build exclusion list param (max 20k items, safe for our scale)
    const exclusionList = sentEmails.length > 0
      ? sentEmails.map((_, i) => `$${i + 2}`).join(', ')
      : null;

    const query = exclusionList
      ? `SELECT email, personal_email, first_name, last_name, company_name, job_title
         FROM leads
         WHERE email IS NOT NULL
           AND email LIKE '%@%.%'
           AND email NOT LIKE '%.read'
           AND email NOT IN (${exclusionList})
         ORDER BY created_at ASC
         LIMIT $1`
      : `SELECT email, personal_email, first_name, last_name, company_name, job_title
         FROM leads
         WHERE email IS NOT NULL
           AND email LIKE '%@%.%'
           AND email NOT LIKE '%.read'
         ORDER BY created_at ASC
         LIMIT $1`;

    const params = exclusionList ? [limit, ...sentEmails] : [limit];
    const result = await client.query(query, params);
    return result.rows as IndustryLead[];
  } finally {
    await client.end();
  }
}

/**
 * Build a personalized subject line for cold outreach
 */
function buildOutreachSubject(article: NewsletterArticle, lead: IndustryLead): string {
  const firstName = lead.first_name ? ` ${lead.first_name}` : '';
  const subjects = [
    `${article.title} — Boostify Music`,
    `New in AI Music${firstName ? ',' + firstName : ''}: ${article.title}`,
    `${article.title}`,
  ];
  return subjects[Math.floor(Math.random() * subjects.length)];
}

/**
 * Send today's article to 20 music industry contacts from Supabase.
 * Logs every send to newsletter_outreach_log to prevent duplicates.
 * Called automatically after each daily article is published.
 */
export async function sendArticleToIndustryContacts(articleId: number): Promise<{
  success: boolean;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
}> {
  const [article] = await db.select().from(newsArticles).where(eq(newsArticles.id, articleId)).limit(1);
  if (!article) {
    console.error('[Industry Newsletter] Article not found:', articleId);
    return { success: false, sent: 0, failed: 0, skipped: 0, total: 0 };
  }

  let leads: IndustryLead[] = [];
  try {
    leads = await getUnsendLeads(articleId, DAILY_OUTREACH_LIMIT);
  } catch (err: any) {
    console.error('[Industry Newsletter] Failed to fetch leads from Supabase:', err.message);
    return { success: false, sent: 0, failed: 0, skipped: 0, total: 0 };
  }

  if (leads.length === 0) {
    console.log('[Industry Newsletter] All contacts already received this article, or no leads available');
    return { success: true, sent: 0, failed: 0, skipped: 0, total: 0 };
  }

  console.log(`[Industry Newsletter] Sending article "${article.title}" to ${leads.length} industry contacts...`);

  const imgBuf = await getCompressedCoverBuffer((article as any).coverImageUrl);
  const attachments: EmailAttachment[] | undefined = imgBuf ? [{
    filename: 'cover.jpg', content: imgBuf.toString('base64'),
    contentType: 'image/jpeg', contentId: 'cover',
  }] : undefined;
  const coverSrc = imgBuf ? 'cid:cover' : undefined;

  const html = buildSingleArticleEmail(article as NewsletterArticle, coverSrc);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of leads) {
    // Prefer work email, fallback to personal
    const emailTo = (lead.email || lead.personal_email || '').trim().toLowerCase();
    if (!emailTo || !emailTo.includes('@')) {
      skipped++;
      continue;
    }

    const subject = buildOutreachSubject(article as NewsletterArticle, lead);
    const result = await sendEmail(emailTo, subject, html, attachments);

    // Log the attempt regardless of success
    try {
      await db.insert(newsletterOutreachLog).values({
        email: emailTo,
        firstName: lead.first_name,
        lastName: lead.last_name,
        company: lead.company_name,
        jobTitle: lead.job_title,
        articleId: article.id,
        articleTitle: article.title,
        status: result.success ? 'sent' : 'failed',
        provider: result.provider || null,
        errorMessage: result.success ? null : (result.error || null),
      });
    } catch (logErr: any) {
      console.warn('[Industry Newsletter] Failed to log send:', logErr.message);
    }

    if (result.success) {
      sent++;
    } else {
      failed++;
      console.warn(`[Industry Newsletter] Failed to send to ${emailTo}:`, result.error);
    }

    // 600ms delay between sends — keeps us under Resend's rate limits
    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`[Industry Newsletter] Done: ${sent} sent, ${failed} failed, ${skipped} skipped (no email)`);
  return { success: sent > 0, sent, failed, skipped, total: leads.length };
}
