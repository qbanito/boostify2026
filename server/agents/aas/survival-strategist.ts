/**
 * AAS Agent 1: Survival Strategist v2
 * 
 * The "brain" of the AAS Engine. Reads ALL available data to decide
 * daily priorities: financial snapshot, contact databases, extension metrics,
 * email quota, deal pipeline, audience metrics.
 * 
 * NOW CONNECTED TO:
 *  - 4 Contact Databases (industry, sponsors, venues, marketing)
 *  - Chrome Extension Metrics (YouTube/Instagram snapshots)
 *  - Email Quota Tracking
 *  - All 7+ agents for action generation
 */

import { db } from '../../db';
import {
  aasConfig, users,
  musicIndustryContacts, sponsorContacts, venueContacts, marketingContacts,
  aasDealPipeline,
  youtubeExtensionConnections, youtubeChannelSnapshots,
  instagramExtensionConnections, instagramProfileSnapshots,
} from '../../../db/schema';
import { eq, and, sql, desc, isNotNull } from 'drizzle-orm';
import { calculateSurvivalScore, getFinancialSnapshot, getTopInsights } from '../../services/aas/survival-score';
import type { DailyPlan, PriorityMode, PlannedAction, FinancialSnapshot } from '../../services/aas/types';

/** Contacts available for outreach (not yet contacted) */
interface ContactInventory {
  industryNew: number;
  sponsorsNew: number;
  venuesNew: number;
  marketingActive: number;
  radioNew: number;
  labelsNew: number;
  totalUntouched: number;
}

/** Extension connection status */
interface ExtensionStatus {
  youtubeConnected: boolean;
  instagramConnected: boolean;
  ytSubscribers: number;
  ytViews: number;
  igFollowers: number;
  igEngagement: number;
}

/**
 * Gather all diagnostic data for an artist and produce a daily plan.
 */
export async function createDailyPlan(artistId: number): Promise<DailyPlan> {
  // 1. Gather artist profile
  const [artist] = await db.select({
    id: users.id,
    artistName: users.artistName,
    genres: users.genres,
    isAIGenerated: users.isAIGenerated,
  }).from(users).where(eq(users.id, artistId)).limit(1);

  if (!artist) throw new Error(`Artist ${artistId} not found`);

  // 2. Gather AAS config
  const [config] = await db.select().from(aasConfig).where(eq(aasConfig.artistId, artistId)).limit(1);
  if (!config || !config.enabled) throw new Error(`AAS not enabled for artist ${artistId}`);

  // 3. Calculate survival score + financial
  const score = await calculateSurvivalScore(artistId);
  const financial = await getFinancialSnapshot(artistId);
  const insights = await getTopInsights(artistId);

  // 4. Count available contacts
  const contacts = await getContactInventory();

  // 5. Check extension connections
  const extensions = await getExtensionStatus(artistId);

  // 6. Count active deals
  const [dealStats] = await db.select({
    activeDeals: sql<number>`COUNT(*)`,
  }).from(aasDealPipeline).where(eq(aasDealPipeline.artistId, artistId));

  // 7. Determine priority mode with full context
  const priorityMode = determinePriorityMode(score.total, financial, score.status, contacts, extensions, dealStats?.activeDeals || 0);

  // 8. Generate rich tactical plan
  const actions = generateActions(priorityMode, score, financial, config, contacts, extensions);

  const maxBudget = parseFloat(config.maxDailyBudget || '50');

  return {
    objectives: generateObjectives(priorityMode, score, contacts, extensions),
    priorityMode,
    actions,
    maxBudget,
    reasoning: `Score: ${score.total} (${score.status}). Runway: ${financial.runwayDays}d. Mode: ${priorityMode}. Contacts available: ${contacts.totalUntouched}. YT: ${extensions.youtubeConnected ? 'connected' : 'off'}. IG: ${extensions.instagramConnected ? 'connected' : 'off'}. Revenue/wk: $${Object.values(financial.revenueByChannel).reduce((a, b) => a + b, 0).toFixed(2)}`,
  };
}

