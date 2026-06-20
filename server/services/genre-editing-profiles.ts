/**
 * 🎸 Genre Editing Profiles - Lógica inteligente de edición por género musical
 * 
 * Cada género tiene reglas específicas de:
 * - Cortes por sección (beats por corte)
 * - Tipos de transición preferidos
 * - Variaciones de plano recomendadas
 * - Multiplicador de energía
 * 
 * GÉNEROS SOPORTADOS:
 * - Hip-Hop/Rap/Trap: Cortes rápidos en hi-hat
 * - EDM/Electronic: Ultra rápido en drops
 * - Balada/Romántica: Cortes lentos, emocionales
 * - Reggaeton/Latin: Dembow pattern
 * - Rock/Metal: Cortes en snare
 * - Pop: Versátil, equilibrado
 * - Corrido/Regional: Cinematográfico, narrativo
 */

import { logger } from '../utils/logger';

// ========== INTERFACES ==========

export interface ShotVariation {
  type: 'wide' | 'medium' | 'close-up' | 'extreme-close-up' | 'detail' | 
        'dutch-angle' | 'over-shoulder' | 'low-angle' | 'high-angle' | 'pov';
  weight: number;        // Probabilidad relativa (mayor = más probable)
  editPrompt: string;    // Prompt para fal-ai/nano-banana/edit
  minDuration: number;   // Duración mínima en beats
  maxDuration: number;   // Duración máxima en beats
}

export interface CutRule {
  beatsPerCut: number;
  transition: 'cut' | 'fade' | 'crossfade' | 'flash' | 'zoom' | 'glitch' | 'shake' | 'dissolve';
}

export interface GenreEditingProfile {
  genre: string;
  aliases: string[];
  
  // Reglas de corte por sección
  cutRules: {
    intro: CutRule;
    verse: CutRule;
    preChorus: CutRule;
    chorus: CutRule;
    bridge: CutRule;
    drop: CutRule;
    outro: CutRule;
  };
  
  // Variaciones de plano recomendadas por contexto
  shotVariations: {
    performance: ShotVariation[];  // Cuando aparece el artista
    bRoll: ShotVariation[];        // Escenas sin artista (B-roll)
    climax: ShotVariation[];       // Momentos de alta energía
  };
  
  // Instrumentos que disparan cortes (triggers)
  cutTriggerInstruments: string[];
  
  // Pesos de probabilidad para transiciones
  transitionWeights: Record<string, number>;
  
  // Multiplicador de energía (EDM = 1.5, Balada = 0.6)
  energyMultiplier: number;
  
  // Descripción del estilo
  styleDescription: string;
}

// ========== PERFILES DE GÉNERO ==========

