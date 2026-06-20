/**
 * 🤝 BOOSTISWAP - PREMIUM 5 EMAIL SEQUENCE
 * 
 * Secuencia de emails para promover BoostiSwap:
 * - Plataforma de colaboración entre artistas
 * - Intercambio de streams, shares, features
 * - Trading de tokens de artistas
 * 
 * Estilo: Mismo diseño premium de Music Video Creator v2
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
  boostiswap: 'https://boostifymusic.com/boostiswap',
};

// ============================================================================
// PREMIUM EMAIL TEMPLATE WRAPPER
// ============================================================================

function wrapInEmailTemplate(content, preheader = '') {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>BoostiSwap - Artist Collaboration Network</title>
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
    a { color: #10b981; text-decoration: none; }
    
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
      
      .feature-grid { display: block !important; width: 100% !important; }
      .feature-item { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
      .hero-title { font-size: 26px !important; line-height: 1.2 !important; }
      .section-title { font-size: 20px !important; }
      .stat-number { font-size: 32px !important; }
      .testimonial-text { font-size: 14px !important; }
      .step-number { width: 45px !important; height: 45px !important; font-size: 20px !important; line-height: 45px !important; }
      .mobile-center { text-align: center !important; }
      .mobile-full-width { width: 100% !important; }
      .swap-card { padding: 20px 15px !important; }
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
          
          <!-- HEADER HERO - Teal/Green gradient para BoostiSwap -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="mobile-padding-header" style="padding: 40px 40px 30px 40px; text-align: center;">
                    <!-- Logo/Brand -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 20px auto;">
                      <tr>
                        <td style="background: rgba(0,0,0,0.3); padding: 12px 24px; border-radius: 50px;">
                          <span style="font-size: 20px; margin-right: 8px;">🤝</span>
                          <span style="font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">BOOSTISWAP</span>
                        </td>
                      </tr>
                    </table>
                    <!-- Tagline -->
                    <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 4px; font-weight: 600;">Artist Collaboration Network</p>
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
                      🤝 BoostiSwap by Boostify Music
                    </p>
                    <p style="margin: 0 0 15px 0; font-size: 12px; color: #666666;">
                      Where artists connect, collaborate, and grow together
                    </p>
                    <a href="${URLS.boostiswap}" style="display: inline-block; padding: 10px 20px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; font-size: 12px; color: #10b981; text-decoration: none; font-weight: 600;">
                      🌐 Join BoostiSwap
                    </a>
                    <p style="margin: 20px 0 0 0; font-size: 10px; color: #444444;">
                      © 2026 Boostify Music • Built for independent artists
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

function ctaButton(text, url, gradient = 'green') {
  const gradients = {
    green: 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);',
    orange: 'background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);',
    purple: 'background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);',
    teal: 'background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);',
    rainbow: 'background: linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #0ea5e9 100%);'
  };
  
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
      <tr>
        <td align="center" class="cta-button-wrapper">
          <a href="${url}" class="cta-button" style="display: inline-block; ${gradients[gradient]} color: #ffffff; text-decoration: none; padding: 18px 45px; border-radius: 12px; font-weight: 700; font-size: 16px; text-align: center; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.35); mso-padding-alt: 0;">
            <!--[if mso]><i style="mso-font-width: 400%; mso-text-raise: 30pt;">&nbsp;</i><![endif]-->
            <span style="mso-text-raise: 15pt;">${text}</span>
            <!--[if mso]><i style="mso-font-width: 400%;">&nbsp;</i><![endif]-->
          </a>
        </td>
      </tr>
    </table>
  `;
}

function featureCard(emoji, title, description, accentColor = '#10b981') {
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
          <td width="${100/stats.length}%" style="text-align: center; padding: 20px 10px; background: rgba(16, 185, 129, 0.08); ${i === 0 ? 'border-radius: 12px 0 0 12px;' : i === stats.length - 1 ? 'border-radius: 0 12px 12px 0;' : ''} border-right: ${i < stats.length - 1 ? '1px solid rgba(16, 185, 129, 0.15)' : 'none'};">
            <div class="stat-number" style="font-size: 36px; font-weight: 800; color: #10b981; margin-bottom: 5px;">${stat.value}</div>
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

function swapCard(artistFrom, artistTo, type) {
  const colors = {
    streams: '#10b981',
    feature: '#8b5cf6',
    playlist: '#f97316',
    share: '#0ea5e9'
  };
  const emojis = {
    streams: '🎧',
    feature: '🎤',
    playlist: '📋',
    share: '📢'
  };
  const labels = {
    streams: 'Stream Exchange',
    feature: 'Feature Collab',
    playlist: 'Playlist Add',
    share: 'Social Share'
  };
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
      <tr>
        <td class="swap-card" style="padding: 18px 20px; background: rgba(16, 185, 129, 0.06); border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.15);">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="35%">
                <div style="font-size: 13px; color: #ffffff; font-weight: 600;">${artistFrom}</div>
                <div style="font-size: 11px; color: #666666;">Artist</div>
              </td>
              <td width="30%" align="center">
                <div style="font-size: 18px;">${emojis[type]} ⇄</div>
                <div style="font-size: 10px; color: ${colors[type]}; font-weight: 600;">${labels[type]}</div>
              </td>
              <td width="35%" align="right">
                <div style="font-size: 13px; color: #ffffff; font-weight: 600;">${artistTo}</div>
                <div style="font-size: 11px; color: #666666;">Artist</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function screenshotMockup(title, subtitle) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 3px; background: linear-gradient(135deg, #10b981 0%, #0ea5e9 100%); border-radius: 16px;">
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
                      <span style="display: inline-block; margin-left: 15px; font-size: 11px; color: #666;">boostifymusic.com/boostiswap</span>
                    </td>
                  </tr>
                </table>
                <!-- Content area -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%);">
                  <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                      <div style="font-size: 50px; margin-bottom: 15px;">🤝</div>
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

// ============================================================================
// 5 BOOSTISWAP EMAIL TEMPLATES
// ============================================================================

const EMAILS = [
  // EMAIL 1: THE CONCEPT - What is BoostiSwap?
  {
    subject: `🤝 What if every artist helped each other grow?`,
    preheader: "Introducing BoostiSwap: The artist collaboration network",
    html: (name) => wrapInEmailTemplate(`
      <!-- HERO TITLE -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 32px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              Hey ${name}! 👋<br>
              <span style="background: linear-gradient(135deg, #10b981 0%, #0ea5e9 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">What if artists actually supported each other?</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999; line-height: 1.7; max-width: 450px;">
              Not fake follows. Not bots. <strong style="color: #ffffff;">Real artists exchanging real support.</strong>
            </p>
          </td>
        </tr>
      </table>
      
      <!-- INTRODUCING BOOSTISWAP -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(14, 165, 233, 0.1) 100%); border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.25); text-align: center;">
            <div style="font-size: 14px; color: #10b981; text-transform: uppercase; letter-spacing: 3px; font-weight: 700; margin-bottom: 12px;">✨ INTRODUCING</div>
            <div style="font-size: 36px; font-weight: 800; color: #ffffff; margin-bottom: 10px;">BoostiSwap</div>
            <div style="font-size: 15px; color: #aaaaaa;">The Artist Collaboration Network</div>
          </td>
        </tr>
      </table>
      
      <!-- SCREENSHOT -->
      ${screenshotMockup('Artist Matching Dashboard', 'Find artists in your genre • Exchange support • Grow together')}
      
      <!-- WHAT YOU CAN SWAP -->
      <h2 class="section-title" style="margin: 35px 0 20px 0; font-size: 22px; font-weight: 700; color: #ffffff; text-align: center;">🔄 What You Can Swap</h2>
      ${featureCard('🎧', 'Stream Exchanges', 'Listen to each other\'s tracks and boost those streaming numbers', '#10b981')}
      ${featureCard('🎤', 'Feature Collaborations', 'Find artists for features, remixes, and joint tracks', '#8b5cf6')}
      ${featureCard('📋', 'Playlist Adds', 'Add each other to user-curated playlists for organic reach', '#f97316')}
      ${featureCard('📢', 'Social Shares', 'Cross-promote on Instagram, TikTok, Twitter', '#0ea5e9')}
      
      <!-- STATS -->
      ${statsRow([
        { value: '2,500+', label: 'Artists' },
        { value: '10K+', label: 'Swaps' },
        { value: '100%', label: 'Free' }
      ])}
      
      <!-- CTA -->
      ${ctaButton('🤝 Join BoostiSwap Free', URLS.boostiswap, 'rainbow')}
      
      <p style="margin: 0; font-size: 13px; color: #555555; text-align: center;">
        No bots. No fake engagement. Just artists helping artists.
      </p>
    `, "Introducing BoostiSwap: The artist collaboration network")
  },

  // EMAIL 2: HOW IT WORKS
  {
    subject: `⚡ How artists are 10x-ing their streams (without paying)`,
    preheader: "The simple swap system that's changing the game",
    html: (name) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, here's the<br>
              <span style="color: #10b981;">simple secret.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999; line-height: 1.7;">
              Artists who support each other <strong style="color: #ffffff;">grow 10x faster</strong>.
            </p>
          </td>
        </tr>
      </table>
      
      <!-- 3 STEPS -->
      ${stepCard('1', '🎵 Create Your Profile', 'Upload your music, set your genre, and tell us what you\'re looking for (streams, collabs, playlist adds...)', '#10b981')}
      ${stepCard('2', '🔍 Get Matched', 'Our algorithm finds artists in your genre who complement your style and want the same things you do.', '#0ea5e9')}
      ${stepCard('3', '🤝 Start Swapping', 'Exchange streams, shares, features, playlist adds. Real support, real growth.', '#8b5cf6')}
      
      <!-- LIVE SWAPS HAPPENING NOW -->
      <h3 style="margin: 30px 0 20px 0; font-size: 18px; font-weight: 700; color: #ffffff; text-align: center;">🔴 Live Swaps Happening Now</h3>
      ${swapCard('DripKing_ATL', 'NeonBeats', 'streams')}
      ${swapCard('Luna Martinez', 'SkyWalker', 'feature')}
      ${swapCard('BeatsByMilo', 'VelvetVox', 'playlist')}
      ${swapCard('OceanWaves', 'FireStarter', 'share')}
      
      <!-- THE MATH -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(16, 185, 129, 0.1); border-radius: 16px; text-align: center;">
            <div style="font-size: 14px; color: #10b981; font-weight: 600; margin-bottom: 15px;">📊 THE MATH</div>
            <p style="margin: 0; font-size: 14px; color: #cccccc; line-height: 1.7;">
              <strong style="color: #ffffff;">10 swaps/week × 50 streams each = 500 new streams</strong><br>
              Those streams trigger the algorithm.<br>
              The algorithm pushes your track to new listeners.<br>
              <span style="color: #10b981; font-weight: 600;">Real growth. Zero cost.</span>
            </p>
          </td>
        </tr>
      </table>
      
      ${ctaButton('🚀 Start Swapping Now', URLS.boostiswap, 'green')}
    `, "How artists are 10x-ing their streams for free")
  },

  // EMAIL 3: THE COMMUNITY
  {
    subject: `🌍 2,500 artists. One mission. Growth.`,
    preheader: "Meet the community that's changing how artists grow",
    html: (name) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, you're not<br>
              <span style="color: #10b981;">alone in this.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999; line-height: 1.7;">
              2,500+ independent artists. All genres. One goal: <strong style="color: #ffffff;">grow together</strong>.
            </p>
          </td>
        </tr>
      </table>
      
      <!-- GENRE BREAKDOWN -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(16, 185, 129, 0.08); border-radius: 16px;">
            <div style="font-size: 14px; color: #10b981; font-weight: 600; text-align: center; margin-bottom: 15px;">🎵 ARTISTS BY GENRE</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="50%" style="padding: 8px;">
                  <span style="display: inline-block; padding: 8px 14px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.35); border-radius: 20px; font-size: 12px; color: #c4b5fd; width: 100%; text-align: center;">🎤 Hip-Hop: 650+</span>
                </td>
                <td width="50%" style="padding: 8px;">
                  <span style="display: inline-block; padding: 8px 14px; background: rgba(249, 115, 22, 0.2); border: 1px solid rgba(249, 115, 22, 0.35); border-radius: 20px; font-size: 12px; color: #fdba74; width: 100%; text-align: center;">🎹 Electronic: 520+</span>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding: 8px;">
                  <span style="display: inline-block; padding: 8px 14px; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 20px; font-size: 12px; color: #6ee7b7; width: 100%; text-align: center;">🎸 Indie/Rock: 480+</span>
                </td>
                <td width="50%" style="padding: 8px;">
                  <span style="display: inline-block; padding: 8px 14px; background: rgba(236, 72, 153, 0.2); border: 1px solid rgba(236, 72, 153, 0.35); border-radius: 20px; font-size: 12px; color: #f9a8d4; width: 100%; text-align: center;">🎵 Pop/R&B: 550+</span>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 8px; text-align: center;">
                  <span style="display: inline-block; padding: 8px 14px; background: rgba(14, 165, 233, 0.2); border: 1px solid rgba(14, 165, 233, 0.35); border-radius: 20px; font-size: 12px; color: #7dd3fc;">🌍 Latin/World: 300+</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      <!-- TESTIMONIALS -->
      ${testimonialCard(
        "I found 3 producers in my first week. One of our collabs just hit 100K streams. All from a swap.",
        "@DripKing_ATL",
        "Hip-Hop • Atlanta",
        "🎤",
        "#8b5cf6"
      )}
      
      ${testimonialCard(
        "The playlist exchanges alone have doubled my monthly listeners. These are real people, not bots.",
        "Luna Martinez",
        "Indie-Pop • Berlin",
        "🎸",
        "#10b981"
      )}
      
      ${testimonialCard(
        "Found my producer, my mixing engineer, AND my cover artist here. It's like LinkedIn for musicians.",
        "BeatsByMilo",
        "Electronic • LA",
        "🎹",
        "#f97316"
      )}
      
      <!-- SCREENSHOT -->
      ${screenshotMockup('Community Feed', 'See what artists are creating • Find collaboration opportunities')}
      
      ${ctaButton('🌍 Join the Community', URLS.boostiswap, 'teal')}
    `, "2,500 artists collaborating. Will you join?")
  },

  // EMAIL 4: SUCCESS STORIES
  {
    subject: `🔥 "We met on BoostiSwap. Now we're on radio."`,
    preheader: "Real artists. Real collaborations. Real results.",
    html: (name) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, these artists<br>
              <span style="color: #10b981;">started just like you.</span>
            </h1>
          </td>
        </tr>
      </table>
      
      <!-- SUCCESS STORY 1 -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(139, 92, 246, 0.05) 100%); border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.25);">
            <div style="font-size: 12px; color: #8b5cf6; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">🏆 SUCCESS STORY</div>
            <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">From Swap to Radio</div>
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #aaaaaa; line-height: 1.6;">
              Sofia (R&B, Miami) matched with Marcus (Producer, Atlanta) on BoostiSwap. They exchanged streams, liked each other's vibe, and decided to collab.
            </p>
            <p style="margin: 0; font-size: 14px; color: #ffffff; line-height: 1.6;">
              <strong>Result:</strong> Their track is now playing on <span style="color: #8b5cf6; font-weight: 600;">radio in 3 countries</span>. All from one swap.
            </p>
          </td>
        </tr>
      </table>
      
      <!-- SUCCESS STORY 2 -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.05) 100%); border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.25);">
            <div style="font-size: 12px; color: #10b981; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">📈 GROWTH STORY</div>
            <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">0 to 50K Monthly Listeners</div>
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #aaaaaa; line-height: 1.6;">
              Jake (Indie, Austin) was stuck at 200 monthly listeners. He started doing 5 playlist swaps per week with artists in his genre.
            </p>
            <p style="margin: 0; font-size: 14px; color: #ffffff; line-height: 1.6;">
              <strong>Result:</strong> 6 months later: <span style="color: #10b981; font-weight: 600;">50,000 monthly listeners</span>. Same music. Just more ears.
            </p>
          </td>
        </tr>
      </table>
      
      <!-- SUCCESS STORY 3 -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(249, 115, 22, 0.05) 100%); border-radius: 16px; border: 1px solid rgba(249, 115, 22, 0.25);">
            <div style="font-size: 12px; color: #f97316; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">🤝 COLLAB STORY</div>
            <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">5 Features in One Month</div>
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #aaaaaa; line-height: 1.6;">
              Mia (Hip-Hop, NYC) was looking for artists to feature on her EP. Posted on BoostiSwap, got 20 requests in 48 hours.
            </p>
            <p style="margin: 0; font-size: 14px; color: #ffffff; line-height: 1.6;">
              <strong>Result:</strong> EP dropped with <span style="color: #f97316; font-weight: 600;">5 fire features</span>. Combined fanbase: 200K followers.
            </p>
          </td>
        </tr>
      </table>
      
      <!-- STATS -->
      ${statsRow([
        { value: '500+', label: 'Collabs Made' },
        { value: '2M+', label: 'Streams Generated' },
        { value: '98%', label: 'Would Recommend' }
      ])}
      
      ${ctaButton('🔥 Write Your Success Story', URLS.boostiswap, 'orange')}
      
      <p style="margin: 25px 0 0 0; font-size: 14px; color: #666666; text-align: center;">
        Tomorrow: A special surprise for you 👀
      </p>
    `, "Real artists. Real collabs. Real results.")
  },

  // EMAIL 5: THE OFFER - Join Now
  {
    subject: `🎁 Your network is waiting. Join free.`,
    preheader: "2,500 artists ready to collaborate with you",
    html: (name) => wrapInEmailTemplate(`
      <!-- GIFT HEADER -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 20px;">
            <div style="font-size: 60px; margin-bottom: 15px;">🎁</div>
            <h1 class="hero-title" style="margin: 0 0 15px 0; font-size: 32px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center;">
              ${name}, this is your<br>
              <span style="color: #10b981;">invitation.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #999999;">
              2,500 artists are waiting to collaborate with you.
            </p>
          </td>
        </tr>
      </table>
      
      <!-- FREE ACCESS BOX -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 35px 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%); border-radius: 20px; border: 2px solid #10b981; text-align: center;">
            <div style="font-size: 12px; color: #10b981; text-transform: uppercase; letter-spacing: 3px; font-weight: 700; margin-bottom: 12px;">🎉 FULL ACCESS</div>
            <div style="font-size: 48px; font-weight: 800; color: #ffffff; margin-bottom: 8px;">100% FREE</div>
            <div style="font-size: 18px; color: #ffffff; margin-bottom: 15px;">Forever. No hidden fees. No trials.</div>
            <div style="font-size: 14px; color: #aaaaaa; margin-bottom: 20px;">Just artists helping artists.</div>
            <div style="display: inline-block; padding: 10px 20px; background: rgba(16, 185, 129, 0.2); border-radius: 25px; font-size: 13px; color: #10b981; font-weight: 600;">✓ No credit card required</div>
          </td>
        </tr>
      </table>
      
      <!-- WHAT YOU GET -->
      <h3 style="margin: 30px 0 20px 0; font-size: 18px; font-weight: 700; color: #ffffff; text-align: center;">✨ What You Get:</h3>
      ${featureCard('🔍', 'Smart Matching', 'AI matches you with artists in your genre who want the same things', '#10b981')}
      ${featureCard('🎧', 'Stream Exchanges', 'Boost each other\'s numbers with real plays from real artists', '#0ea5e9')}
      ${featureCard('🎤', 'Collaboration Board', 'Find features, remixes, and joint projects', '#8b5cf6')}
      ${featureCard('📋', 'Playlist Network', 'Add each other to user-curated playlists', '#f97316')}
      ${featureCard('📢', 'Social Cross-Promo', 'Amplify each other across all platforms', '#ec4899')}
      
      ${ctaButton('🤝 Join BoostiSwap FREE', URLS.boostiswap, 'green')}
      
      <!-- COMPARISON -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px dashed rgba(16, 185, 129, 0.3); text-align: center;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="48%" style="text-align: center; padding: 15px;">
                  <div style="font-size: 13px; color: #ef4444; font-weight: 600; margin-bottom: 8px;">❌ Alone</div>
                  <div style="font-size: 12px; color: #666666;">Competing against millions of artists. Shouting into the void.</div>
                </td>
                <td width="4%" style="color: #333;">|</td>
                <td width="48%" style="text-align: center; padding: 15px;">
                  <div style="font-size: 13px; color: #10b981; font-weight: 600; margin-bottom: 8px;">✓ With BoostiSwap</div>
                  <div style="font-size: 12px; color: #666666;">2,500 artists supporting you. Growing together.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      <p style="margin: 0; font-size: 16px; color: #ffffff; text-align: center; line-height: 1.6;">
        The music industry is lonely.<br>
        <strong style="color: #10b981;">It doesn't have to be.</strong>
      </p>
      
      <p style="margin: 30px 0 0 0; font-size: 14px; color: #666666; text-align: center;">
        See you inside,<br>
        <strong style="color: #ffffff;">— Alex & The Boostify Team</strong>
      </p>
    `, "2,500 artists ready to collaborate. Join free.")
  }
];

// ============================================================================
// SEND ALL EMAILS
// ============================================================================

async function sendAllPreviews() {
  console.log('═'.repeat(65));
  console.log('║   🤝 BOOSTISWAP - PREMIUM EMAIL SEQUENCE PREVIEW              ║');
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
  console.log('✅ ALL 5 BOOSTISWAP EMAILS SENT - Check your inbox!');
  console.log('═'.repeat(65));
}

sendAllPreviews();
