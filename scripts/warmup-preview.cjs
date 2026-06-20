/**
 * 🔥 WARMUP EMAIL PREVIEW
 * Generate and preview warmup emails using OpenAI
 */

const OpenAI = require('openai');
const { Resend } = require('resend');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.secrets') }); // overrides .env // overrides .env // overrides .env // overrides .env

// APIs (from environment variables)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const resend = new Resend(process.env.RESEND_API_INDUSTRY);

// Test lead data (Pachi Lopez)
const testLead = {
  id: 'test-001',
  email: 'pachilopezmusic@gmail.com',
  name: 'Pachi',
  artistName: 'Pachi Lopez',
  genre: 'Reggaeton',
  platform: 'Instagram',
  followers: 5000,
  city: 'Miami',
  country: 'USA',
  source: 'instagram_scrape'
};

// Warmup prompts
const WARMUP_PROMPTS = {
  1: {
    body: (lead) => `
You are writing a short, casual email to an independent music artist.

Artist info:
- Name: ${lead.artistName || lead.name}
- Genre: ${lead.genre || 'unknown'}
- Platform: ${lead.platform || 'unknown'}
- Location: ${lead.city || ''} ${lead.country || ''}
- Followers: ${lead.followers || 'unknown'}

Write a SHORT email (3-4 sentences max) that:
1. Mentions you found them on ${lead.platform || 'social media'}
2. Compliments something specific about their style/genre
3. Asks ONE simple question about their music journey or influences
4. Signs off casually

Rules:
- NO HTML, just plain text
- NO links
- NO promotional content
- Sound like a real person, not a company
- Use their artist name naturally
- Keep it under 80 words
- End with a simple question they can easily answer

Sign as: Carlos from Boostify

Return ONLY the email body, no subject line.
`,
    subject: (lead) => `
Generate a SHORT email subject line (max 6 words) for ${lead.artistName || lead.name}.
Make it personal and curious, like you're a fan reaching out.
NO emojis, NO caps, NO promotional words.
Examples: "quick question about your music", "loved your latest track", "fellow ${lead.genre || 'music'} fan here"
Return ONLY the subject line.
`
  },
  2: {
    body: (lead) => `
You are following up with an independent music artist you emailed 2 days ago.

Artist info:
- Name: ${lead.artistName || lead.name}
- Genre: ${lead.genre || 'unknown'}
- Platform: ${lead.platform || 'unknown'}
- Followers: ${lead.followers || 'unknown'}

Write a SHORT follow-up email (3-4 sentences max) that:
1. References you reached out before (but don't be pushy)
2. Asks about their BIGGEST CHALLENGE as an independent artist
3. Show genuine curiosity about their experience

Rules:
- NO HTML, just plain text
- NO links
- NO promotional content
- Sound like a real person doing research
- Keep it under 60 words
- The question should be easy to answer

Sign as: Carlos

Return ONLY the email body, no subject line.
`,
    subject: (lead) => `
Generate a SHORT follow-up subject line (max 5 words) for ${lead.artistName || lead.name}.
Make it casual like checking in with someone.
NO emojis, NO caps.
Examples: "following up", "quick question", "still curious"
Return ONLY the subject line.
`
  },
  3: {
    body: (lead) => `
You are sending a final casual email to an independent music artist.

Artist info:
- Name: ${lead.artistName || lead.name}
- Genre: ${lead.genre || 'unknown'}
- Platform: ${lead.platform || 'unknown'}

Write a SHORT email (3-4 sentences max) that:
1. Is super casual and friendly
2. Asks if they're open to collaborations with other artists
3. Mentions you're connecting artists in their genre

Rules:
- NO HTML, just plain text
- NO links
- NO sales pitch
- Keep it under 50 words
- Very casual tone

Sign as: Carlos

Return ONLY the email body, no subject line.
`,
    subject: (lead) => `
Generate a SHORT final email subject line (max 5 words) about collaborations.
Very casual and friendly.
NO emojis, NO caps.
Examples: "collab idea", "connecting artists", "one last thing"
Return ONLY the subject line.
`
  }
};

async function generateEmail(promptFn, lead) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: promptFn(lead) }],
    max_tokens: 200,
    temperature: 0.8
  });
  return completion.choices[0].message.content.trim();
}

async function previewAllWarmupEmails() {
  console.log('\n' + '='.repeat(60));
  console.log('🔥 WARMUP EMAIL SEQUENCE PREVIEW');
  console.log('='.repeat(60));
  console.log(`\nLead: ${testLead.artistName} (${testLead.genre})`);
  console.log(`Email: ${testLead.email}`);
  console.log(`Platform: ${testLead.platform} | Followers: ${testLead.followers}`);
  console.log('='.repeat(60));

  for (let i = 1; i <= 3; i++) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📧 WARMUP EMAIL ${i}/3`);
    console.log('─'.repeat(60));

    try {
      const subject = await generateEmail(WARMUP_PROMPTS[i].subject, testLead);
      const body = await generateEmail(WARMUP_PROMPTS[i].body, testLead);

      console.log(`\nSubject: ${subject}`);
      console.log(`\nBody:\n${body}`);
    } catch (error) {
      console.error(`Error generating email ${i}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Preview complete! Reply "send" to send these to convoycubano@gmail.com');
  console.log('='.repeat(60) + '\n');
}

async function sendWarmupPreview(emailNumber = 1) {
  console.log(`\n📤 Generating and sending Warmup Email ${emailNumber}/3...`);

  try {
    const subject = await generateEmail(WARMUP_PROMPTS[emailNumber].subject, testLead);
    const body = await generateEmail(WARMUP_PROMPTS[emailNumber].body, testLead);

    console.log(`\nSubject: ${subject}`);
    console.log(`Body:\n${body}\n`);

    const { data, error } = await resend.emails.send({
      from: 'Carlos from Boostify <carlos@boostifymusic.site>',
      to: ['convoycubano@gmail.com'],
      subject: subject,
      text: body, // Plain text only!
    });

    if (error) {
      // Try with artists@ if carlos@ doesn't exist
      const { data: data2, error: error2 } = await resend.emails.send({
        from: 'Carlos <artists@boostifymusic.site>',
        to: ['convoycubano@gmail.com'],
        subject: subject,
        text: body,
      });

      if (error2) {
        console.error('Error:', error2);
        return;
      }
      console.log(`✅ Warmup ${emailNumber}/3 sent! ID: ${data2.id}`);
      return;
    }

    console.log(`✅ Warmup ${emailNumber}/3 sent! ID: ${data.id}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

// Check command line args
const args = process.argv.slice(2);

if (args[0] === 'send') {
  const emailNum = parseInt(args[1]) || 1;
  sendWarmupPreview(emailNum);
} else if (args[0] === 'sendall') {
  (async () => {
    for (let i = 1; i <= 3; i++) {
      await sendWarmupPreview(i);
      if (i < 3) await new Promise(r => setTimeout(r, 2000)); // Wait 2s between
    }
  })();
} else {
  previewAllWarmupEmails();
}
