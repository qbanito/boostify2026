/**
 * Shared enums + type guards for the 6 Artist modules.
 * Avoids typos across client/server when checking deal/campaign statuses.
 */

export const SPONSOR_DEAL_STATUS = [
  'proposed',
  'viewed',
  'counter_offer',
  'accepted',
  'rejected',
  'payment_pending',
  'active',
  'completed',
  'cancelled',
] as const;
export type SponsorDealStatus = typeof SPONSOR_DEAL_STATUS[number];

export const VENUE_DEAL_STATUS = [
  'proposed',
  'viewed',
  'negotiating',
  'confirmed',
  'rejected',
  'cancelled',
  'performed',
] as const;
export type VenueDealStatus = typeof VENUE_DEAL_STATUS[number];

export const CAMPAIGN_STATUS = [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'completed',
  'failed',
] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUS[number];

export const BRAND_CAMPAIGN_STATUS = [
  'pending_payment',
  'active',
  'content_ready',
  'approved',
  'published',
  'completed',
  'cancelled',
] as const;
export type BrandCampaignStatus = typeof BRAND_CAMPAIGN_STATUS[number];

export function isSponsorDealStatus(v: unknown): v is SponsorDealStatus {
  return typeof v === 'string' && (SPONSOR_DEAL_STATUS as readonly string[]).includes(v);
}
export function isVenueDealStatus(v: unknown): v is VenueDealStatus {
  return typeof v === 'string' && (VENUE_DEAL_STATUS as readonly string[]).includes(v);
}
export function isCampaignStatus(v: unknown): v is CampaignStatus {
  return typeof v === 'string' && (CAMPAIGN_STATUS as readonly string[]).includes(v);
}
export function isBrandCampaignStatus(v: unknown): v is BrandCampaignStatus {
  return typeof v === 'string' && (BRAND_CAMPAIGN_STATUS as readonly string[]).includes(v);
}

/** UI tone mapping — picks color token key by status */
export const STATUS_TONE: Record<string, 'neutral' | 'positive' | 'warning' | 'danger' | 'accent'> = {
  // sponsors + venues share
  proposed: 'accent',
  viewed: 'neutral',
  counter_offer: 'warning',
  negotiating: 'warning',
  accepted: 'positive',
  confirmed: 'positive',
  approved: 'positive',
  active: 'positive',
  published: 'positive',
  completed: 'positive',
  performed: 'positive',
  rejected: 'danger',
  cancelled: 'danger',
  failed: 'danger',
  // campaigns
  draft: 'neutral',
  scheduled: 'accent',
  sending: 'warning',
  sent: 'positive',
  payment_pending: 'warning',
  pending_payment: 'warning',
  content_ready: 'accent',
};
