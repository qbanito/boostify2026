#!/usr/bin/env node
/**
 * 📰 BOOSTIFY NEWS AUTO-PUBLISHER
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a new article via OpenAI gpt-4o, stores it in the newsArticles
 * table on Supabase, then sends a newsletter email via Brevo to recent
 * newsletter subscribers that haven't received this campaign yet.
 *
 * Usage:
 *   node scripts/news-publisher.cjs [options]
 *
 * Options:
 *   --category=<category>         Article category (default: platform-updates)
 *   --topic=<text>                Optional topic override for AI generation
 *   --send-newsletter=<bool>      Whether to send newsletter email (default: true)
 *   --max-recipients=<n>          Max newsletter recipients (default: 20)
 *   --preview=<bool>              If true, sends only to PREVIEW_EMAIL (default: true)
 *
 * Required env vars:
 *   OPENAI_API_KEY
 *   SUPABASE_CONNECTION_STRING
 *   BREVO_API_KEY
 *
 * Optional env vars:
 *   FAL_KEY             (for AI cover image generation)
 *   PREVIEW_EMAIL       (email for preview mode, default: convoycubano@gmail.com)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// Load local env (.env) for local runs; in CI env vars are set directly.
try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
} catch (e) { /* dotenv unavailable — env vars set directly in CI */ }

const { Pool } = require('pg');

// ─── Parse CLI Arguments ──────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace(/^--/, '').split('=');
  acc[key] = val !== undefined ? val : 'true';
  return acc;
}, {});

const CATEGORY      = args['category']          || 'platform-updates';
const TOPIC_HINT    = args['topic']             || '';
const SEND_NL       = (args['send-newsletter']  || 'true') !== 'false';
const MAX_RECIPS    = parseInt(args['max-recipients'] || '20', 10);
const PREVIEW_MODE  = (args['preview']          || 'true') !== 'false';
const PREVIEW_EMAIL = process.env.PREVIEW_EMAIL || 'convoycubano@gmail.com';

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_URL       = 'https://boostifymusic.com';
const NEWS_URL       = `${BASE_URL}/news`;
const FROM_EMAIL     = 'news@boostifymusic.com';
const FROM_NAME      = 'Boostify Music News';
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const VALID_CATEGORIES = [
  'technology', 'innovation', 'autonomous-artists', 'web3', 'ai-music',
  'platform-updates', 'industry-vision', 'partnerships', 'artist-news',
];

const CATEGORY_COLORS = {
  'technology':          '#3b82f6',
  'innovation':          '#8b5cf6',
  'autonomous-artists':  '#f59e0b',
  'web3':                '#10b981',
  'ai-music':            '#ec4899',
  'platform-updates':    '#6366f1',
  'industry-vision':     '#0ea5e9',
  'partnerships':        '#14b8a6',
  'artist-news':         '#f97316',
};

// ─── Database Pool ──────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── OpenAI Article Generation ───────────────────────────────────────────────
async function generateArticle() {
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const category = VALID_CATEGORIES.includes(CATEGORY) ? CATEGORY : 'platform-updates';
  const topicInstruction = TOPIC_HINT
    ? `Focus specifically on: "${TOPIC_HINT}".`
    : `Choose an insightful, newsworthy angle about this category.`;

  const systemPrompt = `You are a professional music-tech journalist for Boostify Music (boostifymusic.com). 
Write articles that are informative, engaging, and relevant to independent artists and music industry professionals.
Always position Boostify Music as an innovative leader in AI-powered music technology.
Write in a modern, authoritative yet approachable tone.`;

  const userPrompt = `Write a news article for the Boostify Music platform.
Category: ${category}
${topicInstruction}

Return ONLY valid JSON with this exact structure:
{
  "title": "Compelling headline (max 80 chars)",
  "subtitle": "Supporting subheadline (max 120 chars)",
  "summary": "2-3 sentence summary for email/social previews (max 300 chars)",
  "htmlContent": "<p>Full article body as clean HTML. Use <p>, <h3>, <ul>, <li> tags only. No inline styles. 600-900 words.</p>",
  "tags": ["tag1", "tag2", "tag3"],
  "readTimeMinutes": 4
}

Guidelines:
- Title must be newsworthy and specific
- Include real trends, stats, or insights about AI music, streaming, independent artists, or Boostify features
- Mention Boostify platform features naturally (Mini Studio, BoostiSwap, Artist Pages, AI Artists, BTF token)
- DO NOT use placeholder text or template language
- htmlContent must be complete and polished`;

  console.log(`\n🤖 Generating article via OpenAI gpt-4o...`);
  console.log(`   Category: ${category}`);
  if (TOPIC_HINT) console.log(`   Topic hint: ${TOPIC_HINT}`);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.75,
    max_tokens: 2000,
  });

  const raw = response.choices[0].message.content;
  const article = JSON.parse(raw);

  // Validate required fields
  if (!article.title || !article.htmlContent) {
    throw new Error('OpenAI response missing required fields (title, htmlContent)');
  }

  return {
    title:           article.title.slice(0, 200),
    subtitle:        (article.subtitle || '').slice(0, 300),
    summary:         (article.summary  || '').slice(0, 500),
    htmlContent:     article.htmlContent,
    tags:            Array.isArray(article.tags) ? article.tags.slice(0, 10) : [],
    readTimeMinutes: article.readTimeMinutes || 4,
    category,
  };
}

