/**
 * Event Landing Presets
 * ─────────────────────
 * Drives the post-pay landing page on /video-concepts/project/:id.
 *
 * The intake form lets the client pick an `eventType` (Step 0) AND a visual
 * `style preset` (Step 1, e.g. editorial / cinematic / vintage_film). This
 * file maps that combination onto:
 *
 *   • `modules`   — which interactive sections appear on the landing page
 *                   (countdown, gallery, store, rsvp, guestbook, schedule…)
 *   • `palette`   — color theme that re-skins shared chrome
 *   • `tone`      — copy register (formal / warm / editorial / playful)
 *
 * IMPORTANT: this is read-only configuration. It does not require a DB
 * migration — it lives entirely in the frontend and consumes data that
 * already exists on the `videoConceptProjects` row + its `masterJson`.
 *
 * Artist-profile infrastructure is intentionally NOT touched. The Gallery
 * and Store modules below are *future* hooks (entityType: 'event-landing')
 * and currently render placeholder UI; they can later be powered by the
 * same Firestore-backed `ImageGalleryDisplay` and `OfficialStoreSection`
 * components used in the artist profile, by passing `entityType` +
 * `entityId` once those components are abstracted.
 */

export type LandingModuleId =
  | 'hero'
  | 'storyScript'
  | 'musicSession'
  | 'interactiveApp'
  | 'referenceImages'
  | 'countdown'
  | 'rsvp'
  | 'gallery'
  | 'guestbook'
  | 'schedule'
  | 'store'
  | 'legacyTimeline'
  | 'sponsors'
  | 'nextSteps'
  | 'masterJson';

export type EventTypeKey =
  | 'wedding'
  | 'quinceanera'
  | 'corporate'
  | 'legacy'
  | 'other';

export type StylePresetKey =
  | 'editorial'
  | 'romantic'
  | 'cinematic'
  | 'vintage_film'
  | 'minimal_luxury'
  | 'vibrant'
  | 'modern';

export interface LandingPalette {
  /** Tailwind class fragment for the dominant hero gradient. */
  heroGradient: string;
  /** Tailwind ring/border accent color class (e.g. 'amber'). */
  accent: string;
  /** Background mood for module cards. */
  cardBg: string;
}

export interface LandingPreset {
  /** Module IDs in render order. Always starts with `hero`. */
  modules: LandingModuleId[];
  palette: LandingPalette;
  tone: 'formal' | 'warm' | 'editorial' | 'playful' | 'documentary';
  /** Human label (es/en) shown as the section ribbon. */
  label: { es: string; en: string };
}

/** Default modules that every paid landing always shows. */
const CORE_PAID_MODULES: LandingModuleId[] = [
  'hero',
  'storyScript',
  'musicSession',
  'interactiveApp',
  'referenceImages',
  'nextSteps',
  'masterJson',
];

/** Per-event-type module additions (inserted before `nextSteps`). */
const EVENT_MODULES: Record<EventTypeKey, LandingModuleId[]> = {
  wedding: ['countdown', 'rsvp', 'gallery', 'guestbook', 'schedule', 'store'],
  quinceanera: ['countdown', 'rsvp', 'gallery', 'schedule', 'sponsors', 'store'],
  corporate: ['schedule', 'gallery', 'sponsors'],
  legacy: ['legacyTimeline', 'gallery', 'guestbook', 'store'],
  other: ['gallery', 'store'],
};

const PALETTES: Record<StylePresetKey, LandingPalette> = {
  editorial: {
    heroGradient: 'from-neutral-900 via-neutral-800 to-black',
    accent: 'amber',
    cardBg: 'bg-white/[0.03]',
  },
  romantic: {
    heroGradient: 'from-rose-950 via-orange-900/60 to-black',
    accent: 'rose',
    cardBg: 'bg-rose-500/[0.04]',
  },
  cinematic: {
    heroGradient: 'from-cyan-950 via-slate-900 to-orange-950',
    accent: 'cyan',
    cardBg: 'bg-slate-500/[0.04]',
  },
  vintage_film: {
    heroGradient: 'from-stone-900 via-yellow-900/40 to-black',
    accent: 'yellow',
    cardBg: 'bg-yellow-500/[0.04]',
  },
  minimal_luxury: {
    heroGradient: 'from-stone-800 via-stone-900 to-black',
    accent: 'stone',
    cardBg: 'bg-stone-500/[0.04]',
  },
  vibrant: {
    heroGradient: 'from-fuchsia-900 via-orange-900/60 to-black',
    accent: 'fuchsia',
    cardBg: 'bg-fuchsia-500/[0.04]',
  },
  modern: {
    heroGradient: 'from-neutral-950 via-neutral-900 to-black',
    accent: 'lime',
    cardBg: 'bg-white/[0.03]',
  },
};

const TONES: Record<StylePresetKey, LandingPreset['tone']> = {
  editorial: 'editorial',
  romantic: 'warm',
  cinematic: 'editorial',
  vintage_film: 'documentary',
  minimal_luxury: 'formal',
  vibrant: 'playful',
  modern: 'formal',
};

const EVENT_LABELS: Record<EventTypeKey, { es: string; en: string }> = {
  wedding: { es: 'Boda', en: 'Wedding' },
  quinceanera: { es: 'Quinceañera', en: 'Quinceañera' },
  corporate: { es: 'Corporativo', en: 'Corporate' },
  legacy: { es: 'Legacy / Memorias', en: 'Legacy / Memories' },
  other: { es: 'Evento privado', en: 'Private event' },
};

/**
 * Resolve the landing preset for a given event + style.
 * Falls back to safe defaults when either input is missing.
 */
export function resolveLandingPreset(
  eventType: EventTypeKey | string | null | undefined,
  stylePreset: StylePresetKey | string | null | undefined,
): LandingPreset {
  const evt = (eventType ?? 'other') as EventTypeKey;
  const safeEvent: EventTypeKey =
    evt in EVENT_MODULES ? evt : 'other';

  const sty = (stylePreset ?? 'editorial') as StylePresetKey;
  const safeStyle: StylePresetKey = sty in PALETTES ? sty : 'editorial';

  const eventModules = EVENT_MODULES[safeEvent];
  const modules: LandingModuleId[] = [
    'hero',
    'storyScript',
    'musicSession',
    'interactiveApp',
    'referenceImages',
    ...eventModules,
    'nextSteps',
    'masterJson',
  ];

  // Deduplicate while preserving order.
  const seen = new Set<LandingModuleId>();
  const unique = modules.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });

  return {
    modules: unique,
    palette: PALETTES[safeStyle],
    tone: TONES[safeStyle],
    label: EVENT_LABELS[safeEvent],
  };
}

export const LANDING_CORE_MODULES = CORE_PAID_MODULES;
