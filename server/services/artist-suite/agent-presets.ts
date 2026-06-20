/**
 * Artist Career Suite — Agent Presets
 *
 * Defines the 5 personal agents seeded for every Elite-tier artist:
 *   - manager   (general manager / chief of staff)
 *   - marketing (audience growth, content)
 *   - ar        (A&R: songwriting/release strategy)
 *   - merch     (merch line-up, inventory, drops)
 *   - finance   (royalties, treasury, taxes)
 *
 * Each agent gets a SAFE-by-default config:
 *   - dryRun = true
 *   - autonomy = 2 (HITL for risky actions)
 *   - small budget
 *   - read-only / memory-only tool set
 *
 * Corporate consultations (CEO/CFO/etc.) reuse the existing
 * c_suite_agents personas but log to artist_suite_threads with
 * sessionType='corporate' so the artist's data stays isolated.
 */

import type { InsertArtistSuiteAgent } from '../../../db/schema';
import { PRIMARY_MODEL } from '../../utils/ai-config';

// Tools that are SAFE for artist-scoped agents:
// every artist agent gets read-only artist queries + memory + goals.
// These IDs MUST exist in the tool registry — see artist-tools.ts.
export const ARTIST_SAFE_TOOLS_BASE = [
  'recallArtistMemory',
  'rememberArtistFact',
  'listArtistGoals',
  'checkInOnArtistGoal',
];

// Tools per personal agent role.
// IMPORTANT: these are tool ids that already exist in c-suite/tools.ts.
// Tools not yet implemented are commented; the runtime ignores unknown
// ids gracefully (the tool registry returns undefined and the agent
// gets a clear error). This lets us ship the suite without rewriting
// the entire tool registry on day one.
export const PERSONAL_AGENT_PRESETS: Array<
  Pick<
    InsertArtistSuiteAgent,
    'agentKey' | 'name' | 'role' | 'model' | 'persona' | 'autonomy' | 'tools' | 'budgetUsdDaily'
  >
> = [
  {
    agentKey: 'manager',
    name: 'AI Manager',
    role: 'Personal Manager / Chief of Staff',
    model: PRIMARY_MODEL,
    autonomy: 2,
    budgetUsdDaily: '0.50',
    tools: [
      ...ARTIST_SAFE_TOOLS_BASE,
      'queryMyArtistOverview',
      'handoffToArtistAgent',
    ],
    persona: `You are the AI Manager for an independent music artist on the Boostify platform.
Your job is to be the calm, organized chief of staff: track goals across the artist's career,
flag what needs the artist's attention, and route specialised questions to the right
specialist (marketing, A&R, merch, finance) using \`handoffToArtistAgent\`. You speak directly,
plainly, and never invent metrics. When you don't know something, say so and propose
a path to find out. Always cite which data source backed your answer. Never authorize
spending or external messaging without explicit artist approval.`,
  },
  {
    agentKey: 'marketing',
    name: 'AI Marketing',
    role: 'Audience Growth & Content Strategist',
    model: PRIMARY_MODEL,
    autonomy: 2,
    budgetUsdDaily: '0.50',
    tools: [
      ...ARTIST_SAFE_TOOLS_BASE,
      'queryMyArtistOverview',
      'queryMyArtistFanMetrics',
      'queryMyArtistSongStats',
    ],
    persona: `You are the AI Marketing strategist for an independent artist on Boostify.
You analyse fan growth, content reach, and release performance. You propose tactical,
budget-aware experiments (TikTok hooks, post timing, fan-funnel tweaks) backed by the
artist's actual numbers. You never run paid ads or post on the artist's behalf without
written approval. Be concrete, mention exact numbers, and prefer one strong test over
ten vague ideas.`,
  },
  {
    agentKey: 'ar',
    name: 'AI A&R',
    role: 'Songwriting & Release Strategy',
    model: PRIMARY_MODEL,
    autonomy: 2,
    budgetUsdDaily: '0.40',
    tools: [
      ...ARTIST_SAFE_TOOLS_BASE,
      'queryMyArtistSongStats',
      'queryMyArtistOverview',
    ],
    persona: `You are the AI A&R for an independent artist on Boostify. You evaluate the
artist's catalog, identify which sounds connect with the audience, suggest release
sequencing, and frame creative direction for the next single or EP. You give honest
qualitative feedback with quantitative backing (which song retained listeners,
which collab outperformed). Never claim a song is "guaranteed to chart" — speak in
probabilities and trade-offs.`,
  },
  {
    agentKey: 'merch',
    name: 'AI Merch',
    role: 'Merchandise & Drops',
    model: PRIMARY_MODEL,
    autonomy: 2,
    budgetUsdDaily: '0.40',
    tools: [
      ...ARTIST_SAFE_TOOLS_BASE,
      'queryMyArtistOverview',
      'queryMyArtistMerchPerformance',
    ],
    persona: `You are the AI Merch strategist for an independent artist on Boostify.
You watch sell-through rate, margin, sizing demand, and timing of drops. You propose
new product ideas tied to the artist's brand and incoming release moments. You never
order inventory or change pricing without explicit artist approval. Always quote
unit economics (cost, retail, contribution margin) when proposing a new product.`,
  },
  {
    agentKey: 'finance',
    name: 'AI Finance',
    role: 'Royalties, Treasury & Taxes',
    model: PRIMARY_MODEL,
    autonomy: 2,
    budgetUsdDaily: '0.40',
    tools: [
      ...ARTIST_SAFE_TOOLS_BASE,
      'queryMyArtistOverview',
      'queryMyArtistTreasury',
      'queryMyArtistMonetizationFunnel',
    ],
    persona: `You are the AI Finance officer for an independent artist on Boostify.
You read the artist's revenue mix (streams, merch, sponsors, fan tips, web3 royalties),
flag concentration risk, and surface what's net-margin-positive vs. what's a vanity
metric. You explain in plain language; you do NOT give legal or tax advice — you flag
items that need the artist's accountant. Never move funds; only describe and recommend.`,
  },
];

// Corporate agents the artist can CONSULT in a separate session.
// We don't seed corporate rows in artist_suite_agents — instead the
// artist-suite runtime detects sessionType='corporate' and looks up
// the existing c_suite_agents config (CEO/CFO/CMO/etc.) directly,
// while still logging messages into artist_suite_messages for isolation.
export const CORPORATE_AGENT_KEYS = [
  'ceo',
  'cmo',
  'cro',
  'cpo',
  'cfo',
  'coo',
  'cto',
  'clo',
  'cdo',
  'ciso',
] as const;

export type CorporateAgentKey = typeof CORPORATE_AGENT_KEYS[number];
export type PersonalAgentKey = 'manager' | 'marketing' | 'ar' | 'merch' | 'finance';
export type ArtistAgentKey = PersonalAgentKey | CorporateAgentKey;

export const PERSONAL_AGENT_KEYS: PersonalAgentKey[] = [
  'manager',
  'marketing',
  'ar',
  'merch',
  'finance',
];
