/**
 * Brevo Email Service
 * Handles all email communications for Boostify Music platform
 * Supports artist generation notifications, welcome emails, and platform events
 * Using Brevo (formerly Sendinblue) for info@boostifymusic.com
 */

// Brevo API configuration
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

// Email sender configuration
const FROM_EMAIL = 'info@boostifymusic.com';
const FROM_NAME = 'Boostify Music';
const SUPPORT_EMAIL = 'support@boostifymusic.com';

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ArtistGeneratedEmailData {
  userEmail: string;
  userName: string;
  artistName: string;
  artistSlug: string;
  profileImageUrl?: string;
  genres: string[];
  songsCount: number;
  tokenSymbol?: string;
}

export interface WelcomeEmailData {
  userEmail: string;
  userName: string;
}

export interface TokenPurchaseEmailData {
  userEmail: string;
  userName: string;
  artistName: string;
  tokenAmount: number;
  tokenSymbol: string;
  transactionHash: string;
}

export interface SongTokenizedEmailData {
  userEmail: string;
  userName: string;
  artistName: string;
  songTitle: string;
  tokenId: string;
}

export interface FanEmailPalette {
  primaryColor?: string;
  accentColor?: string;
}

// Helper function to send email via Brevo
async function sendBrevoEmail(to: string, subject: string, htmlContent: string): Promise<EmailResult> {
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
        subject,
        htmlContent
      })
    });
    
    const result = await response.json();
    
    if (result.messageId) {
      return { success: true, messageId: result.messageId };
    } else {
      console.error('❌ Brevo error:', result);
      return { success: false, error: result.message || JSON.stringify(result) };
    }
  } catch (error: any) {
    console.error('❌ Brevo error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send email when a new AI artist is generated
 */
export async function sendArtistGeneratedEmail(data: ArtistGeneratedEmailData): Promise<EmailResult> {
  const artistUrl = `https://www.boostifymusic.com/artist/${data.artistSlug}`;
  const boostiswapUrl = `https://boostifymusic.com/boostiswap`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your AI Artist is Ready</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">🎵 BOOSTIFY MUSIC</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="color: #ffffff; margin: 0 0 20px 0; font-size: 24px;">
                    Hey ${data.userName}! 🎉
                  </h2>
                  
                  <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    Great news! Your AI-powered artist <strong style="color: #EC4899;">"${data.artistName}"</strong> has been successfully generated and is now live on Boostify Music!
                  </p>
                  
                  ${data.profileImageUrl ? `
                  <div style="text-align: center; margin-bottom: 30px;">
                    <img src="${data.profileImageUrl}" alt="${data.artistName}" style="width: 200px; height: 200px; border-radius: 50%; border: 4px solid #8B5CF6; object-fit: cover;">
                  </div>
                  ` : ''}
                  
                  <!-- Stats -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(139, 92, 246, 0.1); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 15px; text-align: center; border-right: 1px solid rgba(255,255,255,0.1);">
                        <div style="color: #8B5CF6; font-size: 28px; font-weight: bold;">${data.songsCount}</div>
                        <div style="color: #a0a0a0; font-size: 12px; text-transform: uppercase;">Songs</div>
                      </td>
                      <td style="padding: 15px; text-align: center; border-right: 1px solid rgba(255,255,255,0.1);">
                        <div style="color: #EC4899; font-size: 28px; font-weight: bold;">${data.genres.length}</div>
                        <div style="color: #a0a0a0; font-size: 12px; text-transform: uppercase;">Genres</div>
                      </td>
                      <td style="padding: 15px; text-align: center;">
                        <div style="color: #10B981; font-size: 28px; font-weight: bold;">${data.tokenSymbol || 'BTF'}</div>
                        <div style="color: #a0a0a0; font-size: 12px; text-transform: uppercase;">Token</div>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                    <strong style="color: #ffffff;">Genres:</strong> ${data.genres.join(', ')}
                  </p>
                  
                  <!-- CTA Buttons -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px;">
                    <tr>
                      <td style="padding-right: 10px;">
                        <a href="${artistUrl}" style="display: block; background: linear-gradient(90deg, #8B5CF6 0%, #7C3AED 100%); color: white; text-decoration: none; padding: 15px 25px; border-radius: 8px; font-weight: bold; text-align: center;">
                          View Artist Profile →
                        </a>
                      </td>
                      <td style="padding-left: 10px;">
                        <a href="${boostiswapUrl}" style="display: block; background: linear-gradient(90deg, #EC4899 0%, #DB2777 100%); color: white; text-decoration: none; padding: 15px 25px; border-radius: 8px; font-weight: bold; text-align: center;">
                          Trade Tokens 🪙
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #6b7280; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                    Your artist's tokens are now available on BoostiSwap! Start trading and let the world discover your music.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: #0f0f1a; padding: 25px; text-align: center;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0;">
                    © 2025 Boostify Music. All rights reserved.<br>
                    <a href="https://boostifymusic.com" style="color: #8B5CF6; text-decoration: none;">boostifymusic.com</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const result = await sendBrevoEmail(data.userEmail, `🎵 Your AI Artist "${data.artistName}" is Ready!`, html);
  if (result.success) {
    console.log('✅ Artist generated email sent to:', data.userEmail);
  }
  return result;
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<EmailResult> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden;">
              <tr>
                <td style="background: linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: white; font-size: 28px;">🎵 BOOSTIFY MUSIC</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <h2 style="color: #ffffff; margin: 0 0 20px 0;">Welcome, ${data.userName}! 🎉</h2>
                  <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                    You've just joined the future of music! With Boostify Music, you can:
                  </p>
                  <ul style="color: #a0a0a0; font-size: 14px; line-height: 2;">
                    <li>🤖 Generate AI-powered artists with unique music</li>
                    <li>🪙 Trade artist tokens on BoostiSwap</li>
                    <li>🎬 Create stunning music videos</li>
                    <li>📱 Build your artist's social media presence</li>
                    <li>🛍️ Launch merchandise collections</li>
                  </ul>
                  <a href="https://boostifymusic.com/my-artists" style="display: inline-block; background: linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; margin-top: 20px;">
                    Create Your First Artist →
                  </a>
                </td>
              </tr>
              <tr>
                <td style="background: #0f0f1a; padding: 25px; text-align: center;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0;">
                    © 2025 Boostify Music. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const result = await sendBrevoEmail(data.userEmail, `🎵 Welcome to Boostify Music, ${data.userName}!`, html);
  if (result.success) {
    console.log('✅ Welcome email sent to:', data.userEmail);
  }
  return result;
}

/**
 * Send email when user purchases artist tokens
 */
export async function sendTokenPurchaseEmail(data: TokenPurchaseEmailData): Promise<EmailResult> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden;">
              <tr>
                <td style="background: linear-gradient(90deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: white; font-size: 28px;">🪙 Purchase Confirmed!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <h2 style="color: #ffffff; margin: 0 0 20px 0;">Hey ${data.userName}! 🎉</h2>
                  <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                    Your token purchase has been confirmed on the Polygon blockchain!
                  </p>
                  <table width="100%" style="background: rgba(16, 185, 129, 0.1); border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <tr>
                      <td style="color: #a0a0a0; padding: 10px;">Artist:</td>
                      <td style="color: #ffffff; padding: 10px; font-weight: bold;">${data.artistName}</td>
                    </tr>
                    <tr>
                      <td style="color: #a0a0a0; padding: 10px;">Amount:</td>
                      <td style="color: #10B981; padding: 10px; font-weight: bold; font-size: 24px;">${data.tokenAmount} ${data.tokenSymbol}</td>
                    </tr>
                    <tr>
                      <td style="color: #a0a0a0; padding: 10px;">Transaction:</td>
                      <td style="padding: 10px;">
                        <a href="https://polygonscan.com/tx/${data.transactionHash}" style="color: #8B5CF6; text-decoration: none; font-size: 12px;">
                          ${data.transactionHash.substring(0, 20)}...
                        </a>
                      </td>
                    </tr>
                  </table>
                  <a href="https://boostifymusic.com/boostiswap" style="display: inline-block; background: linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">
                    View Your Portfolio →
                  </a>
                </td>
              </tr>
              <tr>
                <td style="background: #0f0f1a; padding: 25px; text-align: center;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0;">© 2025 Boostify Music</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const result = await sendBrevoEmail(data.userEmail, `🪙 Token Purchase Confirmed - ${data.tokenAmount} ${data.tokenSymbol}`, html);
  if (result.success) {
    console.log('✅ Token purchase email sent to:', data.userEmail);
  }
  return result;
}

/**
 * Send email when a song is tokenized
 */
export async function sendSongTokenizedEmail(data: SongTokenizedEmailData): Promise<EmailResult> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden;">
              <tr>
                <td style="background: linear-gradient(90deg, #F59E0B 0%, #D97706 100%); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: white; font-size: 28px;">🎵 Song Tokenized!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <h2 style="color: #ffffff; margin: 0 0 20px 0;">Hey ${data.userName}! 🎉</h2>
                  <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                    Your song <strong style="color: #F59E0B;">"${data.songTitle}"</strong> by <strong>${data.artistName}</strong> has been successfully tokenized on the Polygon blockchain!
                  </p>
                  <div style="background: rgba(245, 158, 11, 0.1); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                    <p style="color: #a0a0a0; margin: 0 0 10px 0; font-size: 14px;">Token ID</p>
                    <p style="color: #F59E0B; margin: 0; font-size: 18px; font-weight: bold;">${data.tokenId}</p>
                  </div>
                  <p style="color: #6b7280; font-size: 14px;">
                    This song is now part of the BTF-2300 ecosystem and can earn royalties from streams and trades.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background: #0f0f1a; padding: 25px; text-align: center;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0;">© 2025 Boostify Music</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const result = await sendBrevoEmail(data.userEmail, `🎵 Song Tokenized: "${data.songTitle}" is now on-chain!`, html);
  if (result.success) {
    console.log('✅ Song tokenized email sent to:', data.userEmail);
  }
  return result;
}

