/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOSTIFY — AI Skills Injector
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Central utility that enriches AI system prompts with:
 *   1. Relevant marketing skill instructions (from coreyhaines31/marketingskills)
 *   2. Artist-specific context (from artist_marketing_context table)
 *
 * Usage in any route/service:
 *
 *   import { buildEnrichedSystemPrompt } from '../utils/ai-skills-injector';
 *
 *   const systemPrompt = await buildEnrichedSystemPrompt(
 *     'social-hub',
 *     'You are a social media expert for musicians...',
 *     artistUserId,   // optional — adds artist context
 *   );
 *
 *   const result = await callAI('social', [
 *     { role: 'system', content: systemPrompt },
 *     { role: 'user', content: userRequest },
 *   ]);
 *
 * Module → Skills mapping follows the integration plan for all 21 modules.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { loadSkills } from '../services/marketing-skills-loader';
import { getOrGenerateContext } from '../services/artist-marketing-context';

// ─── Module identifiers ───────────────────────────────────────────────────────

export type BoostifyModule =
  | 'social-hub'
  | 'promo-clips'
  | 'ads-campaigns'
  | 'observation-engine'
  | 'deep-brief'
  | 'career-suite'
  | 'artist-blueprint'
  | 'business-plan'
  | 'sponsors'
  | 'agent-gateway'
  | 'news'
  | 'hermes-agent'
  | 'influencer-module'
  | 'audience-capture'
  | 'renaissance-studio'
  | 'emotional-studio'
  | 'aas-engine'
  | 'brand-collabs'
  | 'viral-products'
  | 'electronic-press-kit'
  | 'gamma-presentations';

// ─── Module → Skills mapping ──────────────────────────────────────────────────
// Each module is injected with the most relevant marketing skills from the
// coreyhaines31/marketingskills repo. Skills are loaded as instruction blocks.

const MODULE_SKILLS: Record<BoostifyModule, string[]> = {
  'social-hub':            ['social', 'copywriting', 'content-strategy'],
  'promo-clips':           ['social', 'ad-creative', 'video', 'copywriting'],
  'ads-campaigns':         ['ads', 'ad-creative', 'cro', 'ab-testing'],
  'observation-engine':    ['analytics', 'competitor-profiling', 'customer-research'],
  'deep-brief':            ['customer-research', 'competitor-profiling', 'product-marketing', 'marketing-psychology'],
  'career-suite':          ['launch', 'pricing', 'marketing-ideas', 'marketing-psychology'],
  'artist-blueprint':      ['product-marketing', 'marketing-psychology', 'content-strategy'],
  'business-plan':         ['pricing', 'launch', 'revops', 'sales-enablement'],
  'sponsors':              ['cold-email', 'sales-enablement', 'revops'],
  'agent-gateway':         ['cold-email', 'sales-enablement', 'co-marketing'],
  'news':                  ['copywriting', 'copy-editing', 'content-strategy'],
  'hermes-agent':          ['product-marketing'],
  'influencer-module':     ['co-marketing', 'referrals', 'lead-magnets'],
  'audience-capture':      ['cro', 'lead-magnets', 'emails', 'popups'],
  'renaissance-studio':    ['copywriting', 'image', 'content-strategy'],
  'emotional-studio':      ['marketing-psychology', 'copywriting'],
  'aas-engine':            ['marketing-ideas', 'marketing-psychology', 'product-marketing'],
  'brand-collabs':         ['co-marketing', 'sales-enablement', 'pricing'],
  'viral-products':        ['marketing-ideas', 'pricing', 'free-tools'],
  'electronic-press-kit':  ['sales-enablement', 'copywriting'],
  'gamma-presentations':   ['sales-enablement', 'copywriting'],
};

// ─── Agent Gateway sub-agent skills ──────────────────────────────────────────
// More granular skill injection for each of the 9 gateway agents.

