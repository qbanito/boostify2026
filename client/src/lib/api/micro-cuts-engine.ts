/**
 * MicroCuts Engine - Sistema Profesional de Microcortes para Kling Video
 * 
 * Genera instrucciones de movimiento y efecto que se inyectan directamente
 * en el prompt de Kling (image-to-video) para crear microcortes cinematográficos.
 * 
 * Los efectos se generan EN el video, no en post-producción.
 * Kling recibe el prompt enriquecido y produce el video con el efecto incorporado.
 */

import { logger } from "../logger";

// ============================================================
// TIPOS
// ============================================================

export type MicroCutEffect = 
  | 'zoom-punch'        // Zoom rápido al beat (105-115%)
  | 'speed-ramp'        // Slow-mo → velocidad normal
  | 'whip-pan'          // Paneo rápido horizontal/vertical
  | 'dolly-zoom'        // Efecto Vertigo/Hitchcock
  | 'shake'             // Sacudida de cámara en hits
  | 'flash-white'       // Flash blanco en transición  
  | 'stutter'           // Repetición staccato de movimiento
  | 'slow-reveal'       // Revelación lenta cinematográfica
  | 'orbit'             // Órbita rápida alrededor del sujeto
  | 'rack-focus'        // Cambio de foco dramático
  | 'dutch-tilt'        // Inclinación holandesa dinámica
  | 'push-in'           // Push-in dramático al rostro
  | 'pull-out'          // Pull-out revelador
  | 'breathing'         // Movimiento sutil como respiración
  | 'none';             // Sin efecto especial

export type SectionEnergy = 'low' | 'medium' | 'high' | 'explosive';
export type MusicSection = 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'outro' | 'drop' | 'build';
export type ShotCategory = 'PERFORMANCE' | 'B-ROLL' | 'STORY';
export type EditIntensity = 'subtle' | 'medium' | 'aggressive' | 'extreme';

export interface MicroCutConfig {
  enabled: boolean;
  intensity: EditIntensity;
  beatSync: boolean;               // Sincronizar con beats detectados
  respectNarrative: boolean;       // No aplicar en momentos emocionales lentos
  allowedEffects: MicroCutEffect[];
  bpm: number;
  genre?: string;                  // Género musical para adaptar estilo
  variety?: number;                // 0-1: cuánta variación/aleatoriedad en la selección (originalidad)
  seed?: number;                   // Semilla determinista; cámbiala para "rerollear" combinaciones
}

export interface ClipContext {
  id: number | string;
  shotCategory: ShotCategory;
  musicSection: MusicSection;
  energy: SectionEnergy;
  duration: number;                // Segundos del clip
  isKeyMoment: boolean;            // Drop, climax, etc.
  shotType?: string;               // ECU, CU, MS, WS, etc.
  cameraMovement?: string;         // Pan, tilt, dolly, etc. (base del JSON)
  emotion?: string;                // Mood de la escena
  beatTimestamps?: number[];       // Timestamps de beats dentro del clip
  isFirstClip?: boolean;
  isLastClip?: boolean;
  adjacentCategory?: ShotCategory; // Categoría del clip siguiente
  lyricsSegment?: string;
}

export interface MicroCutInstruction {
  effect: MicroCutEffect;
  klingPromptSuffix: string;       // Se agrega al prompt de Kling
  motionDescription: string;       // Descripción legible del efecto
  intensityMultiplier: number;     // 0.3 - 1.0
  priority: number;                // 1-10 (para ordenar/seleccionar)
  timingNote: string;              // Cuándo aplicar dentro del clip
  category: 'camera' | 'speed' | 'transition' | 'effect';
}

export interface MicroCutPlan {
  clipId: number | string;
  basePrompt: string;
  enhancedPrompt: string;          // Prompt final con instrucciones de microcorte
  effects: MicroCutInstruction[];
  totalEffects: number;
  editStyle: string;               // Descripción del estilo de edición
}

// ============================================================
// CATÁLOGO DE EFECTOS PARA KLING
// ============================================================

/**
 * Cada efecto tiene instrucciones específicas para el prompt de Kling.
 * Kling interpreta estas descripciones de movimiento de cámara y las ejecuta.
 */