/**
 * Send generic notification email
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  title: string,
  message: string,
  ctaText?: string,
  ctaUrl?: string
): Promise<EmailResult> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden;">
              <tr>
                <td style="background: linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: white; font-size: 28px;">🎵 BOOSTIFY MUSIC</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <h2 style="color: #ffffff; margin: 0 0 20px 0;">${title}</h2>
                  <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6;">${message}</p>
                  ${ctaText && ctaUrl ? `
                    <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; margin-top: 20px;">
                      ${ctaText}
                    </a>
                  ` : ''}
                </td>
              </tr>
              <tr>
                <td style="background: #0f0f1a; padding: 25px; text-align: center;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0;">© 2025 Boostify Music</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const result = await sendBrevoEmail(to, subject, html);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  FAN CAPTURE EMAILS — automated nurture sequence + event triggers
// ─────────────────────────────────────────────────────────────────────────────

// ─── Fan Email Builder ────────────────────────────────────────────────────────

const DEFAULT_FAN_PRIMARY = '#f97316';
const DEFAULT_FAN_ACCENT = '#f59e0b';

function normalizeFanEmailColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getFanEmailPalette(palette?: FanEmailPalette) {
  const primary = normalizeFanEmailColor(palette?.primaryColor, DEFAULT_FAN_PRIMARY);
  const accent = normalizeFanEmailColor(palette?.accentColor, DEFAULT_FAN_ACCENT);
  return {
    primary,
    accent,
    primarySoft: hexToRgba(primary, 0.24),
    accentSoft: hexToRgba(accent, 0.24),
    primaryBorder: hexToRgba(primary, 0.34),
    accentBorder: hexToRgba(accent, 0.4),
    primaryGlow: hexToRgba(primary, 0.34),
  };
}

function buildFanEmail({
  title,
  artistName,
  artistSlug,
  fanEmail,
  artistImageUrl,
  heroBadge,
  heroIcon,
  bodyHtml,
  ctaText,
  ctaUrl,
  palette: emailPalette,
}: {
  title: string;
  artistName: string;
  artistSlug: string;
  fanEmail: string;
  artistImageUrl?: string;
  heroBadge?: string;
  heroIcon?: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  palette?: FanEmailPalette;
}): string {
  const palette = getFanEmailPalette(emailPalette);
  const initial = artistName.charAt(0).toUpperCase();
  const avatarHtml = artistImageUrl
    ? `<img src="${artistImageUrl}" alt="${artistName}" width="88" height="88"
         style="display:block;width:88px;height:88px;min-width:88px;border-radius:50%;object-fit:cover;border:3px solid ${palette.primary};outline:4px solid ${palette.primarySoft};margin:0 auto 18px;" />`
    : `<div style="width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,${palette.primary},${palette.accent});display:inline-flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:32px;font-weight:800;color:#ffffff;box-shadow:0 0 0 4px ${palette.primarySoft};">
         ${initial}
       </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0c0c18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0c0c18;">
  <tr>
    <td align="center" style="padding:32px 12px 48px;">

      <!-- Card -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;">
        <tr>
          <td style="border-radius:20px;overflow:hidden;background-color:#141428;box-shadow:0 40px 80px rgba(0,0,0,0.65),0 0 0 1px ${palette.primaryBorder};">

            <!-- HERO -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td align="center" style="background:linear-gradient(160deg,${palette.primarySoft} 0%,${palette.accentSoft} 58%,#080b12 100%);padding:44px 30px 36px;text-align:center;">
                  ${heroBadge ? `<div style="margin-bottom:20px;">
                    <span style="display:inline-block;background:${palette.primarySoft};border:1px solid ${palette.accentBorder};color:#fff7ed;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;padding:5px 16px;border-radius:20px;">${heroBadge}</span>
                  </div>` : ''}
                  ${avatarHtml}
                  <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0 0 6px;letter-spacing:-0.3px;line-height:1.2;">${artistName}</h1>
                  <p style="color:rgba(255,255,255,0.72);font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0;">${heroIcon ?? '🎵'} BOOSTIFY MUSIC</p>
                </td>
              </tr>
            </table>

            <!-- BODY -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding:36px 36px 8px;background-color:#141428;">
                  ${bodyHtml}
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding:24px 36px 40px;background-color:#141428;">
                  <a href="${ctaUrl}"
                     style="display:inline-block;background:linear-gradient(90deg,${palette.primary} 0%,${palette.accent} 100%);color:#ffffff;text-decoration:none;padding:16px 52px;border-radius:12px;font-weight:700;font-size:16px;letter-spacing:0.2px;box-shadow:0 8px 28px ${palette.primaryGlow};mso-padding-alt:16px 52px;">
                    ${ctaText} →
                  </a>
                </td>
              </tr>
            </table>

            <!-- DIVIDER -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding:0 36px;background-color:#141428;">
                  <div style="height:1px;background:linear-gradient(90deg,transparent 0%,${palette.primaryBorder} 50%,transparent 100%);"></div>
                </td>
              </tr>
            </table>

            <!-- FOOTER -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td align="center" style="background-color:#0e0e1e;padding:24px 36px;border-radius:0 0 20px 20px;">
                  <p style="color:#3a3a5a;font-size:12px;margin:0 0 10px;line-height:1.6;">
                      You are receiving this email because you joined the fan list for <strong style="color:#5a5a7a;">${artistName}</strong>.
                  </p>
                  <p style="margin:0;font-size:12px;">
                    <a href="https://www.boostifymusic.com/unsubscribe?email=${encodeURIComponent(fanEmail)}&artist=${artistSlug}"
                        style="color:${palette.accent};text-decoration:none;font-weight:500;">Unsubscribe</a>
                    <span style="color:#2a2a4a;margin:0 10px;">·</span>
                    <a href="https://www.boostifymusic.com" style="color:#3a3a5a;text-decoration:none;">boostifymusic.com</a>
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

/**
 * Fan Welcome Email — sent immediately on capture
 */
