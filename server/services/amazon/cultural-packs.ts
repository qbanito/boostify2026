/**
 * Cultural Packs — static keyword sets per country / genre.
 *
 * These curated lists are the deterministic backbone of the Amazon Cultural
 * Storefront. The OpenAI booster (cultural-context.ts) refines them with
 * per-artist context, but even when the booster is disabled / fails, these
 * packs guarantee a coherent, on-theme product feed.
 *
 * Each entry: short, search-friendly Amazon keyword.
 */

export interface KeywordEntry {
  q: string;
  searchIndex?: import('./paapi').PaapiSearchIndex;
}

// ── COUNTRY / REGION CULTURAL PACKS ─────────────────────────────────────────
// ISO 3166-1 alpha-2 codes (case-insensitive lookup).
export const CULTURAL_PACKS: Record<string, KeywordEntry[]> = {
  IN: [
    { q: 'mandala tapestry wall hanging', searchIndex: 'HomeAndKitchen' },
    { q: 'indian incense set sandalwood', searchIndex: 'HomeAndKitchen' },
    { q: 'sitar music book', searchIndex: 'Books' },
    { q: 'henna kit natural', searchIndex: 'Beauty' },
    { q: 'meditation cushion zafu', searchIndex: 'HomeAndKitchen' },
    { q: 'turmeric chai latte mix', searchIndex: 'HomeAndKitchen' },
    { q: 'bollywood movie poster', searchIndex: 'HomeAndKitchen' },
    { q: 'brass om wall art', searchIndex: 'HomeAndKitchen' },
  ],
  JP: [
    { q: 'matcha tea ceremony set', searchIndex: 'HomeAndKitchen' },
    { q: 'japanese stationery washi', searchIndex: 'OfficeProducts' },
    { q: 'kimono robe cotton', searchIndex: 'Apparel' },
    { q: 'origami paper premium', searchIndex: 'ArtsAndCrafts' },
    { q: 'haruki murakami novels', searchIndex: 'Books' },
    { q: 'shoji paper lamp', searchIndex: 'HomeAndKitchen' },
    { q: 'lofi vinyl record', searchIndex: 'Music' },
    { q: 'kanji wall art print', searchIndex: 'HomeAndKitchen' },
  ],
  MX: [
    { q: 'talavera ceramic tile decor', searchIndex: 'HomeAndKitchen' },
    { q: 'mezcal copita glass set', searchIndex: 'HomeAndKitchen' },
    { q: 'frida kahlo poster', searchIndex: 'HomeAndKitchen' },
    { q: 'huipil embroidered blouse', searchIndex: 'Apparel' },
    { q: 'lucha libre mask', searchIndex: 'Toys' },
    { q: 'papel picado banner', searchIndex: 'HomeAndKitchen' },
    { q: 'mexican coffee organic', searchIndex: 'HomeAndKitchen' },
    { q: 'mariachi book history', searchIndex: 'Books' },
  ],
  CO: [
    { q: 'colombian coffee whole bean', searchIndex: 'HomeAndKitchen' },
    { q: 'wayuu mochila bag', searchIndex: 'Apparel' },
    { q: 'sombrero vueltiao hat', searchIndex: 'Apparel' },
    { q: 'cumbia music vinyl', searchIndex: 'Music' },
    { q: 'gabriel garcia marquez', searchIndex: 'Books' },
    { q: 'tagua nut jewelry', searchIndex: 'Jewelry' },
    { q: 'arepa maker electric', searchIndex: 'HomeAndKitchen' },
    { q: 'fernando botero art print', searchIndex: 'HomeAndKitchen' },
  ],
  BR: [
    { q: 'bossa nova vinyl record', searchIndex: 'Music' },
    { q: 'havaianas sandals', searchIndex: 'Apparel' },
    { q: 'capoeira berimbau', searchIndex: 'MusicalInstruments' },
    { q: 'brazilian coffee beans', searchIndex: 'HomeAndKitchen' },
    { q: 'yerba mate gourd', searchIndex: 'HomeAndKitchen' },
    { q: 'samba percussion set', searchIndex: 'MusicalInstruments' },
    { q: 'jorge amado novel', searchIndex: 'Books' },
    { q: 'rio carnival mask', searchIndex: 'Toys' },
  ],
  AR: [
    { q: 'argentine yerba mate set', searchIndex: 'HomeAndKitchen' },
    { q: 'tango shoes leather', searchIndex: 'Apparel' },
    { q: 'malbec wine glasses', searchIndex: 'HomeAndKitchen' },
    { q: 'borges fiction book', searchIndex: 'Books' },
    { q: 'gaucho leather belt', searchIndex: 'Apparel' },
    { q: 'argentine bandoneon book', searchIndex: 'Books' },
    { q: 'patagonia hiking gear', searchIndex: 'GardenAndOutdoor' },
  ],
  ES: [
    { q: 'flamenco guitar starter', searchIndex: 'MusicalInstruments' },
    { q: 'spanish olive oil premium', searchIndex: 'HomeAndKitchen' },
    { q: 'paella pan steel', searchIndex: 'HomeAndKitchen' },
    { q: 'spanish poetry book', searchIndex: 'Books' },
    { q: 'castanets dance', searchIndex: 'MusicalInstruments' },
    { q: 'gaudi architecture book', searchIndex: 'Books' },
    { q: 'spanish ceramic tapas plate', searchIndex: 'HomeAndKitchen' },
  ],
  US: [
    { q: 'vinyl record player', searchIndex: 'Electronics' },
    { q: 'denim jacket classic', searchIndex: 'Apparel' },
    { q: 'craft coffee beans', searchIndex: 'HomeAndKitchen' },
    { q: 'streetwear hoodie', searchIndex: 'Apparel' },
    { q: 'instant film camera', searchIndex: 'Electronics' },
    { q: 'concert tee vintage', searchIndex: 'Apparel' },
    { q: 'songwriter notebook', searchIndex: 'OfficeProducts' },
  ],
  GB: [
    { q: 'british tea set bone china', searchIndex: 'HomeAndKitchen' },
    { q: 'oasis vinyl record', searchIndex: 'Music' },
    { q: 'london street style coat', searchIndex: 'Apparel' },
    { q: 'beatles biography', searchIndex: 'Books' },
    { q: 'doc martens boots', searchIndex: 'Apparel' },
    { q: 'british indie music book', searchIndex: 'Books' },
  ],
  FR: [
    { q: 'french press coffee maker', searchIndex: 'HomeAndKitchen' },
    { q: 'parisian beret wool', searchIndex: 'Apparel' },
    { q: 'french perfume niche', searchIndex: 'Beauty' },
    { q: 'serge gainsbourg vinyl', searchIndex: 'Music' },
    { q: 'french poetry baudelaire', searchIndex: 'Books' },
    { q: 'edith piaf collection', searchIndex: 'Music' },
  ],
  DE: [
    { q: 'kraftwerk vinyl record', searchIndex: 'Music' },
    { q: 'german beer stein', searchIndex: 'HomeAndKitchen' },
    { q: 'bauhaus design book', searchIndex: 'Books' },
    { q: 'leather lederhosen', searchIndex: 'Apparel' },
    { q: 'modular synthesizer', searchIndex: 'MusicalInstruments' },
  ],
  IT: [
    { q: 'italian espresso machine moka', searchIndex: 'HomeAndKitchen' },
    { q: 'leather italian wallet', searchIndex: 'Apparel' },
    { q: 'pasta maker manual', searchIndex: 'HomeAndKitchen' },
    { q: 'italian opera vinyl', searchIndex: 'Music' },
    { q: 'fellini film collection', searchIndex: 'All' },
  ],
  NG: [
    { q: 'ankara fabric african print', searchIndex: 'ArtsAndCrafts' },
    { q: 'afrobeats vinyl record', searchIndex: 'Music' },
    { q: 'nigerian cookbook jollof', searchIndex: 'Books' },
    { q: 'african djembe drum', searchIndex: 'MusicalInstruments' },
    { q: 'kente cloth wall art', searchIndex: 'HomeAndKitchen' },
    { q: 'fela kuti biography', searchIndex: 'Books' },
  ],
  KR: [
    { q: 'korean skincare set', searchIndex: 'Beauty' },
    { q: 'kpop album bts', searchIndex: 'Music' },
    { q: 'gochujang korean pepper paste', searchIndex: 'HomeAndKitchen' },
    { q: 'hanbok korean dress', searchIndex: 'Apparel' },
    { q: 'korean stationery cute', searchIndex: 'OfficeProducts' },
  ],
  CN: [
    { q: 'chinese ink calligraphy set', searchIndex: 'ArtsAndCrafts' },
    { q: 'guzheng music book', searchIndex: 'Books' },
    { q: 'chinese tea pu erh', searchIndex: 'HomeAndKitchen' },
    { q: 'cheongsam silk dress', searchIndex: 'Apparel' },
    { q: 'feng shui decor', searchIndex: 'HomeAndKitchen' },
  ],
  JM: [
    { q: 'reggae vinyl record bob marley', searchIndex: 'Music' },
    { q: 'rasta hat knit', searchIndex: 'Apparel' },
    { q: 'jamaican coffee blue mountain', searchIndex: 'HomeAndKitchen' },
    { q: 'steel pan drum', searchIndex: 'MusicalInstruments' },
    { q: 'reggae music book', searchIndex: 'Books' },
  ],
  PR: [
    { q: 'reggaeton vinyl record', searchIndex: 'Music' },
    { q: 'puerto rican coffee', searchIndex: 'HomeAndKitchen' },
    { q: 'salsa dance shoes', searchIndex: 'Apparel' },
    { q: 'bomba drum percussion', searchIndex: 'MusicalInstruments' },
  ],
  CU: [
    { q: 'cuban cigar humidor', searchIndex: 'HomeAndKitchen' },
    { q: 'salsa dance shoes', searchIndex: 'Apparel' },
    { q: 'buena vista social club vinyl', searchIndex: 'Music' },
    { q: 'cuban coffee espresso', searchIndex: 'HomeAndKitchen' },
    { q: 'bongo drums afro cuban', searchIndex: 'MusicalInstruments' },
  ],
};