const KLING_EFFECT_CATALOG: Record<MicroCutEffect, {
  promptTemplate: string;
  categories: ShotCategory[];       // En qué categorías se puede usar
  sections: MusicSection[];         // En qué secciones musicales
  minEnergy: SectionEnergy;         // Energía mínima requerida
  intensityVariants: Record<EditIntensity, string>;
  timingNote: string;
  priority: number;
  category: 'camera' | 'speed' | 'transition' | 'effect';
}> = {
  'zoom-punch': {
    promptTemplate: 'sudden quick zoom punch toward the subject, {intensity} snap zoom in then back out, creating rhythmic impact',
    categories: ['PERFORMANCE', 'B-ROLL'],
    sections: ['chorus', 'drop', 'pre-chorus', 'verse'],
    minEnergy: 'medium',
    intensityVariants: {
      subtle: 'subtle gentle zoom pulse, barely noticeable 3% zoom in-out',
      medium: 'noticeable quick zoom punch, 8% snap zoom creating beat emphasis',
      aggressive: 'strong impactful zoom punch, 12% dramatic snap zoom with energy',
      extreme: 'explosive zoom smash, 15% violent snap zoom with maximum impact',
    },
    timingNote: 'On strong beat hits',
    priority: 9,
    category: 'camera',
  },

  'speed-ramp': {
    promptTemplate: 'cinematic speed ramp effect, {intensity} slow motion transitioning to normal speed, creating dramatic tension',
    categories: ['PERFORMANCE', 'B-ROLL', 'STORY'],
    sections: ['pre-chorus', 'chorus', 'bridge', 'drop', 'build'],
    minEnergy: 'low',
    intensityVariants: {
      subtle: 'gentle slow motion easing into natural movement, fluid and graceful',
      medium: 'visible slow motion building to normal speed, creating anticipation',
      aggressive: 'dramatic time manipulation, very slow then snapping to fast, powerful contrast',
      extreme: 'extreme time warp, frozen moment then explosive acceleration',
    },
    timingNote: 'Before drops or key moments',
    priority: 8,
    category: 'speed',
  },

  'whip-pan': {
    promptTemplate: 'fast whip pan {intensity}, rapid horizontal camera sweep with motion blur, energetic and dynamic',
    categories: ['PERFORMANCE', 'B-ROLL'],
    sections: ['chorus', 'drop', 'pre-chorus'],
    minEnergy: 'high',
    intensityVariants: {
      subtle: 'gentle lateral drift with soft motion blur',
      medium: 'quick whip pan with visible motion blur, snappy horizontal sweep',
      aggressive: 'fast aggressive whip pan, streaking motion blur, violent horizontal sweep',
      extreme: 'lightning-fast whip pan, extreme motion blur creating disorienting energy',
    },
    timingNote: 'On transitions between phrases',
    priority: 7,
    category: 'camera',
  },

  'dolly-zoom': {
    promptTemplate: 'vertigo dolly zoom effect, {intensity} simultaneous zoom in while pulling back creating disorienting perspective shift',
    categories: ['PERFORMANCE', 'STORY'],
    sections: ['bridge', 'chorus', 'drop'],
    minEnergy: 'medium',
    intensityVariants: {
      subtle: 'subtle background shift while subject stays centered, dreamy vertigo',
      medium: 'visible dolly zoom creating tension, background warping noticeably',
      aggressive: 'strong vertigo effect, dramatic perspective manipulation',
      extreme: 'extreme dolly zoom, reality-bending perspective distortion',
    },
    timingNote: 'On emotional pivots or key lyrics',
    priority: 6,
    category: 'camera',
  },

  'shake': {
    promptTemplate: 'camera shake effect, {intensity} handheld vibration creating raw authentic energy',
    categories: ['PERFORMANCE'],
    sections: ['chorus', 'drop', 'verse'],
    minEnergy: 'high',
    intensityVariants: {
      subtle: 'very subtle micro-vibration, barely perceptible handheld wobble',
      medium: 'noticeable handheld shake, authentic concert footage feel',
      aggressive: 'strong camera shake, aggressive vibration on beat impacts',
      extreme: 'violent earthquake shake, chaotic raw energy, mosh pit intensity',
    },
    timingNote: 'During high-energy performance',
    priority: 7,
    category: 'camera',
  },

  'flash-white': {
    promptTemplate: 'brief white flash effect, {intensity} flash of bright white light creating transition punch',
    categories: ['PERFORMANCE', 'B-ROLL'],
    sections: ['chorus', 'drop', 'pre-chorus'],
    minEnergy: 'medium',
    intensityVariants: {
      subtle: 'very brief soft white glow, gentle luminance pulse',
      medium: 'quick white flash, bright momentary overexposure on beat',
      aggressive: 'strong strobe-like white flash, impactful brightness burst',
      extreme: 'blinding white flash, paparazzi-style overexposure burst',
    },
    timingNote: 'On beat drops and transitions',
    priority: 8,
    category: 'effect',
  },

  'stutter': {
    promptTemplate: 'staccato stutter motion, {intensity} quick repetitive micro-movements creating rhythmic visual stuttering effect',
    categories: ['PERFORMANCE'],
    sections: ['chorus', 'drop', 'build'],
    minEnergy: 'high',
    intensityVariants: {
      subtle: 'very subtle motion hesitation, gentle rhythmic stutter',
      medium: 'visible staccato motion, rhythmic stop-start creating pulse',
      aggressive: 'strong stuttering motion, aggressive rapid-fire visual rhythm',
      extreme: 'extreme glitch-like stutter, violent stop-motion-like effect',
    },
    timingNote: 'During builds and high-energy sections',
    priority: 6,
    category: 'speed',
  },

  'slow-reveal': {
    promptTemplate: 'cinematic slow reveal, {intensity} gradual emergence into frame with building tension',
    categories: ['PERFORMANCE', 'STORY', 'B-ROLL'],
    sections: ['intro', 'verse', 'bridge', 'outro'],
    minEnergy: 'low',
    intensityVariants: {
      subtle: 'very gentle, almost imperceptible slow drift into composition',
      medium: 'smooth cinematic reveal, subject gradually coming into prominence',
      aggressive: 'dramatic reveal with building intensity, purposeful emerging',
      extreme: 'epic reveal, smoke-clearing emergence, grand entrance',
    },
    timingNote: 'Opening of sections and verse beginnings',
    priority: 5,
    category: 'camera',
  },

  'orbit': {
    promptTemplate: 'orbiting camera movement, {intensity} circular motion around the subject creating dynamic perspective',
    categories: ['PERFORMANCE', 'B-ROLL'],
    sections: ['chorus', 'bridge', 'outro'],
    minEnergy: 'medium',
    intensityVariants: {
      subtle: 'very slow gentle arc, slight orbital drift',
      medium: 'smooth 30-degree orbit around subject, cinematic circular tracking',
      aggressive: 'fast 90-degree orbit, dramatic circular motion around performer',
      extreme: 'rapid 180-degree orbit, whirlwind spinning camera motion',
    },
    timingNote: 'Extended musical phrases',
    priority: 5,
    category: 'camera',
  },

  'rack-focus': {
    promptTemplate: 'rack focus shift, {intensity} dramatic depth of field change creating visual emphasis transition',
    categories: ['PERFORMANCE', 'STORY'],
    sections: ['verse', 'bridge', 'pre-chorus'],
    minEnergy: 'low',
    intensityVariants: {
      subtle: 'gentle soft focus breathing, shallow depth of field shift',
      medium: 'clear rack focus from background to subject, cinematic bokeh shift',
      aggressive: 'dramatic sharp rack focus, extreme bokeh to tack-sharp snap',
      extreme: 'violent rack focus with anamorphic lens blur characteristics',
    },
    timingNote: 'On lyric emphasis and emotional beats',
    priority: 6,
    category: 'camera',
  },

  'dutch-tilt': {
    promptTemplate: 'dutch angle tilt, {intensity} camera rotation creating dynamic off-kilter composition',
    categories: ['PERFORMANCE', 'B-ROLL'],
    sections: ['chorus', 'bridge', 'drop'],
    minEnergy: 'medium',
    intensityVariants: {
      subtle: 'very slight 3-degree tilt, barely noticeable angular shift',
      medium: 'visible 10-degree dutch tilt, stylized angular composition',
      aggressive: 'strong 20-degree dutch angle, dramatic disorienting tilt',
      extreme: 'extreme 35-degree dutch tilt, vertigo-inducing angular distortion',
    },
    timingNote: 'During intensity shifts',
    priority: 4,
    category: 'camera',
  },

  'push-in': {
    promptTemplate: 'dramatic push-in, {intensity} forward dolly movement toward subject creating intimacy and intensity',
    categories: ['PERFORMANCE', 'STORY'],
    sections: ['verse', 'pre-chorus', 'chorus', 'bridge'],
    minEnergy: 'low',
    intensityVariants: {
      subtle: 'very slow gentle push-in, almost imperceptible forward drift',
      medium: 'smooth cinematic push-in, building connection with subject',
      aggressive: 'fast determined push-in, aggressive approach to subject face',
      extreme: 'explosive push-in, rushing toward subject with dramatic urgency',
    },
    timingNote: 'Building toward emotional climax',
    priority: 8,
    category: 'camera',
  },

  'pull-out': {
    promptTemplate: 'cinematic pull-out, {intensity} backward dolly movement revealing wider scene context',
    categories: ['B-ROLL', 'STORY', 'PERFORMANCE'],
    sections: ['outro', 'bridge', 'intro'],
    minEnergy: 'low',
    intensityVariants: {
      subtle: 'gentle slow pull-back, gradual widening of frame',
      medium: 'smooth cinematic pull-out, revealing environment around subject',
      aggressive: 'fast dramatic pull-out, rapid context revelation',
      extreme: 'explosive pull-out, dramatic scale-revealing crane-like movement',
    },
    timingNote: 'End of sections, revealing moments',
    priority: 5,
    category: 'camera',
  },

  'breathing': {
    promptTemplate: 'organic breathing camera motion, {intensity} rhythmic subtle movement mimicking natural breathing rhythm',
    categories: ['PERFORMANCE', 'B-ROLL', 'STORY'],
    sections: ['verse', 'intro', 'bridge', 'outro'],
    minEnergy: 'low',
    intensityVariants: {
      subtle: 'very gentle micro-movement, organic living camera feel',
      medium: 'visible rhythmic camera breathing, natural pulsing motion',
      aggressive: 'strong rhythmic pulsing, pronounced breathing movement',
      extreme: 'exaggerated chest-like heaving motion, dramatic living camera',
    },
    timingNote: 'Calm moments, emotional verses',
    priority: 3,
    category: 'camera',
  },

  'none': {
    promptTemplate: '',
    categories: ['PERFORMANCE', 'B-ROLL', 'STORY'],
    sections: ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'outro', 'drop', 'build'],
    minEnergy: 'low',
    intensityVariants: {
      subtle: '',
      medium: '',
      aggressive: '',
      extreme: '',
    },
    timingNote: 'No effect applied',
    priority: 0,
    category: 'camera',
  },
};

