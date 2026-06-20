/**
 * ============================================================
 * BOOSTIFY HIT MACHINE - AI LYRICS GENERATOR
 * ============================================================
 * Sistema de generación de letras de clase mundial usando OpenAI
 * Basado en la ESENCIA del género musical, no en la biografía
 * 
 * Inspirado en los mejores compositores:
 * - Max Martin (Pop hits)
 * - Pharrell Williams (Hip-hop/R&B)
 * - Dr. Dre (Rap)
 * - Martin Garrix (EDM)
 * - Taylor Swift (Country/Pop)
 */

import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================
// ESENCIA DE CADA GÉNERO - Temas universales que crean hits
// ============================================================
interface GenreEssence {
  coreThemes: string[];
  emotionalPalette: string[];
  lyricalStyle: string;
  hitFormula: string;
  iconicReferences: string[];
  universalHooks: string[];
  avoidThemes: string[];
}

const GENRE_ESSENCE: Record<string, GenreEssence> = {
  'pop': {
    coreThemes: [
      'falling in love unexpectedly',
      'dancing through the night',
      'breaking free from expectations',
      'summer romance that changed everything',
      'self-empowerment and confidence',
      'the one that got away',
      'living in the moment',
      'lights, city, and dreams'
    ],
    emotionalPalette: ['euphoric', 'hopeful', 'bittersweet', 'empowered', 'nostalgic', 'carefree'],
    lyricalStyle: 'Conversational, relatable, with universal emotions. Simple but profound. Easy to sing along. Catchy phrases that stick.',
    hitFormula: 'Strong hook in first 10 seconds. Pre-chorus build. Explosive chorus. Bridge that adds new emotion. Final chorus with ad-libs.',
    iconicReferences: ['The Weeknd', 'Dua Lipa', 'Bruno Mars', 'Taylor Swift', 'Ed Sheeran', 'Ariana Grande'],
    universalHooks: ['Tonight', 'Forever', 'One more time', 'Can\'t stop', 'Never let go', 'All I need'],
    avoidThemes: ['death', 'politics', 'religion', 'violence', 'depression']
  },
  
  'hip-hop': {
    coreThemes: [
      'rising from nothing to everything',
      'real recognize real',
      'loyalty and brotherhood',
      'success and its responsibilities',
      'street wisdom and life lessons',
      'flexing achievements earned through grind',
      'protecting what\'s yours',
      'legacy and impact'
    ],
    emotionalPalette: ['confident', 'triumphant', 'reflective', 'hungry', 'authentic', 'unstoppable'],
    lyricalStyle: 'Clever wordplay, double entendres, braggadocious but authentic. Flow switches, internal rhymes. Storytelling with punchlines.',
    hitFormula: 'Hard-hitting intro. Verse with complex rhyme schemes. Melodic hook. Second verse elevates energy. Feature optional. Outro flex.',
    iconicReferences: ['Drake', 'Kendrick Lamar', 'J. Cole', 'Travis Scott', 'Future', '21 Savage'],
    universalHooks: ['On top', 'Made it', 'Real ones', 'No cap', 'We up', 'Different'],
    avoidThemes: ['explicit violence details', 'drug glorification', 'misogyny']
  },
  
  'rap': {
    coreThemes: [
      'lyrical supremacy and skill',
      'overcoming adversity and struggle',
      'speaking truth to power',
      'the art of the hustle',
      'mental warfare and chess moves',
      'from the bottom to legendary status',
      'authenticity in a fake world',
      'verbal assassination of doubters'
    ],
    emotionalPalette: ['intense', 'calculated', 'aggressive', 'introspective', 'hungry', 'legendary'],
    lyricalStyle: 'Complex multi-syllabic rhymes. Metaphors and similes. Storytelling with vivid imagery. Technical prowess. Bars that demand replay.',
    hitFormula: 'Statement intro. Dense lyrical verses. Hook that hits hard. Bridge with personal revelation. Final verse goes even harder.',
    iconicReferences: ['Eminem', 'Nas', 'Jay-Z', 'Lil Wayne', 'Kendrick Lamar', 'J.I.D'],
    universalHooks: ['Legend', 'Untouchable', 'King/Queen', 'Bars', 'Goat status', 'History'],
    avoidThemes: ['promoting violence', 'hate speech', 'explicit criminal activity']
  },
  
  'electronic': {
    coreThemes: [
      'losing yourself in the music',
      'unity on the dancefloor',
      'euphoric transcendence',
      'chasing the sunrise after an epic night',
      'connection through sound waves',
      'escaping reality into pure feeling',
      'the drop that changes everything',
      'lights and lasers painting emotions'
    ],
    emotionalPalette: ['euphoric', 'transcendent', 'energetic', 'hypnotic', 'liberating', 'connected'],
    lyricalStyle: 'Ethereal and atmospheric. Simple but impactful. Chant-like hooks. Builds tension. Release through the drop. Mantras and affirmations.',
    hitFormula: 'Atmospheric intro. Vocal hook builds. Pre-drop tension. Massive drop. Breakdown with emotional lyrics. Final drop bigger than first.',
    iconicReferences: ['Calvin Harris', 'Martin Garrix', 'Avicii', 'David Guetta', 'Zedd', 'Marshmello'],
    universalHooks: ['Feel it', 'Higher', 'Together', 'Let go', 'Tonight we', 'Forever'],
    avoidThemes: ['complex narratives', 'too many words', 'negative emotions']
  },
  
  'rock': {
    coreThemes: [
      'rebellion against the system',
      'raw emotional pain transformed into power',
      'freedom and the open road',
      'fighting for what you believe in',
      'the fire that burns within',
      'rising from the ashes',
      'us against the world',
      'living life on your own terms'
    ],
    emotionalPalette: ['defiant', 'passionate', 'raw', 'empowered', 'anthemic', 'liberated'],
    lyricalStyle: 'Raw and emotional. Anthemic choruses meant to be screamed. Imagery of fire, battle, freedom. Personal but universal.',
    hitFormula: 'Guitar riff intro. Verse builds tension. Pre-chorus lifts. Chorus explodes. Bridge introspective. Final chorus with full power.',
    iconicReferences: ['Foo Fighters', 'Imagine Dragons', 'Twenty One Pilots', 'Paramore', 'Fall Out Boy', 'Green Day'],
    universalHooks: ['We are', 'Stand up', 'Never back down', 'Burn it', 'Together', 'Alive'],
    avoidThemes: ['explicit nihilism', 'gratuitous shock value']
  },
  
  'r&b': {
    coreThemes: [
      'passionate love and desire',
      'late night confessions',
      'the chemistry that can\'t be denied',
      'healing from heartbreak through intimacy',
      'slow dancing in the moonlight',
      'soulmate connection',
      'sensual but classy romance',
      'vulnerability and trust'
    ],
    emotionalPalette: ['sensual', 'soulful', 'vulnerable', 'passionate', 'smooth', 'intimate'],
    lyricalStyle: 'Smooth and flowing. Romantic imagery. Metaphors for intimacy. Emotional vulnerability. Runs and ad-libs in delivery.',
    hitFormula: 'Smooth intro with vibe setting. Verse paints the scene. Pre-chorus builds desire. Chorus emotional payoff. Bridge reveals deeper feeling.',
    iconicReferences: ['The Weeknd', 'SZA', 'Frank Ocean', 'Usher', 'Chris Brown', 'Beyoncé'],
    universalHooks: ['All night', 'Your body', 'Close to me', 'Feel you', 'Paradise', 'Only you'],
    avoidThemes: ['explicit vulgarity', 'objectification', 'toxic relationships']
  },
  
  'reggaeton': {
    coreThemes: [
      'fiesta que no para',
      'atracción irresistible en la pista',
      'verano eterno y vibras tropicales',
      'perreo intenso hasta el amanecer',
      'conexión entre miradas',
      'noches de rumba y libertad',
      'el flow que mueve al mundo',
      'calor latino y pasión'
    ],
    emotionalPalette: ['fiestero', 'sensual', 'enérgico', 'caliente', 'libre', 'intenso'],
    lyricalStyle: 'Mezcla español/inglés. Frases pegajosas. Onomatopeyas. Referencias a bailar. Coros repetitivos y adictivos.',
    hitFormula: 'Dembow intro. Verso con flow. Pre-coro build. Coro explosivo. Segundo verso sube energía. Outro con ad-libs.',
    iconicReferences: ['Bad Bunny', 'J Balvin', 'Daddy Yankee', 'Karol G', 'Ozuna', 'Rauw Alejandro'],
    universalHooks: ['Dale', 'Baila', 'Perreo', 'Toda la noche', 'Mami', 'Fuego'],
    avoidThemes: ['misoginia explícita', 'violencia']
  },
  
  'latin': {
    coreThemes: [
      'amor apasionado bajo las estrellas',
      'ritmos que mueven el alma',
      'noches de salsa y bachata',
      'romance tropical',
      'la vida es una fiesta',
      'corazón latino orgulloso',
      'bailar como si no hubiera mañana',
      'amor que cruza fronteras'
    ],
    emotionalPalette: ['apasionado', 'alegre', 'romántico', 'nostálgico', 'festivo', 'sensual'],
    lyricalStyle: 'Poético y romántico. Metáforas de naturaleza. Ritmo en las palabras. Coros memorables. Mezcla de emociones.',
    hitFormula: 'Intro con ritmo característico. Verso cuenta historia. Coro memorable. Puente emocional. Outro con improvisación.',
    iconicReferences: ['Shakira', 'Enrique Iglesias', 'Marc Anthony', 'Romeo Santos', 'Maluma', 'Luis Fonsi'],
    universalHooks: ['Corazón', 'Bailamos', 'Mi amor', 'Esta noche', 'Contigo', 'Fuego'],
    avoidThemes: ['letras vacías', 'clichés gastados']
  },
  
  'indie': {
    coreThemes: [
      'quiet moments of profound beauty',
      'bittersweet memories of youth',
      'finding meaning in the mundane',
      'love in unexpected places',
      'the poetry of everyday life',
      'nostalgic longing for simpler times',
      'self-discovery through solitude',
      'the beauty in imperfection'
    ],
    emotionalPalette: ['melancholic', 'hopeful', 'introspective', 'dreamy', 'authentic', 'vulnerable'],
    lyricalStyle: 'Poetic and literary. Imagery over statement. Subtle emotions. Metaphors and symbolism. Conversational but deep.',
    hitFormula: 'Delicate intro. Verse paints imagery. Chorus quietly powerful. Bridge reveals vulnerability. Ending leaves space for reflection.',
    iconicReferences: ['Bon Iver', 'Phoebe Bridgers', 'Arctic Monkeys', 'Tame Impala', 'Hozier', 'Lana Del Rey'],
    universalHooks: ['Golden hour', 'Remember when', 'Quietly', 'Fade away', 'In between', 'Stay'],
    avoidThemes: ['forced positivity', 'clichés', 'overproduced feelings']
  },
  
  'country': {
    coreThemes: [
      'small town dreams and big city lights',
      'friday night with friends',
      'love on a back road',
      'family, faith, and home',
      'the simple life and its beauty',
      'trucks, bonfires, and starlit nights',
      'heartbreak and moving on',
      'hard work and honest living'
    ],
    emotionalPalette: ['nostalgic', 'proud', 'romantic', 'genuine', 'celebratory', 'reflective'],
    lyricalStyle: 'Storytelling with vivid details. Relatable scenarios. Americana imagery. Honest and direct. Singalong choruses.',
    hitFormula: 'Acoustic intro. Verse tells a story. Pre-chorus emotional turn. Chorus anthem-like. Bridge personal moment. Big finish.',
    iconicReferences: ['Luke Combs', 'Morgan Wallen', 'Carrie Underwood', 'Chris Stapleton', 'Kacey Musgraves', 'Kane Brown'],
    universalHooks: ['This town', 'Back home', 'Friday nights', 'Cold beer', 'True love', 'Country road'],
    avoidThemes: ['stereotypes', 'excessive drinking glorification']
  },
  
  'jazz': {
    coreThemes: [
      'smoky late-night romance',
      'city lights and champagne dreams',
      'sophisticated love affairs',
      'timeless elegance',
      'memories of better days',
      'the art of falling in love',
      'dancing cheek to cheek',
      'rainy day reflections'
    ],
    emotionalPalette: ['sophisticated', 'romantic', 'nostalgic', 'smooth', 'intimate', 'timeless'],
    lyricalStyle: 'Sophisticated vocabulary. Timeless themes. Romantic imagery. Clever wordplay. Classic song structure.',
    hitFormula: 'Elegant intro. Verse sets mood. Chorus memorable melody. Bridge jazz scat optional. Return to chorus with variation.',
    iconicReferences: ['Michael Bublé', 'Norah Jones', 'Diana Krall', 'Tony Bennett', 'Gregory Porter', 'Esperanza Spalding'],
    universalHooks: ['In your arms', 'The night is young', 'Dance with me', 'Moonlight', 'Forever yours', 'Blue'],
    avoidThemes: ['modern slang', 'casual language', 'explicit content']
  },

  'reggae': {
    coreThemes: [
      'one love, unity of all people',
      'freedom from oppression and injustice',
      'island life and tropical paradise',
      'spiritual awakening and meditation',
      'roots, culture, and identity',
      'peace and harmony with nature',
      'dancing in the sun with no worries',
      'love that flows like the ocean tide'
    ],
    emotionalPalette: ['peaceful', 'joyful', 'spiritual', 'rebellious', 'meditative', 'free'],
    lyricalStyle: 'Patois-influenced phrasing. Spiritual and conscious themes. Repetitive mantras. Call-and-response. Easy-flowing rhythm in words. Positive vibrations.',
    hitFormula: 'Laid-back riddim intro. Verse paints island life or conscious theme. Chorus is a singalong mantra. Toasting section optional. Skank rhythm throughout. Outro fades with chanting.',
    iconicReferences: ['Bob Marley', 'Damian Marley', 'Sean Paul', 'Shaggy', 'Chronixx', 'Koffee', 'Protoje'],
    universalHooks: ['One love', 'Jah bless', 'No worry', 'Feel the vibe', 'Irie', 'Sunshine'],
    avoidThemes: ['violence', 'materialism', 'negativity', 'hatred']
  },

  'soul': {
    coreThemes: [
      'deep heartfelt love that shakes your core',
      'pain transformed into beautiful music',
      'the power of a human connection',
      'rising above struggle with grace',
      'gospel-rooted spiritual journey',
      'standing strong through adversity',
      'a love letter to someone special',
      'finding your voice and speaking truth'
    ],
    emotionalPalette: ['soulful', 'passionate', 'raw', 'uplifting', 'vulnerable', 'powerful'],
    lyricalStyle: 'Deeply emotional and sincere. Gospel-influenced delivery. Powerful vocal runs and ad-libs. Storytelling with heart. Every word carries weight.',
    hitFormula: 'Emotional vocal intro. Verse builds story. Pre-chorus rises. Chorus explodes with vocal power. Bridge is raw and stripped back. Final chorus with full ad-libs.',
    iconicReferences: ['Aretha Franklin', 'Sam Cooke', 'Otis Redding', 'Adele', 'Leon Bridges', 'H.E.R.', 'Anderson .Paak'],
    universalHooks: ['My soul', 'Hold on', 'I believe', 'Stand by me', 'Feel it', 'Rise up'],
    avoidThemes: ['superficiality', 'materialism', 'explicit content']
  },

  'blues': {
    coreThemes: [
      'woke up this morning and my world had changed',
      'lost love and whiskey-soaked memories',
      'hard times on the road',
      'the devil at the crossroads',
      'working man\'s struggle and redemption',
      'lonely nights in a small town',
      'heartbreak that cuts deep as a knife',
      'finding peace at the bottom of the barrel'
    ],
    emotionalPalette: ['melancholic', 'raw', 'gritty', 'soulful', 'bittersweet', 'defiant'],
    lyricalStyle: 'AAB verse structure (repeat first line, resolve with third). Storytelling through pain. Guitar-driven imagery. Raw honesty. Simple but devastatingly effective.',
    hitFormula: 'Guitar riff intro. Verse in classic AAB form. Chorus is emotional release. Guitar solo break. Bridge is spoken-word or whispered. Final chorus with raw power.',
    iconicReferences: ['B.B. King', 'Muddy Waters', 'Gary Clark Jr.', 'Joe Bonamassa', 'Christone Kingfish Ingram', 'Susan Tedeschi'],
    universalHooks: ['Got the blues', 'One more night', 'Down the road', 'My baby', 'Hard times', 'Crossroads'],
    avoidThemes: ['modern slang', 'pop clichés', 'excessive positivity']
  },

  'gospel': {
    coreThemes: [
      'grace that saved my life',
      'praising through the storm',
      'faith that moves mountains',
      'testimony of transformation',
      'joy unspeakable and full of glory',
      'walking in the light of love',
      'community lifting each other up',
      'hope when all seems lost'
    ],
    emotionalPalette: ['joyful', 'uplifting', 'powerful', 'grateful', 'transcendent', 'celebratory'],
    lyricalStyle: 'Praise-oriented and affirming. Call-and-response. Repetition for emphasis. Building intensity. Congregational participation feel. Testifying and declaring.',
    hitFormula: 'Worship intro. Verse tells testimony. Pre-chorus builds faith. Chorus is a declaration of praise. Vamp section with ad-libs. Bridge is intimate prayer. Final chorus with full choir energy.',
    iconicReferences: ['Kirk Franklin', 'Tasha Cobbs Leonard', 'Maverick City Music', 'Elevation Worship', 'CeCe Winans', 'Fred Hammond'],
    universalHooks: ['Hallelujah', 'I believe', 'Glory', 'Praise', 'Grateful', 'Victory'],
    avoidThemes: ['negativity', 'secular romance', 'violence', 'profanity']
  },

  'afrobeat': {
    coreThemes: [
      'celebration of African heritage and pride',
      'dancing till the sun comes up',
      'love that moves to the rhythm',
      'joy of community and togetherness',
      'the motherland calling you home',
      'vibrant city nightlife and energy',
      'unstoppable confidence and swagger',
      'freedom through music and dance'
    ],
    emotionalPalette: ['joyful', 'energetic', 'confident', 'celebratory', 'sensual', 'proud'],
    lyricalStyle: 'Mix of English and pidgin/Yoruba phrases. Repetitive and chant-like hooks. Dance-focused lyrics. Celebratory and confident. Storytelling through groove.',
    hitFormula: 'Percussion-driven intro. Verse flows over afrobeats riddim. Pre-chorus lifts energy. Chorus is a dance chant. Log drum break. Bridge drops to half-time. Final chorus with full energy.',
    iconicReferences: ['Burna Boy', 'Wizkid', 'Davido', 'Tems', 'Rema', 'Ayra Starr', 'CKay'],
    universalHooks: ['Come dance', 'My people', 'Shaku shaku', 'Na you', 'Feeling good', 'No wahala'],
    avoidThemes: ['stereotypes', 'poverty clichés', 'negativity']
  },

  'trap': {
    coreThemes: [
      'came from nothing, now I\'m on top',
      'dripping in success and ice',
      'late night hustle and grind',
      'trust nobody but your circle',
      'counting up racks and blessings',
      'dark nights turned to bright lights',
      'pull up in the foreign whip',
      'making moves in silence'
    ],
    emotionalPalette: ['aggressive', 'confident', 'dark', 'flexing', 'hungry', 'dominant'],
    lyricalStyle: 'Hard-hitting ad-libs (yeah, what, skrt). Triplet flow. Dark braggadocio. Short punchy phrases. Repetitive hooks. Atlanta-style delivery.',
    hitFormula: 'Dark 808 intro with tag. Verse in triplet flow. Hook is simple and repetitive. Second verse harder. Bridge slows down. Outro with ad-libs.',
    iconicReferences: ['Future', 'Young Thug', 'Travis Scott', 'Migos', 'Gunna', 'Lil Baby'],
    universalHooks: ['Drip', 'No cap', 'Let\'s go', 'Ice', 'We up', 'Slatt'],
    avoidThemes: ['explicit drug promotion', 'excessive violence']
  },

  'k-pop': {
    coreThemes: [
      'falling for you like a shooting star',
      'the thrill of new love',
      'confidence and self-love anthem',
      'dance the night away together',
      'heartbreak and moving on stronger',
      'dreaming big and chasing destiny',
      'magnetic attraction you can\'t resist',
      'youth and living without limits'
    ],
    emotionalPalette: ['energetic', 'romantic', 'empowered', 'playful', 'dramatic', 'dreamy'],
    lyricalStyle: 'Mix of English and Korean phrases. Catchy nonsense syllables. Point choreography lyrics. Rapid-fire rap sections. Sweet vocal melodies. Fan-service catchphrases.',
    hitFormula: 'Attention-grabbing intro. Verse with rap section. Pre-chorus melodic build. Chorus with dance break hook. Post-chorus chant. Bridge key change. Final chorus with high note.',
    iconicReferences: ['BTS', 'BLACKPINK', 'Stray Kids', 'NewJeans', 'aespa', 'SEVENTEEN'],
    universalHooks: ['La la la', 'Na na na', 'Hey hey', 'Oh my', 'Du du du', 'Boom boom'],
    avoidThemes: ['explicit content', 'dark themes', 'controversy']
  },

  'dancehall': {
    coreThemes: [
      'wine and grind on the dancefloor',
      'hot gyal energy and confidence',
      'party vibes till morning light',
      'Caribbean summer heat',
      'bad man ting and street credibility',
      'love inna di moonlight',
      'sound system culture and selector vibes',
      'island pride and culture'
    ],
    emotionalPalette: ['energetic', 'sensual', 'confident', 'party', 'bold', 'celebratory'],
    lyricalStyle: 'Jamaican patois heavy. Rhythmic and percussive delivery. Chant-style hooks. Call-and-response. Boastful and confident. Dance instructions.',
    hitFormula: 'Air horn intro. Verse with rhythmic toasting. Chorus is a singalong chant. Dub break. Second verse raises energy. Dancehall siren outro.',
    iconicReferences: ['Vybz Kartel', 'Popcaan', 'Shenseea', 'Spice', 'Skillibeng', 'Alkaline'],
    universalHooks: ['Gyal dem', 'Bruk out', 'Wine up', 'Pull up', 'Baddest', 'Big tune'],
    avoidThemes: ['explicit violence', 'misogyny']
  },

  'lo-fi': {
    coreThemes: [
      'rainy afternoon studying alone',
      'nostalgia for simpler times',
      'quiet love in small moments',
      'daydreaming by the window',
      'late night thoughts and coffee',
      'missing someone far away',
      'peaceful solitude in the city',
      'memories replaying like old tapes'
    ],
    emotionalPalette: ['nostalgic', 'calm', 'melancholic', 'dreamy', 'peaceful', 'introspective'],
    lyricalStyle: 'Minimal and poetic. Whispered or soft delivery. Haiku-like brevity. Imagery over narrative. Comfortable silence between lines.',
    hitFormula: 'Vinyl crackle intro. Short soft verse. Gentle chorus melody. Instrumental break with jazz chords. Outro fades into ambient sound.',
    iconicReferences: ['Nujabes', 'J Dilla', 'Joji', 'Clairo', 'boy pablo', 'Keshi'],
    universalHooks: ['Stay', 'Drifting', 'Soft', 'Memories', 'Quiet', 'Slowly'],
    avoidThemes: ['high energy', 'aggression', 'complexity', 'loudness']
  },

  'house': {
    coreThemes: [
      'the dancefloor is our sanctuary',
      'four on the floor and pure freedom',
      'love found under disco lights',
      'the DJ saved my life tonight',
      'unity through rhythm and bass',
      'release yourself to the groove',
      'underground vibes and warehouse magic',
      'the beat goes on forever'
    ],
    emotionalPalette: ['euphoric', 'free', 'connected', 'groovy', 'uplifting', 'hypnotic'],
    lyricalStyle: 'Minimal but impactful. Diva vocal hooks. Repetitive mantras. Spoken word interludes. Dance affirmations. Sample-based.',
    hitFormula: 'Four-on-the-floor kick intro. Vocal hook layers in. Filter sweep build. Bassline drop. Vocal chop breakdown. Full groove return. Extended outro.',
    iconicReferences: ['Disclosure', 'Fisher', 'Chris Lake', 'Frankie Knuckles', 'MK', 'Peggy Gou'],
    universalHooks: ['Set me free', 'Feel the beat', 'All night long', 'Move your body', 'House music', 'Together'],
    avoidThemes: ['complexity', 'storytelling', 'negativity']
  },

  'techno': {
    coreThemes: [
      'machines and humans becoming one',
      'the pulse of the underground',
      'losing yourself in the darkness',
      'industrial revolution of sound',
      'hypnotic journey through the night',
      'the future is now',
      'rhythm as meditation',
      'warehouse rituals at 4am'
    ],
    emotionalPalette: ['hypnotic', 'dark', 'intense', 'transcendent', 'mechanical', 'relentless'],
    lyricalStyle: 'Minimal to none. Spoken word samples. Processed vocal fragments. Mantra-like repetition. Machine-like precision. Abstract concepts.',
    hitFormula: 'Minimal kick intro. Layers build slowly. Synth stab hook. Breakdown strips to bare elements. Rebuild with full force. Extended hypnotic groove.',
    iconicReferences: ['Charlotte de Witte', 'Amelie Lens', 'Adam Beyer', 'Carl Cox', 'Nina Kraviz', 'Richie Hawtin'],
    universalHooks: ['Repeat', 'System', 'Move', 'Pulse', 'Machine', 'Underground'],
    avoidThemes: ['pop melodies', 'romance', 'lyrics-heavy content']
  },

  'ambient': {
    coreThemes: [
      'floating through infinite space',
      'the sound of stillness',
      'nature breathing slowly',
      'inner peace and meditation',
      'the beauty of negative space',
      'time dissolving into eternity',
      'sonic landscapes of the mind',
      'healing through sound'
    ],
    emotionalPalette: ['serene', 'expansive', 'meditative', 'ethereal', 'healing', 'transcendent'],
    lyricalStyle: 'Almost no lyrics. Occasional whispered phrases. Vowel sounds as texture. Processed vocal pads. Breath as instrument. Silence is part of the composition.',
    hitFormula: 'Gentle fade in. Textural layers evolve slowly. No traditional structure. Subtle melodic motifs drift in and out. Long sustained notes. Fade to silence.',
    iconicReferences: ['Brian Eno', 'Sigur Rós', 'Tycho', 'Nils Frahm', 'Ólafur Arnalds', 'Boards of Canada'],
    universalHooks: ['Breathe', 'Float', 'Still', 'Dream', 'Light', 'Space'],
    avoidThemes: ['beats', 'energy', 'lyrics', 'structure']
  },

  'disco': {
    coreThemes: [
      'Saturday night fever on the dancefloor',
      'glamour, glitter, and good times',
      'love under the disco ball',
      'funky grooves that move your feet',
      'celebrating life with friends',
      'the queen/king of the night',
      'boogie wonderland vibes',
      'dancing until the sunrise'
    ],
    emotionalPalette: ['joyful', 'glamorous', 'funky', 'celebratory', 'flirtatious', 'confident'],
    lyricalStyle: 'Fun and carefree. Dance instructions. Celebratory and hedonistic. Funky wordplay. Call-and-response with the crowd.',
    hitFormula: 'Funky bass intro. Verse grooves. Pre-chorus builds. Chorus is a dance anthem. String section break. Bridge slows then explodes back. Outro with extended groove.',
    iconicReferences: ['Dua Lipa (Future Nostalgia)', 'Doja Cat', 'The Bee Gees', 'Donna Summer', 'Nile Rodgers', 'Jessie Ware'],
    universalHooks: ['Get down', 'Groove tonight', 'Disco baby', 'Dance dance', 'Funky', 'Boogie'],
    avoidThemes: ['sadness', 'complexity', 'heaviness']
  },

  'funk': {
    coreThemes: [
      'get up and get down on the one',
      'funky bass that moves your soul',
      'party people in the house tonight',
      'the groove that won\'t let go',
      'swagger and style on full display',
      'feel-good music for feel-good people',
      'making love to the rhythm',
      'the mothership connection'
    ],
    emotionalPalette: ['groovy', 'confident', 'playful', 'sensual', 'energetic', 'joyful'],
    lyricalStyle: 'Rhythmic and percussive vocals. Onomatopoeia and vocal effects. Call-and-response. Short punchy phrases. Groove-centric.',
    hitFormula: 'Slap bass intro. Verse rides the groove. Chorus is a chant. Horn section break. Bridge drops to drums and bass only. Full band return for finale.',
    iconicReferences: ['Bruno Mars (Silk Sonic)', 'Anderson .Paak', 'Vulfpeck', 'Parliament', 'James Brown', 'Prince'],
    universalHooks: ['Get funky', 'On the one', 'Groove', 'Get up', 'Oww', 'Shake it'],
    avoidThemes: ['sadness', 'complexity', 'slow tempos']
  },

  'metal': {
    coreThemes: [
      'waging war against inner demons',
      'rising from the darkness stronger',
      'defiance against the machine',
      'the beast unleashed within',
      'chaos and power collide',
      'marching toward oblivion',
      'screaming truth into the void',
      'brotherhood forged in fire'
    ],
    emotionalPalette: ['aggressive', 'powerful', 'dark', 'defiant', 'epic', 'relentless'],
    lyricalStyle: 'Intense imagery. Battle metaphors. Dark poetry. Screamed and clean vocal contrast. Epic storytelling. Power through volume.',
    hitFormula: 'Heavy riff intro. Verse builds intensity. Pre-chorus clean vocals. Chorus screamed with melody. Breakdown section. Guitar solo. Final chorus with double bass.',
    iconicReferences: ['Metallica', 'Bring Me The Horizon', 'Avenged Sevenfold', 'Slipknot', 'Architects', 'Gojira'],
    universalHooks: ['Rise', 'War', 'Fire', 'Unleash', 'Destroy', 'Forever'],
    avoidThemes: ['pop sensibilities', 'weakness', 'excessive positivity']
  },

  'punk': {
    coreThemes: [
      'f*** the system, think for yourself',
      'three chords and the truth',
      'youth rebellion and angst',
      'the DIY spirit lives on',
      'running wild with no future plans',
      'anti-establishment fury',
      'boredom destroying suburbia',
      'friends, shows, and cheap beer'
    ],
    emotionalPalette: ['angry', 'rebellious', 'raw', 'energetic', 'sarcastic', 'free'],
    lyricalStyle: 'Short, fast, and loud. Sarcastic and witty. Anti-authority. Raw and unpolished. Shout-along choruses. No pretension.',
    hitFormula: 'Fast riff intro (under 5 seconds). Short verse. Shouted chorus. Barely a bridge. Done in under 2 minutes. No unnecessary solos.',
    iconicReferences: ['Green Day', 'blink-182', 'The Offspring', 'Sum 41', 'Bad Religion', 'NOFX'],
    universalHooks: ['Hey!', 'Let\'s go!', 'Na na na', 'Oi!', 'F*** it', 'One more time'],
    avoidThemes: ['over-production', 'pretentiousness', 'slow tempos']
  }
};