export const GENRE_PROFILES: Record<string, GenreEditingProfile> = {
  
  // ===== HIP-HOP / RAP / TRAP =====
  'hip-hop': {
    genre: 'hip-hop',
    aliases: ['rap', 'trap', 'drill', 'boom-bap', 'mumble-rap', 'conscious-rap'],
    cutRules: {
      intro: { beatsPerCut: 8, transition: 'fade' },
      verse: { beatsPerCut: 2, transition: 'cut' },       // Rápido en versos
      preChorus: { beatsPerCut: 2, transition: 'cut' },
      chorus: { beatsPerCut: 1, transition: 'flash' },    // Muy rápido en hook
      bridge: { beatsPerCut: 4, transition: 'crossfade' },
      drop: { beatsPerCut: 0.5, transition: 'flash' },    // Ultra rápido en drop
      outro: { beatsPerCut: 4, transition: 'fade' }
    },
    shotVariations: {
      performance: [
        { type: 'close-up', weight: 3, editPrompt: 'tight close-up portrait shot, face filling 70% frame, dramatic side lighting, urban aesthetic', minDuration: 1, maxDuration: 2 },
        { type: 'medium', weight: 2, editPrompt: 'medium shot waist-up, urban environment, graffiti wall, street style fashion', minDuration: 2, maxDuration: 4 },
        { type: 'low-angle', weight: 2, editPrompt: 'low angle power shot looking up at subject, imposing dominant presence, wide lens distortion', minDuration: 1, maxDuration: 2 },
        { type: 'dutch-angle', weight: 1, editPrompt: 'dutch angle tilted 15-20 degrees, dynamic tension, hip-hop energy', minDuration: 1, maxDuration: 2 },
      ],
      bRoll: [
        { type: 'detail', weight: 3, editPrompt: 'extreme close-up macro shot of hands, jewelry, gold chains, diamond watch, ring detail', minDuration: 0.5, maxDuration: 1 },
        { type: 'wide', weight: 2, editPrompt: 'wide establishing shot urban landscape, city skyline at night, neon lights, street scene', minDuration: 2, maxDuration: 4 },
        { type: 'pov', weight: 1, editPrompt: 'first person POV shot walking through urban scene, moving camera', minDuration: 1, maxDuration: 2 },
        { type: 'detail', weight: 2, editPrompt: 'close-up spinning rims, luxury car detail, exhaust flames', minDuration: 0.5, maxDuration: 1 },
      ],
      climax: [
        { type: 'extreme-close-up', weight: 3, editPrompt: 'extreme close-up eyes only filling frame, intense stare, high contrast', minDuration: 0.5, maxDuration: 1 },
        { type: 'close-up', weight: 2, editPrompt: 'dramatic close-up with motion blur streaks, energy lines', minDuration: 0.5, maxDuration: 1 },
      ]
    },
    cutTriggerInstruments: ['hi-hat', 'snare', '808', 'kick'],
    transitionWeights: { cut: 0.6, flash: 0.25, zoom: 0.1, crossfade: 0.05 },
    energyMultiplier: 1.3,
    styleDescription: 'Fast cuts on hi-hats, power shots, urban aesthetic, jewelry details'
  },

  // ===== EDM / ELECTRONIC =====
  'edm': {
    genre: 'edm',
    aliases: ['electronic', 'house', 'techno', 'dubstep', 'trance', 'future-bass', 'drum-and-bass', 'dnb'],
    cutRules: {
      intro: { beatsPerCut: 8, transition: 'fade' },
      verse: { beatsPerCut: 4, transition: 'crossfade' },
      preChorus: { beatsPerCut: 2, transition: 'zoom' },   // Build-up tension
      chorus: { beatsPerCut: 1, transition: 'flash' },
      bridge: { beatsPerCut: 4, transition: 'glitch' },
      drop: { beatsPerCut: 0.25, transition: 'flash' },    // ULTRA rápido en drop
      outro: { beatsPerCut: 8, transition: 'fade' }
    },
    shotVariations: {
      performance: [
        { type: 'wide', weight: 2, editPrompt: 'wide shot DJ booth with massive LED screens, laser beams, crowd silhouettes', minDuration: 2, maxDuration: 4 },
        { type: 'close-up', weight: 2, editPrompt: 'close-up on DJ equipment, hands on mixer faders, CDJ jog wheel spinning', minDuration: 1, maxDuration: 2 },
        { type: 'high-angle', weight: 1, editPrompt: 'overhead bird eye view drone shot of DJ and massive crowd below', minDuration: 2, maxDuration: 4 },
      ],
      bRoll: [
        { type: 'wide', weight: 3, editPrompt: 'crowd shot festival thousands of people, hands raised, laser lights cutting through fog', minDuration: 1, maxDuration: 2 },
        { type: 'detail', weight: 2, editPrompt: 'abstract macro close-up of LED pixels, neon tubes, light reflections on surfaces', minDuration: 0.5, maxDuration: 1 },
        { type: 'pov', weight: 1, editPrompt: 'POV shot moving through dancing crowd toward main stage, strobes flashing', minDuration: 2, maxDuration: 4 },
        { type: 'detail', weight: 2, editPrompt: 'slow motion water droplets, confetti falling, pyrotechnics sparks', minDuration: 0.5, maxDuration: 1 },
      ],
      climax: [
        { type: 'wide', weight: 2, editPrompt: 'epic wide shot moment of bass drop, pyrotechnics explosion, CO2 cannons, maximum chaos', minDuration: 0.25, maxDuration: 0.5 },
        { type: 'close-up', weight: 2, editPrompt: 'rapid montage close-up faces in ecstasy, sweat, screaming joy', minDuration: 0.25, maxDuration: 0.5 },
      ]
    },
    cutTriggerInstruments: ['kick', 'synth', 'bass', 'drop'],
    transitionWeights: { flash: 0.4, glitch: 0.3, cut: 0.2, zoom: 0.1 },
    energyMultiplier: 1.5,
    styleDescription: 'Ultra-fast cuts on drops, strobes, lasers, crowd energy, build-up tension'
  },

  // ===== BALADA / ROMÁNTICA =====
  'balada': {
    genre: 'balada',
    aliases: ['ballad', 'romantic', 'slow', 'love-song', 'r&b-ballad', 'soul-ballad', 'piano-ballad'],
    cutRules: {
      intro: { beatsPerCut: 16, transition: 'fade' },
      verse: { beatsPerCut: 8, transition: 'crossfade' },   // Muy lento, emotivo
      preChorus: { beatsPerCut: 8, transition: 'dissolve' },
      chorus: { beatsPerCut: 4, transition: 'crossfade' },  // Un poco más dinámico
      bridge: { beatsPerCut: 8, transition: 'fade' },
      drop: { beatsPerCut: 4, transition: 'zoom' },
      outro: { beatsPerCut: 16, transition: 'fade' }
    },
    shotVariations: {
      performance: [
        { type: 'close-up', weight: 3, editPrompt: 'emotional intimate close-up, soft diffused lighting, tears glistening in eyes, vulnerable expression', minDuration: 4, maxDuration: 8 },
        { type: 'medium', weight: 2, editPrompt: 'medium shot in intimate setting, piano, bedroom window with rain, sunset golden hour', minDuration: 4, maxDuration: 8 },
        { type: 'over-shoulder', weight: 1, editPrompt: 'over shoulder shot looking at old photographs, window with city lights', minDuration: 4, maxDuration: 8 },
      ],
      bRoll: [
        { type: 'detail', weight: 3, editPrompt: 'extreme close-up hands gently touching, wedding ring detail, holding faded photograph', minDuration: 2, maxDuration: 4 },
        { type: 'wide', weight: 2, editPrompt: 'wide romantic landscape, beach at sunset, rain on window pane, autumn leaves falling', minDuration: 4, maxDuration: 8 },
        { type: 'medium', weight: 1, editPrompt: 'empty chair by window, unmade bed, coffee cup steam rising, symbolic loneliness', minDuration: 4, maxDuration: 8 },
      ],
      climax: [
        { type: 'extreme-close-up', weight: 2, editPrompt: 'single tear rolling down cheek, extreme emotion, soft focus background', minDuration: 2, maxDuration: 4 },
        { type: 'wide', weight: 2, editPrompt: 'wide shot figure alone in vast empty space, ocean beach, emotional scale contrast', minDuration: 4, maxDuration: 8 },
      ]
    },
    cutTriggerInstruments: ['piano', 'strings', 'vocals', 'acoustic-guitar'],
    transitionWeights: { crossfade: 0.5, fade: 0.3, dissolve: 0.15, cut: 0.05 },
    energyMultiplier: 0.6,
    styleDescription: 'Slow emotional cuts, soft transitions, intimate moments, tears and longing'
  },

  // ===== REGGAETON / LATIN URBAN =====
  'reggaeton': {
    genre: 'reggaeton',
    aliases: ['latin-urban', 'dembow', 'perreo', 'latin-trap', 'urbano', 'reggaeton-romantico'],
    cutRules: {
      intro: { beatsPerCut: 4, transition: 'cut' },
      verse: { beatsPerCut: 2, transition: 'cut' },        // Dembow tum-pa pattern
      preChorus: { beatsPerCut: 2, transition: 'zoom' },
      chorus: { beatsPerCut: 1, transition: 'flash' },
      bridge: { beatsPerCut: 4, transition: 'crossfade' },
      drop: { beatsPerCut: 0.5, transition: 'flash' },
      outro: { beatsPerCut: 4, transition: 'fade' }
    },
    shotVariations: {
      performance: [
        { type: 'medium', weight: 3, editPrompt: 'medium shot VIP club setting, champagne bottles with sparklers, booth with models', minDuration: 2, maxDuration: 4 },
        { type: 'close-up', weight: 2, editPrompt: 'confident close-up smirking expression, gold grillz optional, designer sunglasses', minDuration: 1, maxDuration: 2 },
        { type: 'low-angle', weight: 2, editPrompt: 'low angle power pose shot, luxury mansion background, flexing lifestyle', minDuration: 1, maxDuration: 2 },
      ],
      bRoll: [
        { type: 'detail', weight: 3, editPrompt: 'close-up bodies dancing perreo, hip movement sync with dembow, sensual rhythm', minDuration: 1, maxDuration: 2 },
        { type: 'wide', weight: 2, editPrompt: 'wide party scene, infinity pool party, yacht deck, Miami club aerial', minDuration: 2, maxDuration: 4 },
        { type: 'medium', weight: 2, editPrompt: 'medium shot Lamborghini/Ferrari driving, palm trees boulevard, tropical sunset', minDuration: 2, maxDuration: 4 },
        { type: 'detail', weight: 2, editPrompt: 'slow motion champagne pouring, ice cubes splashing, money counting', minDuration: 1, maxDuration: 2 },
      ],
      climax: [
        { type: 'close-up', weight: 2, editPrompt: 'rapid close-ups perfectly synced with dembow kick pattern, energy peak', minDuration: 0.5, maxDuration: 1 },
        { type: 'wide', weight: 1, editPrompt: 'wide crowd party peak moment, confetti cannon explosion', minDuration: 1, maxDuration: 2 },
      ]
    },
    cutTriggerInstruments: ['dembow-kick', 'snare', 'bass', 'hi-hat'],
    transitionWeights: { cut: 0.5, flash: 0.25, zoom: 0.2, crossfade: 0.05 },
    energyMultiplier: 1.2,
    styleDescription: 'Cuts on dembow pattern, party vibes, luxury lifestyle, sensual dancing'
  },

  // ===== ROCK / METAL =====
  'rock': {
    genre: 'rock',
    aliases: ['rock-alternativo', 'indie-rock', 'metal', 'punk', 'grunge', 'hard-rock', 'classic-rock'],
    cutRules: {
      intro: { beatsPerCut: 8, transition: 'fade' },
      verse: { beatsPerCut: 4, transition: 'cut' },
      preChorus: { beatsPerCut: 2, transition: 'cut' },
      chorus: { beatsPerCut: 2, transition: 'flash' },
      bridge: { beatsPerCut: 4, transition: 'crossfade' },
      drop: { beatsPerCut: 1, transition: 'shake' },       // Guitar solo/breakdown
      outro: { beatsPerCut: 4, transition: 'fade' }
    },
    shotVariations: {
      performance: [
        { type: 'medium', weight: 3, editPrompt: 'medium shot full band performing on stage, Marshall amps, drum kit visible, stage lights', minDuration: 2, maxDuration: 4 },
        { type: 'close-up', weight: 2, editPrompt: 'close-up lead singer raw intensity, veins visible, screaming vocals, sweat dripping', minDuration: 2, maxDuration: 4 },
        { type: 'low-angle', weight: 2, editPrompt: 'low angle guitarist power stance, Les Paul guitar, windmill motion frozen', minDuration: 2, maxDuration: 4 },
        { type: 'dutch-angle', weight: 1, editPrompt: 'dutch angle drummer mid-fill, sticks blur motion, intensity', minDuration: 1, maxDuration: 2 },
      ],
      bRoll: [
        { type: 'detail', weight: 3, editPrompt: 'extreme close-up guitar strings vibrating, pick attack, fretboard slide action', minDuration: 1, maxDuration: 2 },
        { type: 'wide', weight: 2, editPrompt: 'wide concert crowd moshing, crowd surfing, fists raised, wall of death', minDuration: 2, maxDuration: 4 },
        { type: 'detail', weight: 2, editPrompt: 'drum stick hitting snare splash water droplets, cymbal crash spray', minDuration: 1, maxDuration: 2 },
        { type: 'medium', weight: 1, editPrompt: 'medium shot bass player headbanging, hair whipping motion blur', minDuration: 2, maxDuration: 4 },
      ],
      climax: [
        { type: 'wide', weight: 2, editPrompt: 'epic wide shot band silhouette against massive light wall, pyrotechnics flames', minDuration: 2, maxDuration: 4 },
        { type: 'close-up', weight: 2, editPrompt: 'close-up primal scream face, maximum raw emotion, veins popping', minDuration: 1, maxDuration: 2 },
      ]
    },
    cutTriggerInstruments: ['drums', 'snare', 'guitar', 'bass', 'crash-cymbal'],
    transitionWeights: { cut: 0.5, shake: 0.2, flash: 0.15, crossfade: 0.15 },
    energyMultiplier: 1.1,
    styleDescription: 'Cuts on snare hits, raw energy, mosh pits, guitar solos, sweaty intensity'
  },

  // ===== POP =====
  'pop': {
    genre: 'pop',
    aliases: ['dance-pop', 'synth-pop', 'electropop', 'mainstream', 'top-40', 'radio-pop'],
    cutRules: {
      intro: { beatsPerCut: 8, transition: 'fade' },
      verse: { beatsPerCut: 4, transition: 'cut' },
      preChorus: { beatsPerCut: 2, transition: 'zoom' },
      chorus: { beatsPerCut: 2, transition: 'cut' },
      bridge: { beatsPerCut: 4, transition: 'crossfade' },
      drop: { beatsPerCut: 1, transition: 'flash' },
      outro: { beatsPerCut: 8, transition: 'fade' }
    },
    shotVariations: {
      performance: [
        { type: 'medium', weight: 3, editPrompt: 'medium shot dance choreography formation, colorful LED set, backup dancers synchronized', minDuration: 2, maxDuration: 4 },
        { type: 'close-up', weight: 2, editPrompt: 'glamorous beauty close-up, perfect lighting, flawless makeup, charismatic smile', minDuration: 2, maxDuration: 4 },
        { type: 'wide', weight: 2, editPrompt: 'wide shot full dance formation, geometric stage design, professional choreography', minDuration: 2, maxDuration: 4 },
      ],
      bRoll: [
        { type: 'detail', weight: 2, editPrompt: 'sparkles and glitter macro detail, confetti rainbow, crystals reflecting light', minDuration: 1, maxDuration: 2 },
        { type: 'medium', weight: 2, editPrompt: 'fashion forward outfit change transition, designer wardrobe, style icon', minDuration: 2, maxDuration: 4 },
        { type: 'wide', weight: 2, editPrompt: 'colorful abstract gradient backgrounds, LED wall graphics, candy colors', minDuration: 2, maxDuration: 4 },
      ],
      climax: [
        { type: 'wide', weight: 2, editPrompt: 'big finale moment maximum production, all dancers synchronized, confetti explosion, lights max', minDuration: 2, maxDuration: 4 },
        { type: 'close-up', weight: 2, editPrompt: 'iconic signature pose close-up, memorable viral moment, star quality', minDuration: 1, maxDuration: 2 },
      ]
    },
    cutTriggerInstruments: ['kick', 'clap', 'synth', 'bass'],
    transitionWeights: { cut: 0.4, zoom: 0.25, flash: 0.2, crossfade: 0.15 },
    energyMultiplier: 1.0,
    styleDescription: 'Polished cuts, choreography focus, colorful, catchy visual hooks'
  },
  
  // ===== CORRIDO / REGIONAL MEXICANO =====
  'corrido': {
    genre: 'corrido',
    aliases: ['regional-mexicano', 'corridos-tumbados', 'norteno', 'banda', 'sierreño', 'corridon'],
    cutRules: {
      intro: { beatsPerCut: 8, transition: 'fade' },
      verse: { beatsPerCut: 8, transition: 'cut' },        // Lento, narrativo storytelling
      preChorus: { beatsPerCut: 4, transition: 'crossfade' },
      chorus: { beatsPerCut: 4, transition: 'cut' },
      bridge: { beatsPerCut: 8, transition: 'fade' },
      drop: { beatsPerCut: 2, transition: 'zoom' },
      outro: { beatsPerCut: 8, transition: 'fade' }
    },
    shotVariations: {
      performance: [
        { type: 'medium', weight: 3, editPrompt: 'medium shot ranch hacienda setting, cowboy hat, western boots, pickup trucks background', minDuration: 4, maxDuration: 8 },
        { type: 'close-up', weight: 2, editPrompt: 'close-up serious commanding expression, gold teeth grillz, thick chain, authority', minDuration: 2, maxDuration: 4 },
        { type: 'wide', weight: 2, editPrompt: 'wide epic Sonoran desert landscape, mountains at sunset, cinematic Western scope', minDuration: 4, maxDuration: 8 },
      ],
      bRoll: [
        { type: 'detail', weight: 3, editPrompt: 'extreme close-up ostrich skin boots, massive belt buckle, pistol handle detail, cuerno de chivo', minDuration: 2, maxDuration: 4 },
        { type: 'wide', weight: 2, editPrompt: 'wide ranch scene, horses running, truck convoy lineup, dust cloud', minDuration: 4, maxDuration: 8 },
        { type: 'medium', weight: 2, editPrompt: 'medium shot counting stacks of cash, lifestyle flex, expensive tequila pouring', minDuration: 2, maxDuration: 4 },
        { type: 'detail', weight: 2, editPrompt: 'close-up requinto guitar playing, accordion buttons, tuba valves in action', minDuration: 2, maxDuration: 4 },
      ],
      climax: [
        { type: 'wide', weight: 2, editPrompt: 'wide cinematic moment, dramatic storm sky, lone figure silhouette, epic scale', minDuration: 4, maxDuration: 8 },
        { type: 'close-up', weight: 2, editPrompt: 'intense close-up storytelling climax, emotional peak of corrido narrative', minDuration: 2, maxDuration: 4 },
      ]
    },
    cutTriggerInstruments: ['tuba', 'accordion', 'guitar', 'requinto', 'bajo-sexto'],
    transitionWeights: { cut: 0.4, fade: 0.3, crossfade: 0.25, zoom: 0.05 },
    energyMultiplier: 0.8,
    styleDescription: 'Cinematic Western aesthetic, narrative storytelling, ranch lifestyle, slow dramatic builds'
  },

  // ===== R&B / SOUL =====
  'rnb': {
    genre: 'rnb',
    aliases: ['r&b', 'soul', 'neo-soul', 'contemporary-rnb', 'alternative-rnb'],
    cutRules: {
      intro: { beatsPerCut: 8, transition: 'fade' },
      verse: { beatsPerCut: 4, transition: 'crossfade' },
      preChorus: { beatsPerCut: 4, transition: 'dissolve' },
      chorus: { beatsPerCut: 2, transition: 'cut' },
      bridge: { beatsPerCut: 4, transition: 'crossfade' },
      drop: { beatsPerCut: 2, transition: 'zoom' },
      outro: { beatsPerCut: 8, transition: 'fade' }
    },
    shotVariations: {
      performance: [
        { type: 'close-up', weight: 3, editPrompt: 'sensual close-up soft studio lighting, R&B mood, intimate eye contact with camera', minDuration: 2, maxDuration: 4 },
        { type: 'medium', weight: 2, editPrompt: 'medium shot minimalist set design, mood lighting purple/blue, silk fabrics', minDuration: 2, maxDuration: 4 },
        { type: 'over-shoulder', weight: 1, editPrompt: 'over shoulder shot intimate conversation implication, two subjects', minDuration: 2, maxDuration: 4 },
      ],
      bRoll: [
        { type: 'detail', weight: 3, editPrompt: 'sensual detail shots, silk sheets texture, candle flame flickering, skin close-up', minDuration: 1, maxDuration: 2 },
        { type: 'wide', weight: 2, editPrompt: 'wide penthouse night view, city lights through floor windows, luxury minimalism', minDuration: 2, maxDuration: 4 },
        { type: 'medium', weight: 2, editPrompt: 'medium shot slow motion fabric flowing, artistic movement, dancer silhouette', minDuration: 2, maxDuration: 4 },
      ],
      climax: [
        { type: 'close-up', weight: 2, editPrompt: 'passionate close-up peak emotion, eyes closed feeling music, vocal run moment', minDuration: 2, maxDuration: 4 },
        { type: 'wide', weight: 2, editPrompt: 'wide dramatic lighting shift, spotlight isolation, emotional crescendo', minDuration: 2, maxDuration: 4 },
      ]
    },
    cutTriggerInstruments: ['vocals', 'keys', 'bass', 'snare', 'hi-hat'],
    transitionWeights: { crossfade: 0.4, cut: 0.3, dissolve: 0.2, fade: 0.1 },
    energyMultiplier: 0.9,
    styleDescription: 'Smooth sensual cuts, intimate vibes, mood lighting, silk textures'
  },

  // ===== COUNTRY =====
  'country': {
    genre: 'country',
    aliases: ['country-pop', 'country-rock', 'americana', 'outlaw-country', 'bro-country'],
    cutRules: {
      intro: { beatsPerCut: 8, transition: 'fade' },
      verse: { beatsPerCut: 4, transition: 'cut' },
      preChorus: { beatsPerCut: 4, transition: 'crossfade' },
      chorus: { beatsPerCut: 2, transition: 'cut' },
      bridge: { beatsPerCut: 8, transition: 'fade' },
      drop: { beatsPerCut: 2, transition: 'zoom' },
      outro: { beatsPerCut: 8, transition: 'fade' }
    },
    shotVariations: {
      performance: [
        { type: 'medium', weight: 3, editPrompt: 'medium shot honky tonk bar stage, acoustic guitar, cowboy boots on monitor', minDuration: 2, maxDuration: 4 },
        { type: 'close-up', weight: 2, editPrompt: 'close-up genuine emotion, weathered face optional, authentic country soul', minDuration: 2, maxDuration: 4 },
        { type: 'wide', weight: 2, editPrompt: 'wide shot outdoor amphitheater, American flag, sunset behind stage', minDuration: 4, maxDuration: 8 },
      ],
      bRoll: [
        { type: 'wide', weight: 3, editPrompt: 'wide scenic country road, pickup truck driving, golden wheat fields, open sky', minDuration: 4, maxDuration: 8 },
        { type: 'detail', weight: 2, editPrompt: 'close-up hands on acoustic guitar, campfire flames, beer bottle sweating', minDuration: 2, maxDuration: 4 },
        { type: 'medium', weight: 2, editPrompt: 'medium shot small town Main Street, American flags, front porch swing', minDuration: 2, maxDuration: 4 },
      ],
      climax: [
        { type: 'wide', weight: 2, editPrompt: 'wide panoramic sunset moment, silhouette against orange sky, emotional peak', minDuration: 4, maxDuration: 8 },
        { type: 'close-up', weight: 2, editPrompt: 'close-up breakthrough emotional moment, single tear country authentic', minDuration: 2, maxDuration: 4 },
      ]
    },
    cutTriggerInstruments: ['acoustic-guitar', 'fiddle', 'steel-guitar', 'drums', 'banjo'],
    transitionWeights: { cut: 0.4, crossfade: 0.3, fade: 0.25, zoom: 0.05 },
    energyMultiplier: 0.85,
    styleDescription: 'Heartland visuals, pickup trucks, open roads, authentic emotion, sunset shots'
  }
};

