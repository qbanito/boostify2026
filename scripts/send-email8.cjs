const { Resend } = require('resend');

const resend = new Resend('re_Q73PRQ8o_8wYWWVHufVwDocuKaLRrVJhf');

const artistName = 'Pachi Lopez';
const URLS = {
  myArtists: 'https://boostifymusic.com/my-artists'
};

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boostify Music</title>
  <style>
    @media only screen and (max-width: 600px) {
      .mobile-btn { 
        display: block !important; 
        width: 90% !important; 
        max-width: 280px !important;
        padding: 14px 20px !important; 
        font-size: 14px !important;
        margin: 0 auto !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">Exclusive offer ending soon - Don't miss out</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 30px 15px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding: 35px 28px;">

              <!-- Logo -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <img src="https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png" alt="Boostify Music" width="60" height="60" style="display: block; width: 60px; height: 60px;" />
                  </td>
                </tr>
              </table>

              <!-- Hero Banner -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding: 30px 25px; background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%); border-radius: 16px; text-align: center;">
                    <div style="display: inline-block; background: #ffffff; color: #f97316; padding: 6px 16px; border-radius: 50px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 15px;">
                      ⏰ LIMITED OFFER
                    </div>
                    <h1 style="margin: 0 0 15px 0; font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                      1 YEAR OF PREMIUM<br>
                      COMPLETELY FREE
                    </h1>
                    <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.9);">
                      ${artistName}, we're selecting artists for our beta premium program. You're on the list.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- What's Included -->
              <h2 style="margin: 30px 0 20px 0; font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: center;">
                What you get with Premium:
              </h2>

              <!-- Feature Cards -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
                <tr>
                  <td style="padding: 18px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(249, 115, 22, 0.02) 100%); border-radius: 12px; border-left: 4px solid #f97316;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="45" valign="top" style="padding-right: 12px;">
                          <div style="font-size: 24px;">✨</div>
                        </td>
                        <td>
                          <div style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">No Watermark <span style="color: #64748b; font-weight: 400; font-size: 12px;">($99/year value)</span></div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.5;">Your brand, no distractions</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
                <tr>
                  <td style="padding: 18px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(249, 115, 22, 0.02) 100%); border-radius: 12px; border-left: 4px solid #f97316;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="45" valign="top" style="padding-right: 12px;">
                          <div style="font-size: 24px;">📊</div>
                        </td>
                        <td>
                          <div style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">Advanced Analytics <span style="color: #64748b; font-weight: 400; font-size: 12px;">($49/year value)</span></div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.5;">Detailed audience insights</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
                <tr>
                  <td style="padding: 18px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(249, 115, 22, 0.02) 100%); border-radius: 12px; border-left: 4px solid #f97316;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="45" valign="top" style="padding-right: 12px;">
                          <div style="font-size: 24px;">🚀</div>
                        </td>
                        <td>
                          <div style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">Priority Boost <span style="color: #64748b; font-weight: 400; font-size: 12px;">($79/year value)</span></div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.5;">Your music featured on the platform</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
                <tr>
                  <td style="padding: 18px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(249, 115, 22, 0.02) 100%); border-radius: 12px; border-left: 4px solid #f97316;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="45" valign="top" style="padding-right: 12px;">
                          <div style="font-size: 24px;">🎯</div>
                        </td>
                        <td>
                          <div style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">Custom Domain <span style="color: #64748b; font-weight: 400; font-size: 12px;">($49/year value)</span></div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.5;">yourname.boostifymusic.com</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

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
                  <td align="center" style="text-align: center;">
                    <a href="${URLS.myArtists}?premium=true" class="mobile-btn" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; text-align: center; max-width: 280px; box-sizing: border-box;">
                      🔥 CLAIM FREE PREMIUM
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
        
        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px;">
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 25px 30px; border-radius: 0 0 16px 16px;">
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
                          <a href="https://boostifymusic.com" style="font-size: 12px; color: #f97316; text-decoration: none;">🌐 boostifymusic.com</a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://boostifymusic.com/my-artists" style="font-size: 12px; color: #10b981; text-decoration: none;">🎨 Create Artist Page</a>
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
          <tr>
            <td style="padding: 15px; text-align: center;">
              <a href="#" style="font-size: 11px; color: #94a3b8; text-decoration: none;">Unsubscribe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

async function sendEmail() {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Boostify Music <artists@boostifymusic.site>',
      to: ['pachilopezmusic@gmail.com'],
      subject: '🔥 Pachi Lopez, Last Chance: FREE Premium for 1 Year',
      html: html
    });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Email 8/10 enviado a pachilopezmusic@gmail.com!');
    console.log('ID:', data.id);
  } catch (err) {
    console.error('Error:', err);
  }
}

sendEmail();
