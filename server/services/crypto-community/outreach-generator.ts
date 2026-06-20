/**
 * CRYPTO COMMUNITY — Outreach Post Generator
 * Creates professional, contextual outreach posts based on the artist's page,
 * tokens, music, and community data. Uses OpenAI for AI-powered generation.
 */

import OpenAI from 'openai';
import { db } from '../../db';
import { eq, desc, sql } from 'drizzle-orm';
import { cryptoOutreachCampaigns, cryptoOutreachContacts, cryptoOutreachLog } from '../../../db/crypto-community-schema';
import { PRIMARY_MODEL } from '../../utils/ai-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// ── Artist Context Builder ──

export interface ArtistContext {
  name: string;
  genre: string;
  biography: string;
  profileUrl: string;
  profileImage?: string;
  country?: string;
  tokenSymbol?: string;
  tokenPrice?: string;
  tokenTotalSupply?: number;
  topSongs?: string[];
  spotifyUrl?: string;
  instagramHandle?: string;
  twitterHandle?: string;
  youtubeChannel?: string;
}

/** Load full artist context from DB */
export async function loadArtistContext(artistId: number): Promise<ArtistContext> {
  const { users, songs, tokenizedSongs } = await import('../../db/schema');

  const [artist] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
  if (!artist) throw new Error(`Artist ${artistId} not found`);

  // Get top songs
  const topSongs = await db.select({ title: songs.title })
    .from(songs)
    .where(eq(songs.userId, artistId))
    .orderBy(desc(songs.playCount))
    .limit(5);

  // Get linked token
  let tokenInfo: { symbol: string; price: string; supply: number } | null = null;
  const [token] = await db.select()
    .from(tokenizedSongs)
    .where(eq(tokenizedSongs.artistId, artistId))
    .limit(1);
  if (token) {
    tokenInfo = {
      symbol: token.tokenSymbol || 'TOKEN',
      price: token.pricePerTokenUsd || '0',
      supply: token.totalSupply || 0,
    };
  }

  const baseUrl = process.env.PRODUCTION_URL || 'https://boostifymusic.com';

  return {
    name: artist.artistName || artist.username || 'Artist',
    genre: artist.genre || (artist.genres as string[] || []).join(', ') || 'Music',
    biography: artist.biography || '',
    profileUrl: `${baseUrl}/artist/${artist.slug || artistId}`,
    profileImage: artist.profileImage || undefined,
    country: artist.country || undefined,
    tokenSymbol: tokenInfo?.symbol,
    tokenPrice: tokenInfo?.price,
    tokenTotalSupply: tokenInfo?.supply,
    topSongs: topSongs.map(s => s.title).filter(Boolean) as string[],
    spotifyUrl: artist.spotifyUrl || undefined,
    instagramHandle: artist.instagramHandle || undefined,
    twitterHandle: artist.twitterHandle || undefined,
    youtubeChannel: artist.youtubeChannel || undefined,
  };
}

// ── Post Templates ──

type CampaignType = 'token_launch' | 'community_growth' | 'event_promo' | 'collaboration' | 'general';

function getSystemPrompt(campaignType: CampaignType): string {
  const base = `You are a professional social media outreach specialist for the music-crypto industry. 
You create compelling, authentic DM/posts that feel personal, not spammy. 
Write in a friendly, confident tone. Keep messages concise (max 200 words for DM, 280 chars for tweet).
Never use generic greetings like "Dear Sir/Madam". Reference the recipient's profile when {{contact_name}} is available.
Include a clear, soft CTA. Use emojis sparingly (1-3 max). Sound human, not corporate.`;

  const typeGuides: Record<CampaignType, string> = {
    token_launch: `Focus: Introduce the artist's new music token. Highlight what makes it unique (royalties, community voting, exclusive access). Create FOMO without being pushy. Mention the BoostiSwap platform for trading.`,
    community_growth: `Focus: Invite to join the artist's crypto community. Emphasize benefits: governance voting, early access, exclusive content, token holder perks. Position the community as the inner circle.`,
    event_promo: `Focus: Promote an upcoming event, release, or collaboration. Create excitement. If the artist has tokens, mention holder benefits/discounts for the event.`,
    collaboration: `Focus: Propose a collaboration or cross-promotion. Be professional and highlight mutual benefits. Show familiarity with the recipient's work. Suggest a specific, low-commitment first step.`,
    general: `Focus: General awareness and engagement. Share something interesting about the artist or their token. Ask a question or invite a response to spark conversation.`,
  };

  return `${base}\n\n${typeGuides[campaignType] || typeGuides.general}`;
}

// ── AI Generation ──

export interface OutreachPostRequest {
  artistContext: ArtistContext;
  campaignType: CampaignType;
  platform: 'instagram' | 'twitter' | 'telegram' | 'tiktok';
  contactName?: string;
  contactBio?: string;
  contactTags?: string[];
  customContext?: string;
  lang?: 'en' | 'es';
}

