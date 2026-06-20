/**
 * 📺 YOUTUBE VIEWS - EMAIL SEQUENCE SENDER
 * 
 * Sends the 5-email sequence promoting YouTube Views
 * "10+ AI tools to grow your YouTube channel faster"
 * Uses Brevo (formerly Sendinblue) for boostifymusic.com domain
 * 
 * Usage:
 *   node youtube-views-sequence-sender.cjs --sequence=1 --max=50 --preview=true
 *   node youtube-views-sequence-sender.cjs --sequence=2 --max=100 --preview=false
 */

const { Pool } = require('pg');

// Load environment
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.secrets') }); // overrides .env // overrides .env // overrides .env // overrides .env

// Brevo API configuration
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

// Parse arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

const SEQUENCE_NUMBER = parseInt(args.sequence) || 1;
const MAX_EMAILS = parseInt(args.max) || 50;
const PREVIEW_MODE = args.preview === 'true' || args.preview === true || process.env.PREVIEW_MODE === 'true';
const PREVIEW_EMAIL = 'convoycubano@gmail.com';

// Database connection
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

// Configuration
const FROM_EMAIL = 'alex@boostifymusic.com';
const FROM_NAME = 'Alex from Boostify';
const REPLY_TO = ['convoycubano@gmail.com', 'alex@boostifymusic.com'];

// Función para enviar email via Brevo
async function sendBrevoEmail(to, subject, html, replyTo) {
  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: to }],
        replyTo: replyTo ? { email: Array.isArray(replyTo) ? replyTo[0] : replyTo } : undefined,
        subject,
        htmlContent: html
      })
    });
    
    const result = await response.json();
    
    if (result.messageId) {
      return { data: { id: result.messageId }, error: null };
    } else {
      return { data: null, error: { message: result.message || JSON.stringify(result) } };
    }
  } catch (error) {
    return { data: null, error: { message: error.message } };
  }
}

const URLS = {
  youtubeViews: 'https://boostifymusic.com/youtube-views',
  home: 'https://boostifymusic.com',
  news: 'https://boostifymusic.com/news',
  myArtists: 'https://boostifymusic.com/my-artists',
  producerTools: 'https://boostifymusic.com/producer-tools',
};

// ============================================================================
// EMAIL TEMPLATE WRAPPER (YouTube Red Theme)
// ============================================================================