// ============================================================
// PRODUCTION BLUEPRINTS - Como los mejores productores
// ============================================================
interface ProductionBlueprint {
  stylePrompt: string;
  productionNotes: string;
  referenceProducers: string;
  soundPalette: string[];
  mixingStyle: string;
}

const PRODUCTION_BLUEPRINTS: Record<string, ProductionBlueprint> = {
  'pop': {
    stylePrompt: 'Billboard Hot 100 Pop production. Max Martin precision. Crisp modern synths, punchy layered drums, pristine vocal production. Radio-ready anthem mix. Euphoric melodic hooks. Swedish pop perfection.',
    productionNotes: 'Layer synths for width. Sidechain compression on bass. Vocal doubles on chorus. Bright EQ on vocals. Punchy snare. 808 sub-bass.',
    referenceProducers: 'Max Martin, Shellback, Jack Antonoff, Ryan Tedder',
    soundPalette: ['analog synths', 'programmed drums', 'vocal chops', 'piano stabs', 'string swells'],
    mixingStyle: 'Loud, bright, wide stereo field, vocal-forward'
  },
  
  'hip-hop': {
    stylePrompt: 'Platinum Hip-Hop. Metro Boomin dark atmosphere. Deep rumbling 808 sub-bass, crisp trap hi-hats, atmospheric pads. Stadium-ready drums. Drake-era melodic trap vibes. Hard-hitting certified platinum sound.',
    productionNotes: 'Deep 808s with long decay. Fast hi-hat rolls. Dark ambient pads. Reverb on snare. Vocal processing with autotune tastefully.',
    referenceProducers: 'Metro Boomin, Murda Beatz, Wheezy, Tay Keith, London on da Track',
    soundPalette: ['808 bass', 'trap hi-hats', 'dark pads', 'vocal samples', 'brass stabs'],
    mixingStyle: 'Bass-heavy, punchy, spacious, hard-hitting'
  },
  
  'rap': {
    stylePrompt: 'Grammy-winning Rap production. Dr. Dre legacy quality. Punchy layered drums, cinematic strings, west coast bounce. Technical precision. Lyric-forward mix. Boom bap meets modern trap elements.',
    productionNotes: 'Sample-based drums with punch. Piano or string melody. Bass sits in the pocket. Leave room for vocals. Dynamic range preserved.',
    referenceProducers: 'Dr. Dre, No I.D., Hit-Boy, Mustard, DJ Premier',
    soundPalette: ['sampled drums', 'piano loops', 'orchestral hits', 'scratches', 'bass guitar'],
    mixingStyle: 'Vocal clarity priority, punchy drums, balanced low end'
  },
  
  'electronic': {
    stylePrompt: 'Festival EDM anthem. Swedish House Mafia epicness. Massive supersaw synth drops, euphoric builds, pulsing basslines. Main stage energy. Progressive house structure. Tomorrowland headline quality.',
    productionNotes: 'Build tension pre-drop. Layer supersaws. Sidechain everything. White noise risers. Impact drums on drop. Cut bass before drop.',
    referenceProducers: 'Martin Garrix, Avicii, Calvin Harris, Zedd, Swedish House Mafia',
    soundPalette: ['supersaws', 'plucks', 'white noise', 'impact drums', 'vocal chops'],
    mixingStyle: 'Wide, loud, maximum energy, festival-ready'
  },
  
  'rock': {
    stylePrompt: 'Arena Rock production. Rick Rubin raw power. Crushing distorted guitars, thunderous live drums, driving bass. Anthemic energy. Raw emotion captured. Stadium singalong worthy.',
    productionNotes: 'Live drums with room mics. Wall of guitars. Bass follows kick. Vocal grit allowed. Dynamic contrast. Power chord focus.',
    referenceProducers: 'Rick Rubin, Butch Vig, Dave Cobb, Jacquire King',
    soundPalette: ['distorted guitars', 'live drums', 'bass guitar', 'piano accents', 'strings for epic moments'],
    mixingStyle: 'Powerful, raw, dynamic, room for performance'
  },
  
  'r&b': {
    stylePrompt: 'Platinum R&B production. The Weeknd dark R&B aesthetic. Silky bass grooves, lush neo-soul chords, crisp snares, warm atmospheric pads. Sensual groove. Grammy-quality vocal production.',
    productionNotes: 'Warm bass with character. Rhodes or wurlitzer keys. Subtle hi-hats. Reverb on snare. Layered background vocals. Space in the mix.',
    referenceProducers: 'The Neptunes, Darkchild, Timbaland, Cardiak, Nineteen85',
    soundPalette: ['Rhodes piano', 'warm bass', 'programmed drums', 'pad synths', 'vocal harmonies'],
    mixingStyle: 'Warm, smooth, intimate, groove-focused'
  },
  
  'reggaeton': {
    stylePrompt: 'Platinum Reggaeton. Tainy production quality. Heavy dembow riddim, deep 808 bass, tropical percussion. Club banger energy. Latin Grammy quality. Perreo approved beat.',
    productionNotes: 'Classic dembow pattern. Deep 808 with punch. Reggaeton synth stabs. Percussion layers. Vocal effects tasteful. Energy maintained throughout.',
    referenceProducers: 'Tainy, Sky Rompiendo, Ovy on the Drums, Dimelo Flow',
    soundPalette: ['dembow drums', '808 bass', 'synth stabs', 'percussion', 'brass hits'],
    mixingStyle: 'Bass-heavy, punchy, club-ready, energetic'
  },
  
  'latin': {
    stylePrompt: 'Latin Pop production. Luis Fonsi Despacito quality. Tropical rhythms, acoustic guitar warmth, percussion groove. Crossover appeal. Romantic yet danceable. International hit potential.',
    productionNotes: 'Acoustic guitar foundation. Latin percussion layers. Bass groove essential. Brass accents. Vocal ad-libs in Spanish. Build to chorus.',
    referenceProducers: 'Andrés Torres, Mauricio Rengifo, Edgar Barrera, Luny Tunes',
    soundPalette: ['acoustic guitar', 'congas', 'bongos', 'bass', 'brass section'],
    mixingStyle: 'Warm, rhythmic, vocal-forward, danceable'
  },
  
  'indie': {
    stylePrompt: 'Critically acclaimed Indie production. Bon Iver atmospheric textures. Warm reverb spaces, vintage instruments, dreamy layers. Authentic emotional depth. Blog-darling quality. Pitchfork approved sound.',
    productionNotes: 'Room sound important. Tape saturation. Vintage synths. Subtle production touches. Leave imperfections. Emotional dynamics.',
    referenceProducers: 'Aaron Dessner, Justin Vernon, Brian Eno, Dan Auerbach',
    soundPalette: ['vintage synths', 'acoustic instruments', 'ambient textures', 'vocal layers', 'tape effects'],
    mixingStyle: 'Intimate, atmospheric, dynamic, organic'
  },
  
  'country': {
    stylePrompt: 'Nashville Country production. Premium crossover sound. Warm acoustic guitar, pedal steel sweetness, fiddle accents. Storytelling support. Stadium country ready. CMT award quality.',
    productionNotes: 'Acoustic guitar drives. Pedal steel for emotion. Live drums with brushes. Bass supports. Keep it real. Building arrangement.',
    referenceProducers: 'Dave Cobb, Joey Moi, Dann Huff, Jay Joyce',
    soundPalette: ['acoustic guitar', 'pedal steel', 'fiddle', 'piano', 'live drums'],
    mixingStyle: 'Warm, authentic, vocal-forward, emotional'
  },
  
  'jazz': {
    stylePrompt: 'Blue Note Jazz production. Sophisticated arrangement. Warm piano chords, walking upright bass, brushed drums, brass elegance. Timeless sound. Jazz club intimacy. Grammy jazz quality.',
    productionNotes: 'Room mics for live feel. Piano recorded grand. Bass with tone. Brushes on snare. Horns with space. Dynamic performance.',
    referenceProducers: 'Larry Klein, Al Schmitt, Tommy LiPuma, David Foster',
    soundPalette: ['grand piano', 'upright bass', 'brushed drums', 'trumpet', 'saxophone'],
    mixingStyle: 'Natural, warm, dynamic, live feel'
  },

  'reggae': {
    stylePrompt: 'Authentic Jamaican Reggae production. One Drop riddim. Skank guitar on the offbeat, deep dub bass, organ shuffle, horn stabs. Roots vibes. Bob Marley legacy warmth. Island groove.',
    productionNotes: 'Offbeat guitar skank is essential. Rim shot on 3. Deep bass with dub delays. Organ bubble. Horn section accents. Spring reverb on snare.',
    referenceProducers: 'Bob Marley, Sly & Robbie, King Tubby, Lee Scratch Perry, Damian Marley',
    soundPalette: ['skank guitar', 'dub bass', 'organ shuffle', 'bongo percussion', 'horn stabs', 'melodica'],
    mixingStyle: 'Warm, bass-heavy, spacious dub effects, laid-back groove'
  },

  'soul': {
    stylePrompt: 'Classic Motown Soul production with modern touch. Rich live horns, warm Rhodes piano, punchy drums with tambourine, deep bass groove. Emotional vocal-forward mix. Gospel-influenced power.',
    productionNotes: 'Rhodes or Wurlitzer foundation. Motown bass line grooves. Real horn section. Tambourine on 2 and 4. Background gospel choir. Dynamic vocal performance space.',
    referenceProducers: 'Leon Bridges, Anderson .Paak, Raphael Saadiq, Mark Ronson, D\'Angelo',
    soundPalette: ['Rhodes piano', 'horn section', 'live drums with tambourine', 'bass guitar', 'backing choir'],
    mixingStyle: 'Warm, vocal-forward, dynamic, organic groove'
  },

  'blues': {
    stylePrompt: 'Authentic Delta Blues to Chicago Blues production. Gritty electric guitar, walking bass, shuffling drums, harmonica wails. Raw emotion. Smoky juke joint feel. B.B. King quality.',
    productionNotes: 'Overdriven guitar tone. 12-bar blues structure. Shuffle drum pattern. Walking bass line. Harmonica fills between vocal lines. Room ambience important.',
    referenceProducers: 'B.B. King, Gary Clark Jr., Joe Bonamassa, Dan Auerbach, T Bone Burnett',
    soundPalette: ['electric guitar with overdrive', 'harmonica', 'walking bass', 'shuffle drums', 'piano fills'],
    mixingStyle: 'Raw, room sound, guitar-forward, dynamic, gritty'
  },

  'gospel': {
    stylePrompt: 'Contemporary Gospel production. Powerful choir, Hammond B3 organ, driving drums, electric piano. Kirk Franklin energy meets Maverick City worship. Spirit-filled celebration.',
    productionNotes: 'Hammond organ is essential. Full choir with harmonies. Drums build from brushes to full kit. Electric piano and acoustic piano layers. Space for vocal runs.',
    referenceProducers: 'Kirk Franklin, Israel Houghton, Jonathan McReynolds, Elevation Worship, Chandler Moore',
    soundPalette: ['Hammond B3 organ', 'gospel choir', 'acoustic piano', 'live drums', 'bass guitar', 'string pads'],
    mixingStyle: 'Powerful, vocal-forward, dynamic, spacious for worship moments'
  },

  'afrobeat': {
    stylePrompt: 'Modern Afrobeats production. Lagos Sound. Bouncy log drum patterns, warm guitar licks, shaker percussion, afro-pop synths. Wizkid and Burna Boy quality. Infectious dance groove.',
    productionNotes: 'Log drum is signature sound. Guitar melody is the hook. Shaker and percussion layers. Warm synth pads. 808 sub underneath. Light and bouncy overall feel.',
    referenceProducers: 'P2J, Sarz, Kel-P, London, Pheelz, Blaise Beatz',
    soundPalette: ['log drum', 'clean guitar licks', 'shaker', 'talking drum', 'synth pads', '808 bass'],
    mixingStyle: 'Warm, bouncy, rhythmic, vocal clarity, danceable'
  },

  'trap': {
    stylePrompt: 'Dark Atlanta Trap production. Massive distorted 808 bass, rapid fire hi-hats, dark atmospheric pads. Metro Boomin savage mode. Hard-hitting and menacing. Certified street anthem.',
    productionNotes: 'Distorted 808 with long sustain. Rolling hi-hats with variety. Dark minor key melodies. Sparse arrangement. Heavy use of reverb and delay on synths. Producer tag essential.',
    referenceProducers: 'Metro Boomin, Southside, TM88, Pierre Bourne, Wheezy',
    soundPalette: ['distorted 808', 'rolling hi-hats', 'dark pads', 'flute melodies', 'vocal chops', 'brass stabs'],
    mixingStyle: 'Bass-dominant, dark, spacious, hard-hitting, heavy compression'
  },

  'k-pop': {
    stylePrompt: 'K-Pop production. SM/YG/JYP quality. Genre-blending structure, crisp synth hooks, punchy dance pop drums, rap break section. Perfectly polished. Multiple sonic surprises. Global appeal.',
    productionNotes: 'Genre switches within the song. Perfect tuning. Layered vocal harmonies. Dance break section. Key change in final chorus. Rap verse with different beat feel.',
    referenceProducers: 'Teddy Park, Yoo Young-jin, SCORE, Pdogg, Ludwig Lindell',
    soundPalette: ['crisp synths', 'programmed drums', 'vocal layers', 'EDM drops', 'trap elements', 'retro synths'],
    mixingStyle: 'Crystal clear, loud, wide, genre-blending, high production value'
  },

  'dancehall': {
    stylePrompt: 'Jamaican Dancehall riddim production. Bouncy digital beat, heavy bass, syncopated drums, air horn effects. Sound system culture. Party energy. Kingston street vibes.',
    productionNotes: 'Digital dancehall riddim. Heavy bass drops. Syncopated snare patterns. Vocal samples and air horns. Simple melodic hooks. Energy stays high throughout.',
    referenceProducers: 'Rvssian, NotNice, TJ Records, Di Genius, Adde Instrumentals',
    soundPalette: ['digital riddim', 'heavy bass', 'air horns', 'syncopated drums', 'synth stabs'],
    mixingStyle: 'Bass-heavy, punchy, loud, party-ready, vocal clarity'
  },

  'lo-fi': {
    stylePrompt: 'Lo-fi hip hop chill production. Dusty vinyl crackle, mellow jazz piano samples, soft boom-bap drums. Study beats. Nostalgic tape warmth. Nujabes spiritual successor.',
    productionNotes: 'Vinyl noise texture. Jazz chord samples. Soft kick and snare. Ambient background noise (rain, café). Detuned and warped. Swing on the drums.',
    referenceProducers: 'Nujabes, J Dilla, Tomppabeats, Idealism, Jinsang',
    soundPalette: ['vinyl crackle', 'jazz piano samples', 'soft drums', 'ambient textures', 'mellow bass'],
    mixingStyle: 'Warm, lo-fidelity, soft, intimate, nostalgic'
  },

  'house': {
    stylePrompt: 'Deep House to Tech House production. Four on the floor kick, groovy bassline, vocal chops, warm pads. Ibiza sunset vibes. Disclosure quality. Dancefloor ready groove.',
    productionNotes: 'Four-on-the-floor kick essential. Groovy bassline drives the track. Hi-hat patterns create movement. Vocal chops and samples. Filter sweeps for tension. Builds and releases.',
    referenceProducers: 'Disclosure, Chris Lake, Fisher, MK, Peggy Gou, Kaytranada',
    soundPalette: ['four-on-the-floor kick', 'groovy bass', 'vocal chops', 'warm pads', 'hi-hats', 'claps'],
    mixingStyle: 'Groovy, warm, bass-focused, dancefloor-tested, spacious'
  },

  'techno': {
    stylePrompt: 'Berlin Techno production. Driving four-on-the-floor kick, industrial textures, hypnotic synth loops. Dark warehouse energy. Charlotte de Witte intensity. Relentless machine groove.',
    productionNotes: 'Hypnotic repetition. Slowly evolving layers. Industrial sound design. Minimal melodic elements. Reverb-drenched percussion. Builds tension over long periods.',
    referenceProducers: 'Charlotte de Witte, Amelie Lens, Adam Beyer, Richie Hawtin, Ben Klock',
    soundPalette: ['industrial kick', 'modular synths', 'metallic percussion', 'acid bass', 'noise textures'],
    mixingStyle: 'Dark, hypnotic, loud, industrial, relentless'
  },

  'ambient': {
    stylePrompt: 'Ambient soundscape production. Ethereal pads, granular synthesis textures, field recordings. Brian Eno atmospheric quality. Meditative and expansive. Immersive sonic landscape.',
    productionNotes: 'Long evolving textures. No traditional rhythm. Reverb is an instrument. Granular processing. Field recordings layered. Subtle melodic fragments. Dynamic range is wide.',
    referenceProducers: 'Brian Eno, Sigur Rós, Nils Frahm, Ólafur Arnalds, Tycho',
    soundPalette: ['evolving pads', 'granular textures', 'field recordings', 'piano fragments', 'reverse sounds'],
    mixingStyle: 'Spacious, ethereal, wide, immersive, dynamic'
  },

  'disco': {
    stylePrompt: 'Modern Disco Funk production. Four on the floor groove, funky bassline, string orchestra, brass stabs. Dua Lipa Future Nostalgia quality. Saturday night fever energy. Groovy and glamorous.',
    productionNotes: 'Four-on-the-floor disco kick. Funky slap bass. String section adds glamour. Brass stabs on accents. Guitar chunking rhythm. Diva vocal production.',
    referenceProducers: 'Nile Rodgers, Mark Ronson, Stuart Price, SG Lewis, Daft Punk',
    soundPalette: ['disco strings', 'funky bass', 'brass section', 'rhythm guitar', 'congas', 'claps'],
    mixingStyle: 'Groovy, bright, wide, dancefloor-ready, funky'
  },

  'funk': {
    stylePrompt: 'Classic Funk production with modern edge. Slap bass, chicken scratch guitar, clavinet, tight horns. Silk Sonic grooviness. James Brown energy. The One never stops.',
    productionNotes: 'Slap bass is the foundation. Clavinet or Rhodes for rhythm. Tight horn stabs. Drums in the pocket. Guitar scratch on upbeats. Everything locks to The One.',
    referenceProducers: 'Bruno Mars, Anderson .Paak, Vulfpeck, Prince, Bootsy Collins, George Clinton',
    soundPalette: ['slap bass', 'clavinet', 'scratch guitar', 'horn section', 'tight drums', 'wah pedal'],
    mixingStyle: 'Tight, punchy, groovy, bass-forward, live feel'
  },

  'metal': {
    stylePrompt: 'Modern Metal production. Crushing down-tuned guitars, double bass drums, screamed and clean vocal contrast. Bring Me The Horizon quality. Epic and devastating. Wall of sound.',
    productionNotes: 'Down-tuned guitars (drop C or lower). Double bass drum precision. Rhythm guitar wall. Clean vocal contrast in chorus. Breakdown section essential. Bass follows guitars.',
    referenceProducers: 'Andy Sneap, Adam Getgood, Will Putney, Terry Date, Josh Wilbur',
    soundPalette: ['down-tuned guitars', 'double bass drums', 'orchestral elements', 'screams', 'clean vocals'],
    mixingStyle: 'Heavy, precise, loud, guitar-wall, controlled chaos'
  },

  'punk': {
    stylePrompt: 'Fast Punk Rock production. Power chords, fast drums, raw energy. Green Day pop-punk perfection. Three chords and the truth. Short, fast, loud. DIY spirit.',
    productionNotes: 'Fast tempo. Power chords with distortion. Simple drum patterns at speed. Bass follows guitar root notes. Minimal overdubs. Raw vocal takes. Done quickly.',
    referenceProducers: 'Rob Cavallo, Jerry Finn, Bill Stevenson, Butch Vig',
    soundPalette: ['power chord guitars', 'fast drums', 'simple bass', 'gang vocals', 'raw energy'],
    mixingStyle: 'Raw, loud, fast, in-your-face, minimal processing'
  }
};

