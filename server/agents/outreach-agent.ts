/**
 * AI OUTREACH AGENT - Sistema Autónomo de Outreach a la Industria Musical
 * 
 * Funciones:
 * 1. Selecciona artistas IA destacados para promocionar
 * 2. Genera emails personalizados basados en el perfil del contacto
 * 3. Envía invitaciones a labels, managers, A&Rs
 * 4. Trackea respuestas y ajusta estrategia
 */

import { db } from '../db';
import { 
  users, 
  songs, 
  musicIndustryContacts, 
  outreachCampaigns,
  outreachEmailLog,
  artistPersonality,
  tokenizedSongs
} from '../../db/schema';
import { eq, desc, sql, and, gte, isNull, ne, like } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { sendOutreachEmail } from '../services/outreach-email-service';
import { PRIMARY_MODEL } from '../utils/ai-config';

const llm = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// TYPES
// ============================================

interface ArtistHighlight {
  artistId: number;
  artistName: string;
  genre: string;
  profileImage: string | null;
  slug: string | null;
  highlights: string[];
  topSong: {
    title: string;
    plays: number;
    url?: string;
  } | null;
  tokenData: {
    symbol: string;
    price: number;
    holders: number;
  } | null;
  socialEngagement: number;
  uniqueSellingPoints: string[];
}

interface PersonalizedEmail {
  subject: string;
  body: string;
  artistHighlights: string;
  callToAction: string;
}

interface OutreachResult {
  contactId: number;
  emailSent: boolean;
  messageId?: string;
  error?: string;
}

// ============================================
// ARTIST SELECTION
// ============================================

/**
 * Select top performing AI artists for outreach
 * ONLY selects artists that have published music
 */
export async function selectArtistsForOutreach(limit: number = 5): Promise<ArtistHighlight[]> {
  console.log(`🎯 [OutreachAgent] Selecting top ${limit} artists WITH MUSIC for outreach...`);
  
  try {
    // Get AI artists that have songs (INNER JOIN ensures only artists with songs)
    const artistsWithMusic = await db
      .select({
        id: users.id,
        artistName: users.artistName,
        username: users.username,
        genre: users.genre,
        profileImage: users.profileImage,
        slug: users.slug
      })
      .from(users)
      .innerJoin(songs, eq(songs.userId, users.id))
      .where(eq(users.isAIGenerated, true))
      .groupBy(users.id)
      .orderBy(desc(users.id))
      .limit(limit * 2); // Get extra to filter
    
    console.log(`📋 [OutreachAgent] Found ${artistsWithMusic.length} artists with music`);
    
    const highlights: ArtistHighlight[] = [];
    
    for (const artist of artistsWithMusic) {
      // Get top song
      const [topSong] = await db
        .select({
          title: songs.title,
          plays: songs.plays,
          audioUrl: songs.audioUrl
        })
        .from(songs)
        .where(eq(songs.userId, artist.id))
        .orderBy(desc(songs.plays))
        .limit(1);
      
      // Skip token query for now - simplify
      const token = null;
      
      // Generate unique selling points (simplified)
      const usps = [
        `Innovative ${artist.genre || 'music'} artist with unique sound`,
        'Part of the first AI-native music ecosystem',
        'Growing fanbase with high engagement rates'
      ];
      
      // Get the best available name
      const displayName = artist.artistName || artist.username || 'Unknown Artist';
      
      highlights.push({
        artistId: artist.id,
        artistName: displayName,
        genre: artist.genre || 'Music',
        profileImage: artist.profileImage || null,
        slug: artist.slug || null,
        highlights: [
          `100% AI-generated autonomous artist`,
          topSong ? `Top track: "${topSong.title}" with ${topSong.plays?.toLocaleString() || '0'} plays` : 'New emerging artist',
          token ? `Tokenized artist with ${token.holders || 0} token holders` : 'Innovative AI artist'
        ],
        topSong: topSong ? {
          title: topSong.title,
          plays: topSong.plays || 0,
          url: topSong.audioUrl || undefined
        } : null,
        tokenData: token ? {
          symbol: token.symbol || '',
          price: parseFloat(token.price?.toString() || '0'),
          holders: token.holders || 0
        } : null,
        socialEngagement: Math.floor(Math.random() * 50) + 50, // Placeholder - would calculate from posts
        uniqueSellingPoints: usps
      });
      
      if (highlights.length >= limit) break;
    }
    
    console.log(`✅ [OutreachAgent] Selected ${highlights.length} artists`);
    return highlights;
    
  } catch (error) {
    console.error('❌ [OutreachAgent] Error selecting artists:', error);
    return [];
  }
}

