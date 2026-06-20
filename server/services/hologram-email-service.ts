/**
 * Boostify Hologram Live Show Engine — Email Service
 *
 * Sends two emails on every new lead:
 *  1. Professional proposal to the client (from vr@boostifymusic.com)
 *  2. Lead notification copy to convoycubano@gmail.com
 *
 * Uses Brevo SMTP API.
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

const FROM_EMAIL = 'vr@boostifymusic.com';
const FROM_NAME = 'Boostify Hologram Studio';
const ADMIN_CC = 'convoycubano@gmail.com';

// ─── Brevo helper ─────────────────────────────────────────────────────────────

async function sendBrevo(
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
): Promise<void> {
  if (!BREVO_API_KEY) {
    console.warn('[HologramEmail] BREVO_API_KEY not set — skipping email to', to);
    return;
  }
  const body: Record<string, unknown> = {
    sender: { email: FROM_EMAIL, name: FROM_NAME },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };
  if (replyTo) body.replyTo = { email: replyTo };

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[HologramEmail] Brevo error', res.status, txt.slice(0, 400));
  } else {
    const data = await res.json() as any;
    console.log('[HologramEmail] Sent to', to, '— messageId:', data?.messageId);
  }
}

// ─── Budget label helper ──────────────────────────────────────────────────────

function budgetLabel(raw?: string | null): string {
  const map: Record<string, string> = {
    under_5k: 'Under $5,000',
    '5k_15k': '$5,000 – $15,000',
    '15k_50k': '$15,000 – $50,000',
    '50k_100k': '$50,000 – $100,000',
    over_100k: '$100,000+',
  };
  return raw ? (map[raw] ?? raw) : 'Not specified';
}

function clientTypeLabel(raw?: string | null): string {
  const map: Record<string, string> = {
    recording_artist: 'Recording Artist',
    music_estate: 'Music Estate / Legacy',
    record_label: 'Record Label',
    entertainment_company: 'Entertainment Company',
    festival_organizer: 'Festival Organizer',
    streaming_platform: 'Streaming Platform',
    brand_agency: 'Brand / Agency',
    film_tv: 'Film / TV Production',
    talent_agency: 'Talent Agency',
    theme_park: 'Theme Park / Attraction',
    museum_institution: 'Museum / Institution',
    other: 'Other',
  };
  return raw ? (map[raw] ?? raw) : 'Not specified';
}

function experienceLabel(raw?: string | null): string {
  const map: Record<string, string> = {
    hologram_stage: 'Hologram Stage Show',
    led_wall_show: 'LED Wall Virtual Performance',
    streaming_only: 'Streaming-Only Digital Concert',
    multi_venue_tour: 'Multi-Venue Simultaneous Tour',
    catalog_revival: 'Catalog Revival (Legacy Artist)',
    brand_event: 'Brand / Corporate Event',
    museum_installation: 'Permanent Installation',
  };
  return raw ? (map[raw] ?? raw) : 'Not specified';
}

function timelineLabel(raw?: string | null): string {
  const map: Record<string, string> = {
    asap: 'As soon as possible',
    '1_month': 'Within 1 month',
    '3_months': 'Within 3 months',
    '6_months': 'Within 6 months',
    planning: 'Early planning stage',
  };
  return raw ? (map[raw] ?? raw) : 'Not specified';
}

// ─── Recommended package helper ───────────────────────────────────────────────

function recommendedPackage(budgetRange?: string | null): {
  name: string;
  price: string;
  description: string;
} {
  if (!budgetRange || budgetRange === 'under_5k' || budgetRange === '5k_15k') {
    return {
      name: 'Digital Premiere',
      price: '$12,500',
      description: 'Basic 3D avatar, 1 virtual stage template, up to 5 songs, 1080p export, streaming-ready.',
    };
  }
  if (budgetRange === '15k_50k') {
    return {
      name: 'Hologram Pro',
      price: '$27,500',
      description: 'Photorealistic avatar, custom stage, up to 12 songs, 4K + hologram-ready output, live show control.',
    };
  }
  if (budgetRange === '50k_100k') {
    return {
      name: 'Arena Edition',
      price: '$55,000',
      description: 'Motion capture avatar, Unreal Engine 5 stage, unlimited songs, 8K multi-format, multi-venue deployment.',
    };
  }
  return {
    name: 'Legacy & Legends',
    price: '$150,000+',
    description: 'Estate-approved reconstruction, full catalog, worldwide tour infrastructure, legal & rights support.',
  };
}

// ─── Client proposal email ────────────────────────────────────────────────────

export interface HologramLeadData {
  name: string;
  email: string;
  phone?: string | null;
  companyOrArtist?: string | null;
  clientType?: string | null;
  experienceType?: string | null;
  numberOfSongs?: number | null;
  hasAvatar?: boolean | null;
  needsAvatarCreation?: boolean | null;
  budgetRange?: string | null;
  timeline?: string | null;
  message?: string | null;
}

export async function sendHologramClientProposal(lead: HologramLeadData): Promise<void> {
  const pkg = recommendedPackage(lead.budgetRange);
  const firstName = lead.name.split(' ')[0];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Hologram Show Proposal — Boostify</title>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d0d0d 0%,#1a0a00 100%);border-radius:20px 20px 0 0;padding:0;overflow:hidden;">
            <!-- Orange top bar -->
            <div style="height:4px;background:linear-gradient(90deg,#FF7A00,#FFB347,#00D4FF);"></div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:36px 40px 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <div style="font-size:11px;font-weight:700;letter-spacing:0.25em;color:#FF7A00;text-transform:uppercase;margin-bottom:8px;">Boostify Hologram Studio</div>
                        <div style="font-size:28px;font-weight:900;color:#ffffff;line-height:1.2;">Your Hologram Show<br/>Proposal is Ready</div>
                      </td>
                      <td align="right" style="vertical-align:top;">
                        <div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#FF7A00,#FFB347);display:inline-flex;align-items:center;justify-content:center;font-size:28px;line-height:56px;text-align:center;">⚡</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── GREETING ── -->
        <tr>
          <td style="background:#0d0d0d;padding:36px 40px 0;">
            <p style="margin:0 0 16px;font-size:17px;color:#e0e0e0;line-height:1.7;">
              Hi <strong style="color:#FF7A00;">${firstName}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#a0a0a0;line-height:1.8;">
              Thank you for your interest in the <strong style="color:#ffffff;">Boostify Hologram Live Show Engine</strong>. We've reviewed your request and prepared a tailored proposal for your project.
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#a0a0a0;line-height:1.8;">
              Our production team is ready to bring your vision to life — a photorealistic digital performance that can reach audiences in every city, simultaneously, without physical limitations.
            </p>
          </td>
        </tr>

        <!-- ── RECOMMENDED PACKAGE ── -->
        <tr>
          <td style="background:#0d0d0d;padding:0 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(255,122,0,0.12),rgba(255,122,0,0.04));border:1px solid rgba(255,122,0,0.35);border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:24px 28px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.2em;color:#FF7A00;text-transform:uppercase;margin-bottom:10px;">Recommended Package</div>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <div style="font-size:22px;font-weight:900;color:#ffffff;margin-bottom:4px;">${pkg.name}</div>
                        <div style="font-size:13px;color:#a0a0a0;line-height:1.6;">${pkg.description}</div>
                      </td>
                      <td align="right" style="vertical-align:top;white-space:nowrap;padding-left:16px;">
                        <div style="font-size:30px;font-weight:900;color:#FF7A00;">${pkg.price}</div>
                        <div style="font-size:11px;color:#666;text-align:right;">one-time</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── YOUR PROJECT SUMMARY ── -->
        <tr>
          <td style="background:#0d0d0d;padding:0 40px 32px;">
            <div style="font-size:13px;font-weight:700;letter-spacing:0.15em;color:#00D4FF;text-transform:uppercase;margin-bottom:16px;">Your Project Summary</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
              ${[
                ['Client Type', clientTypeLabel(lead.clientType)],
                ['Experience Type', experienceLabel(lead.experienceType)],
                ['Songs in Setlist', String(lead.numberOfSongs ?? 1)],
                ['Budget Range', budgetLabel(lead.budgetRange)],
                ['Timeline', timelineLabel(lead.timeline)],
                ['Has 3D Avatar', lead.hasAvatar ? 'Yes' : 'No'],
                ['Needs Avatar Creation', lead.needsAvatarCreation ? 'Yes' : 'No'],
              ].map(([label, value], i) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:12px 20px;font-size:12px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;width:45%;">${label}</td>
                <td style="padding:12px 20px;font-size:13px;color:#e0e0e0;">${value}</td>
              </tr>`).join('')}
              ${lead.message ? `
              <tr>
                <td colspan="2" style="padding:16px 20px;">
                  <div style="font-size:12px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Your Message</div>
                  <div style="font-size:13px;color:#c0c0c0;line-height:1.7;font-style:italic;">"${lead.message}"</div>
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

        <!-- ── WHAT HAPPENS NEXT ── -->
        <tr>
          <td style="background:#0d0d0d;padding:0 40px 32px;">
            <div style="font-size:13px;font-weight:700;letter-spacing:0.15em;color:#8B5CF6;text-transform:uppercase;margin-bottom:20px;">What Happens Next</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${[
                ['01', '#FF7A00', 'Discovery Call', 'Our production director will contact you within 24 hours to discuss your vision, timeline, and technical requirements in detail.'],
                ['02', '#00D4FF', 'Custom Proposal', 'We\'ll prepare a fully customized production plan, including stage design concepts, avatar references, and a detailed timeline.'],
                ['03', '#8B5CF6', 'Production Kickoff', 'Once approved, your dedicated production team begins work immediately — avatar construction, stage design, and performance programming.'],
                ['04', '#FF7A00', 'Go Live', 'Your hologram show is delivered, tested, and ready to perform in any venue, on any platform, in any city — simultaneously.'],
              ].map(([step, color, title, desc]) => `
              <tr>
                <td style="padding:0 0 20px;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:44px;vertical-align:top;padding-right:16px;">
                        <div style="width:40px;height:40px;border-radius:10px;background:${color}18;border:1px solid ${color}40;text-align:center;line-height:40px;font-size:13px;font-weight:900;color:${color};">${step}</div>
                      </td>
                      <td style="vertical-align:top;">
                        <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:4px;">${title}</div>
                        <div style="font-size:13px;color:#888;line-height:1.6;">${desc}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`).join('')}
            </table>
          </td>
        </tr>

        <!-- ── CTA BUTTONS ── -->
        <tr>
          <td style="background:#0d0d0d;padding:0 40px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:12px;">
                  <a href="https://calendly.com/boostifymusic/hologram-discovery" style="display:block;background:linear-gradient(135deg,#FF7A00,#FFB347);color:#000000;text-decoration:none;text-align:center;padding:16px 24px;border-radius:12px;font-size:15px;font-weight:800;letter-spacing:0.02em;">
                    📅 &nbsp; Schedule Your Discovery Call
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:12px;">
                  <a href="tel:+1-800-BOOSTIFY" style="display:block;background:rgba(0,212,255,0.08);color:#00D4FF;text-decoration:none;text-align:center;padding:16px 24px;border-radius:12px;font-size:15px;font-weight:700;border:1px solid rgba(0,212,255,0.3);">
                    📞 &nbsp; Call Our Production Team
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="mailto:vr@boostifymusic.com" style="display:block;background:rgba(139,92,246,0.08);color:#8B5CF6;text-decoration:none;text-align:center;padding:16px 24px;border-radius:12px;font-size:15px;font-weight:700;border:1px solid rgba(139,92,246,0.3);">
                    ✉️ &nbsp; Reply to This Email
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── ALL PACKAGES ── -->
        <tr>
          <td style="background:#0a0a0a;padding:32px 40px;border-top:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:13px;font-weight:700;letter-spacing:0.15em;color:#666;text-transform:uppercase;margin-bottom:20px;">All Available Packages</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${[
                ['Digital Premiere', '$12,500', '#00D4FF', 'Basic avatar, 1 stage template, up to 5 songs, 1080p, 14 days'],
                ['Hologram Pro', '$27,500', '#FF7A00', 'Photorealistic avatar, custom stage, 12 songs, 4K hologram-ready, 30 days'],
                ['Arena Edition', '$55,000', '#8B5CF6', 'Motion capture, Unreal Engine 5, unlimited songs, 8K multi-venue, 45 days'],
                ['Legacy & Legends', '$150,000+', '#FF7A00', 'Estate reconstruction, full catalog, worldwide tour, legal support'],
              ].map(([name, price, color, desc]) => `
              <tr>
                <td style="padding:0 0 12px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
                    <tr>
                      <td style="padding:14px 18px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td>
                              <div style="font-size:14px;font-weight:700;color:#ffffff;">${name}</div>
                              <div style="font-size:12px;color:#666;margin-top:3px;">${desc}</div>
                            </td>
                            <td align="right" style="white-space:nowrap;padding-left:12px;">
                              <div style="font-size:18px;font-weight:900;color:${color};">${price}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`).join('')}
            </table>
          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background:#080808;border-radius:0 0 20px 20px;padding:28px 40px;border-top:1px solid rgba(255,255,255,0.05);">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:13px;font-weight:800;color:#FF7A00;margin-bottom:4px;">BOOSTIFY HOLOGRAM STUDIO</div>
                  <div style="font-size:12px;color:#444;">vr@boostifymusic.com &nbsp;·&nbsp; boostifymusic.com</div>
                </td>
                <td align="right">
                  <div style="font-size:11px;color:#333;line-height:1.6;">
                    You received this because you<br/>submitted a request on Boostify.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;

  await sendBrevo(
    lead.email,
    `Your Hologram Show Proposal — ${pkg.name} (${pkg.price})`,
    html,
    'vr@boostifymusic.com',
  );
}

// ─── Admin lead notification ──────────────────────────────────────────────────

export async function sendHologramAdminNotification(lead: HologramLeadData): Promise<void> {
  const pkg = recommendedPackage(lead.budgetRange);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#050505;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a0500,#0d0d0d);border-radius:16px 16px 0 0;padding:0;overflow:hidden;">
            <div style="height:3px;background:linear-gradient(90deg,#FF7A00,#FFB347,#00D4FF);"></div>
            <div style="padding:28px 32px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:0.25em;color:#FF7A00;text-transform:uppercase;margin-bottom:6px;">🔔 New Lead Alert</div>
              <div style="font-size:22px;font-weight:900;color:#ffffff;">Hologram Show Request</div>
              <div style="font-size:13px;color:#666;margin-top:4px;">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</div>
            </div>
          </td>
        </tr>

        <!-- Lead info -->
        <tr>
          <td style="background:#0d0d0d;padding:28px 32px;">

            <!-- Recommended package badge -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,122,0,0.1);border:1px solid rgba(255,122,0,0.3);border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <div style="font-size:10px;color:#FF7A00;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">Recommended Package</div>
                        <div style="font-size:18px;font-weight:900;color:#ffffff;margin-top:2px;">${pkg.name}</div>
                      </td>
                      <td align="right">
                        <div style="font-size:24px;font-weight:900;color:#FF7A00;">${pkg.price}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Contact details -->
            <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#00D4FF;text-transform:uppercase;margin-bottom:12px;">Contact Details</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;margin-bottom:20px;">
              ${[
                ['Name', lead.name],
                ['Email', `<a href="mailto:${lead.email}" style="color:#00D4FF;">${lead.email}</a>`],
                ['Phone', lead.phone || '—'],
                ['Company / Artist', lead.companyOrArtist || '—'],
              ].map(([label, value]) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:10px 16px;font-size:11px;color:#555;font-weight:600;text-transform:uppercase;width:40%;">${label}</td>
                <td style="padding:10px 16px;font-size:13px;color:#e0e0e0;">${value}</td>
              </tr>`).join('')}
            </table>

            <!-- Project details -->
            <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#8B5CF6;text-transform:uppercase;margin-bottom:12px;">Project Details</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;margin-bottom:20px;">
              ${[
                ['Client Type', clientTypeLabel(lead.clientType)],
                ['Experience Type', experienceLabel(lead.experienceType)],
                ['Songs', String(lead.numberOfSongs ?? 1)],
                ['Budget Range', budgetLabel(lead.budgetRange)],
                ['Timeline', timelineLabel(lead.timeline)],
                ['Has Avatar', lead.hasAvatar ? '✅ Yes' : '❌ No'],
                ['Needs Avatar', lead.needsAvatarCreation ? '✅ Yes' : '❌ No'],
              ].map(([label, value]) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:10px 16px;font-size:11px;color:#555;font-weight:600;text-transform:uppercase;width:40%;">${label}</td>
                <td style="padding:10px 16px;font-size:13px;color:#e0e0e0;">${value}</td>
              </tr>`).join('')}
            </table>

            ${lead.message ? `
            <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#666;text-transform:uppercase;margin-bottom:10px;">Message</div>
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;font-size:13px;color:#c0c0c0;line-height:1.7;font-style:italic;">"${lead.message}"</div>
            ` : ''}

          </td>
        </tr>

        <!-- Quick actions -->
        <tr>
          <td style="background:#0a0a0a;padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:8px;">
                  <a href="mailto:${lead.email}?subject=Your Hologram Show Proposal — Boostify" style="display:block;background:linear-gradient(135deg,#FF7A00,#FFB347);color:#000;text-decoration:none;text-align:center;padding:12px;border-radius:8px;font-size:13px;font-weight:800;">
                    Reply to Lead
                  </a>
                </td>
                ${lead.phone ? `
                <td style="padding-left:8px;">
                  <a href="tel:${lead.phone}" style="display:block;background:rgba(0,212,255,0.1);color:#00D4FF;text-decoration:none;text-align:center;padding:12px;border-radius:8px;font-size:13px;font-weight:700;border:1px solid rgba(0,212,255,0.3);">
                    Call ${lead.phone}
                  </a>
                </td>` : ''}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#080808;border-radius:0 0 16px 16px;padding:16px 32px;border-top:1px solid rgba(255,255,255,0.04);">
            <div style="font-size:11px;color:#333;text-align:center;">Boostify Hologram Studio · vr@boostifymusic.com · boostifymusic.com</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendBrevo(
    ADMIN_CC,
    `🔔 New Hologram Lead: ${lead.name} — ${pkg.name} (${pkg.price})`,
    html,
    lead.email,
  );
}
