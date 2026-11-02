export const PROFILE_VISUAL_STYLES = ['classic', 'spotlight', 'editorial', 'aurora', 'neon', 'noir', 'chrome', 'horizon', 'velvet', 'prism'] as const;
export type ProfileVisualStyle = typeof PROFILE_VISUAL_STYLES[number];
export function profileVisualStyle(value: unknown): ProfileVisualStyle {
  return typeof value === 'string' && (PROFILE_VISUAL_STYLES as readonly string[]).includes(value) ? value as ProfileVisualStyle : 'classic';
}