// ============================================================
// MOOD MODIFIERS - Ajusta el tono emocional
// ============================================================
interface MoodModifier {
  emotionalShift: string;
  lyricalAdjustment: string;
  productionTweak: string;
}

const MOOD_MODIFIERS: Record<string, MoodModifier> = {
  'energetic': {
    emotionalShift: 'High energy, unstoppable momentum, celebration of life',
    lyricalAdjustment: 'Active verbs, exclamatory phrases, urgent tempo in words',
    productionTweak: 'Faster BPM, brighter tones, more percussion, driving rhythm'
  },
  'mellow': {
    emotionalShift: 'Relaxed, contemplative, peaceful but engaged',
    lyricalAdjustment: 'Softer imagery, flowing phrases, gentle emotions',
    productionTweak: 'Slower tempo, warmer tones, less percussion, space in arrangement'
  },
  'upbeat': {
    emotionalShift: 'Happy, optimistic, feel-good vibes',
    lyricalAdjustment: 'Positive imagery, hopeful messages, singalong quality',
    productionTweak: 'Major keys, bright synths, bouncy rhythm, uplifting progression'
  },
  'dark': {
    emotionalShift: 'Intense, mysterious, powerful undercurrent',
    lyricalAdjustment: 'Shadow imagery, complex emotions, introspective depth',
    productionTweak: 'Minor keys, darker textures, atmospheric elements, tension'
  },
  'romantic': {
    emotionalShift: 'Intimate, passionate, emotionally vulnerable',
    lyricalAdjustment: 'Love imagery, sensual but tasteful, deep connection',
    productionTweak: 'Lush arrangement, warm tones, intimate production, smooth groove'
  }
};

