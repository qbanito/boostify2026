/**
 * Telegram Integration for OpenClaw + Boostify
 * 
 * Setup steps:
 * 1. Create a bot via @BotFather on Telegram
 * 2. Set TELEGRAM_BOT_TOKEN in .env
 * 3. Configure channels.telegram in openclaw.json
 * 4. Run: openclaw channels login --channel telegram
 */

export function getTelegramChannelConfig(): object {
  return {
    channels: {
      telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        allowFrom: process.env.OPENCLAW_TELEGRAM_ALLOWLIST?.split(',') || [],
      },
    },
  };
}
