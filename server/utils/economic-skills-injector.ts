/**
 * ECONOMIC SKILLS INJECTOR — FSI Knowledge Injection for Agent Brain
 *
 * Source: anthropics/financial-services (Apache-2.0)
 * Reads SKILL.md files from the financial-services submodule and injects
 * domain expertise into each agent's system prompts.
 *
 * Submodule: .agents/financial-services/
 * Skills path: .agents/financial-services/plugins/vertical-plugins/{vertical}/skills/
 *
 * Fail-silent: if skills are not found, returns the base prompt unchanged.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// ============================================
// SKILL MAPPING: Agent → FSI Vertical Skills
// ============================================

const FSI_SKILLS_BASE = join(process.cwd(), '.agents', 'financial-services', 'plugins', 'vertical-plugins');

/** Vertical slugs available in the anthropics/financial-services repo */
type FSIVertical = 'financial-analysis' | 'equity-research' | 'private-equity' | 'wealth-management' | 'fund-admin';

/** Each economic engine agent gets specific FSI skills from relevant verticals */
const AGENT_FSI_SKILLS: Record<string, Array<{ vertical: FSIVertical; skill?: string }>> = {
  capital_keeper: [
    { vertical: 'wealth-management' },       // Portfolio rebalancing, risk reporting
    { vertical: 'fund-admin' },              // NAV tie-out, variance commentary
  ],
  flow_maker: [
    { vertical: 'financial-analysis' },      // DCF, yield modeling, 3-statement analysis
    { vertical: 'fund-admin' },              // GL reconciliation, accruals
  ],
  alpha_hunter: [
    { vertical: 'equity-research' },         // Catalyst tracking, model updates
    { vertical: 'private-equity' },          // Sourcing, opportunity screening
  ],
  shield_node: [
    { vertical: 'private-equity' },          // Diligence checklists, risk frameworks
    { vertical: 'wealth-management' },       // Risk-adjusted reporting
  ],
  market_hunter: [
    { vertical: 'equity-research' },         // Technical/fundamental convergence
    { vertical: 'financial-analysis' },      // Comps, price target frameworks
  ],
  market_analyst: [
    { vertical: 'equity-research' },
    { vertical: 'financial-analysis' },
    { vertical: 'wealth-management' },
  ],
  token_operations: [
    { vertical: 'financial-analysis' },      // Market making, liquidity analysis
    { vertical: 'private-equity' },          // Venture portfolio monitoring
  ],
};

// ============================================
// SKILL LOADER
// ============================================

const skillCache = new Map<string, string>();

/** Load all SKILL.md files from a vertical, concatenated */
function loadVerticalSkills(vertical: FSIVertical): string {
  const cacheKey = vertical;
  if (skillCache.has(cacheKey)) return skillCache.get(cacheKey)!;

  const verticalPath = join(FSI_SKILLS_BASE, vertical, 'skills');
  if (!existsSync(verticalPath)) {
    skillCache.set(cacheKey, '');
    return '';
  }

  try {
    const skillDirs = readdirSync(verticalPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const parts: string[] = [];
    for (const skillDir of skillDirs) {
      const skillFile = join(verticalPath, skillDir, 'SKILL.md');
      if (existsSync(skillFile)) {
        let content = readFileSync(skillFile, 'utf-8');
        // Strip YAML frontmatter (between --- markers)
        content = content.replace(/^---[\s\S]*?---\n?/, '').trim();
        if (content) parts.push(content);
      }
    }

    const combined = parts.join('\n\n---\n\n');
    skillCache.set(cacheKey, combined);
    return combined;
  } catch {
    skillCache.set(cacheKey, '');
    return '';
  }
}

/** Check if the FSI submodule is installed */
export function isFSISubmoduleInstalled(): boolean {
  return existsSync(FSI_SKILLS_BASE);
}

/** List available verticals from the submodule */
export function listAvailableFSIVerticals(): string[] {
  if (!existsSync(FSI_SKILLS_BASE)) return [];
  try {
    return readdirSync(FSI_SKILLS_BASE, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch {
    return [];
  }
}

/** Clear the in-memory cache (call when submodule is updated) */
export function clearFSISkillCache(): void {
  skillCache.clear();
}

// ============================================
// PROMPT BUILDER
// ============================================

/**
 * Build an enriched system prompt for an Economic Engine agent.
 * Loads FSI skills for the agent and appends them after the base prompt.
 * Returns base prompt unchanged if skills are not available.
 */
export function buildFinancialAgentPrompt(agentType: string, basePrompt: string): string {
  const skillConfigs = AGENT_FSI_SKILLS[agentType];
  if (!skillConfigs?.length || !isFSISubmoduleInstalled()) return basePrompt;

  const skillSections: string[] = [];

  for (const config of skillConfigs) {
    const content = loadVerticalSkills(config.vertical);
    if (content) {
      skillSections.push(
        `## FSI EXPERTISE: ${config.vertical.toUpperCase().replace(/-/g, ' ')}\n\n${content}`,
      );
    }
  }

  if (skillSections.length === 0) return basePrompt;

  return [
    basePrompt,
    '',
    '# INSTITUTIONAL FINANCIAL EXPERTISE',
    'The following domain knowledge from professional financial services informs your decisions:',
    '',
    skillSections.join('\n\n'),
    '',
    '# IMPORTANT: Apply the above expertise when making decisions. Always think like a professional',
    '# financial analyst — consider risk-adjusted returns, not just absolute returns.',
  ].join('\n');
}

/**
 * Build a market analysis prompt enriched with all relevant FSI skills.
 * Used by the master Agent Brain when analyzing market conditions.
 */
export function buildMasterAnalystPrompt(basePrompt: string): string {
  if (!isFSISubmoduleInstalled()) return basePrompt;

  const verticals: FSIVertical[] = ['financial-analysis', 'equity-research', 'wealth-management'];
  const skillSections: string[] = [];

  for (const vertical of verticals) {
    const content = loadVerticalSkills(vertical);
    if (content) skillSections.push(`## ${vertical.toUpperCase()}\n\n${content}`);
  }

  if (skillSections.length === 0) return basePrompt;

  return [
    basePrompt,
    '',
    '# INSTITUTIONAL ANALYSIS FRAMEWORKS',
    skillSections.join('\n\n---\n\n'),
  ].join('\n');
}
