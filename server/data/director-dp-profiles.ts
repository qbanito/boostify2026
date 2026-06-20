/**
 * 🎬 DIRECTOR + DP PROFILES - Hollywood Level Cinematography
 * 
 * 10 Pairings legendarios de Director + Director de Fotografía
 * Cada perfil contiene especificaciones técnicas completas que se
 * inyectan en cada escena para máxima coherencia visual.
 * 
 * Sistema de armonía perfecta: La visión del director + la ejecución técnica del DP
 */

import type { DirectorDPProfile, ShotSpec } from './types/cinematography';

// ========== HELPER: CREATE SHOT SPEC ==========

function createShotSpec(config: Partial<ShotSpec> & { prompt_template: string; edit_prompt: string }): ShotSpec {
  return {
    lens_mm: config.lens_mm || '50mm',
    aperture: config.aperture || 'f/2.8',
    camera_height: config.camera_height || 'Eye level',
    camera_angle: config.camera_angle || 'Straight',
    movement: config.movement || 'Static',
    lighting_key: config.lighting_key || 'Natural',
    framing: config.framing || 'Rule of thirds',
    depth_of_field: config.depth_of_field || 'Medium',
    prompt_template: config.prompt_template,
    edit_prompt: config.edit_prompt,
  };
}

// =============================================================================
// 1. SPIKE JONZE + EMMANUEL LUBEZKI
// =============================================================================

