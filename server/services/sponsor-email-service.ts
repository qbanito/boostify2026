/**
 * Sponsor Email Service
 * Generates professional HTML sponsor proposals and sends them via Brevo.
 * Templates: Sponsorship, Collaboration, Product Placement, Affiliate, Endorsement.
 */

import { db } from '../db';
import { sponsorEmailLog, sponsorDeals, sponsorContacts, sponsorCampaigns, users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Brevo API
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = 'partnerships@boostifymusic.com';
const FROM_NAME = 'Boostify Music Partnerships';
const PLATFORM_URL = process.env.SPONSOR_PROPOSAL_BASE_URL || 'https://boostifymusic.com';

if (!BREVO_API_KEY) {
  console.warn('⚠️ BREVO_API_KEY is not set — sponsor emails will fail. Set it in your environment variables.');
}

interface ArtistData {
  name: string;
  genre: string;
  biography: string;
  profileImage: string;
  slug: string;
  instagramFollowers?: number;
  spotifyListeners?: number;
  youtubeViews?: number;
  totalSongs?: number;
}

interface SponsorProposalData {
  artist: ArtistData;
  brandName: string;
  contactName?: string;
  dealType: 'sponsorship' | 'collaboration' | 'endorsement' | 'product_placement' | 'affiliate';
  budgetMin?: number;
  budgetMax?: number;
  customMessage?: string;
  dealId?: number;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email via Brevo API
 */
async function sendBrevoEmail(to: string, toName: string, subject: string, htmlContent: string): Promise<EmailResult> {
  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent,
      }),
    });

    const result = await response.json();
    if (result.messageId) {
      return { success: true, messageId: result.messageId };
    }
    console.error('❌ Brevo sponsor email error:', result);
    return { success: false, error: result.message || JSON.stringify(result) };
  } catch (error: any) {
    console.error('❌ Brevo sponsor email error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate professional HTML proposal email
 */
export function generateProposalHtml(data: SponsorProposalData): string {
  const { artist, brandName, contactName, dealType, budgetMin, budgetMax, customMessage, dealId } = data;
  const proposalUrl = dealId ? `${PLATFORM_URL}/api/sponsors/track/click/${dealId}?dest=${encodeURIComponent(`${PLATFORM_URL}/sponsor/proposal/${dealId}`)}` : `${PLATFORM_URL}/artist/${artist.slug}`;
  const artistUrl = dealId ? `${PLATFORM_URL}/api/sponsors/track/click/${dealId}?dest=${encodeURIComponent(`${PLATFORM_URL}/artist/${artist.slug}`)}` : `${PLATFORM_URL}/artist/${artist.slug}`;
  const directProposalUrl = dealId ? `${PLATFORM_URL}/sponsor/proposal/${dealId}` : `${PLATFORM_URL}/artist/${artist.slug}`;

  const dealTypeLabels: Record<string, { title: string; description: string; icon: string }> = {
    sponsorship: {
      title: 'Sponsorship Proposal',
      description: `We invite ${brandName} to become an official sponsor for ${artist.name}'s upcoming projects and events.`,
      icon: '💎',
    },
    collaboration: {
      title: 'Brand Collaboration',
      description: `An exciting partnership between ${brandName} and ${artist.name} to create unique co-branded content and experiences.`,
      icon: '🤝',
    },
    endorsement: {
      title: 'Artist Endorsement',
      description: `${artist.name} as an official ambassador and face of ${brandName}'s initiatives.`,
      icon: '⭐',
    },
    product_placement: {
      title: 'Product Placement',
      description: `Feature ${brandName} products in ${artist.name}'s music videos, social content, and live performances.`,
      icon: '🎬',
    },
    affiliate: {
      title: 'Affiliate Partnership',
      description: `Commission-based partnership where ${artist.name} promotes ${brandName} to a highly engaged audience.`,
      icon: '📈',
    },
  };

  const deal = dealTypeLabels[dealType] || dealTypeLabels.sponsorship;
  const greeting = contactName ? `Dear ${contactName}` : `Dear ${brandName} Team`;
  const budgetRange = budgetMin && budgetMax
    ? `$${budgetMin.toLocaleString()} — $${budgetMax.toLocaleString()}`
    : budgetMin ? `Starting from $${budgetMin.toLocaleString()}` : 'Custom — Let\'s discuss';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${deal.title} — ${artist.name} x ${brandName}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:20px;overflow:hidden;box-shadow:0 25px 80px rgba(0,0,0,0.6);">

        <!-- Header Gradient -->
        <tr><td style="background:linear-gradient(135deg,#F97316 0%,#EA580C 50%,#C2410C 100%);padding:35px 40px;text-align:center;">
          <div style="font-size:13px;letter-spacing:3px;color:rgba(255,255,255,0.8);text-transform:uppercase;margin-bottom:8px;">Boostify Music</div>
          <h1 style="margin:0;color:white;font-size:26px;font-weight:800;letter-spacing:-0.5px;">${deal.icon} ${deal.title}</h1>
          <div style="margin-top:8px;color:rgba(255,255,255,0.9);font-size:15px;">${artist.name} × ${brandName}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px;">

          <!-- Greeting -->
          <p style="color:#ffffff;font-size:17px;line-height:1.6;margin:0 0 20px;">${greeting},</p>
          <p style="color:#a0a0a0;font-size:15px;line-height:1.7;margin:0 0 25px;">
            We're reaching out on behalf of <strong style="color:#F97316;">${artist.name}</strong>, 
            a ${artist.genre} artist with a rapidly growing and highly engaged audience. 
            ${deal.description}
          </p>
          ${customMessage ? `<p style="color:#a0a0a0;font-size:15px;line-height:1.7;margin:0 0 25px;">${customMessage}</p>` : ''}

          <!-- Artist Card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;margin-bottom:30px;border:1px solid #333;">
            <tr>
              <td style="width:140px;padding:20px;">
                ${artist.profileImage
                  ? `<img src="${artist.profileImage}" alt="${artist.name}" style="width:120px;height:120px;border-radius:16px;object-fit:cover;border:3px solid #F97316;" />`
                  : `<div style="width:120px;height:120px;border-radius:16px;background:#333;display:flex;align-items:center;justify-content:center;">🎵</div>`
                }
              </td>
              <td style="padding:20px 20px 20px 0;vertical-align:top;">
                <h2 style="margin:0 0 6px;color:#ffffff;font-size:22px;">${artist.name}</h2>
                <div style="color:#F97316;font-size:14px;font-weight:600;margin-bottom:10px;">${artist.genre}</div>
                <p style="color:#888;font-size:13px;line-height:1.5;margin:0;">
                  ${(artist.biography || '').slice(0, 200)}${(artist.biography || '').length > 200 ? '...' : ''}
                </p>
              </td>
            </tr>
          </table>

          <!-- Stats Grid -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;">
            <tr>
              <td style="width:33%;padding:4px;">
                <div style="background:#1a1a1a;border-radius:12px;padding:18px;text-align:center;border:1px solid #333;">
                  <div style="color:#F97316;font-size:24px;font-weight:800;">${artist.instagramFollowers ? (artist.instagramFollowers / 1000).toFixed(1) + 'K' : '—'}</div>
                  <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Instagram</div>
                </div>
              </td>
              <td style="width:33%;padding:4px;">
                <div style="background:#1a1a1a;border-radius:12px;padding:18px;text-align:center;border:1px solid #333;">
                  <div style="color:#10B981;font-size:24px;font-weight:800;">${artist.spotifyListeners ? (artist.spotifyListeners / 1000).toFixed(1) + 'K' : '—'}</div>
                  <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Spotify</div>
                </div>
              </td>
              <td style="width:33%;padding:4px;">
                <div style="background:#1a1a1a;border-radius:12px;padding:18px;text-align:center;border:1px solid #333;">
                  <div style="color:#EF4444;font-size:24px;font-weight:800;">${artist.youtubeViews ? (artist.youtubeViews / 1000).toFixed(1) + 'K' : '—'}</div>
                  <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">YouTube</div>
                </div>
              </td>
            </tr>
          </table>

          <!-- Budget Range -->
          <div style="background:linear-gradient(135deg,#F9731615,#EA580C10);border:1px solid #F9731640;border-radius:14px;padding:22px;text-align:center;margin-bottom:30px;">
            <div style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Investment Range</div>
            <div style="color:#F97316;font-size:26px;font-weight:800;">${budgetRange}</div>
            <div style="color:#666;font-size:12px;margin-top:6px;">Flexible packages available</div>
          </div>

          <!-- CTA Buttons -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;">
            <tr>
              <td style="width:50%;padding:0 6px 0 0;">
                <a href="${proposalUrl}" style="display:block;background:linear-gradient(135deg,#F97316,#EA580C);color:white;text-decoration:none;padding:16px;border-radius:12px;text-align:center;font-weight:700;font-size:15px;">
                  ✅ View Full Proposal
                </a>
              </td>
              <td style="width:50%;padding:0 0 0 6px;">
                <a href="${artistUrl}" style="display:block;background:#1a1a1a;color:#F97316;text-decoration:none;padding:16px;border-radius:12px;text-align:center;font-weight:700;font-size:15px;border:1px solid #F9731650;">
                  🎵 Artist Profile
                </a>
              </td>
            </tr>
          </table>

          <!-- What's Included -->
          <div style="margin-bottom:30px;">
            <h3 style="color:#ffffff;font-size:16px;margin:0 0 15px;">What's Included:</h3>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${[
                { icon: '📱', text: 'Social media mentions and stories' },
                { icon: '🎵', text: 'Brand integration in music content' },
                { icon: '📊', text: 'Detailed campaign analytics report' },
                { icon: '🎥', text: 'Professional photo/video assets' },
                { icon: '🎪', text: 'Live event brand presence' },
                { icon: '📈', text: 'Monthly performance reporting' },
              ].map(item => `
              <tr>
                <td style="padding:6px 0;">
                  <div style="display:flex;align-items:center;">
                    <span style="font-size:16px;margin-right:10px;">${item.icon}</span>
                    <span style="color:#a0a0a0;font-size:14px;">${item.text}</span>
                  </div>
                </td>
              </tr>
              `).join('')}
            </table>
          </div>

          <!-- Trust Badge -->
          <div style="text-align:center;padding:20px;background:#0a0a0a;border-radius:12px;">
            <div style="color:#666;font-size:12px;margin-bottom:6px;">Powered by</div>
            <div style="color:#F97316;font-size:18px;font-weight:800;">Boostify Music</div>
            <div style="color:#555;font-size:11px;margin-top:4px;">Trusted platform for artist-brand partnerships</div>
          </div>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0a0a0a;padding:25px 40px;border-top:1px solid #222;">
          <p style="color:#555;font-size:11px;line-height:1.6;margin:0;text-align:center;">
            This email was sent by Boostify Music on behalf of ${artist.name}.<br>
            © ${new Date().getFullYear()} Boostify Music LLC. All rights reserved.<br>
            <a href="${PLATFORM_URL}" style="color:#F97316;text-decoration:none;">boostifymusic.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
  ${dealId ? `<img src="${PLATFORM_URL}/api/sponsors/track/open/${dealId}" width="1" height="1" alt="" style="display:none;" />` : ''}
</body>
</html>`;
}

/**
 * Generate the proposal email subject line
 */
export function generateProposalSubject(data: SponsorProposalData): string {
  const subjects: Record<string, string> = {
    sponsorship: `Sponsorship Opportunity — ${data.artist.name} x ${data.brandName}`,
    collaboration: `Brand Collaboration Proposal — ${data.artist.name}`,
    endorsement: `Endorsement Partnership — ${data.artist.name}`,
    product_placement: `Product Placement Opportunity — ${data.artist.name}`,
    affiliate: `Affiliate Partnership — ${data.artist.name} x ${data.brandName}`,
  };
  return subjects[data.dealType] || subjects.sponsorship;
}

/**
 * Generate A/B test subject line variants for a campaign
 * Returns an array of 2-3 subject variants
 */
export function generateSubjectVariants(data: SponsorProposalData): Array<{ variant: string; subject: string }> {
  const base = generateProposalSubject(data);
  const variants: Array<{ variant: string; subject: string }> = [
    { variant: 'A', subject: base },
    { variant: 'B', subject: `${data.artist.name} wants to partner with ${data.brandName} 🎵` },
    { variant: 'C', subject: `Quick question about a ${data.dealType} with ${data.artist.name}` },
  ];
  return variants;
}

/**
 * Send a sponsor proposal email and log it
 */
export async function sendSponsorProposal(params: {
  campaignId?: number;
  dealId?: number;
  sponsorContactId: number;
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  emailType?: 'proposal' | 'follow_up' | 'counter_offer' | 'acceptance' | 'invoice' | 'thank_you';
}): Promise<EmailResult> {
  const result = await sendBrevoEmail(
    params.toEmail,
    params.toName || params.toEmail,
    params.subject,
    params.htmlContent,
  );

  // Log the email
  await db.insert(sponsorEmailLog).values({
    campaignId: params.campaignId || null,
    dealId: params.dealId || null,
    sponsorContactId: params.sponsorContactId,
    toEmail: params.toEmail,
    toName: params.toName || null,
    subject: params.subject,
    emailType: params.emailType || 'proposal',
    status: result.success ? 'sent' : 'failed',
    brevoMessageId: result.messageId || null,
    sentAt: result.success ? new Date() : null,
    errorMessage: result.error || null,
  });

  // Update contact stats
  if (result.success) {
    const contact = await db.select().from(sponsorContacts).where(eq(sponsorContacts.id, params.sponsorContactId)).limit(1);
    if (contact[0]) {
      await db.update(sponsorContacts)
        .set({
          emailsSent: (contact[0].emailsSent || 0) + 1,
          lastContactedAt: new Date(),
          status: contact[0].status === 'new' ? 'contacted' : contact[0].status,
          updatedAt: new Date(),
        })
        .where(eq(sponsorContacts.id, params.sponsorContactId));
    }
  }

  return result;
}

/**
 * Send follow-up email for an existing deal
 */
export async function sendFollowUp(dealId: number, type: 'follow_up' | 'thank_you'): Promise<EmailResult> {
  const deal = await db.select().from(sponsorDeals).where(eq(sponsorDeals.id, dealId)).limit(1);
  if (!deal[0]) return { success: false, error: 'Deal not found' };

  const contact = await db.select().from(sponsorContacts).where(eq(sponsorContacts.id, deal[0].sponsorContactId)).limit(1);
  if (!contact[0]?.contactEmail) return { success: false, error: 'Contact has no email' };

  const artist = await db.select().from(users).where(eq(users.id, deal[0].artistId)).limit(1);
  const artistName = artist[0]?.artistName || artist[0]?.username || 'Artist';

  const subject = type === 'follow_up'
    ? `Following up — ${deal[0].title}`
    : `Thank you! — ${deal[0].title}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',sans-serif;background:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#F97316,#C2410C);padding:30px;text-align:center;">
          <h1 style="margin:0;color:white;font-size:22px;">${type === 'follow_up' ? '📩 Quick Follow-Up' : '🙏 Thank You!'}</h1>
        </td></tr>
        <tr><td style="padding:35px;">
          <p style="color:#fff;font-size:16px;margin:0 0 15px;">Hi ${contact[0].contactName || contact[0].brandName},</p>
          ${type === 'follow_up'
            ? `<p style="color:#aaa;font-size:14px;line-height:1.7;">We wanted to follow up on our recent proposal for the <strong style="color:#F97316;">${deal[0].title}</strong> partnership. We'd love to discuss how ${artistName} and ${contact[0].brandName} can create something incredible together.</p>`
            : `<p style="color:#aaa;font-size:14px;line-height:1.7;">Thank you for your interest in the <strong style="color:#F97316;">${deal[0].title}</strong> partnership! We're excited to move forward and create an amazing collaboration between ${artistName} and ${contact[0].brandName}.</p>`
          }
          <div style="text-align:center;margin-top:25px;">
            <a href="${PLATFORM_URL}/sponsor/proposal/${dealId}" style="display:inline-block;background:#F97316;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;">View Proposal Details</a>
          </div>
        </td></tr>
        <tr><td style="background:#0a0a0a;padding:20px;text-align:center;border-top:1px solid #222;">
          <p style="color:#555;font-size:11px;margin:0;">© ${new Date().getFullYear()} Boostify Music LLC</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return sendSponsorProposal({
    dealId,
    sponsorContactId: contact[0].id,
    toEmail: contact[0].contactEmail,
    toName: contact[0].contactName || undefined,
    subject,
    htmlContent: html,
    emailType: type,
  });
}
