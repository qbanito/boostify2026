// ───────────────────────────────────────────────────────────────────────────
// Discord Fan Nation — Analytics helpers (pure functions, no I/O)
// Scoring & aggregation for community health: fan engagement, top-fan ranking,
// growth/churn, role value, revenue attribution and time-series for charts.
// ───────────────────────────────────────────────────────────────────────────

export interface MemberLike {
  discordUserId: string;
  username?: string;
  roles?: string[];
  isVip?: boolean;
  btfBalance?: number;
  totalSpent?: number;
  messagesCount?: number;
  lastActiveAt?: number;
  joinedAt?: number;
}

const DAY = 86_400_000;

export function isActive(m: MemberLike, withinDays = 7): boolean {
  if (!m.lastActiveAt) return false;
  return Date.now() - m.lastActiveAt <= withinDays * DAY;
}

// Engagement score 0-100: messages + spend + recency + VIP/token weighting.
export function engagementScore(m: MemberLike): number {
  const msg = Math.min(40, Math.log10((m.messagesCount || 0) + 1) * 22);
  const spend = Math.min(30, Math.log10((m.totalSpent || 0) + 1) * 16);
  const recency = m.lastActiveAt ? Math.max(0, 18 - (Date.now() - m.lastActiveAt) / DAY) : 0;
  const token = m.btfBalance && m.btfBalance > 0 ? Math.min(12, Math.log10(m.btfBalance + 1) * 6) : 0;
  return Math.round(Math.min(100, msg + spend + recency + token));
}

export function fanTier(score: number): 'Super Fan' | 'VIP Fan' | 'Active Fan' | 'Fan' {
  if (score >= 80) return 'Super Fan';
  if (score >= 55) return 'VIP Fan';
  if (score >= 25) return 'Active Fan';
  return 'Fan';
}

export function rankTopFans(members: MemberLike[], limit = 10) {
  return members
    .map((m) => ({ ...m, score: engagementScore(m), tier: fanTier(engagementScore(m)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Growth & churn over the period (joins vs inactive members).
export function growthStats(members: MemberLike[], periodDays = 30) {
  const cutoff = Date.now() - periodDays * DAY;
  const newMembers = members.filter((m) => (m.joinedAt || 0) >= cutoff).length;
  const active = members.filter((m) => isActive(m, 14)).length;
  const churned = members.filter((m) => m.lastActiveAt && m.lastActiveAt < Date.now() - 30 * DAY).length;
  const total = members.length;
  return {
    total,
    active,
    newMembers,
    churned,
    churnRate: total ? Math.round((churned / total) * 100) : 0,
    activeRate: total ? Math.round((active / total) * 100) : 0,
  };
}

// Revenue attribution from members + campaigns.
export function revenueStats(members: MemberLike[], campaigns: Array<{ revenue?: number; conversionCount?: number }>) {
  const memberRevenue = members.reduce((s, m) => s + (m.totalSpent || 0), 0);
  const campaignRevenue = campaigns.reduce((s, c) => s + (c.revenue || 0), 0);
  const conversions = campaigns.reduce((s, c) => s + (c.conversionCount || 0), 0);
  return {
    totalRevenue: Math.round(memberRevenue + campaignRevenue),
    memberRevenue: Math.round(memberRevenue),
    campaignRevenue: Math.round(campaignRevenue),
    conversions,
    arpu: members.length ? Math.round(memberRevenue / members.length) : 0,
  };
}

// Role value = members in role × avg spend of those members.
export function roleValue(members: MemberLike[], roleId: string): { count: number; revenue: number } {
  const inRole = members.filter((m) => (m.roles || []).includes(roleId));
  return { count: inRole.length, revenue: Math.round(inRole.reduce((s, m) => s + (m.totalSpent || 0), 0)) };
}

// 14-day activity timeline (members active each day) for charts.
export function activityTimeline(members: MemberLike[], days = 14): Array<{ day: string; active: number; joined: number }> {
  const out: Array<{ day: string; active: number; joined: number }> = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const start = now - (i + 1) * DAY;
    const end = now - i * DAY;
    const label = new Date(end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    const active = members.filter((m) => m.lastActiveAt && m.lastActiveAt >= start && m.lastActiveAt < end).length;
    const joined = members.filter((m) => m.joinedAt && m.joinedAt >= start && m.joinedAt < end).length;
    out.push({ day: label, active, joined });
  }
  return out;
}

// VIP retention = % of VIP members still active in last 30 days.
export function vipRetention(members: MemberLike[]): number {
  const vips = members.filter((m) => m.isVip);
  if (!vips.length) return 0;
  const retained = vips.filter((m) => isActive(m, 30)).length;
  return Math.round((retained / vips.length) * 100);
}

// Does a member qualify for token-gated access?
export function qualifiesForTokenGate(m: MemberLike, opts: { minBtf?: number; requireVip?: boolean; minSpent?: number }): boolean {
  if (opts.minBtf && (m.btfBalance || 0) < opts.minBtf) return false;
  if (opts.requireVip && !m.isVip) return false;
  if (opts.minSpent && (m.totalSpent || 0) < opts.minSpent) return false;
  return true;
}