function wrapInEmailTemplate(content, preheader = '') {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>YouTube Views - Grow Your Channel with AI</title>
  <style>
    * { box-sizing: border-box; }
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-spacing: 0; border-collapse: collapse; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    a { color: #ef4444; text-decoration: none; }
    
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; margin: 0 !important; }
      .mobile-padding { padding: 20px 16px !important; }
      .mobile-padding-header { padding: 25px 16px !important; }
      .cta-button { display: block !important; width: 100% !important; max-width: 100% !important; padding: 18px 20px !important; font-size: 16px !important; box-sizing: border-box !important; }
      .cta-button-wrapper { padding: 0 16px !important; width: 100% !important; }
      .hero-title { font-size: 26px !important; line-height: 1.2 !important; }
      .section-title { font-size: 20px !important; }
      .stat-number { font-size: 32px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a;">
  <div style="display: none; max-height: 0; overflow: hidden;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; background: #111111; border-radius: 24px; overflow: hidden; border: 1px solid #2a2a2a;">
          
          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%); padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="mobile-padding-header" style="padding: 40px 40px 30px 40px; text-align: center;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 20px auto;">
                      <tr>
                        <td style="background: rgba(0,0,0,0.3); padding: 12px 24px; border-radius: 50px;">
                          <span style="font-size: 20px; margin-right: 8px;">📺</span>
                          <span style="font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">YOUTUBE VIEWS</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 4px; font-weight: 600;">AI-Powered Growth Tools</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CONTENT -->
          <tr>
            <td class="mobile-padding" style="padding: 35px 40px 40px 40px; background: #111111;">
              ${content}
            </td>
          </tr>
          
          <!-- FOOTER -->
          <tr>
            <td style="background: #0a0a0a; padding: 30px 40px; border-top: 1px solid #2a2a2a;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 15px 0; font-size: 13px; color: #ffffff; font-weight: 600;">📺 YouTube Views by Boostify Music</p>
                    <p style="margin: 0 0 15px 0; font-size: 12px; color: #666666;">AI tools to grow your YouTube channel faster</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 12px auto;">
                      <tr>
                        <td style="padding: 0 8px;"><a href="${URLS.youtubeViews}" style="font-size: 11px; color: #ef4444; text-decoration: none;">📺 YouTube Views</a></td>
                        <td style="padding: 0 8px;"><a href="${URLS.news}" style="font-size: 11px; color: #60a5fa; text-decoration: none;">📰 News</a></td>
                        <td style="padding: 0 8px;"><a href="${URLS.home}" style="font-size: 11px; color: #f97316; text-decoration: none;">🌐 boostifymusic.com</a></td>
                      </tr>
                    </table>
                    <p style="margin: 0; font-size: 10px; color: #444444;">© 2026 Boostify Music • Built for creators</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// COMPONENTS
// ============================================================================

function ctaButton(text, url) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
      <tr>
        <td align="center" class="cta-button-wrapper">
          <a href="${url}" class="cta-button" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; padding: 18px 45px; border-radius: 12px; font-weight: 700; font-size: 16px; text-align: center; box-shadow: 0 8px 25px rgba(239, 68, 68, 0.35);">
            <span>${text}</span>
          </a>
        </td>
      </tr>
    </table>
  `;
}

function toolCard(emoji, title, description, accentColor = '#ef4444') {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
      <tr>
        <td style="padding: 20px; background: rgba(255,255,255,0.03); border-radius: 14px; border-left: 3px solid ${accentColor};">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="50" valign="top" style="padding-right: 15px;">
                <div style="width: 42px; height: 42px; background: linear-gradient(135deg, ${accentColor}33 0%, ${accentColor}11 100%); border-radius: 12px; text-align: center; line-height: 42px; font-size: 22px;">${emoji}</div>
              </td>
              <td valign="middle">
                <div style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">${title}</div>
                <div style="font-size: 13px; color: #888888; line-height: 1.5;">${description}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function statsRow(stats) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        ${stats.map((stat, i) => `
          <td width="${100/stats.length}%" style="text-align: center; padding: 20px 10px; background: rgba(239, 68, 68, 0.08); ${i === 0 ? 'border-radius: 12px 0 0 12px;' : i === stats.length - 1 ? 'border-radius: 0 12px 12px 0;' : ''} border-right: ${i < stats.length - 1 ? '1px solid rgba(239, 68, 68, 0.15)' : 'none'};">
            <div class="stat-number" style="font-size: 36px; font-weight: 800; color: #ef4444; margin-bottom: 5px;">${stat.value}</div>
            <div style="font-size: 11px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">${stat.label}</div>
          </td>
        `).join('')}
      </tr>
    </table>
  `;
}

