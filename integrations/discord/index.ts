/**
 * Discord Integration for OpenClaw + Boostify
 * 
 * Setup steps:
 * 1. Create a Discord bot at https://discord.com/developers
 * 2. Set DISCORD_BOT_TOKEN in .env
 * 3. Configure channels.discord in openclaw.json
 * 4. Invite bot to your server
 */

export function getDiscordChannelConfig(): object {
  return {
    channels: {
      discord: {
        token: process.env.DISCORD_BOT_TOKEN || '',
        allowFrom: process.env.OPENCLAW_DISCORD_ALLOWLIST?.split(',') || [],
      },
    },
  };
}
