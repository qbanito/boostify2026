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
  <div style="display: none; max-height: 0; overflow: hidden;">Professional analytics for artists - FREE</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 30px 15px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding: 35px 28px;">

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
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
                <tr>
                  <td style="padding: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 15px;">
                      <tr>
                        <td width="33%" style="text-align: center; padding: 10px 5px;">
                          <div style="font-size: 22px; font-weight: 800; color: #f97316;">2.4K</div>
                          <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Visitors</div>
                        </td>
                        <td width="33%" style="text-align: center; padding: 10px 5px; border-left: 1px solid #334155; border-right: 1px solid #334155;">
                          <div style="font-size: 22px; font-weight: 800; color: #10b981;">+340%</div>
                          <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Growth</div>
                        </td>
                        <td width="33%" style="text-align: center; padding: 10px 5px;">
                          <div style="font-size: 22px; font-weight: 800; color: #ffffff;">87%</div>
                          <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Mobile</div>
                        </td>
                      </tr>
                    </table>
                    <div style="background: #334155; height: 1px; margin: 15px 0;"></div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="font-size: 12px; color: #94a3b8;">📍 Top Location:</td>
                        <td align="right" style="font-size: 12px; color: #ffffff;">Mexico City (34%)</td>
                      </tr>
                      <tr><td height="8"></td></tr>
                      <tr>
                        <td style="font-size: 12px; color: #94a3b8;">🎵 Top Track:</td>
                        <td align="right" style="font-size: 12px; color: #ffffff;">Mi Canción (1.2K plays)</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Features -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 12px;">
                <tr>
                  <td style="padding: 18px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(249, 115, 22, 0.02) 100%); border-radius: 12px; border-left: 4px solid #f97316;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="45" valign="top" style="padding-right: 12px;">
                          <div style="font-size: 24px;">🌍</div>
                        </td>
                        <td>
                          <div style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">Fan Demographics</div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.5;">Age, gender, location, and devices of your visitors.</div>
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
                          <div style="font-size: 24px;">🎵</div>
                        </td>
                        <td>
                          <div style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">Top Tracks</div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.5;">Discover which of your songs generate the most interest.</div>
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
                          <div style="font-size: 24px;">📅</div>
                        </td>
                        <td>
                          <div style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">Best Times</div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.5;">Publish when your audience is most active.</div>
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
                          <div style="font-size: 24px;">🔗</div>
                        </td>
                        <td>
                          <div style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">Traffic Sources</div>
                          <div style="font-size: 13px; color: #64748b; line-height: 1.5;">Know where your fans come from: Instagram, TikTok, Google...</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
                <tr>
                  <td align="center" style="text-align: center;">
                    <p style="margin: 0 0 15px 0; font-size: 13px; color: #64748b;">
                      All included FREE with your artist page
                    </p>
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://boostifymusic.com/my-artists" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="15%" strokecolor="#10b981" fillcolor="#10b981">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">📊 SEE MY ANALYTICS</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${URLS.myArtists}" class="mobile-btn" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; text-align: center; mso-hide: all; max-width: 280px; box-sizing: border-box;">
                      📊 SEE MY ANALYTICS
                    </a>
                    <!--<![endif]-->
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
      subject: '📊 Pachi Lopez, Know Your Fans Like Never Before',
      html: html
    });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Email 7/10 enviado a pachilopezmusic@gmail.com!');
    console.log('ID:', data.id);
  } catch (err) {
    console.error('Error:', err);
  }
}

sendEmail();