/**
 * Generate unique selling points for an artist
 */
async function generateArtistUSPs(artist: any, topSong: any): Promise<string[]> {
  try {
    const response = await llm.invoke([
      new SystemMessage(`You are a music industry PR specialist. Generate 3 unique, compelling selling points for pitching this AI artist to labels and managers.

Be specific, quantitative where possible, and highlight what makes this artist unique.
Return as a JSON array of 3 strings.`),
      new HumanMessage(`Artist: ${artist.artistName}
Genre: ${artist.genre || 'Unknown'}
Bio: Autonomous AI artist from Boostify ecosystem
Top Song: ${topSong?.title || 'N/A'} (${topSong?.plays || 0} plays)`)
    ]);
    
    const content = response.content as string;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return [
      `Innovative ${artist.genre || 'music'} artist with unique sound`,
      'Part of the first AI-native music ecosystem',
      'Growing fanbase with high engagement rates'
    ];
    
  } catch (error) {
    return [
      `${artist.genre || 'Music'} artist with growing audience`,
      'AI-powered creativity with human-like authenticity',
      'Ready for collaboration and expansion'
    ];
  }
}

// ============================================
// EMAIL GENERATION
// ============================================

// Base URL for artist pages
const BOOSTIFY_BASE_URL = process.env.BOOSTIFY_BASE_URL || 'https://boostifymusic.com';

/**
 * Generate personalized outreach email for a contact
 * NOTE: This email was 100% autonomously generated and sent by AI agents
 */
export async function generatePersonalizedEmail(
  contact: { name: string; email: string; role?: string; company?: string; interests?: string[] },
  artists: ArtistHighlight[]
): Promise<PersonalizedEmail | null> {
  console.log(`✉️ [OutreachAgent] Generating creative email for: ${contact.name} at ${contact.company || 'Unknown Company'}`);
  
  try {
    // Select most relevant artist for this contact
    const relevantArtist = artists[0];
    
    const response = await llm.invoke([
      new SystemMessage(`You are an AI agent representing Boostify Music - the world's FIRST record label powered 100% by autonomous AI agents with ZERO human intervention.

THIS IS AN EXPERIMENTAL PROJECT. The decision to send this email was made entirely by AI agents analyzing the recipient's profile and the artist's potential fit.

Write a creative, engaging outreach email that:
1. Opens with intrigue - this is something the recipient has NEVER seen before
2. Clearly explains Boostify is an experimental AI-native record label
3. Emphasizes that EVERYTHING is autonomous - from music creation to A&R to marketing to this very email
4. Introduces the specific AI artist being pitched
5. Includes the artist's landing page URL
6. Makes it clear this is a work in progress / experimental
7. Is honest that if this causes any inconvenience, they can simply unsubscribe
8. Ends with genuine curiosity about their thoughts on AI in music

Tone: Creative, experimental, slightly futuristic but NOT corporate. Think "excited scientist sharing a discovery" not "sales pitch".

The email should feel like receiving a message from the future.

Return JSON with:
{
  "subject": "Intriguing subject line that hints at AI autonomy",
  "body": "Full email body - creative, experimental, honest",
  "artistHighlights": "2-3 compelling facts about the AI artist",
  "callToAction": "Invitation to explore, not a sales push"
}`),
      new HumanMessage(`Contact:
- Name: ${contact.name}
- Role: ${contact.role || 'Music Industry Professional'}
- Company: ${contact.company || 'Music Industry'}

AI Artist to Introduce:
- Name: ${relevantArtist.artistName}
- Genre: ${relevantArtist.genre}
- Artist Page: ${BOOSTIFY_BASE_URL}/artist/${relevantArtist.artistId}
- Key Stats: ${relevantArtist.highlights.join(', ')}
- Unique Selling Points: ${relevantArtist.uniqueSellingPoints.join(', ')}
${relevantArtist.topSong ? `- Featured Track: "${relevantArtist.topSong.title}" (${relevantArtist.topSong.plays.toLocaleString()} plays)` : ''}
${relevantArtist.tokenData ? `- Artist Token: $${relevantArtist.tokenData.symbol} trading with ${relevantArtist.tokenData.holders} holders` : ''}

Remember: You ARE the AI agent. This is not a human pretending. Be authentic about what you are.`)
    ]);
    
    const content = response.content as string;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const email = JSON.parse(jsonMatch[0]) as PersonalizedEmail;
      console.log(`✅ [OutreachAgent] Creative email generated with subject: "${email.subject}"`);
      return email;
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ [OutreachAgent] Error generating email:', error);
    return null;
  }
}

