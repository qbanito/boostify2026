/**
 * Shared instrument taxonomy + STRICT bio-based instrumentalist detection.
 * ─────────────────────────────────────────────────────────────────────────
 * Rule (per product decision): a lead is only tagged as an instrumentalist
 * when their own bio/description SAYS SO — role nouns ("trumpeter",
 * "trompetista"), play verbs ("I play trumpet", "toco la trompeta") or
 * teaching/study claims ("trumpet teacher", "clases de trompeta").
 * A bare instrument noun ("trumpet community", "trumpet shop") is NOT enough.
 * Instrument emojis (🎺) count as a weaker, MEDIUM-confidence signal.
 */

export type InstrumentConfidence = 'high' | 'medium';

export interface InstrumentDef {
  key: string;            // canonical name stored in DB (musicians.instrument)
  label: string;          // EN display
  labelEs: string;        // ES display
  category: string;       // producer-tools filter tab / musicians.category
  emoji: string;          // marker/badge emoji
  defaultPrice: number;   // suggested session price (USD)
  nounsEn: string[];      // instrument nouns (EN) used to build strict patterns
  nounsEs: string[];      // instrument nouns (ES)
  roles: string[];        // explicit role nouns (any language)
  emojis?: string[];      // emoji signals (medium confidence)
}

export const INSTRUMENTS: InstrumentDef[] = [
  { key: 'Trumpet', label: 'Trumpet', labelEs: 'Trompeta', category: 'Brass', emoji: '🎺', defaultPrice: 120, nounsEn: ['trumpet', 'flugelhorn', 'cornet'], nounsEs: ['trompeta', 'trompette', 'fliscorno', 'corneta'], roles: ['trumpeter', 'trompetista', 'trumpetist', 'trompettiste'], emojis: ['🎺'] },
  { key: 'Trombone', label: 'Trombone', labelEs: 'Trombón', category: 'Brass', emoji: '🎺', defaultPrice: 120, nounsEn: ['trombone'], nounsEs: ['trombon', 'trombón'], roles: ['trombonist', 'trombonista', 'tromboniste'] },
  { key: 'Tuba', label: 'Tuba', labelEs: 'Tuba', category: 'Brass', emoji: '🎺', defaultPrice: 110, nounsEn: ['tuba', 'sousaphone', 'euphonium', 'baritone horn'], nounsEs: ['tuba', 'bombardino'], roles: ['tubist', 'tuba player', 'tubista'] },
  { key: 'French Horn', label: 'French Horn', labelEs: 'Corno francés', category: 'Brass', emoji: '🎺', defaultPrice: 120, nounsEn: ['french horn'], nounsEs: ['corno frances', 'corno francés', 'trompa'], roles: ['hornist', 'cornista'] },
  { key: 'Saxophone', label: 'Saxophone', labelEs: 'Saxofón', category: 'Wind', emoji: '🎷', defaultPrice: 130, nounsEn: ['saxophone', 'sax', 'alto sax', 'tenor sax'], nounsEs: ['saxofon', 'saxofón', 'saxo'], roles: ['saxophonist', 'saxofonista', 'saxophoniste'], emojis: ['🎷'] },
  { key: 'Clarinet', label: 'Clarinet', labelEs: 'Clarinete', category: 'Wind', emoji: '🎷', defaultPrice: 110, nounsEn: ['clarinet'], nounsEs: ['clarinete'], roles: ['clarinetist', 'clarinettist', 'clarinetista', 'clarinettiste'] },
  { key: 'Flute', label: 'Flute', labelEs: 'Flauta', category: 'Wind', emoji: '🎷', defaultPrice: 110, nounsEn: ['flute'], nounsEs: ['flauta'], roles: ['flutist', 'flautist', 'flautista', 'flûtiste'] },
  { key: 'Guitar', label: 'Guitar', labelEs: 'Guitarra', category: 'Guitar', emoji: '🎸', defaultPrice: 100, nounsEn: ['guitar'], nounsEs: ['guitarra'], roles: ['guitarist', 'guitarrista', 'guitariste'], emojis: ['🎸'] },
  { key: 'Bass', label: 'Bass', labelEs: 'Bajo', category: 'Bass', emoji: '🎸', defaultPrice: 100, nounsEn: ['bass guitar', 'upright bass', 'double bass', 'electric bass'], nounsEs: ['bajo electrico', 'bajo eléctrico', 'contrabajo'], roles: ['bassist', 'bajista', 'bass player', 'contrabajista', 'bassiste'] },
  { key: 'Drums', label: 'Drums', labelEs: 'Batería', category: 'Drums', emoji: '🥁', defaultPrice: 110, nounsEn: ['drums', 'drum kit'], nounsEs: ['bateria', 'batería'], roles: ['drummer', 'baterista', 'batero', 'batteur'], emojis: ['🥁'] },
  { key: 'Percussion', label: 'Percussion', labelEs: 'Percusión', category: 'Drums', emoji: '🥁', defaultPrice: 100, nounsEn: ['percussion', 'congas', 'timbales', 'cajon'], nounsEs: ['percusion', 'percusión', 'cajón'], roles: ['percussionist', 'percusionista', 'conguero', 'timbalero', 'percussionniste'] },
  { key: 'Piano', label: 'Piano', labelEs: 'Piano', category: 'Piano', emoji: '🎹', defaultPrice: 120, nounsEn: ['piano', 'keyboards', 'keys'], nounsEs: ['piano', 'teclados'], roles: ['pianist', 'pianista', 'keyboardist', 'tecladista', 'keyboard player', 'pianiste'], emojis: ['🎹'] },
  { key: 'Violin', label: 'Violin', labelEs: 'Violín', category: 'Strings', emoji: '🎻', defaultPrice: 130, nounsEn: ['violin', 'fiddle'], nounsEs: ['violin', 'violín'], roles: ['violinist', 'violinista', 'fiddler', 'violoniste'], emojis: ['🎻'] },
  { key: 'Viola', label: 'Viola', labelEs: 'Viola', category: 'Strings', emoji: '🎻', defaultPrice: 120, nounsEn: ['viola'], nounsEs: ['viola'], roles: ['violist'] },
  { key: 'Cello', label: 'Cello', labelEs: 'Violonchelo', category: 'Strings', emoji: '🎻', defaultPrice: 130, nounsEn: ['cello'], nounsEs: ['violonchelo', 'chelo'], roles: ['cellist', 'violonchelista', 'chelista', 'violoncelliste'] },
  { key: 'Harp', label: 'Harp', labelEs: 'Arpa', category: 'Strings', emoji: '🎻', defaultPrice: 140, nounsEn: ['harp'], nounsEs: ['arpa'], roles: ['harpist', 'arpista', 'harpiste'] },
  { key: 'Accordion', label: 'Accordion', labelEs: 'Acordeón', category: 'Other', emoji: '🪗', defaultPrice: 100, nounsEn: ['accordion'], nounsEs: ['acordeon', 'acordeón'], roles: ['accordionist', 'acordeonista', 'accordéoniste'], emojis: ['🪗'] },
  { key: 'Banjo', label: 'Banjo', labelEs: 'Banjo', category: 'Guitar', emoji: '🪕', defaultPrice: 90, nounsEn: ['banjo'], nounsEs: ['banjo'], roles: ['banjoist', 'banjo player'], emojis: ['🪕'] },
  { key: 'Mandolin', label: 'Mandolin', labelEs: 'Mandolina', category: 'Guitar', emoji: '🪕', defaultPrice: 90, nounsEn: ['mandolin'], nounsEs: ['mandolina'], roles: ['mandolinist', 'mandolin player'] },
  { key: 'Ukulele', label: 'Ukulele', labelEs: 'Ukelele', category: 'Guitar', emoji: '🎸', defaultPrice: 80, nounsEn: ['ukulele'], nounsEs: ['ukelele'], roles: ['ukulele player', 'ukulelist'] },
];