export async function sendFanWelcomeEmail(
  fanEmail: string,
  fanName: string,
  artistName: string,
  artistSlug: string,
  artistImageUrl?: string,
  emailPalette?: FanEmailPalette,
): Promise<EmailResult> {
  const firstName = fanName ? fanName.split(' ')[0] : null;
  const greeting = firstName ? `Hi ${firstName}` : 'Welcome';
  const artistUrl = `https://www.boostifymusic.com/artist/${artistSlug}`;
  const palette = getFanEmailPalette(emailPalette);

  const bodyHtml = `
    <h2 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 14px;line-height:1.3;">
      ${greeting} to <span style="background:linear-gradient(90deg,${palette.primary},${palette.accent});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${artistName}</span>'s world.
    </h2>
    <p style="color:#b0b0cc;font-size:15px;line-height:1.75;margin:0 0 24px;">
      You just joined the first circle for <strong style="color:${palette.accent};">${artistName}</strong>. You will be first in line for new music, private updates, release alerts, and exclusive drops.
    </p>

    <!-- Benefits table -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:28px;">
      ${[
        { icon: '🎵', title: 'First listens', desc: 'Hear new music as soon as it drops' },
        { icon: '🎬', title: 'Private updates', desc: 'Artist moments beyond the public feed' },
        { icon: '⭐', title: 'Fan circle', desc: 'The best updates, straight to your inbox' },
      ].map(b => `
      <tr>
        <td style="padding:0 0 12px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="48" style="vertical-align:middle;">
                <div style="width:40px;height:40px;border-radius:10px;background:${palette.primarySoft};border:1px solid ${palette.primaryBorder};text-align:center;line-height:40px;font-size:18px;">${b.icon}</div>
              </td>
              <td style="vertical-align:middle;padding-left:12px;">
                <p style="margin:0;color:#e2e2f2;font-size:14px;font-weight:700;">${b.title}</p>
                <p style="margin:0;color:#6a6a8a;font-size:13px;">${b.desc}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`).join('')}
    </table>

    <p style="color:#6a6a8a;font-size:13px;line-height:1.6;margin:0;">
      This is just the beginning. Stay close and let the music find you first.
    </p>
  `;

  const html = buildFanEmail({
    title: `Welcome to ${artistName}'s world`,
    artistName, artistSlug, fanEmail, artistImageUrl,
    heroBadge: 'Exclusive access unlocked',
    heroIcon: '🎵',
    bodyHtml,
    ctaText: 'Open artist profile',
    ctaUrl: artistUrl,
    palette: emailPalette,
  });

  return sendBrevoEmail(fanEmail, `Welcome to ${artistName}'s world`, html);
}

