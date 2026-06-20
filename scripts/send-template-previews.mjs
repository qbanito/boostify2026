/**
 * Send all 5 venue email template previews to a given email address
 * Usage: npx tsx scripts/send-template-previews.mjs convoycubano@gmail.com
 */
import 'dotenv/config';
import { generateEmailFromTemplate } from '../server/services/venue-email-templates.js';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const TARGET_EMAIL = process.argv[2] || 'convoycubano@gmail.com';

if (!BREVO_API_KEY) {
  console.error('❌ BREVO_API_KEY not set in environment');
  process.exit(1);
}

const TEMPLATES = [
  { id: 'professional_pitch', label: '💼 Professional Pitch' },
  { id: 'club_night',         label: '🎵 Club Night' },
  { id: 'intimate_venue',     label: '🎸 Intimate Acoustic' },
  { id: 'festival_application', label: '🎪 Festival / Event' },
  { id: 'follow_up',          label: '🔄 Follow Up' },
];

const sampleData = {
  artistName: 'CONVOY',
  artistSlug: 'convoy',
  artistGenre: 'Electronic / House',
  artistBio: 'CONVOY is a dynamic electronic music artist blending house, techno, and melodic bass into electrifying live performances. With sold-out shows across Europe and Latin America, CONVOY delivers an unforgettable experience that keeps dance floors moving all night.',
  artistImage: 'https://ui-avatars.com/api/?name=CONVOY&size=200&background=F59E0B&color=fff&bold=true',
  spotifyUrl: 'https://open.spotify.com/artist/example',
  youtubeChannel: 'https://youtube.com/@convoy',
  instagramHandle: 'convoy_music',
  venueName: 'The Blue Note Jazz Club',
  showFee: '€500 - €1,500',
  setDuration: '60-90 min',
  availability: 'Weekends, March - June 2026',
  technicalRequirements: 'PA System (min 2kW), 2 floor monitors, 3 microphones (SM58), full stage lighting with programmable wash, 2x DI boxes',
  customMessage: 'We love the atmosphere at your venue and believe our sound would be a perfect match for your audience. Looking forward to collaborating!',
  dealId: 12345,
};

async function sendEmail(to, subject, htmlContent) {
  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: 'bookings@boostifymusic.com', name: 'Boostify Music Bookings' },
      to: [{ email: to, name: 'Boostify Preview' }],
      subject,
      htmlContent,
    }),
  });
  const data = await res.json();
  if (!data.messageId) throw new Error(data.message || JSON.stringify(data));
  return data;
}

console.log(`📧 Sending 5 template previews to ${TARGET_EMAIL}...\n`);

let sent = 0;
for (const tpl of TEMPLATES) {
  try {
    console.log(`  ⏳ Generating ${tpl.label}...`);
    const { html, subject } = generateEmailFromTemplate(tpl.id, sampleData);
    const fullSubject = `[PREVIEW] ${tpl.label} — ${subject}`;
    console.log(`  📤 Sending: "${fullSubject}"`);
    await sendEmail(TARGET_EMAIL, fullSubject, html);
    sent++;
    console.log(`  ✅ Sent!\n`);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  } catch (err) {
    console.error(`  ❌ Failed ${tpl.id}:`, err.message, '\n');
  }
}

console.log(`\n🎉 Done! ${sent}/5 templates sent to ${TARGET_EMAIL}`);