// ============================================================
// REGLAS DE EDICIÓN POR GÉNERO MUSICAL
// ============================================================

const GENRE_EDIT_RULES: Record<string, {
  preferredEffects: MicroCutEffect[];
  defaultIntensity: EditIntensity;
  beatSyncStrength: number;         // 0-1 cuánto respetar beats
  averageCutsPerMinute: number;
  emotionalSections: MusicSection[]; // Secciones donde ser más sutil
}> = {
  'hip-hop': {
    preferredEffects: ['zoom-punch', 'shake', 'flash-white', 'stutter', 'whip-pan'],
    defaultIntensity: 'aggressive',
    beatSyncStrength: 0.9,
    averageCutsPerMinute: 25,
    emotionalSections: ['bridge'],
  },
  'trap': {
    preferredEffects: ['zoom-punch', 'stutter', 'flash-white', 'shake', 'dutch-tilt'],
    defaultIntensity: 'extreme',
    beatSyncStrength: 0.95,
    averageCutsPerMinute: 30,
    emotionalSections: [],
  },
  'pop': {
    preferredEffects: ['push-in', 'speed-ramp', 'flash-white', 'orbit', 'zoom-punch'],
    defaultIntensity: 'medium',
    beatSyncStrength: 0.7,
    averageCutsPerMinute: 18,
    emotionalSections: ['verse', 'bridge'],
  },
  'r&b': {
    preferredEffects: ['slow-reveal', 'breathing', 'rack-focus', 'push-in', 'speed-ramp'],
    defaultIntensity: 'subtle',
    beatSyncStrength: 0.5,
    averageCutsPerMinute: 12,
    emotionalSections: ['verse', 'bridge', 'outro'],
  },
  'rock': {
    preferredEffects: ['shake', 'whip-pan', 'zoom-punch', 'flash-white', 'dutch-tilt'],
    defaultIntensity: 'aggressive',
    beatSyncStrength: 0.85,
    averageCutsPerMinute: 22,
    emotionalSections: ['bridge'],
  },
  'reggaeton': {
    preferredEffects: ['zoom-punch', 'whip-pan', 'orbit', 'speed-ramp', 'shake'],
    defaultIntensity: 'aggressive',
    beatSyncStrength: 0.9,
    averageCutsPerMinute: 20,
    emotionalSections: ['bridge'],
  },
  'latin': {
    preferredEffects: ['orbit', 'push-in', 'speed-ramp', 'zoom-punch', 'whip-pan'],
    defaultIntensity: 'medium',
    beatSyncStrength: 0.75,
    averageCutsPerMinute: 18,
    emotionalSections: ['verse', 'bridge'],
  },
  'electronic': {
    preferredEffects: ['stutter', 'flash-white', 'zoom-punch', 'dolly-zoom', 'whip-pan'],
    defaultIntensity: 'extreme',
    beatSyncStrength: 0.95,
    averageCutsPerMinute: 28,
    emotionalSections: [],
  },
  'ballad': {
    preferredEffects: ['breathing', 'slow-reveal', 'push-in', 'rack-focus', 'pull-out'],
    defaultIntensity: 'subtle',
    beatSyncStrength: 0.3,
    averageCutsPerMinute: 8,
    emotionalSections: ['verse', 'chorus', 'bridge', 'outro'],
  },
  'default': {
    preferredEffects: ['zoom-punch', 'push-in', 'speed-ramp', 'flash-white', 'breathing'],
    defaultIntensity: 'medium',
    beatSyncStrength: 0.7,
    averageCutsPerMinute: 15,
    emotionalSections: ['bridge'],
  },
};