// ─── Cover Image Generation (FAL.ai) ─────────────────────────────────────────
async function generateCoverImage(title) {
  if (!process.env.FAL_KEY) {
    console.log('   ⚠️  FAL_KEY not set, using placeholder cover image');
    return 'https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png';
  }

  try {
    const { fal } = await import('@fal-ai/client');
    fal.config({ credentials: process.env.FAL_KEY });

    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt: `Music technology news banner: ${title}. Dark cinematic style, orange accent colors, abstract music visualization, professional editorial photography, 16:9 aspect ratio`,
        image_size: 'landscape_16_9',
        num_images: 1,
        num_inference_steps: 4,
      },
    });

    const imageUrl = result?.data?.images?.[0]?.url;
    if (imageUrl) {
      console.log('   ✅ Cover image generated via FAL.ai');
      return imageUrl;
    }
  } catch (err) {
    console.warn('   ⚠️  FAL.ai image generation failed:', err.message);
  }

  return 'https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png';
}

// ─── Slug Generator ───────────────────────────────────────────────────────────
function generateSlug(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');

  const timestamp = Date.now().toString(36);
  return `${base}-${timestamp}`;
}

// ─── Check for Existing Article Today ────────────────────────────────────────
async function articleExistsToday(client) {
  const res = await client.query(`
    SELECT id FROM news_articles
    WHERE published_at >= CURRENT_DATE
      AND published_at < CURRENT_DATE + INTERVAL '1 day'
      AND status = 'published'
    LIMIT 1
  `);
  return res.rows.length > 0;
}

// ─── Store Article in Database ────────────────────────────────────────────────
async function storeArticle(client, article, coverImageUrl) {
  const slug = generateSlug(article.title);
  const now  = new Date().toISOString();

  const res = await client.query(`
    INSERT INTO news_articles (
      slug, title, subtitle, summary, html_content,
      cover_image_url, category, tags, status,
      read_time_minutes, published_at, generated_by, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8::text[], $9,
      $10, $11, $12, NOW(), NOW()
    )
    RETURNING id, slug
  `, [
    slug,
    article.title,
    article.subtitle,
    article.summary,
    article.htmlContent,
    coverImageUrl,
    article.category,
    article.tags,
    'published',
    article.readTimeMinutes,
    now,
    'github-actions',
  ]);

  const row = res.rows[0];
  console.log(`   ✅ Article stored: id=${row.id}, slug=${row.slug}`);

  // Log to news_generation_logs if the table exists
  try {
    await client.query(`
      INSERT INTO news_generation_logs (article_id, category, generated_by, model, created_at)
      VALUES ($1, $2, 'github-actions', 'gpt-4o', NOW())
    `, [row.id, article.category]);
  } catch (_) { /* table may not exist yet */ }

  return row;
}

