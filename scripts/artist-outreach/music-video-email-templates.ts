/**
 * 🎬 BOOSTIFY MUSIC - MUSIC VIDEO CREATOR EMAIL SEQUENCE
 * 
 * 5-email automated sequence to promote the AI Music Video Creator
 * "The first platform capable of creating complete professional music videos
 * trained by the world's best directors"
 * 
 * Professional design with orange brand palette, mobile-optimized
 */

export interface MusicVideoLead {
  id: string;
  email: string;
  name: string;
  artistName?: string;
  genre?: string;
  source: string;
  status: 'new' | 'mv_sequence_1' | 'mv_sequence_2' | 'mv_sequence_3' | 'mv_sequence_4' | 'mv_sequence_5' | 'converted' | 'unsubscribed';
  currentSequence: number;
  lastEmailSent?: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface MusicVideoEmailTemplate {
  sequenceNumber: number;
  subject: string;
  preheader: string;
  generateHTML: (lead: MusicVideoLead) => string;
  waitDays: number;
}

// ============================================
// EMAIL DESIGN SYSTEM - Orange Brand Palette
// ============================================
const EMAIL_STYLES = {
  // Colors
  primary: '#f97316',      // Orange
  primaryDark: '#ea580c',  // Dark Orange
  secondary: '#10b981',    // Green (CTAs)
  accent: '#8b5cf6',       // Purple (AI/Tech)
  dark: '#1a1a1a',
  darkGradient: '#0f172a',
  light: '#f8fafc',
  gray: '#64748b',
  white: '#ffffff',
  
  // Gradients
  headerGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
  ctaGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  aiGradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
  darkGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
};

// URLs
const URLS = {
  musicVideoCreator: 'https://boostifymusic.com/music-video-creator',
  home: 'https://boostifymusic.com',
  pricing: 'https://boostifymusic.com/music-video-creator#pricing',
};

// Director names for credibility
const DIRECTORS = [
  'Spike Jonze', 'Hype Williams', 'Michel Gondry', 'David Fincher', 
  'Baz Luhrmann', 'Wes Anderson', 'Christopher Nolan', 'Denis Villeneuve'
];

// Base HTML template wrapper
function wrapInEmailTemplate(content: string, preheader: string = ''): string {
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
    .email-body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding: 25px 20px !important; }
      .mobile-center { text-align: center !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-btn { display: block !important; width: 100% !important; max-width: 100% !important; padding: 16px 20px !important; margin-bottom: 10px !important; box-sizing: border-box !important; font-size: 16px !important; }
      .stat-box { display: block !important; width: 100% !important; margin-bottom: 12px !important; padding: 18px 15px !important; }
      h1 { font-size: 24px !important; line-height: 1.3 !important; }
      h2 { font-size: 20px !important; }
      p { font-size: 15px !important; line-height: 1.6 !important; }
      .director-grid td { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a;">
  <!-- Preheader -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${preheader}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Email Container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 30px 15px;">
        
        <!-- Main Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border-radius: 20px; overflow: hidden; border: 1px solid rgba(249, 115, 22, 0.3);">
          
          <!-- Header -->
          <tr>
            <td style="background: ${EMAIL_STYLES.headerGradient}; padding: 30px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 32px; margin-bottom: 8px;">🎬</div>
                    <div style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      MUSIC VIDEO CREATOR
                    </div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 3px; margin-top: 6px;">
                      Powered by AI Directors
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="mobile-padding" style="padding: 40px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: rgba(0,0,0,0.4); padding: 30px 40px; border-top: 1px solid rgba(249, 115, 22, 0.2);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #ffffff;">
                      🎬 Boostify Music Video Creator
                    </p>
                    <p style="margin: 0 0 15px 0; font-size: 12px; color: #94a3b8;">
                      Professional AI-generated music videos for independent artists
                    </p>
                    <a href="${URLS.musicVideoCreator}" style="font-size: 12px; color: #f97316; text-decoration: none;">🌐 boostifymusic.com/music-video-creator</a>
                    <p style="margin: 15px 0 0 0; font-size: 10px; color: #64748b;">
                      © 2026 Boostify Music. All rights reserved.
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

// CTA Button Component
function ctaButton(text: string, url: string, style: 'primary' | 'secondary' | 'ai' = 'primary'): string {
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

// Director Badge Component
function directorBadge(name: string): string {
  return `
    <span style="display: inline-block; padding: 6px 14px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 20px; font-size: 12px; color: #a78bfa; margin: 4px;">
      🎬 ${name}
    </span>
  `;
}

// Feature Card Component
function featureCard(emoji: string, title: string, description: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 15px;">
      <tr>
        <td style="padding: 20px; background: rgba(249, 115, 22, 0.08); border-radius: 12px; border-left: 4px solid #f97316;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="50" valign="top" style="padding-right: 15px;">
                <div style="font-size: 32px; line-height: 1;">${emoji}</div>
              </td>
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

// Stats Box Component
function statsBox(value: string, label: string, emoji: string = ''): string {
  return `
    <td class="stat-box" style="padding: 20px; text-align: center; background: rgba(249, 115, 22, 0.1); border-radius: 12px; border: 1px solid rgba(249, 115, 22, 0.2);">
      <div style="font-size: 28px; font-weight: 800; color: #f97316;">${emoji}${value}</div>
      <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px;">${label}</div>
    </td>
  `;
}

// Video Preview Mockup Component
function videoPreviewMockup(): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
      <tr>
        <td style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid rgba(249, 115, 22, 0.3);">
          <!-- Video Preview Frame -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #000; border-radius: 12px; overflow: hidden;">
            <tr>
              <td style="padding: 60px 40px; text-align: center; background: linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);">
                <div style="font-size: 60px; margin-bottom: 15px;">▶️</div>
                <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">Your Music Video</div>
                <div style="font-size: 13px; color: #94a3b8;">Directed by AI • Professional Quality</div>
              </td>
            </tr>
          </table>
          <!-- Timeline mockup -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 15px;">
            <tr>
              <td style="padding: 12px; background: rgba(0,0,0,0.4); border-radius: 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding: 4px; background: #f97316; border-radius: 4px; width: 15%;"></td>
                    <td width="2%"></td>
                    <td style="padding: 4px; background: #8b5cf6; border-radius: 4px; width: 20%;"></td>
                    <td width="2%"></td>
                    <td style="padding: 4px; background: #10b981; border-radius: 4px; width: 25%;"></td>
                    <td width="2%"></td>
                    <td style="padding: 4px; background: #f97316; border-radius: 4px; width: 18%;"></td>
                    <td width="2%"></td>
                    <td style="padding: 4px; background: rgba(255,255,255,0.2); border-radius: 4px; width: 14%;"></td>
                  </tr>
                </table>
                <div style="font-size: 10px; color: #64748b; text-align: center; margin-top: 8px;">🎵 Audio synced timeline with AI-generated scenes</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

// ============================================================================
// 5-EMAIL SEQUENCE FOR MUSIC VIDEO CREATOR
// ============================================================================

export const MUSIC_VIDEO_EMAIL_SEQUENCE: MusicVideoEmailTemplate[] = [
  
  // ============================================================================
  // EMAIL 1: THE REVEAL - World's First AI Director Platform
  // ============================================================================
  {
    sequenceNumber: 1,
    subject: "🎬 {{name}}, Create Your Professional Music Video with AI Directors",
    preheader: "The world's first platform trained by Spike Jonze, Hype Williams, Michel Gondry & more",
    waitDays: 0,
    generateHTML: (lead: MusicVideoLead) => wrapInEmailTemplate(`
      <!-- Hero -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <h1 style="margin: 0 0 15px 0; font-size: 28px; font-weight: 800; color: #ffffff; line-height: 1.3;">
              Hey ${lead.artistName || lead.name}! 👋<br>
              <span style="background: linear-gradient(90deg, #f97316 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Imagine having Spike Jonze direct your music video.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #94a3b8; line-height: 1.7;">
              We built something that sounded impossible: an AI trained on the techniques of the <strong style="color: #f97316;">world's greatest music video directors</strong>.
            </p>
          </td>
        </tr>
      </table>

      <!-- Director Badges -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td align="center" style="padding: 20px; background: rgba(139, 92, 246, 0.1); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.3);">
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #a78bfa; text-transform: uppercase; letter-spacing: 2px;">AI Trained By</p>
            ${DIRECTORS.map(d => directorBadge(d)).join('\n            ')}
          </td>
        </tr>
      </table>

      <!-- Video Preview -->
      ${videoPreviewMockup()}

      <!-- What You Get -->
      <h2 style="margin: 30px 0 20px 0; font-size: 20px; font-weight: 700; color: #ffffff; text-align: center;">
        🚀 What You Get
      </h2>
      
      ${featureCard('🎬', 'Professional Director Styles', 'Choose from 10+ legendary director aesthetics: Spike Jonze\'s surrealism, Hype Williams\' glamour, Gondry\'s handmade magic...')}
      ${featureCard('🎵', 'Audio-Synced Visuals', 'Your video is perfectly synchronized to every beat, lyric, and emotional moment of your song.')}
      ${featureCard('⚡', 'Ready in Minutes', 'No equipment. No crew. No $50,000 budget. Just upload your song and let AI do the magic.')}
      ${featureCard('📱', 'All Formats Included', 'Get versions optimized for YouTube, TikTok, Instagram Reels, and Spotify Canvas.')}

      <!-- CTA -->
      ${ctaButton('🎬 Create Your Music Video Now', URLS.musicVideoCreator, 'ai')}

      <!-- Bottom note -->
      <p style="margin: 25px 0 0 0; font-size: 13px; color: #64748b; text-align: center; line-height: 1.6;">
        This is the future of music videos. And you can be one of the first artists to experience it.
      </p>
    `, "The world's first AI trained by legendary directors")
  },

  // ============================================================================
  // EMAIL 2: BEHIND THE MAGIC - How Our AI Directors Work
  // ============================================================================
  {
    sequenceNumber: 2,
    subject: "🧠 How We Trained AI on Spike Jonze's Brain (seriously)",
    preheader: "The technology behind professional music video generation",
    waitDays: 2,
    generateHTML: (lead: MusicVideoLead) => wrapInEmailTemplate(`
      <!-- Hero -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1.3;">
              ${lead.artistName || lead.name}, ever wonder how<br>
              <span style="color: #8b5cf6;">legendary directors think?</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #94a3b8; line-height: 1.7;">
              We spent 2 years analyzing every music video from the greatest directors in history. Here's what we learned:
            </p>
          </td>
        </tr>
      </table>

      <!-- Director Analysis Cards -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(139, 92, 246, 0.1); border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.3); margin-bottom: 15px;">
            <div style="font-size: 24px; margin-bottom: 10px;">🎭 Spike Jonze</div>
            <div style="font-size: 14px; color: #ffffff; font-weight: 600; margin-bottom: 8px;">Signature: Surreal meets Emotional</div>
            <div style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
              • Single-take wonders (Weapon of Choice)<br>
              • Practical effects over CGI<br>
              • Making the absurd feel genuine<br>
              • Patient pacing with sudden bursts
            </div>
          </td>
        </tr>
        <tr><td height="15"></td></tr>
        <tr>
          <td style="padding: 25px; background: rgba(249, 115, 22, 0.1); border-radius: 16px; border: 1px solid rgba(249, 115, 22, 0.3);">
            <div style="font-size: 24px; margin-bottom: 10px;">💎 Hype Williams</div>
            <div style="font-size: 14px; color: #ffffff; font-weight: 600; margin-bottom: 8px;">Signature: Maximum Visual Impact</div>
            <div style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
              • Fisheye lens distortion<br>
              • Rich golds & deep purples<br>
              • Slow-motion opulence<br>
              • Aspirational wealth imagery
            </div>
          </td>
        </tr>
        <tr><td height="15"></td></tr>
        <tr>
          <td style="padding: 25px; background: rgba(16, 185, 129, 0.1); border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.3);">
            <div style="font-size: 24px; margin-bottom: 10px;">🎨 Michel Gondry</div>
            <div style="font-size: 14px; color: #ffffff; font-weight: 600; margin-bottom: 8px;">Signature: Handcrafted Wonder</div>
            <div style="font-size: 13px; color: #94a3b8; line-height: 1.6;">
              • In-camera magic tricks<br>
              • Stop-motion integration<br>
              • Visual puzzles & illusions<br>
              • Rhythmic cuts synced to music
            </div>
          </td>
        </tr>
      </table>

      <!-- AI Magic Explanation -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          <td align="center" style="padding: 30px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%); border-radius: 16px;">
            <div style="font-size: 40px; margin-bottom: 15px;">🧠</div>
            <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #ffffff;">The AI Magic</h3>
            <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.7;">
              Our AI doesn't just copy — it <strong style="color: #f97316;">understands</strong>. Camera movements, color grading, pacing, emotional arcs... When you select a director style, you're accessing decades of visual storytelling expertise.
            </p>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      ${ctaButton('🎬 Choose Your Director Style', URLS.musicVideoCreator, 'primary')}

      <!-- Teaser -->
      <p style="margin: 25px 0 0 0; font-size: 13px; color: #64748b; text-align: center; line-height: 1.6;">
        Tomorrow: We'll show you the exact 3-step process to create your video. Stay tuned 🎥
      </p>
    `, "How we trained AI on legendary music video directors")
  },

  // ============================================================================
  // EMAIL 3: THE PROCESS - 3 Steps to Your Video
  // ============================================================================
  {
    sequenceNumber: 3,
    subject: "⚡ 3 Steps: Upload Song → Pick Director → Get Video",
    preheader: "The simplest way to get a professional music video ever created",
    waitDays: 2,
    generateHTML: (lead: MusicVideoLead) => wrapInEmailTemplate(`
      <!-- Hero -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1.3;">
              ${lead.artistName || lead.name}, getting a pro music video<br>
              <span style="color: #10b981;">has never been this easy.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #94a3b8; line-height: 1.7;">
              No video production knowledge needed. No expensive equipment. Just 3 simple steps.
            </p>
          </td>
        </tr>
      </table>

      <!-- Step 1 -->
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
                  <div style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
                    Just drag & drop your track. Our AI instantly analyzes the beats, lyrics, emotion, and energy to understand your music.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Step 2 -->
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
                  <div style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
                    Choose from 10+ AI director styles. Want Wes Anderson's symmetry? Fincher's dark intensity? Gondry's playfulness? It's one click.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Step 3 -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(16, 185, 129, 0.1); border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.3);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="60" valign="top">
                  <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; text-align: center; line-height: 50px; font-size: 24px; font-weight: 800; color: #ffffff;">3</div>
                </td>
                <td valign="top">
                  <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">✨ Get Your Professional Video</div>
                  <div style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
                    In minutes, receive a complete music video with professional-quality visuals, perfectly synced to your music. Ready for YouTube, TikTok, Instagram, and more.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Stats -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          ${statsBox('< 5 min', 'Creation Time', '⚡')}
          <td width="15"></td>
          ${statsBox('$0', 'Equipment Needed', '💸')}
          <td width="15"></td>
          ${statsBox('100%', 'Your Music', '🎵')}
        </tr>
      </table>

      <!-- CTA -->
      ${ctaButton('🚀 Start Creating Now', URLS.musicVideoCreator, 'primary')}
    `, "3 simple steps to your professional music video")
  },

  // ============================================================================
  // EMAIL 4: SOCIAL PROOF - Artists Already Creating
  // ============================================================================
  {
    sequenceNumber: 4,
    subject: "🔥 Artists are blowing up with AI-generated videos",
    preheader: "See what independent artists are creating with Music Video Creator",
    waitDays: 3,
    generateHTML: (lead: MusicVideoLead) => wrapInEmailTemplate(`
      <!-- Hero -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1.3;">
              ${lead.artistName || lead.name}, artists are already<br>
              <span style="color: #f97316;">going viral with AI videos.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #94a3b8; line-height: 1.7;">
              While others wait months for video shoots, these artists are releasing professional content weekly.
            </p>
          </td>
        </tr>
      </table>

      <!-- Testimonial 1 -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(249, 115, 22, 0.1); border-radius: 16px; border-left: 4px solid #f97316;">
            <div style="font-size: 28px; margin-bottom: 10px;">🎤</div>
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #ffffff; line-height: 1.6; font-style: italic;">
              "I used to think music videos were only for signed artists with big budgets. This AI literally gave me Hype Williams-quality visuals for my trap song. My fans thought I hired a real production crew."
            </p>
            <div style="font-size: 14px; font-weight: 600; color: #f97316;">@DripKing_ATL</div>
            <div style="font-size: 12px; color: #64748b;">Hip-Hop Artist • 45K Spotify Monthly</div>
          </td>
        </tr>
      </table>

      <!-- Testimonial 2 -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(139, 92, 246, 0.1); border-radius: 16px; border-left: 4px solid #8b5cf6;">
            <div style="font-size: 28px; margin-bottom: 10px;">🎸</div>
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #ffffff; line-height: 1.6; font-style: italic;">
              "I selected the Wes Anderson style for my indie track and literally gasped. The symmetry, the colors, the FEELING. It's like he actually directed it. This is insane technology."
            </p>
            <div style="font-size: 14px; font-weight: 600; color: #8b5cf6;">Luna Martinez</div>
            <div style="font-size: 12px; color: #64748b;">Indie-Pop Artist • Berlin</div>
          </td>
        </tr>
      </table>

      <!-- Testimonial 3 -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(16, 185, 129, 0.1); border-radius: 16px; border-left: 4px solid #10b981;">
            <div style="font-size: 28px; margin-bottom: 10px;">🎹</div>
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #ffffff; line-height: 1.6; font-style: italic;">
              "My TikTok went from 500 views to 50K after I posted the music video. The algorithm LOVES professional visual content. This is a game changer."
            </p>
            <div style="font-size: 14px; font-weight: 600; color: #10b981;">BeatsByMilo</div>
            <div style="font-size: 12px; color: #64748b;">Electronic Producer • 120K TikTok</div>
          </td>
        </tr>
      </table>

      <!-- Results Stats -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          <td align="center" style="padding: 25px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%); border-radius: 16px;">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 700; color: #ffffff;">📈 Average Results from Artists Using AI Videos:</h3>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding: 10px 20px; text-align: center;">
                  <div style="font-size: 28px; font-weight: 800; color: #f97316;">3.5x</div>
                  <div style="font-size: 11px; color: #94a3b8;">More Engagement</div>
                </td>
                <td style="padding: 10px 20px; text-align: center;">
                  <div style="font-size: 28px; font-weight: 800; color: #10b981;">10x</div>
                  <div style="font-size: 11px; color: #94a3b8;">Content Speed</div>
                </td>
                <td style="padding: 10px 20px; text-align: center;">
                  <div style="font-size: 28px; font-weight: 800; color: #8b5cf6;">$0</div>
                  <div style="font-size: 11px; color: #94a3b8;">Production Cost</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      ${ctaButton('🎬 Join These Artists Now', URLS.musicVideoCreator, 'secondary')}

      <!-- Urgency -->
      <p style="margin: 25px 0 0 0; font-size: 13px; color: #64748b; text-align: center; line-height: 1.6;">
        Tomorrow: A special offer you won't want to miss. Check your inbox 👀
      </p>
    `, "Artists are blowing up with AI-generated music videos")
  },

  // ============================================================================
  // EMAIL 5: FINAL PUSH - Limited Time Offer
  // ============================================================================
  {
    sequenceNumber: 5,
    subject: "🎁 Final: Your First AI Music Video is on Us",
    preheader: "Create your first professional music video FREE - limited time",
    waitDays: 2,
    generateHTML: (lead: MusicVideoLead) => wrapInEmailTemplate(`
      <!-- Hero -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <div style="font-size: 50px; margin-bottom: 15px;">🎁</div>
            <h1 style="margin: 0 0 15px 0; font-size: 28px; font-weight: 800; color: #ffffff; line-height: 1.3;">
              ${lead.artistName || lead.name}, this is it.<br>
              <span style="color: #10b981;">Your first video is FREE.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #94a3b8; line-height: 1.7;">
              We've shown you the technology. We've shown you the results. Now it's time to experience it yourself.
            </p>
          </td>
        </tr>
      </table>

      <!-- Free Offer Box -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 30px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%); border-radius: 16px; border: 2px solid #10b981; text-align: center;">
            <div style="font-size: 14px; color: #10b981; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">🎉 SPECIAL LAUNCH OFFER</div>
            <div style="font-size: 36px; font-weight: 800; color: #ffffff; margin-bottom: 10px;">
              1 FREE Video
            </div>
            <div style="font-size: 15px; color: #94a3b8; margin-bottom: 15px;">
              Full professional quality • Any director style • Ready for all platforms
            </div>
            <div style="display: inline-block; padding: 8px 16px; background: rgba(16, 185, 129, 0.2); border-radius: 20px; font-size: 12px; color: #10b981; font-weight: 600;">
              No credit card required
            </div>
          </td>
        </tr>
      </table>

      <!-- What's Included -->
      <h3 style="margin: 30px 0 20px 0; font-size: 18px; font-weight: 700; color: #ffffff; text-align: center;">
        ✨ What You Get FREE:
      </h3>
      
      ${featureCard('🎬', 'Complete Music Video', 'Full-length video synced perfectly to your song, not just a clip')}
      ${featureCard('🎭', 'Any Director Style', 'Choose from Spike Jonze, Hype Williams, Gondry, Wes Anderson & more')}
      ${featureCard('📱', 'All Platform Formats', 'YouTube, TikTok, Instagram Reels, Spotify Canvas - all included')}
      ${featureCard('⚡', 'Instant Delivery', 'Your video ready in minutes, not weeks')}

      <!-- Main CTA -->
      ${ctaButton('🎬 Create My FREE Video Now', URLS.musicVideoCreator, 'primary')}

      <!-- Reminder of What's at Stake -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          <td style="padding: 25px; background: rgba(249, 115, 22, 0.1); border-radius: 16px; border: 1px dashed rgba(249, 115, 22, 0.5); text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
              <strong style="color: #f97316;">Without a music video:</strong> Your song competes with millions of audio-only tracks<br><br>
              <strong style="color: #10b981;">With a music video:</strong> You stand out, get more engagement, and build your visual brand
            </p>
          </td>
        </tr>
      </table>

      <!-- Final Push -->
      <p style="margin: 0; font-size: 15px; color: #ffffff; text-align: center; line-height: 1.6;">
        The future of music videos is here.<br>
        <strong style="color: #f97316;">Will you be part of it?</strong>
      </p>

      <!-- Secondary CTA -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td align="center">
            <a href="${URLS.musicVideoCreator}" style="font-size: 14px; color: #f97316; text-decoration: underline;">
              → Click here to create your first AI music video
            </a>
          </td>
        </tr>
      </table>

      <!-- Sign off -->
      <p style="margin: 30px 0 0 0; font-size: 13px; color: #64748b; text-align: center;">
        To your success,<br>
        <strong style="color: #ffffff;">The Boostify Team</strong><br>
        <span style="font-size: 11px;">🎬 Music Video Creator</span>
      </p>
    `, "Your first professional AI music video is FREE")
  }
];

// Export templates
export default MUSIC_VIDEO_EMAIL_SEQUENCE;