/**
 * Fan Day +3 Email — deeper story
 */
export async function sendFanDay3Email(
  fanEmail: string,
  fanName: string,
  artistName: string,
  artistSlug: string,
  artistImageUrl?: string,
  emailPalette?: FanEmailPalette,
): Promise<EmailResult> {
  const firstName = fanName ? fanName.split(' ')[0] : null;
  const artistUrl = `https://www.boostifymusic.com/artist/${artistSlug}`;
  const palette = getFanEmailPalette(emailPalette);

  const bodyHtml = `
    <h2 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 14px;line-height:1.3;">
      ${firstName ? `${firstName}, here is the story` : 'The story'} behind <span style="color:${palette.primary};">${artistName}</span>
    </h2>
    <p style="color:#b0b0cc;font-size:15px;line-height:1.75;margin:0 0 20px;">
      Every great artist has a path. <strong style="color:${palette.accent};">${artistName}</strong> is no exception. The sound, the lyrics, and the energy all come from somewhere real.
    </p>

    <div style="background:${palette.primarySoft};border:1px solid ${palette.primaryBorder};border-radius:14px;padding:20px 22px;margin-bottom:24px;">
      <p style="color:#fff7ed;font-size:14px;font-style:italic;margin:0;line-height:1.7;">
        "Every song is a chapter. Every listen is a connection."
      </p>
    </div>

    <p style="color:#b0b0cc;font-size:15px;line-height:1.75;margin:0 0 8px;">
      Visit the profile and discover the music that started it all. Ready to listen closer?
    </p>
  `;

  const html = buildFanEmail({
    title: `The story behind ${artistName}`,
    artistName, artistSlug, fanEmail, artistImageUrl,
    heroBadge: 'Artist story',
    heroIcon: '🎶',
    bodyHtml,
    ctaText: 'Explore the music',
    ctaUrl: artistUrl,
    palette: emailPalette,
  });

  return sendBrevoEmail(fanEmail, `The story behind ${artistName}`, html);
}