// ========== FUNCIONES DE UTILIDAD ==========

/**
 * Detecta el género y retorna el perfil de edición apropiado
 * Busca en género detectado, aliases, y mood como fallback
 */
export function getEditingProfile(genre: string, mood: string[] = []): GenreEditingProfile {
  const normalizedGenre = genre.toLowerCase().trim();
  
  // 1. Buscar coincidencia exacta por key
  if (GENRE_PROFILES[normalizedGenre]) {
    logger.log(`[GenreProfile] ✅ Match exacto: ${normalizedGenre}`);
    return GENRE_PROFILES[normalizedGenre];
  }
  
  // 2. Buscar en aliases de cada perfil
  for (const [key, profile] of Object.entries(GENRE_PROFILES)) {
    if (profile.aliases.some(alias => 
      normalizedGenre.includes(alias) || alias.includes(normalizedGenre)
    )) {
      logger.log(`[GenreProfile] ✅ Match por alias: ${normalizedGenre} → ${key}`);
      return profile;
    }
  }
  
  // 3. Inferir por mood/keywords
  const moodLower = mood.map(m => m.toLowerCase());
  
  if (moodLower.some(m => ['romantic', 'sad', 'emotional', 'slow', 'melancholic', 'heartbreak'].includes(m))) {
    logger.log(`[GenreProfile] ✅ Match por mood (balada): ${mood.join(', ')}`);
    return GENRE_PROFILES['balada'];
  }
  
  if (moodLower.some(m => ['energetic', 'party', 'hype', 'club', 'dance', 'rave'].includes(m))) {
    logger.log(`[GenreProfile] ✅ Match por mood (edm): ${mood.join(', ')}`);
    return GENRE_PROFILES['edm'];
  }
  
  if (moodLower.some(m => ['aggressive', 'angry', 'intense', 'heavy', 'loud'].includes(m))) {
    logger.log(`[GenreProfile] ✅ Match por mood (rock): ${mood.join(', ')}`);
    return GENRE_PROFILES['rock'];
  }
  
  if (moodLower.some(m => ['sensual', 'smooth', 'sexy', 'intimate', 'sultry'].includes(m))) {
    logger.log(`[GenreProfile] ✅ Match por mood (rnb): ${mood.join(', ')}`);
    return GENRE_PROFILES['rnb'];
  }
  
  // 4. Default a pop (más versátil)
  logger.log(`[GenreProfile] ⚠️ Sin match, usando default: pop`);
  return GENRE_PROFILES['pop'];
}

