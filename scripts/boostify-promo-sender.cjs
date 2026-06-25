/**
 * 🚀 BOOSTIFY PLATFORM PROMO SENDER
 * 5-email sequence promoting Boostify's key features to artists & industry
 * 
 * Templates:
 *   1. platform_intro       — What is Boostify? Full platform overview
 *   2. ai_tools_showcase    — AI tools: promo clips, karaoke, music video
 *   3. distribution_cta     — Music distribution + streaming revenue
 *   4. community_social     — BoostiSwap + social feed + community
 *   5. last_chance_cta      — Urgency + free trial CTA
 * 
 * Routing: Uses smart router (Brevo for boostifymusic.com)
 * Reply-to: convoycubano@gmail.com
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.secrets') });

const { sendWithBrevo, sendWithResend, getBestArtistProvider, recordSends, getBrevoQuota, REPLY_TO, fetchContacts, markContacted, isMissingRelation } = require('./email-smart-router.cjs');

// ─── Parse Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

const TEMPLATE_ID = args.template || 'platform_intro';
const MAX_EMAILS = parseInt(args.max || '40'); // Safe default: 40 (well under Brevo 200 safe limit)
const PREVIEW_MODE = args.preview === 'true';
const PREVIEW_EMAIL = 'convoycubano@gmail.com';
const TARGET = args.target || 'artists'; // 'artists' | 'industry'

// ─── Database ──────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Sender config ─────────────────────────────────────────────────────────────
const FROM_EMAIL = TARGET === 'industry' ? 'info@boostifymusic.com' : 'artists@boostifymusic.com';
const FROM_NAME = 'Alex from Boostify';

// ─── Templates ─────────────────────────────────────────────────────────────────
const TEMPLATES = {
  platform_intro: {
    id: 'platform_intro',
    subject: '{{firstName}}, meet the platform built for artists like you',
    preheader: 'AI tools, distribution, community — all in one place',
  },
  ai_tools_showcase: {
    id: 'ai_tools_showcase',
    subject: '{{firstName}} — 12 AI tools your competitors are already using',
    preheader: 'Promo clips, karaoke, music video creator & more',
  },
  distribution_cta: {
    id: 'distribution_cta',
    subject: 'Your music should be on every platform — here\'s how',
    preheader: 'Unlimited distribution + keep 100% of your royalties',
  },
  community_social: {
    id: 'community_social',
    subject: '{{firstName}}, 5,000+ artists are collaborating. Are you?',
    preheader: 'BoostiSwap + Social Feed + Fan Connection',
  },
  last_chance_cta: {
    id: 'last_chance_cta',
    subject: '{{firstName}}, last chance to join Boostify for free',
    preheader: 'Your artist profile is waiting — set it up in 2 minutes',
  },
};

// ─── HTML Builder ──────────────────────────────────────────────────────────────
function buildEmail(templateId, firstName) {
  const subjectMap = {
    platform_intro: `${firstName}, meet the platform built for artists like you`,
    ai_tools_showcase: `${firstName} — 12 AI tools your competitors are already using`,
    distribution_cta: `Your music should be on every platform — here's how`,
    community_social: `${firstName}, 5,000+ artists are collaborating. Are you?`,
    last_chance_cta: `${firstName}, last chance to join Boostify for free`,
  };

  const subject = subjectMap[templateId] || subjectMap.platform_intro;
  const html = buildHtml(templateId, firstName);
  return { subject, html };
}

function buildHtml(templateId, firstName) {
  const bodyContent = getBodyContent(templateId, firstName);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boostify Music</title>
  <style>
    body,table,td,p,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    body{margin:0!important;padding:0!important;background-color:#0f172a}
    @media only screen and (max-width:600px){
      .container{width:100%!important}
      .mobile-pad{padding:24px 16px!important}
      .btn{display:block!important;width:100%!important;margin:8px 0!important;box-sizing:border-box!important}
      .stat{display:block!important;width:100%!important;margin-bottom:12px!important}
      .feat-grid td{display:block!important;width:100%!important;padding:12px!important}
      h1{font-size:26px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0f172a">
<tr><td align="center" style="padding:32px 16px;">

  <!-- Card -->
  <table class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

    <!-- TOP BANNER -->
    <tr>
      <td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 40%,#7c3aed 100%);padding:28px 32px;text-align:center;">
        <div style="font-size:13px;font-weight:700;color:#fff;letter-spacing:3px;text-transform:uppercase;opacity:0.85;margin-bottom:8px;">Boostify Music</div>
        <h1 style="margin:0;color:#fff;font-size:30px;font-weight:800;line-height:1.2;text-shadow:0 2px 8px rgba(0,0,0,0.3);">
          The AI Platform Built<br>for Independent Artists
        </h1>
        <p style="margin:10px 0 0 0;color:rgba(255,255,255,0.85);font-size:14px;">boostifymusic.com</p>
      </td>
    </tr>

    <!-- BODY -->
    <tr>
      <td class="mobile-pad" style="padding:36px 40px;">
        ${bodyContent}
      </td>
    </tr>

    <!-- MAIN CTA -->
    <tr>
      <td style="padding:0 40px 36px 40px;text-align:center;">
        <a href="https://boostifymusic.com/my-artists" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;text-decoration:none;padding:16px 36px;border-radius:10px;font-weight:800;font-size:15px;letter-spacing:0.4px;box-shadow:0 8px 24px rgba(249,115,22,0.4);">
          🚀 Start for Free at boostifymusic.com
        </a>
        <p style="margin:12px 0 0 0;font-size:11px;color:#64748b;">No credit card required &bull; Set up in 2 minutes</p>
      </td>
    </tr>

    <!-- FEATURES STRIP -->
    <tr>
      <td style="background:#0f172a;padding:24px 32px;">
        <table class="feat-grid" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding:12px 8px;">
              <div style="font-size:22px;">🎵</div>
              <div style="font-size:11px;font-weight:700;color:#f97316;margin-top:4px;">AI Song Tools</div>
            </td>
            <td align="center" style="padding:12px 8px;">
              <div style="font-size:22px;">🎬</div>
              <div style="font-size:11px;font-weight:700;color:#f97316;margin-top:4px;">Promo Clips</div>
            </td>
            <td align="center" style="padding:12px 8px;">
              <div style="font-size:22px;">🎤</div>
              <div style="font-size:11px;font-weight:700;color:#f97316;margin-top:4px;">Karaoke</div>
            </td>
            <td align="center" style="padding:12px 8px;">
              <div style="font-size:22px;">📦</div>
              <div style="font-size:11px;font-weight:700;color:#f97316;margin-top:4px;">Distribution</div>
            </td>
            <td align="center" style="padding:12px 8px;">
              <div style="font-size:22px;">🤝</div>
              <div style="font-size:11px;font-weight:700;color:#f97316;margin-top:4px;">BoostiSwap</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="background:#1e293b;border-top:1px solid #334155;padding:24px 32px;text-align:center;">
        <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#f8fafc;">Boostify Music</p>
        <p style="margin:0 0 6px 0;font-size:11px;color:#64748b;">
          A subsidiary of Omnia Strategics Holding Corporation &bull; Delaware, USA<br>
          1000 Brickell Ave, Office #75, Miami, FL 33131
        </p>
        <p style="margin:0 0 12px 0;font-size:11px;color:#475569;">
          📞 +1 (786) 987-6934 &bull; ✉️ info@boostifymusic.com
        </p>
        <p style="margin:0;font-size:11px;color:#334155;">
          <a href="https://boostifymusic.com" style="color:#f97316;text-decoration:none;">boostifymusic.com</a> &nbsp;&bull;&nbsp;
          <a href="https://boostifymusic.com/news" style="color:#60a5fa;text-decoration:none;">News</a> &nbsp;&bull;&nbsp;
          <a href="https://wefunder.com/boostify.music" style="color:#10b981;text-decoration:none;">Invest on Wefunder</a>
        </p>
        <p style="margin:12px 0 0 0;font-size:10px;color:#1e293b;">
          You received this because you're a music professional. <a href="https://boostifymusic.com/unsubscribe" style="color:#475569;">Unsubscribe</a>
        </p>
      </td>
    </tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
}

// ─── Body content per template ─────────────────────────────────────────────────
function getBodyContent(templateId, firstName) {
  switch (templateId) {
    case 'platform_intro': return `
      <p style="margin:0 0 18px;color:#e2e8f0;font-size:16px;line-height:1.7;">Hi ${firstName},</p>
      <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">
        Most artists spend 80% of their time on the business side — promotions, distribution, social media, fan engagement — 
        and only 20% actually creating. <strong style="color:#f97316;">We built Boostify to flip that ratio.</strong>
      </p>
      <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.7;">
        In one platform, you get AI-powered tools that handle everything: promo clips, karaoke experiences, music video creation, 
        distribution to 150+ stores, and a social community of 5,000+ independent artists.
      </p>
      <!-- Stats -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border-radius:12px;overflow:hidden;background:#0f172a;">
        <tr>
          <td class="stat" align="center" style="padding:20px 12px;border-right:1px solid #1e293b;">
            <div style="font-size:30px;font-weight:800;color:#f97316;">5,000+</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Artists</div>
          </td>
          <td class="stat" align="center" style="padding:20px 12px;border-right:1px solid #1e293b;">
            <div style="font-size:30px;font-weight:800;color:#10b981;">12</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">AI Tools</div>
          </td>
          <td class="stat" align="center" style="padding:20px 12px;">
            <div style="font-size:30px;font-weight:800;color:#6366f1;">150+</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Stores</div>
          </td>
        </tr>
      </table>
      <!-- Feature list -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        ${featureRow('🎬', 'AI Promo Clips', 'Turn any song into a professional promo video in 60 seconds', '#f97316')}
        ${featureRow('🎤', 'Karaoke Creator', 'Generate karaoke versions of your tracks for fan engagement', '#10b981')}
        ${featureRow('🎵', 'Music Video Creator', 'AI video creator trained by legendary directors', '#6366f1')}
        ${featureRow('📦', 'Distribution', 'Distribute to Spotify, Apple Music, TikTok & 150+ stores', '#f59e0b')}
      </table>
      <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.7;">
        Your artist profile is already waiting for you at 
        <a href="https://boostifymusic.com/my-artists" style="color:#f97316;text-decoration:none;font-weight:700;">boostifymusic.com</a>.
        Takes 2 minutes to set up.
      </p>`;

    case 'ai_tools_showcase': return `
      <p style="margin:0 0 18px;color:#e2e8f0;font-size:16px;line-height:1.7;">Hi ${firstName},</p>
      <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">
        While most artists are still doing everything manually, the top independent artists on Boostify are using 
        <strong style="color:#f97316;">12 AI tools</strong> that save them 20+ hours a week.
      </p>
      <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.7;">Here's what they have access to:</p>
      <!-- AI Tools Grid -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        ${aiToolRow('🎬', 'Promo Clip Generator', 'Auto-cut your song into scroll-stopping 30-60s clips', '#f97316')}
        ${aiToolRow('🎤', 'Karaoke Creator', 'Instant karaoke + lyrics for any track you upload', '#10b981')}
        ${aiToolRow('🎵', 'AI Music Video', 'Full music video from AI directors — no crew needed', '#6366f1')}
        ${aiToolRow('🖼️', 'Cover Art Generator', 'Professional album art powered by Midjourney-class AI', '#f59e0b')}
        ${aiToolRow('✍️', 'Bio Generator', 'Artist bio written by AI, trained on 10K music bios', '#ec4899')}
        ${aiToolRow('📊', 'Social Content', 'Auto-generate posts for Instagram, TikTok, Twitter', '#14b8a6')}
      </table>
      <p style="margin:0 0 24px;color:#cbd5e1;font-size:14px;line-height:1.7;">
        + 6 more tools for merch, lyrics, fan engagement, and more. All included in your free account at 
        <a href="https://boostifymusic.com" style="color:#f97316;font-weight:700;text-decoration:none;">boostifymusic.com</a>.
      </p>
      <div style="background:#0f172a;border-radius:10px;padding:16px 20px;border-left:4px solid #f97316;margin:0 0 0 0;">
        <p style="margin:0;color:#94a3b8;font-size:13px;font-style:italic;">
          "I used the promo clip tool and got 40K views on my first TikTok. Never had more than 200 before." — Independent artist on Boostify
        </p>
      </div>`;

    case 'distribution_cta': return `
      <p style="margin:0 0 18px;color:#e2e8f0;font-size:16px;line-height:1.7;">Hi ${firstName},</p>
      <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">
        Getting your music on Spotify, Apple Music, and TikTok shouldn't cost you $50/year and 15% of your royalties.
      </p>
      <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.7;">
        With Boostify Distribution, you keep <strong style="color:#10b981;">100% of your royalties</strong> and 
        get your music into 150+ stores worldwide — including every major platform.
      </p>
      <!-- Comparison -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-radius:12px;overflow:hidden;">
        <tr style="background:#1e3a5f;">
          <td style="padding:12px 16px;color:#60a5fa;font-size:12px;font-weight:700;width:50%;">Other Distributors</td>
          <td style="padding:12px 16px;color:#10b981;font-size:12px;font-weight:700;text-align:right;">Boostify</td>
        </tr>
        ${compareRow('15-20% royalty cut', '0% royalty cut ✅', '#ef4444', '#10b981')}
        ${compareRow('$30-50/year per album', 'Included free ✅', '#ef4444', '#10b981')}
        ${compareRow('Wait 2-5 weeks', 'Live in 48-72 hrs ✅', '#ef4444', '#10b981')}
        ${compareRow('No artist tools', '12 AI tools included ✅', '#ef4444', '#10b981')}
        ${compareRow('No community', '5,000+ artist network ✅', '#ef4444', '#10b981')}
      </table>
      <p style="margin:0 0 0 0;color:#94a3b8;font-size:13px;line-height:1.7;">
        Your music deserves to be heard everywhere. 
        <a href="https://boostifymusic.com/my-artists" style="color:#f97316;font-weight:700;text-decoration:none;">Start distributing for free →</a>
      </p>`;

    case 'community_social': return `
      <p style="margin:0 0 18px;color:#e2e8f0;font-size:16px;line-height:1.7;">Hi ${firstName},</p>
      <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">
        Building a music career alone is the hardest path. The artists who grow fastest have one thing in common: 
        <strong style="color:#f97316;">they collaborate.</strong>
      </p>
      <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.7;">
        Boostify's community features are designed to connect you with artists who can grow with you:
      </p>
      ${featureCard('🤝', 'BoostiSwap', 'Swap features with artists in your genre. Their audience hears you. Your audience hears them. Both grow.', '#6366f1', 'https://boostifymusic.com/boostiswap')}
      ${featureCard('📱', 'Artist Social Feed', 'Follow artists, share milestones, discover new music, engage your fans — all inside Boostify.', '#10b981', 'https://boostifymusic.com/explore')}
      ${featureCard('🌟', 'Featured Artists', 'Top artists get featured on the Boostify homepage, getting visibility to thousands of music fans.', '#f97316', 'https://boostifymusic.com/my-artists')}
      <p style="margin:24px 0 0;color:#64748b;font-size:13px;">
        5,000+ artists are already in the community. Join at 
        <a href="https://boostifymusic.com" style="color:#f97316;text-decoration:none;font-weight:700;">boostifymusic.com</a>
      </p>`;

    case 'last_chance_cta': return `
      <p style="margin:0 0 18px;color:#e2e8f0;font-size:16px;line-height:1.7;">Hi ${firstName},</p>
      <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">
        This is my last email about Boostify for a while. But before I go, I want to make sure you know exactly 
        what you'd be missing:
      </p>
      <!-- Value recap -->
      <div style="background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid #334155;border-radius:12px;padding:24px;margin:0 0 24px;">
        <p style="margin:0 0 16px;font-size:13px;font-weight:800;color:#f97316;text-transform:uppercase;letter-spacing:1px;">What you get FREE:</p>
        ${checkItem('Your own artist profile page at boostifymusic.com/artist/your-name')}
        ${checkItem('AI Promo Clip Generator — unlimited exports')}
        ${checkItem('Karaoke Creator for fan engagement')}
        ${checkItem('Music distribution to 150+ platforms (0% royalty cut)')}
        ${checkItem('BoostiSwap access — grow through artist collabs')}
        ${checkItem('Social feed + fan connection tools')}
        ${checkItem('AI Bio Generator + Cover Art tools')}
      </div>
      <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.7;">
        No credit card. No hidden fees. Just an account and 2 minutes to set it up.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="https://boostifymusic.com/my-artists" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;padding:18px 40px;border-radius:12px;font-weight:800;font-size:16px;box-shadow:0 8px 24px rgba(16,185,129,0.4);">
              ✅ Claim My Free Artist Profile
            </a>
          </td>
        </tr>
      </table>`;

    default: return getBodyContent('platform_intro', firstName);
  }
}

// ─── HTML helpers ──────────────────────────────────────────────────────────────
function featureRow(icon, title, desc, color) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #1e293b;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="width:44px;vertical-align:top;padding-top:2px;">
            <div style="background:${color}22;border-radius:8px;width:36px;height:36px;text-align:center;line-height:36px;font-size:18px;">${icon}</div>
          </td>
          <td style="padding-left:12px;">
            <div style="font-size:14px;font-weight:700;color:#f8fafc;">${title}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${desc}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function aiToolRow(icon, title, desc, color) {
  return `<tr>
    <td style="padding:8px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;border-radius:8px;">
        <tr>
          <td style="padding:12px 16px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:32px;font-size:20px;vertical-align:top;">${icon}</td>
                <td style="padding-left:12px;">
                  <div style="font-size:13px;font-weight:700;color:${color};">${title}</div>
                  <div style="font-size:12px;color:#64748b;margin-top:2px;">${desc}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function featureCard(icon, title, desc, color, url) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;background:#0f172a;border-radius:12px;border-left:4px solid ${color};">
    <tr>
      <td style="padding:16px 18px;">
        <div style="font-size:20px;margin-bottom:6px;">${icon} <span style="font-size:14px;font-weight:700;color:${color};">${title}</span></div>
        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;">${desc}</p>
        <a href="${url}" style="font-size:12px;color:${color};font-weight:700;text-decoration:none;">Explore ${title} →</a>
      </td>
    </tr>
  </table>`;
}

function compareRow(left, right, leftColor, rightColor) {
  return `<tr style="border-bottom:1px solid #1e293b;">
    <td style="padding:10px 16px;background:#0f172a;font-size:12px;color:${leftColor};">✗ ${left}</td>
    <td style="padding:10px 16px;background:#0f172a;font-size:12px;color:${rightColor};text-align:right;">✓ ${right}</td>
  </tr>`;
}

function checkItem(text) {
  return `<p style="margin:0 0 10px;font-size:13px;color:#e2e8f0;">
    <span style="color:#10b981;font-weight:800;margin-right:8px;">✓</span>${text}
  </p>`;
}

// ─── Random delay ──────────────────────────────────────────────────────────────
function delay(min, max) {
  const ms = (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n' + '═'.repeat(60));
  console.log('🚀 BOOSTIFY PLATFORM PROMO SENDER');
  console.log('═'.repeat(60));
  console.log(`📧 Template:  ${TEMPLATE_ID}`);
  console.log(`🎯 Target:    ${TARGET}`);
  console.log(`📊 Max:       ${MAX_EMAILS}`);
  console.log(`🔄 Mode:      ${PREVIEW_MODE ? '⚠️  PREVIEW → ' + PREVIEW_EMAIL : '🔴 PRODUCTION'}`);
  console.log(`📬 Reply-to:  ${REPLY_TO}`);
  console.log('─'.repeat(60));

  const template = TEMPLATES[TEMPLATE_ID];
  if (!template) {
    console.error(`❌ Unknown template: ${TEMPLATE_ID}`);
    console.log('Available:', Object.keys(TEMPLATES).join(', '));
    process.exit(1);
  }

  // Check Brevo quota first
  const { remainingToday } = await getBrevoQuota(pool);
  const effectiveMax = Math.min(MAX_EMAILS, remainingToday);
  if (effectiveMax <= 0) {
    console.log('⚠️  Brevo daily limit reached for today. Skipping.');
    await pool.end();
    return;
  }
  console.log(`📬 Effective limit: ${effectiveMax} emails (quota: ${remainingToday} remaining)`);

  const client = await pool.connect();
  let sent = 0;
  let errors = 0;

  try {
    // Fetch leads
    const segmentFilter = TARGET === 'industry'
      ? `AND (l.source IN ('linkedin_scrape','industry_contact','csv_import') OR l.job_title IS NOT NULL)`
      : `AND (l.source IN ('apify_leads','csv_import','manual') OR l.industry IS NULL OR l.industry ILIKE '%music%' OR l.industry ILIKE '%artist%')`;

    let leads;
    try {
      const res = await client.query(`
        SELECT l.*, ls.id as status_id, ls.emails_sent, ls.last_email_at
        FROM leads l
        LEFT JOIN lead_status ls ON l.id = ls.lead_id
        WHERE l.email IS NOT NULL
          AND l.unsubscribed IS NOT TRUE
          ${segmentFilter}
          AND (ls.last_email_at IS NULL OR ls.last_email_at < NOW() - INTERVAL '5 days')
        ORDER BY RANDOM()
        LIMIT $1
      `, [effectiveMax]);
      leads = res.rows;
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      console.log('ℹ️  leads table not found — using music_industry_contacts');
      leads = await fetchContacts(pool, {
        audience: TARGET === 'industry' ? 'industry' : 'artists',
        limit: effectiveMax,
        cooldownDays: 5,
      });
    }
    console.log(`\n📋 Leads disponibles: ${leads.length}`);

    if (!leads.length) {
      console.log('✅ No leads ready. All done.');
      return;
    }

    for (const lead of leads) {
      const firstName = lead.first_name || lead.name?.split(' ')[0] || 'there';
      const toEmail = PREVIEW_MODE ? PREVIEW_EMAIL : lead.email;
      const { subject, html } = buildEmail(TEMPLATE_ID, firstName);

      console.log(`\n📧 [${sent + 1}/${leads.length}] ${firstName} <${toEmail}>`);
      console.log(`   📝 ${subject}`);

      try {
        const result = await sendWithBrevo({ to: toEmail, subject, html, fromEmail: FROM_EMAIL, fromName: FROM_NAME });

        if (result.error) throw new Error(result.error);

        console.log(`   ✅ Sent: ${result.messageId}`);
        sent++;

        // Log to DB (non-preview)
        if (!PREVIEW_MODE) {
          await client.query(`
            INSERT INTO email_sends (lead_id, domain, template, subject, status)
            VALUES ($1, 'boostifymusic.com', $2, $3, 'sent')
            ON CONFLICT DO NOTHING
          `, [lead.id, TEMPLATE_ID, subject]).catch(() => {});

          if (lead.status_id) {
            await client.query(`
              UPDATE lead_status 
              SET last_email_at = NOW(), emails_sent = COALESCE(emails_sent,0)+1
              WHERE id = $1
            `, [lead.status_id]).catch(() => {});
          }

          // Mark contact (music_industry_contacts cooldown + counters)
          await markContacted(pool, lead.id);
        }

        if (sent < leads.length) {
          const wait = Math.floor(Math.random() * 50) + 30;
          console.log(`   ⏳ Waiting ${wait}s...`);
          await delay(30, 80);
        }

      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        errors++;
        await delay(5, 15);
      }
    }

    // Record sends for daily limit tracking
    if (!PREVIEW_MODE && sent > 0) {
      await recordSends(pool, 'BREVO', sent);
    }

  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMEN');
  console.log('═'.repeat(60));
  console.log(`✅ Enviados:  ${sent}`);
  console.log(`❌ Errores:   ${errors}`);
  console.log(`📧 Template:  ${template.id}`);
  console.log(`📬 Reply-to:  ${REPLY_TO}`);
}

run().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
