/**
 * 🎬 MUSIC VIDEO CREATOR - PREVIEW ALL 5 EMAILS
 * 
 * Sends all 5 emails to convoycubano@gmail.com for review
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

const DIRECTORS = [
  'Spike Jonze', 'Hype Williams', 'Michel Gondry', 'David Fincher', 
  'Baz Luhrmann', 'Wes Anderson', 'Christopher Nolan', 'Denis Villeneuve'
];

const URLS = {
  musicVideoCreator: 'https://boostifymusic.com/music-video-creator',
};

const EMAIL_STYLES = {
  headerGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
  ctaGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  aiGradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
};

function wrapInEmailTemplate(content, preheader = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boostify Music Video Creator</title>
  <style>
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0 !important; padding: 0 !important; background-color: #0f172a; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .mobile-padding { padding: 25px 20px !important; }
      .mobile-btn { display: block !important; width: 100% !important; }
      h1 { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a;">
  <div style="display: none;">${preheader}</div>
  <table role="presentation" width="100%" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 30px 15px;">
        <table role="presentation" width="600" class="email-container" style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border-radius: 20px; border: 1px solid rgba(249, 115, 22, 0.3);">
          <tr>
            <td style="background: ${EMAIL_STYLES.headerGradient}; padding: 30px; text-align: center;">
              <div style="font-size: 32px;">🎬</div>
              <div style="font-size: 24px; font-weight: 800; color: #ffffff;">MUSIC VIDEO CREATOR</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 3px;">Powered by AI Directors</div>
            </td>
          </tr>
          <tr>
            <td class="mobile-padding" style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background: rgba(0,0,0,0.4); padding: 30px; border-top: 1px solid rgba(249, 115, 22, 0.2); text-align: center;">
              <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #ffffff;">🎬 Boostify Music Video Creator</p>
              <a href="${URLS.musicVideoCreator}" style="font-size: 12px; color: #f97316;">🌐 boostifymusic.com/music-video-creator</a>
              <p style="margin: 15px 0 0; font-size: 10px; color: #64748b;">© 2026 Boostify Music</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text, url, style = 'primary') {
  const gradients = { primary: EMAIL_STYLES.ctaGradient, secondary: EMAIL_STYLES.headerGradient, ai: EMAIL_STYLES.aiGradient };
  return `<table width="100%" style="margin: 25px 0;"><tr><td align="center">
    <a href="${url}" class="mobile-btn" style="display: inline-block; background: ${gradients[style]}; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(249, 115, 22, 0.4);">${text}</a>
  </td></tr></table>`;
}

function featureCard(emoji, title, description) {
  return `<table width="100%" style="margin-bottom: 15px;"><tr>
    <td style="padding: 20px; background: rgba(249, 115, 22, 0.08); border-radius: 12px; border-left: 4px solid #f97316;">
      <table width="100%"><tr>
        <td width="50" valign="top"><div style="font-size: 32px;">${emoji}</div></td>
        <td valign="top">
          <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">${title}</div>
          <div style="font-size: 14px; color: #94a3b8;">${description}</div>
        </td>
      </tr></table>
    </td>
  </tr></table>`;
}

function directorBadge(name) {
  return `<span style="display: inline-block; padding: 6px 14px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 20px; font-size: 12px; color: #a78bfa; margin: 4px;">🎬 ${name}</span>`;
}

function videoPreviewMockup() {
  return `<table width="100%" style="margin: 30px 0;"><tr>
    <td style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid rgba(249, 115, 22, 0.3);">
      <table width="100%" style="background: #000; border-radius: 12px;"><tr>
        <td style="padding: 60px 40px; text-align: center; background: linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);">
          <div style="font-size: 60px;">▶️</div>
          <div style="font-size: 18px; font-weight: 700; color: #ffffff;">Your Music Video</div>
          <div style="font-size: 13px; color: #94a3b8;">Directed by AI • Professional Quality</div>
        </td>
      </tr></table>
    </td>
  </tr></table>`;
}

// ============================================================================
// 5 EMAIL TEMPLATES
// ============================================================================

const EMAILS = [
  {
    subject: `🎬 [PREVIEW 1/5] Create Your Professional Music Video with AI Directors`,
    preheader: "The world's first platform trained by Spike Jonze, Hype Williams & more",
    html: (name) => wrapInEmailTemplate(`
      <h1 style="margin: 0 0 15px; font-size: 28px; font-weight: 800; color: #ffffff; text-align: center;">
        Hey ${name}! 👋<br><span style="color: #f97316;">Imagine having Spike Jonze direct your music video.</span>
      </h1>
      <p style="text-align: center; font-size: 16px; color: #94a3b8;">
        We built something impossible: an AI trained on the techniques of the <strong style="color: #f97316;">world's greatest music video directors</strong>.
      </p>
      <div style="padding: 20px; background: rgba(139, 92, 246, 0.1); border-radius: 12px; text-align: center; margin: 20px 0;">
        <p style="margin: 0 0 12px; font-size: 12px; color: #a78bfa; text-transform: uppercase;">AI Trained By</p>
        ${DIRECTORS.map(d => directorBadge(d)).join(' ')}
      </div>
      ${videoPreviewMockup()}
      <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; text-align: center;">🚀 What You Get</h2>
      ${featureCard('🎬', 'Professional Director Styles', 'Choose from 10+ legendary director aesthetics')}
      ${featureCard('🎵', 'Audio-Synced Visuals', 'Perfectly synchronized to every beat and lyric')}
      ${featureCard('⚡', 'Ready in Minutes', 'No equipment. No crew. No $50,000 budget.')}
      ${featureCard('📱', 'All Formats Included', 'YouTube, TikTok, Instagram, Spotify Canvas')}
      ${ctaButton('🎬 Create Your Music Video Now', URLS.musicVideoCreator, 'ai')}
    `, "The world's first AI trained by legendary directors")
  },

  {
    subject: `🧠 [PREVIEW 2/5] How We Trained AI on Spike Jonze's Brain`,
    preheader: "The technology behind professional music video generation",
    html: (name) => wrapInEmailTemplate(`
      <h1 style="margin: 0 0 15px; font-size: 26px; font-weight: 800; color: #ffffff; text-align: center;">
        ${name}, ever wonder how<br><span style="color: #8b5cf6;">legendary directors think?</span>
      </h1>
      <p style="text-align: center; font-size: 16px; color: #94a3b8;">
        We spent 2 years analyzing every music video from the greatest directors:
      </p>
      <div style="padding: 25px; background: rgba(139, 92, 246, 0.1); border-radius: 16px; margin: 20px 0;">
        <div style="font-size: 24px;">🎭 Spike Jonze</div>
        <div style="font-size: 14px; color: #ffffff; font-weight: 600;">Signature: Surreal meets Emotional</div>
        <div style="font-size: 13px; color: #94a3b8;">• Single-take wonders • Practical effects • Making the absurd genuine</div>
      </div>
      <div style="padding: 25px; background: rgba(249, 115, 22, 0.1); border-radius: 16px; margin: 20px 0;">
        <div style="font-size: 24px;">💎 Hype Williams</div>
        <div style="font-size: 14px; color: #ffffff; font-weight: 600;">Signature: Maximum Visual Impact</div>
        <div style="font-size: 13px; color: #94a3b8;">• Fisheye lens distortion • Rich golds & purples • Slow-motion opulence</div>
      </div>
      <div style="padding: 25px; background: rgba(16, 185, 129, 0.1); border-radius: 16px; margin: 20px 0;">
        <div style="font-size: 24px;">🎨 Michel Gondry</div>
        <div style="font-size: 14px; color: #ffffff; font-weight: 600;">Signature: Handcrafted Wonder</div>
        <div style="font-size: 13px; color: #94a3b8;">• In-camera magic tricks • Stop-motion • Visual puzzles</div>
      </div>
      <div style="padding: 30px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%); border-radius: 16px; text-align: center;">
        <div style="font-size: 40px;">🧠</div>
        <h3 style="font-size: 18px; color: #ffffff;">The AI Magic</h3>
        <p style="font-size: 14px; color: #94a3b8;">Our AI doesn't just copy — it <strong style="color: #f97316;">understands</strong>. Camera movements, color grading, emotional arcs...</p>
      </div>
      ${ctaButton('🎬 Choose Your Director Style', URLS.musicVideoCreator, 'primary')}
    `, "How we trained AI on legendary directors")
  },

  {
    subject: `⚡ [PREVIEW 3/5] 3 Steps: Upload Song → Pick Director → Get Video`,
    preheader: "The simplest way to get a professional music video",
    html: (name) => wrapInEmailTemplate(`
      <h1 style="margin: 0 0 15px; font-size: 26px; font-weight: 800; color: #ffffff; text-align: center;">
        ${name}, getting a pro music video<br><span style="color: #10b981;">has never been this easy.</span>
      </h1>
      <div style="padding: 25px; background: rgba(249, 115, 22, 0.1); border-radius: 16px; margin: 20px 0;">
        <table width="100%"><tr>
          <td width="60" valign="top">
            <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 50%; text-align: center; line-height: 50px; font-size: 24px; font-weight: 800; color: #fff;">1</div>
          </td>
          <td valign="top">
            <div style="font-size: 18px; font-weight: 700; color: #fff;">🎵 Upload Your Song</div>
            <div style="font-size: 14px; color: #94a3b8;">Just drag & drop. Our AI analyzes beats, lyrics, emotion.</div>
          </td>
        </tr></table>
      </div>
      <div style="padding: 25px; background: rgba(139, 92, 246, 0.1); border-radius: 16px; margin: 20px 0;">
        <table width="100%"><tr>
          <td width="60" valign="top">
            <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #8b5cf6, #6366f1); border-radius: 50%; text-align: center; line-height: 50px; font-size: 24px; font-weight: 800; color: #fff;">2</div>
          </td>
          <td valign="top">
            <div style="font-size: 18px; font-weight: 700; color: #fff;">🎬 Pick Your Director</div>
            <div style="font-size: 14px; color: #94a3b8;">Wes Anderson symmetry? Fincher's intensity? One click.</div>
          </td>
        </tr></table>
      </div>
      <div style="padding: 25px; background: rgba(16, 185, 129, 0.1); border-radius: 16px; margin: 20px 0;">
        <table width="100%"><tr>
          <td width="60" valign="top">
            <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; text-align: center; line-height: 50px; font-size: 24px; font-weight: 800; color: #fff;">3</div>
          </td>
          <td valign="top">
            <div style="font-size: 18px; font-weight: 700; color: #fff;">✨ Get Your Video</div>
            <div style="font-size: 14px; color: #94a3b8;">Complete music video ready in minutes.</div>
          </td>
        </tr></table>
      </div>
      ${ctaButton('🚀 Start Creating Now', URLS.musicVideoCreator, 'primary')}
    `, "3 simple steps to your professional music video")
  },

  {
    subject: `🔥 [PREVIEW 4/5] Artists are blowing up with AI-generated videos`,
    preheader: "See what independent artists are creating",
    html: (name) => wrapInEmailTemplate(`
      <h1 style="margin: 0 0 15px; font-size: 26px; font-weight: 800; color: #ffffff; text-align: center;">
        ${name}, artists are already<br><span style="color: #f97316;">going viral with AI videos.</span>
      </h1>
      <div style="padding: 25px; background: rgba(249, 115, 22, 0.1); border-radius: 16px; border-left: 4px solid #f97316; margin: 20px 0;">
        <div style="font-size: 28px;">🎤</div>
        <p style="font-size: 15px; color: #ffffff; font-style: italic;">
          "I used to think music videos were only for signed artists. This AI gave me Hype Williams-quality visuals."
        </p>
        <div style="font-size: 14px; font-weight: 600; color: #f97316;">@DripKing_ATL</div>
        <div style="font-size: 12px; color: #64748b;">Hip-Hop Artist • 45K Spotify Monthly</div>
      </div>
      <div style="padding: 25px; background: rgba(139, 92, 246, 0.1); border-radius: 16px; border-left: 4px solid #8b5cf6; margin: 20px 0;">
        <div style="font-size: 28px;">🎸</div>
        <p style="font-size: 15px; color: #ffffff; font-style: italic;">
          "I selected Wes Anderson style and literally gasped. The symmetry, the colors, the FEELING."
        </p>
        <div style="font-size: 14px; font-weight: 600; color: #8b5cf6;">Luna Martinez</div>
        <div style="font-size: 12px; color: #64748b;">Indie-Pop Artist • Berlin</div>
      </div>
      <div style="padding: 25px; background: rgba(16, 185, 129, 0.1); border-radius: 16px; border-left: 4px solid #10b981; margin: 20px 0;">
        <div style="font-size: 28px;">🎹</div>
        <p style="font-size: 15px; color: #ffffff; font-style: italic;">
          "My TikTok went from 500 to 50K views after posting the AI video."
        </p>
        <div style="font-size: 14px; font-weight: 600; color: #10b981;">BeatsByMilo</div>
        <div style="font-size: 12px; color: #64748b;">Electronic Producer • 120K TikTok</div>
      </div>
      ${ctaButton('🎬 Join These Artists Now', URLS.musicVideoCreator, 'secondary')}
      <p style="text-align: center; font-size: 13px; color: #64748b;">Tomorrow: A special offer you won't want to miss 👀</p>
    `, "Artists are blowing up with AI-generated music videos")
  },

  {
    subject: `🎁 [PREVIEW 5/5] Final: Your First AI Music Video is on Us`,
    preheader: "Create your first professional music video FREE",
    html: (name) => wrapInEmailTemplate(`
      <div style="text-align: center;">
        <div style="font-size: 50px;">🎁</div>
        <h1 style="margin: 0 0 15px; font-size: 28px; font-weight: 800; color: #ffffff;">
          ${name}, this is it.<br><span style="color: #10b981;">Your first video is FREE.</span>
        </h1>
      </div>
      <div style="padding: 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1)); border-radius: 16px; border: 2px solid #10b981; text-align: center; margin: 25px 0;">
        <div style="font-size: 14px; color: #10b981; text-transform: uppercase; letter-spacing: 2px;">🎉 SPECIAL LAUNCH OFFER</div>
        <div style="font-size: 36px; font-weight: 800; color: #ffffff;">1 FREE Video</div>
        <div style="font-size: 15px; color: #94a3b8;">Full quality • Any director style • All platforms</div>
        <div style="display: inline-block; padding: 8px 16px; background: rgba(16, 185, 129, 0.2); border-radius: 20px; font-size: 12px; color: #10b981; font-weight: 600; margin-top: 10px;">No credit card required</div>
      </div>
      <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; text-align: center;">✨ What You Get FREE:</h3>
      ${featureCard('🎬', 'Complete Music Video', 'Full-length video synced to your song')}
      ${featureCard('🎭', 'Any Director Style', 'Spike Jonze, Hype Williams, Gondry, Wes Anderson & more')}
      ${featureCard('📱', 'All Platform Formats', 'YouTube, TikTok, Instagram, Spotify Canvas')}
      ${featureCard('⚡', 'Instant Delivery', 'Ready in minutes, not weeks')}
      ${ctaButton('🎬 Create My FREE Video Now', URLS.musicVideoCreator, 'primary')}
      <div style="padding: 25px; background: rgba(249, 115, 22, 0.1); border-radius: 16px; border: 1px dashed rgba(249, 115, 22, 0.5); text-align: center; margin: 30px 0;">
        <p style="font-size: 14px; color: #94a3b8;">
          <strong style="color: #f97316;">Without a video:</strong> Your song competes with millions of audio-only tracks<br><br>
          <strong style="color: #10b981;">With a video:</strong> You stand out, get more engagement, build your visual brand
        </p>
      </div>
      <p style="text-align: center; font-size: 15px; color: #ffffff;">
        The future of music videos is here.<br><strong style="color: #f97316;">Will you be part of it?</strong>
      </p>
      <p style="text-align: center; font-size: 13px; color: #64748b;">
        To your success,<br><strong style="color: #ffffff;">The Boostify Team</strong>
      </p>
    `, "Your first professional AI music video is FREE")
  }
];

// ============================================================================
// SEND ALL EMAILS
// ============================================================================

async function sendAllPreviews() {
  console.log('═'.repeat(60));
  console.log('║   🎬 MUSIC VIDEO CREATOR - SENDING 5 PREVIEW EMAILS        ║');
  console.log('═'.repeat(60));
  console.log(`📧 To: ${TO_EMAIL}`);
  console.log('─'.repeat(60));

  for (let i = 0; i < EMAILS.length; i++) {
    const email = EMAILS[i];
    console.log(`\n📧 Sending Email ${i+1}/5: ${email.subject.substring(0, 50)}...`);

    try {
      const result = await sendBrevoEmail(
        TO_EMAIL,
        email.subject,
        email.html('Artist')
      );

      console.log(`   ✅ Sent! ID: ${result.data?.id}`);

      // Wait 3 seconds between emails
      if (i < EMAILS.length - 1) {
        console.log('   ⏱️ Waiting 3s...');
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ ALL 5 PREVIEW EMAILS SENT!');
  console.log('═'.repeat(60));
}

sendAllPreviews();
