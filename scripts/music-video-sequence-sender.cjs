/**
 * 🎬 MUSIC VIDEO CREATOR - EMAIL SEQUENCE SENDER
 * 
 * Sends the 5-email sequence promoting the AI Music Video Creator
 * "The world's first platform trained by legendary directors"
 * Uses Brevo (formerly Sendinblue) for boostifymusic.com domain
 * 
 * Usage:
 *   node music-video-sequence-sender.cjs --sequence=1 --max=50 --preview=true
 *   node music-video-sequence-sender.cjs --sequence=2 --max=100 --preview=false
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
const PREVIEW_MODE = args.preview === 'true' || args.preview === true;
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

// Director names for emails
const DIRECTORS = [
  'Spike Jonze', 'Hype Williams', 'Michel Gondry', 'David Fincher', 
  'Baz Luhrmann', 'Wes Anderson', 'Christopher Nolan', 'Denis Villeneuve'
];

// ============================================================================
// EMAIL TEMPLATES (5 emails)
// ============================================================================

const EMAIL_STYLES = {
  primary: '#f97316',
  secondary: '#10b981', 
  accent: '#8b5cf6',
  dark: '#0f172a',
  headerGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
  ctaGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  aiGradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
};

const URLS = {
  musicVideoCreator: 'https://boostifymusic.com/music-video-creator',
  home: 'https://boostifymusic.com',
  news: 'https://boostifymusic.com/news',
  myArtists: 'https://boostifymusic.com/my-artists',
  producerTools: 'https://boostifymusic.com/producer-tools',
};

// Base template wrapper
function wrapInEmailTemplate(content, preheader = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Boostify Music Video Creator</title>
  <style>
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #0f172a; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding: 25px 20px !important; }
      .mobile-btn { display: block !important; width: 100% !important; max-width: 100% !important; padding: 16px 20px !important; }
      .stat-box { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
      h1 { font-size: 24px !important; }
      p { font-size: 15px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a;">
  <div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 30px 15px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border-radius: 20px; overflow: hidden; border: 1px solid rgba(249, 115, 22, 0.3);">
          <tr>
            <td style="background: ${EMAIL_STYLES.headerGradient}; padding: 30px; text-align: center;">
              <div style="font-size: 32px; margin-bottom: 8px;">🎬</div>
              <div style="font-size: 24px; font-weight: 800; color: #ffffff;">MUSIC VIDEO CREATOR</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 3px; margin-top: 6px;">Powered by AI Directors</div>
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background: rgba(0,0,0,0.4); padding: 30px 40px; border-top: 1px solid rgba(249, 115, 22, 0.2); text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #ffffff;">🎬 Boostify Music Video Creator</p>
              <p style="margin: 0 0 15px 0; font-size: 12px; color: #94a3b8;">Professional AI-generated music videos</p>
              <a href="${URLS.musicVideoCreator}" style="font-size: 12px; color: #f97316; text-decoration: none;">🌐 boostifymusic.com/music-video-creator</a>
              <span style="margin: 0 8px; color: #475569;">|</span>
              <a href="${URLS.news}" style="font-size: 12px; color: #60a5fa; text-decoration: none;">📰 news</a>
              <p style="margin: 15px 0 0 0; font-size: 10px; color: #64748b;">© 2026 Boostify Music. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// CTA Button
function ctaButton(text, url, style = 'primary') {
  const gradients = {
    primary: EMAIL_STYLES.ctaGradient,
    secondary: EMAIL_STYLES.headerGradient,
    ai: EMAIL_STYLES.aiGradient
  };
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td align="center">
          <a href="${url}" class="mobile-btn" style="display: inline-block; background: ${gradients[style]}; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 700; font-size: 16px; text-align: center; box-shadow: 0 4px 15px rgba(249, 115, 22, 0.4);">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

// Feature card
function featureCard(emoji, title, description) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 15px;">
      <tr>
        <td style="padding: 20px; background: rgba(249, 115, 22, 0.08); border-radius: 12px; border-left: 4px solid #f97316;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="50" valign="top" style="padding-right: 15px;"><div style="font-size: 32px;">${emoji}</div></td>
              <td valign="top">
                <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">${title}</div>
                <div style="font-size: 14px; color: #94a3b8; line-height: 1.5;">${description}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

// Director badge
function directorBadge(name) {
  return `<span style="display: inline-block; padding: 6px 14px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 20px; font-size: 12px; color: #a78bfa; margin: 4px;">🎬 ${name}</span>`;
}

// Video preview mockup
function videoPreviewMockup() {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
      <tr>
        <td style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid rgba(249, 115, 22, 0.3);">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #000; border-radius: 12px;">
            <tr>
              <td style="padding: 60px 40px; text-align: center; background: linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);">
                <div style="font-size: 60px; margin-bottom: 15px;">▶️</div>
                <div style="font-size: 18px; font-weight: 700; color: #ffffff;">Your Music Video</div>
                <div style="font-size: 13px; color: #94a3b8;">Directed by AI • Professional Quality</div>
              </td>
            </tr>
          </table>
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
    subject: (lead) => `🎬 ${lead.name}, Create Your Professional Music Video with AI Directors`,
    preheader: "The world's first platform trained by Spike Jonze, Hype Williams, Michel Gondry & more",
    generateHTML: (lead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <h1 style="margin: 0 0 15px 0; font-size: 28px; font-weight: 800; color: #ffffff; line-height: 1.3;">
              Hey ${lead.name}! 👋<br>
              <span style="color: #f97316;">Imagine having Spike Jonze direct your music video.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #94a3b8; line-height: 1.7;">
              We built something impossible: an AI trained on the techniques of the <strong style="color: #f97316;">world's greatest music video directors</strong>.
            </p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td align="center" style="padding: 20px; background: rgba(139, 92, 246, 0.1); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.3);">
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #a78bfa; text-transform: uppercase; letter-spacing: 2px;">AI Trained By</p>
            ${DIRECTORS.map(d => directorBadge(d)).join('\n            ')}
          </td>
        </tr>
      </table>
      ${videoPreviewMockup()}
      <h2 style="margin: 30px 0 20px 0; font-size: 20px; font-weight: 700; color: #ffffff; text-align: center;">🚀 What You Get</h2>
      ${featureCard('🎬', 'Professional Director Styles', 'Choose from 10+ legendary director aesthetics: Spike Jonze, Hype Williams, Gondry...')}
      ${featureCard('🎵', 'Audio-Synced Visuals', 'Perfectly synchronized to every beat and lyric of your song.')}
      ${featureCard('⚡', 'Ready in Minutes', 'No equipment. No crew. No $50,000 budget.')}
      ${featureCard('📱', 'All Formats Included', 'YouTube, TikTok, Instagram Reels, Spotify Canvas.')}
      ${ctaButton('🎬 Create Your Music Video Now', URLS.musicVideoCreator, 'ai')}
      <p style="margin: 25px 0 0 0; font-size: 13px; color: #64748b; text-align: center;">
        This is the future of music videos. Be one of the first to experience it.
      </p>
    `, "The world's first AI trained by legendary directors")
  },

  2: {
    subject: (lead) => `🧠 How We Trained AI on Spike Jonze's Brain (seriously)`,
    preheader: "The technology behind professional music video generation",
    generateHTML: (lead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1.3;">
              ${lead.name}, ever wonder how<br><span style="color: #8b5cf6;">legendary directors think?</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #94a3b8; line-height: 1.7;">
              We spent 2 years analyzing every music video from the greatest directors. Here's what we learned:
            </p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(139, 92, 246, 0.1); border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.3); margin-bottom: 15px;">
            <div style="font-size: 24px; margin-bottom: 10px;">🎭 Spike Jonze</div>
            <div style="font-size: 14px; color: #ffffff; font-weight: 600; margin-bottom: 8px;">Signature: Surreal meets Emotional</div>
            <div style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
              • Single-take wonders (Weapon of Choice)<br>• Practical effects over CGI<br>• Making the absurd feel genuine
            </div>
          </td>
        </tr>
        <tr><td height="15"></td></tr>
        <tr>
          <td style="padding: 25px; background: rgba(249, 115, 22, 0.1); border-radius: 16px; border: 1px solid rgba(249, 115, 22, 0.3);">
            <div style="font-size: 24px; margin-bottom: 10px;">💎 Hype Williams</div>
            <div style="font-size: 14px; color: #ffffff; font-weight: 600; margin-bottom: 8px;">Signature: Maximum Visual Impact</div>
            <div style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
              • Fisheye lens distortion<br>• Rich golds & deep purples<br>• Slow-motion opulence
            </div>
          </td>
        </tr>
        <tr><td height="15"></td></tr>
        <tr>
          <td style="padding: 25px; background: rgba(16, 185, 129, 0.1); border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.3);">
            <div style="font-size: 24px; margin-bottom: 10px;">🎨 Michel Gondry</div>
            <div style="font-size: 14px; color: #ffffff; font-weight: 600; margin-bottom: 8px;">Signature: Handcrafted Wonder</div>
            <div style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
              • In-camera magic tricks<br>• Stop-motion integration<br>• Visual puzzles & illusions
            </div>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          <td align="center" style="padding: 30px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%); border-radius: 16px;">
            <div style="font-size: 40px; margin-bottom: 15px;">🧠</div>
            <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #ffffff;">The AI Magic</h3>
            <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.7;">
              Our AI doesn't just copy — it <strong style="color: #f97316;">understands</strong>. Camera movements, color grading, emotional arcs...
            </p>
          </td>
        </tr>
      </table>
      ${ctaButton('🎬 Choose Your Director Style', URLS.musicVideoCreator, 'primary')}
    `, "How we trained AI on legendary music video directors")
  },

  3: {
    subject: (lead) => `⚡ 3 Steps: Upload Song → Pick Director → Get Video`,
    preheader: "The simplest way to get a professional music video ever created",
    generateHTML: (lead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1.3;">
              ${lead.name}, getting a pro music video<br><span style="color: #10b981;">has never been this easy.</span>
            </h1>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(249, 115, 22, 0.1); border-radius: 16px; border: 1px solid rgba(249, 115, 22, 0.3);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="60" valign="top">
                  <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 50%; text-align: center; line-height: 50px; font-size: 24px; font-weight: 800; color: #ffffff;">1</div>
                </td>
                <td valign="top">
                  <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">🎵 Upload Your Song</div>
                  <div style="font-size: 14px; color: #94a3b8;">Just drag & drop. Our AI analyzes beats, lyrics, emotion, and energy.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(139, 92, 246, 0.1); border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.3);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="60" valign="top">
                  <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); border-radius: 50%; text-align: center; line-height: 50px; font-size: 24px; font-weight: 800; color: #ffffff;">2</div>
                </td>
                <td valign="top">
                  <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">🎬 Pick Your Director</div>
                  <div style="font-size: 14px; color: #94a3b8;">Wes Anderson symmetry? Fincher's intensity? Gondry's playfulness? One click.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(16, 185, 129, 0.1); border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.3);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="60" valign="top">
                  <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; text-align: center; line-height: 50px; font-size: 24px; font-weight: 800; color: #ffffff;">3</div>
                </td>
                <td valign="top">
                  <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">✨ Get Your Video</div>
                  <div style="font-size: 14px; color: #94a3b8;">Complete music video ready in minutes. All platforms included.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      ${ctaButton('🚀 Start Creating Now', URLS.musicVideoCreator, 'primary')}
    `, "3 simple steps to your professional music video")
  },

  4: {
    subject: (lead) => `🔥 Artists are blowing up with AI-generated videos`,
    preheader: "See what independent artists are creating",
    generateHTML: (lead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1.3;">
              ${lead.name}, artists are already<br><span style="color: #f97316;">going viral with AI videos.</span>
            </h1>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(249, 115, 22, 0.1); border-radius: 16px; border-left: 4px solid #f97316;">
            <div style="font-size: 28px; margin-bottom: 10px;">🎤</div>
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #ffffff; line-height: 1.6; font-style: italic;">
              "I used to think music videos were only for signed artists. This AI gave me Hype Williams-quality visuals. My fans thought I hired a real production crew."
            </p>
            <div style="font-size: 14px; font-weight: 600; color: #f97316;">@DripKing_ATL</div>
            <div style="font-size: 12px; color: #64748b;">Hip-Hop Artist • 45K Spotify Monthly</div>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(139, 92, 246, 0.1); border-radius: 16px; border-left: 4px solid #8b5cf6;">
            <div style="font-size: 28px; margin-bottom: 10px;">🎸</div>
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #ffffff; line-height: 1.6; font-style: italic;">
              "I selected Wes Anderson style and literally gasped. The symmetry, the colors, the FEELING. It's like he actually directed it."
            </p>
            <div style="font-size: 14px; font-weight: 600; color: #8b5cf6;">Luna Martinez</div>
            <div style="font-size: 12px; color: #64748b;">Indie-Pop Artist • Berlin</div>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(16, 185, 129, 0.1); border-radius: 16px; border-left: 4px solid #10b981;">
            <div style="font-size: 28px; margin-bottom: 10px;">🎹</div>
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #ffffff; line-height: 1.6; font-style: italic;">
              "My TikTok went from 500 to 50K views after posting the AI video. The algorithm LOVES professional visuals."
            </p>
            <div style="font-size: 14px; font-weight: 600; color: #10b981;">BeatsByMilo</div>
            <div style="font-size: 12px; color: #64748b;">Electronic Producer • 120K TikTok</div>
          </td>
        </tr>
      </table>
      ${ctaButton('🎬 Join These Artists Now', URLS.musicVideoCreator, 'secondary')}
      <p style="margin: 25px 0 0 0; font-size: 13px; color: #64748b; text-align: center;">
        Tomorrow: A special offer you won't want to miss 👀
      </p>
    `, "Artists are blowing up with AI-generated music videos")
  },

  5: {
    subject: (lead) => `🎁 Final: Your First AI Music Video is on Us`,
    preheader: "Create your first professional music video FREE",
    generateHTML: (lead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <div style="font-size: 50px; margin-bottom: 15px;">🎁</div>
            <h1 style="margin: 0 0 15px 0; font-size: 28px; font-weight: 800; color: #ffffff; line-height: 1.3;">
              ${lead.name}, this is it.<br><span style="color: #10b981;">Your first video is FREE.</span>
            </h1>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%); border-radius: 16px; border: 2px solid #10b981; text-align: center;">
            <div style="font-size: 14px; color: #10b981; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">🎉 SPECIAL LAUNCH OFFER</div>
            <div style="font-size: 36px; font-weight: 800; color: #ffffff; margin-bottom: 10px;">1 FREE Video</div>
            <div style="font-size: 15px; color: #94a3b8; margin-bottom: 15px;">Full quality • Any director style • All platforms</div>
            <div style="display: inline-block; padding: 8px 16px; background: rgba(16, 185, 129, 0.2); border-radius: 20px; font-size: 12px; color: #10b981; font-weight: 600;">No credit card required</div>
          </td>
        </tr>
      </table>
      <h3 style="margin: 30px 0 20px 0; font-size: 18px; font-weight: 700; color: #ffffff; text-align: center;">✨ What You Get FREE:</h3>
      ${featureCard('🎬', 'Complete Music Video', 'Full-length video synced to your song')}
      ${featureCard('🎭', 'Any Director Style', 'Spike Jonze, Hype Williams, Gondry, Wes Anderson & more')}
      ${featureCard('📱', 'All Platform Formats', 'YouTube, TikTok, Instagram, Spotify Canvas')}
      ${featureCard('⚡', 'Instant Delivery', 'Ready in minutes, not weeks')}
      ${ctaButton('🎬 Create My FREE Video Now', URLS.musicVideoCreator, 'primary')}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(249, 115, 22, 0.1); border-radius: 16px; border: 1px dashed rgba(249, 115, 22, 0.5); text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
              <strong style="color: #f97316;">Without a video:</strong> Your song competes with millions of audio-only tracks<br><br>
              <strong style="color: #10b981;">With a video:</strong> You stand out, get more engagement, build your visual brand
            </p>
          </td>
        </tr>
      </table>
      <p style="margin: 0; font-size: 15px; color: #ffffff; text-align: center; line-height: 1.6;">
        The future of music videos is here.<br><strong style="color: #f97316;">Will you be part of it?</strong>
      </p>
      <p style="margin: 30px 0 0 0; font-size: 13px; color: #64748b; text-align: center;">
        To your success,<br><strong style="color: #ffffff;">The Boostify Team</strong>
      </p>
    `, "Your first professional AI music video is FREE")
  }
};

// ============================================================================
// MAIN SENDING FUNCTION
// ============================================================================

async function sendMusicVideoSequence() {
  console.log('\n' + '═'.repeat(70));
  console.log('║   🎬 MUSIC VIDEO CREATOR - EMAIL SEQUENCE                        ║');
  console.log('═'.repeat(70));
  console.log(`📧 Sequence Email: #${SEQUENCE_NUMBER}/5`);
  console.log(`📊 Max Emails: ${MAX_EMAILS}`);
  console.log(`🔄 Mode: ${PREVIEW_MODE ? '⚠️ PREVIEW (to convoycubano@gmail.com)' : '✅ PRODUCTION (real emails)'}`);
  console.log('─'.repeat(70));

  const client = await pool.connect();

  try {
    // Get leads ready for this sequence
    const statusForSequence = SEQUENCE_NUMBER === 1 
      ? `'new', 'warming'` // First email goes to new and warming leads
      : `'mv_sequence_${SEQUENCE_NUMBER - 1}'`; // Subsequent emails go to previous sequence

    const query = `
      SELECT l.*, ls.id as status_id, ls.warmup_stage
      FROM leads l
      JOIN lead_status ls ON l.id = ls.lead_id
      WHERE (
        ${SEQUENCE_NUMBER === 1 
          ? `(ls.status IN ('new', 'warming') OR ls.warmup_stage >= 3)` 
          : `ls.status = 'mv_sequence_${SEQUENCE_NUMBER - 1}'`
        }
      )
      AND l.email IS NOT NULL
      AND l.email != ''
      ORDER BY l.created_at ASC
      LIMIT $1
    `;

    const leadsResult = await client.query(query, [MAX_EMAILS]);

    if (leadsResult.rows.length === 0) {
      console.log('\n✅ No leads ready for this sequence email');
      return;
    }

    console.log(`\n📋 LEADS TO CONTACT: ${leadsResult.rows.length}`);
    console.log('─'.repeat(70));

    const template = EMAIL_TEMPLATES[SEQUENCE_NUMBER];
    let sent = 0;
    let errors = 0;

    for (let i = 0; i < leadsResult.rows.length; i++) {
      const lead = leadsResult.rows[i];
      const toEmail = PREVIEW_MODE ? PREVIEW_EMAIL : lead.email;
      
      const leadData = {
        name: lead.first_name || lead.name || 'Artist',
        artistName: lead.artist_name || lead.company_name,
        email: lead.email
      };

      console.log(`\n📧 [${i+1}/${leadsResult.rows.length}] ${leadData.name} (${lead.email})`);

      try {
        const subject = template.subject(leadData);
        const html = template.generateHTML(leadData);

        console.log(`   Subject: ${subject}`);

        const emailResult = await sendBrevoEmail(toEmail, subject, html, REPLY_TO[0]);

        // Update lead status
        await client.query(`
          UPDATE lead_status
          SET status = $1, last_email_at = NOW()
          WHERE id = $2
        `, [`mv_sequence_${SEQUENCE_NUMBER}`, lead.status_id]);

        // Log email send
        await client.query(`
          INSERT INTO email_sends (lead_id, resend_id, from_email, to_email, subject, email_type, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'sent')
        `, [lead.id, emailResult.data?.id, FROM_EMAIL, toEmail, subject, `mv_sequence_${SEQUENCE_NUMBER}`]);

        sent++;
        console.log(`   ✅ Sent to ${toEmail}`);

        // Random delay between emails
        if (i < leadsResult.rows.length - 1) {
          const delay = Math.floor(Math.random() * (60 - 30 + 1) + 30);
          console.log(`   ⏱️ Waiting ${delay}s before next email...`);
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }

      } catch (error) {
        errors++;
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    console.log('\n' + '═'.repeat(70));
    console.log(`📊 RESULTS: ${sent} sent, ${errors} errors`);
    console.log('═'.repeat(70));

  } finally {
    client.release();
    await pool.end();
  }
}

// Run
sendMusicVideoSequence().catch(console.error);