// ============================================================
// ARTIST DNA: Identity context for coherent music generation
// ============================================================
export interface ArtistDNA {
  biography?: string;
  musicGenres?: string[];
  moodVibe?: string;
  lookDescription?: string;
  influences?: string[];
  // Blueprint-enriched fields (from Superstar Blueprint sound module)
  lyricThemes?: string[];
  vocalStyle?: string;
  productionStyle?: string;
  signatureSound?: string;
  moodKeywords?: string[];
}

// ============================================================
// MAIN FUNCTION: Generate Hit Lyrics with AI
// ============================================================
export interface LyricsGenerationParams {
  artistName: string;
  songTitle: string;
  genre: string;
  mood: string;
  artistGender: 'male' | 'female';
  artistBio?: string;
  artistDNA?: ArtistDNA;
}

export interface GeneratedLyrics {
  lyrics: string;
  theme: string;
  hookLine: string;
  productionPrompt: string;
}

// Smart genre resolution for lyrics generator
const LYRICS_GENRE_FALLBACK: Record<string, string> = {
  'r&b': 'r&b', 'rnb': 'r&b', 'neo-soul': 'soul', 'neo soul': 'soul',
  'bedroom pop': 'lo-fi', 'dream pop': 'indie', 'synth-pop': 'electronic',
  'synthpop': 'electronic', 'edm': 'electronic', 'dance': 'house',
  'deep house': 'house', 'tech house': 'house', 'progressive house': 'electronic',
  'dubstep': 'electronic', 'drum and bass': 'electronic', 'dnb': 'electronic',
  'hard rock': 'rock', 'alt rock': 'rock', 'alternative': 'indie',
  'grunge': 'rock', 'emo': 'rock', 'pop rock': 'rock', 'pop-rock': 'rock',
  'hip hop': 'hip-hop', 'hiphop': 'hip-hop', 'boom bap': 'hip-hop',
  'old school hip hop': 'hip-hop', 'conscious rap': 'rap',
  'latin pop': 'latin', 'latin trap': 'trap', 'latin urban': 'reggaeton',
  'salsa': 'latin', 'bachata': 'latin', 'cumbia': 'latin', 'merengue': 'latin',
  'bossa nova': 'jazz', 'smooth jazz': 'jazz', 'acid jazz': 'jazz',
  'ska': 'reggae', 'dub': 'reggae', 'roots reggae': 'reggae',
  'afro pop': 'afrobeat', 'afropop': 'afrobeat', 'afrobeats': 'afrobeat',
  'amapiano': 'afrobeat', 'grime': 'trap',
  'death metal': 'metal', 'heavy metal': 'metal', 'thrash metal': 'metal',
  'metalcore': 'metal', 'deathcore': 'metal',
  'pop punk': 'punk', 'hardcore': 'punk', 'post-punk': 'punk',
  'nu metal': 'metal', 'post-rock': 'rock',
  'classical': 'ambient', 'new age': 'ambient', 'chillout': 'lo-fi',
  'chill': 'lo-fi', 'lofi': 'lo-fi',
  'motown': 'soul', 'neo r&b': 'r&b',
};

