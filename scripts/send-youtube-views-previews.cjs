/**
 * 📺 YOUTUBE VIEWS - PREMIUM 5 EMAIL SEQUENCE
 * 
 * Secuencia de emails para promover YouTube Views:
 * - Suite de herramientas AI para crecer en YouTube
 * - Pre-launch score, keywords, thumbnails, trends
 * - Competitor analysis, content calendar
 * 
 * Estilo: Mismo diseño premium con branding rojo YouTube
 * Uses Brevo (formerly Sendinblue) for boostifymusic.com domain
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.secrets') }); // overrides .env // overrides .env // overrides .env // overrides .env

// Brevo API configuration
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

const TO_EMAIL = 'convoycubano@gmail.com';
const FROM_EMAIL = 'alex@boostifymusic.com';
const FROM_NAME = 'Alex from Boostify';
const REPLY_TO = ['convoycubano@gmail.com', 'alex@boostifymusic.com'];

// Función para enviar email via Brevo
async function sendBrevoEmail(to, subject, html) {
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
        replyTo: { email: REPLY_TO[0] },
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
};

// ============================================================================
// PREMIUM EMAIL TEMPLATE WRAPPER (YouTube Red Theme)
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
    * { box-sizing: border-box; }
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-spacing: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; max-width: 100%; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    a { color: #ef4444; text-decoration: none; }
    
    /* MOBILE RESPONSIVE */
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; margin: 0 !important; }
      .mobile-padding { padding: 20px 16px !important; }
      .mobile-padding-header { padding: 25px 16px !important; }
      
      .cta-button { 
        display: block !important; 
        width: 100% !important; 
        max-width: 100% !important;
        padding: 18px 20px !important;
        font-size: 16px !important;
        box-sizing: border-box !important;
      }
      .cta-button-wrapper { 
        padding: 0 16px !important; 
        width: 100% !important;
      }
      
      .hero-title { font-size: 26px !important; line-height: 1.2 !important; }
      .section-title { font-size: 20px !important; }
      .stat-number { font-size: 32px !important; }
      .tool-card { padding: 18px 15px !important; }
      .step-number { width: 45px !important; height: 45px !important; font-size: 20px !important; line-height: 45px !important; }
      .mobile-center { text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a;">
  <!-- Preheader -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        
        <!-- Main Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; background: #111111; border-radius: 24px; overflow: hidden; border: 1px solid #2a2a2a;">
          
          <!-- HEADER HERO - YouTube Red gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%); padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="mobile-padding-header" style="padding: 40px 40px 30px 40px; text-align: center;">
                    <!-- Logo/Brand -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 20px auto;">
                      <tr>
                        <td style="background: rgba(0,0,0,0.3); padding: 12px 24px; border-radius: 50px;">
                          <span style="font-size: 20px; margin-right: 8px;">📺</span>
                          <span style="font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">YOUTUBE VIEWS</span>
                        </td>
                      </tr>
                    </table>
                    <!-- Tagline -->
                    <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 4px; font-weight: 600;">AI-Powered Growth Tools</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CONTENT AREA -->
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
                    <p style="margin: 0 0 15px 0; font-size: 13px; color: #ffffff; font-weight: 600;">
                      📺 YouTube Views by Boostify Music
                    </p>
                    <p style="margin: 0 0 15px 0; font-size: 12px; color: #666666;">
                      AI tools to grow your YouTube channel faster
                    </p>
                    <a href="${URLS.youtubeViews}" style="display: inline-block; padding: 10px 20px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; font-size: 12px; color: #ef4444; text-decoration: none; font-weight: 600;">
                      🚀 Start Growing Free
                    </a>
                    <p style="margin: 20px 0 0 0; font-size: 10px; color: #444444;">
                      © 2026 Boostify Music • Built for creators
                    </p>
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