/**
 * Fan Day +7 Email — exclusive content
 */
export async function sendFanDay7Email(
  fanEmail: string,
  fanName: string,
  artistName: string,
  artistSlug: string,
  artistImageUrl?: string,
  emailPalette?: FanEmailPalette,
): Promise<EmailResult> {
  const firstName = fanName ? fanName.split(' ')[0] : null;
  const artistUrl = `https://www.boostifymusic.com/artist/${artistSlug}`;
  const palette = getFanEmailPalette(emailPalette);

  const bodyHtml = `
    <h2 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 14px;line-height:1.3;">
      ${firstName ? `${firstName}, you are` : 'You are'} officially in the inner circle.
    </h2>
    <p style="color:#b0b0cc;font-size:15px;line-height:1.75;margin:0 0 20px;">
      One week in, and you are still here. That matters. <strong style="color:${palette.accent};">${artistName}</strong> is building the next chapter, and fans like you help move it forward.
    </p>

    <!-- Inner circle card -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="background:linear-gradient(135deg,${palette.primarySoft} 0%,${palette.accentSoft} 100%);border:1px solid ${palette.primaryBorder};border-radius:14px;padding:20px 22px;">
          <p style="color:#fff7ed;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">What is coming your way:</p>
          ${[
            '🎵 Song previews before release day',
            '📸 Exclusive session moments',
            '🔔 Show, drop, and surprise alerts',
          ].map(item => `
          <p style="color:#e2e2f2;font-size:14px;margin:0 0 8px;">
            ${item}
          </p>`).join('')}
        </td>
      </tr>
    </table>

    <p style="color:#6a6a8a;font-size:13px;line-height:1.6;margin:0;">
      Stay connected. The best parts are still ahead.
    </p>
  `;

  const html = buildFanEmail({
    title: `You are in ${artistName}'s inner circle`,
    artistName, artistSlug, fanEmail, artistImageUrl,
    heroBadge: '⭐ Inner Circle',
    heroIcon: '🌟',
    bodyHtml,
    ctaText: 'Open artist profile',
    ctaUrl: artistUrl,
    palette: emailPalette,
  });

  return sendBrevoEmail(fanEmail, `You are officially in ${artistName}'s inner circle`, html);
}