export const INSTRUMENT_BY_KEY: Record<string, InstrumentDef> =
  Object.fromEntries(INSTRUMENTS.map((i) => [i.key, i]));

export function instrumentCategory(key: string | null | undefined): string {
  return (key && INSTRUMENT_BY_KEY[key]?.category) || 'Other';
}

// ─── Pattern builders (strict) ───────────────────────────────────────────────
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build the HIGH-confidence regex for one instrument. */
function buildHighPattern(def: InstrumentDef): RegExp {
  const parts: string[] = [];
  // 1) Explicit role nouns — "trumpeter", "trompetista", "trompettiste"
  for (const r of def.roles) parts.push(`\\b${esc(r)}s?\\b`);
  for (const n of [...def.nounsEn, ...def.nounsEs]) {
    const N = esc(n);
    // 2) "<noun> player" / "<noun>player" (no-space). SINGULAR only — plural
    //    ("trumpet players") is usually talk ABOUT others (communities, orgs).
    parts.push(`\\b${N}\\s*player\\b`);
    // 3) Possessive claim — "my trumpet", "mi trompeta", "mes cours de trompette"
    parts.push(`\\b(?:my|mi|mis|mes|ma|mon)\\s+${N}\\b`);
    // 4) Play verbs — EN "play(s/ing) (the) trumpet", ES "toco/toca la trompeta", FR "je joue de la trompette"
    parts.push(`\\bplay(?:s|ing|ed)?\\s+(?:the\\s+)?${N}\\b`);
    parts.push(`\\btoc(?:o|a|ando|amos)\\s+(?:la\\s+|el\\s+)?${N}\\b`);
    parts.push(`\\bjoue\\s+(?:de\\s+la\\s+|du\\s+)?${N}\\b`);
    // 5) Teaching / studying claims — the person is the instrumentalist
    parts.push(`\\bteach(?:es|ing)?\\s+(?:the\\s+)?${N}\\b`);
    parts.push(`\\b${N}\\s+(?:teacher|instructor|educator|professor|lessons|student|major|soloist|virtuoso|performer|artist)\\b`);
    parts.push(`\\b(?:profesor|profesora|maestro|maestra|clases|estudiante|solista)\\s+de\\s+${N}\\b`);
    parts.push(`\\b(?:cours|professeur|joueur|joueuse)\\s+de\\s+(?:la\\s+)?${N}\\b`);
    parts.push(`\\bense[nñ]o\\s+${N}\\b`);
    // 6) Section/chair claims — "principal trumpet", "lead trumpet"
    parts.push(`\\b(?:principal|lead|first|second|session)\\s+${N}\\b`);
  }
  return new RegExp(parts.join('|'), 'iu');
}