export interface OutreachPost {
  message: string;
  subject?: string; // for email-style DMs
  hashtags?: string[];
  platform: string;
}

export async function generateOutreachPost(req: OutreachPostRequest): Promise<OutreachPost> {
  const { artistContext, campaignType, platform, contactName, contactBio, customContext, lang } = req;

  const maxLength: Record<string, number> = {
    twitter: 280,
    instagram: 500,
    telegram: 600,
    tiktok: 300,
  };

  const artistInfo = [
    `Artist: ${artistContext.name}`,
    `Genre: ${artistContext.genre}`,
    artistContext.biography ? `Bio: ${artistContext.biography.slice(0, 200)}` : '',
    artistContext.tokenSymbol ? `Token: $${artistContext.tokenSymbol} (price: $${artistContext.tokenPrice})` : '',
    artistContext.topSongs?.length ? `Top songs: ${artistContext.topSongs.join(', ')}` : '',
    artistContext.profileUrl ? `Profile: ${artistContext.profileUrl}` : '',
    artistContext.country ? `Country: ${artistContext.country}` : '',
  ].filter(Boolean).join('\n');

  const contactInfo = contactName || contactBio
    ? `\nRecipient info:\n- Name: ${contactName || 'Unknown'}\n- Bio: ${contactBio?.slice(0, 150) || 'N/A'}\n- Tags: ${(req.contactTags || []).join(', ') || 'N/A'}`
    : '';

  const userPrompt = `Generate a ${platform} outreach message (${lang === 'es' ? 'in Spanish' : 'in English'}).
Max ${maxLength[platform] || 400} characters.
Campaign type: ${campaignType}

Artist info:
${artistInfo}
${contactInfo}
${customContext ? `\nAdditional context: ${customContext}` : ''}

Return ONLY the message text, no quotes or explanation. Include 2-3 relevant hashtags at the end for public posts (not for DMs).`;

  try {
    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: getSystemPrompt(campaignType) },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 300,
    });

    const message = completion.choices[0]?.message?.content?.trim() || '';
    const hashtagMatch = message.match(/#\w+/g);

    return {
      message: message.slice(0, maxLength[platform] || 400),
      hashtags: hashtagMatch || [],
      platform,
    };
  } catch (e: any) {
    console.error('[OutreachGenerator] AI generation failed:', e.message);
    return generateFallbackPost(req);
  }
}

/** Generate a batch of personalized posts for a campaign */
export async function generateCampaignPosts(
  artistId: number,
  campaignType: CampaignType,
  platform: string,
  contacts: Array<{ id: number; displayName?: string; bio?: string; tags?: string[] }>,
  customContext?: string,
  lang: 'en' | 'es' = 'en',
): Promise<Array<{ contactId: number; post: OutreachPost }>> {
  const artistContext = await loadArtistContext(artistId);
  const results: Array<{ contactId: number; post: OutreachPost }> = [];

  // Generate a base template first, then personalize per contact
  const basePost = await generateOutreachPost({
    artistContext,
    campaignType,
    platform: platform as any,
    customContext,
    lang,
  });

  for (const contact of contacts) {
    // For high-value contacts (with bio data), generate personalized version
    if (contact.bio && contact.bio.length > 20) {
      try {
        const personalPost = await generateOutreachPost({
          artistContext,
          campaignType,
          platform: platform as any,
          contactName: contact.displayName,
          contactBio: contact.bio,
          contactTags: contact.tags,
          customContext,
          lang,
        });
        results.push({ contactId: contact.id, post: personalPost });
        continue;
      } catch {
        // Fall through to base template
      }
    }

    // Use base template with name substitution
    const personalized = contact.displayName
      ? basePost.message.replace(/Hey\b|Hi\b|Hello\b/i, `Hey ${contact.displayName.split(' ')[0]}`)
      : basePost.message;

    results.push({
      contactId: contact.id,
      post: { ...basePost, message: personalized },
    });
  }

  return results;
}

/** Generate a campaign template (reusable) */
export async function generateCampaignTemplate(
  artistId: number,
  campaignType: CampaignType,
  platform: string,
  customContext?: string,
  lang: 'en' | 'es' = 'en',
): Promise<string> {
  const artistContext = await loadArtistContext(artistId);

  const post = await generateOutreachPost({
    artistContext,
    campaignType,
    platform: platform as any,
    contactName: '{{contact_name}}',
    customContext,
    lang,
  });

  return post.message;
}

// ── Campaign Execution ──

