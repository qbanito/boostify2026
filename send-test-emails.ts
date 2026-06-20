/**
 * Send test emails to review all 6 activation sequences
 * Usage: npx tsx send-test-emails.ts
 */

import {
  SEQUENCE_TEMPLATES,
  type TemplateData
} from './server/services/artist-activation/email-templates';

const TO_EMAIL = 'convoycubano@gmail.com';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = 'info@boostifymusic.com';
const FROM_NAME = 'Boostify Music';

// Sample artist data for preview
const sampleData: TemplateData = {
  artistName: 'Alex Rivera',
  email: TO_EMAIL,
  genre: 'Hip-Hop',
  country: 'United States',
  spotifyUrl: 'https://open.spotify.com/artist/example',
  instagramHandle: '@alexrivera',
  magicLinkUrl: 'https://boostifymusic.com/activate?demo=true',
  landingPageUrl: 'https://boostifymusic.com/artist/alex-rivera',
  unsubscribeUrl: 'https://boostifymusic.com/api/artist-activation/unsubscribe?demo=true',
};

async function sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  const result = await response.json();
  if (result.messageId) {
    return true;
  }
  console.error('  Error:', result.message || JSON.stringify(result));
  return false;
}

async function main() {
  if (!BREVO_API_KEY) {
    console.error('❌ BREVO_API_KEY not set. Load .env first.');
    process.exit(1);
  }

  console.log(`\n🎵 Sending test emails to ${TO_EMAIL}\n`);
  console.log('━'.repeat(50));

  const sequences: { name: string; key: keyof typeof SEQUENCE_TEMPLATES; steps: number[] }[] = [
    { name: '1. Welcome Cold', key: 'welcome_cold', steps: [0, 1, 2, 3, 4] },
    { name: '2. Landing Builder', key: 'landing_builder', steps: [0, 1, 2, 3] },
    { name: '3. Value Showcase', key: 'value_showcase', steps: [0, 1, 2, 3, 4, 5] },
    { name: '4. Upgrade Nudge', key: 'upgrade_nudge', steps: [0, 1, 2, 3] },
    { name: '5. Win-Back', key: 'win_back', steps: [0, 1, 2] },
    { name: '6. Referral Push', key: 'referral_push', steps: [0, 1] },
  ];

  let sent = 0;
  let failed = 0;

  for (const seq of sequences) {
    console.log(`\n📧 Sequence: ${seq.name} (${seq.steps.length} emails)`);
    for (const step of seq.steps) {
      const templateFn = SEQUENCE_TEMPLATES[seq.key][step];
      const { subject, html } = templateFn(sampleData);
      process.stdout.write(`  Step ${step}: "${subject}" ... `);
      const ok = await sendEmail(TO_EMAIL, `[TEST ${seq.key} #${step}] ${subject}`, html);
      if (ok) {
        console.log('✅');
        sent++;
      } else {
        console.log('❌');
        failed++;
      }
      // 300ms delay to avoid rate limits
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log('\n' + '━'.repeat(50));
  console.log(`\n✅ Sent: ${sent} | ❌ Failed: ${failed} | Total: ${sent + failed}`);
  console.log(`\n📬 Check ${TO_EMAIL} inbox (and spam folder)\n`);
}

main().catch(console.error);
