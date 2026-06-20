/**
 * Intelligent Email Templates for Investor Outreach
 * Highly personalized, professional emails for music tech investors
 * Includes Revenue Calculator projections for business opportunity
 * 
 * Design System: Modern, clean, professional investor-focused
 */

import { InvestorLead, EmailTemplate } from './types';

// ============================================
// EMAIL DESIGN SYSTEM
// ============================================
const EMAIL_STYLES = {
  // Colors
  primary: '#f97316',      // Orange
  secondary: '#10b981',    // Green
  dark: '#1a1a1a',
  light: '#f8fafc',
  gray: '#64748b',
  
  // Gradients
  headerGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
  accentGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  darkGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
};

// Base HTML template wrapper with professional styling
function wrapInEmailTemplate(content: string, preheader: string = ''): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Boostify Music - Investment Opportunity</title>
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
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    
    /* Base */
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f1f5f9; }
    
    /* Typography */
    .email-body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding: 20px !important; }
      .mobile-center { text-align: center !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9;">
  <!-- Preheader (hidden preview text) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${preheader}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Email Container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%); padding: 30px 40px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      🎵 BOOSTIFY
                    </div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 2px; margin-top: 5px;">
                      AI-Powered Music Platform
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Email Content -->
          <tr>
            <td class="mobile-padding" style="padding: 40px;">
              ${content}
            </td>
          </tr>
          
          <!-- CTA Section -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="https://calendly.com/convoycubano/boostify-music" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                            📅 Schedule a Call
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://boostifymusic.com/investors-dashboard" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                            📊 Investor Dashboard
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://wefunder.com/boostify.music" style="display: inline-block; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                            💰 Invest Now
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Signature -->
          <tr>
            <td style="padding: 0 40px 30px 40px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 25px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #1a1a1a;">Best regards,</p>
                    <p style="margin: 0 0 3px 0; font-size: 16px; font-weight: 700; color: #1a1a1a;">Neiver Alvarez</p>
                    <p style="margin: 0; font-size: 13px; color: #64748b;">CEO & Founder, Boostify Music</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #ffffff;">
                      Boostify Music
                    </p>
                    <p style="margin: 0 0 15px 0; font-size: 11px; color: #94a3b8;">
                      A subsidiary of <strong>Omnia Strategics Holding Corporation</strong><br>
                      Incorporated in Delaware, USA
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 10px;">
                          <a href="mailto:investorsrelations@boostifymusic.com" style="font-size: 12px; color: #f97316; text-decoration: none;">
                            ✉️ investorsrelations@boostifymusic.com
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 15px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.6;">
                      📍 1000 Brickell Ave, Office #75, Miami, FL 33131<br>
                      📞 +1 (786) 987-6934 &nbsp;|&nbsp; 💬 WhatsApp: +1 (786) 543-2478
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top: 15px;">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="https://boostifymusic.com" style="font-size: 11px; color: #f97316; text-decoration: none;">🌐 boostifymusic.com</a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://wefunder.com/boostify.music" style="font-size: 11px; color: #10b981; text-decoration: none;">💰 wefunder.com/boostify.music</a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://calendly.com/convoycubano/boostify-music" style="font-size: 11px; color: #60a5fa; text-decoration: none;">📅 Schedule Meeting</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        <!-- /Main Card -->
        
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================
// REVENUE CALCULATOR DATA (From Pitch Deck)
// ============================================
export const REVENUE_PROJECTIONS = {
  year1: {
    artists: 500,
    avgSubscription: 29,
    videoRevenue: 15000,
    nftRevenue: 5000,
    mrr: 14500,
    arr: 174000,
  },
  year2: {
    artists: 5000,
    avgSubscription: 35,
    videoRevenue: 150000,
    nftRevenue: 75000,
    mrr: 175000,
    arr: 2100000,
  },
  year3: {
    artists: 25000,
    avgSubscription: 39,
    videoRevenue: 750000,
    nftRevenue: 500000,
    mrr: 975000,
    arr: 11700000,
  },
  year5: {
    artists: 100000,
    avgSubscription: 45,
    mrr: 4500000,
    arr: 54000000,
  },
  investmentMultiple: '10x-15x',
  valuation: '$5.5M cap',
  minInvestment: '$100',
  targetRaise: '$124K',
};

