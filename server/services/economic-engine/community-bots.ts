/**
 * BOOSTIFY ECONOMIC ENGINE — Community Bots Service
 * Discord & Telegram bots for token community management
 * Automated alerts, holder verification, price updates
 */

// ============================================
// TYPES
// ============================================

export interface CommunityAlert {
  type: 'price_update' | 'new_listing' | 'whale_alert' | 'milestone' | 'agent_action' | 'system_alert';
  title: string;
  message: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export interface CommunityStats {
  discord: { configured: boolean; guildId: string; memberCount: number } | null;
  telegram: { configured: boolean; chatId: string } | null;
  twitter: { configured: boolean } | null;
}

// ============================================
// DISCORD BOT SERVICE
// ============================================

export class DiscordBotService {
  private token: string;
  private guildId: string;
  private webhookUrl: string;

  constructor() {
    this.token = process.env.DISCORD_BOT_TOKEN || '';
    this.guildId = process.env.DISCORD_GUILD_ID || '';
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
  }

  isConfigured(): boolean {
    return Boolean(this.webhookUrl || this.token);
  }

  /** Send message via webhook (no bot instance needed) */
  async sendWebhook(content: string, embeds?: any[]): Promise<boolean> {
    if (!this.webhookUrl) return false;

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          embeds,
          username: 'Boostify Economic Engine',
          avatar_url: 'https://boostifymusic.com/logo.png',
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Send a formatted alert */
  async sendAlert(alert: CommunityAlert): Promise<boolean> {
    const colorMap = { low: 0x3498db, medium: 0xf39c12, high: 0xe74c3c, critical: 0xff0000 };
    const embed = {
      title: alert.title,
      description: alert.message,
      color: colorMap[alert.urgency],
      footer: { text: `Boostify Engine • ${alert.type}` },
      timestamp: alert.timestamp,
    };

    return this.sendWebhook('', [embed]);
  }

  /** Send price update embed */
  async sendPriceUpdate(data: {
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
    liquidity: number;
  }): Promise<boolean> {
    const isUp = data.change24h >= 0;
    const embed = {
      title: `${isUp ? '📈' : '📉'} ${data.symbol} Price Update`,
      color: isUp ? 0x2ecc71 : 0xe74c3c,
      fields: [
        { name: 'Price', value: `$${data.price.toFixed(6)}`, inline: true },
        { name: '24h Change', value: `${isUp ? '+' : ''}${data.change24h.toFixed(2)}%`, inline: true },
        { name: 'Volume 24h', value: `$${(data.volume24h / 1000).toFixed(1)}K`, inline: true },
        { name: 'Liquidity', value: `$${(data.liquidity / 1000).toFixed(1)}K`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };

    return this.sendWebhook('', [embed]);
  }

  /** Send agent action notification */
  async sendAgentAction(data: {
    agent: string;
    action: string;
    amount: string;
    confidence: number;
    reasoning: string;
  }): Promise<boolean> {
    const embed = {
      title: `🤖 Agent Action: ${data.agent}`,
      color: 0x9b59b6,
      fields: [
        { name: 'Action', value: data.action, inline: true },
        { name: 'Amount', value: data.amount, inline: true },
        { name: 'Confidence', value: `${data.confidence}%`, inline: true },
        { name: 'Reasoning', value: data.reasoning.slice(0, 200) },
      ],
      timestamp: new Date().toISOString(),
    };

    return this.sendWebhook('', [embed]);
  }
}

// ============================================
// TELEGRAM BOT SERVICE
// ============================================

export class TelegramBotService {
  private token: string;
  private chatId: string;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.chatId);
  }

  /** Send a text message */
  async sendMessage(text: string, parseMode: string = 'HTML'): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text,
            parse_mode: parseMode,
            disable_web_page_preview: true,
          }),
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Send a formatted alert */
  async sendAlert(alert: CommunityAlert): Promise<boolean> {
    const urgencyEmoji = { low: 'ℹ️', medium: '⚠️', high: '🚨', critical: '🔴' };
    const text = `${urgencyEmoji[alert.urgency]} <b>${alert.title}</b>\n\n${alert.message}\n\n<i>${alert.type} • ${new Date(alert.timestamp).toLocaleString()}</i>`;
    return this.sendMessage(text);
  }

