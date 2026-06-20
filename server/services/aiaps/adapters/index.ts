/**
 * Common adapter interface for social platform integrations.
 * Each platform (Instagram, TikTok, YouTube, Spotify, etc.) implements
 * this interface. The actual execution happens in the Chrome extension
 * or server-side Playwright workers; this module defines the contract
 * and provides a registry + dispatch.
 */

export interface AdapterContext {
  artistId: string;
  accountId: number;
  username?: string;
  email?: string;
  phone?: string;
  vaultRef?: string;
}

export interface PlatformAdapter {
  platform: string;
  enabled: boolean;
  capabilities: {
    signup: boolean;
    verify: boolean;
    configureProfile: boolean;
    post: boolean;
    healthCheck: boolean;
  };
  signup?: (ctx: AdapterContext) => Promise<{ ok: boolean; pendingVerification?: boolean; detail?: string }>;
  verify?: (ctx: AdapterContext, code: string) => Promise<{ ok: boolean }>;
  configureProfile?: (ctx: AdapterContext, profile: Record<string, any>) => Promise<{ ok: boolean }>;
  post?: (ctx: AdapterContext, content: { text?: string; mediaUrl?: string }) => Promise<{ ok: boolean; postUrl?: string }>;
  healthCheck?: (ctx: AdapterContext) => Promise<{ score: number; status: string; alerts?: any[] }>;
}

const registry = new Map<string, PlatformAdapter>();

export function registerAdapter(a: PlatformAdapter): void {
  registry.set(a.platform, a);
}

export function getAdapter(platform: string): PlatformAdapter | undefined {
  return registry.get(platform);
}

export function listAdapters(): PlatformAdapter[] {
  return Array.from(registry.values());
}

// ---- Instagram stub ----
registerAdapter({
  platform: 'instagram',
  enabled: true,
  capabilities: { signup: true, verify: true, configureProfile: true, post: true, healthCheck: true },
  signup: async () => ({ ok: true, pendingVerification: true, detail: 'Queued for Chrome extension worker' }),
  verify: async () => ({ ok: true }),
  configureProfile: async () => ({ ok: true }),
  post: async () => ({ ok: true }),
  healthCheck: async () => ({ score: 95, status: 'healthy' }),
});

// ---- TikTok stub ----
registerAdapter({
  platform: 'tiktok',
  enabled: true,
  capabilities: { signup: true, verify: true, configureProfile: true, post: true, healthCheck: true },
  signup: async () => ({ ok: true, pendingVerification: true, detail: 'Queued for Chrome extension worker' }),
  verify: async () => ({ ok: true }),
  configureProfile: async () => ({ ok: true }),
  post: async () => ({ ok: true }),
  healthCheck: async () => ({ score: 90, status: 'healthy' }),
});

// ---- Spotify (official API placeholder) ----
registerAdapter({
  platform: 'spotify',
  enabled: false,
  capabilities: { signup: false, verify: false, configureProfile: true, post: false, healthCheck: true },
  healthCheck: async () => ({ score: 100, status: 'healthy' }),
});

// ---- YouTube (official API placeholder) ----
registerAdapter({
  platform: 'youtube',
  enabled: false,
  capabilities: { signup: false, verify: false, configureProfile: true, post: true, healthCheck: true },
  healthCheck: async () => ({ score: 100, status: 'healthy' }),
});