export const SPIKE_JONZE_LUBEZKI: DirectorDPProfile = {
  id: 'spike-jonze-lubezki',
  version: '1.0.0',
  
  director: {
    name: 'Spike Jonze',
    visual_philosophy: 'Find the extraordinary in the ordinary. Let emotions breathe through simple, honest frames.',
    signature_techniques: [
      'Single-take wonders that feel effortless',
      'Practical effects over CGI',
      'Intimate handheld moments',
      'Surreal mundane juxtaposition',
      'Dance as emotional expression',
      'Long takes that let performances breathe'
    ],
    narrative_style: 'Whimsical yet deeply emotional, absurd yet profoundly human',
    emotional_language: 'Melancholy joy, lonely togetherness, hopeful sadness',
    pacing: 'Patient building to sudden kinetic bursts',
    iconic_works: [
      { title: 'Weapon of Choice', year: 2001, visual_highlight: 'Christopher Walken flying through hotel lobby' },
      { title: 'Her', year: 2013, visual_highlight: 'Intimate close-ups in futuristic soft light' },
      { title: 'Being John Malkovich', year: 1999, visual_highlight: '7½ floor cramped perspective' }
    ],
    influences: ['Michel Gondry', 'Buster Keaton', 'Charlie Kaufman'],
    awards: ['Academy Award for Best Original Screenplay']
  },
  
  cinematographer: {
    name: 'Emmanuel Lubezki',
    technical_philosophy: 'Natural light is the ultimate truth. The camera should feel invisible.',
    signature_look: 'Natural light poetry with ethereal wide-angle intimacy',
    legendary_technique: 'Pioneered ultra-long takes with natural/motivated lighting',
    famous_collaborations: ['Terrence Malick', 'Alfonso Cuarón', 'Alejandro Iñárritu'],
    camera_preference: 'ARRI Alexa 65 for natural color science',
    lens_preference: 'Ultra-wide primes (14mm-21mm) close to subjects',
    lighting_philosophy: 'Available light enhanced, never replaced. Golden hour is sacred.',
    awards: ['3x Academy Award for Best Cinematography (consecutive)']
  },
  
  collaboration: {
    synergy_score: 95,
    visual_harmony: 'Natural poetry meets whimsical humanity. Both believe in letting real moments happen.',
    combined_signature: 'Ethereal natural light dancing with intimate handheld warmth',
    best_for_genres: ['Music Videos', 'Drama', 'Fantasy', 'Dance'],
    combined_influences: ['Terrence Malick', 'New Wave French Cinema', 'Music Video Golden Age']
  },
  
  camera: {
    name: 'ARRI Alexa 65',
    sensor_format: '65mm digital',
    resolution: '6.5K',
    dynamic_range: '14+ stops',
    color_science: 'ARRI LogC - natural skin tones',
    best_for: ['Natural light cinematography', 'Intimate portraits', 'Wide environmental shots']
  },
  
  lenses: {
    manufacturer: 'Panavision',
    series: 'Primo 70',
    format: 'Spherical 65mm',
    focal_lengths: [
      { mm: '14mm', use_case: 'Wide establishing, dancing in space', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Deep', bokeh_quality: 'Smooth circular', distortion: 'Controlled barrel for intimacy' },
      { mm: '21mm', use_case: 'Environmental portraits, following subjects', aperture_sweet_spot: 'f/2', depth_of_field: 'Medium-deep', bokeh_quality: 'Creamy', distortion: 'Minimal' },
      { mm: '27mm', use_case: 'Personal wide shots', aperture_sweet_spot: 'f/2', depth_of_field: 'Medium', bokeh_quality: 'Organic', distortion: 'None' },
      { mm: '35mm', use_case: 'Medium shots, dialogue', aperture_sweet_spot: 'f/1.8', depth_of_field: 'Selective', bokeh_quality: 'Buttery', distortion: 'None' },
      { mm: '50mm', use_case: 'Close-ups, emotional beats', aperture_sweet_spot: 'f/1.4', depth_of_field: 'Shallow', bokeh_quality: 'Dreamy', distortion: 'None' },
      { mm: '85mm', use_case: 'Intimate portraits', aperture_sweet_spot: 'f/1.4', depth_of_field: 'Very shallow', bokeh_quality: 'Ethereal', distortion: 'None' }
    ],
    characteristics: ['Warm natural skin tones', 'Gentle falloff', 'Natural vignette'],
    flare_characteristics: 'Warm organic flares that embrace light leaks',
    cost_tier: 'Ultra-Premium'
  },
  
  lighting: {
    key_style: 'Natural',
    key_ratio: '2:1 soft',
    fill_approach: 'Natural bounce from environment',
    backlight: 'Motivated sun/practical sources',
    color_temperature: {
      key: '5600K natural daylight',
      fill: 'Ambient bounce',
      accent: 'Warm practicals 2700K'
    },
    practicals: ['Window light', 'Golden hour sun', 'Practical lamps', 'Candles'],
    motivated_sources: ['Windows', 'Skylights', 'Open doors', 'Natural reflectors'],
    signature_setup: 'Large soft sources through windows, golden hour magic, minimal artificial intervention. Let the sun do the work, shape with negative fill.'
  },
  
  color_grading: {
    primary_palette: ['Warm golden', 'Soft pastels', 'Natural earth tones', 'Nostalgic amber'],
    shadows: { hue: 'Warm brown', saturation: '15%', lift: '0' },
    midtones: { hue: 'Natural warm', saturation: 'Natural', gamma: '1.0' },
    highlights: { hue: 'Golden amber', saturation: '10%', gain: '+0.05' },
    overall_saturation: '85% - slightly desaturated for nostalgia',
    contrast: 'Soft, lifted blacks for dreaminess',
    film_emulation: 'Kodak Vision3 250D - warm daylight',
    grain: { intensity: 'Fine', size: '35mm', character: 'Organic film texture' }
  },
  
  depth_of_field: {
    philosophy: 'Wide lenses close to subjects create intimacy while showing environment',
    wide_shots: { aperture: 'f/4', focus_distance: 'Hyperfocal', description: 'Everything in focus, world-building' },
    medium_shots: { aperture: 'f/2.8', focus_distance: '2m', description: 'Subject sharp, environment contextual' },
    close_ups: { aperture: 'f/1.4-f/2', focus_distance: '0.8m', description: 'Eyes razor sharp, ears soft' },
    extreme_close_ups: { aperture: 'f/2', focus_distance: 'Minimum', description: 'Detail emerges from softness' },
    rack_focus: true,
    focus_pulls: ['Between subjects for connection', 'To reveal emotional beats']
  },
  
  framing: {
    aspect_ratio: '1.85:1 theatrical',
    headroom: 'Comfortable, breathing room',
    lead_room: 'Generous, following motion',
    nose_room: 'Natural, following gaze',
    symmetry: { use: false, when: 'Rarely - only for surreal moments' },
    rule_of_thirds: true,
    center_framing: { use: true, when: 'Direct emotional address' },
    negative_space: 'Uses to show isolation or loneliness',
    safe_areas: { action: '90%', title: '80%' }
  },
  
  movement: {
    philosophy: 'Camera as dance partner, always motivated by emotion',
    static: { when: ['Contemplative moments', 'Tableaux'], motivation: 'Let emotion settle' },
    handheld: { when: ['Following dance', 'Emotional intensity', 'Documentary intimacy'], intensity: 'Subtle breathing, organic' },
    steadicam: { when: ['Following subjects through space', 'Ethereal float'], speed: 'Match subject pace' },
    dolly: { when: ['Slow emotional reveals', 'Push into faces'], track_type: 'Curved when possible' },
    crane: { when: ['Dance sequences from above', 'Lifting to freedom'], height: '15ft intimate' },
    drone: { when: ['Rarely - only for scale'], altitude: 'Low, intimate' },
    speed: 'Matches emotional tempo of music'
  },
  
  shot_library: {
    wide_establishing: createShotSpec({
      lens_mm: '14mm', aperture: 'f/4', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Slow steadicam drift', lighting_key: 'Natural golden hour',
      framing: 'Subject small in frame, environment dominant', depth_of_field: 'Deep',
      prompt_template: 'Wide establishing shot, golden hour natural light, {subject} small in expansive environment, Spike Jonze whimsical composition, Emmanuel Lubezki natural cinematography, warm nostalgic tones, 14mm Panavision Primo 70, film grain, cinematic 1.85:1',
      edit_prompt: 'Transform to wide establishing shot: pull back to show full environment, golden hour lighting, subject smaller in frame, Lubezki natural light style'
    }),
    wide_environment: createShotSpec({
      lens_mm: '21mm', aperture: 'f/2.8', camera_height: 'Slightly low', camera_angle: 'Straight',
      movement: 'Subtle handheld breathing', lighting_key: 'Natural with practicals',
      framing: 'Environmental portrait', depth_of_field: 'Medium-deep',
      prompt_template: 'Environmental wide shot, {subject} within space, natural window light, intimate yet expansive, Spike Jonze sensibility, soft natural tones, 21mm close to subject, documentary intimacy',
      edit_prompt: 'Reframe as environmental wide: show more surroundings, maintain subject connection, natural motivated lighting'
    }),
    medium_full: createShotSpec({
      lens_mm: '27mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Following handheld', lighting_key: 'Soft natural',
      framing: 'Full body with headroom', depth_of_field: 'Medium',
      prompt_template: 'Medium full shot, {subject} full body visible, soft natural lighting, gentle movement, Spike Jonze intimate realism, warm skin tones, slight film grain',
      edit_prompt: 'Adjust to medium full: show full body, maintain intimate connection, natural lighting preserved'
    }),
    medium_narrative: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Subtle drift', lighting_key: 'Natural motivated',
      framing: 'Waist up, comfortable', depth_of_field: 'Selective focus',
      prompt_template: 'Medium narrative shot, {subject} waist-up, soft selective focus, natural warm lighting, emotional storytelling moment, Jonze/Lubezki collaboration look, gentle bokeh background',
      edit_prompt: 'Reframe to medium narrative: waist-up composition, soften background, enhance emotional connection'
    }),
    medium_close: createShotSpec({
      lens_mm: '50mm', aperture: 'f/1.8', camera_height: 'Eye level', camera_angle: 'Slight angle',
      movement: 'Minimal breathing', lighting_key: 'Soft wrap',
      framing: 'Chest up, intimate', depth_of_field: 'Shallow',
      prompt_template: 'Medium close-up, {subject} chest and face, shallow depth of field, soft wraparound light, intimate emotional beat, 50mm Panavision, beautiful skin tones, Lubezki lighting',
      edit_prompt: 'Push to medium close-up: chest and face visible, shallow focus on eyes, soften background significantly'
    }),
    close_up_emotional: createShotSpec({
      lens_mm: '50mm', aperture: 'f/1.4', camera_height: 'Eye level', camera_angle: 'Straight intimate',
      movement: 'Barely perceptible', lighting_key: 'Soft beauty',
      framing: 'Face fills frame', depth_of_field: 'Very shallow',
      prompt_template: 'Emotional close-up, {subject} face filling frame, eyes sharp, beautiful shallow depth of field, soft natural light on face, Spike Jonze emotional intimacy, tears or joy visible, 50mm f/1.4',
      edit_prompt: 'Transform to emotional close-up: face fills frame, eyes razor sharp, dreamy shallow focus, enhance emotional expression'
    }),
    close_up_profile: createShotSpec({
      lens_mm: '85mm', aperture: 'f/1.4', camera_height: 'Eye level', camera_angle: '90 degree profile',
      movement: 'Static with drift', lighting_key: 'Rim and soft key',
      framing: 'Profile silhouette', depth_of_field: 'Ultra shallow',
      prompt_template: 'Profile close-up, {subject} in profile view, beautiful rim light creating separation, ultra shallow focus, contemplative mood, 85mm portrait lens, Lubezki backlight',
      edit_prompt: 'Reframe to profile: 90 degree side view, strong rim light, contemplative mood, shallow focus'
    }),
    extreme_close_up: createShotSpec({
      lens_mm: '85mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Completely static', lighting_key: 'Detail revealing',
      framing: 'Eyes or detail only', depth_of_field: 'Paper thin',
      prompt_template: 'Extreme close-up, {detail} filling entire frame, paper-thin depth of field, textural detail visible, intimate beyond comfortable, macro-like quality',
      edit_prompt: 'Push to extreme close-up: single feature or detail, razor thin focus, abstract intimacy'
    }),
    detail_insert: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Tabletop', camera_angle: 'Overhead or straight',
      movement: 'Static', lighting_key: 'Soft motivated',
      framing: 'Object isolated', depth_of_field: 'Selective',
      prompt_template: 'Detail insert shot, {object} isolated in frame, soft natural light, meaningful object photography, Jonze attention to small moments, subtle emotion in inanimate',
      edit_prompt: 'Create detail insert: isolate specific object or element, soft focus around it, meaningful composition'
    }),
    overhead_god_view: createShotSpec({
      lens_mm: '24mm', aperture: 'f/4', camera_height: 'High above', camera_angle: '90 degrees down',
      movement: 'Slow crane or static', lighting_key: 'Even top light',
      framing: 'Subject small below', depth_of_field: 'Deep',
      prompt_template: 'Overhead shot, bird\'s eye view, {subject} small below, geometric patterns visible, existential perspective, deep focus throughout, Jonze observational distance',
      edit_prompt: 'Transform to overhead view: 90 degrees looking down, subject small in frame, geometric composition'
    }),
    low_angle_power: createShotSpec({
      lens_mm: '21mm', aperture: 'f/2.8', camera_height: 'Ground level', camera_angle: 'Looking up 30 degrees',
      movement: 'Steady push', lighting_key: 'Dramatic backlight',
      framing: 'Subject towers above', depth_of_field: 'Deep',
      prompt_template: 'Low angle hero shot, {subject} towering above camera, dramatic sky or ceiling visible, empowering perspective, wide angle distortion for impact, backlit silhouette edge',
      edit_prompt: 'Shift to low angle: camera at ground level looking up, subject empowered, dramatic sky background'
    }),
    high_angle_vulnerable: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Above subject', camera_angle: 'Looking down 30 degrees',
      movement: 'Static observing', lighting_key: 'Top soft light',
      framing: 'Subject diminished', depth_of_field: 'Medium',
      prompt_template: 'High angle shot, looking down at {subject}, vulnerability and smallness conveyed, soft top light, empathetic observation, 35mm gentle perspective',
      edit_prompt: 'Reframe from above: high angle looking down, subject vulnerable, soft observational quality'
    }),
    dutch_angle_tension: createShotSpec({
      lens_mm: '27mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Tilted 15-25 degrees',
      movement: 'Unsettling drift', lighting_key: 'Dramatic contrast',
      framing: 'Disorienting', depth_of_field: 'Medium',
      prompt_template: 'Dutch angle shot, tilted 20 degrees, {subject} in unstable frame, psychological tension, world off-kilter, surreal Jonze moment, dramatic light and shadow',
      edit_prompt: 'Apply dutch angle: tilt frame 20 degrees, create visual tension and unease'
    }),
    pov_subjective: createShotSpec({
      lens_mm: '21mm', aperture: 'f/2.8', camera_height: 'Subject eye height', camera_angle: 'What they see',
      movement: 'Handheld organic', lighting_key: 'As subject sees it',
      framing: 'First person', depth_of_field: 'Selective attention',
      prompt_template: 'POV shot, first person perspective, seeing what {subject} sees, handheld organic movement, subjective experience, wide angle for peripheral vision',
      edit_prompt: 'Convert to POV: first person perspective, as if through subject\'s eyes, handheld feeling'
    }),
    over_shoulder: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2', camera_height: 'Shoulder height', camera_angle: 'Over shoulder',
      movement: 'Subtle breathing', lighting_key: 'Motivated by scene',
      framing: 'Subject through observer', depth_of_field: 'Shoulder soft, face sharp',
      prompt_template: 'Over shoulder shot, {subject} seen past another person\'s shoulder, intimate observation, shallow focus on main subject, conversational framing',
      edit_prompt: 'Add over-shoulder framing: foreground shoulder soft, main subject sharp, intimate observation'
    }),
    two_shot: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Following action', lighting_key: 'Balanced for both',
      framing: 'Both subjects comfortable', depth_of_field: 'Both in focus',
      prompt_template: 'Two shot, {subjects} in frame together, balanced lighting on both, relationship visible in framing, medium depth of field, both faces sharp',
      edit_prompt: 'Compose as two-shot: two subjects in frame, balanced composition, relationship dynamics visible'
    })
  },
  
  ai_prompts: {
    style_prefix: 'Spike Jonze directing, Emmanuel Lubezki cinematography, natural golden light, intimate handheld warmth, whimsical yet emotional, Panavision Primo 70 lenses, warm nostalgic color palette, organic film grain, 1.85:1 aspect ratio',
    master_shot_template: 'Wide master shot, {scene_description}, Spike Jonze visual poetry, Lubezki natural light cinematography, golden hour warmth, 21mm intimate wide angle, deep focus environmental storytelling, warm earth tones, subtle film grain',
    performance_template: 'Performance shot, {artist} singing/performing, Spike Jonze music video style, natural light wrapping face, intimate handheld closeness, 35mm or 50mm, shallow depth of field, emotional connection to camera, warm skin tones',
    broll_template: 'Cinematic B-roll, {description}, Lubezki natural light poetry, environmental storytelling, no people or background activity, 21mm wide composition, deep focus, warm afternoon light, Jonze attention to mundane beauty',
    emotional_template: 'Emotional close-up, {description}, eyes telling the story, Lubezki soft wraparound light, 50mm f/1.4 shallow focus, Jonze vulnerability and honesty, tears or joy visible, intimate beyond comfortable',
    action_template: 'Dynamic movement shot, {description}, Lubezki long-take aesthetic, handheld following action, wide angle immersion, motivated camera movement, dance-like choreography between camera and subject',
    negative_prompt: 'harsh artificial lighting, over-saturated colors, heavy digital look, symmetrical Wes Anderson style, dark noir shadows, cold blue tones, static locked-off camera, telephoto compression'
  },
  
  variation_config: {
    max_variations_per_scene: 4,
    variation_types: ['wide_establishing', 'medium_narrative', 'close_up_emotional', 'detail_insert'],
    energy_based_selection: true,
    beat_sync_enabled: true
  },
  
  // 🎬 EDITING STYLE - Spike Jonze: Patient, breathing edits with kinetic bursts
  editing_style: {
    philosophy: 'Let moments breathe, then explode with energy. Patient pacing broken by sudden kinetic bursts.',
    pace_modifier: 1.2,           // 20% slower than average - contemplative
    minimum_cut_duration: 1.5,    // Never cut faster than 1.5s - let performances breathe
    maximum_cut_duration: 8.0,    // Can hold long takes for dance sequences
    beat_alignment: 'downbeat',   // Cut on strong beats, not every beat
    hold_on_emotion: true,        // Extend duration on emotional close-ups
    emotion_hold_multiplier: 1.8, // Hold 80% longer on emotional shots
    accelerate_on_energy: true,
    energy_acceleration: 0.6,     // Speed up 40% on high energy
    transition_preferences: {
      intro: 'fade',
      verse: 'cut',
      chorus: 'cut',
      bridge: 'dissolve',
      drop: 'cut',
      outro: 'fade'
    },
    cut_patterns: {
      use_jump_cuts: false,       // Jonze prefers continuous takes
      use_match_cuts: true,       // Elegant transitions
      use_j_cuts: true,
      use_l_cuts: true,
      use_smash_cuts: false
    },
    section_beat_overrides: {
      intro: 2.0,                 // Double beats for slow intro
      verse: 1.5,                 // 50% more beats - contemplative
      chorus: 1.0,                // Normal energy
      bridge: 2.0,                // Slow bridge
      drop: 0.5,                  // Faster on drops
      outro: 2.5                  // Very slow fade out
    }
  }
};

