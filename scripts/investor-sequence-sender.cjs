/**
 * 💼 INVESTOR SEQUENCE SENDER
 * Envía emails HTML de la secuencia de 13+ templates para inversores/industria
 * Usa Brevo (formerly Sendinblue) para emails del dominio boostifymusic.com
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.secrets') }); // overrides .env

const { sendWithBrevo, recordSends, getBrevoQuota, REPLY_TO } = require('./email-smart-router.cjs');

// Parse arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

const TEMPLATE_ID = args.template || 'cold_outreach_direct';
const MAX_EMAILS = parseInt(args.max || '25');
const TARGET_SEGMENT = args.segment || 'all';
const PREVIEW_MODE = args.preview === 'true';
const PREVIEW_EMAIL = 'convoycubano@gmail.com';

// Database
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

// Brevo email sender (dominio de industria)
const FROM_EMAIL = 'investors@boostifymusic.com';
const FROM_NAME = 'Neiver Alvarez';

// Wrapper using smart router — always includes reply-to convoycubano@gmail.com
async function sendBrevoEmail(to, subject, html) {
  const result = await sendWithBrevo({ to, subject, html, fromEmail: FROM_EMAIL, fromName: FROM_NAME });
  if (result.messageId) {
    return { data: { id: result.messageId }, error: null };
  } else {
    return { data: null, error: { message: result.error } };
  }
}

// Template definitions
const TEMPLATES = {
  // Cold Outreach (5 variantes)
  cold_outreach_direct: {
    id: 'cold_outreach_direct',
    name: 'Cold Outreach - Direct Pitch',
    subject: '{{firstName}}, Transforming How Independent Artists Build Careers',
    preheader: 'AI-powered music platform raising seed round on Wefunder',
    category: 'cold_outreach'
  },
  cold_outreach_problem: {
    id: 'cold_outreach_problem',
    name: 'Cold Outreach - Problem First',
    subject: 'The $43B Problem No One Is Solving for Musicians',
    preheader: 'AI-powered solution now raising on Wefunder',
    category: 'cold_outreach'
  },
  cold_outreach_revenue: {
    id: 'cold_outreach_revenue',
    name: 'Cold Outreach - Revenue Projections',
    subject: '{{firstName}} — $54M ARR Projection in Music Tech',
    preheader: 'See the numbers behind our growth model',
    category: 'cold_outreach'
  },
  cold_outreach_social: {
    id: 'cold_outreach_social',
    name: 'Cold Outreach - Social Proof',
    subject: 'Why Artists Are Choosing Boostify Over Traditional Labels',
    preheader: 'Join the movement transforming music',
    category: 'cold_outreach'
  },
  cold_outreach_urgency: {
    id: 'cold_outreach_urgency',
    name: 'Cold Outreach - Limited Opportunity',
    subject: '{{firstName}}, Seed Round Filling Fast — $5.5M Valuation Cap',
    preheader: 'Limited allocation remaining at this valuation',
    category: 'cold_outreach'
  },
  // Warm Intro
  warm_vc_intro: {
    id: 'warm_vc_intro',
    name: 'VC/Angel Warm Introduction',
    subject: '{{firstName}} — Quick Question About Music Tech Investments',
    preheader: 'Saw your work in the music/entertainment space',
    category: 'warm_intro'
  },
  record_label_exec: {
    id: 'record_label_exec',
    name: 'Record Label Executive',
    subject: '{{firstName}}, New Tech That Could Change Artist Development',
    preheader: 'AI tools designed for the modern music industry',
    category: 'cold_outreach'
  },
  // Follow-ups
  follow_up_3d: {
    id: 'follow_up_3d',
    name: 'Follow Up - 3 Days',
    subject: 'Re: Quick follow-up — Boostify Music',
    preheader: 'Just bumping this to the top',
    category: 'follow_up'
  },
  follow_up_7d: {
    id: 'follow_up_7d',
    name: 'Follow Up - 7 Days',
    subject: '{{firstName}} — One More Thing on Boostify 🎵',
    preheader: 'New development I wanted to share',
    category: 'follow_up'
  },
  follow_up_10d: {
    id: 'follow_up_10d',
    name: 'Follow Up - 10 Days Value Add',
    subject: 'Thought of you — Music Industry Report 📊',
    preheader: 'Sharing some industry insights',
    category: 'follow_up'
  },
  follow_up_14d: {
    id: 'follow_up_14d',
    name: 'Follow Up - 14 Days Breakup',
    subject: '{{firstName}} — Closing the Loop 👋',
    preheader: 'Last reach out',
    category: 'follow_up'
  },
  follow_up_21d: {
    id: 'follow_up_21d',
    name: 'Follow Up - 21 Days Hail Mary',
    subject: 'Wrong person at {{company}}?',
    preheader: 'Quick question',
    category: 'follow_up'
  }
};

// Generate HTML email for investor
function generateInvestorHTML(lead, template) {
  const firstName = lead.first_name || lead.name?.split(' ')[0] || 'there';
  const company = lead.company_name || lead.company || 'your company';
  const subject = template.subject
    .replace('{{firstName}}', firstName)
    .replace('{{company}}', company);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Card -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 25px; text-align: center;">
              <h1 style="margin: 0; color: #f97316; font-size: 24px; font-weight: 800;">
                🎵 BOOSTIFY MUSIC
              </h1>
              <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 12px;">
                Omnia Strategics Holding Corporation | Delaware, USA
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                Hi ${firstName},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                ${getInvestorEmailBody(template.id, firstName, company)}
              </p>
              
              <!-- Stats -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0; background: #f8fafc; border-radius: 8px; padding: 20px;">
                <tr>
                  <td align="center" style="padding: 15px;">
                    <div style="font-size: 28px; font-weight: 800; color: #f97316;">$5.5M</div>
                    <div style="font-size: 11px; color: #64748b;">VALUATION CAP</div>
                  </td>
                  <td align="center" style="padding: 15px;">
                    <div style="font-size: 28px; font-weight: 800; color: #10b981;">5,000+</div>
                    <div style="font-size: 11px; color: #64748b;">ARTISTS</div>
                  </td>
                  <td align="center" style="padding: 15px;">
                    <div style="font-size: 28px; font-weight: 800; color: #3b82f6;">$54M</div>
                    <div style="font-size: 11px; color: #64748b;">Y5 ARR TARGET</div>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Buttons -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0;">
                <tr>
                  <td align="center">
                    <a href="https://calendly.com/convoycubano/boostify-music" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; margin: 5px; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(16,185,129,0.35);">
                      📅 Schedule a Call
                    </a>
                    <a href="https://wefunder.com/boostify.music" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; margin: 5px; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(249,115,22,0.35);">
                      💰 Invest on Wefunder
                    </a>
                  </td>
                </tr>
              </table>

              <!-- News Section -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 25px 0; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; color: #1a1a1a;">📰 Latest from Boostify</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                      <tr>
                        <td style="padding: 12px 14px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #f97316;">
                          <div style="font-size: 9px; font-weight: 700; color: #f97316; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Platform Growth</div>
                          <div style="font-size: 12px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">Boostify Reaches 5,000 Artists — Growing 34% Month Over Month</div>
                          <div style="font-size: 11px; color: #64748b;">Independent artists are choosing AI-powered tools over traditional label deals at unprecedented rates.</div>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 14px;">
                      <tr>
                        <td style="padding: 12px 14px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #6366f1;">
                          <div style="font-size: 9px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">AI Music</div>
                          <div style="font-size: 12px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">Autonomous AI Artists Are Generating Real Streaming Revenue on Boostify</div>
                          <div style="font-size: 11px; color: #64748b;">The platform's autonomous artist system is proving the future of music creation is here now.</div>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0; text-align: center;">
                      <a href="https://boostifymusic.com/news" style="font-size: 12px; color: #f97316; font-weight: 700; text-decoration: none;">Read all platform updates on boostifymusic.com/news →</a>
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 25px 0 0 0; color: #1a1a1a; font-size: 14px;">
                Best regards,
              </p>
              <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: 700; color: #1a1a1a;">
                Neiver Alvarez
              </p>
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                CEO & Founder, Boostify Music
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 25px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 13px; font-weight: 600;">
                Boostify Music
              </p>
              <p style="margin: 0 0 15px 0; color: #94a3b8; font-size: 11px;">
                A subsidiary of Omnia Strategics Holding Corporation<br>
                Incorporated in Delaware, USA
              </p>
              <p style="margin: 0; color: #64748b; font-size: 11px;">
                📍 1000 Brickell Ave, Office #75, Miami, FL 33131<br>
                📞 +1 (786) 987-6934 | ✉️ investors@boostifymusic.com
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 15px auto 0 auto;">
                <tr>
                  <td style="padding: 0 6px;"><a href="https://boostifymusic.com" style="font-size: 11px; color: #f97316; text-decoration: none;">🌐 boostifymusic.com</a></td>
                  <td style="padding: 0 6px;"><a href="https://wefunder.com/boostify.music" style="font-size: 11px; color: #10b981; text-decoration: none;">💰 wefunder.com/boostify.music</a></td>
                  <td style="padding: 0 6px;"><a href="https://boostifymusic.com/news" style="font-size: 11px; color: #60a5fa; text-decoration: none;">📰 News</a></td>
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

// Get email body based on template
function getInvestorEmailBody(templateId, firstName, company) {
  const bodies = {
    cold_outreach_direct: `I'm reaching out because I believe you'd find Boostify Music interesting. We're building an AI-powered platform that's transforming how independent artists build their careers.\n\nWith over 5,000 artists already on the platform and a clear path to $54M ARR by year 5, we're currently raising our seed round on Wefunder at a $5.5M valuation cap.`,
    
    cold_outreach_problem: `There are 100 million independent artists worldwide, but 99% of them will never make a living from their music. The industry is broken.\n\nWe're fixing this with AI-powered tools that give independent artists the same advantages that major labels provide. And we're raising our seed round on Wefunder.`,
    
    cold_outreach_revenue: `I wanted to share our revenue projections with you:\n\n• Year 1: $174K ARR (500 artists)\n• Year 3: $11.7M ARR (25K artists)\n• Year 5: $54M ARR (100K artists)\n\nWe're currently raising on Wefunder at a $5.5M valuation cap.`,
    
    cold_outreach_social: `Artists are leaving traditional labels and choosing Boostify instead. Here's why:\n\n✅ Keep 100% of your royalties\n✅ AI-powered tools for growth\n✅ Real community of artists\n✅ Professional presence instantly\n\nWe're raising our seed round on Wefunder.`,
    
    cold_outreach_urgency: `Our seed round on Wefunder is filling up faster than expected. At a $5.5M valuation cap, early investors are positioned for significant returns.\n\nLimited allocation remaining at this valuation.`,
    
    warm_vc_intro: `I noticed your work in the music/entertainment space and wanted to connect. We're building something that might be relevant to your investment thesis.\n\nWould love to get your perspective on the market opportunity in music tech.`,
    
    record_label_exec: `I'm reaching out because what we're building at Boostify could complement your artist development efforts. Our AI tools help artists build their presence and grow their audience.\n\nWould be great to explore potential partnerships.`,
    
    follow_up_3d: `Just wanted to bump this to the top of your inbox. Happy to jump on a quick call this week if you're interested in learning more about what we're building.`,
    
    follow_up_7d: `Quick update: We just crossed 5,000 artists on the platform and our Wefunder campaign is gaining momentum.\n\nWould love to share more details if you have 15 minutes this week.`,
    
    follow_up_10d: `Thought you might find this interesting: According to our analysis, the independent artist tools market is projected to reach $12B by 2028.\n\nWe're positioning Boostify to capture a significant share of this market.`,
    
    follow_up_14d: `${firstName}, I know you're busy so I'll keep this brief: Our Wefunder round is progressing well and we're limiting new investors soon.\n\nIf this isn't the right fit, no worries at all. Just wanted to close the loop.`,
    
    follow_up_21d: `Am I reaching the right person at ${company} for music tech investments? If not, would you mind pointing me in the right direction?\n\nAppreciate your time either way.`
  };
  
  return bodies[templateId] || bodies.cold_outreach_direct;
}

// Random delay between emails
function randomDelay(minSeconds, maxSeconds) {
  const delay = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function sendInvestorSequence() {
  console.log('\n' + '='.repeat(60));
  console.log(`💼 INVESTOR SEQUENCE SENDER`);
  console.log('='.repeat(60));
  console.log(`📧 Template: ${TEMPLATE_ID}`);
  console.log(`🎯 Segment: ${TARGET_SEGMENT}`);
  console.log(`📊 Max emails: ${MAX_EMAILS}`);
  console.log(`🔄 Mode: ${PREVIEW_MODE ? 'PREVIEW (convoycubano@gmail.com)' : '🔴 PRODUCTION'}`);
  console.log('─'.repeat(60));

  const template = TEMPLATES[TEMPLATE_ID];
  if (!template) {
    console.error('❌ Invalid template ID');
    return;
  }

  console.log(`📋 Template: ${template.name}`);
  console.log(`📝 Category: ${template.category}`);

  const client = await pool.connect();

  try {
    // Get investor/industry leads - buscar en múltiples fuentes
    let query = `
      SELECT l.*, ls.warmup_stage, ls.emails_sent, ls.id as status_id
      FROM leads l
      LEFT JOIN lead_status ls ON l.id = ls.lead_id
      WHERE l.industry IS NOT NULL 
        OR l.source IN ('linkedin_scrape', 'investor_list', 'industry_contact', 'apify_leads', 'csv_import')
    `;

    if (TARGET_SEGMENT !== 'all') {
      query += ` AND l.job_title ILIKE '%${TARGET_SEGMENT}%'`;
    }

    // Filter by template category
    if (template.category === 'cold_outreach') {
      query += ` AND (ls.emails_sent IS NULL OR ls.emails_sent = 0)`;
    } else if (template.category === 'follow_up') {
      // Get leads that received previous emails
      const followUpDays = parseInt(TEMPLATE_ID.replace('follow_up_', '').replace('d', ''));
      query += ` AND ls.last_email_at IS NOT NULL 
                 AND ls.last_email_at < NOW() - INTERVAL '${followUpDays - 1} days'`;
    }

    query += ` ORDER BY l.created_at ASC LIMIT ${MAX_EMAILS}`;

    const leadsResult = await client.query(query);
    const leads = leadsResult.rows;

    console.log(`\n📋 Leads encontrados: ${leads.length}`);

    if (leads.length === 0) {
      console.log('✅ No hay leads listos para este template');
      return;
    }

    let sent = 0;
    let errors = 0;

    for (const lead of leads) {
      const firstName = lead.first_name || lead.name?.split(' ')[0] || 'there';
      const company = lead.company_name || lead.company || 'your company';
      const subject = template.subject
        .replace('{{firstName}}', firstName)
        .replace('{{company}}', company);
      const targetEmail = PREVIEW_MODE ? PREVIEW_EMAIL : lead.email;

      console.log(`\n📧 [${sent + 1}/${leads.length}] ${firstName} @ ${company}`);
      console.log(`   📨 To: ${targetEmail}`);
      console.log(`   📝 Subject: ${subject}`);

      try {
        const html = generateInvestorHTML(lead, template);

        const result = await sendBrevoEmail(targetEmail, subject, html);

        if (result.error) {
          throw new Error(result.error.message);
        }

        console.log(`   ✅ Enviado: ${result.data?.id}`);

        // Update lead status
        if (!PREVIEW_MODE && lead.status_id) {
          await client.query(`
            UPDATE lead_status 
            SET status = 'contacted',
                last_email_at = NOW(),
                emails_sent = COALESCE(emails_sent, 0) + 1,
                notes = COALESCE(notes, '') || ' | Template: ' || $1
            WHERE id = $2
          `, [TEMPLATE_ID, lead.status_id]);

          // Log the send
          await client.query(`
            INSERT INTO email_sends (lead_id, domain, template, subject, status)
            VALUES ($1, 'boostifymusic.com', $2, $3, 'sent')
          `, [lead.id, TEMPLATE_ID, subject]);
        }

        sent++;

        // Random delay between emails (45-120 seconds for investor emails)
        if (sent < leads.length) {
          const delaySeconds = Math.floor(Math.random() * 75) + 45;
          console.log(`   ⏳ Esperando ${delaySeconds}s...`);
          await randomDelay(45, 120);
        }

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errors++;
        await randomDelay(5, 15);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN');
    console.log('='.repeat(60));
    console.log(`✅ Enviados: ${sent}`);
    console.log(`❌ Errores: ${errors}`);
    console.log(`📧 Template: ${template.name}`);

  } finally {
    client.release();
    await pool.end();
  }
}

sendInvestorSequence().catch(console.error);
