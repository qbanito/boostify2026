/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOSTIFY — Marketing Skills Loader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Loads SKILL.md files from the .agents/marketingskills submodule and
 * provides them as injectable prompt strings for AI calls.
 *
 * Source: https://github.com/coreyhaines31/marketingskills
 * Location: .agents/marketingskills/skills/{skill-name}/SKILL.md
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const SKILLS_BASE = path.join(process.cwd(), '.agents', 'marketingskills', 'skills');
const skillCache: Record<string, string> = {};

// ─── All available skills from the repo ──────────────────────────────────────

export type MarketingSkillName =
  | 'ab-testing'
  | 'ad-creative'
  | 'ads'
  | 'ai-seo'
  | 'analytics'
  | 'aso'
  | 'churn-prevention'
  | 'cold-email'
  | 'co-marketing'
  | 'community-marketing'
  | 'competitor-profiling'
  | 'competitors'
  | 'content-strategy'
  | 'copy-editing'
  | 'copywriting'
  | 'cro'
  | 'customer-research'
  | 'directory-submissions'
  | 'emails'
  | 'free-tools'
  | 'image'
  | 'launch'
  | 'lead-magnets'
  | 'marketing-ideas'
  | 'marketing-psychology'
  | 'onboarding'
  | 'paywalls'
  | 'popups'
  | 'pricing'
  | 'product-marketing'
  | 'programmatic-seo'
  | 'referrals'
  | 'revops'
  | 'sales-enablement'
  | 'schema'
  | 'seo-audit'
  | 'signup'
  | 'site-architecture'
  | 'sms'
  | 'social'
  | 'video';

// ─── Core loader functions ────────────────────────────────────────────────────

/**
 * Loads a single SKILL.md file by name.
 * Returns empty string if skill not found (graceful degradation).
 */
export function loadSkill(skillName: MarketingSkillName | string): string {
  if (skillCache[skillName]) return skillCache[skillName];

  const skillPath = path.join(SKILLS_BASE, skillName, 'SKILL.md');

  try {
    const raw = fs.readFileSync(skillPath, 'utf-8');

    // Strip YAML frontmatter block — only keep the markdown body
    const withoutFrontmatter = raw.replace(/^---[\s\S]*?---\n/, '').trim();

    skillCache[skillName] = withoutFrontmatter;
    return withoutFrontmatter;
  } catch {
    // Skill file not found — fail silently to never break production calls
    return '';
  }
}

/**
 * Loads and concatenates multiple skills.
 * Separates skills with a clear markdown divider.
 */
export function loadSkills(...skillNames: (MarketingSkillName | string)[]): string {
  return skillNames
    .map(loadSkill)
    .filter(Boolean)
    .join('\n\n---\n\n');
}

/**
 * Returns the raw SKILL.md content including YAML frontmatter.
 * Useful for debugging or building skill indexes.
 */
export function loadSkillRaw(skillName: string): string {
  const skillPath = path.join(SKILLS_BASE, skillName, 'SKILL.md');
  try {
    return fs.readFileSync(skillPath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Lists all available skill names from the skills directory.
 * Returns empty array if directory not found.
 */
export function listAvailableSkills(): string[] {
  try {
    return fs
      .readdirSync(SKILLS_BASE, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Clears the in-memory skill cache.
 * Useful in tests or when skill files are updated on disk.
 */
export function clearSkillCache(): void {
  Object.keys(skillCache).forEach((k) => delete skillCache[k]);
}