// ============================================
// EMAIL TEMPLATE SYSTEM
// ============================================

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  // ============================================
  // COLD OUTREACH - VARIANT A (Direct Pitch)
  // ============================================
  cold_outreach_direct: {
    id: 'cold_outreach_direct',
    name: 'Cold Outreach - Direct Pitch',
    subject: '{{firstName}}, Transforming How Independent Artists Build Careers',
    preheader: 'AI-powered music platform raising seed round on Wefunder',
    category: 'cold_outreach',
    abVariant: 'A',
    variables: ['firstName', 'company', 'personalHook', 'relevantInvestment'],
    htmlContent: ``,
    textContent: ``,
  },

  // ============================================
  // COLD OUTREACH - VARIANT B (Problem-First)
  // ============================================
  cold_outreach_problem: {
    id: 'cold_outreach_problem',
    name: 'Cold Outreach - Problem First',
    subject: 'The $43B Problem No One Is Solving for Musicians',
    preheader: 'AI-powered solution now raising on Wefunder',
    category: 'cold_outreach',
    abVariant: 'B',
    variables: ['firstName', 'company', 'personalHook'],
    htmlContent: ``,
    textContent: ``,
  },

  // ============================================
  // COLD OUTREACH - VARIANT C (Revenue Focus)
  // ============================================
  cold_outreach_revenue: {
    id: 'cold_outreach_revenue',
    name: 'Cold Outreach - Revenue Projections',
    subject: '{{firstName}} — $54M ARR Projection in Music Tech',
    preheader: 'See the numbers behind our growth model',
    category: 'cold_outreach',
    abVariant: 'C',
    variables: ['firstName', 'company', 'personalHook'],
    htmlContent: ``,
    textContent: ``,
  },

  // ============================================
  // COLD OUTREACH - VARIANT D (Social Proof)
  // ============================================
  cold_outreach_social: {
    id: 'cold_outreach_social',
    name: 'Cold Outreach - Social Proof',
    subject: 'Why Artists Are Choosing Boostify Over Traditional Labels',
    preheader: 'Join the movement transforming music',
    category: 'cold_outreach',
    abVariant: 'D',
    variables: ['firstName', 'company', 'personalHook'],
    htmlContent: ``,
    textContent: ``,
  },

  // ============================================
  // COLD OUTREACH - VARIANT E (Urgency/FOMO)
  // ============================================
  cold_outreach_urgency: {
    id: 'cold_outreach_urgency',
    name: 'Cold Outreach - Limited Opportunity',
    subject: '{{firstName}}, Seed Round Filling Fast — $5.5M Valuation Cap',
    preheader: 'Limited allocation remaining at this valuation',
    category: 'cold_outreach',
    abVariant: 'E',
    variables: ['firstName', 'company'],
    htmlContent: ``,
    textContent: ``,
  },

  // ============================================
  // WARM INTRO - VC/Angel Focus
  // ============================================
  warm_vc_intro: {
    id: 'warm_vc_intro',
    name: 'VC/Angel Warm Introduction',
    subject: '{{firstName}} — Quick Question About Music Tech Investments',
    preheader: 'Saw your work with {{relevantInvestment}}',
    category: 'warm_intro',
    variables: ['firstName', 'company', 'relevantInvestment', 'personalHook'],
    htmlContent: ``,
    textContent: ``,
  },

  // ============================================
  // RECORD LABEL EXECUTIVE
  // ============================================
  record_label_exec: {
    id: 'record_label_exec',
    name: 'Record Label Executive',
    subject: '{{firstName}}, New Tech That Could Change Artist Development',
    preheader: 'AI tools designed for the modern music industry',
    category: 'cold_outreach',
    variables: ['firstName', 'company', 'personalHook'],
    htmlContent: ``,
    textContent: ``,
  },

  // ============================================
  // FOLLOW UP - 3 Days
  // ============================================
  follow_up_3d: {
    id: 'follow_up_3d',
    name: 'Follow Up - 3 Days',
    subject: 'Re: Quick follow-up — Boostify Music',
    preheader: 'Just bumping this to the top',
    category: 'follow_up',
    variables: ['firstName', 'originalSubject'],
    htmlContent: ``,
    textContent: ``,
  },

  // ============================================
  // FOLLOW UP - 7 Days
  // ============================================
  follow_up_7d: {
    id: 'follow_up_7d',
    name: 'Follow Up - 7 Days',
    subject: '{{firstName}} — One More Thing on Boostify 🎵',
    preheader: 'New development I wanted to share',
    category: 'follow_up',
    variables: ['firstName'],
    htmlContent: ``,
    textContent: ``,
  },

  // ============================================
  // FOLLOW UP - 10 Days (Value Add)
  // ============================================
  follow_up_10d: {
    id: 'follow_up_10d',
    name: 'Follow Up - 10 Days Value Add',
    subject: 'Thought of you — Music Industry Report 📊',
    preheader: 'Sharing some industry insights',
    category: 'follow_up',
    variables: ['firstName', 'company'],
    htmlContent: ``,
    textContent: ``,
  },

  // ============================================
  // FOLLOW UP - 14 Days (Break-up)
  // ============================================
  follow_up_14d: {
    id: 'follow_up_14d',
    name: 'Follow Up - 14 Days Breakup',
    subject: '{{firstName}} — Closing the Loop 👋',
    preheader: 'Last reach out',
    category: 'follow_up',
    variables: ['firstName', 'company'],
    htmlContent: ``,
    textContent: ``,
  },

  // ============================================
  // FOLLOW UP - 21 Days (Hail Mary)
  // ============================================
  follow_up_21d: {
    id: 'follow_up_21d',
    name: 'Follow Up - 21 Days Hail Mary',
    subject: 'Wrong person at {{company}}?',
    preheader: 'Quick question',
    category: 'follow_up',
    variables: ['firstName', 'company'],
    htmlContent: ``,
    textContent: ``,
  },
};