// ── GENRE PACKS ─────────────────────────────────────────────────────────────
// Lowercased genre lookups. Multi-word genres should be normalized to spaces.
export const GENRE_PACKS: Record<string, KeywordEntry[]> = {
  reggaeton: [
    { q: 'streetwear hoodie oversized', searchIndex: 'Apparel' },
    { q: 'gold cuban link chain', searchIndex: 'Jewelry' },
    { q: 'tracksuit set men', searchIndex: 'Apparel' },
    { q: 'bluetooth boom speaker', searchIndex: 'Electronics' },
    { q: 'reggaeton production book', searchIndex: 'Books' },
    { q: 'urban graffiti art print', searchIndex: 'HomeAndKitchen' },
  ],
  'indie pop': [
    { q: 'instant polaroid camera', searchIndex: 'Electronics' },
    { q: 'vintage cardigan sweater', searchIndex: 'Apparel' },
    { q: 'art zine magazine', searchIndex: 'Books' },
    { q: 'film roll 35mm', searchIndex: 'Electronics' },
    { q: 'songwriter journal', searchIndex: 'OfficeProducts' },
    { q: 'indie vinyl record', searchIndex: 'Music' },
  ],
  pop: [
    { q: 'led ring light selfie', searchIndex: 'Electronics' },
    { q: 'sequin party dress', searchIndex: 'Apparel' },
    { q: 'glitter makeup palette', searchIndex: 'Beauty' },
    { q: 'pop music biography', searchIndex: 'Books' },
    { q: 'wireless earbuds', searchIndex: 'Electronics' },
  ],
  rock: [
    { q: 'electric guitar starter', searchIndex: 'MusicalInstruments' },
    { q: 'leather jacket biker', searchIndex: 'Apparel' },
    { q: 'vintage band tee', searchIndex: 'Apparel' },
    { q: 'rock biography book', searchIndex: 'Books' },
    { q: 'guitar effects pedal', searchIndex: 'MusicalInstruments' },
  ],
  metal: [
    { q: 'leather studded belt', searchIndex: 'Apparel' },
    { q: 'metal band poster vintage', searchIndex: 'HomeAndKitchen' },
    { q: 'distortion pedal guitar', searchIndex: 'MusicalInstruments' },
    { q: 'concert tee black metal', searchIndex: 'Apparel' },
    { q: 'metal history book', searchIndex: 'Books' },
  ],
  'hip hop': [
    { q: 'midi keyboard producer', searchIndex: 'MusicalInstruments' },
    { q: 'snapback cap streetwear', searchIndex: 'Apparel' },
    { q: 'beats studio headphones', searchIndex: 'Electronics' },
    { q: 'hip hop biography', searchIndex: 'Books' },
    { q: 'oversized graphic tee', searchIndex: 'Apparel' },
    { q: 'gold chain pendant', searchIndex: 'Jewelry' },
  ],
  'r&b': [
    { q: 'silk pillowcase satin', searchIndex: 'HomeAndKitchen' },
    { q: 'incense burner brass', searchIndex: 'HomeAndKitchen' },
    { q: 'mood lighting led strip', searchIndex: 'HomeAndKitchen' },
    { q: 'velvet jacket women', searchIndex: 'Apparel' },
    { q: 'r&b vinyl record', searchIndex: 'Music' },
    { q: 'aromatherapy diffuser', searchIndex: 'HomeAndKitchen' },
  ],
  electronic: [
    { q: 'midi controller producer', searchIndex: 'MusicalInstruments' },
    { q: 'dj headphones professional', searchIndex: 'Electronics' },
    { q: 'led light strip rgb', searchIndex: 'HomeAndKitchen' },
    { q: 'modular synth book', searchIndex: 'Books' },
    { q: 'audio interface usb', searchIndex: 'MusicalInstruments' },
  ],
  edm: [
    { q: 'dj controller pioneer', searchIndex: 'MusicalInstruments' },
    { q: 'rave outfit holographic', searchIndex: 'Apparel' },
    { q: 'led party lights', searchIndex: 'HomeAndKitchen' },
    { q: 'fanny pack festival', searchIndex: 'Apparel' },
  ],
  jazz: [
    { q: 'jazz vinyl record miles davis', searchIndex: 'Music' },
    { q: 'saxophone reeds', searchIndex: 'MusicalInstruments' },
    { q: 'jazz history book', searchIndex: 'Books' },
    { q: 'whiskey glass crystal', searchIndex: 'HomeAndKitchen' },
    { q: 'fedora hat wool', searchIndex: 'Apparel' },
  ],
  classical: [
    { q: 'classical music vinyl', searchIndex: 'Music' },
    { q: 'metronome digital', searchIndex: 'MusicalInstruments' },
    { q: 'sheet music stand', searchIndex: 'MusicalInstruments' },
    { q: 'composer biography', searchIndex: 'Books' },
    { q: 'noise cancelling headphones', searchIndex: 'Electronics' },
  ],
  country: [
    { q: 'cowboy boots leather', searchIndex: 'Apparel' },
    { q: 'acoustic guitar dreadnought', searchIndex: 'MusicalInstruments' },
    { q: 'cowboy hat felt', searchIndex: 'Apparel' },
    { q: 'flannel shirt mens', searchIndex: 'Apparel' },
    { q: 'country music biography', searchIndex: 'Books' },
  ],
  folk: [
    { q: 'acoustic guitar parlor', searchIndex: 'MusicalInstruments' },
    { q: 'songwriter notebook leather', searchIndex: 'OfficeProducts' },
    { q: 'banjo 5 string', searchIndex: 'MusicalInstruments' },
    { q: 'wool fisherman sweater', searchIndex: 'Apparel' },
    { q: 'harmonica blues', searchIndex: 'MusicalInstruments' },
  ],
  reggae: [
    { q: 'reggae vinyl record', searchIndex: 'Music' },
    { q: 'rasta knit hat', searchIndex: 'Apparel' },
    { q: 'bongo drums', searchIndex: 'MusicalInstruments' },
    { q: 'bob marley biography', searchIndex: 'Books' },
    { q: 'incense set sandalwood', searchIndex: 'HomeAndKitchen' },
  ],
  punk: [
    { q: 'studded leather jacket', searchIndex: 'Apparel' },
    { q: 'doc martens combat boots', searchIndex: 'Apparel' },
    { q: 'punk rock zine', searchIndex: 'Books' },
    { q: 'electric bass guitar', searchIndex: 'MusicalInstruments' },
    { q: 'safety pin punk accessories', searchIndex: 'Apparel' },
  ],
  trap: [
    { q: 'midi keyboard 49 key', searchIndex: 'MusicalInstruments' },
    { q: 'studio monitor speakers', searchIndex: 'Electronics' },
    { q: 'oversized hoodie streetwear', searchIndex: 'Apparel' },
    { q: 'beat making book', searchIndex: 'Books' },
    { q: 'gold chain miami cuban', searchIndex: 'Jewelry' },
  ],
  latin: [
    { q: 'salsa shoes dance women', searchIndex: 'Apparel' },
    { q: 'latin percussion conga', searchIndex: 'MusicalInstruments' },
    { q: 'latin coffee espresso', searchIndex: 'HomeAndKitchen' },
    { q: 'spanish poetry book', searchIndex: 'Books' },
    { q: 'flamenco guitar nylon', searchIndex: 'MusicalInstruments' },
  ],
  afrobeats: [
    { q: 'african djembe drum', searchIndex: 'MusicalInstruments' },
    { q: 'ankara print fabric', searchIndex: 'ArtsAndCrafts' },
    { q: 'afrobeats vinyl', searchIndex: 'Music' },
    { q: 'fela kuti biography', searchIndex: 'Books' },
    { q: 'kente print scarf', searchIndex: 'Apparel' },
  ],
  ambient: [
    { q: 'aromatherapy diffuser', searchIndex: 'HomeAndKitchen' },
    { q: 'tibetan singing bowl', searchIndex: 'MusicalInstruments' },
    { q: 'meditation cushion', searchIndex: 'HomeAndKitchen' },
    { q: 'modular synth book', searchIndex: 'Books' },
    { q: 'led mood lamp', searchIndex: 'HomeAndKitchen' },
  ],
  blues: [
    { q: 'blues harmonica set', searchIndex: 'MusicalInstruments' },
    { q: 'slide guitar electric', searchIndex: 'MusicalInstruments' },
    { q: 'whiskey glass tumbler', searchIndex: 'HomeAndKitchen' },
    { q: 'blues vinyl record', searchIndex: 'Music' },
    { q: 'fedora hat wool', searchIndex: 'Apparel' },
  ],
  gospel: [
    { q: 'church robe choir', searchIndex: 'Apparel' },
    { q: 'gospel vinyl record', searchIndex: 'Music' },
    { q: 'piano hymnal book', searchIndex: 'Books' },
    { q: 'tambourine percussion', searchIndex: 'MusicalInstruments' },
  ],
  alternative: [
    { q: 'thrift cardigan oversized', searchIndex: 'Apparel' },
    { q: 'film camera 35mm', searchIndex: 'Electronics' },
    { q: 'art house book photography', searchIndex: 'Books' },
    { q: 'indie vinyl record', searchIndex: 'Music' },
  ],
  funk: [
    { q: 'funk vinyl record', searchIndex: 'Music' },
    { q: 'electric bass jazz', searchIndex: 'MusicalInstruments' },
    { q: 'platform shoes 70s', searchIndex: 'Apparel' },
    { q: 'disco ball decor', searchIndex: 'HomeAndKitchen' },
  ],
  soul: [
    { q: 'soul vinyl record motown', searchIndex: 'Music' },
    { q: 'silk scarf vintage', searchIndex: 'Apparel' },
    { q: 'velvet blazer', searchIndex: 'Apparel' },
    { q: 'aretha franklin biography', searchIndex: 'Books' },
  ],
};