/** Count untouched contacts across all 4 databases */
async function getContactInventory(): Promise<ContactInventory> {
  const [industry] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(musicIndustryContacts).where(eq(musicIndustryContacts.status, 'new'));
  const [sponsors] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(sponsorContacts).where(eq(sponsorContacts.status, 'new'));
  const [venues] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(venueContacts).where(eq(venueContacts.status, 'new'));
  const [marketing] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(marketingContacts).where(eq(marketingContacts.status, 'active'));

  const industryNew = industry?.c || 0;
  const sponsorsNew = sponsors?.c || 0;
  const venuesNew = venues?.c || 0;
  const marketingActive = marketing?.c || 0;

  // Radio contacts
  const [radio] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(musicIndustryContacts).where(and(eq(musicIndustryContacts.category, 'radio'), eq(musicIndustryContacts.status, 'new')));
  // Label contacts
  const [labels] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(musicIndustryContacts).where(and(eq(musicIndustryContacts.category, 'record_label'), eq(musicIndustryContacts.status, 'new')));

  const radioNew = radio?.c || 0;
  const labelsNew = labels?.c || 0;

  return {
    industryNew,
    sponsorsNew,
    venuesNew,
    marketingActive,
    radioNew,
    labelsNew,
    totalUntouched: industryNew + sponsorsNew + venuesNew,
  };
}

/** Check YouTube/Instagram extension status */
async function getExtensionStatus(artistId: number): Promise<ExtensionStatus> {
  const result: ExtensionStatus = {
    youtubeConnected: false, instagramConnected: false,
    ytSubscribers: 0, ytViews: 0, igFollowers: 0, igEngagement: 0,
  };

  // YouTube
  const [ytConn] = await db.select().from(youtubeExtensionConnections)
    .where(eq(youtubeExtensionConnections.userId, artistId)).limit(1);
  if (ytConn) {
    result.youtubeConnected = true;
    const [snap] = await db.select().from(youtubeChannelSnapshots)
      .where(eq(youtubeChannelSnapshots.connectionId, ytConn.id))
      .orderBy(desc(youtubeChannelSnapshots.snapshotAt)).limit(1);
    if (snap) {
      result.ytSubscribers = snap.subscribers || 0;
      result.ytViews = snap.totalViews || 0;
    }
  }

  // Instagram
  const [igConn] = await db.select().from(instagramExtensionConnections)
    .where(eq(instagramExtensionConnections.userId, artistId)).limit(1);
  if (igConn) {
    result.instagramConnected = true;
    const [snap] = await db.select().from(instagramProfileSnapshots)
      .where(eq(instagramProfileSnapshots.connectionId, igConn.id))
      .orderBy(desc(instagramProfileSnapshots.snapshotAt)).limit(1);
    if (snap) {
      result.igFollowers = snap.followers || 0;
      result.igEngagement = snap.engagementRate || 0;
    }
  }

  return result;
}

function determinePriorityMode(
  score: number,
  financial: FinancialSnapshot,
  status: string,
  contacts: ContactInventory,
  extensions: ExtensionStatus,
  activeDeals: number,
): PriorityMode {
  // Critical: cut costs and sell
  if (score < 20 || financial.runwayDays < 30) return 'cut_costs';
  // At risk: focus on selling
  if (score < 40 || financial.runwayDays < 60) return 'sell';
  // Lots of radio contacts available: radio push
  if (contacts.radioNew > 10 && activeDeals < 3) return 'radio_push';
  // Lots of untouched contacts: outreach blitz
  if (contacts.totalUntouched > 50 && activeDeals < 5) return 'outreach';
  // Extensions connected but low engagement: content blitz
  if ((extensions.youtubeConnected || extensions.instagramConnected) && score < 55) return 'content_blitz';
  // Has revenue but stagnant audience: grow
  if (financial.isAboveSurvivalThreshold && score < 60) return 'grow';
  // Good position with blockchain ready: blockchain ops occasionally
  if (score >= 70 && activeDeals > 3) return 'blockchain_ops';
  // Good position: work pipeline
  if (score >= 60) return 'close_deal';
  return 'content';
}