function ctaButton(text, url, gradient = 'red') {
  const gradients = {
    red: 'background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);',
    orange: 'background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);',
    green: 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);',
    purple: 'background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);',
    youtube: 'background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%);'
  };
  
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
      <tr>
        <td align="center" class="cta-button-wrapper">
          <a href="${url}" class="cta-button" style="display: inline-block; ${gradients[gradient]} color: #ffffff; text-decoration: none; padding: 18px 45px; border-radius: 12px; font-weight: 700; font-size: 16px; text-align: center; box-shadow: 0 8px 25px rgba(239, 68, 68, 0.35); mso-padding-alt: 0;">
            <!--[if mso]><i style="mso-font-width: 400%; mso-text-raise: 30pt;">&nbsp;</i><![endif]-->
            <span style="mso-text-raise: 15pt;">${text}</span>
            <!--[if mso]><i style="mso-font-width: 400%;">&nbsp;</i><![endif]-->
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
        <td class="tool-card" style="padding: 20px; background: rgba(255,255,255,0.03); border-radius: 14px; border-left: 3px solid ${accentColor};">
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

function stepCard(number, title, description, color) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
      <tr>
        <td style="padding: 22px; background: linear-gradient(135deg, ${color}15 0%, ${color}08 100%); border-radius: 16px; border: 1px solid ${color}30;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="60" valign="top">
                <div class="step-number" style="width: 50px; height: 50px; background: linear-gradient(135deg, ${color} 0%, ${color}cc 100%); border-radius: 50%; text-align: center; line-height: 50px; font-size: 22px; font-weight: 800; color: #ffffff; box-shadow: 0 4px 15px ${color}40;">${number}</div>
              </td>
              <td valign="middle" style="padding-left: 5px;">
                <div style="font-size: 17px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">${title}</div>
                <div style="font-size: 13px; color: #999999; line-height: 1.5;">${description}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function testimonialCard(quote, name, stats, emoji, accentColor) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
      <tr>
        <td style="padding: 22px; background: rgba(255,255,255,0.02); border-radius: 16px; border-left: 4px solid ${accentColor};">
          <div style="font-size: 28px; margin-bottom: 12px;">${emoji}</div>
          <p style="margin: 0 0 15px 0; font-size: 15px; color: #e0e0e0; line-height: 1.6; font-style: italic;">
            "${quote}"
          </p>
          <div style="font-size: 14px; font-weight: 700; color: ${accentColor};">${name}</div>
          <div style="font-size: 12px; color: #666666;">${stats}</div>
        </td>
      </tr>
    </table>
  `;
}

function screenshotMockup(title, subtitle) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 3px; background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); border-radius: 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #1a1a1a; border-radius: 14px; overflow: hidden;">
            <tr>
              <td style="padding: 0;">
                <!-- Browser mockup header -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #2a2a2a;">
                  <tr>
                    <td style="padding: 12px 16px;">
                      <span style="display: inline-block; width: 12px; height: 12px; background: #ff5f57; border-radius: 50%; margin-right: 6px;"></span>
                      <span style="display: inline-block; width: 12px; height: 12px; background: #febc2e; border-radius: 50%; margin-right: 6px;"></span>
                      <span style="display: inline-block; width: 12px; height: 12px; background: #28c840; border-radius: 50%;"></span>
                      <span style="display: inline-block; margin-left: 15px; font-size: 11px; color: #666;">boostifymusic.com/youtube-views</span>
                    </td>
                  </tr>
                </table>
                <!-- Content area -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%);">
                  <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                      <div style="font-size: 50px; margin-bottom: 15px;">📺</div>
                      <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">${title}</div>
                      <div style="font-size: 13px; color: #888888;">${subtitle}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function scoreCard(score, label, color) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 10px auto;">
      <tr>
        <td style="padding: 20px 30px; background: linear-gradient(135deg, ${color}20 0%, ${color}10 100%); border-radius: 16px; border: 2px solid ${color}; text-align: center;">
          <div style="font-size: 48px; font-weight: 800; color: ${color};">${score}</div>
          <div style="font-size: 12px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">${label}</div>
        </td>
      </tr>
    </table>
  `;
}