// ── UNIVERSAL FALLBACK ──────────────────────────────────────────────────────
// Used when neither country nor genre match. Music-themed, broad appeal.
export const UNIVERSAL_FALLBACK: KeywordEntry[] = [
  { q: 'wireless headphones over ear', searchIndex: 'Electronics' },
  { q: 'vinyl record player turntable', searchIndex: 'Electronics' },
  { q: 'songwriter notebook leather', searchIndex: 'OfficeProducts' },
  { q: 'concert tee vintage', searchIndex: 'Apparel' },
  { q: 'guitar picks variety pack', searchIndex: 'MusicalInstruments' },
  { q: 'music biography bestseller', searchIndex: 'Books' },
  { q: 'bluetooth speaker portable', searchIndex: 'Electronics' },
  { q: 'studio condenser microphone', searchIndex: 'MusicalInstruments' },
];

/**
 * Lookup helpers. Always lowercased + trimmed.
 */
export function getCountryPack(countryCode: string | null | undefined): KeywordEntry[] {
  if (!countryCode) return [];
  return CULTURAL_PACKS[countryCode.toUpperCase().trim()] ?? [];
}

export function getGenrePack(genre: string | null | undefined): KeywordEntry[] {
  if (!genre) return [];
  const key = genre.toLowerCase().trim();
  return GENRE_PACKS[key] ?? [];
}