// ─── Newsletter Email HTML Builder ───────────────────────────────────────────
function buildNewsletterEmail(article, coverImageUrl) {
  const categoryLabel = article.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const accentColor   = CATEGORY_COLORS[article.category] || '#f97316';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${article.summary}&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:30px 10px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
          style="max-width:600px;background:#111111;border-radius:20px;overflow:hidden;border:1px solid #2a2a2a;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:28px 40px;text-align:center;">
              <a href="${BASE_URL}" style="text-decoration:none;">
                <span style="font-size:22px;font-weight:900;color:#f97316;letter-spacing:1px;">🎵 BOOSTIFY MUSIC</span>
              </a>
              <p style="margin:6px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:3px;">Platform News &amp; Updates</p>
            </td>
          </tr>

          <!-- Cover Image -->
          <tr>
            <td style="padding:0;position:relative;">
              <img src="${coverImageUrl}" alt="Article Cover" width="600" style="width:100%;max-width:600px;height:240px;object-fit:cover;display:block;" />
              <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.85));padding:20px 30px;">
                <span style="display:inline-block;background:${accentColor};color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:3px 10px;border-radius:20px;">${categoryLabel}</span>
              </div>
            </td>
          </tr>

          <!-- Article Content -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#ffffff;line-height:1.3;">${article.title}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">${article.subtitle}</p>
              <div style="height:2px;background:linear-gradient(90deg,${accentColor} 0%,transparent 100%);margin:0 0 24px;border-radius:2px;"></div>
              <p style="margin:0 0 20px;font-size:15px;color:#e2e8f0;line-height:1.7;font-style:italic;">${article.summary}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <a href="${NEWS_URL}"
                      style="display:inline-block;background:linear-gradient(135deg,${accentColor} 0%,#ea580c 100%);color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:0.5px;box-shadow:0 6px 20px rgba(249,115,22,0.3);">
                      📰 Read Full Article
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Feature Links -->
          <tr>
            <td style="padding:0 40px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:16px;background:#1a1a2e;border-radius:12px;border-left:4px solid #f97316;text-align:center;">
                    <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#f97316;text-transform:uppercase;letter-spacing:1px;">🎛️ Now Live on Boostify</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                      <tr>
                        <td style="padding:0 8px;"><a href="${BASE_URL}/producer-tools?tab=ministudio" style="font-size:11px;color:#a78bfa;text-decoration:none;font-weight:600;">Mini Studio</a></td>
                        <td style="padding:0 8px;"><a href="${BASE_URL}/boostiswap" style="font-size:11px;color:#10b981;text-decoration:none;font-weight:600;">BoostiSwap</a></td>
                        <td style="padding:0 8px;"><a href="${BASE_URL}/my-artists" style="font-size:11px;color:#f97316;text-decoration:none;font-weight:600;">Artist Page</a></td>
                        <td style="padding:0 8px;"><a href="${BASE_URL}/explore" style="font-size:11px;color:#60a5fa;text-decoration:none;font-weight:600;">Explore</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:24px 40px;text-align:center;border-top:1px solid #2a2a2a;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#ffffff;">🎵 Boostify Music</p>
              <p style="margin:0 0 12px;font-size:11px;color:#64748b;">Empowering independent artists worldwide</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 12px;">
                <tr>
                  <td style="padding:0 8px;"><a href="${BASE_URL}" style="font-size:11px;color:#f97316;text-decoration:none;">🌐 Home</a></td>
                  <td style="padding:0 8px;"><a href="${NEWS_URL}" style="font-size:11px;color:#60a5fa;text-decoration:none;">📰 News</a></td>
                  <td style="padding:0 8px;"><a href="${BASE_URL}/my-artists" style="font-size:11px;color:#10b981;text-decoration:none;">🎨 Artists</a></td>
                </tr>
              </table>
              <p style="margin:0;font-size:10px;color:#374151;">© 2026 Boostify Music. All rights reserved.<br>
              <a href="${BASE_URL}/unsubscribe" style="color:#374151;text-decoration:underline;">Unsubscribe</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Send Email via Brevo ─────────────────────────────────────────────────────
async function sendEmail({ to, toName, subject, html }) {
  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'accept':       'application/json',
      'api-key':      process.env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender:      { name: FROM_NAME, email: FROM_EMAIL },
      to:          [{ email: to, name: toName || to }],
      replyTo:     { email: 'convoycubano@gmail.com', name: 'Boostify Support' },
      subject,
      htmlContent: html,
    }),
  });

  const body = await res.json();
  if (body.messageId) return { ok: true, messageId: body.messageId };
  return { ok: false, error: body.message || JSON.stringify(body) };
}

// ─── Get Newsletter Recipients ────────────────────────────────────────────────
async function getNewsletterRecipients(client, campaignId) {
  // Get leads that opted in to newsletter and haven't received this article
  const res = await client.query(`
    SELECT l.id, l.email, l.first_name, l.name
    FROM leads l
    WHERE l.email IS NOT NULL
      AND l.newsletter_opt_in = true
      AND l.id NOT IN (
        SELECT lead_id FROM newsletter_outreach_log WHERE campaign_id = $1
      )
    ORDER BY l.created_at DESC
    LIMIT $2
  `, [campaignId, MAX_RECIPS]);

  // Fallback: query without newsletter_opt_in if column doesn't exist
  if (res.rows) return res.rows;
  return [];
}