// ============================================================================
// 5 YOUTUBE VIEWS EMAIL TEMPLATES
// ============================================================================

const EMAILS = [
  // EMAIL 1: THE PROBLEM & SOLUTION
  {
    subject: `📺 Why your YouTube videos aren't getting views (and how to fix it)`,
    preheader: "AI tools that predict viral potential before you publish",
    html: (name) => wrapInEmailTemplate(`
      <!-- HERO TITLE -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 32px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              Hey ${name}! 👋<br>
              <span style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Your videos deserve more views.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999; line-height: 1.7; max-width: 450px;">
              The algorithm isn't random. It follows <strong style="color: #ffffff;">patterns that can be predicted.</strong>
            </p>
          </td>
        </tr>
      </table>
      
      <!-- THE PROBLEM -->
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
      
      <!-- THE SOLUTION -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%); border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.25); text-align: center;">
            <div style="font-size: 14px; color: #10b981; text-transform: uppercase; letter-spacing: 3px; font-weight: 700; margin-bottom: 12px;">✨ THE SOLUTION</div>
            <div style="font-size: 28px; font-weight: 800; color: #ffffff; margin-bottom: 10px;">YouTube Views AI Suite</div>
            <div style="font-size: 15px; color: #aaaaaa;">10+ AI tools to predict, optimize, and grow</div>
          </td>
        </tr>
      </table>
      
      <!-- SCREENSHOT -->
      ${screenshotMockup('Pre-Launch Score Dashboard', 'Know if your video will go viral BEFORE you publish')}
      
      <!-- KEY TOOLS -->
      <h2 class="section-title" style="margin: 35px 0 20px 0; font-size: 22px; font-weight: 700; color: #ffffff; text-align: center;">🛠️ What You Get</h2>
      ${toolCard('🎯', 'Pre-Launch Score', 'AI predicts your video\'s viral potential before you publish', '#ef4444')}
      ${toolCard('🔑', 'Keywords Generator', 'Find the exact keywords that rank on YouTube', '#f97316')}
      ${toolCard('📝', 'Title Analyzer', 'Optimize titles for maximum click-through rate', '#10b981')}
      ${toolCard('🖼️', 'Thumbnail AI', 'Generate click-worthy thumbnails with AI', '#8b5cf6')}
      
      <!-- STATS -->
      ${statsRow([
        { value: '+250%', label: 'Avg Views' },
        { value: '+180%', label: 'Subscribers' },
        { value: '10+', label: 'AI Tools' }
      ])}
      
      <!-- CTA -->
      ${ctaButton('📺 Try YouTube Views Free', URLS.youtubeViews, 'red')}
      
      <p style="margin: 0; font-size: 13px; color: #555555; text-align: center;">
        Stop guessing. Start growing.
      </p>
    `, "AI tools that predict viral potential before you publish")
  },

  // EMAIL 2: THE TOOLS BREAKDOWN
  {
    subject: `🛠️ 10 AI tools that top YouTubers don't want you to know about`,
    preheader: "The complete toolkit for YouTube domination",
    html: (name) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, here's the<br>
              <span style="color: #ef4444;">complete arsenal.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999; line-height: 1.7;">
              10+ AI-powered tools. One dashboard. <strong style="color: #ffffff;">Total YouTube domination.</strong>
            </p>
          </td>
        </tr>
      </table>
      
      <!-- PHASE 1: PRE-PUBLISH -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 20px; background: rgba(239, 68, 68, 0.08); border-radius: 16px;">
            <div style="font-size: 12px; color: #ef4444; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; font-weight: 600;">🎬 PHASE 1: BEFORE YOU PUBLISH</div>
            ${toolCard('🎯', 'Pre-Launch Score', 'Get a 0-100 score predicting viral potential', '#ef4444')}
            ${toolCard('🔑', 'Keywords Generator', 'AI finds low-competition, high-search keywords', '#ef4444')}
            ${toolCard('📝', 'Title Optimizer', 'Analyze CTR, SEO, and emotional impact', '#ef4444')}
            ${toolCard('💡', 'Content Ideas', 'AI generates video ideas based on trends', '#ef4444')}
          </td>
        </tr>
      </table>
      
      <!-- PHASE 2: CREATE -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 20px; background: rgba(249, 115, 22, 0.08); border-radius: 16px;">
            <div style="font-size: 12px; color: #f97316; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; font-weight: 600;">🎨 PHASE 2: CREATE & OPTIMIZE</div>
            ${toolCard('🖼️', 'Thumbnail Generator', 'AI creates click-worthy thumbnails', '#f97316')}
            ${toolCard('📊', 'Competitor Analysis', 'Spy on what\'s working for competitors', '#f97316')}
            ${toolCard('📈', 'Trend Predictor', 'Know what\'s about to blow up', '#f97316')}
            ${toolCard('✂️', 'Shorts Clipper', 'Extract viral moments for YouTube Shorts', '#f97316')}
          </td>
        </tr>
      </table>
      
      <!-- PHASE 3: SCALE -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 20px; background: rgba(16, 185, 129, 0.08); border-radius: 16px;">
            <div style="font-size: 12px; color: #10b981; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; font-weight: 600;">🚀 PHASE 3: SCALE & AUTOMATE</div>
            ${toolCard('📅', 'Content Calendar', 'AI plans your entire month of content', '#10b981')}
            ${toolCard('⚡', 'Auto-Optimization', 'Automatically improve underperforming videos', '#10b981')}
            ${toolCard('🔌', 'API Access', 'Integrate with your own tools (Pro)', '#10b981')}
          </td>
        </tr>
      </table>
      
      ${ctaButton('🚀 Access All 10+ Tools Free', URLS.youtubeViews, 'youtube')}
    `, "The complete toolkit for YouTube domination")
  },

  // EMAIL 3: THE PRE-LAUNCH SCORE
  {
    subject: `🎯 Know if your video will go viral BEFORE you publish`,
    preheader: "The Pre-Launch Score: Your crystal ball for YouTube",
    html: (name) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, what if you<br>
              <span style="color: #ef4444;">knew before publishing?</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999; line-height: 1.7;">
              Our AI analyzes your title, description, and niche to predict performance.
            </p>
          </td>
        </tr>
      </table>
      
      <!-- SCORE PREVIEW -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td align="center">
            ${scoreCard('87/100', 'Viral Potential', '#10b981')}
          </td>
        </tr>
      </table>
      
      <!-- HOW IT WORKS -->
      ${stepCard('1', '📝 Enter Your Details', 'Title, description, keywords, and niche', '#ef4444')}
      ${stepCard('2', '🧠 AI Analyzes', 'Our model compares against millions of successful videos', '#f97316')}
      ${stepCard('3', '📊 Get Your Score', '0-100 score with specific recommendations to improve', '#10b981')}
      
      <!-- WHAT YOU GET -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(239, 68, 68, 0.08); border-radius: 16px;">
            <div style="font-size: 14px; color: #ef4444; font-weight: 600; text-align: center; margin-bottom: 15px;">📋 YOUR SCORE INCLUDES</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="50%" style="padding: 8px;">
                  <div style="font-size: 13px; color: #ffffff;">✅ Viral Score (0-100)</div>
                </td>
                <td width="50%" style="padding: 8px;">
                  <div style="font-size: 13px; color: #ffffff;">✅ View Prediction</div>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding: 8px;">
                  <div style="font-size: 13px; color: #ffffff;">✅ Strengths</div>
                </td>
                <td width="50%" style="padding: 8px;">
                  <div style="font-size: 13px; color: #ffffff;">✅ Weaknesses</div>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 8px; text-align: center;">
                  <div style="font-size: 13px; color: #ffffff;">✅ Specific Recommendations to Improve</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      <!-- COMPARISON -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 20px; background: rgba(255,255,255,0.02); border-radius: 16px; text-align: center;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="48%" style="text-align: center; padding: 10px;">
                  <div style="font-size: 32px; margin-bottom: 8px;">❌</div>
                  <div style="font-size: 13px; color: #ef4444; font-weight: 600;">Without Pre-Launch</div>
                  <div style="font-size: 12px; color: #666666; margin-top: 5px;">Publish and pray</div>
                </td>
                <td width="4%" style="color: #333;">→</td>
                <td width="48%" style="text-align: center; padding: 10px;">
                  <div style="font-size: 32px; margin-bottom: 8px;">✅</div>
                  <div style="font-size: 13px; color: #10b981; font-weight: 600;">With Pre-Launch</div>
                  <div style="font-size: 12px; color: #666666; margin-top: 5px;">Publish with confidence</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      ${ctaButton('🎯 Get Your Pre-Launch Score', URLS.youtubeViews, 'red')}
    `, "The Pre-Launch Score: Your crystal ball for YouTube")
  },

  // EMAIL 4: SUCCESS STORIES
  {
    subject: `🔥 "From 200 to 50K subscribers in 3 months"`,
    preheader: "Real creators. Real results. Real growth.",
    html: (name) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, these creators<br>
              <span style="color: #ef4444;">were exactly where you are.</span>
            </h1>
          </td>
        </tr>
      </table>
      
      <!-- TESTIMONIALS -->
      ${testimonialCard(
        "I was stuck at 200 subscribers for a year. Started using Pre-Launch Score on every video. 6 months later: 50,000 subscribers. The AI literally tells you what to fix.",
        "Jake Thompson",
        "Music Producer • 50K subs",
        "🎹",
        "#ef4444"
      )}
      
      ${testimonialCard(
        "The Keywords Generator found a gap in my niche no one was targeting. Made ONE video on it. 500K views. Now it's 40% of my channel traffic.",
        "Maria Santos",
        "Guitar Tutorial Channel • 120K subs",
        "🎸",
        "#f97316"
      )}
      
      ${testimonialCard(
        "Thumbnail AI is insane. My CTR went from 3% to 11%. Same content, just better thumbnails. The algorithm started pushing my videos to non-subscribers.",
        "DJ Nexus",
        "EDM Producer • 85K subs",
        "🎧",
        "#8b5cf6"
      )}
      
      ${testimonialCard(
        "The Content Calendar planned my entire quarter. I just follow it and create. Consistency went up 300%. The algorithm noticed.",
        "Aria Beats",
        "Lofi Producer • 200K subs",
        "🎼",
        "#10b981"
      )}
      
      <!-- STATS -->
      ${statsRow([
        { value: '2,000+', label: 'Creators' },
        { value: '+340%', label: 'Avg Growth' },
        { value: '4.9★', label: 'Rating' }
      ])}
      
      ${ctaButton('🔥 Join These Creators', URLS.youtubeViews, 'orange')}
      
      <p style="margin: 25px 0 0 0; font-size: 14px; color: #666666; text-align: center;">
        Tomorrow: Access everything free 👀
      </p>
    `, "Real creators. Real results. Real growth.")
  },

  // EMAIL 5: THE OFFER
  {
    subject: `🎁 Full YouTube Views access. Free forever.`,
    preheader: "No catch. No trial. Just free tools to grow.",
    html: (name) => wrapInEmailTemplate(`
      <!-- GIFT HEADER -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 20px;">
            <div style="font-size: 60px; margin-bottom: 15px;">🎁</div>
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 32px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, this is<br>
              <span style="color: #10b981;">actually free.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999;">
              No trial. No credit card. No catch.
            </p>
          </td>
        </tr>
      </table>
      
      <!-- FREE ACCESS BOX -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 35px 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%); border-radius: 20px; border: 2px solid #10b981; text-align: center;">
            <div style="font-size: 12px; color: #10b981; text-transform: uppercase; letter-spacing: 3px; font-weight: 700; margin-bottom: 12px;">🎉 FREE TIER INCLUDES</div>
            <div style="font-size: 48px; font-weight: 800; color: #ffffff; margin-bottom: 8px;">10+ Tools</div>
            <div style="font-size: 18px; color: #ffffff; margin-bottom: 15px;">Forever Free</div>
            <div style="font-size: 14px; color: #aaaaaa; margin-bottom: 20px;">Unlimited access. No strings attached.</div>
            <div style="display: inline-block; padding: 10px 20px; background: rgba(16, 185, 129, 0.2); border-radius: 25px; font-size: 13px; color: #10b981; font-weight: 600;">✓ No credit card required</div>
          </td>
        </tr>
      </table>
      
      <!-- WHAT'S FREE -->
      <h3 style="margin: 30px 0 20px 0; font-size: 18px; font-weight: 700; color: #ffffff; text-align: center;">✨ Everything Included Free:</h3>
      ${toolCard('🎯', 'Pre-Launch Score', 'Predict viral potential before publishing', '#ef4444')}
      ${toolCard('🔑', 'Keywords Generator', 'Find ranking keywords for your niche', '#f97316')}
      ${toolCard('📝', 'Title Optimizer', 'Maximize click-through rate', '#f97316')}
      ${toolCard('🖼️', 'Thumbnail AI', 'Generate click-worthy thumbnails', '#8b5cf6')}
      ${toolCard('📊', 'Competitor Analysis', 'Spy on what\'s working', '#8b5cf6')}
      ${toolCard('📅', 'Content Calendar', 'Plan your entire month', '#10b981')}
      
      ${ctaButton('📺 Get Free Access Now', URLS.youtubeViews, 'youtube')}
      
      <!-- WHY FREE -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(255,255,255,0.02); border-radius: 16px;">
            <div style="font-size: 14px; color: #f97316; font-weight: 600; text-align: center; margin-bottom: 12px;">🤔 WHY IS IT FREE?</div>
            <p style="margin: 0; font-size: 14px; color: #aaaaaa; line-height: 1.7; text-align: center;">
              We're Boostify Music. We help independent artists grow.<br>
              YouTube Views is just one of our tools.<br>
              <span style="color: #ffffff;">When you grow, we grow.</span>
            </p>
          </td>
        </tr>
      </table>
      
      <p style="margin: 0; font-size: 16px; color: #ffffff; text-align: center; line-height: 1.6;">
        2,000+ creators are already growing.<br>
        <strong style="color: #ef4444;">Your turn.</strong>
      </p>
      
      <p style="margin: 30px 0 0 0; font-size: 14px; color: #666666; text-align: center;">
        To your growth,<br>
        <strong style="color: #ffffff;">— Alex & The Boostify Team</strong>
      </p>
    `, "Full access. Free forever. No catch.")
  }
];

// ============================================================================
// SEND ALL EMAILS
// ============================================================================

async function sendAllPreviews() {
  console.log('═'.repeat(65));
  console.log('║   📺 YOUTUBE VIEWS - PREMIUM EMAIL SEQUENCE PREVIEW           ║');
  console.log('═'.repeat(65));
  console.log(`📧 To: ${TO_EMAIL}`);
  console.log('─'.repeat(65));

  for (let i = 0; i < EMAILS.length; i++) {
    const email = EMAILS[i];
    console.log(`\n📧 Sending Email ${i+1}/5: ${email.subject.substring(0, 45)}...`);

    try {
      const result = await sendBrevoEmail(
        TO_EMAIL,
        `[PREVIEW ${i+1}/5] ${email.subject}`,
        email.html('Artist')
      );

      console.log(`   ✅ Sent! ID: ${result.data?.id}`);

      if (i < EMAILS.length - 1) {
        console.log('   ⏱️ Waiting 3s...');
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(65));
  console.log('✅ ALL 5 YOUTUBE VIEWS EMAILS SENT - Check your inbox!');
  console.log('═'.repeat(65));
}

sendAllPreviews();