function resolveGenreForLyrics(genre: string): string {
  const lower = genre.toLowerCase().trim();
  if (GENRE_ESSENCE[lower]) return lower;
  const mapped = LYRICS_GENRE_FALLBACK[lower];
  if (mapped && GENRE_ESSENCE[mapped]) return mapped;
  return 'pop';
}

/**
 * Genera letras de hit mundial usando OpenAI
 * Basado en la ESENCIA del género, no en la biografía del artista
 */
export async function generateHitLyrics(params: LyricsGenerationParams): Promise<GeneratedLyrics> {
  const { artistName, songTitle, genre, mood, artistGender, artistBio, artistDNA } = params;
  
  // Resolver género con fallback inteligente
  const resolvedGenre = resolveGenreForLyrics(genre);
  
  // Obtener esencia del género
  const genreEssence = GENRE_ESSENCE[resolvedGenre];
  const production = PRODUCTION_BLUEPRINTS[resolvedGenre] || PRODUCTION_BLUEPRINTS['pop'];
  const moodMod = MOOD_MODIFIERS[mood.toLowerCase()] || MOOD_MODIFIERS['energetic'];
  
  // Seleccionar tema aleatorio del género (evita monotonía)
  const selectedTheme = genreEssence.coreThemes[Math.floor(Math.random() * genreEssence.coreThemes.length)];
  const selectedHook = genreEssence.universalHooks[Math.floor(Math.random() * genreEssence.universalHooks.length)];
  
  // Construir el prompt maestro
  const systemPrompt = `You are a GRAMMY-winning songwriter who has written #1 hits for ${genreEssence.iconicReferences.join(', ')}.

Your songs have achieved:
- Multiple Billboard Hot 100 #1s
- Billions of streams on Spotify
- Global recognition across cultures

CRITICAL RULES:
1. Write ORIGINAL lyrics - never copy existing songs
2. Follow the HIT FORMULA exactly
3. Use UNIVERSAL themes that resonate globally
4. Create a HOOK that gets stuck in people's heads
5. Make every line SINGABLE and MEMORABLE
6. Avoid clichés - find fresh ways to express emotions
7. Include strategic repetition for catchiness
8. Write for ${artistGender === 'female' ? 'a powerful female voice' : 'a strong male voice'}

OUTPUT FORMAT:
Use these exact tags: [intro], [verse], [pre-chorus], [chorus], [verse], [chorus], [bridge], [outro]
Each section should be clearly labeled.`;

  const userPrompt = `Write a WORLDWIDE HIT song for ${artistName}.

SONG DETAILS:
- Title: "${songTitle}"
- Genre: ${genre.toUpperCase()} (${genreEssence.lyricalStyle})
- Mood: ${mood} (${moodMod.emotionalShift})
- Theme to explore: "${selectedTheme}"
- Try to incorporate: "${selectedHook}" naturally in the hook

GENRE HIT FORMULA:
${genreEssence.hitFormula}

EMOTIONAL PALETTE:
${genreEssence.emotionalPalette.join(', ')}

AVOID THESE THEMES:
${genreEssence.avoidThemes.join(', ')}

LYRICAL STYLE GUIDE:
${genreEssence.lyricalStyle}
${moodMod.lyricalAdjustment}

${artistDNA?.biography ? `
ARTIST IDENTITY (use to shape themes, perspective, and emotional tone):
${artistDNA.biography.substring(0, 400)}` : ''}
${artistDNA?.influences?.length ? `
MUSICAL INFLUENCES (channel their spirit, do NOT copy): ${artistDNA.influences.slice(0, 5).join(', ')}` : ''}
${artistDNA?.moodVibe ? `
ARTIST VIBE: ${artistDNA.moodVibe}` : ''}
${artistDNA?.musicGenres && artistDNA.musicGenres.length > 1 ? `
BLEND GENRES: This artist fuses ${artistDNA.musicGenres.join(' + ')} — reflect cross-genre elements` : ''}
${artistDNA?.lyricThemes?.length ? `
PREFERRED LYRIC THEMES (write lyrics aligned to these themes): ${artistDNA.lyricThemes.slice(0, 5).join(', ')}` : ''}
${artistDNA?.moodKeywords?.length ? `
MOOD & EMOTIONAL KEYWORDS: ${artistDNA.moodKeywords.slice(0, 6).join(', ')}` : ''}
${artistDNA?.signatureSound ? `
ARTIST SONIC SIGNATURE: ${artistDNA.signatureSound}` : ''}
${artistDNA?.vocalStyle ? `
VOCAL STYLE TO MATCH: ${artistDNA.vocalStyle}` : ''}

Write the complete song with:
1. A hook that becomes an earworm
2. Verses that build the emotional journey
3. A pre-chorus that creates anticipation
4. A chorus that explodes with the main message
5. A bridge that adds a new emotional layer
6. An outro that leaves them wanting more

The lyrics should feel like they could be playing on every radio station worldwide.`;

  try {
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9, // Alta creatividad
      max_tokens: 2000,
    });

    const generatedLyrics = response.choices[0]?.message?.content || '';
    
    // Extraer el hook del chorus
    const chorusMatch = generatedLyrics.match(/\[chorus\]([\s\S]*?)(?=\[|$)/i);
    const chorusText = chorusMatch ? chorusMatch[1].trim() : '';
    const hookLine = chorusText.split('\n')[0] || `${songTitle}!`;
    
    // Construir prompt de producción optimizado (300 chars max para MiniMax)
    const productionPrompt = `${production.stylePrompt} ${moodMod.productionTweak}`.substring(0, 300);
    
    console.log(`🎵 [HIT MACHINE] Generated lyrics for "${songTitle}" (${genre}/${mood})`);
    console.log(`🎵 Theme: "${selectedTheme}"`);
    console.log(`🎵 Hook: "${hookLine.substring(0, 50)}..."`);
    
    return {
      lyrics: generatedLyrics,
      theme: selectedTheme,
      hookLine: hookLine,
      productionPrompt: productionPrompt
    };
    
  } catch (error) {
    console.error('[HIT MACHINE] Error generating lyrics:', error);
    
    // Fallback: usar template mejorado
    return generateFallbackLyrics(params, genreEssence, selectedTheme);
  }
}

