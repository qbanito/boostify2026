/**
 * 🎵 BOOSTIFY MUSIC - ARTIST EMAIL SEQUENCE TEMPLATES
 * 
 * 10-email automated sequence to convert artists into active platform users
 * Professional design with orange brand palette, mobile-optimized
 * 
 * Resend API Key: re_Q73PRQ8o_8wYWWVHufVwDocuKaLRrVJhf
 */

export interface ArtistLead {
  id: string;
  email: string;
  name: string;
  artistName?: string;
  genre?: string;
  platform?: string; // spotify, youtube, instagram, etc.
  followers?: number;
  source: string;
  status: 'new' | 'sequence_1' | 'sequence_2' | 'sequence_3' | 'sequence_4' | 'sequence_5' | 'sequence_6' | 'sequence_7' | 'sequence_8' | 'sequence_9' | 'sequence_10' | 'activated' | 'unsubscribed';
  currentSequence: number;
  lastEmailSent?: Date;
  createdAt: Date;
  activatedAt?: Date;
  metadata?: Record<string, any>;
}

export interface ArtistEmailTemplate {
  sequenceNumber: number;
  subject: string;
  preheader: string;
  generateHTML: (artist: ArtistLead) => string;
  waitDays: number;
}

// ============================================
// EMAIL DESIGN SYSTEM - Orange Brand Palette
// ============================================
const EMAIL_STYLES = {
  // Colors (matching investor emails)
  primary: '#f97316',      // Orange
  primaryDark: '#ea580c',  // Dark Orange
  secondary: '#10b981',    // Green (CTAs)
  dark: '#1a1a1a',
  darkGradient: '#0f172a',
  light: '#f8fafc',
  gray: '#64748b',
  white: '#ffffff',
  
  // Gradients
  headerGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
  ctaGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  darkGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  cardGradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(234, 88, 12, 0.05) 100%)',
};

// Platform URLs
const URLS = {
  myArtists: 'https://boostifymusic.com/my-artists',
  artistExample: 'https://boostifymusic.com/artist/birdie-krajcik',
  boostiswap: 'https://boostifymusic.com/boostiswap',
  youtubeViews: 'https://boostifymusic.com/youtube-views',
  home: 'https://boostifymusic.com',
};

// Visual Preview Components (HTML-based, no external images needed)
function artistPagePreview(): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px;">
          <img src="https://i.ibb.co/216fRF78/IMG-3127.jpg" alt="Boostify Artist Page Preview" style="width: 100%; height: auto; border-radius: 8px; display: block;" />
          <p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">✨ This is what YOUR artist page could look like</p>
        </td>
      </tr>
    </table>
  `;
}

function boostiswapPreview(): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px;">
          <!-- Swap cards -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 15px; background: rgba(249, 115, 22, 0.1); border-radius: 8px; border-left: 4px solid #f97316; margin-bottom: 10px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="40">🎤</td>
                    <td>
                      <div style="font-size: 14px; font-weight: 600; color: #ffffff;">Luna Martinez</div>
                      <div style="font-size: 11px; color: #94a3b8;">Looking for: Playlist adds • Collabs</div>
                    </td>
                    <td align="right">
                      <span style="display: inline-block; padding: 6px 12px; background: #10b981; border-radius: 4px; font-size: 10px; color: white; font-weight: 600;">SWAP</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td height="10"></td></tr>
            <tr>
              <td style="padding: 15px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border-left: 4px solid #10b981;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="40">🎧</td>
                    <td>
                      <div style="font-size: 14px; font-weight: 600; color: #ffffff;">Beats by Milo</div>
                      <div style="font-size: 11px; color: #94a3b8;">Looking for: Features • Stream exchange</div>
                    </td>
                    <td align="right">
                      <span style="display: inline-block; padding: 6px 12px; background: #f97316; border-radius: 4px; font-size: 10px; color: white; font-weight: 600;">MATCH</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">🔄 Artists swapping support in real-time</p>
        </td>
      </tr>
    </table>
  `;
}