// =============================================================================
// 2. HYPE WILLIAMS + DARIUS KHONDJI
// =============================================================================

export const HYPE_WILLIAMS_KHONDJI: DirectorDPProfile = {
  id: 'hype-williams-khondji',
  version: '1.0.0',
  
  director: {
    name: 'Hype Williams',
    visual_philosophy: 'Maximum visual impact. Every frame should drip with luxury and power.',
    signature_techniques: [
      'Fisheye lens distortion for impact',
      'Slow-motion opulence',
      'Reflective surfaces everywhere',
      'Luxury car culture and bling',
      'Static glamour poses',
      'Extreme wide-angle close-ups'
    ],
    narrative_style: 'Aspirational fantasy, hip-hop cinema mythology',
    emotional_language: 'Power, wealth, desire, untouchability',
    pacing: 'Slow, deliberate cuts that linger on luxury',
    iconic_works: [
      { title: 'Mo Money Mo Problems', year: 1997, visual_highlight: 'Shiny suits and disco glamour' },
      { title: 'California Love', year: 1996, visual_highlight: 'Mad Max meets hip-hop' },
      { title: 'Big Pimpin\'', year: 1999, visual_highlight: 'Yacht luxury excess' }
    ],
    influences: ['Blaxploitation cinema', 'Music video pioneers', 'Hip-hop culture'],
    awards: ['MTV Video Music Award for Best Direction (multiple)']
  },
  
  cinematographer: {
    name: 'Darius Khondji',
    technical_philosophy: 'Light is sculpture. Darkness is as important as light.',
    signature_look: 'Noir-influenced high contrast with jewel-tone color',
    legendary_technique: 'Created the look of Se7en - processed film for sickly greens',
    famous_collaborations: ['David Fincher', 'Wong Kar-wai', 'Jean-Pierre Jeunet'],
    camera_preference: 'ARRI Alexa LF with vintage glass',
    lens_preference: 'Panavision C-Series Anamorphic for epic scope',
    lighting_philosophy: 'Chiaroscuro drama with motivated color',
    awards: ['ASC Award', 'César Award']
  },
  
  collaboration: {
    synergy_score: 92,
    visual_harmony: 'Hip-hop luxury meets cinematic noir. Khondji brings depth to Hype\'s excess.',
    combined_signature: 'Jewel-toned noir glamour with fisheye power and anamorphic scope',
    best_for_genres: ['Hip-Hop Videos', 'R&B Videos', 'Luxury Brand', 'Urban Drama'],
    combined_influences: ['90s Hip-Hop Golden Age', 'Film Noir', 'Fashion Photography']
  },
  
  camera: {
    name: 'ARRI Alexa LF',
    sensor_format: 'Large Format 36.70mm x 25.54mm',
    resolution: '4.5K',
    dynamic_range: '14+ stops',
    color_science: 'ARRI LogC - rich for grading',
    best_for: ['High contrast glamour', 'Luxury cinematography', 'Controlled studio']
  },
  
  lenses: {
    manufacturer: 'Panavision',
    series: 'C-Series Anamorphic',
    format: 'Anamorphic 2x squeeze',
    focal_lengths: [
      { mm: '35mm', use_case: 'Fisheye-like wide for power', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Deep', bokeh_quality: 'Oval anamorphic', distortion: 'Barrel for impact' },
      { mm: '50mm', use_case: 'Standard glamour', aperture_sweet_spot: 'f/2', depth_of_field: 'Medium', bokeh_quality: 'Stretched horizontal', distortion: 'Minimal' },
      { mm: '75mm', use_case: 'Portrait glamour', aperture_sweet_spot: 'f/2', depth_of_field: 'Shallow', bokeh_quality: 'Beautiful oval', distortion: 'None' },
      { mm: '100mm', use_case: 'Detail and jewelry', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Very shallow', bokeh_quality: 'Creamy', distortion: 'None' },
      { mm: '14mm Fisheye', use_case: 'Signature distortion', aperture_sweet_spot: 'f/4', depth_of_field: 'Ultra deep', bokeh_quality: 'N/A', distortion: 'Maximum barrel' }
    ],
    characteristics: ['Horizontal flares', 'Oval bokeh', 'Dramatic compression', 'Classic Hollywood glamour'],
    flare_characteristics: 'Blue/cyan horizontal streaks, lens breathing',
    cost_tier: 'Ultra-Premium'
  },
  
  lighting: {
    key_style: 'High-key glamour with noir accents',
    key_ratio: '4:1 dramatic',
    fill_approach: 'Negative fill for drama, reflectors for glow',
    backlight: 'Strong rim lighting for separation and glow',
    color_temperature: {
      key: '4300K slightly warm',
      fill: '5600K neutral',
      accent: 'Neon RGB accents'
    },
    practicals: ['Neon signs', 'Car headlights', 'Chandeliers', 'LED strips', 'Gold/chrome reflections'],
    motivated_sources: ['Club lighting', 'Car interiors', 'Jewelry sparkle'],
    signature_setup: 'Strong rim light creating halos, reflected key for glamour glow, neon color accents, chrome and gold surfaces bouncing light everywhere. Beauty lighting on faces, dramatic shadows on bodies.'
  },
  
  color_grading: {
    primary_palette: ['Rich gold', 'Deep purple', 'Neon magenta', 'Chrome silver', 'Black shadows'],
    shadows: { hue: 'Deep purple/black', saturation: '25%', lift: '-0.1 crushed' },
    midtones: { hue: 'Warm neutral', saturation: 'Rich', gamma: '0.95' },
    highlights: { hue: 'Gold/amber', saturation: '30%', gain: '+0.1' },
    overall_saturation: '110% - pushed for impact',
    contrast: 'High contrast, crushed blacks, blown highlights controlled',
    film_emulation: 'Pushed Kodak 500T with cross-process hints',
    grain: { intensity: 'Medium', size: '35mm', character: 'Glamorous texture' }
  },
  
  depth_of_field: {
    philosophy: 'Sharp on the money - literally. Focus on bling, let backgrounds fall away.',
    wide_shots: { aperture: 'f/4-f/5.6', focus_distance: 'Hyperfocal for environment', description: 'Show the whole luxury scene' },
    medium_shots: { aperture: 'f/2.8', focus_distance: 'Subject centered', description: 'Subject sharp, background glamour blur' },
    close_ups: { aperture: 'f/2', focus_distance: 'Face', description: 'Beauty close-up, skin perfect' },
    extreme_close_ups: { aperture: 'f/2.8', focus_distance: 'Jewelry/detail', description: 'Bling in razor focus' },
    rack_focus: true,
    focus_pulls: ['From jewelry to face', 'Car to artist', 'Background reveal to foreground']
  },
  
  framing: {
    aspect_ratio: '2.39:1 anamorphic widescreen',
    headroom: 'Minimal - power framing',
    lead_room: 'Centered power or dramatic negative space',
    nose_room: 'Direct to camera - confrontational',
    symmetry: { use: true, when: 'Power shots, throne poses' },
    rule_of_thirds: false,
    center_framing: { use: true, when: 'Almost always - power positioning' },
    negative_space: 'Filled with luxury items or dramatic emptiness',
    safe_areas: { action: '85%', title: '80%' }
  },
  
  movement: {
    philosophy: 'Slow, deliberate, regal. Camera worships the subject.',
    static: { when: ['Glamour poses', 'Power moments', 'Bling display'], motivation: 'Let luxury speak' },
    handheld: { when: ['Never - too chaotic'], intensity: 'N/A' },
    steadicam: { when: ['Slow reveal of luxury', 'Walking through club'], speed: 'Very slow, reverential' },
    dolly: { when: ['Slow push to subject', 'Circular around throne'], track_type: 'Curved for royalty' },
    crane: { when: ['Epic reveals', 'God shots of party'], height: '20ft+ for scale' },
    drone: { when: ['Yacht shots', 'Mansion exteriors'], altitude: 'High for estate scale' },
    speed: 'Slow-motion 48-120fps for opulence'
  },
  
  shot_library: {
    wide_establishing: createShotSpec({
      lens_mm: '35mm anamorphic', aperture: 'f/4', camera_height: 'Low power angle', camera_angle: 'Slight up',
      movement: 'Slow crane down', lighting_key: 'Neon and practical luxury',
      framing: 'Epic scope, luxury environment', depth_of_field: 'Deep',
      prompt_template: 'Epic wide establishing shot, luxury environment, Hype Williams maximalism, anamorphic 2.39:1, neon accents, gold and chrome surfaces, dramatic lighting, slow-motion opulence, hip-hop royalty aesthetic',
      edit_prompt: 'Pull back to epic wide: reveal full luxury environment, add neon accents, anamorphic scope, Hype Williams excess'
    }),
    wide_environment: createShotSpec({
      lens_mm: '35mm anamorphic', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Slow steadicam reveal', lighting_key: 'Club/luxury',
      framing: 'Scope and scale', depth_of_field: 'Medium',
      prompt_template: 'Wide environment shot, {subject} in luxury setting, anamorphic widescreen, practical neon lighting, reflective surfaces, Khondji noir glamour, Hype Williams style',
      edit_prompt: 'Reframe wide: show more luxury environment, add reflective surfaces, neon accents'
    }),
    medium_full: createShotSpec({
      lens_mm: '50mm anamorphic', aperture: 'f/2.8', camera_height: 'Low power', camera_angle: 'Looking up',
      movement: 'Static with slow-mo', lighting_key: 'Glamour rim',
      framing: 'Full body power pose', depth_of_field: 'Medium',
      prompt_template: 'Full body power shot, {subject} in designer outfit, low angle for dominance, slow-motion cloth movement, rim lighting creating halo, Hype Williams iconic framing',
      edit_prompt: 'Adjust to full body: low angle power pose, rim lighting, slow-motion feel'
    }),
    medium_narrative: createShotSpec({
      lens_mm: '50mm anamorphic', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Slight dutch',
      movement: 'Slow circular dolly', lighting_key: 'Beauty with edge',
      framing: 'Waist up with bling visible', depth_of_field: 'Shallow',
      prompt_template: 'Medium glamour shot, {subject} waist-up, designer jewelry visible, beauty lighting, slight anamorphic distortion, Hype Williams swagger, Khondji contrast',
      edit_prompt: 'Medium glamour frame: waist up, jewelry prominent, beauty lighting, slight edge'
    }),
    medium_close: createShotSpec({
      lens_mm: '75mm anamorphic', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Slow push in', lighting_key: 'Beauty close-up',
      framing: 'Chest up with chains', depth_of_field: 'Shallow',
      prompt_template: 'Medium close glamour, {subject} chest up, gold chains visible, beauty lighting on skin, anamorphic oval bokeh, aspirational styling, magazine quality',
      edit_prompt: 'Push to medium close: chest and face, jewelry prominent, beauty lighting, shallow anamorphic bokeh'
    }),
    close_up_emotional: createShotSpec({
      lens_mm: '75mm anamorphic', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Straight confrontational',
      movement: 'Static power', lighting_key: 'Beauty perfection',
      framing: 'Face as icon', depth_of_field: 'Very shallow',
      prompt_template: 'Close-up icon shot, {subject} face as power, perfect beauty lighting, eyes confronting camera, anamorphic shallow focus, Hype Williams money shot, skin flawless',
      edit_prompt: 'Transform to power close-up: face dominant, confrontational gaze, perfect beauty lighting'
    }),
    close_up_profile: createShotSpec({
      lens_mm: '100mm anamorphic', aperture: 'f/2', camera_height: 'Eye level', camera_angle: '90 degree profile',
      movement: 'Static contemplative', lighting_key: 'Dramatic rim',
      framing: 'Regal profile', depth_of_field: 'Very shallow',
      prompt_template: 'Profile power shot, {subject} in regal profile, strong rim light, jewelry catching light, anamorphic compression, royalty aesthetic',
      edit_prompt: 'Reframe to profile: 90 degree side view, dramatic rim light, regal composition'
    }),
    extreme_close_up: createShotSpec({
      lens_mm: '100mm anamorphic', aperture: 'f/2.8', camera_height: 'Object level', camera_angle: 'Straight',
      movement: 'Static detail worship', lighting_key: 'Jewelry lighting',
      framing: 'Bling isolated', depth_of_field: 'Paper thin',
      prompt_template: 'Extreme close-up bling, {detail} filling frame, diamonds catching light, sparkle and luxury, product photography meets music video, razor focus',
      edit_prompt: 'Push to extreme close: jewelry or detail only, maximum sparkle, luxury focus'
    }),
    detail_insert: createShotSpec({
      lens_mm: '100mm', aperture: 'f/2.8', camera_height: 'Tabletop', camera_angle: 'Hero angle',
      movement: 'Slow rotation', lighting_key: 'Product glamour',
      framing: 'Product hero shot', depth_of_field: 'Selective',
      prompt_template: 'Detail insert, {object} as hero, luxury product photography, reflective surfaces, Hype Williams bling aesthetic, slow rotation feel',
      edit_prompt: 'Create detail insert: isolate luxury item, product lighting, slow rotation aesthetic'
    }),
    overhead_god_view: createShotSpec({
      lens_mm: '24mm', aperture: 'f/4', camera_height: 'High crane', camera_angle: '90 degrees down',
      movement: 'Slow crane descent', lighting_key: 'Even with patterns',
      framing: 'Geometric luxury', depth_of_field: 'Deep',
      prompt_template: 'Overhead god shot, {subject} laid out below, money/luxury spread around, geometric patterns, Hype Williams excess from above, slow descent feel',
      edit_prompt: 'Transform to overhead: 90 degrees looking down, subject surrounded by luxury, geometric composition'
    }),
    low_angle_power: createShotSpec({
      lens_mm: '14mm fisheye', aperture: 'f/4', camera_height: 'Ground level', camera_angle: 'Extreme up',
      movement: 'Static power pose', lighting_key: 'Dramatic backlight',
      framing: 'Fisheye distortion', depth_of_field: 'Ultra deep',
      prompt_template: 'Fisheye power shot, {subject} towering above camera, extreme fisheye distortion, legs and body elongated, Hype Williams signature look, confrontational power',
      edit_prompt: 'Apply fisheye low angle: extreme distortion, ground level looking up, maximum power impact'
    }),
    high_angle_vulnerable: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Above', camera_angle: 'Looking down 30 degrees',
      movement: 'Static observing', lighting_key: 'Soft top',
      framing: 'Rare vulnerability', depth_of_field: 'Medium',
      prompt_template: 'High angle moment, looking down at {subject}, rare vulnerability in luxury, soft top lighting, Hype Williams emotional beat',
      edit_prompt: 'Reframe from above: high angle looking down, vulnerable moment in luxury context'
    }),
    dutch_angle_tension: createShotSpec({
      lens_mm: '35mm anamorphic', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Tilted 20 degrees',
      movement: 'Slow rotation', lighting_key: 'Neon drama',
      framing: 'Unstable power', depth_of_field: 'Medium',
      prompt_template: 'Dutch angle power, {subject} in tilted frame, neon lighting, unstable energy, Hype Williams drama, anamorphic distortion adding to tension',
      edit_prompt: 'Apply dutch angle: tilt frame 20 degrees, add neon accents, create visual tension'
    }),
    pov_subjective: createShotSpec({
      lens_mm: '24mm', aperture: 'f/2.8', camera_height: 'Subject eye level', camera_angle: 'Their POV',
      movement: 'Walking through luxury', lighting_key: 'As they see it',
      framing: 'First person luxury', depth_of_field: 'Selective',
      prompt_template: 'POV luxury walkthrough, first person view through {location}, hands with jewelry visible, walking through wealth, Hype Williams immersion',
      edit_prompt: 'Convert to POV: first person perspective, hands with jewelry visible, walking through luxury'
    }),
    over_shoulder: createShotSpec({
      lens_mm: '75mm anamorphic', aperture: 'f/2', camera_height: 'Shoulder', camera_angle: 'Past shoulder',
      movement: 'Subtle breathing', lighting_key: 'Glamour both',
      framing: 'Confrontation framing', depth_of_field: 'Shallow on face',
      prompt_template: 'Over shoulder power, {subject} seen past shoulder, anamorphic compression, confrontational framing, both figures styled',
      edit_prompt: 'Add over-shoulder: foreground silhouette, main subject in focus, confrontational energy'
    }),
    two_shot: createShotSpec({
      lens_mm: '50mm anamorphic', aperture: 'f/2.8', camera_height: 'Low', camera_angle: 'Looking up',
      movement: 'Slow circular', lighting_key: 'Both glamorous',
      framing: 'Power couple', depth_of_field: 'Both in focus',
      prompt_template: 'Power two-shot, {subjects} together, low angle for dominance, both styled immaculately, anamorphic scope, Hype Williams power couple aesthetic',
      edit_prompt: 'Compose as power two-shot: two figures, low angle, both glamorous, power dynamics visible'
    })
  },
  
  ai_prompts: {
    style_prefix: 'Hype Williams directing, Darius Khondji cinematography, hip-hop luxury aesthetic, anamorphic 2.39:1, neon accents, gold and chrome surfaces, fisheye distortion, slow-motion opulence, high contrast glamour, crushed blacks, rich gold highlights',
    master_shot_template: 'Epic master shot, {scene_description}, Hype Williams maximalism, Khondji noir contrast, anamorphic widescreen, luxury environment, neon and gold color palette, slow-motion texture, reflective surfaces',
    performance_template: 'Performance power shot, {artist} center frame, Hype Williams iconic framing, low angle for dominance, beauty lighting, designer styling, jewelry prominent, anamorphic bokeh, confrontational presence',
    broll_template: 'Luxury B-roll, {description}, Hype Williams excess, chrome and gold surfaces, neon reflections, slow-motion, no people or only silhouettes, product worship aesthetic, 2.39:1 scope',
    emotional_template: 'Emotional glamour close-up, {description}, Hype Williams beauty shot, perfect skin lighting, eyes as power, jewelry catching light, shallow anamorphic focus, magazine perfection',
    action_template: 'Slow-motion action, {description}, Hype Williams slow-mo, 120fps luxury movement, cloth billowing, hair flowing, smoke and atmosphere, dramatic rim lighting',
    negative_prompt: 'natural documentary look, handheld shakiness, desaturated colors, minimal lighting, soft contrast, wide open apertures on wide shots, suburban settings, casual clothing'
  },
  
  variation_config: {
    max_variations_per_scene: 5,
    variation_types: ['wide_establishing', 'low_angle_power', 'close_up_emotional', 'extreme_close_up', 'detail_insert'],
    energy_based_selection: true,
    beat_sync_enabled: true  },
  
  // 🎬 EDITING STYLE - Hype Williams: FAST cuts, luxury rhythm, hip-hop energy
  editing_style: {
    philosophy: 'Rapid-fire luxury. Every beat is a cut. Flash and impact.',
    pace_modifier: 0.7,           // 30% faster than average - hip-hop energy
    minimum_cut_duration: 0.25,   // Can do flash cuts (4 per second)
    maximum_cut_duration: 3.0,    // Never hold too long - keep it moving
    beat_alignment: 'any_beat',   // Cut on hi-hats, snares, everything
    hold_on_emotion: false,       // Don't slow down for feelings
    emotion_hold_multiplier: 1.0,
    accelerate_on_energy: true,
    energy_acceleration: 0.5,     // Double speed on drops
    transition_preferences: {
      intro: 'fade',
      verse: 'cut',
      chorus: 'flash',            // Flash cuts on chorus
      bridge: 'crossfade',
      drop: 'flash',              // Strobing on drop
      outro: 'fade'
    },
    cut_patterns: {
      use_jump_cuts: true,        // Jump cuts for energy
      use_match_cuts: false,
      use_j_cuts: false,
      use_l_cuts: false,
      use_smash_cuts: true        // Impact smash cuts
    },
    section_beat_overrides: {
      intro: 1.0,
      verse: 0.5,                 // Rapid verse cuts
      chorus: 0.25,               // Ultra fast chorus
      bridge: 1.5,
      drop: 0.25,                 // Machine gun cuts on drop
      outro: 1.5
    }  }
};