// ============================================
// GENERATE PERSONALIZED EMAIL
// ============================================
export function generatePersonalizedEmail(
  lead: InvestorLead,
  templateId: string
): { subject: string; html: string; text: string } {
  const template = EMAIL_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  // Generate personalized hook based on lead data
  const personalHook = generatePersonalHook(lead);
  const relevantInvestment = lead.portfolioCompanies?.[0] || lead.investmentFocus?.[0] || 'music technology';

  // Prepare variables
  const variables: Record<string, string> = {
    firstName: lead.firstName || 'there',
    lastName: lead.lastName || '',
    fullName: lead.fullName || lead.firstName || 'there',
    company: lead.company || 'your company',
    title: lead.title || '',
    personalHook,
    relevantInvestment,
    recentNews: lead.personalizedData?.recentNews || '',
    originalSubject: 'Transforming How Independent Artists Build Careers',
  };

  // Generate the full email content
  const emailContent = generateEmailContent(lead, templateId, variables);

  // Replace variables in subject
  let subject = template.subject;
  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  return {
    subject,
    html: emailContent.html,
    text: emailContent.text,
  };
}

// ============================================
// GENERATE PERSONAL HOOK
// ============================================
function generatePersonalHook(lead: InvestorLead): string {
  // Priority 1: Recent news
  if (lead.personalizedData?.recentNews) {
    return `I noticed the recent news about ${lead.personalizedData.recentNews.substring(0, 50)}...`;
  }

  // Priority 2: Portfolio companies
  if (lead.portfolioCompanies && lead.portfolioCompanies.length > 0) {
    return `I've been following ${lead.company}'s work with ${lead.portfolioCompanies[0]}, and I thought you might be interested in...`;
  }

  // Priority 3: Investment focus
  if (lead.investmentFocus && lead.investmentFocus.length > 0) {
    return `Given ${lead.company}'s focus on ${lead.investmentFocus[0]}, I wanted to share something that aligns perfectly with your thesis...`;
  }

  // Priority 4: Industry-based
  if (lead.industry.toLowerCase().includes('music') || lead.industry.toLowerCase().includes('entertainment')) {
    return `As someone deeply embedded in the music industry, you've likely seen the challenges independent artists face...`;
  }

  // Priority 5: Title-based
  if (lead.title.toLowerCase().includes('partner') || lead.title.toLowerCase().includes('investor')) {
    return `Your track record in identifying breakthrough companies caught my attention...`;
  }

  // Default hook
  return `I came across your profile while researching leaders in the music tech space...`;
}

// ============================================
// GENERATE FULL EMAIL CONTENT
// ============================================
function generateEmailContent(
  lead: InvestorLead,
  templateId: string,
  variables: Record<string, string>
): { html: string; text: string } {
  const isVC = lead.title.toLowerCase().includes('partner') || 
               lead.title.toLowerCase().includes('investor') ||
               lead.industry.toLowerCase().includes('venture');
  
  const isRecordLabel = lead.industry.toLowerCase().includes('music') ||
                        lead.company.toLowerCase().includes('record') ||
                        lead.company.toLowerCase().includes('music');

  // Select the appropriate email body based on template
  let emailBody: { html: string; text: string };

  // Handle specific templates - map revenue/social/urgency to appropriate generators
  if (templateId === 'cold_outreach_revenue' || templateId === 'cold_outreach_social' || templateId === 'cold_outreach_urgency') {
    // These variants use the generic investor email with different copy
    emailBody = generateGenericInvestorEmail(lead, variables);
  } else if (templateId.includes('follow_up')) {
    emailBody = generateFollowUpEmail(lead, variables, templateId);
  } else if (isVC) {
    emailBody = generateVCEmail(lead, variables);
  } else if (isRecordLabel) {
    emailBody = generateRecordLabelEmail(lead, variables);
  } else {
    emailBody = generateGenericInvestorEmail(lead, variables);
  }

  return emailBody;
}

