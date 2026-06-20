/**
 * 🎬 Shot Category Prompt System
 * Sistema de prompts optimizados por categoría de shot y estilo de director
 * Genera prompts cinematográficos específicos para cada tipo de escena
 */

export type ShotCategory = 'PERFORMANCE' | 'B-ROLL' | 'STORY';

export interface ScenePromptParams {
  basePrompt: string;
  shotCategory: ShotCategory;
  shotType: string;
  directorName: string;
  emotion: string;
  lighting?: string;
  colorGrading?: string;
  location?: string;
  narrativeContext?: string;
  usesFaceReference: boolean;
  artistGender?: string;
}

// 🎬 Director-specific visual styles for strong injection
const directorStyles: Record<string, {
  visualStyle: string;
  cameraWork: string;
  lighting: string;
  colorGrading: string;
  composition: string;
  signature: string;
}> = {
  'Spike Jonze': {
    visualStyle: 'Intimate indie film aesthetic with whimsical surrealism',
    cameraWork: 'Handheld naturalistic movement, intimate close-ups, long takes',
    lighting: 'Warm golden hour natural lighting, practical lights',
    colorGrading: 'Nostalgic warm tones, slight film grain, desaturated pastels',
    composition: 'Off-center framing, environmental portraits, negative space',
    signature: 'Emotional vulnerability, dreamlike sequences, practical magic'
  },
  'Hype Williams': {
    visualStyle: 'Ultra-glamorous maximalist hip-hop opulence',
    cameraWork: 'Fisheye wide-angle lens, slow-motion glamour, low angles',
    lighting: 'High contrast, neon accents, rim lights, chrome reflections',
    colorGrading: 'Saturated bold colors, gold/platinum tones, high contrast blacks',
    composition: 'Centered power poses, symmetry, luxury product placement',
    signature: 'Excess and spectacle, bling aesthetic, larger than life'
  },
  'Michel Gondry': {
    visualStyle: 'Handcrafted DIY aesthetic with playful inventiveness',
    cameraWork: 'Creative in-camera tricks, stop-motion elements, optical illusions',
    lighting: 'Vintage soft lighting, colored gels, theatrical',
    colorGrading: 'Vintage camera effects, paper craft textures, storybook colors',
    composition: 'Surreal perspective, impossible spaces, recursive patterns',
    signature: 'Childlike wonder, practical effects, visual puzzles'
  },
  'David Fincher': {
    visualStyle: 'Dark cinematic thriller with clinical precision',
    cameraWork: 'Steady controlled dolly, meticulous symmetry, tracking shots',
    lighting: 'Low-key dramatic shadows, motivated lighting, noir atmosphere',
    colorGrading: 'Desaturated cold palette, green/blue tints, deep blacks',
    composition: 'Geometric framing, architectural symmetry, depth staging',
    signature: 'Unsettling tension, perfectionist detail, psychological depth'
  },
  'Edgar Wright': {
    visualStyle: 'Kinetic visual comedy with British wit',
    cameraWork: 'Quick zooms, whip pans, snap cuts on beats, dynamic angles',
    lighting: 'Bold theatrical lighting, color blocking, high key',
    colorGrading: 'Vibrant saturated palette, comic book contrast',
    composition: 'Densely packed frames, visual rhythm, match cuts',
    signature: 'Music synced editing, pop culture homage, energetic pace'
  },
  'Denis Villeneuve': {
    visualStyle: 'Epic contemplative sci-fi grandeur',
    cameraWork: 'Slow majestic movements, IMAX scale compositions, wide shots',
    lighting: 'Atmospheric natural light, volumetric fog, silhouettes',
    colorGrading: 'Muted earth tones, desaturated blue/orange, minimal palette',
    composition: 'Vast negative space, human scale vs environment, symmetry',
    signature: 'Existential weight, silence as tension, architectural spaces'
  },
  'Wes Anderson': {
    visualStyle: 'Symmetrical storybook whimsy with meticulous design',
    cameraWork: 'Centered framing, flat lateral dollies, tableau shots',
    lighting: 'Soft diffused lighting, pastel warmth, even exposure',
    colorGrading: 'Precise pastel palette, candy colors, vintage warmth',
    composition: 'Perfect symmetry, miniature aesthetic, chapter cards',
    signature: 'Quirky nostalgia, deadpan staging, production design focus'
  },
  'Christopher Nolan': {
    visualStyle: 'Cerebral epic with IMAX grandeur',
    cameraWork: 'Practical IMAX shots, rotating cameras, practical stunts',
    lighting: 'Natural motivated lighting, practical effects, high contrast',
    colorGrading: 'Realistic neutral palette, minimal color manipulation',
    composition: 'Geometric architecture, scale and perspective, layered depth',
    signature: 'Non-linear hints, practical over CGI, time manipulation'
  },
  'Quentin Tarantino': {
    visualStyle: 'Bold retro grindhouse with pop culture style',
    cameraWork: 'Trunk shots, crash zooms, 360 pans, Mexican standoffs',
    lighting: 'High contrast, bold colors, vintage film look',
    colorGrading: 'Saturated retro palette, grindhouse grain, bold primaries',
    composition: 'Unconventional angles, split screen potential, dialogue framing',
    signature: 'Stylized violence, feet shots, revenge aesthetic'
  },
  'default': {
    visualStyle: 'Professional cinematic music video',
    cameraWork: 'Dynamic mixed shots, dolly and steadicam, varied angles',
    lighting: 'Three-point cinematic setup, motivated sources',
    colorGrading: 'Rich cinematic contrast, clean highlights, deep shadows',
    composition: 'Rule of thirds, depth of field, balanced framing',
    signature: 'Professional broadcast quality, commercial appeal'
  }
};