/**
 * Fan New Song Email — triggered when artist releases a new song
 */
export async function sendFanNewSongEmail(
  fanEmail: string,
  fanName: string,
  artistName: string,
  songTitle: string,
  artistSlug: string,
  artistImageUrl?: string,
  emailPalette?: FanEmailPalette,
): Promise<EmailResult> {
  const firstName = fanName ? fanName.split(' ')[0] : null;
  const artistUrl = `https://www.boostifymusic.com/artist/${artistSlug}`;
  const palette = getFanEmailPalette(emailPalette);

  const bodyHtml = `
    <h2 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 14px;line-height:1.3;">
      ${firstName ? `${firstName},` : ''} <span style="color:${palette.primary};">${artistName}</span> just released something new.
    </h2>
    <p style="color:#b0b0cc;font-size:15px;line-height:1.75;margin:0 0 20px;">
      The wait is over. <strong style="color:${palette.accent};">${artistName}</strong> just dropped a new track:
    </p>

    <!-- Song card -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="background:linear-gradient(135deg,${palette.primarySoft} 0%,${palette.accentSoft} 100%);border:1px solid ${palette.primaryBorder};border-radius:16px;padding:24px 26px;text-align:center;">
          <p style="color:rgba(255,247,237,0.72);font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 10px;">NEW SINGLE</p>
          <p style="color:#ffffff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.3px;">"${songTitle}"</p>
          <div style="width:48px;height:2px;background:linear-gradient(90deg,${palette.primary},${palette.accent});border-radius:2px;margin:14px auto 0;"></div>
        </td>
      </tr>
    </table>

    <p style="color:#b0b0cc;font-size:15px;line-height:1.75;margin:0 0 8px;">
      Be one of the first to hear it. Share it with your people and help the moment travel.
    </p>
  `;

  const html = buildFanEmail({
    title: `${artistName} released "${songTitle}"`,
    artistName, artistSlug, fanEmail, artistImageUrl,
    heroBadge: 'New release',
    heroIcon: '🎵',
    bodyHtml,
    ctaText: 'Listen now',
    ctaUrl: artistUrl,
    palette: emailPalette,
  });

  return sendBrevoEmail(fanEmail, `${artistName} just released "${songTitle}"`, html);
}

/**
 * Fan New News Email — triggered when artist publishes new news/update
 */
