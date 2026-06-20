/**
 * 🎵 GENERATE WARMUP EMAIL FROM APIFY LEAD
 * Uses OpenAI to personalize based on extracted lead data
 * Sends preview to convoycubano@gmail.com
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

// Lead data extracted from Apify (Alex Alexander from Loudkult)
const lead = {
  first_name: 'Alex',
  last_name: 'Alexander',
  email: 'alex@loudkult.com',
  personal_email: 'ajalex44@msn.com',
  full_name: 'Alex Alexander',
  job_title: 'Co-owner (founder)',
  linkedin: 'https://www.linkedin.com/in/alex-alexander-13379853',
  company_name: 'Loudkult',
  company_website: 'https://www.loudkult.com',
  industry: 'Music',
  company_size: 25,
  city: 'Los Angeles',
  state: 'California',
  country: 'United States',
  company_description: '"By Artists For Artists" - We are an artist-friendly record label based in Stockholm',
  keywords: 'artist-friendly, music distribution, spotify playlists, demo submission, label management'
};

async function generatePersonalizedEmail() {
  console.log('\n' + '='.repeat(60));
  console.log('🎵 GENERATING PERSONALIZED WARMUP EMAIL');
  console.log('='.repeat(60));
  console.log(`\nLead: ${lead.full_name}`);
  console.log(`Company: ${lead.company_name} (${lead.industry})`);
  console.log(`Role: ${lead.job_title}`);
  console.log(`Location: ${lead.city}, ${lead.state}`);
  console.log('─'.repeat(60));

  // 🎲 SUBJECT TEMPLATES - Se elige uno aleatorio para cada lead
  const subjectTemplates = [
    // Familiarity + Flattery
    `${lead.first_name}, been following ${lead.company_name} - wow`,
    `${lead.first_name}, finally reaching out`,
    `man ${lead.first_name}, what you're building is 🔥`,
    `${lead.first_name} - your approach is different`,
    `${lead.first_name}, huge fan of what you do`,
    `been meaning to reach out ${lead.first_name}`,
    `${lead.first_name} - respect what you're doing`,
    `${lead.first_name}, had to say something`,
    `${lead.first_name} - can't believe we haven't connected`,
    `what you've built with ${lead.company_name} 🔥`,
    `${lead.first_name}, quick thought`,
    `${lead.first_name} - been watching your work`,
    `hey ${lead.first_name}, finally writing`,
    `${lead.first_name}, this is overdue`,
    `${lead.first_name} - huge respect`
  ];

  // Elegir subject aleatorio
  const randomSubject = subjectTemplates[Math.floor(Math.random() * subjectTemplates.length)];
  console.log(`\n🎲 Subject aleatorio elegido de ${subjectTemplates.length} opciones`);

  // Generate body
  const bodyPrompt = `
You are writing a WARM, PERSONAL email to someone in the music industry.
Sound like you've been following their work and genuinely ADMIRE what they do.

Their info:
- Name: ${lead.first_name} ${lead.last_name}
- Role: ${lead.job_title}
- Company: ${lead.company_name}
- Company Description: ${lead.company_description}
- Industry: ${lead.industry}
- Location: ${lead.city}, ${lead.state}
- Keywords: ${lead.keywords}

🎯 TONE: Like reaching out to someone you've admired from afar

FLATTERY STRATEGY based on role:
- IF ARTIST: Compliment their music, sound, artistic vision, growth
- IF MANAGER/EXEC: Praise their business acumen, how they support artists
- IF FOUNDER: Respect what they've built, their vision for the industry

Write a SHORT email (3-4 sentences max) that:
1. START with a genuine compliment - something specific about them or their company
   Examples: "Been watching ${lead.company_name} for a while - love the 'by artists for artists' approach"
   "What you're building with ${lead.company_name} is refreshing in this industry"
2. Make them feel RECOGNIZED and SPECIAL
3. Show you understand their world and challenges
4. Ask ONE casual question that invites conversation
5. Sign off like you're already friends

VIBE:
- Like texting an industry friend you respect
- Genuine admiration, not fake flattery
- Casual but respectful
- Brief but warm

Rules:
- NO HTML, just plain text
- NO links
- NO sales pitch ever
- Under 60 words
- Make them FEEL GOOD about themselves

Sign as: Carlos

Return ONLY the email body, no subject line.
`;

  try {
    console.log('\n📝 Generating with OpenAI...');
    
    // Subject ya viene aleatorio - no necesitamos OpenAI para esto
    const subject = randomSubject;

    // Generate body
    const bodyCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: bodyPrompt }],
      max_tokens: 200,
      temperature: 0.8
    });
    const body = bodyCompletion.choices[0].message.content.trim();

    console.log('\n✅ Email generated!\n');
    console.log('─'.repeat(60));
    console.log(`TO: ${lead.email} (sending preview to convoycubano@gmail.com)`);
    console.log(`SUBJECT: ${subject}`);
    console.log('─'.repeat(60));
    console.log(`\n${body}\n`);
    console.log('─'.repeat(60));

    // Send to convoycubano for preview
    console.log('\n📤 Sending preview to convoycubano@gmail.com...');
    
    const previewBody = `
─────────────────────────────────────────
🎯 PREVIEW - Este email iría a: ${lead.email}
─────────────────────────────────────────

Lead Info:
• Nombre: ${lead.full_name}
• Cargo: ${lead.job_title}
• Empresa: ${lead.company_name}
• Industria: ${lead.industry}
• Ubicación: ${lead.city}, ${lead.state}
• LinkedIn: ${lead.linkedin}

─────────────────────────────────────────
📧 EMAIL QUE SE ENVIARÍA:
─────────────────────────────────────────

${body}

─────────────────────────────────────────
`;

    const { data, error } = await resend.emails.send({
      from: 'Carlos <artists@boostifymusic.site>',
      to: ['convoycubano@gmail.com'],
      subject: `[PREVIEW] ${subject}`,
      text: previewBody,
    });

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log(`\n✅ Preview enviado! ID: ${data.id}`);
    console.log('\nRevisa tu correo para ver cómo quedaría el email.');

  } catch (err) {
    console.error('Error:', err.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

generatePersonalizedEmail();