// ─── Log Newsletter Send ──────────────────────────────────────────────────────
async function logNewsletterSend(client, leadId, campaignId, articleId, messageId) {
  try {
    await client.query(`
      INSERT INTO newsletter_outreach_log (lead_id, campaign_id, article_id, message_id, sent_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT DO NOTHING
    `, [leadId, campaignId, articleId, messageId]);
  } catch (_) { /* best effort */ }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(62));
  console.log('📰  BOOSTIFY NEWS AUTO-PUBLISHER');
  console.log('═'.repeat(62));
  console.log(`   Category:     ${CATEGORY}`);
  console.log(`   Newsletter:   ${SEND_NL ? 'YES' : 'NO'}`);
  console.log(`   Max recips:   ${MAX_RECIPS}`);
  console.log(`   Mode:         ${PREVIEW_MODE ? `PREVIEW → ${PREVIEW_EMAIL}` : '🔴 PRODUCTION'}`);
  if (TOPIC_HINT) console.log(`   Topic hint:   ${TOPIC_HINT}`);
  console.log('─'.repeat(62));

  const client = await pool.connect();
  try {
    // 1. Check if article already generated today
    const alreadyPublished = await articleExistsToday(client);
    if (alreadyPublished && !TOPIC_HINT) {
      console.log('\n⚠️  An article was already published today. Skipping generation.');
      console.log('   Pass --topic= to force a second article.\n');
      return;
    }

    // 2. Generate article via OpenAI
    const article = await generateArticle();
    console.log(`\n✅ Article generated: "${article.title}"`);
    console.log(`   Read time: ${article.readTimeMinutes} min`);
    console.log(`   Tags: ${article.tags.join(', ')}`);

    // 3. Generate cover image
    console.log('\n🖼️  Generating cover image...');
    const coverImageUrl = await generateCoverImage(article.title);

    // 4. Store article in database
    console.log('\n💾 Storing article in database...');
    const { id: articleId, slug } = await storeArticle(client, article, coverImageUrl);
    const articleUrl = `${NEWS_URL}`;

    console.log(`\n🔗 Article URL: ${articleUrl}`);

    // 5. Send newsletter
    if (SEND_NL) {
      console.log('\n📧 Sending newsletter...');
      const subject = `📰 ${article.title} — Boostify Music News`;
      const html    = buildNewsletterEmail(article, coverImageUrl);
      const campaignId = `news_${slug}`;

      if (PREVIEW_MODE) {
        // Preview: send only to preview email
        const result = await sendEmail({
          to: PREVIEW_EMAIL,
          toName: 'Boostify Team',
          subject: `[PREVIEW] ${subject}`,
          html,
        });
        if (result.ok) {
          console.log(`   ✅ Preview email sent to ${PREVIEW_EMAIL} (msgId: ${result.messageId})`);
        } else {
          console.error(`   ❌ Preview email failed: ${result.error}`);
        }
      } else {
        // Production: send to newsletter subscribers
        let recipients;
        try {
          recipients = await getNewsletterRecipients(client, campaignId);
        } catch (err) {
          // leads table/columns missing on the consolidated DB — use music_industry_contacts
          console.warn('   ⚠️  leads/newsletter query failed, falling back to music_industry_contacts');
          const fallback = await client.query(
            `SELECT id, email, first_name, full_name AS name
             FROM music_industry_contacts
             WHERE email IS NOT NULL AND email <> ''
               AND COALESCE(email_status, 'valid') NOT IN ('bounced', 'invalid', 'unsubscribed')
             ORDER BY COALESCE(last_contacted_at, '1970-01-01'::timestamp) ASC, RANDOM()
             LIMIT $1`,
            [MAX_RECIPS]
          );
          recipients = fallback.rows;
        }

        console.log(`   📋 Recipients found: ${recipients.length}`);

        let sentCount = 0, failCount = 0;
        for (const lead of recipients) {
          const firstName = lead.first_name || lead.name?.split(' ')[0] || 'there';
          const personalizedSubject = subject;

          const result = await sendEmail({
            to:     lead.email,
            toName: firstName,
            subject: personalizedSubject,
            html,
          });

          if (result.ok) {
            sentCount++;
            await logNewsletterSend(client, lead.id, campaignId, articleId, result.messageId);
            console.log(`   ✅ Sent to ${lead.email}`);
          } else {
            failCount++;
            console.error(`   ❌ Failed for ${lead.email}: ${result.error}`);
          }

          // Rate limiting: wait 400ms between sends
          await new Promise(r => setTimeout(r, 400));
        }

        console.log(`\n   📊 Results: ${sentCount} sent, ${failCount} failed`);
      }
    }

    console.log('\n' + '═'.repeat(62));
    console.log('🎉  PUBLISH COMPLETE');
    console.log(`   Article: "${article.title}"`);
    console.log(`   View at: ${articleUrl}`);
    console.log('═'.repeat(62) + '\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\n❌ NEWS PUBLISHER ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