// ============================================================
// ENERGY MAP
// ============================================================

const ENERGY_LEVELS: Record<SectionEnergy, number> = {
  low: 1,
  medium: 2,
  high: 3,
  explosive: 4,
};

const MIN_ENERGY_FOR_EFFECT: Record<SectionEnergy, number> = {
  low: 1,
  medium: 2,
  high: 3,
  explosive: 4,
};

// ============================================================
// MOTOR PRINCIPAL
// ============================================================

/**
 * Genera el plan de microcortes para un clip específico.
 * Retorna el prompt enriquecido que se enviará a Kling.
 */
export function generateMicroCutPlan(
  clip: ClipContext,
  basePrompt: string,
  config: MicroCutConfig
): MicroCutPlan {
  if (!config.enabled) {
    return {
      clipId: clip.id,
      basePrompt,
      enhancedPrompt: basePrompt,
      effects: [],
      totalEffects: 0,
      editStyle: 'none',
    };
  }

  const genreRules = GENRE_EDIT_RULES[config.genre || 'default'] || GENRE_EDIT_RULES['default'];
  const clipEnergy = ENERGY_LEVELS[clip.energy];

  // 1. Seleccionar efectos candidatos
  const candidates = selectCandidateEffects(clip, config, genreRules);

  // 2. Filtrar por energía y sección
  const filtered = filterByContext(candidates, clip, config, genreRules);

  // 3. Limitar cantidad según intensidad
  const maxEffects = getMaxEffectsForIntensity(config.intensity);
  const selected = filtered.slice(0, maxEffects);

  // 4. Construir instrucciones de Kling
  const instructions = selected.map(effect => 
    buildKlingInstruction(effect, clip, config)
  );

  // 5. Construir prompt enriquecido
  const enhancedPrompt = buildEnhancedPrompt(basePrompt, instructions, clip, config);

  logger.info(
    `🎬 [MICROCUTS] Clip ${clip.id} (${clip.shotCategory}/${clip.musicSection}): ` +
    `${instructions.length} effects → [${instructions.map(i => i.effect).join(', ')}]`
  );

  return {
    clipId: clip.id,
    basePrompt,
    enhancedPrompt,
    effects: instructions,
    totalEffects: instructions.length,
    editStyle: describeEditStyle(instructions, config),
  };
}

/**
 * Genera planes de microcortes para TODOS los clips del timeline.
 * Asegura coherencia narrativa entre clips.
 */