export type GatewayAgent =
  | 'manager'
  | 'booking'
  | 'licensing'
  | 'brand-deals'
  | 'collaboration'
  | 'fan-relations'
  | 'press'
  | 'legal-guard'
  | 'finance';

const GATEWAY_AGENT_SKILLS: Record<GatewayAgent, string[]> = {
  'manager':        ['launch', 'marketing-ideas'],
  'booking':        ['cold-email', 'revops'],
  'licensing':      ['sales-enablement', 'pricing'],
  'brand-deals':    ['cold-email', 'sales-enablement', 'co-marketing'],
  'collaboration':  ['co-marketing', 'copywriting'],
  'fan-relations':  ['emails', 'churn-prevention', 'community-marketing'],
  'press':          ['copywriting', 'copy-editing', 'sales-enablement'],
  'legal-guard':    ['revops'],
  'finance':        ['pricing', 'revops'],
};

// ─── Core builder ─────────────────────────────────────────────────────────────

const SKILLS_HEADER = `
## Marketing Intelligence Layer
The following expert marketing frameworks are injected to elevate the quality of your output.
Apply these frameworks when generating content, strategies, copy, or recommendations.
`;

const ARTIST_CONTEXT_HEADER = `
## Artist Context
Use the following artist-specific information to personalise every response.
`;

/**
 * Builds an enriched system prompt by appending:
 * - Relevant marketing skill instructions for the given module
 * - Artist-specific context (if artistUserId is provided)
 *
 * Returns the original basePrompt if skills loading fails (fail-safe).
 */
export async function buildEnrichedSystemPrompt(
  module: BoostifyModule,
  basePrompt: string,
  artistUserId?: number | null,
): Promise<string> {
  const parts: string[] = [basePrompt];

  // 1. Load marketing skills for this module
  try {
    const skillNames = MODULE_SKILLS[module] ?? [];
    if (skillNames.length > 0) {
      const skillsBlock = loadSkills(...skillNames);
      if (skillsBlock) {
        parts.push(SKILLS_HEADER.trim(), skillsBlock);
      }
    }
  } catch {
    // Fail silently — never break production AI calls
  }

  // 2. Inject artist context if userId is available
  if (artistUserId) {
    try {
      const artistContext = await getOrGenerateContext(artistUserId);
      if (artistContext) {
        parts.push(ARTIST_CONTEXT_HEADER.trim(), artistContext);
      }
    } catch {
      // Fail silently
    }
  }

  return parts.join('\n\n');
}

/**
 * Variant for Agent Gateway sub-agents.
 * Loads agent-specific skills instead of module-level skills.
 */
export async function buildGatewayAgentPrompt(
  agent: GatewayAgent,
  basePrompt: string,
  artistUserId?: number | null,
): Promise<string> {
  const parts: string[] = [basePrompt];

  try {
    const skillNames = GATEWAY_AGENT_SKILLS[agent] ?? [];
    if (skillNames.length > 0) {
      const skillsBlock = loadSkills(...skillNames);
      if (skillsBlock) {
        parts.push(SKILLS_HEADER.trim(), skillsBlock);
      }
    }
  } catch {
    // Fail silently
  }

  if (artistUserId) {
    try {
      const artistContext = await getOrGenerateContext(artistUserId);
      if (artistContext) {
        parts.push(ARTIST_CONTEXT_HEADER.trim(), artistContext);
      }
    } catch {
      // Fail silently
    }
  }

  return parts.join('\n\n');
}

/**
 * Lightweight synchronous version — only injects skills, no artist context.
 * Use when you need a synchronous call and have no userId.
 */
export function buildSkillsOnlyPrompt(
  module: BoostifyModule,
  basePrompt: string,
): string {
  try {
    const skillNames = MODULE_SKILLS[module] ?? [];
    if (skillNames.length === 0) return basePrompt;
    const skillsBlock = loadSkills(...skillNames);
    if (!skillsBlock) return basePrompt;
    return [basePrompt, SKILLS_HEADER.trim(), skillsBlock].join('\n\n');
  } catch {
    return basePrompt;
  }
}