export async function sendFanNewNewsEmail(
  fanEmail: string,
  fanName: string,
  artistName: string,
  newsTitle: string,
  artistSlug: string,
  artistImageUrl?: string,
  emailPalette?: FanEmailPalette,
): Promise<EmailResult> {
  const firstName = fanName ? fanName.split(' ')[0] : null;
  const artistUrl = `https://www.boostifymusic.com/artist/${artistSlug}`;
  const palette = getFanEmailPalette(emailPalette);

  const bodyHtml = `
    <h2 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 14px;line-height:1.3;">
      ${firstName ? `${firstName},` : ''} <span style="color:${palette.primary};">${artistName}</span> has an update for you.
    </h2>
    <p style="color:#b0b0cc;font-size:15px;line-height:1.75;margin:0 0 20px;">
      Fresh news just arrived from the artist profile:
    </p>

    <!-- News card -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="background:${palette.accentSoft};border:1px solid ${palette.accentBorder};border-left:4px solid ${palette.accent};border-radius:0 12px 12px 0;padding:18px 22px;">
          <p style="color:#fff7ed;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">UPDATE</p>
          <p style="color:#ffffff;font-size:17px;font-weight:700;margin:0;line-height:1.4;">${newsTitle}</p>
        </td>
      </tr>
    </table>

    <p style="color:#b0b0cc;font-size:14px;line-height:1.7;margin:0;">
      Open the artist profile to read the full story and stay close to what is happening next.
    </p>
  `;

  const html = buildFanEmail({
    title: `${artistName} update`,
    artistName, artistSlug, fanEmail, artistImageUrl,
    heroBadge: 'Artist update',
    heroIcon: '📰',
    bodyHtml,
    ctaText: 'Read more',
    ctaUrl: artistUrl,
    palette: emailPalette,
  });

  return sendBrevoEmail(fanEmail, `${artistName}: ${newsTitle}`, html);
}

/**
 * Artist notification — new fan subscribed
 */
export async function sendArtistNewFanNotification(
  artistEmail: string,
  artistName: string,
  fanName: string | null,
  fanEmail: string,
  artistImageUrl?: string,
  emailPalette?: FanEmailPalette,
): Promise<EmailResult> {
  const palette = getFanEmailPalette(emailPalette);
  const fanDisplay = fanName ? `${fanName}` : 'New fan';
  const fanEmailDisplay = fanEmail;

  const bodyHtml = `
    <h2 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 14px;line-height:1.3;">
      Hey ${artistName}, a new fan just joined.
    </h2>
    <p style="color:#b0b0cc;font-size:15px;line-height:1.75;margin:0 0 20px;">
      Someone just subscribed through your public artist profile:
    </p>

    <!-- Fan card -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="background:${palette.primarySoft};border:1px solid ${palette.primaryBorder};border-radius:14px;padding:18px 22px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="44">
                <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,${palette.primary},${palette.accent});display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;">
                  ${fanDisplay.charAt(0).toUpperCase()}
                </div>
              </td>
              <td style="padding-left:12px;">
                <p style="color:#e2e2f2;font-size:15px;font-weight:700;margin:0;">${fanDisplay}</p>
                <p style="color:#6a6a8a;font-size:13px;margin:0 0 0 0;">${fanEmailDisplay}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="color:#b0b0cc;font-size:14px;line-height:1.7;margin:0 0 8px;">
      They will receive your welcome sequence and can be notified when you release new music or post updates. Keep creating. Your fan base is growing.
    </p>
  `;

  const html = buildFanEmail({
    title: `New fan joined your profile`,
    artistName,
    artistSlug: artistEmail.split('@')[0], // fallback
    fanEmail: artistEmail,
    artistImageUrl,
    heroBadge: '⭐ Fan Alert',
    heroIcon: '🎤',
    bodyHtml,
    ctaText: 'Open your dashboard',
    ctaUrl: 'https://www.boostifymusic.com/dashboard',
    palette: emailPalette,
  });

  return sendBrevoEmail(artistEmail, `New fan joined your artist profile`, html);
}

export default {
  sendArtistGeneratedEmail,
  sendWelcomeEmail,
  sendTokenPurchaseEmail,
  sendSongTokenizedEmail,
  sendNotificationEmail,
  sendFanWelcomeEmail,
  sendFanDay3Email,
  sendFanDay7Email,
  sendFanNewSongEmail,
  sendFanNewNewsEmail,
  sendArtistNewFanNotification,
};