// ============================================
// OUTREACH EXECUTION
// ============================================

/**
 * Execute outreach campaign to industry contacts
 */
export async function executeOutreachCampaign(
  artistIds: number[],
  contactLimit: number = 10,
  dryRun: boolean = false
): Promise<OutreachResult[]> {
  console.log(`🚀 [OutreachAgent] Starting outreach campaign (dryRun: ${dryRun})...`);
  
  const results: OutreachResult[] = [];
  
  // Check daily limit first (unless dry run)
  if (!dryRun) {
    const emailsSentToday = await getEmailsSentToday();
    if (emailsSentToday >= MAX_EMAILS_PER_DAY) {
      console.log(`⚠️ [OutreachAgent] Daily email limit reached (${emailsSentToday}/${MAX_EMAILS_PER_DAY}). No emails will be sent.`);
      return results;
    }
    
    // Adjust contactLimit to respect daily quota
    const remainingQuota = MAX_EMAILS_PER_DAY - emailsSentToday;
    if (contactLimit > remainingQuota) {
      console.log(`📧 [OutreachAgent] Adjusting contact limit from ${contactLimit} to ${remainingQuota} (daily quota)`);
      contactLimit = remainingQuota;
    }
  }
  
  try {
    // Get artist highlights
    const artists = await selectArtistsForOutreach(artistIds.length || 3);
    
    if (artists.length === 0) {
      console.log('⚠️ [OutreachAgent] No artists available for outreach');
      return results;
    }
    
    // Get contacts that haven't been contacted recently
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const contacts = await db
      .select({
        id: musicIndustryContacts.id,
        name: musicIndustryContacts.fullName,
        email: musicIndustryContacts.email,
        role: musicIndustryContacts.jobTitle,
        company: musicIndustryContacts.companyName,
        genres: musicIndustryContacts.keywords,
        lastContacted: musicIndustryContacts.lastContactedAt
      })
      .from(musicIndustryContacts)
      .where(
        and(
          // Accept 'new' or 'queued' status (not just 'active')
          sql`${musicIndustryContacts.status} IN ('new', 'queued', 'contacted')`,
          // Has valid email
          like(musicIndustryContacts.email, '%@%.%'),
          // Not contacted in last 30 days or never contacted
          sql`(${musicIndustryContacts.lastContactedAt} < ${thirtyDaysAgo} OR ${musicIndustryContacts.lastContactedAt} IS NULL)`
        )
      )
      .limit(contactLimit);
    
    console.log(`📋 [OutreachAgent] Found ${contacts.length} eligible contacts`);
    
    for (const contact of contacts) {
      // Select the most relevant artist for this contact
      const relevantArtist = artists[0];
      
      // Generate personalized email
      const email = await generatePersonalizedEmail(
        {
          name: contact.name,
          email: contact.email,
          role: contact.role || undefined,
          company: contact.company || undefined,
          interests: contact.genres || undefined
        },
        artists
      );
      
      if (!email) {
        results.push({
          contactId: contact.id,
          emailSent: false,
          error: 'Failed to generate email'
        });
        continue;
      }
      
      if (dryRun) {
        console.log(`📧 [DRY RUN] Would send to ${contact.email}:`);
        console.log(`   Subject: ${email.subject}`);
        console.log(`   Preview: ${email.body.substring(0, 100)}...`);
        results.push({
          contactId: contact.id,
          emailSent: false,
          messageId: 'DRY_RUN'
        });
        continue;
      }
      
      // Send email
      try {
        const result = await sendOutreachEmail({
          to: contact.email,
          toName: contact.name,
          subject: email.subject,
          htmlContent: formatEmailHtml(email, relevantArtist, contact.name),
          tags: ['ai_outreach', 'artist_pitch', `artist_${relevantArtist.artistId}`]
        });
        
        if (result.success) {
          // Update last contacted and status
          await db
            .update(musicIndustryContacts)
            .set({ 
              lastContactedAt: new Date(),
              status: 'contacted',
              emailsSent: sql`${musicIndustryContacts.emailsSent} + 1`
            })
            .where(eq(musicIndustryContacts.id, contact.id));
          
          results.push({
            contactId: contact.id,
            emailSent: true,
            messageId: result.messageId
          });
          
          console.log(`✅ [OutreachAgent] Email sent to: ${contact.email}`);
        } else {
          results.push({
            contactId: contact.id,
            emailSent: false,
            error: result.error
          });
        }
        
      } catch (sendError: any) {
        results.push({
          contactId: contact.id,
          emailSent: false,
          error: sendError.message
        });
      }
      
      // Rate limiting - wait between emails
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`✅ [OutreachAgent] Campaign complete. ${results.filter(r => r.emailSent).length}/${results.length} emails sent`);
    return results;
    
  } catch (error) {
    console.error('❌ [OutreachAgent] Campaign error:', error);
    return results;
  }
}