// ============================================
// VC/ANGEL INVESTOR EMAIL
// ============================================
function generateVCEmail(lead: InvestorLead, vars: Record<string, string>): { html: string; text: string } {
  const text = `Hi ${vars.firstName},

${vars.personalHook}

I'm the founder of Boostify Music — an AI-powered platform that's transforming how independent artists create, distribute, and monetize their music. Think of us as the "Shopify for musicians," but with cutting-edge AI at the core.

THE OPPORTUNITY:
• $43.6B TAM in music tech (growing 18.5% CAGR)
• 80% of artists struggle with distribution and promotion
• We're solving this with AI-generated music videos, smart distribution, and blockchain royalties

TRACTION:
• Live platform with early adopters
• AI video generation producing professional content in minutes
• Integrated blockchain for transparent royalty payments

INVESTMENT DETAILS:
→ $124K target | $5.5M valuation cap
→ Post-Money SAFE | $100 minimum investment
→ 10x-15x projected return

Given ${vars.company}'s focus on ${vars.relevantInvestment}, I'd love to get your perspective on our approach. Would you have 15 minutes this week for a quick call?

📅 Schedule a call: https://calendly.com/convoycubano/boostify-music
📊 Investor Dashboard: https://boostifymusic.com/investors-dashboard
💰 Invest Now: https://wefunder.com/boostify.music

Best regards,

Neiver Alvarez
CEO & Founder, Boostify Music

---
Boostify Music — A subsidiary of Omnia Strategics Holding Corporation
Incorporated in Delaware, USA
📍 1000 Brickell Ave, Office #75, Miami, FL 33131
📞 +1 (786) 987-6934 | 💬 WhatsApp: +1 (786) 543-2478
✉️ investorsrelations@boostifymusic.com`;

  const emailContent = `
    <!-- Greeting -->
    <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 15px 0;">
      Hi <strong>${vars.firstName}</strong>,
    </p>
    
    <!-- Personal Hook -->
    <p style="font-size: 15px; color: #475569; margin: 0 0 20px 0; line-height: 1.7;">
      ${vars.personalHook}
    </p>
    
    <!-- Introduction -->
    <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 25px 0; line-height: 1.7;">
      I'm the founder of <strong style="color: #f97316;">Boostify Music</strong> — an AI-powered platform that's transforming how independent artists create, distribute, and monetize their music. Think of us as the <em>"Shopify for musicians,"</em> but with cutting-edge AI at the core.
    </p>
    
    <!-- Stats Cards -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px;">
      <tr>
        <td style="padding: 4px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 12px;">
            <tr>
              <td style="padding: 20px; text-align: center;">
                <div style="font-size: 28px; font-weight: 800; color: #ffffff;">$43.6B</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px;">TAM</div>
              </td>
              <td style="padding: 20px; text-align: center; border-left: 1px solid rgba(255,255,255,0.2);">
                <div style="font-size: 28px; font-weight: 800; color: #ffffff;">18.5%</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px;">CAGR</div>
              </td>
              <td style="padding: 20px; text-align: center; border-left: 1px solid rgba(255,255,255,0.2);">
                <div style="font-size: 28px; font-weight: 800; color: #ffffff;">80%</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px;">Underserved</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- The Opportunity Section -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #f97316;">
      <tr>
        <td style="padding: 25px;">
          <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 700; color: #1a1a1a;">
            🎯 THE OPPORTUNITY
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #475569;">
                <span style="color: #10b981; font-weight: 600;">✓</span> &nbsp; <strong>$43.6B market</strong> growing at 18.5% CAGR
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #475569;">
                <span style="color: #10b981; font-weight: 600;">✓</span> &nbsp; <strong>80% of independent artists</strong> struggle with distribution & promotion
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #475569;">
                <span style="color: #10b981; font-weight: 600;">✓</span> &nbsp; Solving with <strong>AI videos, smart distribution, blockchain royalties</strong>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Traction Section -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px;">
      <tr>
        <td>
          <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 700; color: #1a1a1a;">
            📈 TRACTION & PRODUCT
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="50%" style="padding: 10px; vertical-align: top;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <tr>
                    <td style="padding: 18px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 8px;">🎬</div>
                      <div style="font-size: 13px; font-weight: 600; color: #1a1a1a;">AI Video Generation</div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Pro videos in minutes</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td width="50%" style="padding: 10px; vertical-align: top;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <tr>
                    <td style="padding: 18px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 8px;">⛓️</div>
                      <div style="font-size: 13px; font-weight: 600; color: #1a1a1a;">Blockchain Royalties</div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">100% transparent payments</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding: 10px; vertical-align: top;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <tr>
                    <td style="padding: 18px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 8px;">📡</div>
                      <div style="font-size: 13px; font-weight: 600; color: #1a1a1a;">Smart Distribution</div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">All platforms, one click</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td width="50%" style="padding: 10px; vertical-align: top;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <tr>
                    <td style="padding: 18px; text-align: center;">
                      <div style="font-size: 24px; margin-bottom: 8px;">🎨</div>
                      <div style="font-size: 13px; font-weight: 600; color: #1a1a1a;">MotionDNA™</div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">AI visual identity</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Investment Details Box -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px;">
      <tr>
        <td style="padding: 25px;">
          <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 700; color: #ffffff;">
            💰 INVESTMENT OPPORTUNITY
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="33%" style="padding: 10px; text-align: center;">
                <div style="font-size: 22px; font-weight: 800; color: #f97316;">$124K</div>
                <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Target Raise</div>
              </td>
              <td width="33%" style="padding: 10px; text-align: center; border-left: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 22px; font-weight: 800; color: #10b981;">$5.5M</div>
                <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Valuation Cap</div>
              </td>
              <td width="33%" style="padding: 10px; text-align: center; border-left: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 22px; font-weight: 800; color: #60a5fa;">$100</div>
                <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Minimum</div>
              </td>
            </tr>
          </table>
          <p style="margin: 15px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
            Post-Money SAFE • 10x-15x Projected Return
          </p>
        </td>
      </tr>
    </table>
    
    <!-- Personalized CTA -->
    <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 20px 0; line-height: 1.7;">
      Given <strong>${vars.company}'s</strong> focus on <strong>${vars.relevantInvestment}</strong>, I'd love to get your perspective on our approach. <strong>Would you have 15 minutes this week for a quick call?</strong>
    </p>
  `;

  const html = wrapInEmailTemplate(emailContent, 'AI-powered music platform raising seed round on Wefunder');

  return { html, text };
}

