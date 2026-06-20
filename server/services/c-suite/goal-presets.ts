/**
 * C-Suite AI · Goal Presets
 *
 * Pre-built OKR / KPI templates the admin can one-click-apply.
 * Targets are sensible defaults; admin can edit before saving.
 */

export interface GoalPreset {
  key: string;                 // unique slug
  category: 'growth' | 'revenue' | 'retention' | 'platform' | 'artist';
  scope: 'company' | 'department' | 'key_result';
  ownerAgent: string;
  title: string;
  metric: string;
  targetValue: number;
  baseline?: number;
  description: string;
  cadenceDays?: number;        // suggested check-in cadence
}

export const GOAL_PRESETS: GoalPreset[] = [
  // ---- Revenue / Finance (CFO) ----
  {
    key: 'mrr_10k',
    category: 'revenue',
    scope: 'company',
    ownerAgent: 'cfo',
    title: 'Hit $10K MRR across the platform',
    metric: 'mrr_usd',
    targetValue: 10000,
    description: 'Monthly recurring revenue from subscriptions + merch + sponsor deals.',
    cadenceDays: 7,
  },
  {
    key: 'gross_margin_65',
    category: 'revenue',
    scope: 'company',
    ownerAgent: 'cfo',
    title: 'Sustain 65% gross margin',
    metric: 'gross_margin_pct',
    targetValue: 65,
    description: 'Revenue minus payment processing, hosting, AI inference, fulfillment.',
    cadenceDays: 14,
  },
  {
    key: 'artist_avg_earnings_500',
    category: 'artist',
    scope: 'key_result',
    ownerAgent: 'cfo',
    title: 'Average artist earnings $500/mo',
    metric: 'artist_avg_earnings_monthly_usd',
    targetValue: 500,
    description: 'Track per-active-artist monthly earning. Driver of retention.',
    cadenceDays: 14,
  },

  // ---- Growth / Marketing (CMO) ----
  {
    key: 'signups_500_month',
    category: 'growth',
    scope: 'company',
    ownerAgent: 'cmo',
    title: '500 new artist signups / month',
    metric: 'monthly_signups',
    targetValue: 500,
    description: 'Net new artist accounts (excludes admin/test).',
    cadenceDays: 7,
  },
  {
    key: 'social_reach_5m',
    category: 'growth',
    scope: 'company',
    ownerAgent: 'cmo',
    title: 'Aggregate social reach 5M',
    metric: 'aggregate_followers',
    targetValue: 5_000_000,
    description: 'Sum of Spotify + Instagram + YouTube followers across all artists.',
    cadenceDays: 14,
  },
  {
    key: 'playlist_placements_200',
    category: 'growth',
    scope: 'key_result',
    ownerAgent: 'cmo',
    title: '200 playlist placements / month',
    metric: 'playlist_placements_monthly',
    targetValue: 200,
    description: 'Spotify / Apple / YouTube curator adds.',
    cadenceDays: 7,
  },

  // ---- Revenue / Sales (CRO) ----
  {
    key: 'merch_orders_50_daily',
    category: 'revenue',
    scope: 'key_result',
    ownerAgent: 'cro',
    title: '50 merch orders/day',
    metric: 'merch_orders_daily',
    targetValue: 50,
    description: 'Completed merch transactions per day across the platform.',
    cadenceDays: 1,
  },
  {
    key: 'sell_through_45',
    category: 'revenue',
    scope: 'company',
    ownerAgent: 'cro',
    title: '45% merch sell-through rate',
    metric: 'merch_sell_through_pct',
    targetValue: 45,
    description: 'Percent of available inventory sold per month.',
    cadenceDays: 14,
  },

  // ---- Retention / Ops (COO + CPO) ----
  {
    key: 'retention_30d_80',
    category: 'retention',
    scope: 'company',
    ownerAgent: 'coo',
    title: '80% 30-day artist retention',
    metric: 'artist_retention_30d_pct',
    targetValue: 80,
    description: 'Artists active in days 0-7 still active days 23-30.',
    cadenceDays: 14,
  },
  {
    key: 'feature_adoption_75',
    category: 'platform',
    scope: 'company',
    ownerAgent: 'cpo',
    title: '75% feature adoption (video + merch)',
    metric: 'feature_adoption_pct',
    targetValue: 75,
    description: 'Percent of active artists who used merch OR video tools in last 14 days.',
    cadenceDays: 14,
  },

  // ---- Platform / CTO ----
  {
    key: 'uptime_99_8',
    category: 'platform',
    scope: 'company',
    ownerAgent: 'cto',
    title: '99.8% API uptime SLA',
    metric: 'system_uptime_pct',
    targetValue: 99.8,
    description: '5xx-free availability of /api/* endpoints (rolling 30d).',
    cadenceDays: 7,
  },
  {
    key: 'cost_under_2k',
    category: 'platform',
    scope: 'company',
    ownerAgent: 'cto',
    title: 'AI infra cost < $2K/mo',
    metric: 'ai_cost_monthly_usd',
    targetValue: 2000,
    baseline: 0,
    description: 'OpenAI + FAL + Apify combined monthly cost.',
    cadenceDays: 7,
  },

  // ---- CEO-level (cross-functional) ----
  {
    key: 'virality_1_3',
    category: 'growth',
    scope: 'company',
    ownerAgent: 'ceo',
    title: 'Virality coefficient ≥ 1.3',
    metric: 'virality_coefficient',
    targetValue: 1.3,
    description: 'Organic invites per signup. > 1.0 = sustainable growth.',
    cadenceDays: 14,
  },
  {
    key: 'nps_50',
    category: 'retention',
    scope: 'company',
    ownerAgent: 'ceo',
    title: 'Artist NPS ≥ 50',
    metric: 'artist_nps',
    targetValue: 50,
    description: 'Net Promoter Score from quarterly artist survey.',
    cadenceDays: 30,
  },
];

export function getPreset(key: string): GoalPreset | undefined {
  return GOAL_PRESETS.find((g) => g.key === key);
}
