/**
 * Outreach Email Service
 * Handles sending promotional emails to music industry contacts
 * Uses Brevo API with rate limiting to protect domain reputation
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

// Email sender configuration
const FROM_EMAIL = 'info@boostifymusic.com';
const FROM_NAME = 'Boostify Music';

export interface OutreachEmailData {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  tags?: string[];
}

export interface OutreachEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Replace template variables with actual values
 */
export function replaceTemplateVariables(
  template: string, 
  variables: Record<string, string>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    result = result.replace(regex, value || '');
  }
  
  return result;
}

/**
 * Send a single outreach email via Brevo
 */
export async function sendOutreachEmail(data: OutreachEmailData): Promise<OutreachEmailResult> {
  if (!BREVO_API_KEY) {
    console.error('❌ BREVO_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }
  
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
        to: [{ email: data.to, name: data.toName || data.to }],
        subject: data.subject,
        htmlContent: data.htmlContent,
        textContent: data.textContent,
        tags: data.tags || ['outreach'],
        // Enable tracking
        headers: {
          'X-Mailin-Tag': 'outreach'
        }
      })
    });
    
    const result = await response.json();
    
    if (result.messageId) {
      console.log(`✅ Outreach email sent to: ${data.to}, messageId: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } else {
      console.error('❌ Brevo error:', result);
      return { success: false, error: result.message || JSON.stringify(result) };
    }
  } catch (error: any) {
    console.error('❌ Outreach email error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get default artist introduction template
 */
export function getDefaultArtistIntroTemplate(): { subject: string; bodyHtml: string; bodyText: string } {
  return {
    subject: "🎵 Introducing {{artist_name}} - A Rising Star in {{genre}}",
    bodyHtml: `
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
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%); padding: 25px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">🎵 BOOSTIFY MUSIC</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi {{contact_name}},
              </p>
              
              <p style="color: #ffffff; font-size: 18px; line-height: 1.6; margin: 0 0 20px 0;">
                I wanted to introduce you to <strong style="color: #EC4899;">{{artist_name}}</strong>, an exciting artist making waves in the {{genre}} scene.
              </p>
              
              <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                {{artist_bio}}
              </p>
              
              <!-- Artist Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(139, 92, 246, 0.1); border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <div style="color: #ffffff; font-size: 22px; font-weight: bold; margin-bottom: 10px;">{{artist_name}}</div>
                    <div style="color: #8B5CF6; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">{{genre}}</div>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <a href="{{landing_url}}" style="display: inline-block; background: linear-gradient(90deg, #8B5CF6 0%, #EC4899 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      View Full Profile & Music →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                I'd love to discuss potential opportunities for collaboration. Feel free to reply to this email or schedule a call at your convenience.
              </p>
              
              <p style="color: #a0a0a0; font-size: 14px; margin-top: 20px;">
                Best regards,<br>
                <strong style="color: #ffffff;">{{sender_name}}</strong><br>
                Boostify Music
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #0f0f1a; padding: 25px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                © 2025 Boostify Music. All rights reserved.<br>
                <a href="https://boostifymusic.com" style="color: #8B5CF6; text-decoration: none;">boostifymusic.com</a>
                <br><br>
                <a href="{{unsubscribe_url}}" style="color: #6b7280; text-decoration: underline; font-size: 11px;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    bodyText: `
Hi {{contact_name}},

I wanted to introduce you to {{artist_name}}, an exciting artist making waves in the {{genre}} scene.

{{artist_bio}}

View the full profile and listen to their music: {{landing_url}}

I'd love to discuss potential opportunities for collaboration. Feel free to reply to this email or schedule a call at your convenience.

Best regards,
{{sender_name}}
Boostify Music

---
Unsubscribe: {{unsubscribe_url}}
    `
  };
}

/**
 * Get sync licensing opportunity template
 */
export function getSyncOpportunityTemplate(): { subject: string; bodyHtml: string; bodyText: string } {
  return {
    subject: "🎬 Sync-Ready Music from {{artist_name}} | {{genre}}",
    bodyHtml: `
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
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(90deg, #F59E0B 0%, #EF4444 100%); padding: 25px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px;">🎬 SYNC OPPORTUNITY</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #a0a0a0; font-size: 16px; margin: 0 0 20px 0;">
                Hi {{contact_name}},
              </p>
              
              <p style="color: #ffffff; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                We have sync-ready tracks from <strong style="color: #F59E0B;">{{artist_name}}</strong> that would be perfect for {{company_name}}'s projects.
              </p>
              
              <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #F59E0B; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <p style="color: #ffffff; margin: 0; font-size: 15px;">
                  <strong>Genre:</strong> {{genre}}<br>
                  <strong>Mood:</strong> Available in various moods<br>
                  <strong>Stems:</strong> Full stems available<br>
                  <strong>Clearance:</strong> One-stop licensing
                </p>
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <a href="{{landing_url}}" style="display: inline-block; background: linear-gradient(90deg, #F59E0B 0%, #EF4444 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 8px; font-weight: bold;">
                      Listen Now →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #a0a0a0; font-size: 14px; margin-top: 30px;">
                Best,<br>
                <strong style="color: #ffffff;">{{sender_name}}</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #0f0f1a; padding: 20px; text-align: center;">
              <p style="color: #6b7280; font-size: 11px; margin: 0;">
                <a href="{{unsubscribe_url}}" style="color: #6b7280;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    bodyText: `
Hi {{contact_name}},

We have sync-ready tracks from {{artist_name}} that would be perfect for {{company_name}}'s projects.

Genre: {{genre}}
Mood: Available in various moods
Stems: Full stems available
Clearance: One-stop licensing

Listen now: {{landing_url}}

Best,
{{sender_name}}
Boostify Music

Unsubscribe: {{unsubscribe_url}}
    `
  };
}

/**
 * Get follow-up template
 */
export function getFollowUpTemplate(): { subject: string; bodyHtml: string; bodyText: string } {
  return {
    subject: "Re: {{artist_name}} - Following Up",
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff;">
  <p style="color: #333; font-size: 15px; line-height: 1.6;">
    Hi {{contact_name}},
  </p>
  
  <p style="color: #333; font-size: 15px; line-height: 1.6;">
    I wanted to follow up on my previous email about {{artist_name}}. Have you had a chance to check out their profile?
  </p>
  
  <p style="color: #333; font-size: 15px; line-height: 1.6;">
    Here's the link again: <a href="{{landing_url}}" style="color: #8B5CF6;">{{landing_url}}</a>
  </p>
  
  <p style="color: #333; font-size: 15px; line-height: 1.6;">
    I'd be happy to send over any additional materials or hop on a quick call if that's easier.
  </p>
  
  <p style="color: #333; font-size: 15px; line-height: 1.6; margin-top: 30px;">
    Best,<br>
    {{sender_name}}<br>
    Boostify Music
  </p>
  
  <p style="color: #999; font-size: 11px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 15px;">
    <a href="{{unsubscribe_url}}" style="color: #999;">Unsubscribe</a>
  </p>
</body>
</html>
    `,
    bodyText: `
Hi {{contact_name}},

I wanted to follow up on my previous email about {{artist_name}}. Have you had a chance to check out their profile?

Here's the link again: {{landing_url}}

I'd be happy to send over any additional materials or hop on a quick call if that's easier.

Best,
{{sender_name}}
Boostify Music

Unsubscribe: {{unsubscribe_url}}
    `
  };
}