  /** Send price update */
  async sendPriceUpdate(data: {
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
  }): Promise<boolean> {
    const isUp = data.change24h >= 0;
    const emoji = isUp ? '📈' : '📉';
    const text = `${emoji} <b>${data.symbol} Price</b>\n\n💰 $${data.price.toFixed(6)}\n${isUp ? '🟢' : '🔴'} ${isUp ? '+' : ''}${data.change24h.toFixed(2)}%\n📊 Vol: $${(data.volume24h / 1000).toFixed(1)}K`;
    return this.sendMessage(text);
  }
}

// ============================================
// TWITTER/X SERVICE (Post via API v2)
// ============================================

export class TwitterService {
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private accessSecret: string;

  constructor() {
    this.apiKey = process.env.TWITTER_API_KEY || '';
    this.apiSecret = process.env.TWITTER_API_SECRET || '';
    this.accessToken = process.env.TWITTER_ACCESS_TOKEN || '';
    this.accessSecret = process.env.TWITTER_ACCESS_SECRET || '';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.accessToken);
  }

  // Note: Full Twitter OAuth 1.0a signing is complex — 
  // for production, use a library like 'twitter-api-v2'
  // This service provides the interface for when it's set up
  async postTweet(text: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    // Implementation would use twitter-api-v2 package
    console.log(`[Twitter] Would post: ${text.slice(0, 50)}...`);
    return false; // Requires twitter-api-v2 setup
  }
}

// ============================================
// UNIFIED COMMUNITY MANAGER
// ============================================

export class CommunityManager {
  private discord: DiscordBotService;
  private telegram: TelegramBotService;
  private twitter: TwitterService;

  constructor() {
    this.discord = new DiscordBotService();
    this.telegram = new TelegramBotService();
    this.twitter = new TwitterService();
  }

  /** Broadcast alert to all configured channels */
  async broadcastAlert(alert: CommunityAlert): Promise<{
    discord: boolean;
    telegram: boolean;
    twitter: boolean;
  }> {
    const [discord, telegram, twitter] = await Promise.all([
      this.discord.isConfigured() ? this.discord.sendAlert(alert) : Promise.resolve(false),
      this.telegram.isConfigured() ? this.telegram.sendAlert(alert) : Promise.resolve(false),
      Promise.resolve(false), // Twitter requires separate setup
    ]);
    return { discord, telegram, twitter };
  }

  /** Broadcast price update */
  async broadcastPriceUpdate(data: {
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
    liquidity: number;
  }): Promise<void> {
    await Promise.all([
      this.discord.isConfigured() ? this.discord.sendPriceUpdate(data) : null,
      this.telegram.isConfigured() ? this.telegram.sendPriceUpdate(data) : null,
    ]);
  }

  /** Broadcast agent action */
  async broadcastAgentAction(data: {
    agent: string;
    action: string;
    amount: string;
    confidence: number;
    reasoning: string;
  }): Promise<void> {
    if (this.discord.isConfigured()) {
      await this.discord.sendAgentAction(data);
    }
  }

  /** Get status of all community channels */
  getStatus(): CommunityStats {
    return {
      discord: this.discord.isConfigured()
        ? { configured: true, guildId: process.env.DISCORD_GUILD_ID || '', memberCount: 0 }
        : null,
      telegram: this.telegram.isConfigured()
        ? { configured: true, chatId: process.env.TELEGRAM_CHAT_ID || '' }
        : null,
      twitter: this.twitter.isConfigured() ? { configured: true } : null,
    };
  }
}

// ── Singleton ──

let _communityManager: CommunityManager | null = null;

export function getCommunityManager(): CommunityManager {
  if (!_communityManager) _communityManager = new CommunityManager();
  return _communityManager;
}