// 🎭 Category-specific prompt templates
const categoryTemplates: Record<ShotCategory, {
  prefix: string;
  requirements: string[];
  avoid: string[];
}> = {
  PERFORMANCE: {
    prefix: 'MUSIC VIDEO PERFORMANCE SHOT',
    requirements: [
      'Artist actively performing/singing with emotional expression',
      'Direct engagement with camera or passionate performance',
      'Dynamic stage presence and body language',
      'Professional music video lighting setup',
      'Clear facial features and expression visible',
      'Single unified frame - NOT a collage or grid'
    ],
    avoid: [
      'Multiple separate images or panels',
      'Collage layout or grid format',
      'Static or lifeless pose',
      'Face obscured or profile only',
      'Amateur or low-quality appearance'
    ]
  },
  'B-ROLL': {
    prefix: 'CINEMATIC B-ROLL ESTABLISHING SHOT',
    requirements: [
      'NO PEOPLE in frame - pure environmental/atmospheric shot',
      'Cinematic establishing or detail shot',
      'Rich texture, atmosphere, and mood',
      'Story-relevant location or symbolic object',
      'Professional film-quality composition',
      'Single unified frame - NOT a collage'
    ],
    avoid: [
      'Any human figures or faces',
      'Multiple separate images or panels',
      'Collage or grid layout',
      'Static boring composition',
      'Random unrelated imagery'
    ]
  },
  STORY: {
    prefix: 'NARRATIVE STORY SCENE',
    requirements: [
      'Character in story context (not just performing)',
      'Clear narrative moment and emotional state',
      'Environmental storytelling and context',
      'Cinematic acting pose or moment',
      'Consistent character appearance',
      'Single unified frame - NOT a collage'
    ],
    avoid: [
      'Breaking character or looking at camera directly',
      'Multiple separate images or panels',
      'Collage or grid layout',
      'Inconsistent character appearance',
      'Confusing or unclear narrative'
    ]
  }
};

// 🎯 Shot type visual descriptions
const shotTypeDescriptions: Record<string, string> = {
  'extreme-close-up': 'ECU extreme close-up of facial detail or specific feature',
  'close-up': 'CU close-up facial shot filling frame',
  'medium-close-up': 'MCU medium close-up head and shoulders',
  'medium-shot': 'MS medium shot waist up',
  'medium-long-shot': 'MLS medium long shot knees up',
  'long-shot': 'LS long shot full body visible',
  'wide-shot': 'WS wide shot with environment context',
  'extreme-wide-shot': 'EWS extreme wide establishing shot',
  'over-shoulder': 'OTS over-the-shoulder perspective',
  'pov': 'POV first-person point of view',
  'high-angle': 'High angle looking down at subject',
  'low-angle': 'Low angle looking up at subject',
  'dutch-angle': 'Dutch tilted angle for tension',
  'tracking': 'Tracking shot following movement',
  'crane': 'Crane shot elevated camera movement',
  'drone': 'Aerial drone perspective shot'
};

/**
 * 🎬 Builds an optimized prompt for a specific shot category and director style
 */