export function generateTimelineMicroCuts(
  clips: ClipContext[],
  basePrompts: Map<number | string, string>,
  config: MicroCutConfig
): Map<number | string, MicroCutPlan> {
  const plans = new Map<number | string, MicroCutPlan>();

  if (!config.enabled) {
    clips.forEach(clip => {
      plans.set(clip.id, {
        clipId: clip.id,
        basePrompt: basePrompts.get(clip.id) || '',
        enhancedPrompt: basePrompts.get(clip.id) || '',
        effects: [],
        totalEffects: 0,
        editStyle: 'none',
      });
    });
    return plans;
  }

  // Analizar arco narrativo
  const narrativeArc = analyzeNarrativeArc(clips);

  clips.forEach((clip, index) => {
    // Enriquecer contexto con información de clips adyacentes
    const enrichedClip: ClipContext = {
      ...clip,
      isFirstClip: index === 0,
      isLastClip: index === clips.length - 1,
      adjacentCategory: clips[index + 1]?.shotCategory,
    };

    // Ajustar intensidad según posición en arco narrativo
    const adjustedConfig = adjustConfigForNarrative(config, enrichedClip, narrativeArc, index, clips.length);

    const basePrompt = basePrompts.get(clip.id) || '';
    const plan = generateMicroCutPlan(enrichedClip, basePrompt, adjustedConfig);
    plans.set(clip.id, plan);
  });

  logger.info(`🎬 [MICROCUTS] Timeline completo: ${plans.size} clips procesados`);
  return plans;
}

// ============================================================
// FUNCIONES INTERNAS
// ============================================================

function selectCandidateEffects(
  clip: ClipContext,
  config: MicroCutConfig,
  genreRules: typeof GENRE_EDIT_RULES[string]
): MicroCutEffect[] {
  const allEffects = Object.keys(KLING_EFFECT_CATALOG).filter(
    e => e !== 'none'
  ) as MicroCutEffect[];

  // Variedad/originalidad: jitter pseudo-aleatorio determinista por (seed + clip)
  const variety = Math.max(0, Math.min(1, config.variety ?? 0));
  const rng = variety > 0
    ? mulberry32(((config.seed ?? 0) >>> 0) ^ hashId(clip.id))
    : null;

  return allEffects
    .filter(effect => {
      const catalog = KLING_EFFECT_CATALOG[effect];

      // Filtrar por categoría de shot
      if (!catalog.categories.includes(clip.shotCategory)) return false;

      // Filtrar por sección musical
      if (!catalog.sections.includes(clip.musicSection)) return false;

      // Filtrar por energía mínima
      if (ENERGY_LEVELS[clip.energy] < MIN_ENERGY_FOR_EFFECT[catalog.minEnergy]) return false;

      // Filtrar por efectos permitidos en config
      if (config.allowedEffects.length > 0 && !config.allowedEffects.includes(effect)) return false;

      return true;
    })
    .sort((a, b) => {
      const aPriority = KLING_EFFECT_CATALOG[a].priority;
      const bPriority = KLING_EFFECT_CATALOG[b].priority;
      
      // Bonus si el efecto es preferido por el género
      const aGenreBonus = genreRules.preferredEffects.includes(a) ? 3 : 0;
      const bGenreBonus = genreRules.preferredEffects.includes(b) ? 3 : 0;

      // Jitter de variedad: hasta ±6 puntos de score → reordena los candidatos
      // de prioridad similar, dando combinaciones frescas en cada reroll.
      const aJitter = rng ? (rng() - 0.5) * 12 * variety : 0;
      const bJitter = rng ? (rng() - 0.5) * 12 * variety : 0;

      return (bPriority + bGenreBonus + bJitter) - (aPriority + aGenreBonus + aJitter);
    });
}

function filterByContext(
  candidates: MicroCutEffect[],
  clip: ClipContext,
  config: MicroCutConfig,
  genreRules: typeof GENRE_EDIT_RULES[string]
): MicroCutEffect[] {
  let filtered = [...candidates];

  // En secciones emocionales, reducir a efectos suaves
  if (config.respectNarrative && genreRules.emotionalSections.includes(clip.musicSection)) {
    const gentleEffects: MicroCutEffect[] = ['breathing', 'slow-reveal', 'push-in', 'rack-focus', 'pull-out'];
    filtered = filtered.filter(e => gentleEffects.includes(e));
  }

  // Key moments → priorizar efectos de alto impacto
  if (clip.isKeyMoment) {
    const impactEffects: MicroCutEffect[] = ['zoom-punch', 'flash-white', 'shake', 'stutter', 'whip-pan', 'dolly-zoom'];
    const impactFirst = filtered.filter(e => impactEffects.includes(e));
    const rest = filtered.filter(e => !impactEffects.includes(e));
    filtered = [...impactFirst, ...rest];
  }

  // Primer clip → slow reveal o breathing
  if (clip.isFirstClip) {
    const openerEffects: MicroCutEffect[] = ['slow-reveal', 'breathing', 'push-in'];
    const openerFirst = filtered.filter(e => openerEffects.includes(e));
    if (openerFirst.length > 0) {
      filtered = openerFirst;
    }
  }

  // Último clip → pull-out o breathing
  if (clip.isLastClip) {
    const closerEffects: MicroCutEffect[] = ['pull-out', 'breathing', 'slow-reveal'];
    const closerFirst = filtered.filter(e => closerEffects.includes(e));
    if (closerFirst.length > 0) {
      filtered = closerFirst;
    }
  }

  // Evitar repetir el mismo efecto del movimiento base del clip
  if (clip.cameraMovement) {
    const baseMovement = clip.cameraMovement.toLowerCase();
    if (baseMovement.includes('pan')) filtered = filtered.filter(e => e !== 'whip-pan');
    if (baseMovement.includes('push') || baseMovement.includes('dolly')) filtered = filtered.filter(e => e !== 'push-in' && e !== 'dolly-zoom');
    if (baseMovement.includes('orbit') || baseMovement.includes('arc')) filtered = filtered.filter(e => e !== 'orbit');
    if (baseMovement.includes('tilt')) filtered = filtered.filter(e => e !== 'dutch-tilt');
  }

  return filtered;
}

