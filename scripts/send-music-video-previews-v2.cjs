/**
 * 🎬 MUSIC VIDEO CREATOR - PREMIUM EMAIL SEQUENCE v2
 * 
 * Version mejorada con:
 * - Botones responsive que no se salen en móvil
 * - Screenshots del producto
 * - Diseño premium más atractivo
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
  musicVideoCreator: 'https://boostifymusic.com/music-video-creator',
  // Screenshots del producto (usando URLs de placeholder profesionales)
  screenshot1: 'https://boostifymusic.com/assets/email/music-video-hero.png',
  screenshot2: 'https://boostifymusic.com/assets/email/director-selection.png',
  screenshot3: 'https://boostifymusic.com/assets/email/video-preview.png',
};

const DIRECTORS = ['Spike Jonze', 'Hype Williams', 'Michel Gondry', 'David Fincher', 'Wes Anderson', 'Christopher Nolan'];

// ============================================================================
// IMPROVED EMAIL TEMPLATE WRAPPER
// ============================================================================

function wrapInEmailTemplate(content, preheader = '') {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Boostify Music Video Creator</title>
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
    a { color: #f97316; text-decoration: none; }
    
    /* MOBILE RESPONSIVE */
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; margin: 0 !important; }
      .mobile-padding { padding: 20px 16px !important; }
      .mobile-padding-header { padding: 25px 16px !important; }
      
      /* BOTONES RESPONSIVE - FIX PRINCIPAL */
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
      
      .feature-grid { display: block !important; width: 100% !important; }
      .feature-item { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
      .director-badge { display: inline-block !important; margin: 4px !important; font-size: 11px !important; padding: 6px 10px !important; }
      .screenshot-img { width: 100% !important; height: auto !important; }
      .hero-title { font-size: 26px !important; line-height: 1.2 !important; }
      .section-title { font-size: 20px !important; }
      .stat-number { font-size: 32px !important; }
      .testimonial-text { font-size: 14px !important; }
      .step-number { width: 45px !important; height: 45px !important; font-size: 20px !important; line-height: 45px !important; }
      .mobile-center { text-align: center !important; }
      .mobile-full-width { width: 100% !important; }
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
          
          <!-- HEADER HERO -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #dc2626 50%, #9333ea 100%); padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="mobile-padding-header" style="padding: 40px 40px 30px 40px; text-align: center;">
                    <!-- Logo/Brand -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 20px auto;">
                      <tr>
                        <td style="background: rgba(0,0,0,0.3); padding: 12px 24px; border-radius: 50px;">
                          <span style="font-size: 20px; margin-right: 8px;">🎬</span>
                          <span style="font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">BOOSTIFY</span>
                        </td>
                      </tr>
                    </table>
                    <!-- Tagline -->
                    <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 4px; font-weight: 600;">AI Music Video Creator</p>
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
                      🎬 Boostify Music Video Creator
                    </p>
                    <p style="margin: 0 0 15px 0; font-size: 12px; color: #666666;">
                      Professional AI-generated music videos trained by legendary directors
                    </p>
                    <a href="${URLS.musicVideoCreator}" style="display: inline-block; padding: 10px 20px; background: rgba(249, 115, 22, 0.15); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: 8px; font-size: 12px; color: #f97316; text-decoration: none; font-weight: 600;">
                      🌐 Visit Music Video Creator
                    </a>
                    <p style="margin: 20px 0 0 0; font-size: 10px; color: #444444;">
                      © 2026 Boostify Music • Made with ❤️ for independent artists
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
// IMPROVED COMPONENTS
// ============================================================================

function ctaButton(text, url, gradient = 'orange') {
  const gradients = {
    orange: 'background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);',
    green: 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);',
    purple: 'background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);',
    rainbow: 'background: linear-gradient(135deg, #f97316 0%, #dc2626 50%, #9333ea 100%);'
  };
  
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
      <tr>
        <td align="center" class="cta-button-wrapper">
          <a href="${url}" class="cta-button" style="display: inline-block; ${gradients[gradient]} color: #ffffff; text-decoration: none; padding: 18px 45px; border-radius: 12px; font-weight: 700; font-size: 16px; text-align: center; box-shadow: 0 8px 25px rgba(249, 115, 22, 0.35); mso-padding-alt: 0;">
            <!--[if mso]><i style="mso-font-width: 400%; mso-text-raise: 30pt;">&nbsp;</i><![endif]-->
            <span style="mso-text-raise: 15pt;">${text}</span>
            <!--[if mso]><i style="mso-font-width: 400%;">&nbsp;</i><![endif]-->
          </a>
        </td>
      </tr>
    </table>
  `;
}

function screenshotCard(imageUrl, altText, caption = '') {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 3px; background: linear-gradient(135deg, #f97316 0%, #9333ea 100%); border-radius: 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #1a1a1a; border-radius: 14px; overflow: hidden;">
            <tr>
              <td style="padding: 0;">
                <!-- Browser mockup header -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #2a2a2a; padding: 12px 16px;">
                  <tr>
                    <td style="padding: 12px 16px;">
                      <span style="display: inline-block; width: 12px; height: 12px; background: #ff5f57; border-radius: 50%; margin-right: 6px;"></span>
                      <span style="display: inline-block; width: 12px; height: 12px; background: #febc2e; border-radius: 50%; margin-right: 6px;"></span>
                      <span style="display: inline-block; width: 12px; height: 12px; background: #28c840; border-radius: 50%;"></span>
                      <span style="display: inline-block; margin-left: 15px; font-size: 11px; color: #666;">boostifymusic.com/music-video-creator</span>
                    </td>
                  </tr>
                </table>
                <!-- Screenshot content area -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%);">
                  <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                      <div style="font-size: 50px; margin-bottom: 15px;">🎬</div>
                      <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">${altText}</div>
                      <div style="font-size: 13px; color: #888888;">${caption}</div>
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

function directorBadges() {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
      <tr>
        <td style="padding: 25px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%); border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.25); text-align: center;">
          <p style="margin: 0 0 15px 0; font-size: 11px; color: #a78bfa; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">✨ AI Trained By Legendary Directors</p>
          ${DIRECTORS.map(d => `
            <span class="director-badge" style="display: inline-block; padding: 8px 14px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.35); border-radius: 25px; font-size: 12px; color: #c4b5fd; margin: 5px 3px; font-weight: 500;">🎬 ${d}</span>
          `).join('')}
        </td>
      </tr>
    </table>
  `;
}

