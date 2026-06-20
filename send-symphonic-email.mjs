/**
 * One-off script: Send partnership email to Symphonic Distribution
 * Uses Resend API (same as platform newsletters)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY not set. Add it to your .env or environment.');
  process.exit(1);
}

const TO = 'partnerships@symphonic.com';
const FROM = 'Neiver Alvarez <partnerships@boostifymusic.com>';
const REPLY_TO = 'convoycubano@gmail.com';
const SUBJECT = 'White-Label Distribution API Partnership — Boostify Music Platform';

const HTML = `
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1a1a1a; line-height: 1.7;">

  <p>Dear Symphonic Partnerships Team,</p>

  <p>My name is <strong>Neiver Alvarez</strong>, CEO of <strong>Boostify Music</strong> — a full-stack AI-powered music platform that automates the entire artist lifecycle: creation, production, marketing, monetization, and distribution.</p>

  <h3 style="color:#F97316; margin-top:28px;">Why Symphonic + Boostify</h3>
  <p>We're building the <em>first fully automated artist-as-a-service engine</em>. Our platform currently manages <strong>200+ AI-generated artists</strong>, each with scheduled release cadences (albums every 10 days), auto-generated music videos, merchandise, social content, and blockchain-backed song tokens (ERC-1155 on Polygon).</p>

  <p>What we need is a <strong>white-label distribution back-end</strong> — and Symphonic's API-first approach is exactly the right fit.</p>

  <h3 style="color:#F97316; margin-top:28px;">What We Bring to the Table</h3>
  <ul>
    <li><strong>Automated ISRC/UPC generation</strong> — every song gets codes at creation time</li>
    <li><strong>Release pipeline</strong> — draft → review → approved → delivering → live, fully orchestrated</li>
    <li><strong>15+ DSP targets pre-configured</strong> — Spotify, Apple Music, Amazon, YouTube Music, Deezer, Tidal, etc.</li>
    <li><strong>Stripe-powered payments</strong> — subscriptions, one-time purchases, split payments (80/20 artist/platform)</li>
    <li><strong>Growing catalog</strong> — hundreds of songs per month, scaling to thousands</li>
  </ul>

  <h3 style="color:#F97316; margin-top:28px;">Integration Ask</h3>
  <p>We'd like to explore access to Symphonic's <strong>white-label distribution API</strong> to:</p>
  <ol>
    <li>Submit releases programmatically from our pipeline</li>
    <li>Receive delivery status callbacks (queued → delivered → live)</li>
    <li>Pull royalty/streaming analytics back into our artist dashboards</li>
  </ol>

  <p>Our tech stack is Node.js/Express + PostgreSQL + Firestore, so a REST or GraphQL API integrates cleanly.</p>

  <h3 style="color:#F97316; margin-top:28px;">Next Steps</h3>
  <p>I'd love to schedule a 20-minute introductory call to walk through our platform, demo the automated release flow, and discuss partnership terms. I'm available any day this week or next.</p>

  <p style="margin-top:28px;">Thank you for your time. Looking forward to hearing from you.</p>

  <p style="margin-top:32px;">
    Best regards,<br/>
    <strong>Neiver Alvarez</strong><br/>
    CEO & Founder, Boostify Music<br/>
    <a href="mailto:convoycubano@gmail.com" style="color:#F97316;">convoycubano@gmail.com</a><br/>
    <a href="https://boostifymusic.com" style="color:#F97316;">boostifymusic.com</a>
  </p>

</div>
`;

async function send() {
  console.log(`📧 Sending partnership email to ${TO}...`);
  console.log(`   From: ${FROM}`);
  console.log(`   Reply-To: ${REPLY_TO}`);
  console.log(`   Subject: ${SUBJECT}`);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: REPLY_TO,
      subject: SUBJECT,
      html: HTML,
    }),
  });

  const result = await res.json();

  if (res.ok && result.id) {
    console.log(`✅ Email sent successfully!`);
    console.log(`   Message ID: ${result.id}`);
  } else {
    console.error(`❌ Failed to send email:`);
    console.error(`   Status: ${res.status}`);
    console.error(`   Response:`, JSON.stringify(result, null, 2));
  }
}

send();