/**
 * Fallback lyrics generator (si OpenAI falla)
 */
function generateFallbackLyrics(
  params: LyricsGenerationParams,
  essence: GenreEssence,
  theme: string
): GeneratedLyrics {
  const { artistName, songTitle, genre, mood, artistGender } = params;
  const production = PRODUCTION_BLUEPRINTS[genre.toLowerCase()] || PRODUCTION_BLUEPRINTS['pop'];
  const moodMod = MOOD_MODIFIERS[mood.toLowerCase()] || MOOD_MODIFIERS['energetic'];
  
  const hook = essence.universalHooks[Math.floor(Math.random() * essence.universalHooks.length)];
  
  // Template dinámico basado en género
  const lyrics = `[intro]
${artistName}

[verse]
In the ${mood} night we come alive
Every moment feels like the first time
Chasing ${theme.split(' ')[0]} through the city lights
With you everything just feels right

[pre-chorus]
Can you feel it rising up inside
There's no way to hide what we feel tonight

[chorus]
${songTitle}, ${hook}
We're taking over, can't be stopped now
${songTitle}, this is our time
${hook}, we're gonna shine

[verse]
${theme} is what we're living for
Open up and show me something more
Every heartbeat leads us to this place
Look into my eyes, feel the embrace

[chorus]
${songTitle}, ${hook}
We're taking over, can't be stopped now
${songTitle}, this is our time
${hook}, we're gonna shine

[bridge]
When the world tries to bring us down
We'll rise up and wear the crown
Nothing's gonna stop us now
This is ${songTitle}

[outro]
${songTitle}... ${hook}
Yeah, ${artistName}`;

  return {
    lyrics,
    theme,
    hookLine: `${songTitle}, ${hook}`,
    productionPrompt: `${production.stylePrompt} ${moodMod.productionTweak}`.substring(0, 300)
  };
}