// ============================================
// RECORD LABEL EXECUTIVE EMAIL
// ============================================
function generateRecordLabelEmail(lead: InvestorLead, vars: Record<string, string>): { html: string; text: string } {
  const text = `Hi ${vars.firstName},

${vars.personalHook}

As someone at ${vars.company}, you understand the challenges artists face in today's fragmented music landscape. I'm reaching out because we've built something that could transform artist development.

BOOSTIFY MUSIC is an AI-powered platform that gives independent artists the tools that were previously only available to major label artists:

• AI Music Video Generation — Professional videos in minutes, not weeks
• Smart Distribution — Multi-platform releases with intelligent optimization
• Blockchain Royalties — 100% transparent, automated payments
• Artist Branding Suite — AI-powered visual identity and marketing

We're currently raising our Seed round on Wefunder ($5.5M cap), and I thought someone with your industry experience might be interested — either as an investor or as a potential strategic partner.

Would you be open to a brief conversation about how we might work together?

📅 Schedule a call: https://calendly.com/convoycubano/boostify-music
📊 Investor Dashboard: https://boostifymusic.com/investors-dashboard

Best regards,

Neiver Alvarez
CEO & Founder, Boostify Music

---
Boostify Music — A subsidiary of Omnia Strategics Holding Corporation
Incorporated in Delaware, USA
📍 1000 Brickell Ave, Office #75, Miami, FL 33131
📞 +1 (786) 987-6934 | 💬 WhatsApp: +1 (786) 543-2478
✉️ investorsrelations@boostifymusic.com`;

  const emailContent = `
    <!-- Greeting -->
    <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 15px 0;">
      Hi <strong>${vars.firstName}</strong>,
    </p>
    
    <!-- Personal Hook -->
    <p style="font-size: 15px; color: #475569; margin: 0 0 20px 0; line-height: 1.7;">
      ${vars.personalHook}
    </p>
    
    <!-- Introduction -->
    <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 25px 0; line-height: 1.7;">
      As someone at <strong>${vars.company}</strong>, you understand the challenges artists face in today's fragmented music landscape. I'm reaching out because we've built something that could <strong style="color: #f97316;">transform artist development</strong>.
    </p>
    
    <!-- What We Built Section -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px; background: #f8fafc; border-radius: 12px;">
      <tr>
        <td style="padding: 25px;">
          <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 700; color: #1a1a1a;">
            🎵 BOOSTIFY MUSIC gives independent artists major-label tools:
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="50%" style="padding: 8px; vertical-align: top;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border-radius: 10px; border-left: 3px solid #f97316;">
                  <tr>
                    <td style="padding: 16px;">
                      <div style="font-size: 20px; margin-bottom: 6px;">🎬</div>
                      <div style="font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">AI Music Videos</div>
                      <div style="font-size: 11px; color: #64748b; line-height: 1.4;">Pro videos in minutes, not weeks</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td width="50%" style="padding: 8px; vertical-align: top;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border-radius: 10px; border-left: 3px solid #10b981;">
                  <tr>
                    <td style="padding: 16px;">
                      <div style="font-size: 20px; margin-bottom: 6px;">📡</div>
                      <div style="font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">Smart Distribution</div>
                      <div style="font-size: 11px; color: #64748b; line-height: 1.4;">Multi-platform with AI optimization</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding: 8px; vertical-align: top;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border-radius: 10px; border-left: 3px solid #8b5cf6;">
                  <tr>
                    <td style="padding: 16px;">
                      <div style="font-size: 20px; margin-bottom: 6px;">⛓️</div>
                      <div style="font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">Blockchain Royalties</div>
                      <div style="font-size: 11px; color: #64748b; line-height: 1.4;">100% transparent, automated</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td width="50%" style="padding: 8px; vertical-align: top;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #ffffff; border-radius: 10px; border-left: 3px solid #ec4899;">
                  <tr>
                    <td style="padding: 16px;">
                      <div style="font-size: 20px; margin-bottom: 6px;">🎨</div>
                      <div style="font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">Artist Branding</div>
                      <div style="font-size: 11px; color: #64748b; line-height: 1.4;">AI-powered visual identity</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Investment/Partnership Box -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px;">
      <tr>
        <td style="padding: 25px; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #94a3b8;">Currently raising Seed Round on Wefunder</p>
          <div style="font-size: 28px; font-weight: 800; color: #f97316;">$5.5M Valuation Cap</div>
          <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b;">
            Looking for investors & strategic partners in music industry
          </p>
        </td>
      </tr>
    </table>
    
    <!-- CTA -->
    <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 20px 0; line-height: 1.7;">
      <strong>Would you be open to a brief conversation about how we might work together?</strong>
    </p>
  `;

  const html = wrapInEmailTemplate(emailContent, 'AI platform transforming artist development - seeking strategic partners');

  return { html, text };
}