/**
 * Lista todos los géneros disponibles
 */
export function getAvailableGenres(): string[] {
  return Object.keys(GENRE_PROFILES);
}

/**
 * Obtiene descripción del estilo de un género
 */
export function getGenreStyleDescription(genre: string): string {
  const profile = getEditingProfile(genre, []);
  return profile.styleDescription;
}

/**
 * Calcula la duración recomendada de escena para una sección
 * basada en el perfil de género y BPM
 */
export function getRecommendedSceneDuration(
  genre: string,
  section: string,
  bpm: number,
  mood: string[] = []
): { beats: number; milliseconds: number } {
  const profile = getEditingProfile(genre, mood);
  const sectionKey = mapSectionToCutRuleKey(section);
  const cutRule = profile.cutRules[sectionKey] || profile.cutRules.verse;
  
  const beatDuration = 60000 / bpm; // ms por beat
  const beats = cutRule.beatsPerCut * profile.energyMultiplier;
  
  return {
    beats: Math.round(beats * 10) / 10, // 1 decimal
    milliseconds: Math.round(beats * beatDuration)
  };
}

/**
 * Mapea nombre de sección a key de cutRules
 */
function mapSectionToCutRuleKey(section: string): keyof GenreEditingProfile['cutRules'] {
  const mapping: Record<string, keyof GenreEditingProfile['cutRules']> = {
    'intro': 'intro',
    'verse': 'verse',
    'pre-chorus': 'preChorus',
    'prechorus': 'preChorus',
    'chorus': 'chorus',
    'hook': 'chorus',
    'bridge': 'bridge',
    'breakdown': 'drop',
    'drop': 'drop',
    'build': 'preChorus',
    'buildup': 'preChorus',
    'solo': 'bridge',
    'instrumental': 'verse',
    'outro': 'outro'
  };
  return mapping[section.toLowerCase()] || 'verse';
}

export { mapSectionToCutRuleKey };
