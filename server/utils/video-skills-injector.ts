/**
 * Video Skills Injector
 * Adapted from: PixVerseAI/skills + aicontentskills/ai-video-storyboard-skill
 *
 * Reads SKILL.md files from installed git submodules in `.agents/`
 * and returns their content for injection into video generation agent prompts.
 *
 * This is the video-generation equivalent of the existing economic-skills-injector.ts.
 *
 * Installed skills (via `git submodule add`):
 *   .agents/pixverse-skills/          → PixVerse CLI skill library
 *   .agents/video-storyboard-skill/   → ai-video-storyboard-skill
 *
 * Usage:
 *   const skill = await loadVideoSkill('storyboard');
 *   const systemPrompt = basePrompt + '\n\n' + skill;
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type VideoSkillId =
  | 'storyboard'       // ai-video-storyboard-skill: brief → multi-shot storyboard
  | 'pixverse-create'  // PixVerseAI/skills: create-video
  | 'pixverse-modify'  // PixVerseAI/skills: modify-video
  | 'pixverse-storyboard-to-video' // PixVerseAI/skills: storyboard-to-video
  | 'pixverse-prompt-enhance'      // PixVerseAI/skills: prompt-enhance
  | 'pixverse-character'           // PixVerseAI/skills: character-design
  | 'pixverse-mondo-poster';       // PixVerseAI/skills: mondo poster design

const SKILL_PATHS: Record<VideoSkillId, string[]> = {
  'storyboard': ['.agents', 'video-storyboard-skill', 'SKILL.md'],
  'pixverse-create': ['.agents', 'pixverse-skills', 'skills', 'capabilities', 'create-video.md'],
  'pixverse-modify': ['.agents', 'pixverse-skills', 'skills', 'capabilities', 'modify-video.md'],
  'pixverse-storyboard-to-video': ['.agents', 'pixverse-skills', 'skills', 'workflows', 'storyboard-to-video.md'],
  'pixverse-prompt-enhance': ['.agents', 'pixverse-skills', 'skills', 'capabilities', 'prompt-enhance.md'],
  'pixverse-character': ['.agents', 'pixverse-skills', 'skills', 'capabilities', 'character-design.md'],
  'pixverse-mondo-poster': ['.agents', 'pixverse-skills', 'skills', 'capabilities', 'mondo-poster-design.md'],
};

const ROOT_DIR = process.cwd();

// Cache to avoid re-reading files on every request
const skillCache = new Map<VideoSkillId, string | null>();

// ─────────────────────────────────────────────────────────────────────────────
// Core loader
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads a video skill from the .agents/ submodule directory.
 * Returns the full SKILL.md content as a string, or null if not found.
 * Results are cached in memory for the process lifetime.
 */
export async function loadVideoSkill(skillId: VideoSkillId): Promise<string | null> {
  if (skillCache.has(skillId)) return skillCache.get(skillId) ?? null;

  const pathParts = SKILL_PATHS[skillId];
  if (!pathParts) return null;

  const filePath = join(ROOT_DIR, ...pathParts);

  try {
    const content = await readFile(filePath, 'utf-8');
    const trimmed = content.trim();
    skillCache.set(skillId, trimmed);
    return trimmed;
  } catch {
    // Submodule not installed — fail silently
    skillCache.set(skillId, null);
    return null;
  }
}

/**
 * Loads multiple skills and concatenates them with separators.
 * Skips any skills that are not installed.
 */
export async function loadVideoSkills(skillIds: VideoSkillId[]): Promise<string> {
  const contents = await Promise.all(skillIds.map((id) => loadVideoSkill(id)));
  return contents
    .filter((c): c is string => c !== null && c.length > 0)
    .join('\n\n---\n\n');
}

/**
 * Returns a trimmed excerpt of a skill (first N lines) for prompt injection.
 * Useful for injecting just the key instructions without the full documentation.
 */
export async function loadVideoSkillExcerpt(
  skillId: VideoSkillId,
  maxLines = 60,
): Promise<string | null> {
  const full = await loadVideoSkill(skillId);
  if (!full) return null;
  return full.split('\n').slice(0, maxLines).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built skill combinations for common use cases
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the storyboard skill content for injection into storyboard generation prompts.
 * Includes the platform-specific shot cadence, visual theme, and post-production checklist.
 */
export async function getStoryboardSkillInjection(): Promise<string> {
  const skill = await loadVideoSkillExcerpt('storyboard', 80);
  if (!skill) return '';
  return `\n\n[STORYBOARD METHODOLOGY — follow these guidelines]\n${skill}`;
}

/**
 * Returns PixVerse prompt enhancement guidelines for use before generating prompts.
 */
export async function getPromptEnhancementSkill(): Promise<string> {
  const skill = await loadVideoSkillExcerpt('pixverse-prompt-enhance', 40);
  if (!skill) return '';
  return `\n\n[VIDEO PROMPT BEST PRACTICES]\n${skill}`;
}

/**
 * Returns the full storyboard-to-video workflow skill.
 */
export async function getStoryboardToVideoSkill(): Promise<string> {
  const skill = await loadVideoSkill('pixverse-storyboard-to-video');
  if (!skill) return '';
  return skill;
}

/**
 * Returns a status report of which skills are installed.
 */
export async function getInstalledSkillsReport(): Promise<Record<VideoSkillId, boolean>> {
  const entries = await Promise.all(
    Object.keys(SKILL_PATHS).map(async (id) => {
      const content = await loadVideoSkill(id as VideoSkillId);
      return [id, content !== null] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<VideoSkillId, boolean>;
}
