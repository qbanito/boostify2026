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
  <div style="display: none; max-height: 0; overflow: hidden;">A summary of everything waiting for you at Boostify Music</div>
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

              <!-- Hero -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 25px;">
                    <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 800; color: #1a1a1a; line-height: 1.3;">
                      ${artistName},<br>
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
                  <td style="padding: 25px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0.03) 100%); border-radius: 16px; border: 2px solid rgba(249, 115, 22, 0.2);">
                    <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: center;">
                      What you get with Boostify:
                    </h2>
                    
                    <!-- Features -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                      <tr>
                        <td style="padding: 14px; background: #ffffff; border-radius: 10px; border-left: 4px solid #f97316;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td width="40" valign="top">
                                <div style="font-size: 20px;">🎨</div>
                              </td>
                              <td>
                                <div style="font-size: 14px; font-weight: 700; color: #1a1a1a;">Professional Artist Page</div>
                                <div style="font-size: 12px; color: #64748b;">Your music, bio, photos, and links in one stunning design</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                      <tr>
                        <td style="padding: 14px; background: #ffffff; border-radius: 10px; border-left: 4px solid #10b981;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td width="40" valign="top">
                                <div style="font-size: 20px;">🤝</div>
                              </td>
                              <td>
                                <div style="font-size: 14px; font-weight: 700; color: #1a1a1a;">BoostiSwap</div>
                                <div style="font-size: 12px; color: #64748b;">Connect and collaborate with thousands of artists</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                      <tr>
                        <td style="padding: 14px; background: #ffffff; border-radius: 10px; border-left: 4px solid #ef4444;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td width="40" valign="top">
                                <div style="font-size: 20px;">📈</div>
                              </td>
                              <td>
                                <div style="font-size: 14px; font-weight: 700; color: #1a1a1a;">YouTube Boost</div>
                                <div style="font-size: 12px; color: #64748b;">Tools to multiply your video views</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                      <tr>
                        <td style="padding: 14px; background: #ffffff; border-radius: 10px; border-left: 4px solid #8b5cf6;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td width="40" valign="top">
                                <div style="font-size: 20px;">📊</div>
                              </td>
                              <td>
                                <div style="font-size: 14px; font-weight: 700; color: #1a1a1a;">Pro Analytics</div>
                                <div style="font-size: 12px; color: #64748b;">Know your audience like never before</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 15px;">
                      <tr>
                        <td style="padding: 14px; background: #ffffff; border-radius: 10px; border-left: 4px solid #f59e0b;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td width="40" valign="top">
                                <div style="font-size: 20px;">🌟</div>
                              </td>
                              <td>
                                <div style="font-size: 14px; font-weight: 700; color: #1a1a1a;">Artist Community</div>
                                <div style="font-size: 12px; color: #64748b;">Over 5,000 artists growing together</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding-top: 15px; border-top: 1px solid rgba(249, 115, 22, 0.2);">
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
                  <td style="padding: 22px; background: #f8fafc; border-radius: 12px;">
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
                  <td align="center" style="text-align: center;">
                    <a href="${URLS.myArtists}" class="mobile-btn" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; text-align: center; max-width: 280px; box-sizing: border-box;">
                      🎨 CREATE MY FREE PAGE
                    </a>
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
      subject: '💜 Pachi Lopez, This is My Last Message (For Now)',
      html: html
    });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Email 10/10 enviado a pachilopezmusic@gmail.com!');
    console.log('ID:', data.id);
  } catch (err) {
    console.error('Error:', err);
  }
}

sendEmail();
