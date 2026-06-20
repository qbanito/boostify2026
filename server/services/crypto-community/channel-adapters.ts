/**
 * CRYPTO COMMUNITY — Channel Adapters
 * Extends the existing community-bots.ts services with per-artist channel support
 * Connects with BoostiSwap token data for enriched messages
 */

import { getCommunityManager, CommunityAlert } from '../economic-engine/community-bots';

// ── Per-Artist Channel Config ──

export interface ArtistChannelConfig {
  artistId: number;
  telegram?: { botToken: string; groupId: string };
  discord?: { webhookUrl: string; serverId?: string };
  twitter?: { handle: string };
}

// ── Telegram Per-Artist Adapter ──

export class ArtistTelegramAdapter {
  private botToken: string;
  private groupId: string;

  constructor(botToken: string, groupId: string) {
    this.botToken = botToken;
    this.groupId = groupId;
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.groupId);
  }

  async sendMessage(text: string, parseMode = 'HTML'): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.groupId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: false,
        }),
      });
      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      console.error('[CryptoCommunity:Telegram] Send failed:', error);
      return false;
    }
  }
}

// ── Discord Per-Artist Adapter ──

export class ArtistDiscordAdapter {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  isConfigured(): boolean {
    return Boolean(this.webhookUrl);
  }

  async sendMessage(content: string, embeds?: any[]): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.slice(0, 2000),
          embeds: embeds?.slice(0, 10),
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('[CryptoCommunity:Discord] Send failed:', error);
      return false;
    }
  }

  async sendRichEmbed(params: {
    title: string;
    description: string;
    color: number;
    fields?: { name: string; value: string; inline?: boolean }[];
    footer?: string;
    url?: string;
  }): Promise<boolean> {
    const embed = {
      title: params.title,
      description: params.description,
      color: params.color,
      fields: params.fields || [],
      footer: params.footer ? { text: params.footer } : { text: 'Boostify Crypto Community' },
      url: params.url,
      timestamp: new Date().toISOString(),
    };
    return this.sendMessage('', [embed]);
  }
}

// ── Twitter/X Adapter ──

export class ArtistTwitterAdapter {
  private handle: string;

  constructor(handle: string) {
    this.handle = handle;
  }

  isConfigured(): boolean {
    return Boolean(this.handle && process.env.TWITTER_API_KEY);
  }

  async postTweet(text: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    // Twitter API v2 integration — requires twitter-api-v2 package
    try {
      // Placeholder: will use twitter-api-v2 when keys configured
      console.log(`[CryptoCommunity:Twitter] Would post for @${this.handle}: ${text.slice(0, 50)}...`);
      return false;
    } catch (error) {
      console.error('[CryptoCommunity:Twitter] Post failed:', error);
      return false;
    }
  }
}

// ── Unified Multi-Channel Broadcaster ──

export interface BroadcastResult {
  telegram: boolean;
  discord: boolean;
  twitter: boolean;
}

export class ArtistChannelBroadcaster {
  private telegram: ArtistTelegramAdapter | null = null;
  private discord: ArtistDiscordAdapter | null = null;
  private twitter: ArtistTwitterAdapter | null = null;

  constructor(config: ArtistChannelConfig) {
    if (config.telegram) {
      this.telegram = new ArtistTelegramAdapter(config.telegram.botToken, config.telegram.groupId);
    }
    if (config.discord) {
      this.discord = new ArtistDiscordAdapter(config.discord.webhookUrl);
    }
    if (config.twitter) {
      this.twitter = new ArtistTwitterAdapter(config.twitter.handle);
    }
  }

  async broadcast(content: {
    telegram?: string;
    discord?: string;
    twitter?: string;
  }): Promise<BroadcastResult> {
    const results = await Promise.allSettled([
      content.telegram && this.telegram?.isConfigured()
        ? this.telegram.sendMessage(content.telegram)
        : Promise.resolve(false),
      content.discord && this.discord?.isConfigured()
        ? this.discord.sendMessage(content.discord)
        : Promise.resolve(false),
      content.twitter && this.twitter?.isConfigured()
        ? this.twitter.postTweet(content.twitter)
        : Promise.resolve(false),
    ]);

    return {
      telegram: results[0].status === 'fulfilled' && results[0].value === true,
      discord: results[1].status === 'fulfilled' && results[1].value === true,
      twitter: results[2].status === 'fulfilled' && results[2].value === true,
    };
  }

  async broadcastPriceAlert(params: {
    tokenSymbol: string;
    price: number;
    change24h: number;
    volume24h: number;
    liquidity: number;
    artistName: string;
  }): Promise<BroadcastResult> {
    const { tokenSymbol, price, change24h, volume24h, artistName } = params;
    const arrow = change24h >= 0 ? '🟢 ↑' : '🔴 ↓';

    const telegramMsg = `<b>📊 $${tokenSymbol} Price Update</b>\n\n${arrow} <b>$${price.toFixed(6)}</b> (${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%)\n📈 Volume: $${volume24h.toFixed(0)}\n💧 Liquidity: $${params.liquidity.toFixed(0)}\n\n🎵 <b>${artistName}</b> on BoostiSwap`;

    const discordMsg = `## 📊 $${tokenSymbol} Price Update\n${arrow} **$${price.toFixed(6)}** (${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%)\n📈 Volume: $${volume24h.toFixed(0)}\n💧 Liquidity: $${params.liquidity.toFixed(0)}\n\n🎵 **${artistName}** on BoostiSwap`;

    const twitterMsg = `${arrow} $${tokenSymbol} $${price.toFixed(6)} (${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%) | Vol $${volume24h.toFixed(0)} | ${artistName} #Boostify #BoostiSwap`;

    return this.broadcast({ telegram: telegramMsg, discord: discordMsg, twitter: twitterMsg });
  }

  getStatus(): { telegram: boolean; discord: boolean; twitter: boolean } {
    return {
      telegram: this.telegram?.isConfigured() || false,
      discord: this.discord?.isConfigured() || false,
      twitter: this.twitter?.isConfigured() || false,
    };
  }
}