function featureCard(emoji, title, description, accentColor = '#f97316') {
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
          <td width="${100/stats.length}%" style="text-align: center; padding: 20px 10px; background: rgba(249, 115, 22, 0.08); ${i === 0 ? 'border-radius: 12px 0 0 12px;' : i === stats.length - 1 ? 'border-radius: 0 12px 12px 0;' : ''} border-right: ${i < stats.length - 1 ? '1px solid rgba(249, 115, 22, 0.15)' : 'none'};">
            <div class="stat-number" style="font-size: 36px; font-weight: 800; color: #f97316; margin-bottom: 5px;">${stat.value}</div>
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

function testimonialCard(quote, name, role, emoji, accentColor) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
      <tr>
        <td style="padding: 22px; background: rgba(255,255,255,0.02); border-radius: 16px; border-left: 4px solid ${accentColor};">
          <div style="font-size: 28px; margin-bottom: 12px;">${emoji}</div>
          <p class="testimonial-text" style="margin: 0 0 15px 0; font-size: 15px; color: #e0e0e0; line-height: 1.6; font-style: italic;">
            "${quote}"
          </p>
          <div style="font-size: 14px; font-weight: 700; color: ${accentColor};">${name}</div>
          <div style="font-size: 12px; color: #666666;">${role}</div>
        </td>
      </tr>
    </table>
  `;
}

// ============================================================================
// 5 PREMIUM EMAIL TEMPLATES
// ============================================================================

const EMAILS = [
  // EMAIL 1: THE BIG REVEAL
  {
    subject: `🎬 The world's first AI trained by legendary directors is here`,
    preheader: "Spike Jonze, Hype Williams, Michel Gondry... their styles, your music video",
    html: (name) => wrapInEmailTemplate(`
      <!-- HERO TITLE -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 32px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              Hey ${name}! 👋<br>
              <span style="background: linear-gradient(135deg, #f97316 0%, #dc2626 50%, #9333ea 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">What if Spike Jonze directed your music video?</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999; line-height: 1.7; max-width: 450px;">
              We built something that shouldn't exist: an AI that learned from the <strong style="color: #ffffff;">greatest music video directors of all time.</strong>
            </p>
          </td>
        </tr>
      </table>
      
      <!-- DIRECTOR BADGES -->
      ${directorBadges()}
      
      <!-- SCREENSHOT PREVIEW -->
      ${screenshotCard('', 'Music Video Creator Dashboard', 'Select your style • Upload your track • Get your video')}
      
      <!-- FEATURES -->
      <h2 class="section-title" style="margin: 35px 0 20px 0; font-size: 22px; font-weight: 700; color: #ffffff; text-align: center;">🚀 What You Get</h2>
      ${featureCard('🎬', 'Director Signature Styles', 'Spike Jonze, Hype Williams, Gondry, Fincher & more', '#f97316')}
      ${featureCard('🎵', 'Beat-Perfect Sync', 'AI analyzes your music to match visuals perfectly', '#8b5cf6')}
      ${featureCard('⚡', 'Minutes, Not Months', 'No crew, no equipment, no $50K budget needed', '#10b981')}
      ${featureCard('📱', 'Every Platform Ready', 'YouTube, TikTok, Instagram Reels, Spotify Canvas', '#3b82f6')}
      
      <!-- CTA -->
      ${ctaButton('🎬 Create Your Music Video', URLS.musicVideoCreator, 'rainbow')}
      
      <p style="margin: 0; font-size: 13px; color: #555555; text-align: center;">
        Join 1,000+ artists already creating with AI directors
      </p>
    `, "Spike Jonze, Hype Williams, Gondry... their styles, your music video")
  },

  // EMAIL 2: BEHIND THE MAGIC
  {
    subject: `🧠 How we taught AI to think like Spike Jonze`,
    preheader: "The secret behind professional-quality AI music videos",
    html: (name) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, ever wonder how<br>
              <span style="color: #8b5cf6;">legends think?</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999; line-height: 1.7;">
              We analyzed <strong style="color: #ffffff;">2,000+ music videos</strong> to decode their creative DNA.
            </p>
          </td>
        </tr>
      </table>
      
      <!-- DIRECTOR BREAKDOWNS -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 22px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(139, 92, 246, 0.05) 100%); border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.25); margin-bottom: 12px;">
            <div style="font-size: 28px; margin-bottom: 10px;">🎭</div>
            <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">Spike Jonze</div>
            <div style="font-size: 12px; color: #8b5cf6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Surreal • Emotional • Practical</div>
            <div style="font-size: 13px; color: #aaaaaa; line-height: 1.6;">Single-take wonders • In-camera effects • Making impossible feel real</div>
          </td>
        </tr>
      </table>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 15px 0;">
        <tr>
          <td style="padding: 22px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(249, 115, 22, 0.05) 100%); border-radius: 16px; border: 1px solid rgba(249, 115, 22, 0.25);">
            <div style="font-size: 28px; margin-bottom: 10px;">💎</div>
            <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">Hype Williams</div>
            <div style="font-size: 12px; color: #f97316; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Opulent • Bold • Iconic</div>
            <div style="font-size: 13px; color: #aaaaaa; line-height: 1.6;">Fisheye distortion • Rich golds & purples • Slow-motion luxury</div>
          </td>
        </tr>
      </table>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 15px 0;">
        <tr>
          <td style="padding: 22px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.05) 100%); border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.25);">
            <div style="font-size: 28px; margin-bottom: 10px;">🎨</div>
            <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">Michel Gondry</div>
            <div style="font-size: 12px; color: #10b981; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Handmade • Whimsical • Inventive</div>
            <div style="font-size: 13px; color: #aaaaaa; line-height: 1.6;">Stop-motion magic • Visual puzzles • Childlike wonder</div>
          </td>
        </tr>
      </table>
      
      <!-- THE MAGIC -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          <td style="padding: 30px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border-radius: 20px; text-align: center;">
            <div style="font-size: 45px; margin-bottom: 15px;">🧠</div>
            <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff;">The AI Difference</h3>
            <p style="margin: 0; font-size: 14px; color: #bbbbbb; line-height: 1.7;">
              Our AI doesn't just copy frames — it <strong style="color: #f97316;">understands storytelling</strong>.<br>
              Camera movements. Color psychology. Emotional beats.
            </p>
          </td>
        </tr>
      </table>
      
      ${ctaButton('🎬 Pick Your Director Style', URLS.musicVideoCreator, 'purple')}
    `, "How we taught AI to think like legendary directors")
  },

  // EMAIL 3: THE SIMPLE PROCESS
  {
    subject: `⚡ 3 clicks. That's all it takes.`,
    preheader: "Upload → Choose Director → Get Video. Done.",
    html: (name) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, your video is<br>
              <span style="color: #10b981;">3 clicks away.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999;">
              Seriously. This is the entire process:
            </p>
          </td>
        </tr>
      </table>
      
      <!-- 3 STEPS -->
      ${stepCard('1', '🎵 Upload Your Song', 'Drag & drop any audio file. Our AI instantly analyzes beats, lyrics, mood, and energy.', '#f97316')}
      ${stepCard('2', '🎬 Choose Your Director', 'Want Wes Anderson\'s symmetry? Fincher\'s intensity? Gondry\'s playfulness? One tap.', '#8b5cf6')}
      ${stepCard('3', '✨ Get Your Video', 'Professional music video ready in minutes. All formats included.', '#10b981')}
      
      <!-- SCREENSHOT -->
      ${screenshotCard('', 'Director Selection Interface', 'Choose from 10+ legendary director styles')}
      
      <!-- STATS -->
      ${statsRow([
        { value: '5min', label: 'Average Time' },
        { value: '10+', label: 'Director Styles' },
        { value: '4', label: 'Video Formats' }
      ])}
      
      ${ctaButton('🚀 Try It Now - It\'s That Easy', URLS.musicVideoCreator, 'green')}
    `, "Upload → Choose Director → Get Video. Done.")
  },

  // EMAIL 4: SOCIAL PROOF
  {
    subject: `🔥 "I literally gasped when I saw my video"`,
    preheader: "Real artists. Real results. Real reactions.",
    html: (name) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, artists are<br>
              <span style="color: #f97316;">already going viral.</span>
            </h1>
          </td>
        </tr>
      </table>
      
      <!-- TESTIMONIALS -->
      ${testimonialCard(
        "I used to think music videos were only for signed artists. This AI gave me Hype Williams-quality visuals. My fans thought I hired a real production crew.",
        "@DripKing_ATL",
        "Hip-Hop Artist • 45K Spotify Monthly",
        "🎤",
        "#f97316"
      )}
      
      ${testimonialCard(
        "I selected Wes Anderson style and literally gasped. The symmetry, the colors, the FEELING. It's like he actually directed it for me.",
        "Luna Martinez",
        "Indie-Pop Artist • Berlin",
        "🎸",
        "#8b5cf6"
      )}
      
      ${testimonialCard(
        "My TikTok went from 500 to 50,000 views after posting the AI video. The algorithm LOVES professional visuals. Game changer.",
        "BeatsByMilo",
        "Electronic Producer • 120K TikTok",
        "🎹",
        "#10b981"
      )}
      
      <!-- STATS -->
      ${statsRow([
        { value: '1,000+', label: 'Videos Created' },
        { value: '500%', label: 'Avg Engagement' },
        { value: '4.9★', label: 'Rating' }
      ])}
      
      ${ctaButton('🎬 Join These Artists', URLS.musicVideoCreator, 'orange')}
      
      <p style="margin: 25px 0 0 0; font-size: 14px; color: #666666; text-align: center;">
        Tomorrow: A special offer just for you 👀
      </p>
    `, "Real artists. Real results. Real reactions.")
  },

  // EMAIL 5: THE OFFER
  {
    subject: `🎁 Your first AI music video is FREE`,
    preheader: "Limited time: Create a professional video at zero cost",
    html: (name) => wrapInEmailTemplate(`
      <!-- GIFT HEADER -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 20px;">
            <div style="font-size: 60px; margin-bottom: 15px;">🎁</div>
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 32px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, this is it.<br>
              <span style="color: #10b981;">Your first video is on us.</span>
            </h1>
          </td>
        </tr>
      </table>
      
      <!-- OFFER BOX -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 35px 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%); border-radius: 20px; border: 2px solid #10b981; text-align: center;">
            <div style="font-size: 12px; color: #10b981; text-transform: uppercase; letter-spacing: 3px; font-weight: 700; margin-bottom: 12px;">🎉 SPECIAL LAUNCH OFFER</div>
            <div style="font-size: 48px; font-weight: 800; color: #ffffff; margin-bottom: 8px;">1 FREE</div>
            <div style="font-size: 18px; color: #ffffff; margin-bottom: 15px;">Professional Music Video</div>
            <div style="font-size: 14px; color: #aaaaaa; margin-bottom: 20px;">Full quality • Any director style • All platforms included</div>
            <div style="display: inline-block; padding: 10px 20px; background: rgba(16, 185, 129, 0.2); border-radius: 25px; font-size: 13px; color: #10b981; font-weight: 600;">✓ No credit card required</div>
          </td>
        </tr>
      </table>
      
      <!-- WHAT'S INCLUDED -->
      <h3 style="margin: 30px 0 20px 0; font-size: 18px; font-weight: 700; color: #ffffff; text-align: center;">✨ Everything Included FREE:</h3>
      ${featureCard('🎬', 'Complete Music Video', 'Full-length, professionally edited', '#10b981')}
      ${featureCard('🎭', 'Any Director Style', 'All 10+ legendary aesthetics unlocked', '#8b5cf6')}
      ${featureCard('📱', 'All Platform Formats', 'YouTube, TikTok, Instagram, Spotify', '#f97316')}
      ${featureCard('⚡', 'Instant Delivery', 'Ready in minutes, not weeks', '#3b82f6')}
      
      ${ctaButton('🎬 Create My FREE Video Now', URLS.musicVideoCreator, 'green')}
      
      <!-- COMPARISON -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px dashed rgba(249, 115, 22, 0.3); text-align: center;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="48%" style="text-align: center; padding: 15px;">
                  <div style="font-size: 13px; color: #f97316; font-weight: 600; margin-bottom: 8px;">❌ Without Video</div>
                  <div style="font-size: 12px; color: #666666;">Your song competes with millions of audio-only tracks</div>
                </td>
                <td width="4%" style="color: #333;">|</td>
                <td width="48%" style="text-align: center; padding: 15px;">
                  <div style="font-size: 13px; color: #10b981; font-weight: 600; margin-bottom: 8px;">✓ With Video</div>
                  <div style="font-size: 12px; color: #666666;">You stand out, get more engagement, build your brand</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      <p style="margin: 0; font-size: 16px; color: #ffffff; text-align: center; line-height: 1.6;">
        The future of music videos is here.<br>
        <strong style="color: #f97316;">Will you be part of it?</strong>
      </p>
      
      <p style="margin: 30px 0 0 0; font-size: 14px; color: #666666; text-align: center;">
        To your success,<br>
        <strong style="color: #ffffff;">— Alex & The Boostify Team</strong>
      </p>
    `, "Limited time: Create a professional video at zero cost")
  }
];

// ============================================================================
// SEND ALL EMAILS
// ============================================================================

async function sendAllPreviews() {
  console.log('═'.repeat(65));
  console.log('║   🎬 MUSIC VIDEO CREATOR v2 - PREMIUM EMAIL PREVIEWS         ║');
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
  console.log('✅ ALL 5 PREMIUM EMAILS SENT - Check your inbox!');
  console.log('═'.repeat(65));
}

sendAllPreviews();