function getMaxEffectsForIntensity(intensity: EditIntensity): number {
  switch (intensity) {
    case 'subtle': return 1;
    case 'medium': return 2;
    case 'aggressive': return 3;
    case 'extreme': return 4;
  }
}

function buildKlingInstruction(
  effect: MicroCutEffect,
  clip: ClipContext,
  config: MicroCutConfig
): MicroCutInstruction {
  const catalog = KLING_EFFECT_CATALOG[effect];
  const intensityText = catalog.intensityVariants[config.intensity];
  const promptSuffix = catalog.promptTemplate.replace('{intensity}', intensityText);

  return {
    effect,
    klingPromptSuffix: promptSuffix,
    motionDescription: intensityText,
    intensityMultiplier: getIntensityMultiplier(config.intensity),
    priority: catalog.priority,
    timingNote: catalog.timingNote,
    category: catalog.category,
  };
}

function getIntensityMultiplier(intensity: EditIntensity): number {
  switch (intensity) {
    case 'subtle': return 0.3;
    case 'medium': return 0.6;
    case 'aggressive': return 0.8;
    case 'extreme': return 1.0;
  }
}

function buildEnhancedPrompt(
  basePrompt: string,
  instructions: MicroCutInstruction[],
  clip: ClipContext,
  config: MicroCutConfig
): string {
  if (instructions.length === 0) return basePrompt;

  // Construir las partes del prompt
  const parts: string[] = [basePrompt];

  // Agregar instrucciones de microcorte
  const cameraEffects = instructions.filter(i => i.category === 'camera');
  const speedEffects = instructions.filter(i => i.category === 'speed');
  const transitionEffects = instructions.filter(i => i.category === 'transition');
  const visualEffects = instructions.filter(i => i.category === 'effect');

  if (cameraEffects.length > 0) {
    parts.push(cameraEffects.map(e => e.klingPromptSuffix).join(', '));
  }

  if (speedEffects.length > 0) {
    parts.push(speedEffects.map(e => e.klingPromptSuffix).join(', '));
  }

  if (visualEffects.length > 0) {
    parts.push(visualEffects.map(e => e.klingPromptSuffix).join(', '));
  }

  if (transitionEffects.length > 0) {
    parts.push(transitionEffects.map(e => e.klingPromptSuffix).join(', '));
  }

  // Agregar contexto musical
  const musicalContext = buildMusicalContext(clip, config);
  if (musicalContext) {
    parts.push(musicalContext);
  }

  // Quality suffix siempre al final
  parts.push('professional music video cinematography, cinematic quality, 24fps film look');

  return parts.join('. ');
}

function buildMusicalContext(clip: ClipContext, config: MicroCutConfig): string {
  const contextParts: string[] = [];

  // BPM-aware timing
  if (config.beatSync && config.bpm > 0) {
    const beatInterval = 60 / config.bpm;
    if (config.bpm > 140) {
      contextParts.push('fast rhythmic energy matching rapid beat tempo');
    } else if (config.bpm > 100) {
      contextParts.push('dynamic movement synchronized with medium tempo beat');
    } else {
      contextParts.push('smooth flowing motion matching slow groove tempo');
    }
  }

  // Section-specific mood
  switch (clip.musicSection) {
    case 'intro':
      contextParts.push('atmospheric opening, building anticipation');
      break;
    case 'verse':
      contextParts.push('storytelling visual flow, maintaining viewer attention');
      break;
    case 'pre-chorus':
      contextParts.push('rising tension, building toward climax');
      break;
    case 'chorus':
      contextParts.push('peak energy, maximum visual impact');
      break;
    case 'bridge':
      contextParts.push('emotional shift, contemplative moment');
      break;
    case 'drop':
      contextParts.push('explosive release of energy, maximum intensity');
      break;
    case 'build':
      contextParts.push('escalating tension, accelerating energy');
      break;
    case 'outro':
      contextParts.push('resolution, fading energy, closing mood');
      break;
  }

  // Emotion context
  if (clip.emotion) {
    contextParts.push(`${clip.emotion} emotional atmosphere`);
  }

  return contextParts.join(', ');
}

function analyzeNarrativeArc(clips: ClipContext[]): {
  peakIndex: number;
  buildPhase: [number, number];
  releasePhase: [number, number];
} {
  // Encontrar el clip de máxima energía
  let peakIndex = 0;
  let maxEnergy = 0;
  
  clips.forEach((clip, i) => {
    const energy = ENERGY_LEVELS[clip.energy];
    if (energy > maxEnergy || (energy === maxEnergy && clip.isKeyMoment)) {
      maxEnergy = energy;
      peakIndex = i;
    }
  });

  return {
    peakIndex,
    buildPhase: [0, peakIndex],
    releasePhase: [peakIndex, clips.length - 1],
  };
}

