/** Default layout for a new artist profile. Existing saved layouts are not changed. */
export const MUSIC_STARTER_SECTIONS = ['songs', 'videos', 'galleries'] as const;
export function musicStarterVisibility(sectionIds: readonly string[]): Record<string, boolean> {
  const enabled = new Set<string>(MUSIC_STARTER_SECTIONS);
  return Object.fromEntries(sectionIds.map(id => [id, enabled.has(id)]));
}
export function musicStarterOrder(sectionIds: readonly string[]): string[] {
  const enabled = new Set<string>(MUSIC_STARTER_SECTIONS);
  return [...MUSIC_STARTER_SECTIONS.filter(id => sectionIds.includes(id)), ...sectionIds.filter(id => !enabled.has(id))];
}

// Older profiles without a saved layout keep their previous defaults.
export const MUSIC_STARTER_CUTOFF = '2026-11-02T00:17:33.000Z';
export function usesMusicStarter(createdAt: unknown): boolean {
  if (!(typeof createdAt === 'string' || createdAt instanceof Date)) return false;
  const time = new Date(createdAt).getTime();
  return Number.isFinite(time) && time >= Date.parse(MUSIC_STARTER_CUTOFF);
}
