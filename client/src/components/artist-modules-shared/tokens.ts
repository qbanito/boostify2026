/**
 * Shared design tokens for the 6 Artist modules
 * (Sponsor Acquisition, Venue Booking, Exclusive Content, AAS Engine,
 *  Viral Product Ads, Brand Collaborations).
 *
 * Re-exports the locked palette from artist-acquisition/shared so every
 * module renders with the same visual language.
 */
export { TOKENS, FONT_MONO } from '../artist-acquisition/shared/tokens';

export const MODULE_IDS = [
  'sponsor-acquisition',
  'venue-booking',
  'exclusive-content',
  'aas-engine',
  'viral-product-ads',
  'brand-collaborations',
  'career-suite',
] as const;

export type ModuleId = typeof MODULE_IDS[number];

export const MODULE_META: Record<ModuleId, {
  label: string;
  short: string;
  emoji: string;
  gradient: [string, string];
  description: string;
  apiPrefix: string;
}> = {
  'sponsor-acquisition': {
    label: 'Sponsor Acquisition',
    short: 'Sponsors',
    emoji: '🎯',
    gradient: ['#ff7a00', '#f43f5e'],
    description: 'Brand contacts, campaigns and paid partnership deals.',
    apiPrefix: '/api/sponsors',
  },
  'venue-booking': {
    label: 'Venue Booking',
    short: 'Venues',
    emoji: '🎤',
    gradient: ['#22c55e', '#14b8a6'],
    description: 'Scrape venues, send proposals, confirm live shows.',
    apiPrefix: '/api/venue-outreach',
  },
  'exclusive-content': {
    label: 'Exclusive Content',
    short: 'Explicit',
    emoji: '🔥',
    gradient: ['#ec4899', '#a855f7'],
    description: 'Paid drops, subscriptions and private chat with fans.',
    apiPrefix: '/api/explicit',
  },
  'aas-engine': {
    label: 'AAS Engine',
    short: 'AAS',
    emoji: '🛰️',
    gradient: ['#3b82f6', '#6366f1'],
    description: 'Autonomous artist survival — daily actions, metrics, approvals.',
    apiPrefix: '/api/aas',
  },
  'viral-product-ads': {
    label: 'Viral Product Ads',
    short: 'Viral',
    emoji: '🔥',
    gradient: ['#f97316', '#eab308'],
    description: 'TikTok Shop products × AI promo image/video generator.',
    apiPrefix: '/api/viral-products',
  },
  'brand-collaborations': {
    label: 'Brand Collaborations',
    short: 'Brands',
    emoji: '🤝',
    gradient: ['#0ea5e9', '#8b5cf6'],
    description: 'Influencer marketplace, campaign content, brand messaging.',
    apiPrefix: '/api/influencer',
  },
  'career-suite': {
    label: 'AI Career Suite',
    short: 'Career',
    emoji: '🧠',
    gradient: ['#f97316', '#dc2626'],
    description: 'Your personal AI executive team — 5 agents + access to corporate C-Suite (Elite tier, admin-approved).',
    apiPrefix: '/api/artist/suite',
  },
};
