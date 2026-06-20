/**
 * 🔥 DOMAIN WARMUP EMAIL SEQUENCE
 * 
 * 3 simple plain-text emails to warm up the domain before main campaign
 * Goal: Get replies to build domain reputation
 * 
 * Rules:
 * - Plain text only (no HTML)
 * - Short and personal
 * - Ask a simple question
 * - Max 20 emails/day first week
 * 
 * APIs: Loaded from environment variables (.env.secrets)
 */

export interface ArtistLead {
  id: string;
  email: string;
  name: string;
  artistName?: string;
  genre?: string;
  platform?: string; // spotify, youtube, instagram
  followers?: number;
  city?: string;
  country?: string;
  source: string;
}

export interface WarmupEmail {
  sequenceNumber: 1 | 2 | 3;
  waitDays: number;
  generatePrompt: (lead: ArtistLead) => string;
}

// ============================================
// WARMUP EMAIL PROMPTS FOR OPENAI
// ============================================

export const WARMUP_SEQUENCE: WarmupEmail[] = [
  // ============================================
  // WARMUP 1: Ask about their music style
  // ============================================
  {
    sequenceNumber: 1,
    waitDays: 0,
    generatePrompt: (lead: ArtistLead) => `
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
`
  },

  // ============================================
  // WARMUP 2: Ask about their biggest challenge
  // ============================================
  {
    sequenceNumber: 2,
    waitDays: 2,
    generatePrompt: (lead: ArtistLead) => `
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
`
  },

  // ============================================
  // WARMUP 3: Ask about collaborations
  // ============================================
  {
    sequenceNumber: 3,
    waitDays: 3,
    generatePrompt: (lead: ArtistLead) => `
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
`
  }
];

// Subject line prompts
export const SUBJECT_PROMPTS = {
  1: (lead: ArtistLead) => `
Generate a SHORT email subject line (max 6 words) for ${lead.artistName || lead.name}.
Make it personal and curious, like you're a fan reaching out.
NO emojis, NO caps, NO promotional words.
Examples: "quick question about your music", "loved your latest track", "fellow ${lead.genre || 'music'} fan here"
Return ONLY the subject line.
`,
  2: (lead: ArtistLead) => `
Generate a SHORT follow-up subject line (max 5 words) for ${lead.artistName || lead.name}.
Make it casual like checking in with someone.
NO emojis, NO caps.
Examples: "following up", "quick question", "still curious"
Return ONLY the subject line.
`,
  3: (lead: ArtistLead) => `
Generate a SHORT final email subject line (max 5 words) about collaborations.
Very casual and friendly.
NO emojis, NO caps.
Examples: "collab idea", "connecting artists", "one last thing"
Return ONLY the subject line.
`
};

// ============================================
// CONFIGURATION (API keys from environment variables)
// ============================================

export const WARMUP_CONFIG = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  resendApiKey: process.env.RESEND_API_INDUSTRY || '',
  fromEmail: 'alex@boostifymusic.site', // More personal, not "artists@"
  fromName: 'Alex from Boostify',
  maxEmailsPerDay: 20,
  model: 'gpt-4o-mini' // Fast and cheap for email generation
};
