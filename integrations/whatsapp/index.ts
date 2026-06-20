/**
 * WhatsApp Integration for OpenClaw + Boostify
 * 
 * Placeholder for connecting OpenClaw's WhatsApp channel
 * to Boostify's artist management workflows.
 * 
 * Setup steps:
 * 1. Run: openclaw channels login --channel whatsapp
 * 2. Scan QR code with WhatsApp
 * 3. Configure allowFrom in openclaw.json
 * 4. Set webhook to route messages to Boostify adapters
 */

export interface WhatsAppConfig {
  allowFrom: string[];
  groups?: Record<string, { requireMention: boolean }>;
}

export const WHATSAPP_DEFAULT_CONFIG: WhatsAppConfig = {
  allowFrom: [],
  groups: {},
};

export function getWhatsAppChannelConfig(): object {
  return {
    channels: {
      whatsapp: {
        allowFrom: process.env.OPENCLAW_WHATSAPP_ALLOWLIST?.split(',') || [],
      },
    },
  };
}