function testimonialCard(quote, name, stats, emoji) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
      <tr>
        <td style="padding: 22px; background: rgba(255,255,255,0.02); border-radius: 16px; border-left: 4px solid #ef4444;">
          <div style="font-size: 28px; margin-bottom: 12px;">${emoji}</div>
          <p style="margin: 0 0 15px 0; font-size: 15px; color: #e0e0e0; line-height: 1.6; font-style: italic;">"${quote}"</p>
          <div style="font-size: 14px; font-weight: 700; color: #ef4444;">${name}</div>
          <div style="font-size: 12px; color: #666666;">${stats}</div>
        </td>
      </tr>
    </table>
  `;
}

// ============================================================================
// 5 EMAIL TEMPLATES
// ============================================================================

const EMAIL_TEMPLATES = {
  1: {
    subject: (lead) => `📺 ${lead.name}, why your YouTube videos aren't getting views`,
    preheader: "AI tools that predict viral potential before you publish",
    generateHTML: (lead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 32px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              Hey ${lead.name}! 👋<br>
              <span style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Your videos deserve more views.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999; line-height: 1.7; max-width: 450px;">
              The algorithm isn't random. It follows <strong style="color: #ffffff;">patterns that can be predicted.</strong>
            </p>
          </td>
        </tr>
      </table>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(239, 68, 68, 0.08); border-radius: 16px; border: 1px dashed rgba(239, 68, 68, 0.3);">
            <div style="font-size: 14px; color: #ef4444; font-weight: 600; margin-bottom: 12px;">❌ THE PROBLEM</div>
            <p style="margin: 0; font-size: 14px; color: #cccccc; line-height: 1.7;">
              You spend <strong>hours</strong> creating videos, only to get <strong>23 views</strong>.<br>
              Bad titles? Wrong keywords? Weak thumbnails?<br>
              <span style="color: #666666;">You're guessing. And guessing doesn't scale.</span>
            </p>
          </td>
        </tr>
      </table>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%); border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.25); text-align: center;">
            <div style="font-size: 14px; color: #10b981; text-transform: uppercase; letter-spacing: 3px; font-weight: 700; margin-bottom: 12px;">✨ THE SOLUTION</div>
            <div style="font-size: 28px; font-weight: 800; color: #ffffff; margin-bottom: 10px;">YouTube Views AI Suite</div>
            <div style="font-size: 15px; color: #aaaaaa;">10+ AI tools to predict, optimize, and grow</div>
          </td>
        </tr>
      </table>
      
      ${toolCard('🎯', 'Pre-Launch Score', 'AI predicts your video\'s viral potential before you publish', '#ef4444')}
      ${toolCard('🔑', 'Keywords Generator', 'Find the exact keywords that rank on YouTube', '#f97316')}
      ${toolCard('📝', 'Title Analyzer', 'Optimize titles for maximum click-through rate', '#10b981')}
      ${toolCard('🖼️', 'Thumbnail AI', 'Generate click-worthy thumbnails with AI', '#8b5cf6')}
      
      ${statsRow([
        { value: '+250%', label: 'Avg Views' },
        { value: '+180%', label: 'Subscribers' },
        { value: '10+', label: 'AI Tools' }
      ])}
      
      ${ctaButton('📺 Try YouTube Views Free', URLS.youtubeViews)}
    `, "AI tools that predict viral potential before you publish")
  },

  2: {
    subject: (lead) => `🛠️ ${lead.name}, 10 AI tools top YouTubers don't want you to know`,
    preheader: "The complete toolkit for YouTube domination",
    generateHTML: (lead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${lead.name}, here's the<br><span style="color: #ef4444;">complete arsenal.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999; line-height: 1.7;">
              10+ AI-powered tools. One dashboard. <strong style="color: #ffffff;">Total YouTube domination.</strong>
            </p>
          </td>
        </tr>
      </table>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 20px; background: rgba(239, 68, 68, 0.08); border-radius: 16px;">
            <div style="font-size: 12px; color: #ef4444; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; font-weight: 600;">🎬 BEFORE YOU PUBLISH</div>
            ${toolCard('🎯', 'Pre-Launch Score', 'Get a 0-100 score predicting viral potential', '#ef4444')}
            ${toolCard('🔑', 'Keywords Generator', 'AI finds low-competition, high-search keywords', '#ef4444')}
            ${toolCard('📝', 'Title Optimizer', 'Analyze CTR, SEO, and emotional impact', '#ef4444')}
          </td>
        </tr>
      </table>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 20px; background: rgba(249, 115, 22, 0.08); border-radius: 16px;">
            <div style="font-size: 12px; color: #f97316; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; font-weight: 600;">🎨 CREATE & OPTIMIZE</div>
            ${toolCard('🖼️', 'Thumbnail Generator', 'AI creates click-worthy thumbnails', '#f97316')}
            ${toolCard('📊', 'Competitor Analysis', 'Spy on what\'s working for competitors', '#f97316')}
            ${toolCard('📈', 'Trend Predictor', 'Know what\'s about to blow up', '#f97316')}
          </td>
        </tr>
      </table>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 20px; background: rgba(16, 185, 129, 0.08); border-radius: 16px;">
            <div style="font-size: 12px; color: #10b981; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; font-weight: 600;">🚀 SCALE & AUTOMATE</div>
            ${toolCard('📅', 'Content Calendar', 'AI plans your entire month of content', '#10b981')}
            ${toolCard('⚡', 'Auto-Optimization', 'Automatically improve underperforming videos', '#10b981')}
          </td>
        </tr>
      </table>
      
      ${ctaButton('🚀 Access All 10+ Tools Free', URLS.youtubeViews)}
    `, "The complete toolkit for YouTube domination")
  },

  3: {
    subject: (lead) => `🎯 ${lead.name}, know if your video will go viral BEFORE you publish`,
    preheader: "The Pre-Launch Score: Your crystal ball for YouTube",
    generateHTML: (lead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${lead.name}, what if you<br><span style="color: #ef4444;">knew before publishing?</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999; line-height: 1.7;">
              Our AI analyzes your title, description, and niche to predict performance.
            </p>
          </td>
        </tr>
      </table>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td align="center">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 10px auto;">
              <tr>
                <td style="padding: 20px 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%); border-radius: 16px; border: 2px solid #10b981; text-align: center;">
                  <div style="font-size: 48px; font-weight: 800; color: #10b981;">87/100</div>
                  <div style="font-size: 12px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">Viral Potential</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(239, 68, 68, 0.08); border-radius: 16px;">
            <div style="font-size: 14px; color: #ef4444; font-weight: 600; text-align: center; margin-bottom: 15px;">📋 YOUR SCORE INCLUDES</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="50%" style="padding: 8px;"><div style="font-size: 13px; color: #ffffff;">✅ Viral Score (0-100)</div></td>
                <td width="50%" style="padding: 8px;"><div style="font-size: 13px; color: #ffffff;">✅ View Prediction</div></td>
              </tr>
              <tr>
                <td width="50%" style="padding: 8px;"><div style="font-size: 13px; color: #ffffff;">✅ Strengths</div></td>
                <td width="50%" style="padding: 8px;"><div style="font-size: 13px; color: #ffffff;">✅ Weaknesses</div></td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 8px; text-align: center;"><div style="font-size: 13px; color: #ffffff;">✅ Specific Recommendations to Improve</div></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      ${ctaButton('🎯 Get Your Pre-Launch Score', URLS.youtubeViews)}
    `, "The Pre-Launch Score: Your crystal ball for YouTube")
  },

  4: {
    subject: (lead) => `🔥 "${lead.name}, from 200 to 50K subscribers in 3 months"`,
    preheader: "Real creators. Real results. Real growth.",
    generateHTML: (lead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${lead.name}, these creators<br><span style="color: #ef4444;">were exactly where you are.</span>
            </h1>
          </td>
        </tr>
      </table>
      
      ${testimonialCard(
        "I was stuck at 200 subscribers for a year. Started using Pre-Launch Score on every video. 6 months later: 50,000 subscribers.",
        "Jake Thompson",
        "Music Producer • 50K subs",
        "🎹"
      )}
      
      ${testimonialCard(
        "The Keywords Generator found a gap in my niche no one was targeting. Made ONE video on it. 500K views.",
        "Maria Santos",
        "Guitar Tutorial Channel • 120K subs",
        "🎸"
      )}
      
      ${testimonialCard(
        "Thumbnail AI is insane. My CTR went from 3% to 11%. Same content, just better thumbnails.",
        "DJ Nexus",
        "EDM Producer • 85K subs",
        "🎧"
      )}
      
      ${testimonialCard(
        "The Content Calendar planned my entire quarter. Consistency went up 300%. The algorithm noticed.",
        "Aria Beats",
        "Lofi Producer • 200K subs",
        "🎼"
      )}
      
      ${statsRow([
        { value: '2,000+', label: 'Creators' },
        { value: '+340%', label: 'Avg Growth' },
        { value: '4.9★', label: 'Rating' }
      ])}
      
      ${ctaButton('🔥 Join These Creators', URLS.youtubeViews)}
    `, "Real creators. Real results. Real growth.")
  },

  5: {
    subject: (lead) => `🎁 ${lead.name}, full YouTube Views access - free forever`,
    preheader: "No catch. No trial. Just free tools to grow.",
    generateHTML: (lead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 20px;">
            <div style="font-size: 60px; margin-bottom: 15px;">🎁</div>
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 32px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${lead.name}, this is<br><span style="color: #10b981;">actually free.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999;">No trial. No credit card. No catch.</p>
          </td>
        </tr>
      </table>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 35px 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%); border-radius: 20px; border: 2px solid #10b981; text-align: center;">
            <div style="font-size: 12px; color: #10b981; text-transform: uppercase; letter-spacing: 3px; font-weight: 700; margin-bottom: 12px;">🎉 FREE TIER INCLUDES</div>
            <div style="font-size: 48px; font-weight: 800; color: #ffffff; margin-bottom: 8px;">10+ Tools</div>
            <div style="font-size: 18px; color: #ffffff; margin-bottom: 15px;">Forever Free</div>
            <div style="display: inline-block; padding: 10px 20px; background: rgba(16, 185, 129, 0.2); border-radius: 25px; font-size: 13px; color: #10b981; font-weight: 600;">✓ No credit card required</div>
          </td>
        </tr>
      </table>
      
      ${toolCard('🎯', 'Pre-Launch Score', 'Predict viral potential before publishing', '#ef4444')}
      ${toolCard('🔑', 'Keywords Generator', 'Find ranking keywords for your niche', '#f97316')}
      ${toolCard('🖼️', 'Thumbnail AI', 'Generate click-worthy thumbnails', '#8b5cf6')}
      ${toolCard('📅', 'Content Calendar', 'Plan your entire month', '#10b981')}
      
      ${ctaButton('📺 Get Free Access Now', URLS.youtubeViews)}
      
      <p style="margin: 25px 0 0 0; font-size: 16px; color: #ffffff; text-align: center; line-height: 1.6;">
        2,000+ creators already growing.<br><strong style="color: #ef4444;">Your turn.</strong>
      </p>
      
      <p style="margin: 30px 0 0 0; font-size: 14px; color: #666666; text-align: center;">
        To your growth,<br><strong style="color: #ffffff;">— Alex & The Boostify Team</strong>
      </p>
    `, "Full access. Free forever. No catch.")
  }
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function getLeadsForSequence() {
  const client = await pool.connect();
  try {
    const prevSequence = SEQUENCE_NUMBER === 1 ? 'warming' : `youtube_sequence_${SEQUENCE_NUMBER - 1}`;
    
    const query = `
      SELECT id, email, name, artist_name, genre, lead_status
      FROM artist_leads
      WHERE lead_status IN ('new', 'warming', 'contacted', $1)
        AND email NOT LIKE '%test%'
        AND email NOT LIKE '%example%'
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const result = await client.query(query, [prevSequence, MAX_EMAILS]);
    return result.rows;
  } finally {
    client.release();
  }
}

async function sendEmail(lead, template) {
  const subject = template.subject(lead);
  const html = template.generateHTML(lead);
  const toEmail = PREVIEW_MODE ? PREVIEW_EMAIL : lead.email;
  
  try {
    const result = await sendBrevoEmail(
      toEmail,
      PREVIEW_MODE ? `[PREVIEW] ${subject}` : subject,
      html,
      REPLY_TO[0]
    );
    
    return { success: !result.error, id: result.data?.id };
  } catch (error) {
    console.error(`Error sending to ${toEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function updateLeadStatus(leadId, sequenceNumber) {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE artist_leads 
      SET lead_status = 'contacted',
          emails_sent = COALESCE(emails_sent, 0) + 1,
          last_email_at = NOW()
      WHERE id = $1
    `, [leadId]);
  } finally {
    client.release();
  }
}

async function logEmailSent(leadId, emailId, toEmail, subject) {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO email_logs (lead_id, resend_id, from_email, to_email, subject, email_type, status, sent_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'sent', NOW())
    `, [leadId, emailId, FROM_EMAIL, toEmail, subject, `youtube_sequence_${SEQUENCE_NUMBER}`]);
  } catch (error) {
    console.log('   ⚠️ Could not log to email_logs table');
  } finally {
    client.release();
  }
}

async function main() {
  console.log('═'.repeat(65));
  console.log('║   📺 YOUTUBE VIEWS - EMAIL SEQUENCE SENDER                    ║');
  console.log('═'.repeat(65));
  console.log(`📧 Sequence Email: #${SEQUENCE_NUMBER}/5`);
  console.log(`📊 Max Emails: ${MAX_EMAILS}`);
  console.log(`🔄 Preview Mode: ${PREVIEW_MODE ? 'ON (sending to ' + PREVIEW_EMAIL + ')' : 'OFF (real sends)'}`);
  console.log('─'.repeat(65));

  const template = EMAIL_TEMPLATES[SEQUENCE_NUMBER];
  if (!template) {
    console.log(`❌ Invalid sequence number: ${SEQUENCE_NUMBER}`);
    process.exit(1);
  }

  if (PREVIEW_MODE) {
    console.log('\n📧 Sending preview email...');
    const testLead = { id: 0, email: PREVIEW_EMAIL, name: 'Artist', artist_name: 'Test Artist', genre: 'Hip-Hop' };
    const result = await sendEmail(testLead, template);
    
    if (result.success) {
      console.log(`✅ Preview sent! ID: ${result.id}`);
    } else {
      console.log(`❌ Failed: ${result.error}`);
    }
  } else {
    const leads = await getLeadsForSequence();
    console.log(`\n📋 Found ${leads.length} leads for sequence #${SEQUENCE_NUMBER}`);

    let sent = 0, failed = 0;
    for (const lead of leads) {
      console.log(`\n📤 Sending to: ${lead.email}`);
      const result = await sendEmail(lead, template);
      
      if (result.success) {
        sent++;
        console.log(`   ✅ Sent! ID: ${result.id}`);
        await updateLeadStatus(lead.id, SEQUENCE_NUMBER);
        await logEmailSent(lead.id, result.id, lead.email, template.subject(lead));
      } else {
        failed++;
        console.log(`   ❌ Failed: ${result.error}`);
      }
      
      await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n' + '═'.repeat(65));
    console.log(`✅ COMPLETE: ${sent} sent, ${failed} failed`);
    console.log('═'.repeat(65));
  }

  await pool.end();
}

main().catch(console.error);