function analyticsPreview(): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px;">
          <!-- Analytics dashboard mockup -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #0f172a; border-radius: 8px; padding: 15px;">
            <!-- Stats row -->
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
            <!-- Chart mockup -->
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
    </table>
  `;
}

// Base HTML template wrapper (mobile-optimized, professional)
function wrapInEmailTemplate(content: string, preheader: string = ''): string {
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
    /* Reset */
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; max-width: 100%; }
    
    /* Base */
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f1f5f9; }
    
    /* Typography */
    .email-body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    
    /* Mobile Responsive */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding: 25px 20px !important; }
      .mobile-center { text-align: center !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-full-width { width: 100% !important; display: block !important; }
      .mobile-hide { display: none !important; }
      .mobile-text-center { text-align: center !important; }
      .mobile-btn { 
        display: block !important; 
        width: 100% !important; 
        max-width: 100% !important;
        padding: 16px 20px !important; 
        margin-bottom: 10px !important; 
        box-sizing: border-box !important;
        font-size: 16px !important;
      }
      .stat-box { 
        display: block !important; 
        width: 100% !important; 
        margin-bottom: 12px !important; 
        padding: 18px 15px !important;
      }
      .stat-box div:first-child {
        font-size: 24px !important;
      }
      .feature-icon { font-size: 28px !important; }
      h1 { font-size: 24px !important; line-height: 1.3 !important; }
      h2 { font-size: 20px !important; }
      h3 { font-size: 18px !important; }
      p { font-size: 15px !important; line-height: 1.6 !important; }
      .screenshot-img { width: 100% !important; height: auto !important; }
      .footer-link { display: block !important; padding: 8px 0 !important; }
    }
    
    /* Extra small devices */
    @media only screen and (max-width: 400px) {
      .mobile-padding { padding: 20px 15px !important; }
      h1 { font-size: 22px !important; }
      .mobile-btn { 
        padding: 14px 15px !important; 
        font-size: 15px !important;
      }
      .stat-box div:first-child {
        font-size: 22px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9;">
  <!-- Preheader -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${preheader}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Email Container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 30px 15px;">
        
        <!-- Main Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background: ${EMAIL_STYLES.headerGradient}; padding: 25px 30px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      🎵 BOOSTIFY
                    </div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">
                      For Artists
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="mobile-padding" style="padding: 35px 40px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: ${EMAIL_STYLES.darkGradient}; padding: 30px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #ffffff;">
                      🎵 Boostify Music
                    </p>
                    <p style="margin: 0 0 15px 0; font-size: 12px; color: #94a3b8;">
                      Empowering independent artists worldwide
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="${URLS.home}" style="font-size: 12px; color: #f97316; text-decoration: none;">🌐 boostifymusic.com</a>
                        </td>
                        <td style="padding: 0 8px;" class="mobile-hide">
                          <a href="${URLS.myArtists}" style="font-size: 12px; color: #10b981; text-decoration: none;">🎨 Create Artist Page</a>
                        </td>
                      </tr>
                    </table>
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
function ctaButton(text: string, url: string, primary = true): string {
  const bgStyle = primary 
    ? `background: ${EMAIL_STYLES.ctaGradient};`
    : `background: ${EMAIL_STYLES.headerGradient};`;
  
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="text-align: center;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="15%" strokecolor="${primary ? '#10b981' : '#f97316'}" fillcolor="${primary ? '#10b981' : '#f97316'}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${text}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${url}" class="mobile-btn" style="display: inline-block; ${bgStyle} color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; text-align: center; mso-hide: all; max-width: 280px; box-sizing: border-box;">
            ${text}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `;
}

// Stats Box Component
function statsBox(value: string, label: string, emoji: string = ''): string {
  return `
    <td class="stat-box" style="padding: 15px; text-align: center; background: linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0.03) 100%); border-radius: 12px;">
      <div style="font-size: 28px; font-weight: 800; color: #f97316;">${emoji}${value}</div>
      <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">${label}</div>
    </td>
  `;
}

