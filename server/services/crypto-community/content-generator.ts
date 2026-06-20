/**
 * CRYPTO COMMUNITY — Content Generator
 * AI-powered content generation for crypto community posts
 * Adapts artist news/events into crypto-native messaging
 */

import OpenAI from 'openai';
import { PRIMARY_MODEL } from '../../utils/ai-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ContentRequest {
  type: 'news' | 'price_alert' | 'token_update' | 'proposal' | 'milestone' | 'custom';
  artistName: string;
  tokenSymbol?: string;
  context: string; // raw news/event text
  channels: ('telegram' | 'discord' | 'twitter')[];
  tokenData?: {
    price: number;
    change24h: number;
    volume24h: number;
    holders: number;
    liquidity: number;
  };
}

export interface GeneratedContent {
  telegram?: string;  // HTML formatted
  discord?: string;   // Markdown + embeds format
  twitter?: string;   // 280 char limit
  summary: string;
}

const SYSTEM_PROMPT = `You are a crypto community manager for music artists on the Boostify platform.
Your job is to create engaging posts for Telegram, Discord, and Twitter/X that bridge music and crypto communities.
Keep the tone professional but exciting. Use relevant emojis. Include calls to action.
For price updates, be factual — never guarantee returns. For proposals, be neutral and informative.
Always mention the artist's token symbol with $ prefix when relevant.
Telegram: Use HTML tags (<b>, <i>, <code>, <a>). Max 4096 chars.
Discord: Use Markdown. Can be longer. Include section headers with ##.
Twitter/X: Max 280 chars. Punchy, hashtags at end. One key message.`;

export class CryptoContentGenerator {

  async generate(request: ContentRequest): Promise<GeneratedContent> {
    const channelInstructions = request.channels.map(ch => {
      if (ch === 'telegram') return 'Telegram (HTML format, <b>bold</b>, emojis, max 4096 chars)';
      if (ch === 'discord') return 'Discord (Markdown, ## headers, emojis, can be longer)';
      return 'Twitter/X (plain text, max 280 chars, hashtags)';
    }).join('\n');

    const tokenContext = request.tokenData
      ? `\nToken: $${request.tokenSymbol} | Price: $${request.tokenData.price.toFixed(6)} | 24h: ${request.tokenData.change24h > 0 ? '+' : ''}${request.tokenData.change24h.toFixed(2)}% | Vol: $${request.tokenData.volume24h.toFixed(0)} | Holders: ${request.tokenData.holders} | Liquidity: $${request.tokenData.liquidity.toFixed(0)}`
      : '';

    const userPrompt = `Generate a ${request.type} post for ${request.artistName}'s crypto community.
${tokenContext}

Context: ${request.context}

Generate content for these channels:
${channelInstructions}

Respond in JSON format:
{
  ${request.channels.includes('telegram') ? '"telegram": "HTML formatted message",' : ''}
  ${request.channels.includes('discord') ? '"discord": "Markdown formatted message",' : ''}
  ${request.channels.includes('twitter') ? '"twitter": "280 char max tweet",' : ''}
  "summary": "One line summary"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1500,
      });

      const content = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        telegram: content.telegram,
        discord: content.discord,
        twitter: content.twitter,
        summary: content.summary || 'Post generated',
      };
    } catch (error) {
      console.error('[CryptoContentGen] AI generation failed:', error);
      return this.generateFallback(request);
    }
  }

  private generateFallback(request: ContentRequest): GeneratedContent {
    const { artistName, tokenSymbol, context, type } = request;
    const sym = tokenSymbol ? `$${tokenSymbol}` : '';
    const emoji = type === 'price_alert' ? '📊' : type === 'proposal' ? '🗳️' : type === 'milestone' ? '🏆' : '🎵';

    const base = `${emoji} ${artistName} ${type.replace('_', ' ').toUpperCase()}\n\n${context}${sym ? `\n\n💎 Token: ${sym}` : ''}`;

    return {
      telegram: `<b>${emoji} ${artistName}</b>\n\n${context}${sym ? `\n\n💎 <b>${sym}</b> on BoostiSwap` : ''}`,
      discord: `## ${emoji} ${artistName}\n\n${context}${sym ? `\n\n💎 **${sym}** on BoostiSwap` : ''}`,
      twitter: `${emoji} ${artistName}: ${context.slice(0, 200)}${sym ? ` ${sym}` : ''} #Boostify #MusicNFT`,
      summary: base.slice(0, 100),
    };
  }

  async generatePriceAlert(artistName: string, tokenSymbol: string, tokenData: ContentRequest['tokenData']): Promise<GeneratedContent> {
    return this.generate({
      type: 'price_alert',
      artistName,
      tokenSymbol,
      context: `Token price update for $${tokenSymbol}`,
      channels: ['telegram', 'discord', 'twitter'],
      tokenData,
    });
  }

  async generateProposalAnnouncement(artistName: string, proposalTitle: string, proposalDescription: string, tokenSymbol?: string): Promise<GeneratedContent> {
    return this.generate({
      type: 'proposal',
      artistName,
      tokenSymbol,
      context: `New community proposal: "${proposalTitle}" — ${proposalDescription}`,
      channels: ['telegram', 'discord', 'twitter'],
    });
  }

  async generateMilestone(artistName: string, milestone: string, tokenSymbol?: string, tokenData?: ContentRequest['tokenData']): Promise<GeneratedContent> {
    return this.generate({
      type: 'milestone',
      artistName,
      tokenSymbol,
      context: milestone,
      channels: ['telegram', 'discord', 'twitter'],
      tokenData,
    });
  }
}

let _generator: CryptoContentGenerator | null = null;
export function getCryptoContentGenerator(): CryptoContentGenerator {
  if (!_generator) _generator = new CryptoContentGenerator();
  return _generator;
}
