/**
 * 📰 BOOSTIFY NEWS BLAST SENDER
 * Sends real Boostify news articles from the platform to ALL leads
 *
 * Features:
 *   - Fetches LIVE articles from Boostify news_articles DB
 *   - 3 email types: digest (3 articles), single article, featured story
 *   - Rotates across all 5 providers (Brevo + 4 Resend)
 *   - Audience routing: artists → Resend, industry/investors → Brevo
 *   - Embeds article cards with category badges, read-time, CTA links
 *   - All replies go to convoycubano@gmail.com
 *
 * CLI:
 *   node scripts/news-blast-sender.cjs --type=digest --max=40 --audience=artists --preview=true
 *   node scripts/news-blast-sender.cjs --type=single --article-id=123 --max=30 --audience=industry
 *   node scripts/news-blast-sender.cjs --type=featured --max=40 --audience=all --preview=true
 *
 * Limits:
 *   Brevo: 200/day safe | Each Resend: 70/day safe
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.secrets') });

const { sendWithBrevo, sendWithResend, getBestArtistProvider, recordSends, getBrevoQuota, REPLY_TO } = require('./email-smart-router.cjs');

// ─── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, a) => {
  const [k, v] = a.replace('--', '').split('=');
  acc[k] = v;
  return acc;
}, {});

const TYPE = args.type || 'digest';            // digest | single | featured
const ARTICLE_ID = args['article-id'] || null;
const MAX_EMAILS = parseInt(args.max || '40');
const AUDIENCE = args.audience || 'artists';   // artists | industry | investors | all
const PREVIEW_MODE = args.preview === 'true';
const PREVIEW_EMAIL = 'convoycubano@gmail.com';

// ─── Database ──────────────────────────────────────────────────────────────────
// Leads + email tracking → Supabase
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});
// News articles → NeonDB (main app writes articles here via Drizzle)
const newsPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Category config ───────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  'technology':         { label: 'Technology',         color: '#3b82f6', icon: '⚙️' },
  'innovation':         { label: 'Innovation',         color: '#8b5cf6', icon: '✨' },
  'autonomous-artists': { label: 'Autonomous Artists', color: '#f97316', icon: '🤖' },
  'web3':               { label: 'Web3 & Blockchain',  color: '#10b981', icon: '🔗' },
  'ai-music':           { label: 'AI Music',           color: '#f59e0b', icon: '🎵' },
  'platform-updates':   { label: 'Platform Update',    color: '#6366f1', icon: '🚀' },
  'industry-vision':    { label: 'Industry Vision',    color: '#f43f5e', icon: '🌐' },
  'partnerships':       { label: 'Partnerships',       color: '#7c3aed', icon: '🤝' },
  'artist-news':        { label: 'Artist News',        color: '#ec4899', icon: '🎤' },
};

// ─── Fetch live articles from NeonDB ─────────────────────────────────────────
async function fetchArticles(count = 3, specificId = null) {
  const nc = await newsPool.connect();
  try {
    if (specificId) {
      const res = await nc.query(
        `SELECT id, title, subtitle, summary, slug, category, cover_image_url, read_time_minutes, published_at
         FROM news_articles WHERE id = $1 AND status = 'published'`, [specificId]
      );
      return res.rows;
    }
    // Fetch latest unique articles (no duplicate titles)
    const res = await nc.query(
      `SELECT DISTINCT ON (title) id, title, subtitle, summary, slug, category, cover_image_url, read_time_minutes, published_at
       FROM news_articles WHERE status = 'published'
       ORDER BY title, published_at DESC`
    );
    return res.rows.sort((a, b) => new Date(b.published_at) - new Date(a.published_at)).slice(0, count);
  } finally {
    nc.release();
  }
}

// ─── Subject lines per type ────────────────────────────────────────────────────
function getSubject(type, articles, firstName) {
  const first = articles[0];
  const subjects = {
    digest: [
      `${firstName}, here's what's happening in music tech this week`,
      `${firstName}, 3 stories every independent artist should read`,
      `The music industry is changing — here's what Boostify is building`,
    ],
    single: first ? `${firstName} — ${first.title}` : `New from Boostify: AI Music Industry Insights`,
    featured: first ? `${firstName}: ${first.title}` : `Inside Boostify: Building the future of music`,
  };
  const arr = Array.isArray(subjects[type]) ? subjects[type] : [subjects[type]];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Article card HTML ─────────────────────────────────────────────────────────
function articleCard(article, featured = false) {
  const cat = CATEGORY_CONFIG[article.category] || { label: 'Boostify News', color: '#f97316', icon: '📰' };
  const articleUrl = `https://boostifymusic.com/news/${article.slug}`;
  const readTime = article.read_time_minutes || 3;
  const summary = (article.summary || '').substring(0, 160) + ((article.summary || '').length > 160 ? '...' : '');
  const subtitle = (article.subtitle || '').substring(0, 100);
  const date = article.published_at ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  if (featured) {
    return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:#1e293b;border-radius:14px;overflow:hidden;border:1px solid #334155;">
  <tr>
    <td>
      <!-- Category badge + meta -->
      <div style="padding:20px 24px 0;">
        <span style="display:inline-block;background:${cat.color}22;color:${cat.color};font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid ${cat.color}44;">${cat.icon} ${cat.label}</span>
        <span style="font-size:11px;color:#475569;margin-left:10px;">${date} · ${readTime} min read</span>
      </div>
      <!-- Title -->
      <div style="padding:14px 24px 0;">
        <h2 style="margin:0;font-size:22px;font-weight:800;color:#f8fafc;line-height:1.3;">
          <a href="${articleUrl}" style="color:#f8fafc;text-decoration:none;">${article.title}</a>
        </h2>
      </div>
      ${subtitle ? `<div style="padding:8px 24px 0;"><p style="margin:0;font-size:14px;color:#94a3b8;font-style:italic;">${subtitle}</p></div>` : ''}
      <!-- Summary -->
      <div style="padding:12px 24px 0;">
        <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.7;">${summary}</p>
      </div>
      <!-- CTA -->
      <div style="padding:16px 24px 24px;">
        <a href="${articleUrl}" style="display:inline-block;background:linear-gradient(135deg,${cat.color},${cat.color}cc);color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:13px;font-weight:700;">
          Read Full Article →
        </a>
        <a href="https://boostifymusic.com/news" style="display:inline-block;color:#64748b;text-decoration:none;font-size:12px;margin-left:16px;">View all news</a>
      </div>
    </td>
  </tr>
</table>`;
  }

  // Compact card
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;background:#1e293b;border-radius:10px;border:1px solid #334155;">
  <tr>
    <td style="padding:16px 20px;">
      <div style="margin-bottom:6px;">
        <span style="background:${cat.color}22;color:${cat.color};font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:20px;">${cat.icon} ${cat.label}</span>
        <span style="font-size:10px;color:#475569;margin-left:8px;">${readTime} min read</span>
      </div>
      <h3 style="margin:0 0 6px;font-size:15px;font-weight:700;color:#e2e8f0;line-height:1.3;">
        <a href="${articleUrl}" style="color:#e2e8f0;text-decoration:none;">${article.title}</a>
      </h3>
      <p style="margin:0 0 10px;font-size:12px;color:#64748b;line-height:1.6;">${summary}</p>
      <a href="${articleUrl}" style="font-size:12px;color:${cat.color};font-weight:700;text-decoration:none;">Read article →</a>
    </td>
  </tr>
</table>`;
}

// ─── Email HTML builder ────────────────────────────────────────────────────────
function buildEmailHtml(type, articles, firstName, audience) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const featured = articles[0];
  const rest = articles.slice(1);

  const heroTagline = audience === 'investors'
    ? 'Boostify Investor Briefing'
    : audience === 'industry'
    ? 'Boostify Industry Intelligence'
    : 'Boostify Artist Intelligence';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Boostify News</title>
<style>
  body,table,td,p,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  body{margin:0!important;padding:0!important;background:#0f172a}
  @media only screen and (max-width:600px){
    .container{width:100%!important}
    .mobile-pad{padding:20px 16px!important}
    h1{font-size:22px!important}
    h2{font-size:18px!important}
    .desktop-only{display:none!important}
  }
</style>
</head>
<body style="background:#0f172a;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:28px 16px 40px;">

  <table class="container" width="600" cellpadding="0" cellspacing="0" border="0">

    <!-- TOP HEADER BAR -->
    <tr>
      <td style="background:linear-gradient(135deg,#f97316,#ea580c 50%,#7c3aed);padding:22px 28px;border-radius:14px 14px 0 0;text-align:center;">
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;">${heroTagline}</div>
        <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;line-height:1.2;">The Boostify Briefing</h1>
        <div style="margin-top:6px;font-size:12px;color:rgba(255,255,255,0.6);">${date}</div>
      </td>
    </tr>

    <!-- GREETING + INTRO -->
    <tr>
      <td class="mobile-pad" style="background:#1e293b;padding:28px 32px;">
        <p style="margin:0 0 14px;font-size:16px;color:#e2e8f0;">Hi ${firstName},</p>
        ${type === 'digest' ? `
        <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.7;">
          Here are the top stories from <strong style="color:#f97316;">Boostify News</strong> this week — covering AI music technology, 
          platform updates, and what's changing in the music industry. 
          <a href="https://boostifymusic.com/news" style="color:#60a5fa;text-decoration:none;">Explore the full news hub →</a>
        </p>` : `
        <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.7;">
          We published something we think every ${audience === 'investors' ? 'investor in music tech' : 'independent artist'} should read right now. 
          Here's the story:
        </p>`}
      </td>
    </tr>

    <!-- ARTICLES -->
    <tr>
      <td class="mobile-pad" style="background:#0f172a;padding:24px 28px;">
        
        ${type !== 'single' && featured ? `
        <!-- FEATURED (FIRST ARTICLE) -->
        <div style="margin-bottom:6px;font-size:10px;font-weight:800;color:#f97316;letter-spacing:2px;text-transform:uppercase;">⭐ Featured Story</div>
        ${articleCard(featured, true)}
        ` : ''}

        ${type === 'single' && featured ? articleCard(featured, true) : ''}

        ${rest.length > 0 ? `
        <!-- MORE STORIES -->
        ${type !== 'single' ? `<div style="margin:20px 0 12px;font-size:10px;font-weight:800;color:#64748b;letter-spacing:2px;text-transform:uppercase;">More from Boostify</div>` : ''}
        ${rest.map(a => articleCard(a, false)).join('')}
        ` : ''}

        <!-- VIEW ALL CTA -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
          <tr>
            <td align="center" style="background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155;">
              <p style="margin:0 0 12px;font-size:13px;color:#94a3b8;">There are more stories published every week on Boostify News</p>
              <a href="https://boostifymusic.com/news" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:700;box-shadow:0 4px 16px rgba(249,115,22,0.35);">
                📰 Read All News at boostifymusic.com
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- PLATFORM FEATURES STRIP -->
    <tr>
      <td style="background:#1e293b;padding:20px 28px;border-top:1px solid #334155;">
        <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#475569;letter-spacing:2px;text-transform:uppercase;">Also on Boostify</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding:6px;">
              <a href="https://boostifymusic.com/my-artists" style="font-size:12px;color:#f97316;text-decoration:none;font-weight:600;">🎤 Artist Profile</a>
            </td>
            <td align="center" style="padding:6px;">
              <a href="https://boostifymusic.com/boostiswap" style="font-size:12px;color:#10b981;text-decoration:none;font-weight:600;">🤝 BoostiSwap</a>
            </td>
            <td align="center" style="padding:6px;">
              <a href="https://boostifymusic.com/explore" style="font-size:12px;color:#6366f1;text-decoration:none;font-weight:600;">🌐 Explore Artists</a>
            </td>
            <td align="center" style="padding:6px;" class="desktop-only">
              <a href="https://wefunder.com/boostify.music" style="font-size:12px;color:#f59e0b;text-decoration:none;font-weight:600;">💰 Invest on Wefunder</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="background:#1e293b;border-top:1px solid #334155;border-radius:0 0 14px 14px;padding:20px 28px;text-align:center;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#e2e8f0;">Boostify Music</p>
        <p style="margin:0 0 6px;font-size:11px;color:#475569;">
          Omnia Strategics Holding Corporation · 1000 Brickell Ave, Office #75, Miami FL 33131
        </p>
        <p style="margin:0 0 12px;font-size:11px;color:#475569;">
          📞 +1 (786) 987-6934 &nbsp;·&nbsp; ✉️ info@boostifymusic.com
        </p>
        <p style="margin:0;font-size:11px;color:#334155;">
          <a href="https://boostifymusic.com" style="color:#f97316;text-decoration:none;">boostifymusic.com</a>
          &nbsp;·&nbsp;
          <a href="https://boostifymusic.com/news" style="color:#60a5fa;text-decoration:none;">News</a>
          &nbsp;·&nbsp;
          <a href="https://boostifymusic.com/unsubscribe" style="color:#475569;text-decoration:none;">Unsubscribe</a>
        </p>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Audience query ────────────────────────────────────────────────────────────
async function fetchLeads(client, audience, limit) {
  let filter = '';
  if (audience === 'artists') {
    filter = `AND (l.source ILIKE '%artist%' OR l.source ILIKE '%apify%' OR l.industry ILIKE '%music%' OR l.industry IS NULL)`;
  } else if (audience === 'industry') {
    filter = `AND (l.job_title IS NOT NULL OR l.source ILIKE '%industry%' OR l.source ILIKE '%linkedin%')`;
  } else if (audience === 'investors') {
    filter = `AND (l.source ILIKE '%investor%' OR l.source ILIKE '%angel%' OR l.source ILIKE '%vc%')`;
  }
  // 'all' = no filter

  const res = await client.query(`
    SELECT l.*, ls.id as status_id
    FROM leads l
    LEFT JOIN lead_status ls ON l.id = ls.lead_id
    WHERE l.email IS NOT NULL
      ${filter}
      AND (ls.last_email_at IS NULL OR ls.last_email_at < NOW() - INTERVAL '4 days')
    ORDER BY RANDOM()
    LIMIT $1
  `, [limit]);
  return res.rows;
}

// ─── Determine provider by audience ───────────────────────────────────────────
async function pickProvider(audience) {
  // Investors/Industry → Brevo (more trusted domain)
  // Artists → Rotate through Resend accounts (better inbox for artist-focused domains)
  if (audience === 'investors' || audience === 'industry') {
    return { type: 'brevo', fromEmail: audience === 'investors' ? 'investors@boostifymusic.com' : 'info@boostifymusic.com', fromName: audience === 'investors' ? 'Neiver from Boostify' : 'Alex from Boostify' };
  }
  // Artists: find best Resend account with lowest daily use
  const best = await getBestArtistProvider(pool);
  if (best) {
    return { type: 'resend', ...best };
  }
  // Fallback: Brevo
  return { type: 'brevo', fromEmail: 'artists@boostifymusic.com', fromName: 'Alex from Boostify' };
}

// ─── Send helper ───────────────────────────────────────────────────────────────
async function sendEmail(provider, to, subject, html) {
  if (provider.type === 'brevo') {
    return sendWithBrevo({ to, subject, html, fromEmail: provider.fromEmail, fromName: provider.fromName });
  }
  return sendWithResend({ to, subject, html, apiKey: provider.apiKey, fromEmail: provider.fromEmail, fromName: provider.fromName });
}

function sleep(minS, maxS) {
  const ms = (Math.floor(Math.random() * (maxS - minS + 1)) + minS) * 1000;
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n' + '═'.repeat(62));
  console.log('📰 BOOSTIFY NEWS BLAST SENDER');
  console.log('═'.repeat(62));
  console.log(`📧 Type:     ${TYPE}`);
  console.log(`🎯 Audience: ${AUDIENCE}`);
  console.log(`📊 Max:      ${MAX_EMAILS}`);
  console.log(`🔄 Mode:     ${PREVIEW_MODE ? '⚠️  PREVIEW → ' + PREVIEW_EMAIL : '🔴 PRODUCTION'}`);
  console.log(`📬 Reply-to: ${REPLY_TO}`);
  console.log('─'.repeat(62));

  // Check Brevo quota if using it
  const { remainingToday } = await getBrevoQuota(pool);
  const effectiveMax = Math.min(MAX_EMAILS, remainingToday);
  if (effectiveMax <= 0 && (AUDIENCE === 'investors' || AUDIENCE === 'industry')) {
    console.log('⚠️  Brevo daily limit reached for today. Skipping.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  let sent = 0, errors = 0;

  try {
    // 1. Fetch articles from NeonDB
    console.log('\n📰 Fetching news articles from NeonDB (main app)...');
    const articleCount = TYPE === 'single' ? 1 : TYPE === 'featured' ? 1 : 3;
    const articles = await fetchArticles(articleCount, ARTICLE_ID);

    if (!articles.length) {
      console.log('❌ No published articles found in database.');
      return;
    }
    console.log(`✅ ${articles.length} article(s) loaded:`);
    articles.forEach(a => console.log(`   [${a.category}] ${a.title}`));

    // 2. Fetch leads
    const leads = await fetchLeads(client, AUDIENCE, effectiveMax);
    console.log(`\n📋 Leads: ${leads.length}`);

    if (!leads.length) {
      console.log('✅ No leads ready to send. All done.');
      return;
    }

    // 3. Pick provider
    const provider = await pickProvider(AUDIENCE);
    console.log(`📤 Provider: ${provider.type.toUpperCase()} — ${provider.fromEmail}`);

    // 4. Send
    for (const lead of leads) {
      const firstName = lead.first_name || lead.name?.split(' ')[0] || 'there';
      const toEmail = PREVIEW_MODE ? PREVIEW_EMAIL : lead.email;
      const subject = getSubject(TYPE, articles, firstName);
      const html = buildEmailHtml(TYPE, articles, firstName, AUDIENCE);

      console.log(`\n📧 [${sent + 1}/${leads.length}] ${firstName} <${toEmail}>`);
      console.log(`   📝 ${subject.substring(0, 70)}`);

      try {
        const result = await sendEmail(provider, toEmail, subject, html);

        if (result.error) throw new Error(result.error);

        console.log(`   ✅ Sent (${result.messageId})`);
        sent++;

        if (!PREVIEW_MODE) {
          // Log send
          await client.query(`
            INSERT INTO email_sends (lead_id, domain, template, subject, status)
            VALUES ($1, 'boostifymusic.com', $2, $3, 'sent')
            ON CONFLICT DO NOTHING
          `, [lead.id, `news_${TYPE}`, subject]).catch(() => {});

          // Update lead status
          if (lead.status_id) {
            await client.query(`
              UPDATE lead_status SET last_email_at = NOW(), emails_sent = COALESCE(emails_sent,0)+1 WHERE id = $1
            `, [lead.status_id]).catch(() => {});
          }
        }

        if (sent < leads.length) {
          const waitSec = Math.floor(Math.random() * 50) + 30;
          console.log(`   ⏳ Waiting ${waitSec}s...`);
          await sleep(30, 80);
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        errors++;
        await sleep(5, 15);
      }
    }

    // Record sends
    if (!PREVIEW_MODE && sent > 0) {
      const providerKey = provider.type === 'brevo' ? 'BREVO' : (provider.key || 'ARTISTS_1');
      await recordSends(pool, providerKey, sent);
    }

  } finally {
    client.release();
    await pool.end();
    await newsPool.end();
  }

  console.log('\n' + '═'.repeat(62));
  console.log('📊 RESUMEN FINAL');
  console.log('═'.repeat(62));
  console.log(`✅ Enviados:  ${sent}`);
  console.log(`❌ Errores:   ${errors}`);
  console.log(`📰 Tipo:      ${TYPE}`);
  console.log(`🎯 Audiencia: ${AUDIENCE}`);
  console.log(`📬 Reply-to:  ${REPLY_TO}`);
  console.log(`\n🌐 Ver noticias en: https://boostifymusic.com/news`);
}

run().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