export function buildOptimizedScenePrompt(params: ScenePromptParams): string {
  const {
    basePrompt,
    shotCategory,
    shotType,
    directorName,
    emotion,
    lighting = 'cinematic',
    colorGrading = 'professional',
    location = 'studio',
    narrativeContext = '',
    usesFaceReference,
    artistGender = 'artist'
  } = params;

  // Get director style (fallback to default)
  const director = directorStyles[directorName] || directorStyles['default'];
  const category = categoryTemplates[shotCategory];
  const shotDesc = shotTypeDescriptions[shotType] || shotType;

  // Build gender-appropriate character description
  const characterDesc = shotCategory === 'B-ROLL' 
    ? '' 
    : artistGender === 'masculine' ? 'male artist/performer'
    : artistGender === 'feminine' ? 'female artist/performer'
    : 'artist/performer';

  // Construct the prompt parts
  const parts: string[] = [];

  // 1. Category header
  parts.push(`[${category.prefix}]`);

  // 2. Director style injection (STRONG)
  parts.push(`\n🎬 DIRECTOR: ${directorName}`);
  parts.push(`Visual Style: ${director.visualStyle}`);
  parts.push(`Camera: ${director.cameraWork}`);
  parts.push(`Signature: ${director.signature}`);

  // 3. Shot specification
  parts.push(`\n📷 SHOT: ${shotDesc}`);
  if (characterDesc) {
    parts.push(`Character: ${characterDesc}`);
  }
  parts.push(`Emotion: ${emotion}`);
  parts.push(`Location: ${location}`);

  // 4. Core visual description
  parts.push(`\n📝 SCENE:`);
  parts.push(basePrompt);
  if (narrativeContext) {
    parts.push(`Context: ${narrativeContext}`);
  }

  // 5. Technical requirements
  parts.push(`\n🎨 TECHNICAL:`);
  parts.push(`Lighting: ${director.lighting}`);
  parts.push(`Color Grading: ${director.colorGrading}`);
  parts.push(`Composition: ${director.composition}`);

  // 6. Category requirements (as strong instructions)
  parts.push(`\n⚠️ REQUIREMENTS:`);
  category.requirements.forEach(req => {
    parts.push(`✓ ${req}`);
  });

  // 7. Things to avoid (as negative guidance)
  parts.push(`\n🚫 AVOID:`);
  category.avoid.forEach(item => {
    parts.push(`✗ ${item}`);
  });

  // 8. Quality specifications
  parts.push(`\n📐 OUTPUT:`);
  parts.push(`8K photorealistic quality, professional music video frame`);
  parts.push(`16:9 widescreen cinematic aspect ratio`);
  parts.push(`Single cohesive image - NOT a collage or multiple panels`);

  // 9. Face reference note if applicable
  if (usesFaceReference && shotCategory !== 'B-ROLL') {
    parts.push(`\n🎭 FACE REFERENCE: Maintain exact facial identity from reference images`);
  }

  return parts.join('\n');
}

/**
 * 🎯 Creates a simplified prompt for fast generation (fallback)
 */
export function buildSimplifiedPrompt(params: ScenePromptParams): string {
  const { basePrompt, shotCategory, shotType, directorName, emotion, artistGender } = params;
  const director = directorStyles[directorName] || directorStyles['default'];
  
  const categoryPrefix = {
    PERFORMANCE: 'Music video performance shot',
    'B-ROLL': 'Cinematic establishing shot, no people',
    STORY: 'Narrative story scene'
  }[shotCategory];

  const genderDesc = shotCategory === 'B-ROLL' ? '' 
    : artistGender === 'masculine' ? ', male artist' 
    : artistGender === 'feminine' ? ', female artist'
    : '';

  return `${categoryPrefix}${genderDesc}. ${basePrompt}. ${emotion} mood. ${director.signature}. ${shotType}. 8K cinematic quality. Single frame, NOT a collage.`;
}

/**
 * 🔍 Validates if a prompt might generate problematic output
 */
export function validatePromptQuality(prompt: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check for potentially problematic patterns
  if (prompt.length > 2000) {
    warnings.push('Prompt is very long - may cause inconsistent results');
  }

  if (prompt.includes('multiple') || prompt.includes('grid') || prompt.includes('collage')) {
    warnings.push('Prompt contains words that may trigger multi-image output');
  }

  if (!prompt.includes('single') && !prompt.includes('one frame')) {
    warnings.push('Consider adding "single frame" to prevent collage output');
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}

/**
 * 📊 Gets director style info for UI display
 */
export function getDirectorStyleInfo(directorName: string) {
  return directorStyles[directorName] || directorStyles['default'];
}

/**
 * 📋 Gets all available directors
 */
export function getAvailableDirectors(): string[] {
  return Object.keys(directorStyles).filter(d => d !== 'default');
}
