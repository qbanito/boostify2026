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
      .mobile-btn { width: 100% !important; padding: 16px 20px !important; font-size: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">Real results from real artists. See their stories.</div>
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
                    <div style="font-size: 40px; margin-bottom: 10px;">💬</div>
                    <h1 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 800; color: #1a1a1a; line-height: 1.3;">
                      Real Artists.<br>
                      <span style="color: #f97316;">Real Results.</span>
                    </h1>
                    <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.5;">
                      ${artistName}, don't just take our word for it.
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
                      ${artistName}, what's YOUR story going to be?
                    </h3>
                    <p style="margin: 0 0 20px 0; font-size: 13px; color: rgba(255,255,255,0.9);">
                      Join 5,000+ artists already growing on Boostify
                    </p>
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://boostifymusic.com/my-artists" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="20%" strokecolor="#ffffff" fillcolor="#ffffff">
                      <w:anchorlock/>
                      <center style="color:#ea580c;font-family:sans-serif;font-size:15px;font-weight:bold;">🚀 START MY SUCCESS STORY</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${URLS.myArtists}" style="display: inline-block; background: #ffffff; color: #ea580c; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2); mso-hide: all;">
                      🚀 START MY SUCCESS STORY
                    </a>
                    <!--<![endif]-->
                    <p style="margin: 15px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.75);">
                      100% FREE • No credit card needed
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
      to: ['convoycubano@gmail.com'],
      subject: '🔥 Pachi Lopez, Artists Like You Are Blowing Up on Boostify',
      html: html
    });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Email 6/10 enviado a convoycubano@gmail.com!');
    console.log('ID:', data.id);
  } catch (err) {
    console.error('Error:', err);
  }
}

sendEmail();