/**
 * Obtiene el prompt de producción para un género
 */
export function getProductionPrompt(genre: string, mood: string): string {
  const resolved = resolveGenreForLyrics(genre);
  const production = PRODUCTION_BLUEPRINTS[resolved] || PRODUCTION_BLUEPRINTS['pop'];
  const moodMod = MOOD_MODIFIERS[mood.toLowerCase()] || MOOD_MODIFIERS['energetic'];
  
  return `${production.stylePrompt} ${moodMod.productionTweak}`.substring(0, 300);
}

/**
 * Obtiene la esencia de un género
 */
export function getGenreEssence(genre: string): GenreEssence {
  const resolved = resolveGenreForLyrics(genre);
  return GENRE_ESSENCE[resolved] || GENRE_ESSENCE['pop'];
}

/**
 * Obtiene el blueprint de producción
 */
export function getProductionBlueprint(genre: string): ProductionBlueprint {
  const resolved = resolveGenreForLyrics(genre);
  return PRODUCTION_BLUEPRINTS[resolved] || PRODUCTION_BLUEPRINTS['pop'];
}

export default {
  generateHitLyrics,
  getProductionPrompt,
  getGenreEssence,
  getProductionBlueprint,
  GENRE_ESSENCE,
  PRODUCTION_BLUEPRINTS,
  MOOD_MODIFIERS
};