function adjustConfigForNarrative(
  config: MicroCutConfig,
  clip: ClipContext,
  arc: ReturnType<typeof analyzeNarrativeArc>,
  index: number,
  totalClips: number
): MicroCutConfig {
  const adjusted = { ...config };

  // Posición en el arco narrativo (0-1)
  const position = index / totalClips;

  // Build phase → incrementar gradualmente intensidad
  if (index < arc.peakIndex) {
    const buildProgress = index / arc.peakIndex; // 0 → 1
    if (buildProgress < 0.3 && adjusted.intensity === 'extreme') {
      adjusted.intensity = 'medium';
    } else if (buildProgress < 0.5 && adjusted.intensity === 'extreme') {
      adjusted.intensity = 'aggressive';
    }
  }

  // Peak → máxima intensidad
  if (index === arc.peakIndex) {
    // Mantener o subir intensidad
    if (adjusted.intensity === 'subtle') adjusted.intensity = 'medium';
  }

  // Release phase → decrementar gradualmente
  if (index > arc.peakIndex) {
    const releaseProgress = (index - arc.peakIndex) / (totalClips - arc.peakIndex);
    if (releaseProgress > 0.7) {
      adjusted.intensity = 'subtle';
    } else if (releaseProgress > 0.4 && adjusted.intensity === 'extreme') {
      adjusted.intensity = 'aggressive';
    }
  }

  return adjusted;
}

function describeEditStyle(instructions: MicroCutInstruction[], config: MicroCutConfig): string {
  if (instructions.length === 0) return 'clean';
  
  const effects = instructions.map(i => i.effect);
  
  if (effects.includes('stutter') || effects.includes('flash-white')) return 'high-energy editorial';
  if (effects.includes('breathing') || effects.includes('slow-reveal')) return 'cinematic smooth';
  if (effects.includes('zoom-punch') || effects.includes('shake')) return 'dynamic impact';
  if (effects.includes('dolly-zoom') || effects.includes('rack-focus')) return 'dramatic narrative';
  
  return `${config.intensity} editorial`;
}

// ============================================================
// DEFAULT CONFIG
// ============================================================

export function getDefaultMicroCutConfig(genre?: string, bpm?: number): MicroCutConfig {
  const genreRules = GENRE_EDIT_RULES[genre || 'default'] || GENRE_EDIT_RULES['default'];
  
  return {
    enabled: true,
    intensity: genreRules.defaultIntensity,
    beatSync: true,
    respectNarrative: true,
    allowedEffects: genreRules.preferredEffects,
    bpm: bpm || 120,
    genre: genre || 'default',
    variety: 0.4,
    seed: Math.floor(Math.random() * 1_000_000),
  };
}

/**
 * Lista de todos los efectos disponibles con descripciones
 */
export function getAvailableEffects(): Array<{
  id: MicroCutEffect;
  name: string;
  description: string;
  category: string;
}> {
  return (Object.entries(KLING_EFFECT_CATALOG) as [MicroCutEffect, typeof KLING_EFFECT_CATALOG[MicroCutEffect]][])
    .filter(([id]) => id !== 'none')
    .map(([id, catalog]) => ({
      id,
      name: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: catalog.timingNote,
      category: catalog.category,
    }));
}

/**
 * Detectar la energía de una sección musical
 */
export function detectSectionEnergy(section: string): SectionEnergy {
  const s = section.toLowerCase();
  if (s.includes('drop') || s.includes('climax')) return 'explosive';
  if (s.includes('chorus') || s.includes('hook')) return 'high';
  if (s.includes('pre-chorus') || s.includes('build')) return 'medium';
  if (s.includes('verse') || s.includes('intro')) return 'low';
  if (s.includes('bridge')) return 'medium';
  if (s.includes('outro')) return 'low';
  return 'medium';
}

/**
 * Mapear sección del JSON maestro a MusicSection
 */
export function mapToMusicSection(section: string): MusicSection {
  const s = section.toLowerCase();
  if (s.includes('intro')) return 'intro';
  if (s.includes('pre-chorus') || s.includes('prechorus')) return 'pre-chorus';
  if (s.includes('chorus') || s.includes('hook')) return 'chorus';
  if (s.includes('verse')) return 'verse';
  if (s.includes('bridge')) return 'bridge';
  if (s.includes('outro')) return 'outro';
  if (s.includes('drop')) return 'drop';
  if (s.includes('build')) return 'build';
  return 'verse';
}

// ============================================================
// VARIEDAD / ORIGINALIDAD (RNG determinista)
// ============================================================

/** PRNG mulberry32 — determinista, rápido, buena distribución. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash estable de un id (number|string) → uint32 para combinar con la semilla. */
function hashId(id: number | string): number {
  const str = String(id);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Genera una nueva semilla para "rerollear" combinaciones de efectos. */
export function rerollSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

// ============================================================
// PRESETS DE ESTILO (1-clic — el "toque de originalidad")
// ============================================================

export interface MicroCutStylePreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  config: Partial<MicroCutConfig>;
}

