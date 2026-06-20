/**
 * 🎵 ARTIST SEQUENCE SENDER - PROFESSIONAL HTML TEMPLATES
 * Envía los 10 emails HTML profesionales de la secuencia de artistas
 * Uses Brevo (formerly Sendinblue) for boostifymusic.com domain
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.secrets') }); // overrides .env

const { sendWithBrevo, sendWithResend, getBestArtistProvider, recordSends, REPLY_TO } = require('./email-smart-router.cjs');

// Brevo API configuration
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

// Parse arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

const SEQUENCE_NUMBER = parseInt(args.sequence || '1');
const MAX_EMAILS = parseInt(args.max || '50');
const PREVIEW_MODE = args.preview === 'true';
const PREVIEW_EMAIL = 'convoycubano@gmail.com';

// Database
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

// Configuration (usar dominio principal para secuencia HTML)
const FROM_EMAIL = 'artists@boostifymusic.com';
const FROM_NAME = 'Boostify Music';

// Wrapper using smart router — always includes reply-to convoycubano@gmail.com
async function sendBrevoEmail(to, subject, html) {
  const result = await sendWithBrevo({ to, subject, html, fromEmail: FROM_EMAIL, fromName: FROM_NAME });
  if (result.messageId) {
    return { data: { id: result.messageId }, error: null };
  } else {
    return { data: null, error: { message: result.error } };
  }
}

// ============================================
// EMAIL DESIGN SYSTEM - Orange Brand Palette
// ============================================
const EMAIL_STYLES = {
  primary: '#f97316',
  primaryDark: '#ea580c',
  secondary: '#10b981',
  dark: '#1a1a1a',
  light: '#f8fafc',
  gray: '#64748b',
  white: '#ffffff',
  headerGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
  ctaGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  darkGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
};

const BASE_URL = 'https://boostifymusic.com';

const URLS = {
  myArtists: `${BASE_URL}/my-artists`,
  artistExample: `${BASE_URL}/artist/birdie-krajcik`,
  artistBase: `${BASE_URL}/artist/`,
  boostiswap: `${BASE_URL}/boostiswap`,
  youtubeViews: `${BASE_URL}/youtube-views`,
  home: BASE_URL,
  news: `${BASE_URL}/news`,
  producerTools: `${BASE_URL}/producer-tools`,
  miniStudio: `${BASE_URL}/producer-tools?tab=ministudio`,
  explore: `${BASE_URL}/explore`,
  legacyCatalog: `${BASE_URL}/legacy-catalog-resurrection`,
};

// ============================================
// REUSABLE HTML COMPONENTS
// ============================================

function wrapInEmailTemplate(content, preheader = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Boostify Music - For Artists</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f1f5f9; }
    .email-body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding: 25px 20px !important; }
      .mobile-center { text-align: center !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-full-width { width: 100% !important; display: block !important; }
      .mobile-hide { display: none !important; }
      .mobile-btn { display: block !important; width: 100% !important; max-width: 100% !important; padding: 16px 20px !important; margin-bottom: 10px !important; box-sizing: border-box !important; font-size: 16px !important; }
      .stat-box { display: block !important; width: 100% !important; margin-bottom: 12px !important; padding: 18px 15px !important; }
      .stat-box div:first-child { font-size: 24px !important; }
      .feature-icon { font-size: 28px !important; }
      h1 { font-size: 24px !important; line-height: 1.3 !important; }
      h2 { font-size: 20px !important; }
      h3 { font-size: 18px !important; }
      p { font-size: 15px !important; line-height: 1.6 !important; }
      .screenshot-img { width: 100% !important; height: auto !important; }
    }
    @media only screen and (max-width: 400px) {
      .mobile-padding { padding: 20px 15px !important; }
      h1 { font-size: 22px !important; }
      .mobile-btn { padding: 14px 15px !important; font-size: 15px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9;">
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${preheader}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 30px 15px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <tr>
            <td style="background: ${EMAIL_STYLES.headerGradient}; padding: 25px 30px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">🎵 BOOSTIFY</div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">For Artists</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding: 35px 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background: ${EMAIL_STYLES.darkGradient}; padding: 30px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #ffffff;">🎵 Boostify Music</p>
                    <p style="margin: 0 0 15px 0; font-size: 12px; color: #94a3b8;">Empowering independent artists worldwide</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 6px;"><a href="${URLS.home}" style="font-size: 11px; color: #f97316; text-decoration: none;">🌐 Home</a></td>
                        <td style="padding: 0 6px;" class="mobile-hide"><a href="${URLS.myArtists}" style="font-size: 11px; color: #10b981; text-decoration: none;">🎨 Artist Page</a></td>
                        <td style="padding: 0 6px;" class="mobile-hide"><a href="${URLS.news}" style="font-size: 11px; color: #60a5fa; text-decoration: none;">📰 News</a></td>
                        <td style="padding: 0 6px;" class="mobile-hide"><a href="${URLS.producerTools}" style="font-size: 11px; color: #a78bfa; text-decoration: none;">🎛️ Studio</a></td>
                      </tr>
                    </table>
                    <p style="margin: 15px 0 0 0; font-size: 10px; color: #64748b;">© 2026 Boostify Music. All rights reserved.<br>
                    <a href="${URLS.home}/unsubscribe" style="color:#475569;text-decoration:underline;">Unsubscribe</a></p>
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

// ─── News Teaser Block (fetched from DB — dark theme) ────────────────────
const CATEGORY_COLORS = {
  'ai-music': '#f59e0b', 'platform-updates': '#6366f1', 'web3': '#10b981',
  'technology': '#3b82f6', 'partnerships': '#8b5cf6', 'artist-news': '#ec4899',
  'innovation': '#8b5cf6', 'industry-vision': '#f43f5e', 'autonomous-artists': '#f97316',
};
function newsTeaser(articles = []) {
  // Fallback articles if DB empty
  const items = articles.length > 0 ? articles.slice(0, 3) : [
    { title: 'Building Infrastructure for the Next Generation of Creative Entities', summary: 'How Boostify is revolutionizing music by creating sustainable infrastructure for artists through autonomous AI systems.', category: 'Industry Vision', categoryColor: '#f43f5e', slug: null },
    { title: 'Real-Time Analytics: Powering Smarter Music Careers', summary: 'Real-time analytics revolutionize artist careers by providing actionable insights. With Boostify\'s tools, musicians can make data-driven decisions.', category: 'Technology', categoryColor: '#3b82f6', slug: null },
    { title: 'Why the Music Industry\'s Manual Model is Collapsing', summary: 'The traditional music industry model is failing under the pressure of innovation. Discover how Boostify is redefining the standard.', category: 'Innovation', categoryColor: '#8b5cf6', slug: null },
  ];

  const cardHtml = items.map(a => {
    const articleUrl = a.slug ? `https://boostifymusic.com/news/${a.slug}` : URLS.news;
    const color = a.categoryColor || CATEGORY_COLORS[(a.category || '').toLowerCase().replace(/ /g, '-')] || '#f97316';
    return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:10px;">
      <tr>
        <td style="padding:14px 16px; background:#1e293b; border-radius:10px; border-left:4px solid ${color}; border:1px solid #334155; border-left:4px solid ${color};">
          <div style="font-size:9px; font-weight:700; color:${color}; text-transform:uppercase; letter-spacing:1.2px; margin-bottom:5px;">${a.category || 'Boostify News'}</div>
          <div style="font-size:13px; font-weight:700; color:#e2e8f0; line-height:1.3; margin-bottom:5px;">${a.title}</div>
          <div style="font-size:12px; color:#94a3b8; line-height:1.5; margin-bottom:8px;">${(a.summary || '').slice(0,130)}${(a.summary || '').length > 130 ? '…' : ''}</div>
          <a href="${articleUrl}" style="font-size:11px; font-weight:700; color:${color}; text-decoration:none;">Read full article →</a>
        </td>
      </tr>
    </table>`;
  });

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0; background:#0f172a; border-radius:12px; padding:4px; border:1px solid #1e293b;">
      <tr>
        <td style="padding:18px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:14px;">
            <tr>
              <td>
                <div style="font-size:15px; font-weight:800; color:#f8fafc;">📰 Latest from Boostify</div>
                <div style="font-size:11px; color:#475569; margin-top:2px;">Industry insights &amp; platform updates</div>
              </td>
              <td align="right">
                <a href="${URLS.news}" style="font-size:11px; font-weight:700; color:#f97316; text-decoration:none; white-space:nowrap;">All news →</a>
              </td>
            </tr>
          </table>
          ${cardHtml.join('')}
        </td>
      </tr>
    </table>`;
}

// ─── Improved CTA Button ─────────────────────────────────────────────────────
function ctaButton(text, url, primary = true) {
  const bgStyle = primary 
    ? `background: ${EMAIL_STYLES.ctaGradient};`
    : `background: ${EMAIL_STYLES.headerGradient};`;
  
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="text-align: center;">
          <a href="${url}" class="mobile-btn" style="display: inline-block; ${bgStyle} color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; text-align: center; max-width: 280px; box-sizing: border-box;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

function statsBox(value, label, emoji = '') {
  return `
    <td class="stat-box" style="padding: 15px; text-align: center; background: linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0.03) 100%); border-radius: 12px;">
      <div style="font-size: 28px; font-weight: 800; color: #f97316;">${emoji}${value}</div>
      <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">${label}</div>
    </td>`;
}

function featureCard(emoji, title, description) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
      <tr>
        <td style="padding: 18px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(249, 115, 22, 0.02) 100%); border-radius: 12px; border-left: 4px solid #f97316;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="45" valign="top" style="padding-right: 12px;">
                <div class="feature-icon" style="font-size: 28px; line-height: 1;">${emoji}</div>
              </td>
              <td valign="top">
                <div style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; line-height: 1.3;">${title}</div>
                <div style="font-size: 13px; color: #64748b; line-height: 1.5;">${description}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function artistPagePreview() {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px;">
          <img src="https://i.ibb.co/216fRF78/IMG-3127.jpg" alt="Boostify Artist Page Preview" style="width: 100%; height: auto; border-radius: 8px; display: block;" />
          <p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">✨ This is what YOUR artist page could look like</p>
        </td>
      </tr>
    </table>`;
}

function analyticsPreview() {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #0f172a; border-radius: 8px; padding: 15px;">
            <tr>
              <td style="padding: 10px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" style="padding: 10px; background: rgba(249, 115, 22, 0.1); border-radius: 8px;">
                      <div style="font-size: 22px; font-weight: 800; color: #f97316;">2,547</div>
                      <div style="font-size: 10px; color: #94a3b8;">VISITORS</div>
                    </td>
                    <td width="10"></td>
                    <td align="center" style="padding: 10px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;">
                      <div style="font-size: 22px; font-weight: 800; color: #10b981;">+34%</div>
                      <div style="font-size: 10px; color: #94a3b8;">GROWTH</div>
                    </td>
                    <td width="10"></td>
                    <td align="center" style="padding: 10px; background: rgba(96, 165, 250, 0.1); border-radius: 8px;">
                      <div style="font-size: 22px; font-weight: 800; color: #60a5fa;">8,312</div>
                      <div style="font-size: 10px; color: #94a3b8;">PLAYS</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 15px 10px 10px 10px;">
                <div style="font-size: 12px; color: #ffffff; font-weight: 600; margin-bottom: 10px;">📈 Visitors This Week</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" style="padding: 0 3px;"><div style="height: 40px; width: 100%; background: linear-gradient(to top, #f97316, rgba(249, 115, 22, 0.3)); border-radius: 4px 4px 0 0;"></div><div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Mon</div></td>
                    <td align="center" style="padding: 0 3px;"><div style="height: 55px; width: 100%; background: linear-gradient(to top, #f97316, rgba(249, 115, 22, 0.3)); border-radius: 4px 4px 0 0;"></div><div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Tue</div></td>
                    <td align="center" style="padding: 0 3px;"><div style="height: 35px; width: 100%; background: linear-gradient(to top, #f97316, rgba(249, 115, 22, 0.3)); border-radius: 4px 4px 0 0;"></div><div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Wed</div></td>
                    <td align="center" style="padding: 0 3px;"><div style="height: 70px; width: 100%; background: linear-gradient(to top, #10b981, rgba(16, 185, 129, 0.3)); border-radius: 4px 4px 0 0;"></div><div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Thu</div></td>
                    <td align="center" style="padding: 0 3px;"><div style="height: 60px; width: 100%; background: linear-gradient(to top, #f97316, rgba(249, 115, 22, 0.3)); border-radius: 4px 4px 0 0;"></div><div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Fri</div></td>
                    <td align="center" style="padding: 0 3px;"><div style="height: 80px; width: 100%; background: linear-gradient(to top, #10b981, rgba(16, 185, 129, 0.3)); border-radius: 4px 4px 0 0;"></div><div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Sat</div></td>
                    <td align="center" style="padding: 0 3px;"><div style="height: 50px; width: 100%; background: linear-gradient(to top, #f97316, rgba(249, 115, 22, 0.3)); border-radius: 4px 4px 0 0;"></div><div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Sun</div></td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">📊 Your real-time analytics dashboard</p>
        </td>
      </tr>
    </table>`;
}

// ============================================
// 10 EMAIL TEMPLATES - PROFESSIONAL HTML
// ============================================

function generateEmail1(artistName) {
  return wrapInEmailTemplate(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 25px;">
          <img src="https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png" alt="Boostify Music" width="80" height="80" style="display: block; width: 80px; height: 80px;" />
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 30px;">
          <h1 style="margin: 0 0 15px 0; font-size: 28px; font-weight: 800; color: #1a1a1a; line-height: 1.2;">
            Hey ${artistName}! 👋<br>
            <span style="color: #f97316;">Your music deserves to be heard.</span>
          </h1>
          <p style="margin: 0; font-size: 16px; color: #64748b; line-height: 1.6;">
            We built Boostify because independent artists like you need professional tools without the professional price tag.
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr class="mobile-stack">
              ${statsBox('5,000+', 'Active Artists', '')}
              ${statsBox('2.3M', 'Monthly Visits', '')}
              ${statsBox('FREE', 'Forever', '💯')}
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${artistPagePreview()}
    <h2 style="margin: 30px 0 20px 0; font-size: 20px; font-weight: 700; color: #1a1a1a;">
      What you get with your artist page:
    </h2>
    ${featureCard('🎨', 'Professional Design', 'Beautiful templates designed by music industry experts that make your brand shine.')}
    ${featureCard('🔗', 'All Your Links', 'Spotify, Apple Music, YouTube, Instagram, TikTok... everything in one place.')}
    ${featureCard('📊', 'Real-Time Analytics', "Know who's visiting, where they're from, and what they're interested in.")}
    ${featureCard('🎵', 'Embedded Player', 'Your music playing directly on your page. No redirects needed.')}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 35px 0 20px 0;">
      <tr>
        <td align="center" style="padding: 30px; background: ${EMAIL_STYLES.headerGradient}; border-radius: 16px;">
          <h3 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
            Ready to stand out?
          </h3>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: rgba(255,255,255,0.9);">
            Create your page in 5 minutes. No credit card required.
          </p>
          ${ctaButton('🎨 CREATE MY FREE PAGE', URLS.myArtists)}
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding: 10px 0 5px 0;">
          <p style="margin: 0; font-size: 13px; color: #64748b;">
            See a live example: 
            <a href="${URLS.artistExample}" style="color: #f97316; text-decoration: none; font-weight: 600;">View Artist Profile →</a>
          </p>
        </td>
      </tr>
    </table>
    ${newsTeaser(EMAIL_NEWS_CACHE)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">
      <tr>
        <td style="padding:18px; background:linear-gradient(135deg,#1e293b,#0f172a); border-radius:12px; text-align:center;">
          <div style="font-size:13px; font-weight:700; color:#ffffff; margin-bottom:10px;">🎛️ New: Mini Studio — Make Music Right in Your Browser</div>
          <div style="font-size:12px; color:#94a3b8; margin-bottom:14px;">Record, mix, master and release tracks with AI — no software needed.</div>
          ${ctaButton('🎧 OPEN MINI STUDIO', URLS.miniStudio, false)}
        </td>
      </tr>
    </table>
  `, 'Create your professional artist page for FREE - Boostify Music');
}

function generateEmail2(artistName) {
  return wrapInEmailTemplate(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 15px;">
          <img src="https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png" alt="Boostify Music" width="60" height="60" style="display: block; width: 60px; height: 60px;" />
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 20px;">
          <span style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; font-size: 11px; font-weight: 800; padding: 6px 16px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
            ✨ 100% FREE FOREVER
          </span>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 30px;">
          <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a; line-height: 1.3;">
            Generate Your<br>
            <span style="color: #f97316;">Complete Artist Profile</span><br>
            <span style="font-size: 20px;">in Just 60 Seconds</span>
          </h1>
          <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6;">
            Hey ${artistName}! No design skills needed.<br>Just enter your name and let our AI do the magic.
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px;">
      <tr>
        <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 20px; overflow: hidden;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 18px 20px; background: rgba(249, 115, 22, 0.15); border-bottom: 1px solid rgba(249, 115, 22, 0.2);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <span style="font-size: 20px; vertical-align: middle;">⚡</span>
                      <span style="font-size: 15px; font-weight: 700; color: #ffffff; vertical-align: middle; margin-left: 8px;">Artist Generator</span>
                    </td>
                    <td align="right">
                      <span style="background: #10b981; color: #ffffff; font-size: 10px; font-weight: 700; padding: 5px 12px; border-radius: 12px;">FREE</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
                  <tr>
                    <td width="40" valign="top">
                      <div style="width: 32px; height: 32px; background: rgba(249, 115, 22, 0.25); border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🎨</div>
                    </td>
                    <td valign="middle" style="padding-left: 12px;">
                      <div style="font-size: 14px; font-weight: 700; color: #ffffff;">Professional Landing Page</div>
                      <div style="font-size: 12px; color: #94a3b8;">boostifymusic.com/artist/<span style="color: #f97316;">your-name</span></div>
                    </td>
                    <td width="28" align="right" valign="middle">
                      <div style="width: 22px; height: 22px; background: #10b981; border-radius: 50%; text-align: center; line-height: 22px; color: #fff; font-size: 12px; font-weight: 700;">✓</div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
                  <tr>
                    <td width="40" valign="top">
                      <div style="width: 32px; height: 32px; background: rgba(249, 115, 22, 0.25); border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🖼️</div>
                    </td>
                    <td valign="middle" style="padding-left: 12px;">
                      <div style="font-size: 14px; font-weight: 700; color: #ffffff;">AI-Generated Cover Art</div>
                      <div style="font-size: 12px; color: #94a3b8;">Unique images for profile & socials</div>
                    </td>
                    <td width="28" align="right" valign="middle">
                      <div style="width: 22px; height: 22px; background: #10b981; border-radius: 50%; text-align: center; line-height: 22px; color: #fff; font-size: 12px; font-weight: 700;">✓</div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
                  <tr>
                    <td width="40" valign="top">
                      <div style="width: 32px; height: 32px; background: rgba(249, 115, 22, 0.25); border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🎵</div>
                    </td>
                    <td valign="middle" style="padding-left: 12px;">
                      <div style="font-size: 14px; font-weight: 700; color: #ffffff;">Auto Music Integration</div>
                      <div style="font-size: 12px; color: #94a3b8;">Spotify, Apple Music, YouTube embedded</div>
                    </td>
                    <td width="28" align="right" valign="middle">
                      <div style="width: 22px; height: 22px; background: #10b981; border-radius: 50%; text-align: center; line-height: 22px; color: #fff; font-size: 12px; font-weight: 700;">✓</div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
                  <tr>
                    <td width="40" valign="top">
                      <div style="width: 32px; height: 32px; background: rgba(249, 115, 22, 0.25); border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">📝</div>
                    </td>
                    <td valign="middle" style="padding-left: 12px;">
                      <div style="font-size: 14px; font-weight: 700; color: #ffffff;">AI-Written Bio</div>
                      <div style="font-size: 12px; color: #94a3b8;">Professional description for your genre</div>
                    </td>
                    <td width="28" align="right" valign="middle">
                      <div style="width: 22px; height: 22px; background: #10b981; border-radius: 50%; text-align: center; line-height: 22px; color: #fff; font-size: 12px; font-weight: 700;">✓</div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="40" valign="top">
                      <div style="width: 32px; height: 32px; background: rgba(249, 115, 22, 0.25); border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">📊</div>
                    </td>
                    <td valign="middle" style="padding-left: 12px;">
                      <div style="font-size: 14px; font-weight: 700; color: #ffffff;">Real-Time Analytics</div>
                      <div style="font-size: 12px; color: #94a3b8;">Track visitors, plays & engagement</div>
                    </td>
                    <td width="28" align="right" valign="middle">
                      <div style="width: 22px; height: 22px; background: #10b981; border-radius: 50%; text-align: center; line-height: 22px; color: #fff; font-size: 12px; font-weight: 700;">✓</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px;">
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="47%" style="padding: 16px 10px; background: #fef2f2; border-radius: 14px; text-align: center; border: 2px solid #fecaca;">
                <div style="font-size: 9px; color: #b91c1c; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">❌ The old way</div>
                <div style="font-size: 30px; font-weight: 800; color: #dc2626; margin: 4px 0;">8+ hrs</div>
                <div style="font-size: 10px; color: #b91c1c;">Design, code, configure...</div>
              </td>
              <td width="6%" align="center">
                <div style="font-size: 20px; color: #cbd5e1;">→</div>
              </td>
              <td width="47%" style="padding: 16px 10px; background: #ecfdf5; border-radius: 14px; text-align: center; border: 2px solid #6ee7b7;">
                <div style="font-size: 9px; color: #047857; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">⚡ With Boostify</div>
                <div style="font-size: 30px; font-weight: 800; color: #059669; margin: 4px 0;">60 sec</div>
                <div style="font-size: 10px; color: #047857;">One click, done!</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
      <tr>
        <td style="padding: 28px 20px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 18px; text-align: center;">
          <div style="font-size: 12px; color: rgba(255,255,255,0.95); margin-bottom: 6px; font-weight: 500;">✨ No credit card • No commitment</div>
          <h3 style="margin: 0 0 16px 0; font-size: 19px; font-weight: 800; color: #ffffff; line-height: 1.3;">
            Ready to create your FREE page?
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center">
                <a href="${URLS.myArtists}" class="mobile-btn" style="display: inline-block; background: #ffffff; color: #ea580c; text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: 800; font-size: 15px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                  ⚡ GENERATE MY FREE PAGE
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding: 10px 0;">
          <p style="margin: 0; font-size: 13px; color: #64748b;">
            🎵 <strong style="color: #1a1a1a;">2,847 artists</strong> created their FREE pages this week
          </p>
        </td>
      </tr>
    </table>
  `, 'Generate your FREE artist profile in 60 seconds - Boostify Music');
}

function generateEmail3(artistName) {
  return wrapInEmailTemplate(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 15px;">
          <img src="https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png" alt="Boostify Music" width="60" height="60" style="display: block; width: 60px; height: 60px;" />
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 25px;">
          <div style="font-size: 50px; margin-bottom: 15px;">🤝</div>
          <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a;">
            Imagine having a network of artists<br>
            <span style="color: #f97316;">supporting each other</span>
          </h1>
          <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6; max-width: 450px;">
            BoostiSwap is our exclusive community where artists exchange real support: streams, shares, features, and more.
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px;">
          <img src="https://i.ibb.co/RGFyNSLg/IMG-3131.jpg" alt="BoostiSwap Preview" style="width: 100%; height: auto; border-radius: 10px; display: block;" />
          <p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">🔄 Artists connecting and collaborating in real-time</p>
        </td>
      </tr>
    </table>
    <h2 style="margin: 25px 0 20px 0; font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: center;">
      How BoostiSwap Works:
    </h2>
    ${featureCard('1️⃣', 'Create Your Artist Profile', "Share your music and what you're looking for (collabs, playlist adds, features...)")}
    ${featureCard('2️⃣', 'Get Matched', 'Our algorithm pairs you with artists in your genre who complement your style.')}
    ${featureCard('3️⃣', 'Exchange Support', 'Streams, shares, comments, features... grow together!')}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        ${statsBox('2,500+', 'Swaps Completed', '')}
        <td width="15"></td>
        ${statsBox('850+', 'Active Artists', '')}
        <td width="15"></td>
        ${statsBox('45K', 'Connections', '')}
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td align="center">
          ${ctaButton('🤝 JOIN BOOSTISWAP', URLS.boostiswap)}
          <p style="margin: 15px 0 0 0; font-size: 12px; color: #64748b;">
            100% free. No commitments.
          </p>
        </td>
      </tr>
    </table>
  `, 'Connect with artists for collaborations on BoostiSwap');
}

function generateEmail4(artistName) {
  return wrapInEmailTemplate(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 25px;">
          <div style="font-size: 50px; margin-bottom: 15px;">📺</div>
          <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a;">
            Your videos deserve<br>
            <span style="color: #f97316;">more views on YouTube</span>
          </h1>
          <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6;">
            ${artistName}, we know how hard it is to stand out on YouTube. That's why we built tools that actually work.
          </p>
        </td>
      </tr>
    </table>
    ${featureCard('🎯', 'SEO Optimization', 'We help you optimize titles, descriptions, and tags so YouTube recommends your videos.')}
    ${featureCard('📊', 'Competition Analysis', 'See what successful artists in your genre are doing and replicate their strategy.')}
    ${featureCard('🔔', 'Subscriber Community', 'Connect with real fans who want to discover new music.')}
    ${featureCard('📱', 'Cross-Promotion', 'Share your video across our artist network for maximum exposure.')}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 30px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(239, 68, 68, 0.1) 100%); border-radius: 16px; text-align: center;">
          <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
            Average results from our artists:
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" style="padding: 10px;">
                <div style="font-size: 32px; font-weight: 800; color: #ef4444;">+250%</div>
                <div style="font-size: 11px; color: #64748b;">More Views</div>
              </td>
              <td align="center" style="padding: 10px;">
                <div style="font-size: 32px; font-weight: 800; color: #f97316;">+180%</div>
                <div style="font-size: 11px; color: #64748b;">More Subs</div>
              </td>
              <td align="center" style="padding: 10px;">
                <div style="font-size: 32px; font-weight: 800; color: #10b981;">+320%</div>
                <div style="font-size: 11px; color: #64748b;">Engagement</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td align="center">
          ${ctaButton('📈 BOOST MY YOUTUBE', URLS.youtubeViews)}
        </td>
      </tr>
    </table>
  `, 'Multiply your YouTube views with Boostify tools');
}

function generateEmail5(artistName) {
  return wrapInEmailTemplate(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 15px;">
          <img src="https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png" alt="Boostify Music" width="60" height="60" style="display: block; width: 60px; height: 60px;" />
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 20px;">
          <span style="display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; font-size: 11px; font-weight: 800; padding: 8px 18px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
            ⚠️ REMINDER - DON'T MISS OUT
          </span>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 25px;">
          <h1 style="margin: 0 0 15px 0; font-size: 28px; font-weight: 800; color: #1a1a1a; line-height: 1.25;">
            Hey ${artistName}! 👋<br>
            <span style="color: #f97316;">We saved your spot.</span>
          </h1>
          <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6;">
            Your FREE artist page is still waiting for you.<br>It only takes 60 seconds to create.
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="padding: 25px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 18px; text-align: center;">
          <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">🔴 LIVE - Artists who joined this week</div>
          <div style="font-size: 48px; font-weight: 900; color: #f97316; line-height: 1;">847</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 8px;">and counting...</div>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 25px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 16px; border: 2px solid #fecaca;">
          <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 700; color: #b91c1c; text-align: center;">
            ❌ What you're missing right now:
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td style="padding: 8px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="30"><span style="font-size: 16px;">😢</span></td><td style="font-size: 14px; color: #7f1d1d;">Fans can't find all your music in one place</td></tr></table></td></tr>
            <tr><td style="padding: 8px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="30"><span style="font-size: 16px;">📉</span></td><td style="font-size: 14px; color: #7f1d1d;">Losing potential streams every day</td></tr></table></td></tr>
            <tr><td style="padding: 8px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="30"><span style="font-size: 16px;">🚫</span></td><td style="font-size: 14px; color: #7f1d1d;">Missing collaboration opportunities</td></tr></table></td></tr>
            <tr><td style="padding: 8px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="30"><span style="font-size: 16px;">👀</span></td><td style="font-size: 14px; color: #7f1d1d;">Labels and curators can't discover you</td></tr></table></td></tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 25px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 16px; border: 2px solid #6ee7b7;">
          <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 700; color: #047857; text-align: center;">
            ✅ What you GET in 60 seconds:
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td style="padding: 8px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="30"><span style="font-size: 16px;">🎨</span></td><td style="font-size: 14px; color: #065f46; font-weight: 500;">Professional landing page with your music</td></tr></table></td></tr>
            <tr><td style="padding: 8px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="30"><span style="font-size: 16px;">📊</span></td><td style="font-size: 14px; color: #065f46; font-weight: 500;">Real-time analytics & visitor tracking</td></tr></table></td></tr>
            <tr><td style="padding: 8px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="30"><span style="font-size: 16px;">🤝</span></td><td style="font-size: 14px; color: #065f46; font-weight: 500;">Access to BoostiSwap collaborations</td></tr></table></td></tr>
            <tr><td style="padding: 8px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="30"><span style="font-size: 16px;">🔗</span></td><td style="font-size: 14px; color: #065f46; font-weight: 500;">One link for ALL your platforms</td></tr></table></td></tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 30px 20px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 18px; text-align: center;">
          <div style="font-size: 13px; color: rgba(255,255,255,0.95); margin-bottom: 8px;">⏰ Limited spots at current capacity</div>
          <h3 style="margin: 0 0 18px 0; font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.3;">
            Claim your page NOW
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center">
                <a href="${URLS.myArtists}" class="mobile-btn" style="display: inline-block; background: #ffffff; color: #ea580c; text-decoration: none; padding: 16px 35px; border-radius: 12px; font-weight: 800; font-size: 16px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                  🚀 GET MY FREE PAGE NOW
                </a>
              </td>
            </tr>
          </table>
          <p style="margin: 15px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.8);">
            No credit card • Takes 60 seconds • FREE forever
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding: 15px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #f97316;">
          <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
            <strong style="color: #1a1a1a;">P.S.</strong> ${artistName}, we really believe in your music. Don't let this opportunity slip away. 847 artists joined this week - will you be next? 🎵
          </p>
        </td>
      </tr>
    </table>
  `, 'Your FREE artist page is waiting - claim it now');
}

function generateEmail6(artistName) {
  return wrapInEmailTemplate(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr><td align="center" style="padding-bottom: 15px;"><img src="https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png" alt="Boostify Music" width="60" height="60" style="display: block; width: 60px; height: 60px;" /></td></tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 25px;">
          <div style="font-size: 40px; margin-bottom: 10px;">💬</div>
          <h1 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 800; color: #1a1a1a; line-height: 1.3;">Real Artists.<br><span style="color: #f97316;">Real Results.</span></h1>
          <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.5;">${artistName}, don't just take our word for it.</p>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
      <tr>
        <td style="padding: 25px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 18px;">
          <div style="font-size: 32px; margin-bottom: 15px;">⭐⭐⭐⭐⭐</div>
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #ffffff; line-height: 1.6; font-style: italic;">"Before Boostify, I was invisible. Now I have <span style="color: #f97316; font-weight: 700;">15K+ monthly visitors</span> to my artist page. Labels are reaching out. This is insane."</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="45"><div style="width: 40px; height: 40px; background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 50%; text-align: center; line-height: 40px; font-size: 18px;">🎤</div></td><td style="padding-left: 12px;"><div style="font-size: 14px; font-weight: 700; color: #ffffff;">Carlos Mendoza</div><div style="font-size: 12px; color: #94a3b8;">Reggaeton · Colombia · <span style="color: #10b981;">+340% streams</span></div></td></tr></table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
      <tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
        <td width="32%" style="padding: 15px 8px; background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; text-align: center;"><div style="font-size: 24px; font-weight: 800; color: #92400e;">5,000+</div><div style="font-size: 10px; color: #a16207; text-transform: uppercase;">Artists</div></td>
        <td width="2%"></td>
        <td width="32%" style="padding: 15px 8px; background: linear-gradient(135deg, #d1fae5, #a7f3d0); border-radius: 12px; text-align: center;"><div style="font-size: 24px; font-weight: 800; color: #047857;">98%</div><div style="font-size: 10px; color: #065f46; text-transform: uppercase;">Satisfied</div></td>
        <td width="2%"></td>
        <td width="32%" style="padding: 15px 8px; background: linear-gradient(135deg, #fee2e2, #fecaca); border-radius: 12px; text-align: center;"><div style="font-size: 24px; font-weight: 800; color: #b91c1c;">2.3M</div><div style="font-size: 10px; color: #991b1b; text-transform: uppercase;">Visitors/mo</div></td>
      </tr></table></td></tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 15px;"><tr><td style="padding: 20px; background: #f8fafc; border-radius: 14px; border-left: 4px solid #10b981;"><p style="margin: 0 0 12px 0; font-size: 14px; color: #1a1a1a; line-height: 1.6; font-style: italic;">"BoostiSwap connected me with 5 producers. One collab is now on <span style="font-weight: 700; color: #10b981;">radio in 3 countries</span>. All from one platform."</p><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="35"><div style="width: 28px; height: 28px; background: #10b981; border-radius: 50%; text-align: center; line-height: 28px; font-size: 12px;">🎧</div></td><td style="padding-left: 10px;"><div style="font-size: 13px; font-weight: 600; color: #1a1a1a;">Sofia Rivera <span style="color: #64748b; font-weight: 400;">· R&B · Mexico</span></div></td></tr></table></td></tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;"><tr><td style="padding: 20px; background: #f8fafc; border-radius: 14px; border-left: 4px solid #f97316;"><p style="margin: 0 0 12px 0; font-size: 14px; color: #1a1a1a; line-height: 1.6; font-style: italic;">"From 200 views to <span style="font-weight: 700; color: #f97316;">50K in one week</span>. YouTube finally started recommending my music. Game changer."</p><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="35"><div style="width: 28px; height: 28px; background: #f97316; border-radius: 50%; text-align: center; line-height: 28px; font-size: 12px;">🎵</div></td><td style="padding-left: 10px;"><div style="font-size: 13px; font-weight: 600; color: #1a1a1a;">Andy K <span style="color: #64748b; font-weight: 400;">· Hip Hop · Argentina</span></div></td></tr></table></td></tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;"><tr><td style="padding: 28px 22px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 18px; text-align: center;"><div style="font-size: 28px; margin-bottom: 10px;">🎯</div><h3 style="margin: 0 0 10px 0; font-size: 19px; font-weight: 800; color: #ffffff; line-height: 1.3;">${artistName}, what's YOUR story going to be?</h3><p style="margin: 0 0 20px 0; font-size: 13px; color: rgba(255,255,255,0.9);">Join 5,000+ artists already growing on Boostify</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center"><a href="${URLS.myArtists}" class="mobile-btn" style="display: inline-block; background: #ffffff; color: #ea580c; text-decoration: none; padding: 15px 32px; border-radius: 12px; font-weight: 800; font-size: 15px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">🚀 START MY SUCCESS STORY</a></td></tr></table><p style="margin: 15px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.75);">100% FREE • No credit card needed</p></td></tr></table>
  `, 'Artists share their Boostify success stories');
}

function generateEmail7(artistName) {
  return wrapInEmailTemplate(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding-bottom: 25px;"><div style="font-size: 50px; margin-bottom: 15px;">📊</div><h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a;">Data that drives<br><span style="color: #f97316;">smart decisions</span></h1><p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6;">Stop guessing. Know exactly what works and what doesn't in your music strategy.</p></td></tr></table>
    ${analyticsPreview()}
    ${featureCard('🌍', 'Fan Demographics', 'Age, gender, location, and devices of your visitors.')}
    ${featureCard('🎵', 'Top Tracks', 'Discover which of your songs generate the most interest.')}
    ${featureCard('📅', 'Best Times', 'Publish when your audience is most active.')}
    ${featureCard('🔗', 'Traffic Sources', 'Know where your fans come from: Instagram, TikTok, Google...')}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;"><tr><td align="center"><p style="margin: 0 0 15px 0; font-size: 13px; color: #64748b;">All included FREE with your artist page</p>${ctaButton('📊 SEE MY ANALYTICS', URLS.myArtists)}</td></tr></table>
  `, 'Professional analytics for independent artists');
}

function generateEmail8(artistName) {
  return wrapInEmailTemplate(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding: 30px; background: ${EMAIL_STYLES.headerGradient}; border-radius: 16px; text-align: center;"><div style="display: inline-block; background: #ffffff; color: #f97316; padding: 6px 16px; border-radius: 50px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 15px;">⏰ LIMITED OFFER</div><h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #ffffff;">1 YEAR OF PREMIUM<br>COMPLETELY FREE</h1><p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.9);">${artistName}, we're selecting artists for our beta premium program. You're on the list.</p></td></tr></table>
    <h2 style="margin: 30px 0 20px 0; font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: center;">What you get with Premium:</h2>
    ${featureCard('✨', 'No Watermark ($99/year value)', 'Your brand, no distractions')}
    ${featureCard('📊', 'Advanced Analytics ($49/year value)', 'Detailed audience insights')}
    ${featureCard('🚀', 'Priority Boost ($79/year value)', 'Your music featured on the platform')}
    ${featureCard('🎯', 'Custom Domain ($49/year value)', 'yourname.boostifymusic.com')}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;"><tr><td style="padding: 25px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%); border-radius: 16px; text-align: center;"><span style="font-size: 18px; color: #64748b; text-decoration: line-through;">$276/year</span><span style="font-size: 32px; font-weight: 800; color: #10b981; margin-left: 15px;">$0</span><p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;">Only for the first 500 artists. 437 already registered.</p></td></tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;"><tr><td align="center">${ctaButton('🔥 CLAIM FREE PREMIUM', URLS.myArtists + '?premium=true')}</td></tr></table>
  `, 'Claim your FREE Premium account - Limited offer');
}

function generateEmail9(artistName) {
  return wrapInEmailTemplate(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding-bottom: 25px;"><h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a;">A community that<br><span style="color: #f97316;">never stops growing</span></h1></td></tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;"><tr><td style="padding: 35px; background: ${EMAIL_STYLES.headerGradient}; border-radius: 16px; text-align: center;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding: 10px;"><div style="font-size: 36px; font-weight: 800; color: #ffffff;">5,247</div><div style="font-size: 11px; color: rgba(255,255,255,0.8);">Active Artists</div></td><td align="center" style="padding: 10px;"><div style="font-size: 36px; font-weight: 800; color: #ffffff;">2.3M</div><div style="font-size: 11px; color: rgba(255,255,255,0.8);">Monthly Visits</div></td><td align="center" style="padding: 10px;"><div style="font-size: 36px; font-weight: 800; color: #ffffff;">45K</div><div style="font-size: 11px; color: rgba(255,255,255,0.8);">Collaborations</div></td></tr></table></td></tr></table>
    <h3 style="margin: 25px 0 15px 0; font-size: 16px; font-weight: 600; color: #1a1a1a; text-align: center;">Artists who joined this week:</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr><td style="padding: 12px 15px; background: #f8fafc; border-radius: 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="40">🎤</td><td><div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Maria "The Voice" Santos</div><div style="font-size: 12px; color: #64748b;">Pop Latino · Madrid</div></td><td align="right" style="font-size: 11px; color: #94a3b8;">2h ago</td></tr></table></td></tr>
      <tr><td height="8"></td></tr>
      <tr><td style="padding: 12px 15px; background: #f8fafc; border-radius: 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="40">🎧</td><td><div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Beats by Milo</div><div style="font-size: 12px; color: #64748b;">Hip Hop · Buenos Aires</div></td><td align="right" style="font-size: 11px; color: #94a3b8;">5h ago</td></tr></table></td></tr>
      <tr><td height="8"></td></tr>
      <tr><td style="padding: 12px 15px; background: #f8fafc; border-radius: 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="40">🎹</td><td><div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Tropical Vibes Crew</div><div style="font-size: 12px; color: #64748b;">Reggaeton · Miami</div></td><td align="right" style="font-size: 11px; color: #94a3b8;">8h ago</td></tr></table></td></tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;"><tr><td align="center"><h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 700; color: #1a1a1a;">${artistName}, your spot is waiting</h3>${ctaButton('🎵 JOIN THE COMMUNITY', URLS.myArtists)}</td></tr></table>
  `, 'Join 5,000+ artists growing together on Boostify');
}

function generateEmail10(artistName) {
  return wrapInEmailTemplate(`
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding-bottom: 25px;"><h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a;">${artistName},<br><span style="color: #f97316;">thank you for your time</span></h1><p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6; max-width: 450px;">This is the last email in our welcome series. I wanted to make sure you have everything you need to make a decision.</p></td></tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;"><tr><td style="padding: 30px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0.03) 100%); border-radius: 16px; border: 2px solid rgba(249, 115, 22, 0.2);"><h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: center;">What you get with Boostify:</h2>
      ${featureCard('🎨', 'Professional Artist Page', 'Your music, bio, photos, and links in one stunning design')}
      ${featureCard('🤝', 'BoostiSwap', 'Connect and collaborate with thousands of artists')}
      ${featureCard('📈', 'YouTube Boost', 'Tools to multiply your video views')}
      ${featureCard('📊', 'Pro Analytics', 'Know your audience like never before')}
      ${featureCard('🌟', 'Artist Community', 'Over 5,000 artists growing together')}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(249, 115, 22, 0.2);"><tr><td align="center"><div style="font-size: 24px; font-weight: 800; color: #10b981;">100% FREE</div><div style="font-size: 13px; color: #64748b;">No credit card. No commitments.</div></td></tr></table></td></tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;"><tr><td style="padding: 25px; background: #f8fafc; border-radius: 12px;"><p style="margin: 0; font-size: 14px; color: #1a1a1a; line-height: 1.7;">We built Boostify because we know how hard it is to be heard as an independent artist. We want every musician to have the tools that were once only available to artists with big labels.</p><p style="margin: 15px 0 0 0; font-size: 16px; font-weight: 600; color: #f97316;">Your music deserves to be heard. 🎵</p></td></tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;"><tr><td align="center">${ctaButton('🎨 CREATE MY FREE PAGE', URLS.myArtists)}<p style="margin: 15px 0 0 0; font-size: 12px; color: #64748b;">If you ever need help, just reply to this email.<br>There's always someone on the team ready to assist.</p></td></tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;"><tr><td style="padding: 15px; background: rgba(249, 115, 22, 0.05); border-radius: 8px;"><p style="margin: 0; font-size: 13px; color: #64748b;"><strong style="color: #1a1a1a;">P.S.</strong> Although this is the last automated email, we'll still send you occasional platform updates and tips for artists.</p></td></tr></table>
  `, 'Everything Boostify has to offer - Final summary');
}

// ============================================
// EMAIL SEQUENCE CONFIG
// ============================================

const EMAIL_SEQUENCE = [
  { num: 1, subject: '🎵 {{artistName}}, Your Professional Artist Page is Ready (FREE)', generate: generateEmail1 },
  { num: 2, subject: '⚡ {{artistName}}, Your FREE Artist Page is Ready to Generate', generate: generateEmail2 },
  { num: 3, subject: '🤝 {{artistName}}, Connect With Artists Who Want to Collaborate', generate: generateEmail3 },
  { num: 4, subject: '📈 {{artistName}}, Multiply Your YouTube Video Views', generate: generateEmail4 },
  { num: 5, subject: "⚠️ {{artistName}}, Don't Miss Out - Your FREE Page Expires Soon", generate: generateEmail5 },
  { num: 6, subject: '🔥 {{artistName}}, Artists Like You Are Blowing Up on Boostify', generate: generateEmail6 },
  { num: 7, subject: '📊 {{artistName}}, Know Your Fans Like Never Before', generate: generateEmail7 },
  { num: 8, subject: '🔥 {{artistName}}, Last Chance: FREE Premium for 1 Year', generate: generateEmail8 },
  { num: 9, subject: "🚀 {{artistName}}, We're Now 5,000+ Artists Growing Together", generate: generateEmail9 },
  { num: 10, subject: '💜 {{artistName}}, This is My Last Message (For Now)', generate: generateEmail10 }
];

// ============================================
// MAIN FUNCTIONS
// ============================================

async function getEligibleLeads() {
  const client = await pool.connect();
  try {
    const previousSeq = SEQUENCE_NUMBER - 1;
    let query;
    if (SEQUENCE_NUMBER === 1) {
      query = `
        SELECT l.id, l.email, l.first_name, l.last_name, l.company_name as artist_name, l.source
        FROM leads l
        LEFT JOIN lead_status ls ON l.id = ls.lead_id
        WHERE l.segment = 'artist'
        AND l.email IS NOT NULL
        AND l.unsubscribed = false
        AND (ls.id IS NULL OR ls.emails_sent = 0 OR ls.warmup_stage < 1)
        ORDER BY RANDOM()
        LIMIT $1
      `;
    } else {
      query = `
        SELECT l.id, l.email, l.first_name, l.last_name, l.company_name as artist_name, l.source
        FROM leads l
        JOIN lead_status ls ON l.id = ls.lead_id
        WHERE l.segment = 'artist'
        AND l.email IS NOT NULL
        AND l.unsubscribed = false
        AND ls.warmup_stage = $2
        AND ls.last_email_at < NOW() - INTERVAL '2 days'
        ORDER BY ls.last_email_at ASC
        LIMIT $1
      `;
    }
    const params = SEQUENCE_NUMBER === 1 ? [MAX_EMAILS] : [MAX_EMAILS, previousSeq];
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function sendEmail(lead, sequence) {
  const artistName = lead.artist_name || lead.first_name || 'Artist';
  const subject = sequence.subject.replace('{{artistName}}', artistName);
  const html = sequence.generate(artistName);
  
  if (PREVIEW_MODE) {
    console.log(`📧 [PREVIEW] Sending to: ${PREVIEW_EMAIL}`);
    console.log(`   Subject: ${subject}`);
    const result = await sendBrevoEmail(
      PREVIEW_EMAIL,
      `[PREVIEW ${sequence.num}] ${subject}`,
      html
    );
    return result;
  }
  
  const result = await sendBrevoEmail(lead.email, subject, html);
  return result;
}

// Shared news cache populated before sending
let EMAIL_NEWS_CACHE = [];

async function fetchLatestNews() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT title, summary, category, published_at, slug
      FROM news_articles
      WHERE status = 'published'
      ORDER BY published_at DESC
      LIMIT 3
    `);
    const colorMap = { 'ai-music': '#f59e0b', 'platform-updates': '#6366f1', 'web3': '#10b981', 'technology': '#3b82f6', 'partnerships': '#8b5cf6', 'artist-news': '#ec4899', 'innovation': '#8b5cf6', 'industry-vision': '#f43f5e', 'autonomous-artists': '#f97316' };
    EMAIL_NEWS_CACHE = (res.rows || []).map(r => ({
      title: r.title,
      summary: r.summary,
      category: (r.category || 'platform-updates').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      categoryColor: colorMap[r.category] || '#f97316',
      slug: r.slug,
    }));
    if (EMAIL_NEWS_CACHE.length > 0) console.log(`📰 Loaded ${EMAIL_NEWS_CACHE.length} news articles for email templates`);
  } catch (e) {
    console.warn('⚠️  Could not fetch news (using placeholders):', e.message);
  } finally {
    client.release();
  }
}

async function updateLeadStatus(leadId, sequenceNum) {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO lead_status (lead_id, status, warmup_stage, emails_sent, last_email_at, notes)
      VALUES ($1, 'sequence', $2, 1, NOW(), $3)
      ON CONFLICT (lead_id) DO UPDATE SET
        status = 'sequence',
        warmup_stage = $2,
        emails_sent = lead_status.emails_sent + 1,
        last_email_at = NOW(),
        notes = $3,
        updated_at = NOW()
    `, [leadId, sequenceNum, `artist_sequence_${sequenceNum}`]);
    await client.query(`
      INSERT INTO email_sends (lead_id, campaign, template, sent_at, from_domain)
      VALUES ($1, 'artist_sequence', $2, NOW(), 'boostifymusic.com')
    `, [leadId, `sequence_${sequenceNum}`]);
  } finally {
    client.release();
  }
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   🎵 ARTIST EMAIL SEQUENCE - PROFESSIONAL HTML TEMPLATES     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Pre-fetch latest news articles for email templates
  await fetchLatestNews();
  
  const sequence = EMAIL_SEQUENCE.find(s => s.num === SEQUENCE_NUMBER);
  if (!sequence) {
    console.error(`❌ Invalid sequence number: ${SEQUENCE_NUMBER}`);
    console.log('   Valid sequences: 1-10');
    process.exit(1);
  }
  
  console.log(`📋 Configuration:`);
  console.log(`   Sequence: ${SEQUENCE_NUMBER}/10`);
  console.log(`   Subject: ${sequence.subject}`);
  console.log(`   Max emails: ${MAX_EMAILS}`);
  console.log(`   Preview mode: ${PREVIEW_MODE ? 'YES (' + PREVIEW_EMAIL + ')' : 'NO'}`);
  console.log('');
  
  if (PREVIEW_MODE) {
    console.log('🔍 PREVIEW MODE - Sending test email...\n');
    const testLead = { id: 'preview-test', email: PREVIEW_EMAIL, first_name: 'Test Artist', artist_name: 'Test Artist' };
    try {
      const result = await sendEmail(testLead, sequence);
      console.log(`✅ Preview email sent!`);
      console.log(`   Email ID: ${result.data?.id || 'N/A'}`);
      console.log(`   To: ${PREVIEW_EMAIL}`);
      console.log(`   Subject: [PREVIEW ${sequence.num}] ${sequence.subject.replace('{{artistName}}', 'Test Artist')}`);
    } catch (error) {
      console.error(`❌ Error sending preview:`, error.message);
    }
    await pool.end();
    return;
  }
  
  console.log('🚀 PRODUCTION MODE - Fetching eligible leads...\n');
  const leads = await getEligibleLeads();
  console.log(`📊 Found ${leads.length} eligible leads for sequence ${SEQUENCE_NUMBER}\n`);
  
  if (leads.length === 0) {
    console.log('⚠️  No eligible leads found.');
    await pool.end();
    return;
  }
  
  let sent = 0, failed = 0;
  for (const lead of leads) {
    try {
      await sendEmail(lead, sequence);
      await updateLeadStatus(lead.id, SEQUENCE_NUMBER);
      sent++;
      console.log(`✅ [${sent}/${leads.length}] Sent to ${lead.email}`);
      const delay = Math.floor(Math.random() * 60000) + 30000;
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      failed++;
      console.error(`❌ Failed: ${lead.email} - ${error.message}`);
    }
  }
  
  console.log('\n════════════════════════════════════════════════');
  console.log(`📊 RESULTS: ${sent} sent, ${failed} failed`);
  console.log('════════════════════════════════════════════════\n');
  await pool.end();
}

main().catch(console.error);