// =============================================================================
// 3. DAVID FINCHER + JEFF CRONENWETH
// =============================================================================

export const DAVID_FINCHER_CRONENWETH: DirectorDPProfile = {
  id: 'david-fincher-cronenweth',
  version: '1.0.0',
  
  director: {
    name: 'David Fincher',
    visual_philosophy: 'Perfectionism in service of unease. Every frame precisely controlled to create psychological tension.',
    signature_techniques: [
      'Perfect symmetry and geometric framing',
      'Impossible camera moves through walls',
      'Desaturated color with sickly green/teal',
      'Meticulous control of every element',
      'Slow deliberate dollies',
      'Top-down surveillance angles'
    ],
    narrative_style: 'Dark psychological intensity, methodical unraveling',
    emotional_language: 'Dread, obsession, control, decay',
    pacing: 'Methodical tension building, precision cuts on beat',
    iconic_works: [
      { title: 'Se7en', year: 1995, visual_highlight: 'Rain-soaked noir with processed film' },
      { title: 'Fight Club', year: 1999, visual_highlight: 'Subliminal cuts and chaos' },
      { title: 'The Social Network', year: 2010, visual_highlight: 'Cold digital precision' }
    ],
    influences: ['Stanley Kubrick', 'Alan Pakula', 'Ridley Scott'],
    awards: ['Academy Award nominations for Best Director']
  },
  
  cinematographer: {
    name: 'Jeff Cronenweth',
    technical_philosophy: 'Darkness is not absence of light, it\'s specific light. Every shadow is designed.',
    signature_look: 'Low-key noir with green/teal cast, clinical precision',
    legendary_technique: 'Digital cinema pioneer with Fincher, ENR silver retention look',
    famous_collaborations: ['David Fincher (multiple films)', 'Ben Affleck'],
    camera_preference: 'RED cameras for extreme detail and low-light',
    lens_preference: 'Leica Summilux-C for clinical sharpness',
    lighting_philosophy: 'Motivated sources only, practicals as key lights, embrace darkness',
    awards: ['ASC Award', 'Academy Award nominations']
  },
  
  collaboration: {
    synergy_score: 98,
    visual_harmony: 'Perfectionist control freaks creating clinical beauty in darkness',
    combined_signature: 'Surgical precision with noir soul - every frame a controlled nightmare',
    best_for_genres: ['Thriller', 'Drama', 'Dark Music Videos', 'Psychological Horror'],
    combined_influences: ['Film noir', 'German Expressionism', 'Digital Cinema']
  },
  
  camera: {
    name: 'RED V-Raptor XL 8K VV',
    sensor_format: 'Vista Vision',
    resolution: '8K',
    dynamic_range: '17+ stops',
    color_science: 'REDWideGamutRGB for extreme grading flexibility',
    best_for: ['Low light nightmares', 'Extreme detail', 'Heavy color grading']
  },
  
  lenses: {
    manufacturer: 'Leica',
    series: 'Summilux-C',
    format: 'Spherical full frame',
    focal_lengths: [
      { mm: '18mm', use_case: 'Surveillance wide shots', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Deep', bokeh_quality: 'Clinical', distortion: 'Controlled' },
      { mm: '25mm', use_case: 'Environmental control', aperture_sweet_spot: 'f/2', depth_of_field: 'Medium-deep', bokeh_quality: 'Neutral', distortion: 'Minimal' },
      { mm: '35mm', use_case: 'Standard obsession', aperture_sweet_spot: 'f/1.8', depth_of_field: 'Medium', bokeh_quality: 'Clean circles', distortion: 'None' },
      { mm: '50mm', use_case: 'Portrait of dread', aperture_sweet_spot: 'f/1.4', depth_of_field: 'Shallow', bokeh_quality: 'Buttery clinical', distortion: 'None' },
      { mm: '75mm', use_case: 'Intimate unease', aperture_sweet_spot: 'f/1.4', depth_of_field: 'Very shallow', bokeh_quality: 'Creamy', distortion: 'None' },
      { mm: '100mm', use_case: 'Detail fetishism', aperture_sweet_spot: 'f/2', depth_of_field: 'Ultra shallow', bokeh_quality: 'Compressed', distortion: 'None' }
    ],
    characteristics: ['Clinical sharpness', 'Neutral color', 'Perfect contrast', 'No character flaws'],
    flare_characteristics: 'Minimal, controlled - flares are mistakes',
    cost_tier: 'Ultra-Premium'
  },
  
  lighting: {
    key_style: 'Low-key noir',
    key_ratio: '8:1 or higher - deep shadows',
    fill_approach: 'Negative fill, embrace darkness',
    backlight: 'Subtle separation, not glamorous',
    color_temperature: {
      key: '4000K slightly warm for skin',
      fill: '5600K blue cold',
      accent: 'Practicals as designed'
    },
    practicals: ['Desk lamps', 'Monitors', 'Fluorescents', 'Street lights', 'Car headlights'],
    motivated_sources: ['Computer screens', 'Single windows', 'Overhead fluorescents'],
    signature_setup: 'Single motivated source with deep shadows. Practicals as key lights. Green/blue color temperature contrast. Overhead fluorescents for institutional dread. Every light has a logical source.'
  },
  
  color_grading: {
    primary_palette: ['Sickly green', 'Teal blue', 'Copper brown', 'Deep shadow black'],
    shadows: { hue: 'Deep black-green', saturation: '10%', lift: '-0.2 crushed' },
    midtones: { hue: 'Desaturated teal', saturation: '60%', gamma: '0.9 dark' },
    highlights: { hue: 'Copper/amber', saturation: '20%', gain: '0' },
    overall_saturation: '50-60% desaturated',
    contrast: 'Extreme high contrast, crushed blacks, controlled highlights',
    film_emulation: 'ENR silver retention process - increased contrast and desaturation',
    grain: { intensity: 'Fine controlled', size: '35mm equivalent', character: 'Technical not organic' }
  },
  
  depth_of_field: {
    philosophy: 'Deep focus for paranoia, shallow for obsessive detail',
    wide_shots: { aperture: 'f/5.6-f/8', focus_distance: 'Hyperfocal', description: 'Everything sharp - nothing escapes attention' },
    medium_shots: { aperture: 'f/2.8', focus_distance: 'Subject precise', description: 'Subject surgical, background threatening' },
    close_ups: { aperture: 'f/2', focus_distance: 'Eyes', description: 'Eyes sharp, skin detailed' },
    extreme_close_ups: { aperture: 'f/2.8', focus_distance: 'Detail', description: 'Forensic detail examination' },
    rack_focus: false,
    focus_pulls: ['Rarely used - too emotional']
  },
  
  framing: {
    aspect_ratio: '2.39:1 scope for claustrophobia',
    headroom: 'Minimal - oppressive',
    lead_room: 'Precise - calculated',
    nose_room: 'Often violated for unease',
    symmetry: { use: true, when: 'Power, control, Kubrickian moments' },
    rule_of_thirds: true,
    center_framing: { use: true, when: 'Symmetrical power shots' },
    negative_space: 'Precisely calculated, threatening emptiness',
    safe_areas: { action: '90%', title: '80%' }
  },
  
  movement: {
    philosophy: 'Camera moves with purpose only. Motion equals meaning.',
    static: { when: ['Tension holding', 'Power compositions', 'Most dialogue'], motivation: 'Stillness is control' },
    handheld: { when: ['Never - too chaotic'], intensity: 'N/A' },
    steadicam: { when: ['Following through spaces', 'Surveillance shots'], speed: 'Slow, methodical' },
    dolly: { when: ['Slow reveals', 'Push for emphasis', 'Impossible moves'], track_type: 'Precise, curved when needed' },
    crane: { when: ['Establishing surveillance', 'Impossible through-wall moves'], height: 'As needed for shot' },
    drone: { when: ['Rarely - too organic'], altitude: 'N/A' },
    speed: 'Slow, deliberate, inexorable'
  },
  
  shot_library: {
    wide_establishing: createShotSpec({
      lens_mm: '18mm', aperture: 'f/5.6', camera_height: 'Surveillance high', camera_angle: 'Slight down',
      movement: 'Slow creeping dolly', lighting_key: 'Low-key practical',
      framing: 'Geometric symmetry', depth_of_field: 'Deep',
      prompt_template: 'Wide establishing shot, David Fincher precision, symmetrical composition, low-key lighting, green/teal color cast, surveillance perspective, deep shadows, institutional environment, clinical and cold',
      edit_prompt: 'Pull back to Fincher wide: symmetrical framing, desaturated teal, deep shadows, surveillance feel'
    }),
    wide_environment: createShotSpec({
      lens_mm: '25mm', aperture: 'f/4', camera_height: 'Eye level precise', camera_angle: 'Straight symmetrical',
      movement: 'Static or slow dolly', lighting_key: 'Motivated practicals',
      framing: 'Geometric precision', depth_of_field: 'Deep',
      prompt_template: 'Environmental shot, Fincher/Cronenweth precision, {subject} in controlled space, practical lighting sources visible, desaturated palette, clinical atmosphere',
      edit_prompt: 'Reframe as environmental: show controlled space, add practical light sources, desaturate'
    }),
    medium_full: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Static or slow push', lighting_key: 'Low-key motivated',
      framing: 'Full body precise', depth_of_field: 'Medium',
      prompt_template: 'Medium full shot, {subject} full body, Fincher precise framing, low-key lighting, sickly green cast, shadows eating the frame, controlled composition',
      edit_prompt: 'Adjust to medium full: full body visible, Fincher symmetry, low-key lighting'
    }),
    medium_narrative: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Straight or slight angle',
      movement: 'Static with slow push', lighting_key: 'Practical key light',
      framing: 'Waist up, calculated', depth_of_field: 'Selective',
      prompt_template: 'Medium narrative shot, {subject} waist-up, Fincher intensity, single source lighting, deep shadows on face, desaturated color, tension in stillness',
      edit_prompt: 'Reframe medium: waist up, single source lighting, deep shadows, Fincher tension'
    }),
    medium_close: createShotSpec({
      lens_mm: '50mm', aperture: 'f/1.8', camera_height: 'Eye level', camera_angle: 'Straight clinical',
      movement: 'Imperceptible push', lighting_key: 'Side key with shadow',
      framing: 'Chest up, intimate threat', depth_of_field: 'Shallow',
      prompt_template: 'Medium close-up, {subject} chest and face, Cronenweth side lighting, half face in shadow, shallow focus, clinical examination, cold beauty',
      edit_prompt: 'Push to medium close: chest and face, strong side lighting, half shadow'
    }),
    close_up_emotional: createShotSpec({
      lens_mm: '50mm', aperture: 'f/1.4', camera_height: 'Eye level', camera_angle: 'Straight confrontational',
      movement: 'Completely static', lighting_key: 'Single source drama',
      framing: 'Face as evidence', depth_of_field: 'Very shallow',
      prompt_template: 'Close-up examination, {subject} face filling frame, Fincher clinical gaze, single source creating shadow division, desaturated skin, eyes revealing everything, cold and precise',
      edit_prompt: 'Transform to Fincher close-up: face fills frame, strong shadow division, clinical examination'
    }),
    close_up_profile: createShotSpec({
      lens_mm: '75mm', aperture: 'f/1.4', camera_height: 'Eye level', camera_angle: '90 degree profile',
      movement: 'Static', lighting_key: 'Rim and fill',
      framing: 'Noir profile', depth_of_field: 'Ultra shallow',
      prompt_template: 'Profile close-up, {subject} in noir profile, strong rim light, face half-lit, Fincher psychological portrait, shallow focus, contemplative menace',
      edit_prompt: 'Reframe to profile: 90 degree side, strong rim light, noir mood'
    }),
    extreme_close_up: createShotSpec({
      lens_mm: '100mm', aperture: 'f/2.8', camera_height: 'Object level', camera_angle: 'Forensic',
      movement: 'Static examination', lighting_key: 'Detail revealing',
      framing: 'Forensic isolation', depth_of_field: 'Paper thin',
      prompt_template: 'Extreme close-up, {detail} in forensic examination, Fincher obsessive detail, clinical lighting, every texture visible, evidence photography aesthetic',
      edit_prompt: 'Push to extreme close: forensic detail, clinical lighting, obsessive focus'
    }),
    detail_insert: createShotSpec({
      lens_mm: '100mm', aperture: 'f/2.8', camera_height: 'Tabletop', camera_angle: 'Evidence angle',
      movement: 'Static or slow reveal', lighting_key: 'Forensic practical',
      framing: 'Object as clue', depth_of_field: 'Selective',
      prompt_template: 'Detail insert, {object} as evidence, Fincher procedural aesthetic, practical lighting, forensic examination quality, meaningful object isolated',
      edit_prompt: 'Create detail insert: isolate object, forensic lighting, evidence aesthetic'
    }),
    overhead_god_view: createShotSpec({
      lens_mm: '18mm', aperture: 'f/5.6', camera_height: 'Directly above', camera_angle: '90 degrees down',
      movement: 'Static surveillance', lighting_key: 'Even fluorescent',
      framing: 'Surveillance grid', depth_of_field: 'Deep',
      prompt_template: 'Overhead surveillance shot, {subject} from directly above, Fincher god POV, geometric patterns, fluorescent institutional lighting, clinical observation',
      edit_prompt: 'Transform to overhead: surveillance angle, 90 degrees down, geometric patterns'
    }),
    low_angle_power: createShotSpec({
      lens_mm: '25mm', aperture: 'f/2.8', camera_height: 'Below eye level', camera_angle: 'Looking up 20 degrees',
      movement: 'Slow rise', lighting_key: 'Underlit dramatic',
      framing: 'Threatening presence', depth_of_field: 'Deep',
      prompt_template: 'Low angle threat shot, {subject} towering slightly, underlit face, Fincher menace, controlled power, clinical composition',
      edit_prompt: 'Shift to low angle: looking up at subject, underlit for threat'
    }),
    high_angle_vulnerable: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Above', camera_angle: 'Looking down 30 degrees',
      movement: 'Static observing', lighting_key: 'Top down isolation',
      framing: 'Subject diminished', depth_of_field: 'Medium',
      prompt_template: 'High angle observation, {subject} diminished below, Fincher surveillance, cold observation, clinical distance, subject vulnerable',
      edit_prompt: 'Reframe from above: high angle, surveillance observation, clinical distance'
    }),
    dutch_angle_tension: createShotSpec({
      lens_mm: '25mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Tilted 10-15 degrees',
      movement: 'Static unease', lighting_key: 'Noir dramatic',
      framing: 'World off-axis', depth_of_field: 'Medium',
      prompt_template: 'Dutch angle unease, subtle tilt 12 degrees, {subject} in unstable frame, Fincher psychological tension, noir lighting, world slightly wrong',
      edit_prompt: 'Apply subtle dutch: 12 degree tilt, psychological unease, noir lighting'
    }),
    pov_subjective: createShotSpec({
      lens_mm: '25mm', aperture: 'f/2.8', camera_height: 'Subject eye level', camera_angle: 'Their POV',
      movement: 'Methodical movement', lighting_key: 'As environment',
      framing: 'First person precision', depth_of_field: 'Selective',
      prompt_template: 'POV shot, first person perspective, seeing what {subject} sees, methodical movement through space, Fincher precision, cold observation',
      edit_prompt: 'Convert to POV: first person, methodical movement, clinical observation'
    }),
    over_shoulder: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2', camera_height: 'Shoulder', camera_angle: 'Past shoulder',
      movement: 'Static or subtle', lighting_key: 'Motivated source',
      framing: 'Observation through other', depth_of_field: 'Shallow on subject',
      prompt_template: 'Over shoulder observation, {subject} through silhouette, Fincher framing, motivated light source, clinical distance, shallow focus on main subject',
      edit_prompt: 'Add over-shoulder: foreground silhouette, main subject sharp, clinical framing'
    }),
    two_shot: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Static tension', lighting_key: 'Split between them',
      framing: 'Both in confrontation', depth_of_field: 'Both in focus',
      prompt_template: 'Two shot confrontation, {subjects} in frame, Fincher power dynamics, lighting split between them, tension in stillness, clinical observation of relationship',
      edit_prompt: 'Compose as two-shot: two figures, power dynamics visible, split lighting'
    })
  },
  
  ai_prompts: {
    style_prefix: 'David Fincher directing, Jeff Cronenweth cinematography, clinical precision, low-key noir lighting, desaturated green/teal color palette, symmetrical composition, deep shadows, 2.39:1 scope, controlled menace, institutional fluorescents, practical light sources',
    master_shot_template: 'Wide master shot, {scene_description}, David Fincher precision, Cronenweth low-key lighting, symmetrical composition, desaturated teal, deep shadows, surveillance perspective, clinical and cold, 25mm Leica Summilux',
    performance_template: 'Performance shot, {artist} in Fincher frame, clinical beauty lighting, half face in shadow, desaturated skin tones, confrontational gaze, single practical source, psychological intensity',
    broll_template: 'Clinical B-roll, {description}, Fincher obsessive detail, forensic lighting, no people, institutional environments, fluorescent overhead, desaturated palette, evidence photography quality',
    emotional_template: 'Intense close-up, {description}, Fincher clinical examination, single source shadow division, desaturated skin, eyes as windows to psychology, razor focus, cold precision',
    action_template: 'Controlled action shot, {description}, Fincher precision in chaos, impossible camera move, methodical pacing, every element controlled, slow-motion for forensic detail',
    negative_prompt: 'warm golden lighting, saturated colors, handheld shakiness, organic natural light, lens flares, soft contrast, lifted blacks, warm skin tones, documentary style'
  },
  
  variation_config: {
    max_variations_per_scene: 4,
    variation_types: ['wide_establishing', 'close_up_emotional', 'detail_insert', 'overhead_god_view'],
    energy_based_selection: true,
    beat_sync_enabled: true
  },
  
  // 🎬 EDITING STYLE - David Fincher: Surgical precision, methodical rhythm
  editing_style: {
    philosophy: 'Every cut is a scalpel. Precision builds dread. Control is power.',
    pace_modifier: 1.0,           // Exactly on tempo - metronome precision
    minimum_cut_duration: 0.5,    // Can be fast when needed
    maximum_cut_duration: 6.0,    // Hold for psychological tension
    beat_alignment: 'downbeat',   // Precise, never sloppy
    hold_on_emotion: true,        // Let uncomfortable moments linger
    emotion_hold_multiplier: 1.5, // 50% longer on intensity
    accelerate_on_energy: false,  // Never lose control, even in chaos
    energy_acceleration: 1.0,     // Maintain the same measured pace
    transition_preferences: {
      intro: 'fade',
      verse: 'cut',
      chorus: 'cut',
      bridge: 'dissolve',
      drop: 'cut',
      outro: 'fade'
    },
    cut_patterns: {
      use_jump_cuts: false,       // Never jarring
      use_match_cuts: true,       // Elegant transitions
      use_j_cuts: true,
      use_l_cuts: true,
      use_smash_cuts: false       // Too crude
    },
    section_beat_overrides: {
      intro: 2.0,                 // Establish the cold world
      verse: 1.2,                 // Measured storytelling
      chorus: 0.8,                // Slight acceleration
      drop: 0.6,                  // Controlled chaos
      bridge: 1.5,                // Tension building
      outro: 2.0                  // Cold resolution
    }
  }
};