// ============================================
// GENERIC INVESTOR EMAIL
// ============================================
function generateGenericInvestorEmail(lead: InvestorLead, vars: Record<string, string>): { html: string; text: string } {
  const text = `Hi ${vars.firstName},

${vars.personalHook}

I'm building Boostify Music — the first all-in-one AI-powered platform for independent musicians. We're tackling a $43.6B market where 80% of artists lack access to professional tools for creating, distributing, and monetizing their music.

WHAT WE'VE BUILT:
• AI Video Generation — Create professional music videos in minutes
• Smart Distribution — Reach all major platforms with one click
• Blockchain Royalties — Transparent, automated payments
• MotionDNA™ — Unique visual identity system for each artist

We've just opened our Seed round on Wefunder:
• $124K target | $5.5M valuation cap
• Post-Money SAFE | $100 minimum

Would you be interested in learning more? I'd be happy to share our deck or jump on a quick call.

📅 Schedule a call: https://calendly.com/convoycubano/boostify-music
📊 Investor Dashboard: https://boostifymusic.com/investors-dashboard

Best regards,

Neiver Alvarez
CEO & Founder, Boostify Music

---
Boostify Music — A subsidiary of Omnia Strategics Holding Corporation
Incorporated in Delaware, USA
📍 1000 Brickell Ave, Office #75, Miami, FL 33131
📞 +1 (786) 987-6934 | 💬 WhatsApp: +1 (786) 543-2478
✉️ investorsrelations@boostifymusic.com`;

  const emailContent = `
    <!-- Greeting -->
    <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 15px 0;">
      Hi <strong>${vars.firstName}</strong>,
    </p>
    
    <!-- Personal Hook -->
    <p style="font-size: 15px; color: #475569; margin: 0 0 20px 0; line-height: 1.7;">
      ${vars.personalHook}
    </p>
    
    <!-- Introduction -->
    <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 25px 0; line-height: 1.7;">
      I'm building <strong style="color: #f97316;">Boostify Music</strong> — the first all-in-one AI-powered platform for independent musicians. We're tackling a <strong>$43.6B market</strong> where 80% of artists lack access to professional tools.
    </p>
    
    <!-- Market Stats Banner -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px;">
      <tr>
        <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 12px; padding: 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="50%" style="text-align: center; padding: 10px;">
                <div style="font-size: 32px; font-weight: 800; color: #ffffff;">$43.6B</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.9); text-transform: uppercase;">Market Size</div>
              </td>
              <td width="50%" style="text-align: center; padding: 10px; border-left: 1px solid rgba(255,255,255,0.3);">
                <div style="font-size: 32px; font-weight: 800; color: #ffffff;">80%</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.9); text-transform: uppercase;">Underserved</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- What We've Built -->
    <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 700; color: #1a1a1a;">
      🚀 WHAT WE'VE BUILT
    </h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px;">
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="40" style="vertical-align: top;">
                <div style="width: 32px; height: 32px; background: #fef3c7; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🎬</div>
              </td>
              <td style="vertical-align: top; padding-left: 12px;">
                <div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">AI Video Generation</div>
                <div style="font-size: 12px; color: #64748b;">Professional music videos in minutes</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="40" style="vertical-align: top;">
                <div style="width: 32px; height: 32px; background: #d1fae5; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">📡</div>
              </td>
              <td style="vertical-align: top; padding-left: 12px;">
                <div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Smart Distribution</div>
                <div style="font-size: 12px; color: #64748b;">All major platforms, one click</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="40" style="vertical-align: top;">
                <div style="width: 32px; height: 32px; background: #ede9fe; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">⛓️</div>
              </td>
              <td style="vertical-align: top; padding-left: 12px;">
                <div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">Blockchain Royalties</div>
                <div style="font-size: 12px; color: #64748b;">Transparent, automated payments</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="40" style="vertical-align: top;">
                <div style="width: 32px; height: 32px; background: #fce7f3; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🎨</div>
              </td>
              <td style="vertical-align: top; padding-left: 12px;">
                <div style="font-size: 14px; font-weight: 600; color: #1a1a1a;">MotionDNA™</div>
                <div style="font-size: 12px; color: #64748b;">Unique AI visual identity per artist</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Investment Box -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px;">
      <tr>
        <td style="padding: 25px;">
          <h3 style="margin: 0 0 15px 0; font-size: 14px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">
            💰 Investment Opportunity
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="50%" style="padding: 8px 0;">
                <span style="font-size: 22px; font-weight: 800; color: #f97316;">$124K</span>
                <span style="font-size: 12px; color: #94a3b8; margin-left: 8px;">Target</span>
              </td>
              <td width="50%" style="padding: 8px 0;">
                <span style="font-size: 22px; font-weight: 800; color: #10b981;">$5.5M</span>
                <span style="font-size: 12px; color: #94a3b8; margin-left: 8px;">Cap</span>
              </td>
            </tr>
          </table>
          <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748b;">
            Post-Money SAFE • $100 Minimum • Raising on Wefunder
          </p>
        </td>
      </tr>
    </table>
    
    <!-- CTA -->
    <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 20px 0; line-height: 1.7;">
      <strong>Would you be interested in learning more?</strong> I'd be happy to share our deck or jump on a quick call.
    </p>
  `;

  const html = wrapInEmailTemplate(emailContent, 'AI-powered music platform - $43.6B market opportunity');

  return { html, text };
}