export const MICROCUT_STYLE_PRESETS: MicroCutStylePreset[] = [
  {
    id: 'tiktok-viral',
    name: 'TikTok Viral',
    emoji: '📱',
    description: 'Cortes rápidos al beat, zoom punches y flashes — retención máxima',
    config: {
      intensity: 'extreme',
      beatSync: true,
      respectNarrative: false,
      variety: 0.75,
      allowedEffects: ['zoom-punch', 'whip-pan', 'stutter', 'flash-white', 'speed-ramp', 'shake'],
    },
  },
  {
    id: 'cinematic-film',
    name: 'Cinematic Film',
    emoji: '🎬',
    description: 'Movimientos suaves y dramáticos estilo película de autor',
    config: {
      intensity: 'subtle',
      beatSync: false,
      respectNarrative: true,
      variety: 0.3,
      allowedEffects: ['breathing', 'slow-reveal', 'push-in', 'rack-focus', 'dolly-zoom', 'pull-out'],
    },
  },
  {
    id: 'edm-festival',
    name: 'EDM Festival',
    emoji: '🔥',
    description: 'Energía explosiva, stutters y flashes sincronizados al drop',
    config: {
      intensity: 'extreme',
      beatSync: true,
      respectNarrative: false,
      variety: 0.85,
      allowedEffects: ['stutter', 'flash-white', 'zoom-punch', 'dolly-zoom', 'whip-pan', 'shake'],
    },
  },
  {
    id: 'hiphop-hard',
    name: 'Hip-Hop Hard',
    emoji: '🎤',
    description: 'Impacto urbano, shakes y zoom punches con actitud',
    config: {
      intensity: 'aggressive',
      beatSync: true,
      respectNarrative: false,
      variety: 0.6,
      allowedEffects: ['zoom-punch', 'shake', 'whip-pan', 'speed-ramp', 'dutch-tilt', 'stutter'],
    },
  },
  {
    id: 'emotional-ballad',
    name: 'Balada Emotiva',
    emoji: '💔',
    description: 'Respiraciones y revelaciones lentas, respeta la narrativa',
    config: {
      intensity: 'subtle',
      beatSync: false,
      respectNarrative: true,
      variety: 0.2,
      allowedEffects: ['breathing', 'slow-reveal', 'push-in', 'rack-focus', 'pull-out'],
    },
  },
  {
    id: 'dreamy',
    name: 'Dreamy',
    emoji: '🌙',
    description: 'Atmósfera etérea, foco racked y dolly-zoom oníricos',
    config: {
      intensity: 'subtle',
      beatSync: false,
      respectNarrative: true,
      variety: 0.45,
      allowedEffects: ['breathing', 'slow-reveal', 'rack-focus', 'dolly-zoom', 'orbit'],
    },
  },
  {
    id: 'retro-energy',
    name: 'Retro Energy',
    emoji: '📼',
    description: 'Shakes, glitches de inclinación y whip-pans con sabor vintage',
    config: {
      intensity: 'aggressive',
      beatSync: true,
      respectNarrative: false,
      variety: 0.7,
      allowedEffects: ['shake', 'stutter', 'dutch-tilt', 'whip-pan', 'flash-white'],
    },
  },
];

/** Aplica un preset de estilo sobre una config existente (conserva bpm/genre/seed). */
export function applyStylePreset(base: MicroCutConfig, preset: MicroCutStylePreset): MicroCutConfig {
  return {
    ...base,
    ...preset.config,
    enabled: true,
    seed: rerollSeed(),
  };
}

// ============================================================
// CORTES SINCRONIZADOS A BEATS (sincronía real con la música)
// ============================================================

/**
 * Calcula puntos de corte alineados a los beats reales de la canción dentro
 * de un clip. Cuando hay beats disponibles, los microcortes caen sobre la
 * música en lugar de dividir el clip de forma uniforme.
 *
 * @returns segmentos { start, duration } en segundos absolutos del timeline.
 */
export function getBeatSyncedSegments(
  clipStart: number,
  clipDuration: number,
  beats: number[] | undefined,
  targetCuts: number,
  minSegmentDuration = 0.6
): Array<{ start: number; duration: number; onBeat: boolean }> {
  const clipEnd = clipStart + clipDuration;

  // Sin beats o sin objetivo → un solo segmento (el llamador decide).
  if (targetCuts <= 1) {
    return [{ start: clipStart, duration: clipDuration, onBeat: false }];
  }

  // Beats que caen dentro del clip (con margen mínimo de los bordes).
  const inside = (beats || [])
    .filter(b => b > clipStart + minSegmentDuration && b < clipEnd - minSegmentDuration)
    .sort((a, b) => a - b);

  let cutPoints: Array<{ t: number; onBeat: boolean }> = [];

  if (inside.length > 0) {
    // Repartir los beats disponibles de forma pareja para acercarnos a targetCuts.
    const desiredInternalCuts = Math.min(targetCuts - 1, inside.length);
    const step = inside.length / (desiredInternalCuts + 1);
    for (let i = 1; i <= desiredInternalCuts; i++) {
      const beat = inside[Math.min(inside.length - 1, Math.round(i * step) - 1)];
      if (beat !== undefined) cutPoints.push({ t: beat, onBeat: true });
    }
  }

  // Si no hubo beats suficientes, completar con cortes uniformes.
  if (cutPoints.length === 0) {
    const seg = clipDuration / targetCuts;
    for (let i = 1; i < targetCuts; i++) {
      cutPoints.push({ t: clipStart + i * seg, onBeat: false });
    }
  }

  // Deduplicar y respetar la duración mínima.
  cutPoints = cutPoints
    .filter((p, i, arr) => i === 0 || p.t - arr[i - 1].t >= minSegmentDuration)
    .filter(p => p.t - clipStart >= minSegmentDuration && clipEnd - p.t >= minSegmentDuration);

  // Construir segmentos a partir de los puntos de corte.
  const boundaries = [clipStart, ...cutPoints.map(p => p.t), clipEnd];
  const onBeatFlags = [false, ...cutPoints.map(p => p.onBeat)];
  const segments: Array<{ start: number; duration: number; onBeat: boolean }> = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    segments.push({
      start: Math.round(boundaries[i] * 100) / 100,
      duration: Math.round((boundaries[i + 1] - boundaries[i]) * 100) / 100,
      onBeat: onBeatFlags[i],
    });
  }
  return segments;
}