// =============================================================================
// CONTINUE WITH REMAINING 7 PROFILES...
// Due to length, creating separate continuation
// =============================================================================

// Export all profiles
export const DIRECTOR_DP_PROFILES: Record<string, DirectorDPProfile> = {
  'spike-jonze': SPIKE_JONZE_LUBEZKI,
  'spike-jonze-lubezki': SPIKE_JONZE_LUBEZKI,
  'Spike Jonze': SPIKE_JONZE_LUBEZKI,
  
  'hype-williams': HYPE_WILLIAMS_KHONDJI,
  'hype-williams-khondji': HYPE_WILLIAMS_KHONDJI,
  'Hype Williams': HYPE_WILLIAMS_KHONDJI,
  
  'david-fincher': DAVID_FINCHER_CRONENWETH,
  'david-fincher-cronenweth': DAVID_FINCHER_CRONENWETH,
  'David Fincher': DAVID_FINCHER_CRONENWETH,
};

/**
 * Get Director+DP Profile by director name
 */
export function getDirectorDPProfile(directorName: string): DirectorDPProfile | undefined {
  // Normalize the name for lookup
  const normalized = directorName.toLowerCase().replace(/\s+/g, '-');
  return DIRECTOR_DP_PROFILES[directorName] || DIRECTOR_DP_PROFILES[normalized];
}