// ============================================
// FOLLOW UP EMAILS
// ============================================
function generateFollowUpEmail(lead: InvestorLead, vars: Record<string, string>, templateId: string): { html: string; text: string } {
  if (templateId === 'follow_up_3d') {
    const text = `Hi ${vars.firstName},

I wanted to follow up on my previous email about Boostify Music.

Given your background in ${lead.industry}, I thought you might find our approach interesting:

• We're using AI to democratize music video production (10x faster than traditional methods)
• Our blockchain integration ensures artists get paid fairly and transparently
• Early traction shows strong product-market fit

Our Wefunder campaign is gaining momentum — we'd love to have you as part of our investor community.

Would you have 10 minutes this week for a quick call?

📅 Schedule here: https://calendly.com/convoycubano/boostify-music
📊 Investor Dashboard: https://boostifymusic.com/investors-dashboard

Best regards,

Neiver Alvarez
CEO & Founder, Boostify Music

---
Boostify Music — A subsidiary of Omnia Strategics Holding Corporation
Incorporated in Delaware, USA
📍 1000 Brickell Ave, Office #75, Miami, FL 33131
📞 +1 (786) 987-6934 | 💬 WhatsApp: +1 (786) 543-2478
✉️ investorsrelations@boostifymusic.com`;

    const emailContent = `
      <!-- Greeting -->
      <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 15px 0;">
        Hi <strong>${vars.firstName}</strong>,
      </p>
      
      <!-- Intro -->
      <p style="font-size: 15px; color: #475569; margin: 0 0 20px 0; line-height: 1.7;">
        I wanted to follow up on my previous email about <strong style="color: #f97316;">Boostify Music</strong>.
      </p>
      
      <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 20px 0; line-height: 1.7;">
        Given your background in <strong>${lead.industry}</strong>, I thought you might find our approach interesting:
      </p>
      
      <!-- Key Points -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px; background: #f8fafc; border-radius: 12px;">
        <tr>
          <td style="padding: 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding: 10px 0;">
                  <span style="display: inline-block; width: 24px; height: 24px; background: #dcfce7; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; margin-right: 10px;">✓</span>
                  <span style="font-size: 14px; color: #1a1a1a;"><strong>AI Video Production</strong> — 10x faster than traditional methods</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0;">
                  <span style="display: inline-block; width: 24px; height: 24px; background: #dcfce7; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; margin-right: 10px;">✓</span>
                  <span style="font-size: 14px; color: #1a1a1a;"><strong>Blockchain Royalties</strong> — Fair & transparent payments</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0;">
                  <span style="display: inline-block; width: 24px; height: 24px; background: #dcfce7; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; margin-right: 10px;">✓</span>
                  <span style="font-size: 14px; color: #1a1a1a;"><strong>Strong Traction</strong> — Early product-market fit</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      <!-- Momentum Banner -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px;">
        <tr>
          <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 10px; padding: 16px; text-align: center;">
            <span style="font-size: 15px; color: #ffffff; font-weight: 600;">🚀 Wefunder campaign gaining momentum — join our investor community!</span>
          </td>
        </tr>
      </table>
      
      <!-- CTA -->
      <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 20px 0; line-height: 1.7;">
        <strong>Would you have 10 minutes this week for a quick call?</strong>
      </p>
    `;

    const html = wrapInEmailTemplate(emailContent, 'Quick follow-up on Boostify Music investment opportunity');
    return { html, text };
  }

  // Final follow up (7d, 10d, 14d, 21d)
  const text = `Hi ${vars.firstName},

I know you're busy, so I'll keep this brief.

This is my last follow-up about Boostify Music. If the timing isn't right, no worries at all.

But if you're curious about what we're building in the AI + music space, our Wefunder page has all the details: wefunder.com/boostify.music

Either way, I appreciate your time. If you know anyone in your network who might be interested, I'd be grateful for an introduction.

Best of luck with everything at ${vars.company}!

Warm regards,

Neiver Alvarez
CEO & Founder, Boostify Music

---
Boostify Music — A subsidiary of Omnia Strategics Holding Corporation
Incorporated in Delaware, USA
📍 1000 Brickell Ave, Office #75, Miami, FL 33131
📞 +1 (786) 987-6934 | 💬 WhatsApp: +1 (786) 543-2478
✉️ investorsrelations@boostifymusic.com`;

  const emailContent = `
    <!-- Greeting -->
    <p style="font-size: 16px; color: #1a1a1a; margin: 0 0 15px 0;">
      Hi <strong>${vars.firstName}</strong>,
    </p>
    
    <!-- Intro -->
    <p style="font-size: 15px; color: #475569; margin: 0 0 20px 0; line-height: 1.7;">
      I know you're busy, so I'll keep this brief.
    </p>
    
    <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 20px 0; line-height: 1.7;">
      This is my last follow-up about <strong style="color: #f97316;">Boostify Music</strong>. If the timing isn't right, no worries at all.
    </p>
    
    <!-- Info Box -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 25px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px;">
      <tr>
        <td style="padding: 25px; text-align: center;">
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #94a3b8;">Curious about AI + Music?</p>
          <p style="margin: 0; font-size: 16px; color: #ffffff; font-weight: 600;">
            All details on our Wefunder page 👇
          </p>
          <div style="margin-top: 16px;">
            <a href="https://wefunder.com/boostify.music" style="display: inline-block; background: #f97316; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">View Wefunder Campaign</a>
          </div>
        </td>
      </tr>
    </table>
    
    <!-- Referral Ask -->
    <p style="font-size: 15px; color: #475569; margin: 0 0 20px 0; line-height: 1.7;">
      Either way, I appreciate your time. If you know anyone in your network who might be interested, I'd be grateful for an introduction.
    </p>
    
    <p style="font-size: 15px; color: #1a1a1a; margin: 0 0 20px 0; line-height: 1.7;">
      Best of luck with everything at <strong>${vars.company}</strong>!
    </p>
  `;

  const html = wrapInEmailTemplate(emailContent, 'Final follow-up - Boostify Music');
  return { html, text };
}