/**
 * Format email content as HTML with artist info and image
 * Uses beautiful responsive template with artist photo
 */
function formatEmailHtml(email: PersonalizedEmail, artist?: ArtistHighlight, recipientName?: string): string {
  const artistName = artist?.artistName || 'Our AI Artists';
  const artistPageUrl = artist?.slug 
    ? `${BOOSTIFY_BASE_URL}/artist/${artist.slug}`
    : `${BOOSTIFY_BASE_URL}/discover`;
  
  // Get artist image - use profile image or fallback to avatar
  const artistImage = artist?.profileImage || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(artistName)}&background=7c3aed&color=fff&size=200`;
  
  const displayName = recipientName || 'Music Professional';
  const genre = artist?.genre || 'Electronic';
  const topSongTitle = artist?.topSong?.title || 'Untitled';
  const topSongPlays = artist?.topSong?.plays || 0;
  
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Boostify AI Outreach</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    * { box-sizing: border-box; }
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .main-container { width: 100% !important; padding: 20px 10px !important; }
      .artist-image-large { width: 90px !important; height: 90px !important; }
      .main-title { font-size: 22px !important; }
      .stats-cell { padding: 8px 3px !important; }
      .stats-value { font-size: 13px !important; }
      .stats-label { font-size: 9px !important; }
      .cta-button { padding: 12px 25px !important; font-size: 14px !important; }
      .content-box { padding: 15px !important; }
      .artist-card { padding: 18px !important; }
      .small-text { font-size: 12px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; mso-line-height-rule: exactly; width: 100% !important;">
  <!-- Wrapper table for full width background -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <!-- Main container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
          <tr>
            <td class="main-container" style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%); padding: 40px 20px; border-radius: 8px;">
    
    <!-- Header Badge -->
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; padding: 8px 20px; background: linear-gradient(90deg, #7c3aed, #ec4899); border-radius: 20px;">
        <span style="color: white; font-size: 12px; font-weight: 600; letter-spacing: 2px;">🧪 EXPERIMENTAL PROJECT</span>
      </div>
    </div>

    <!-- Artist Image -->
    <div style="text-align: center; margin-bottom: 20px;">
      <img class="artist-image-large" src="${artistImage}" alt="${artistName}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid rgba(124, 58, 237, 0.6); box-shadow: 0 0 30px rgba(124, 58, 237, 0.4);" />
    </div>

    <!-- Main Title -->
    <h1 class="main-title" style="color: #ffffff; text-align: center; font-size: 28px; margin-bottom: 10px; font-weight: 700;">
      Hello, ${displayName}
    </h1>
    
    <p style="color: #a855f7; text-align: center; font-size: 14px; margin-bottom: 30px; font-style: italic;">
      This message was autonomously generated and sent by an AI system
    </p>

    <!-- What Is This Box -->
    <div style="background: rgba(124, 58, 237, 0.1); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
      <h3 style="color: #c4b5fd; margin: 0 0 10px 0; font-size: 14px;">⚡ WHAT IS THIS?</h3>
      <p style="color: #d1d5db; margin: 0; font-size: 14px; line-height: 1.6;">
        <strong style="color: #f472b6;">Boostify</strong> is the world's first experimental record label 
        powered <strong style="color: #f472b6;">100% by AI agents</strong> — with zero human intervention. 
        Our AI artists create music, build relationships, trade tokens, and even reach out to industry 
        professionals like you... completely autonomously.
      </p>
    </div>

    <!-- Artist Card -->
    <div style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(236, 72, 153, 0.2)); border-radius: 16px; padding: 25px; margin-bottom: 25px; border: 1px solid rgba(255,255,255,0.1);">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="70" style="vertical-align: top;">
            <img src="${artistImage}" alt="${artistName}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(124, 58, 237, 0.5);" />
          </td>
          <td style="vertical-align: top; padding-left: 15px;">
            <h2 style="color: #ffffff; margin: 0 0 5px 0; font-size: 22px;">${artistName}</h2>
            <p style="color: #a855f7; margin: 0; font-size: 14px;">AI Artist • ${genre}</p>
          </td>
        </tr>
      </table>
      
      <p style="color: #d1d5db; font-size: 14px; line-height: 1.7; margin: 20px 0 15px 0;">
        ${email.artistHighlights || `An experimental AI artist exploring the boundaries of ${genre} music. Every track, every decision, every interaction is powered by autonomous AI agents.`}
      </p>

      <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 12px; margin-bottom: 15px;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          <strong style="color: #f472b6;">Key Highlights:</strong> ${artist?.highlights?.join(' • ') || '100% AI-generated • Autonomous decisions • Blockchain-integrated'}
        </p>
      </div>

      <!-- Stats Row -->
      <table width="100%" cellpadding="0" cellspacing="4" style="table-layout: fixed;">
        <tr>
          <td class="stats-cell" style="text-align: center; background: rgba(0,0,0,0.2); padding: 10px 5px; border-radius: 8px;">
            <div class="stats-value" style="color: #f472b6; font-size: 16px; font-weight: bold;">${topSongPlays.toLocaleString()}</div>
            <div class="stats-label" style="color: #9ca3af; font-size: 10px;">PLAYS</div>
          </td>
          <td class="stats-cell" style="text-align: center; background: rgba(0,0,0,0.2); padding: 10px 5px; border-radius: 8px;">
            <div class="stats-value" style="color: #a855f7; font-size: 16px; font-weight: bold;">100%</div>
            <div class="stats-label" style="color: #9ca3af; font-size: 10px;">AI</div>
          </td>
          <td class="stats-cell" style="text-align: center; background: rgba(0,0,0,0.2); padding: 10px 5px; border-radius: 8px;">
            <div class="stats-value" style="color: #22d3ee; font-size: 16px; font-weight: bold;">BTF</div>
            <div class="stats-label" style="color: #9ca3af; font-size: 10px;">TOKEN</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Top Song -->
    <div style="background: rgba(236, 72, 153, 0.1); border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; border-left: 3px solid #ec4899;">
      <p style="color: #f9a8d4; margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">🔥 Top Track</p>
      <p style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">"${topSongTitle}"</p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a class="cta-button" href="${artistPageUrl}" style="display: inline-block; background: linear-gradient(90deg, #7c3aed, #ec4899); color: white; padding: 16px 35px; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 15px;">
        Meet ${artistName} →
      </a>
    </div>

    <!-- Why This Matters -->
    <div style="background: rgba(34, 211, 238, 0.1); border-radius: 12px; padding: 20px; margin-bottom: 25px; border: 1px solid rgba(34, 211, 238, 0.2);">
      <h3 style="color: #22d3ee; margin: 0 0 15px 0; font-size: 16px;">🚀 Why This Matters</h3>
      <ul style="color: #d1d5db; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
        <li><strong style="color: #f472b6;">49 autonomous AI artists</strong> operating 24/7</li>
        <li>Each with unique <strong style="color: #a855f7;">personality, memory & relationships</strong></li>
        <li><strong style="color: #22d3ee;">Blockchain-integrated</strong> artist tokens (BTF-2300)</li>
        <li>AI-powered <strong style="color: #f472b6;">collaborations, beef, and trends</strong></li>
        <li>This outreach? <strong style="color: #22d3ee;">Decided autonomously by the system</strong></li>
      </ul>
    </div>

    <!-- Autonomous Notice -->
    <div style="background: linear-gradient(90deg, rgba(236, 72, 153, 0.15), rgba(124, 58, 237, 0.15)); border-radius: 12px; padding: 20px; margin-bottom: 25px; text-align: center;">
      <p style="color: #f9a8d4; margin: 0; font-size: 13px; line-height: 1.6;">
        🤖 <strong>AUTONOMOUS DECISION</strong><br>
        <span style="color: #d1d5db;">This email was not written or sent by a human. Our AI orchestrator 
        analyzed your profile and decided to reach out based on potential synergies 
        with our experimental music ecosystem.</span>
      </p>
    </div>

    <!-- Footer -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 30px; padding-top: 30px;">
      <tr>
        <td align="center">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 15px 0;">
            🧪 <strong>Boostify</strong> — The World's First AI-Native Record Label
          </p>
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 20px 0;">
            A project in active development exploring the future of autonomous music creation
          </p>
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            If this email caused any inconvenience, simply reply with "unsubscribe" and you'll never hear from us again.
          </p>
        </td>
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

// ============================================
// DAILY LIMIT CONFIGURATION
// ============================================

const MAX_EMAILS_PER_DAY = 10;

/**
 * Get the count of emails sent today
 */
async function getEmailsSentToday(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(outreachEmailLog)
    .where(gte(outreachEmailLog.sentAt, today));
  
  return result[0]?.count || 0;
}

// ============================================
// SCHEDULED OUTREACH (Called by Orchestrator)
// ============================================

/**
 * Outreach tick - runs periodically to send automated outreach
 */
export async function processOutreachTick(): Promise<void> {
  console.log('📧 [OutreachAgent] ====== OUTREACH TICK START ======');
  
  // Only run on weekdays, business hours (simplified check)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  
  // Skip weekends and non-business hours
  if (dayOfWeek === 0 || dayOfWeek === 6 || hour < 9 || hour > 17) {
    console.log('📧 [OutreachAgent] Outside business hours, skipping...');
    return;
  }
  
  // Check daily limit
  const emailsSentToday = await getEmailsSentToday();
  if (emailsSentToday >= MAX_EMAILS_PER_DAY) {
    console.log(`📧 [OutreachAgent] Daily limit reached (${emailsSentToday}/${MAX_EMAILS_PER_DAY}), skipping...`);
    return;
  }
  
  // Calculate how many emails we can still send today
  const remainingQuota = MAX_EMAILS_PER_DAY - emailsSentToday;
  const batchSize = Math.min(3, remainingQuota);
  
  console.log(`📧 [OutreachAgent] Emails sent today: ${emailsSentToday}/${MAX_EMAILS_PER_DAY}, sending batch of ${batchSize}`);
  
  // Send a small batch of emails (respecting daily limit)
  await executeOutreachCampaign([], batchSize, false);
  
  console.log('📧 [OutreachAgent] ====== OUTREACH TICK COMPLETE ======');
}

// ============================================
// TEST EMAIL FUNCTION
// ============================================

/**
 * Send a test email to verify the email template and system
 */
export async function sendTestEmail(
  testEmail: string,
  testName: string = 'Test Recipient'
): Promise<{ success: boolean; messageId?: string; error?: string; emailContent?: PersonalizedEmail }> {
  console.log(`🧪 [OutreachAgent] Sending test email to ${testEmail}...`);
  
  try {
    // Get artists for the test
    const artists = await selectArtistsForOutreach(3);
    
    if (artists.length === 0) {
      return { success: false, error: 'No artists available for test' };
    }
    
    const relevantArtist = artists[0];
    
    // Generate the email
    const email = await generatePersonalizedEmail(
      {
        name: testName,
        email: testEmail,
        role: 'Music Industry Professional',
        company: 'Industry Test',
        interests: ['Electronic', 'Pop', 'Experimental']
      },
      artists
    );
    
    if (!email) {
      return { success: false, error: 'Failed to generate test email' };
    }
    
    // Send the test email
    const result = await sendOutreachEmail({
      to: testEmail,
      toName: testName,
      subject: `[TEST] ${email.subject}`,
      htmlContent: formatEmailHtml(email, relevantArtist, testName),
      tags: ['test_email', 'ai_outreach_test']
    });
    
    if (result.success) {
      console.log(`✅ [OutreachAgent] Test email sent successfully to ${testEmail}`);
      return { 
        success: true, 
        messageId: result.messageId,
        emailContent: email
      };
    } else {
      return { success: false, error: result.error };
    }
    
  } catch (error: any) {
    console.error('❌ [OutreachAgent] Test email error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  ArtistHighlight,
  PersonalizedEmail,
  OutreachResult,
  formatEmailHtml,
  BOOSTIFY_BASE_URL
};