function generateObjectives(
  mode: PriorityMode,
  score: { total: number; status: string },
  contacts: ContactInventory,
  extensions: ExtensionStatus,
): string[] {
  const objectives: Record<PriorityMode, string[]> = {
    sell: [
      'Push at least 1 merch sale or product conversion',
      'Send follow-up to warmest leads',
      'Activate limited-time offer via email',
    ],
    grow: [
      'Publish high-engagement content on best channel',
      'Capture 5+ new email subscribers',
      'Test one new audience segment',
    ],
    close_deal: [
      'Advance top deal to next pipeline stage',
      'Send 2 new outreach proposals to sponsors/venues',
      'Follow up on pending negotiations',
    ],
    launch: [
      'Prepare launch assets (images, copy, email)',
      'Notify community about upcoming drop',
      'Set up pre-order or waitlist',
    ],
    content: [
      'Publish 2 pieces of brand-building content',
      'Engage with top community members',
      'Analyze content performance from last week',
    ],
    recover_leads: [
      'Re-engage 5 cold leads with new angle',
      'Send value-first content to dormant contacts',
      'Update lead scoring and pipeline',
    ],
    cut_costs: [
      'Pause lowest-ROI ad campaigns',
      'Reduce API usage to essential only',
      'Focus on zero-cost organic actions',
    ],
    outreach: [
      `Contact 5+ new prospects from ${contacts.totalUntouched} available`,
      'Send personalized proposals to sponsors/venues/industry',
      'Enrich and verify contact emails before sending',
    ],
    content_blitz: [
      'Generate 3+ images/videos with FAL AI',
      extensions.instagramConnected ? 'Publish content to Instagram via extension' : 'Prepare content for manual posting',
      extensions.youtubeConnected ? 'Publish content to YouTube via extension' : 'Generate video for YouTube upload',
      'Boost engagement with polls and stories',
    ],
    radio_push: [
      `Contact ${Math.min(contacts.radioNew, 5)} radio stations for airplay`,
      'Prepare radio-ready promotional materials',
      'Post about radio submissions on social network',
      contacts.labelsNew > 0 ? 'Pitch to 1+ record labels' : 'Follow up on existing label contacts',
    ],
    blockchain_ops: [
      'Register artist on Polygon blockchain (if not done)',
      'Tokenize untokenized songs as ERC-1155',
      'Promote token availability on social network',
      'Post on Boostify social network about blockchain milestone',
    ],
  };
  return objectives[mode];
}