/**
 * Get all available Director+DP profiles
 */
export function getAllDirectorDPProfiles(): DirectorDPProfile[] {
  const seen = new Set<string>();
  return Object.values(DIRECTOR_DP_PROFILES).filter(profile => {
    if (seen.has(profile.id)) return false;
    seen.add(profile.id);
    return true;
  });
}

/**
 * Get shot specification for a specific shot type
 */
export function getShotSpec(profile: DirectorDPProfile, shotType: keyof DirectorDPProfile['shot_library']): ShotSpec {
  return profile.shot_library[shotType];
}

/**
 * Build complete prompt for scene generation
 */
export function buildScenePrompt(
  profile: DirectorDPProfile,
  sceneDescription: string,
  shotType: keyof DirectorDPProfile['shot_library']
): string {
  const shot = profile.shot_library[shotType];
  return `${profile.ai_prompts.style_prefix}

${shot.prompt_template.replace('{subject}', sceneDescription).replace('{scene_description}', sceneDescription)}

Technical: ${shot.lens_mm} at ${shot.aperture}, ${shot.lighting_key}, ${shot.camera_movement}, ${shot.depth_of_field} depth of field

${profile.ai_prompts.negative_prompt ? `Avoid: ${profile.ai_prompts.negative_prompt}` : ''}`;
}

/**
 * Get edit prompt for shot variation
 */
export function getVariationEditPrompt(
  profile: DirectorDPProfile,
  targetShotType: keyof DirectorDPProfile['shot_library']
): string {
  return profile.shot_library[targetShotType].edit_prompt;
}