interface CompiledDef { def: InstrumentDef; high: RegExp }
let compiled: CompiledDef[] | null = null;
function getCompiled(): CompiledDef[] {
  if (!compiled) compiled = INSTRUMENTS.map((def) => ({ def, high: buildHighPattern(def) }));
  return compiled;
}

export interface InstrumentDetection {
  instrument: string;               // canonical key, e.g. 'Trumpet'
  category: string;                 // producer-tools category
  confidence: InstrumentConfidence; // 'high' = role/verb claim, 'medium' = emoji/handle signal
  evidence: string;                 // matched snippet (audit trail)
  all: string[];                    // every instrument detected (multi-instrumentalists)
}

// Accounts that are businesses/orgs/media — weak (medium) signals are rejected
// for these; only an explicit high-confidence claim can tag them.
const BUSINESS_GUARD = /\b(photo(?:graph(?:y|er))?|fotograf|videograph|filmmaker|casting|agency|agencia|management|label|store|shop|tienda|manufacturer|mouthpiece|repair|reparaci[oó]n|luthier|competition|concurso|festival|academy|academia|school|escuela|university|universidad|college|conservator|nonprofit|community|comunidad|official page|official instagram|supplier|rentals?|magazine|podcast|org)\b/iu;
// Words proving the account belongs to a working musician (needed for medium signals).
const MUSICIAN_CONTEXT = /\b(musician|m[uú]sico|musicien|soloist|solista|artist|artista|band|banda|orchestra|orquesta|sinf[oó]nica|philharmonic|filarm[oó]nica|jazz|gig|touring|session|freelance|m[uú]sica|music)\b/iu;

export interface DetectInput {
  bio?: string | null;
  name?: string | null;
  handle?: string | null;
}

/**
 * STRICT detector. Returns null unless the text explicitly identifies the
 * person as an instrumentalist. Vocalists/producers/DJs are intentionally
 * NOT detected (product rule: instrumentalists only).
 */
export function detectInstrument(input: DetectInput): InstrumentDetection | null {
  const bio = (input.bio || '').replace(/\s+/g, ' ').trim();
  const name = (input.name || '').replace(/\s+/g, ' ').trim();
  const handle = (input.handle || '').toLowerCase();
  const text = [bio, name].filter(Boolean).join(' • ');
  if (!text && !handle) return null;

  const isBusiness = BUSINESS_GUARD.test(`${text} ${handle}`);

  // ── HIGH: explicit role/verb/teaching claim in bio or name ──
  const highs: { def: InstrumentDef; evidence: string }[] = [];
  for (const { def, high } of getCompiled()) {
    const m = text.match(high);
    if (m) highs.push({ def, evidence: m[0] });
  }
  if (highs.length) {
    const all = highs.map((h) => h.def.key);
    const primary = highs[0];
    return {
      instrument: primary.def.key,
      category: primary.def.category,
      confidence: 'high',
      evidence: highs.map((h) => h.evidence).slice(0, 3).join(' | ').slice(0, 200),
      all,
    };
  }

  // ── MEDIUM signals — rejected outright for business/org accounts ──
  if (isBusiness) return null;
  const hasMusicianContext = MUSICIAN_CONTEXT.test(text);

  // Emoji signal: exactly ONE distinct instrument emoji + musician context.
  // (🎷🎸🎹 together = decorative/ambiguous → skip.)
  if (hasMusicianContext) {
    const emojiHits: InstrumentDef[] = [];
    for (const { def } of getCompiled()) {
      if ((def.emojis || []).some((e) => text.includes(e)) && !emojiHits.includes(def)) emojiHits.push(def);
    }
    if (emojiHits.length === 1) {
      const def = emojiHits[0];
      return { instrument: def.key, category: def.category, confidence: 'medium', evidence: `${def.emoji} + music context`, all: [def.key] };
    }
  }

  // Handle signal: username contains the instrument noun (e.g. @castillotrumpet)
  // AND the bio proves they are a working musician.
  if (handle && hasMusicianContext) {
    for (const def of INSTRUMENTS) {
      const nouns = [...def.nounsEn, ...def.nounsEs].filter((n) => !n.includes(' ') && n.length >= 4);
      if (nouns.some((n) => handle.includes(n.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
        return { instrument: def.key, category: def.category, confidence: 'medium', evidence: `handle contains "${def.key.toLowerCase()}" + musician bio`, all: [def.key] };
      }
    }
  }
  return null;
}