// ============================================
// SELECT BEST TEMPLATE FOR LEAD
// ============================================
export function selectBestTemplate(lead: InvestorLead): string {
  // Check if this is a follow-up based on emails sent
  if (lead.emailsSent === 1) return 'follow_up_3d';
  if (lead.emailsSent === 2) return 'follow_up_7d';
  if (lead.emailsSent === 3) return 'follow_up_10d';
  if (lead.emailsSent === 4) return 'follow_up_14d';
  if (lead.emailsSent >= 5) return 'follow_up_21d';

  // VC/Angel investor - use warm intro
  if (
    lead.title.toLowerCase().includes('partner') ||
    lead.title.toLowerCase().includes('investor') ||
    lead.industry.toLowerCase().includes('venture') ||
    lead.industry.toLowerCase().includes('angel')
  ) {
    return 'warm_vc_intro';
  }

  // Record label/music industry
  if (
    lead.industry.toLowerCase().includes('music') ||
    lead.industry.toLowerCase().includes('entertainment') ||
    lead.company.toLowerCase().includes('record') ||
    lead.company.toLowerCase().includes('music') ||
    lead.company.toLowerCase().includes('label')
  ) {
    return 'record_label_exec';
  }

  // A/B/C/D/E test for cold outreach (rotate through variants)
  const variants = [
    'cold_outreach_direct',
    'cold_outreach_problem', 
    'cold_outreach_revenue',
    'cold_outreach_social',
    'cold_outreach_urgency',
  ];
  const randomIndex = Math.floor(Math.random() * variants.length);
  return variants[randomIndex];
}

// ============================================
// GET FOLLOW UP SEQUENCE
// ============================================
export function getFollowUpSequence(): string[] {
  return [
    'follow_up_3d',
    'follow_up_7d', 
    'follow_up_10d',
    'follow_up_14d',
    'follow_up_21d',
  ];
}

export default {
  EMAIL_TEMPLATES,
  REVENUE_PROJECTIONS,
  generatePersonalizedEmail,
  selectBestTemplate,
  getFollowUpSequence,
};