export async function executeCampaignBatch(
  campaignId: number,
  batchSize: number = 20,
): Promise<{ sent: number; failed: number }> {
  const [campaign] = await db.select()
    .from(cryptoOutreachCampaigns)
    .where(eq(cryptoOutreachCampaigns.id, campaignId))
    .limit(1);

  if (!campaign || campaign.status !== 'active') {
    throw new Error('Campaign not active');
  }

  // Get unsent contacts matching campaign filters
  const contacts = await db.select()
    .from(cryptoOutreachContacts)
    .where(eq(cryptoOutreachContacts.artistId, campaign.artistId))
    .limit(Math.min(batchSize, campaign.dailyLimit || 20));

  const artistContext = await loadArtistContext(campaign.artistId);
  let sent = 0, failed = 0;

  for (const contact of contacts) {
    // Personalize the template
    let message = campaign.messageTemplate;
    message = message.replace(/\{\{contact_name\}\}/gi, contact.displayName || contact.platformUsername);
    message = message.replace(/\{\{artist_name\}\}/gi, artistContext.name);
    message = message.replace(/\{\{token_symbol\}\}/gi, artistContext.tokenSymbol || 'TOKEN');
    message = message.replace(/\{\{profile_url\}\}/gi, artistContext.profileUrl);
    message = message.replace(/\{\{platform\}\}/gi, contact.platform);

    // Log the outreach attempt
    try {
      await db.insert(cryptoOutreachLog).values({
        campaignId,
        contactId: contact.id,
        artistId: campaign.artistId,
        platform: contact.platform,
        messageContent: message,
        status: 'sent',
      });

      // Update contact status
      await db.update(cryptoOutreachContacts)
        .set({
          outreachStatus: 'sent',
          lastContactedAt: new Date(),
          contactCount: sql`${cryptoOutreachContacts.contactCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(cryptoOutreachContacts.id, contact.id));

      sent++;
    } catch (e: any) {
      failed++;
      console.error(`❌ [OutreachGenerator] Send failed for ${contact.platformUsername}:`, e.message);
    }
  }

  // Update campaign stats
  await db.update(cryptoOutreachCampaigns)
    .set({
      totalSent: sql`${cryptoOutreachCampaigns.totalSent} + ${sent}`,
      totalFailed: sql`${cryptoOutreachCampaigns.totalFailed} + ${failed}`,
      updatedAt: new Date(),
    })
    .where(eq(cryptoOutreachCampaigns.id, campaignId));

  return { sent, failed };
}

// ── Fallback ──

function generateFallbackPost(req: OutreachPostRequest): OutreachPost {
  const { artistContext, campaignType, platform, lang } = req;
  const isEs = lang === 'es';

  const templates: Record<CampaignType, { en: string; es: string }> = {
    token_launch: {
      en: `🎵 ${artistContext.name} just launched $${artistContext.tokenSymbol || 'TOKEN'} — a music token that gives you real royalties & voting power. First 100 holders get exclusive access. Check it out: ${artistContext.profileUrl}`,
      es: `🎵 ${artistContext.name} lanzó $${artistContext.tokenSymbol || 'TOKEN'} — un token musical con regalías reales y poder de voto. Los primeros 100 holders tienen acceso exclusivo. Mira: ${artistContext.profileUrl}`,
    },
    community_growth: {
      en: `Hey! I'm building something special around ${artistContext.name}'s music. Token holders get voting power, early releases, and backstage access. Want in? ${artistContext.profileUrl}`,
      es: `¡Hey! Estamos creando algo especial con la música de ${artistContext.name}. Los holders del token tienen poder de voto, lanzamientos exclusivos y acceso VIP. ¿Te unes? ${artistContext.profileUrl}`,
    },
    event_promo: {
      en: `🔥 Big things coming from ${artistContext.name}! Stay tuned for an exclusive drop. Follow for updates: ${artistContext.profileUrl}`,
      es: `🔥 ¡Se vienen grandes cosas de ${artistContext.name}! Estate atento para un drop exclusivo. Síguenos: ${artistContext.profileUrl}`,
    },
    collaboration: {
      en: `Hey! Love what you're doing. ${artistContext.name} is exploring collabs with creators in the crypto-music space. Would love to chat about working together. ${artistContext.profileUrl}`,
      es: `¡Hey! Me encanta lo que haces. ${artistContext.name} busca collabs con creadores en el espacio cripto-musical. Me encantaría hablar de trabajar juntos. ${artistContext.profileUrl}`,
    },
    general: {
      en: `Check out ${artistContext.name} — ${artistContext.genre} artist pioneering music on the blockchain. ${artistContext.tokenSymbol ? `$${artistContext.tokenSymbol} token live now.` : ''} ${artistContext.profileUrl}`,
      es: `Conoce a ${artistContext.name} — artista de ${artistContext.genre} pionero en música blockchain. ${artistContext.tokenSymbol ? `Token $${artistContext.tokenSymbol} disponible.` : ''} ${artistContext.profileUrl}`,
    },
  };

  const template = templates[campaignType] || templates.general;
  const message = isEs ? template.es : template.en;

  return {
    message: platform === 'twitter' ? message.slice(0, 280) : message,
    platform,
  };
}
