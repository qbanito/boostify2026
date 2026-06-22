import { useSyncExternalStore } from 'react';

/**
 * Lightweight global store that lets the floating Support/Assistant widget know
 * when the visitor is the OWNER of the artist profile they are viewing. When a
 * context is present, the widget can route "create" commands to the Artist
 * Command Engine (/api/artist-command) instead of the support Q&A endpoint.
 *
 * The artist profile page publishes the context on mount (owner only) and
 * clears it on unmount, so the capability is automatically scoped to the
 * owner's own profile without coupling the global widget to the page.
 */
export interface CommandContext {
  artistId: string;
  artistName: string;
  artistImageUrl?: string | null;
  genre?: string;
}

let current: CommandContext | null = null;
const listeners = new Set<() => void>();

export function setCommandContext(ctx: CommandContext | null): void {
  current = ctx;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): CommandContext | null {
  return current;
}

/** React hook: re-renders when the active command context changes. */
export function useCommandContext(): CommandContext | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Action verbs that signal the user wants to CREATE/DO something (ES + EN).
const ACTION_VERBS = [
  'crea', 'crear', 'creame', 'créame', 'crname',
  'diseña', 'disena', 'diseñar', 'disenar', 'diseñame', 'disename',
  'genera', 'generar', 'generame', 'genérame',
  'haz', 'hazme', 'hacer',
  'produce', 'producir', 'prodúceme',
  'compon', 'compón', 'componer', 'componme',
  'escribe', 'escribir', 'escribeme', 'escríbeme',
  'prepara', 'preparar', 'preparame', 'prepárame',
  'lanza', 'lanzar', 'arma', 'armame', 'ármame',
  'make', 'create', 'design', 'generate', 'write', 'build',
  'compose', 'launch', 'produce', 'prepare', 'draft',
];

// Module nouns the command engine can act on (ES + EN).
const MODULE_NOUNS = [
  'cancion', 'canción', 'canciones', 'tema', 'temas', 'single', 'sencillo',
  'portada', 'portadas', 'cover', 'caratula', 'carátula', 'arte',
  'video', 'vídeo', 'videos', 'vídeos', 'clip', 'videoclip',
  'campaña', 'campana', 'campaign', 'promo', 'promocion', 'promoción',
  'teaser', 'letra', 'letras', 'lyrics', 'caption', 'metadata',
  'audio', 'beat', 'instrumental',
];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Heuristic: decide whether a message is a module-creation command (vs. a
 * support question). Requires an action verb AND a module noun, OR an explicit
 * "Hey <artist>, …" command prefix. Questions ("¿cómo subo una canción?") are
 * deliberately NOT treated as commands so they fall through to support.
 */
export function looksLikeCommand(message: string): boolean {
  const text = norm(message.trim());
  if (!text) return false;

  // Explicit command framing.
  if (/^\s*(hey|oye|ok)\b/.test(text) && MODULE_NOUNS.some((n) => text.includes(norm(n)))) {
    return true;
  }

  // Plain questions are support, not commands.
  const isQuestion = text.startsWith('?') || /^(como|cómo|que|qué|cual|cuál|cuanto|cuánto|donde|dónde|por que|porque|puedo|puedes|how|what|which|where|why|can|do|does|is|are)\b/.test(text);

  const hasVerb = ACTION_VERBS.some((v) => {
    const nv = norm(v);
    return new RegExp(`(^|\\s)${nv}(\\s|$)`).test(text);
  });
  const hasNoun = MODULE_NOUNS.some((n) => text.includes(norm(n)));

  return hasVerb && hasNoun && !isQuestion;
}