// Feature Card Component
function featureCard(emoji: string, title: string, description: string): string {
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
    </table>
  `;
}

// Screenshot/Image Component
function screenshotImage(src: string, alt: string, caption?: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
      <tr>
        <td style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px;">
          <img src="${src}" alt="${alt}" class="screenshot-img" style="width: 100%; height: auto; border-radius: 8px; display: block;" />
          ${caption ? `<p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">${caption}</p>` : ''}
        </td>
      </tr>
    </table>
  `;
}

// Testimonial Component
function testimonialCard(quote: string, name: string, role: string, colorAccent: string = '#f97316'): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 15px 0;">
      <tr>
        <td style="padding: 25px; background: #f8fafc; border-radius: 12px; border-left: 4px solid ${colorAccent};">
          <p style="margin: 0 0 15px 0; font-size: 15px; color: #1a1a1a; line-height: 1.6; font-style: italic;">
            "${quote}"
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td>
                <div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">${name}</div>
                <div style="font-size: 12px; color: #64748b;">${role}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

// ============================================================================
// 10-EMAIL SEQUENCE FOR ARTISTS
// ============================================================================

export const ARTIST_EMAIL_SEQUENCE: ArtistEmailTemplate[] = [
  // ============================================================================
  // EMAIL 1: WELCOME - Create Your Free Artist Page
  // ============================================================================
  {
    sequenceNumber: 1,
    subject: "🎵 {{artistName}}, Your Professional Artist Page is Ready (FREE)",
    preheader: "Create your artist landing page in 5 minutes and share it with the world",
    waitDays: 0,
    generateHTML: (artist: ArtistLead) => wrapInEmailTemplate(`
      <!-- Logo -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <img src="https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png" alt="Boostify Music" width="80" height="80" style="display: block; width: 80px; height: 80px;" />
          </td>
        </tr>
      </table>

      <!-- Hero -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <h1 style="margin: 0 0 15px 0; font-size: 28px; font-weight: 800; color: #1a1a1a; line-height: 1.2;">
              Hey ${artist.artistName || artist.name}! 👋<br>
              <span style="color: #f97316;">Your music deserves to be heard.</span>
            </h1>
            <p style="margin: 0; font-size: 16px; color: #64748b; line-height: 1.6;">
              We built Boostify because independent artists like you need professional tools without the professional price tag.
            </p>
          </td>
        </tr>
      </table>

      <!-- Stats Row - Mobile Stacked -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <!--[if mso]>
              <tr>
                <td width="33%" valign="top">
              <![endif]-->
              <!--[if !mso]><!-->
              <tr class="mobile-stack">
              <!--<![endif]-->
                ${statsBox('5,000+', 'Active Artists', '')}
                <!--[if mso]></td><td width="2%"></td><td width="33%" valign="top"><![endif]-->
                ${statsBox('2.3M', 'Monthly Visits', '')}
                <!--[if mso]></td><td width="2%"></td><td width="33%" valign="top"><![endif]-->
                ${statsBox('FREE', 'Forever', '💯')}
              <!--[if mso]></td></tr><![endif]-->
              <!--[if !mso]><!-->
              </tr>
              <!--<![endif]-->
            </table>
          </td>
        </tr>
      </table>

      <!-- Platform Preview -->
      ${artistPagePreview()}

      <!-- Features -->
      <h2 style="margin: 30px 0 20px 0; font-size: 20px; font-weight: 700; color: #1a1a1a;">
        What you get with your artist page:
      </h2>
      
      ${featureCard('🎨', 'Professional Design', 'Beautiful templates designed by music industry experts that make your brand shine.')}
      ${featureCard('🔗', 'All Your Links', 'Spotify, Apple Music, YouTube, Instagram, TikTok... everything in one place.')}
      ${featureCard('📊', 'Real-Time Analytics', 'Know who\'s visiting, where they\'re from, and what they\'re interested in.')}
      ${featureCard('🎵', 'Embedded Player', 'Your music playing directly on your page. No redirects needed.')}

      <!-- CTA -->
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

      <!-- Example Link -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 15px 0;">
            <p style="margin: 0; font-size: 13px; color: #64748b;">
              See how other artists use Boostify: 
              <a href="${URLS.artistExample}" style="color: #f97316; text-decoration: none; font-weight: 600;">View Example Page →</a>
            </p>
          </td>
        </tr>
      </table>
    `, 'Create your professional artist page for FREE - Boostify Music')
  },

  // ============================================================================
  // EMAIL 2: ONE-CLICK ARTIST GENERATOR - Create Everything Automatically FREE
  // ============================================================================
  {
    sequenceNumber: 2,
    subject: "⚡ {{artistName}}, Your FREE Artist Page is Ready to Generate",
    preheader: "One click = Landing page + Images + Music + Bio. 100% FREE forever.",
    waitDays: 2,
    generateHTML: (artist: ArtistLead) => wrapInEmailTemplate(`
      <!-- Logo -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 15px;">
            <img src="https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png" alt="Boostify Music" width="60" height="60" style="display: block; width: 60px; height: 60px;" />
          </td>
        </tr>
      </table>

      <!-- FREE Badge -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 20px;">
            <span style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; font-size: 11px; font-weight: 800; padding: 6px 16px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
              ✨ 100% FREE FOREVER
            </span>
          </td>
        </tr>
      </table>

      <!-- Hero Section -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 30px;">
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a; line-height: 1.3;">
              Generate Your<br>
              <span style="color: #f97316;">Complete Artist Profile</span><br>
              <span style="font-size: 20px;">in Just 60 Seconds</span>
            </h1>
            <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6;">
              Hey ${artist.artistName || artist.name}! No design skills needed.<br>Just enter your name and let our AI do the magic.
            </p>
          </td>
        </tr>
      </table>

      <!-- Generator Box -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px;">
        <tr>
          <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 20px; overflow: hidden;">
            <!-- Header -->
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
            
            <!-- Features List -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding: 20px;">
                  <!-- Feature 1 -->
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
                  
                  <!-- Feature 2 -->
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
                  
                  <!-- Feature 3 -->
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
                  
                  <!-- Feature 4 -->
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
                  
                  <!-- Feature 5 -->
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

      <!-- Time Comparison -->
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

      <!-- CTA Section -->
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

      <!-- Social Proof -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 10px 0;">
            <p style="margin: 0; font-size: 13px; color: #64748b;">
              🎵 <strong style="color: #1a1a1a;">2,847 artists</strong> created their FREE pages this week
            </p>
          </td>
        </tr>
      </table>
    `, 'Generate your FREE artist profile in 60 seconds - Boostify Music')
  },

  // ============================================================================
  // EMAIL 3: BOOSTISWAP - Artist Collaborations
  // ============================================================================
  {
    sequenceNumber: 3,
    subject: "🤝 {{artistName}}, Connect With Artists Who Want to Collaborate",
    preheader: "BoostiSwap: where artists help each other grow",
    waitDays: 3,
    generateHTML: (artist: ArtistLead) => wrapInEmailTemplate(`
      <!-- Logo -->
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

      <!-- Platform Screenshot -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 15px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px;">
            <img src="https://i.ibb.co/RGFyNSLg/IMG-3131.jpg" alt="BoostiSwap Preview" style="width: 100%; height: auto; border-radius: 10px; display: block;" />
            <p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">🔄 Artists connecting and collaborating in real-time</p>
          </td>
        </tr>
      </table>

      <!-- How It Works -->
      <h2 style="margin: 25px 0 20px 0; font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: center;">
        How BoostiSwap Works:
      </h2>

      ${featureCard('1️⃣', 'Create Your Artist Profile', 'Share your music and what you\'re looking for (collabs, playlist adds, features...)')}
      ${featureCard('2️⃣', 'Get Matched', 'Our algorithm pairs you with artists in your genre who complement your style.')}
      ${featureCard('3️⃣', 'Exchange Support', 'Streams, shares, comments, features... grow together!')}

      <!-- Stats -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          ${statsBox('2,500+', 'Swaps Completed', '')}
          <td width="15"></td>
          ${statsBox('850+', 'Active Artists', '')}
          <td width="15"></td>
          ${statsBox('45K', 'Connections', '')}
        </tr>
      </table>

      <!-- CTA -->
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
    `, 'Connect with artists for collaborations on BoostiSwap')
  },

  // ============================================================================
  // EMAIL 4: YOUTUBE VIEWS - Grow Your YouTube Channel
  // ============================================================================
  {
    sequenceNumber: 4,
    subject: "📈 {{artistName}}, Multiply Your YouTube Video Views",
    preheader: "Free tools to grow your music YouTube channel",
    waitDays: 4,
    generateHTML: (artist: ArtistLead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <div style="font-size: 50px; margin-bottom: 15px;">📺</div>
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a;">
              Your videos deserve<br>
              <span style="color: #f97316;">more views on YouTube</span>
            </h1>
            <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6;">
              ${artist.artistName || artist.name}, we know how hard it is to stand out on YouTube. That's why we built tools that actually work.
            </p>
          </td>
        </tr>
      </table>

      <!-- Features -->
      ${featureCard('🎯', 'SEO Optimization', 'We help you optimize titles, descriptions, and tags so YouTube recommends your videos.')}
      ${featureCard('📊', 'Competition Analysis', 'See what successful artists in your genre are doing and replicate their strategy.')}
      ${featureCard('🔔', 'Subscriber Community', 'Connect with real fans who want to discover new music.')}
      ${featureCard('📱', 'Cross-Promotion', 'Share your video across our artist network for maximum exposure.')}

      <!-- Results Box -->
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

      <!-- CTA -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td align="center">
            ${ctaButton('📈 BOOST MY YOUTUBE', URLS.youtubeViews)}
          </td>
        </tr>
      </table>
    `, 'Multiply your YouTube views with Boostify tools')
  },

  // ============================================================================
  // EMAIL 5: REMINDER - Your Artist Page is Still Waiting (REDESIGNED)
  // ============================================================================
  {
    sequenceNumber: 5,
    subject: "⚠️ {{artistName}}, Don't Miss Out - Your FREE Page Expires Soon",
    preheader: "Hundreds of artists signed up this week. Don't get left behind.",
    waitDays: 5,
    generateHTML: (artist: ArtistLead) => wrapInEmailTemplate(`
      <!-- Logo -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 15px;">
            <img src="https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png" alt="Boostify Music" width="60" height="60" style="display: block; width: 60px; height: 60px;" />
          </td>
        </tr>
      </table>

      <!-- Urgency Badge -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 20px;">
            <span style="display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; font-size: 11px; font-weight: 800; padding: 8px 18px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
              ⚠️ REMINDER - DON'T MISS OUT
            </span>
          </td>
        </tr>
      </table>

      <!-- Hero -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 style="margin: 0 0 15px 0; font-size: 28px; font-weight: 800; color: #1a1a1a; line-height: 1.25;">
              Hey ${artist.artistName || artist.name}! 👋<br>
              <span style="color: #f97316;">We saved your spot.</span>
            </h1>
            <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6;">
              Your FREE artist page is still waiting for you.<br>It only takes 60 seconds to create.
            </p>
          </td>
        </tr>
      </table>

      <!-- Live Counter Box -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 25px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 18px; text-align: center;">
            <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">🔴 LIVE - Artists who joined this week</div>
            <div style="font-size: 48px; font-weight: 900; color: #f97316; line-height: 1;">847</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 8px;">and counting...</div>
          </td>
        </tr>
      </table>

      <!-- What You're Missing -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 25px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 16px; border: 2px solid #fecaca;">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 700; color: #b91c1c; text-align: center;">
              ❌ What you're missing right now:
            </h3>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding: 8px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="30"><span style="font-size: 16px;">😢</span></td>
                      <td style="font-size: 14px; color: #7f1d1d;">Fans can't find all your music in one place</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="30"><span style="font-size: 16px;">📉</span></td>
                      <td style="font-size: 14px; color: #7f1d1d;">Losing potential streams every day</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="30"><span style="font-size: 16px;">🚫</span></td>
                      <td style="font-size: 14px; color: #7f1d1d;">Missing collaboration opportunities</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="30"><span style="font-size: 16px;">👀</span></td>
                      <td style="font-size: 14px; color: #7f1d1d;">Labels and curators can't discover you</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- What You Get -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 25px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 16px; border: 2px solid #6ee7b7;">
            <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 700; color: #047857; text-align: center;">
              ✅ What you GET in 60 seconds:
            </h3>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding: 8px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="30"><span style="font-size: 16px;">🎨</span></td>
                      <td style="font-size: 14px; color: #065f46; font-weight: 500;">Professional landing page with your music</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="30"><span style="font-size: 16px;">📊</span></td>
                      <td style="font-size: 14px; color: #065f46; font-weight: 500;">Real-time analytics & visitor tracking</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="30"><span style="font-size: 16px;">🤝</span></td>
                      <td style="font-size: 14px; color: #065f46; font-weight: 500;">Access to BoostiSwap collaborations</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="30"><span style="font-size: 16px;">🔗</span></td>
                      <td style="font-size: 14px; color: #065f46; font-weight: 500;">One link for ALL your platforms</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA Section -->
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

      <!-- PS Note -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="padding: 15px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #f97316;">
            <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
              <strong style="color: #1a1a1a;">P.S.</strong> ${artist.artistName || artist.name}, we really believe in your music. Don't let this opportunity slip away. 847 artists joined this week - will you be next? 🎵
            </p>
          </td>
        </tr>
      </table>
    `, 'Your FREE artist page is waiting - claim it now')
  },

  // ============================================================================
  // EMAIL 6: TESTIMONIALS - What Other Artists Say (REDESIGNED)
  // ============================================================================
  {
    sequenceNumber: 6,
    subject: "🔥 {{artistName}}, Artists Like You Are Blowing Up on Boostify",
    preheader: "Real results from real artists. See their stories.",
    waitDays: 4,
    generateHTML: (artist: ArtistLead) => wrapInEmailTemplate(`
      <!-- Logo -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 15px;">
            <img src="https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png" alt="Boostify Music" width="60" height="60" style="display: block; width: 60px; height: 60px;" />
          </td>
        </tr>
      </table>

      <!-- Hero -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <div style="font-size: 40px; margin-bottom: 10px;">💬</div>
            <h1 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 800; color: #1a1a1a; line-height: 1.3;">
              Real Artists.<br>
              <span style="color: #f97316;">Real Results.</span>
            </h1>
            <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.5;">
              ${artist.artistName || artist.name}, don't just take our word for it.
            </p>
          </td>
        </tr>
      </table>

      <!-- Testimonial 1 - Featured -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
        <tr>
          <td style="padding: 25px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 18px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td>
                  <div style="font-size: 32px; margin-bottom: 15px;">⭐⭐⭐⭐⭐</div>
                  <p style="margin: 0 0 20px 0; font-size: 16px; color: #ffffff; line-height: 1.6; font-style: italic;">
                    "Before Boostify, I was invisible. Now I have <span style="color: #f97316; font-weight: 700;">15K+ monthly visitors</span> to my artist page. Labels are reaching out. This is insane."
                  </p>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="45">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 50%; text-align: center; line-height: 40px; font-size: 18px;">🎤</div>
                      </td>
                      <td style="padding-left: 12px;">
                        <div style="font-size: 14px; font-weight: 700; color: #ffffff;">Carlos Mendoza</div>
                        <div style="font-size: 12px; color: #94a3b8;">Reggaeton · Colombia · <span style="color: #10b981;">+340% streams</span></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Stats Row -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="32%" style="padding: 15px 8px; background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; text-align: center;">
                  <div style="font-size: 24px; font-weight: 800; color: #92400e;">5,000+</div>
                  <div style="font-size: 10px; color: #a16207; text-transform: uppercase; letter-spacing: 0.5px;">Artists</div>
                </td>
                <td width="2%"></td>
                <td width="32%" style="padding: 15px 8px; background: linear-gradient(135deg, #d1fae5, #a7f3d0); border-radius: 12px; text-align: center;">
                  <div style="font-size: 24px; font-weight: 800; color: #047857;">98%</div>
                  <div style="font-size: 10px; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;">Satisfied</div>
                </td>
                <td width="2%"></td>
                <td width="32%" style="padding: 15px 8px; background: linear-gradient(135deg, #fee2e2, #fecaca); border-radius: 12px; text-align: center;">
                  <div style="font-size: 24px; font-weight: 800; color: #b91c1c;">2.3M</div>
                  <div style="font-size: 10px; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Visitors/mo</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Testimonial 2 -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 15px;">
        <tr>
          <td style="padding: 20px; background: #f8fafc; border-radius: 14px; border-left: 4px solid #10b981;">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #1a1a1a; line-height: 1.6; font-style: italic;">
              "BoostiSwap connected me with 5 producers. One collab is now on <span style="font-weight: 700; color: #10b981;">radio in 3 countries</span>. All from one platform."
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="35">
                  <div style="width: 28px; height: 28px; background: #10b981; border-radius: 50%; text-align: center; line-height: 28px; font-size: 12px;">🎧</div>
                </td>
                <td style="padding-left: 10px;">
                  <div style="font-size: 13px; font-weight: 600; color: #1a1a1a;">Sofia Rivera <span style="color: #64748b; font-weight: 400;">· R&B · Mexico</span></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Testimonial 3 -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
        <tr>
          <td style="padding: 20px; background: #f8fafc; border-radius: 14px; border-left: 4px solid #f97316;">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #1a1a1a; line-height: 1.6; font-style: italic;">
              "From 200 views to <span style="font-weight: 700; color: #f97316;">50K in one week</span>. YouTube finally started recommending my music. Game changer."
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="35">
                  <div style="width: 28px; height: 28px; background: #f97316; border-radius: 50%; text-align: center; line-height: 28px; font-size: 12px;">🎵</div>
                </td>
                <td style="padding-left: 10px;">
                  <div style="font-size: 13px; font-weight: 600; color: #1a1a1a;">Andy K <span style="color: #64748b; font-weight: 400;">· Hip Hop · Argentina</span></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Your Story Box -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 28px 22px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 18px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 10px;">🎯</div>
            <h3 style="margin: 0 0 10px 0; font-size: 19px; font-weight: 800; color: #ffffff; line-height: 1.3;">
              ${artist.artistName || artist.name}, what's YOUR story going to be?
            </h3>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: rgba(255,255,255,0.9);">
              Join 5,000+ artists already growing on Boostify
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center">
                  <a href="${URLS.myArtists}" class="mobile-btn" style="display: inline-block; background: #ffffff; color: #ea580c; text-decoration: none; padding: 15px 32px; border-radius: 12px; font-weight: 800; font-size: 15px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                    🚀 START MY SUCCESS STORY
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin: 15px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.75);">
              100% FREE • No credit card needed
            </p>
          </td>
        </tr>
      </table>
    `, 'Artists share their Boostify success stories')
  },

  // ============================================================================
  // EMAIL 7: ANALYTICS - Know Your Fans
  // ============================================================================
  {
    sequenceNumber: 7,
    subject: "📊 {{artistName}}, Know Your Fans Like Never Before",
    preheader: "Professional analytics for artists - FREE",
    waitDays: 4,
    generateHTML: (artist: ArtistLead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <div style="font-size: 50px; margin-bottom: 15px;">📊</div>
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a;">
              Data that drives<br>
              <span style="color: #f97316;">smart decisions</span>
            </h1>
            <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6;">
              Stop guessing. Know exactly what works and what doesn't in your music strategy.
            </p>
          </td>
        </tr>
      </table>

      <!-- Analytics Preview -->
      ${analyticsPreview()}

      <!-- Features -->
      ${featureCard('🌍', 'Fan Demographics', 'Age, gender, location, and devices of your visitors.')}
      ${featureCard('🎵', 'Top Tracks', 'Discover which of your songs generate the most interest.')}
      ${featureCard('📅', 'Best Times', 'Publish when your audience is most active.')}
      ${featureCard('🔗', 'Traffic Sources', 'Know where your fans come from: Instagram, TikTok, Google...')}

      <!-- CTA -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td align="center">
            <p style="margin: 0 0 15px 0; font-size: 13px; color: #64748b;">
              All included FREE with your artist page
            </p>
            ${ctaButton('📊 SEE MY ANALYTICS', URLS.myArtists)}
          </td>
        </tr>
      </table>
    `, 'Professional analytics for independent artists')
  },

  // ============================================================================
  // EMAIL 8: URGENCY - Limited Time Premium Offer
  // ============================================================================
  {
    sequenceNumber: 8,
    subject: "🔥 {{artistName}}, Last Chance: FREE Premium for 1 Year",
    preheader: "Exclusive offer ending soon - Don't miss out",
    waitDays: 5,
    generateHTML: (artist: ArtistLead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="padding: 30px; background: ${EMAIL_STYLES.headerGradient}; border-radius: 16px; text-align: center;">
            <div style="display: inline-block; background: #ffffff; color: #f97316; padding: 6px 16px; border-radius: 50px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 15px;">
              ⏰ LIMITED OFFER
            </div>
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #ffffff;">
              1 YEAR OF PREMIUM<br>
              COMPLETELY FREE
            </h1>
            <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.9);">
              ${artist.artistName || artist.name}, we're selecting artists for our beta premium program. You're on the list.
            </p>
          </td>
        </tr>
      </table>

      <!-- What's Included -->
      <h2 style="margin: 30px 0 20px 0; font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: center;">
        What you get with Premium:
      </h2>

      ${featureCard('✨', 'No Watermark ($99/year value)', 'Your brand, no distractions')}
      ${featureCard('📊', 'Advanced Analytics ($49/year value)', 'Detailed audience insights')}
      ${featureCard('🚀', 'Priority Boost ($79/year value)', 'Your music featured on the platform')}
      ${featureCard('🎯', 'Custom Domain ($49/year value)', 'yourname.boostifymusic.com')}

      <!-- Savings -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 25px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%); border-radius: 16px; text-align: center;">
            <span style="font-size: 18px; color: #64748b; text-decoration: line-through;">$276/year</span>
            <span style="font-size: 32px; font-weight: 800; color: #10b981; margin-left: 15px;">$0</span>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;">Only for the first 500 artists. 437 already registered.</p>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td align="center">
            ${ctaButton('🔥 CLAIM FREE PREMIUM', URLS.myArtists + '?premium=true')}
          </td>
        </tr>
      </table>
    `, 'Claim your FREE Premium account - Limited offer')
  },

  // ============================================================================
  // EMAIL 9: SOCIAL PROOF - Community Growth
  // ============================================================================
  {
    sequenceNumber: 9,
    subject: "🚀 {{artistName}}, We're Now 5,000+ Artists Growing Together",
    preheader: "Join the largest community of independent artists",
    waitDays: 5,
    generateHTML: (artist: ArtistLead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a;">
              A community that<br>
              <span style="color: #f97316;">never stops growing</span>
            </h1>
          </td>
        </tr>
      </table>

      <!-- Big Stats -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 35px; background: ${EMAIL_STYLES.headerGradient}; border-radius: 16px; text-align: center;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center" style="padding: 10px;">
                  <div style="font-size: 36px; font-weight: 800; color: #ffffff;">5,247</div>
                  <div style="font-size: 11px; color: rgba(255,255,255,0.8);">Active Artists</div>
                </td>
                <td align="center" style="padding: 10px;">
                  <div style="font-size: 36px; font-weight: 800; color: #ffffff;">2.3M</div>
                  <div style="font-size: 11px; color: rgba(255,255,255,0.8);">Monthly Visits</div>
                </td>
                <td align="center" style="padding: 10px;">
                  <div style="font-size: 36px; font-weight: 800; color: #ffffff;">45K</div>
                  <div style="font-size: 11px; color: rgba(255,255,255,0.8);">Collaborations</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Recent Signups -->
      <h3 style="margin: 25px 0 15px 0; font-size: 16px; font-weight: 600; color: #1a1a1a; text-align: center;">
        Artists who joined this week:
      </h3>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="padding: 12px 15px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="40">🎤</td>
                <td>
                  <div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Maria "The Voice" Santos</div>
                  <div style="font-size: 12px; color: #64748b;">Pop Latino · Madrid</div>
                </td>
                <td align="right" style="font-size: 11px; color: #94a3b8;">2h ago</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td height="8"></td></tr>
        <tr>
          <td style="padding: 12px 15px; background: #f8fafc; border-radius: 8px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="40">🎧</td>
                <td>
                  <div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Beats by Milo</div>
                  <div style="font-size: 12px; color: #64748b;">Hip Hop · Buenos Aires</div>
                </td>
                <td align="right" style="font-size: 11px; color: #94a3b8;">5h ago</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td height="8"></td></tr>
        <tr>
          <td style="padding: 12px 15px; background: #f8fafc; border-radius: 8px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="40">🎹</td>
                <td>
                  <div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Tropical Vibes Crew</div>
                  <div style="font-size: 12px; color: #64748b;">Reggaeton · Miami</div>
                </td>
                <td align="right" style="font-size: 11px; color: #94a3b8;">8h ago</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
        <tr>
          <td align="center">
            <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 700; color: #1a1a1a;">
              ${artist.artistName || artist.name}, your spot is waiting
            </h3>
            ${ctaButton('🎵 JOIN THE COMMUNITY', URLS.myArtists)}
          </td>
        </tr>
      </table>
    `, 'Join 5,000+ artists growing together on Boostify')
  },

  // ============================================================================
  // EMAIL 10: FINAL - Last Message + Benefits Summary
  // ============================================================================
  {
    sequenceNumber: 10,
    subject: "💜 {{artistName}}, This is My Last Message (For Now)",
    preheader: "A summary of everything waiting for you at Boostify Music",
    waitDays: 7,
    generateHTML: (artist: ArtistLead) => wrapInEmailTemplate(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 25px;">
            <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a;">
              ${artist.artistName || artist.name},<br>
              <span style="color: #f97316;">thank you for your time</span>
            </h1>
            <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6; max-width: 450px;">
              This is the last email in our welcome series. I wanted to make sure you have everything you need to make a decision.
            </p>
          </td>
        </tr>
      </table>

      <!-- Summary Box -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 30px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0.03) 100%); border-radius: 16px; border: 2px solid rgba(249, 115, 22, 0.2);">
            <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: center;">
              What you get with Boostify:
            </h2>
            
            ${featureCard('🎨', 'Professional Artist Page', 'Your music, bio, photos, and links in one stunning design')}
            ${featureCard('🤝', 'BoostiSwap', 'Connect and collaborate with thousands of artists')}
            ${featureCard('📈', 'YouTube Boost', 'Tools to multiply your video views')}
            ${featureCard('📊', 'Pro Analytics', 'Know your audience like never before')}
            ${featureCard('🌟', 'Artist Community', 'Over 5,000 artists growing together')}

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(249, 115, 22, 0.2);">
              <tr>
                <td align="center">
                  <div style="font-size: 24px; font-weight: 800; color: #10b981;">100% FREE</div>
                  <div style="font-size: 13px; color: #64748b;">No credit card. No commitments.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Personal Note -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td style="padding: 25px; background: #f8fafc; border-radius: 12px;">
            <p style="margin: 0; font-size: 14px; color: #1a1a1a; line-height: 1.7;">
              We built Boostify because we know how hard it is to be heard as an independent artist. We want every musician to have the tools that were once only available to artists with big labels.
            </p>
            <p style="margin: 15px 0 0 0; font-size: 16px; font-weight: 600; color: #f97316;">
              Your music deserves to be heard. 🎵
            </p>
          </td>
        </tr>
      </table>

      <!-- Final CTA -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
        <tr>
          <td align="center">
            ${ctaButton('🎨 CREATE MY FREE PAGE', URLS.myArtists)}
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #64748b;">
              If you ever need help, just reply to this email.<br>
              There's always someone on the team ready to assist.
            </p>
          </td>
        </tr>
      </table>

      <!-- PS -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        <tr>
          <td style="padding: 15px; background: rgba(249, 115, 22, 0.05); border-radius: 8px;">
            <p style="margin: 0; font-size: 13px; color: #64748b;">
              <strong style="color: #1a1a1a;">P.S.</strong> Although this is the last automated email, we'll still send you occasional platform updates and tips for artists.
            </p>
          </td>
        </tr>
      </table>
    `, 'Everything Boostify has to offer - Final summary')
  }
];

// Helper function to get template by sequence number
export function getArtistEmailTemplate(sequenceNumber: number): ArtistEmailTemplate | undefined {
  return ARTIST_EMAIL_SEQUENCE.find(t => t.sequenceNumber === sequenceNumber);
}

// Helper function to personalize subject line
export function personalizeSubject(template: ArtistEmailTemplate, artist: ArtistLead): string {
  return template.subject
    .replace('{{artistName}}', artist.artistName || artist.name || 'Artist')
    .replace('{{name}}', artist.name || 'Artist');
}

// Helper function to get next sequence number
export function getNextSequenceNumber(currentSequence: number): number | null {
  const next = currentSequence + 1;
  if (next > ARTIST_EMAIL_SEQUENCE.length) {
    return null;
  }
  return next;
}

// Export constants
export const ARTIST_RESEND_API_KEY = 're_Q73PRQ8o_8wYWWVHufVwDocuKaLRrVJhf';
export const ARTIST_COLLECTION_NAME = 'artist_leads';
export const ARTIST_FROM_EMAIL = 'artists@boostifymusic.site';
export const ARTIST_FROM_NAME = 'Boostify Music for Artists';
