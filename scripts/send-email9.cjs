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
  <div style="display: none; max-height: 0; overflow: hidden;">Join the largest community of independent artists</div>
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
                      A community that<br>
                      <span style="color: #f97316;">never stops growing</span>
                    </h1>
                  </td>
                </tr>
              </table>

              <!-- Big Stats -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
                <tr>
                  <td style="padding: 30px 20px; background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%); border-radius: 16px; text-align: center;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="33%" align="center" style="padding: 8px;">
                          <div style="font-size: 28px; font-weight: 800; color: #ffffff;">5,247</div>
                          <div style="font-size: 10px; color: rgba(255,255,255,0.8); text-transform: uppercase;">Artists</div>
                        </td>
                        <td width="33%" align="center" style="padding: 8px;">
                          <div style="font-size: 28px; font-weight: 800; color: #ffffff;">2.3M</div>
                          <div style="font-size: 10px; color: rgba(255,255,255,0.8); text-transform: uppercase;">Visits/mo</div>
                        </td>
                        <td width="33%" align="center" style="padding: 8px;">
                          <div style="font-size: 28px; font-weight: 800; color: #ffffff;">45K</div>
                          <div style="font-size: 10px; color: rgba(255,255,255,0.8); text-transform: uppercase;">Collabs</div>
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

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 8px;">
                <tr>
                  <td style="padding: 12px 15px; background: #f8fafc; border-radius: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="35">🎤</td>
                        <td>
                          <div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Maria "The Voice" Santos</div>
                          <div style="font-size: 12px; color: #64748b;">Pop Latino · Madrid</div>
                        </td>
                        <td align="right" style="font-size: 11px; color: #94a3b8;">2h ago</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 8px;">
                <tr>
                  <td style="padding: 12px 15px; background: #f8fafc; border-radius: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="35">🎧</td>
                        <td>
                          <div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Beats by Milo</div>
                          <div style="font-size: 12px; color: #64748b;">Hip Hop · Buenos Aires</div>
                        </td>
                        <td align="right" style="font-size: 11px; color: #94a3b8;">5h ago</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px 15px; background: #f8fafc; border-radius: 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="35">🎹</td>
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
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
                <tr>
                  <td align="center" style="text-align: center;">
                    <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 700; color: #1a1a1a;">
                      ${artistName}, your spot is waiting
                    </h3>
                    <a href="${URLS.myArtists}" class="mobile-btn" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; text-align: center; max-width: 280px; box-sizing: border-box;">
                      🎵 JOIN THE COMMUNITY
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
      subject: "🚀 Pachi Lopez, We're Now 5,000+ Artists Growing Together",
      html: html
    });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Email 9/10 enviado a pachilopezmusic@gmail.com!');
    console.log('ID:', data.id);
  } catch (err) {
    console.error('Error:', err);
  }
}

sendEmail();