function generateActions(
  mode: PriorityMode,
  score: { total: number; components: any },
  financial: FinancialSnapshot,
  config: any,
  contacts: ContactInventory,
  extensions: ExtensionStatus,
): PlannedAction[] {
  const maxBudget = parseFloat(config.maxDailyBudget || '50');
  const actions: PlannedAction[] = [];

  // ── ALWAYS: Pipeline review ──────────────────────────────
  actions.push({
    action: 'Review and advance deal pipeline',
    agent: 'deal-closer',
    channel: 'email',
    budgetAllocated: 0,
    priority: 2,
    expectedOutcome: 'Move 1+ deal to next stage',
  });

  // ── ALWAYS: Social network post ─────────────────────────
  actions.push({
    action: 'Post on Boostify social network',
    agent: 'social-operator',
    channel: 'social',
    budgetAllocated: 0.001,
    priority: 3,
    expectedOutcome: 'Increase social network presence',
  });

  // ── ALWAYS: Social network engagement ───────────────────
  actions.push({
    action: 'Engage with posts on social network',
    agent: 'social-operator',
    channel: 'social',
    budgetAllocated: 0.002,
    priority: 4,
    expectedOutcome: 'Build relationships with other artists',
  });

  // ── ALWAYS: Generate content image (cheap, brand-building) ──
  actions.push({
    action: 'Create social image with AI',
    agent: 'growth-operator',
    channel: extensions.instagramConnected ? 'instagram' : 'internal',
    budgetAllocated: 0.05,
    priority: mode === 'content_blitz' ? 1 : 3,
    expectedOutcome: 'AI-generated promotional image',
  });

  // ── ALWAYS: Publish content if extensions connected ──
  if (extensions.instagramConnected) {
    actions.push({
      action: 'Publish to Instagram via extension',
      agent: 'growth-operator',
      channel: 'instagram',
      budgetAllocated: 0,
      priority: mode === 'content_blitz' ? 1 : 3,
      expectedOutcome: 'Real Instagram post published',
    });
  }
  if (extensions.youtubeConnected) {
    actions.push({
      action: 'Publish to YouTube via extension',
      agent: 'growth-operator',
      channel: 'youtube',
      budgetAllocated: 0,
      priority: mode === 'content_blitz' ? 1 : 4,
      expectedOutcome: 'YouTube content published',
    });
  }

  // ── Mode-specific actions ────────────────────────────────
  switch (mode) {
    case 'sell':
      actions.push({
        action: 'Create merch design with AI',
        agent: 'revenue-operator',
        channel: 'internal',
        budgetAllocated: 0.10,
        priority: 1,
        expectedOutcome: 'New merch design generated',
      });
      actions.push({
        action: 'Send merch campaign email',
        agent: 'revenue-operator',
        channel: 'email',
        budgetAllocated: 0,
        priority: 1,
        expectedOutcome: 'Push merch to fans via email',
      });
      actions.push({
        action: 'Send outreach to warm prospects',
        agent: 'deal-closer',
        channel: 'email',
        budgetAllocated: 0,
        priority: 2,
        expectedOutcome: 'Get 2+ responses from warm leads',
      });
      break;

    case 'grow':
      actions.push({
        action: 'Run audience growth experiment',
        agent: 'growth-operator',
        channel: 'instagram',
        budgetAllocated: maxBudget * 0.5,
        priority: 1,
        expectedOutcome: 'Gain 20+ new followers',
      });
      actions.push({
        action: 'Generate and publish social content',
        agent: 'growth-operator',
        channel: 'instagram',
        budgetAllocated: 0,
        priority: 2,
        expectedOutcome: 'Increase engagement and reach',
      });
      break;

    case 'close_deal':
      actions.push({
        action: 'Send personalized proposals to top targets',
        agent: 'deal-closer',
        channel: 'email',
        budgetAllocated: 0,
        priority: 1,
        expectedOutcome: 'Get 1 meeting or positive response',
      });
      actions.push({
        action: 'Generate media kit for active deal',
        agent: 'deal-closer',
        channel: 'internal',
        budgetAllocated: 0,
        priority: 3,
        expectedOutcome: 'Professional media kit ready to send',
      });
      if (contacts.sponsorsNew > 0) {
        actions.push({
          action: 'Prospect new sponsors from database',
          agent: 'deal-closer',
          channel: 'email',
          budgetAllocated: 0,
          priority: 2,
          expectedOutcome: `Find sponsors from ${contacts.sponsorsNew} new contacts`,
        });
      }
      break;

    case 'outreach':
      if (contacts.sponsorsNew > 0) {
        actions.push({
          action: 'Send sponsor proposals',
          agent: 'deal-closer',
          channel: 'email',
          budgetAllocated: 0,
          priority: 1,
          expectedOutcome: `Email ${Math.min(contacts.sponsorsNew, 5)} sponsors`,
        });
      }
      if (contacts.venuesNew > 0) {
        actions.push({
          action: 'Send venue booking requests',
          agent: 'deal-closer',
          channel: 'email',
          budgetAllocated: 0,
          priority: 1,
          expectedOutcome: `Email ${Math.min(contacts.venuesNew, 5)} venues`,
        });
      }
      if (contacts.radioNew > 0) {
        actions.push({
          action: 'Contact radio stations for airplay',
          agent: 'deal-closer',
          channel: 'email',
          budgetAllocated: 0,
          priority: 2,
          expectedOutcome: `Submit to ${Math.min(contacts.radioNew, 3)} radio stations`,
        });
      }
      if (contacts.labelsNew > 0) {
        actions.push({
          action: 'Pitch to record labels',
          agent: 'deal-closer',
          channel: 'email',
          budgetAllocated: 0,
          priority: 2,
          expectedOutcome: `Pitch to ${Math.min(contacts.labelsNew, 2)} labels`,
        });
      }
      if (contacts.industryNew > 0) {
        actions.push({
          action: 'Send industry outreach',
          agent: 'deal-closer',
          channel: 'email',
          budgetAllocated: 0,
          priority: 2,
          expectedOutcome: `Email ${Math.min(contacts.industryNew, 5)} labels/managers`,
        });
      }
      actions.push({
        action: 'Enrich and verify contacts',
        agent: 'deal-closer',
        channel: 'internal',
        budgetAllocated: 0,
        priority: 3,
        expectedOutcome: 'Verify emails before sending',
      });
      actions.push({
        action: 'Auto follow-up pending deals',
        agent: 'deal-closer',
        channel: 'email',
        budgetAllocated: 0,
        priority: 2,
        expectedOutcome: 'Day 3/7/14 follow-ups sent',
      });
      break;

    case 'content_blitz':
      actions.push({
        action: 'Create promo video with AI',
        agent: 'growth-operator',
        channel: extensions.youtubeConnected ? 'youtube' : 'internal',
        budgetAllocated: 0.10,
        priority: 1,
        expectedOutcome: 'AI-generated promotional video',
      });
      actions.push({
        action: 'Create album art',
        agent: 'growth-operator',
        channel: 'internal',
        budgetAllocated: 0.05,
        priority: 2,
        expectedOutcome: 'New album art for visual branding',
      });
      actions.push({
        action: 'Post artist story',
        agent: 'community-operator',
        channel: 'social',
        budgetAllocated: 0,
        priority: 2,
        expectedOutcome: 'Engaging story posted',
      });
      actions.push({
        action: 'Engage community with poll or question',
        agent: 'community-operator',
        channel: 'social',
        budgetAllocated: 0,
        priority: 3,
        expectedOutcome: 'Increase community engagement',
      });
      break;

    case 'cut_costs':
      actions.push({
        action: 'Audit and reduce non-essential costs',
        agent: 'finance-controller',
        channel: 'internal',
        budgetAllocated: 0,
        priority: 1,
        expectedOutcome: 'Reduce daily burn by 20%',
      });
      actions.push({
        action: 'Calculate ROI by channel',
        agent: 'finance-controller',
        channel: 'internal',
        budgetAllocated: 0,
        priority: 2,
        expectedOutcome: 'Identify worst-performing channels',
      });
      break;

    case 'recover_leads':
      actions.push({
        action: 'Auto follow-up pending deals',
        agent: 'deal-closer',
        channel: 'email',
        budgetAllocated: 0,
        priority: 1,
        expectedOutcome: 'Re-engage cold leads',
      });
      actions.push({
        action: 'Send community newsletter',
        agent: 'community-operator',
        channel: 'email',
        budgetAllocated: 0,
        priority: 2,
        expectedOutcome: 'Value-first content to dormant contacts',
      });
      break;

    case 'launch':
      actions.push({
        action: 'Create social image with AI',
        agent: 'growth-operator',
        channel: 'internal',
        budgetAllocated: 0.10,
        priority: 1,
        expectedOutcome: 'Launch visual assets ready',
      });
      actions.push({
        action: 'Send community newsletter',
        agent: 'community-operator',
        channel: 'email',
        budgetAllocated: 0,
        priority: 1,
        expectedOutcome: 'Notify fans about upcoming drop',
      });
      break;

    case 'radio_push':
      actions.push({
        action: 'Contact radio stations for airplay',
        agent: 'deal-closer',
        channel: 'email',
        budgetAllocated: 0,
        priority: 1,
        expectedOutcome: `Submit to ${Math.min(contacts.radioNew, 5)} radio stations`,
      });
      if (contacts.labelsNew > 0) {
        actions.push({
          action: 'Pitch to record labels',
          agent: 'deal-closer',
          channel: 'email',
          budgetAllocated: 0,
          priority: 1,
          expectedOutcome: `Pitch to ${Math.min(contacts.labelsNew, 3)} labels`,
        });
      }
      actions.push({
        action: 'Promote new release on social network',
        agent: 'social-operator',
        channel: 'social',
        budgetAllocated: 0.001,
        priority: 2,
        expectedOutcome: 'Build buzz on social network for radio push',
      });
      actions.push({
        action: 'Create social image with AI',
        agent: 'growth-operator',
        channel: 'internal',
        budgetAllocated: 0.05,
        priority: 2,
        expectedOutcome: 'Radio submission promotional image',
      });
      break;

    case 'blockchain_ops':
      actions.push({
        action: 'Register artist on blockchain',
        agent: 'blockchain-operator',
        channel: 'blockchain',
        budgetAllocated: 0.01,
        priority: 1,
        expectedOutcome: 'On-chain identity on Polygon',
      });
      actions.push({
        action: 'Tokenize song on blockchain',
        agent: 'blockchain-operator',
        channel: 'blockchain',
        budgetAllocated: 0.02,
        priority: 1,
        expectedOutcome: 'Song available as ERC-1155 token',
      });
      actions.push({
        action: 'Promote token sales on social network',
        agent: 'social-operator',
        channel: 'social',
        budgetAllocated: 0.001,
        priority: 2,
        expectedOutcome: 'Announce token availability to fans',
      });
      actions.push({
        action: 'Check blockchain status',
        agent: 'blockchain-operator',
        channel: 'blockchain',
        budgetAllocated: 0,
        priority: 3,
        expectedOutcome: 'Verify on-chain status',
      });
      break;

    default: // content
      actions.push({
        action: 'Generate and publish social content',
        agent: 'growth-operator',
        channel: 'instagram',
        budgetAllocated: 0,
        priority: 2,
        expectedOutcome: 'Brand-building content published',
      });
      actions.push({
        action: 'Engage community with poll or question',
        agent: 'community-operator',
        channel: 'social',
        budgetAllocated: 0,
        priority: 3,
        expectedOutcome: 'Increase community engagement',
      });
      break;
  }

  // ── ALWAYS: Community nurture if we have fans ──
  if (contacts.marketingActive > 10 && mode !== 'cut_costs') {
    actions.push({
      action: 'Nurture superfans',
      agent: 'community-operator',
      channel: 'email',
      budgetAllocated: 0,
      priority: 4,
      expectedOutcome: 'Strengthen superfan relationships',
    });
  }

  // ── ALWAYS last: compliance check ──
  actions.push({
    action: 'Run compliance check on all pending actions',
    agent: 'risk-compliance',
    channel: 'internal',
    budgetAllocated: 0,
    priority: 5,
    expectedOutcome: 'Ensure all actions are brand-safe',
  });

  return actions.sort((a, b) => a.priority - b.priority);
}
