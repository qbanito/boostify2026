/**
 * 🎬 DIRECTOR + DP PROFILES PART 3
 * Final 4 Director+DP pairings: Baz Luhrmann, Wes Anderson, Christopher Nolan, Quentin Tarantino
 */

import type { DirectorDPProfile, ShotSpec } from './types/cinematography';

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
// 7. BAZ LUHRMANN + MANDY WALKER
// =============================================================================

export const BAZ_LUHRMANN_WALKER: DirectorDPProfile = {
  id: 'baz-luhrmann-walker',
  version: '1.0.0',
  
  director: {
    name: 'Baz Luhrmann',
    visual_philosophy: 'Theatre is cinema, cinema is theatre. Maximum spectacle, maximum emotion.',
    signature_techniques: [
      'Theatrical excess and spectacle',
      'Mixed period anachronisms',
      'Music as narrative driver',
      'Rapid montage editing',
      'Saturated jewel-tone colors',
      'Grand romantic gestures'
    ],
    narrative_style: 'Epic romantic tragedy, theatrical spectacle, operatic emotion',
    emotional_language: 'Passion, tragedy, ecstasy, heartbreak at volume 11',
    pacing: 'Frenetic peaks, romantic valleys, operatic dynamics',
    iconic_works: [
      { title: 'Moulin Rouge!', year: 2001, visual_highlight: 'Bohemian theatrical excess' },
      { title: 'Romeo + Juliet', year: 1996, visual_highlight: 'Miami Vice Shakespeare' },
      { title: 'The Great Gatsby', year: 2013, visual_highlight: 'Jazz Age opulence' },
      { title: 'Elvis', year: 2022, visual_highlight: 'Showman spectacle' }
    ],
    influences: ['Opera', 'Broadway', 'MTV', 'Bollywood'],
    awards: ['BAFTA', 'Golden Globe', 'Academy Award nominations']
  },
  
  cinematographer: {
    name: 'Mandy Walker',
    technical_philosophy: 'Light should feel like emotion made visible. Theatrical yet intimate.',
    signature_look: 'Rich saturated theatrical lighting with intimate portraiture capability',
    legendary_technique: 'First woman to win ASC Award for Theatrical Feature',
    famous_collaborations: ['Baz Luhrmann', 'George Miller', 'John Curran'],
    camera_preference: 'ARRI Alexa 65 for scope and color',
    lens_preference: 'Panavision Sphero 65 for vintage theatrical quality',
    lighting_philosophy: 'Theatre-style motivated lighting adapted for cinema intimacy.',
    awards: ['ASC Award for Elvis', 'ACS Golden Tripod']
  },
  
  collaboration: {
    synergy_score: 94,
    visual_harmony: 'Theatrical bombast meets painterly intimacy. Spectacle with soul.',
    combined_signature: 'Jewel-toned theatrical excess with surprising emotional intimacy',
    best_for_genres: ['Music Videos', 'Musical', 'Romance', 'Period Drama', 'Spectacle'],
    combined_influences: ['Theatre Lighting', 'Old Hollywood', 'Music Video Golden Age']
  },
  
  camera: {
    name: 'ARRI Alexa 65',
    sensor_format: '65mm digital',
    resolution: '6.5K',
    dynamic_range: '14+ stops',
    color_science: 'ARRI LogC for rich theatrical grading',
    best_for: ['Theatrical spectacle', 'Rich color', 'Large format intimacy']
  },
  
  lenses: {
    manufacturer: 'Panavision',
    series: 'Sphero 65',
    format: 'Spherical 65mm vintage character',
    focal_lengths: [
      { mm: '35mm', use_case: 'Wide spectacle', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Medium-deep', bokeh_quality: 'Warm swirl', distortion: 'Vintage character' },
      { mm: '50mm', use_case: 'Standard glamour', aperture_sweet_spot: 'f/2', depth_of_field: 'Medium', bokeh_quality: 'Romantic', distortion: 'Minimal' },
      { mm: '65mm', use_case: 'Portrait spectacle', aperture_sweet_spot: 'f/1.8', depth_of_field: 'Selective', bokeh_quality: 'Dreamlike', distortion: 'None' },
      { mm: '85mm', use_case: 'Intimate romance', aperture_sweet_spot: 'f/1.4', depth_of_field: 'Shallow', bokeh_quality: 'Buttery', distortion: 'None' },
      { mm: '100mm', use_case: 'Romantic close-up', aperture_sweet_spot: 'f/2', depth_of_field: 'Very shallow', bokeh_quality: 'Creamy', distortion: 'None' },
      { mm: '150mm', use_case: 'Compressed romance', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Very shallow', bokeh_quality: 'Stacked', distortion: 'None' }
    ],
    characteristics: ['Vintage warmth', 'Romantic falloff', 'Rich contrast', 'Theatrical flares'],
    flare_characteristics: 'Warm theatrical flares, rainbow streaks, embraced for romance',
    cost_tier: 'Ultra-Premium'
  },
  
  lighting: {
    key_style: 'Theatrical high-key with drama',
    key_ratio: '3:1 glamorous',
    fill_approach: 'Bounce for glow, controlled shadows',
    backlight: 'Strong theatrical rim for separation and glow',
    color_temperature: {
      key: '3200K warm tungsten',
      fill: '4500K neutral bounce',
      accent: 'Saturated colored gels'
    },
    practicals: ['Theatre lights', 'Chandeliers', 'Candelabras', 'Neon signs', 'Fairy lights'],
    motivated_sources: ['Stage lighting', 'Window with diffusion', 'Practical lamps'],
    signature_setup: 'Theatre-style three-point with saturated colored backlights. Key light through diffusion for glamour. Strong practical sources visible in frame. Every light tells a story of the theatrical world.'
  },
  
  color_grading: {
    primary_palette: ['Rich red', 'Deep gold', 'Emerald green', 'Sapphire blue', 'Hot pink'],
    shadows: { hue: 'Deep rich color', saturation: '30%', lift: '+0.02' },
    midtones: { hue: 'Saturated warm', saturation: '130%', gamma: '1.05' },
    highlights: { hue: 'Golden warm', saturation: '40%', gain: '+0.1' },
    overall_saturation: '130-150% - pushed to theatrical',
    contrast: 'Rich contrast with preserved shadow detail',
    film_emulation: 'Technicolor-inspired with modern twist',
    grain: { intensity: 'Medium period', size: '65mm', character: 'Vintage glamour' }
  },
  
  depth_of_field: {
    philosophy: 'Shallow for romance, deep for spectacle revelation',
    wide_shots: { aperture: 'f/4', focus_distance: 'Staged', description: 'Theatre revealed' },
    medium_shots: { aperture: 'f/2.8', focus_distance: 'Subject', description: 'Star in world' },
    close_ups: { aperture: 'f/1.8', focus_distance: 'Eyes', description: 'Romantic intensity' },
    extreme_close_ups: { aperture: 'f/2', focus_distance: 'Detail', description: 'Jewel-like focus' },
    rack_focus: true,
    focus_pulls: ['For romantic reveals', 'Character entrances', 'Emotional beats']
  },
  
  framing: {
    aspect_ratio: '2.39:1 for epic romance',
    headroom: 'Variable - tight for intensity',
    lead_room: 'Dynamic for movement',
    nose_room: 'Theatrical, often direct',
    symmetry: { use: true, when: 'Grand theatrical moments' },
    rule_of_thirds: true,
    center_framing: { use: true, when: 'Star moments, proclamations' },
    negative_space: 'Filled with spectacle or used for romance',
    safe_areas: { action: '90%', title: '85%' }
  },
  
  movement: {
    philosophy: 'Camera dances with the spectacle. Movement is choreography.',
    static: { when: ['Intimate romantic pauses'], motivation: 'Let love breathe' },
    handheld: { when: ['Chaos moments', 'Crowd frenzy'], intensity: 'Energetic but controlled' },
    steadicam: { when: ['Moving through spectacle', 'Following stars'], speed: 'Musical rhythm' },
    dolly: { when: ['Romantic approaches', 'Star reveals'], track_type: 'Curved for drama' },
    crane: { when: ['Grand reveals', 'Spectacle overview', 'Climactic moments'], height: 'Epic scale' },
    drone: { when: ['Establishing grandeur'], altitude: 'Majestic' },
    speed: 'Matches music tempo, operatic dynamics'
  },
  
  shot_library: {
    wide_establishing: createShotSpec({
      lens_mm: '35mm', aperture: 'f/4', camera_height: 'Grand entrance level', camera_angle: 'Theatrical',
      movement: 'Slow crane reveal', lighting_key: 'Theatrical saturated',
      framing: 'Spectacle staging', depth_of_field: 'Medium-deep',
      prompt_template: 'Grand wide establishing, theatrical spectacle, Baz Luhrmann maximalism, Mandy Walker saturated lighting, rich jewel tones, grand production design, 35mm large format, Moulin Rouge aesthetic, operatic scale',
      edit_prompt: 'Pull back to grand wide: theatrical spectacle revealed, saturated jewel tones, Luhrmann maximalism'
    }),
    wide_environment: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Stage level', camera_angle: 'Into spectacle',
      movement: 'Dancing steadicam', lighting_key: 'Theatrical practicals',
      framing: 'Stars in grand world', depth_of_field: 'Medium',
      prompt_template: 'Wide theatrical environment, {subject} in spectacular setting, saturated colored lighting, Luhrmann period excess, Walker theatrical cinematography, 50mm large format',
      edit_prompt: 'Reframe environmental: show theatrical setting, saturated colors, spectacle'
    }),
    medium_full: createShotSpec({
      lens_mm: '65mm', aperture: 'f/2.8', camera_height: 'Stage level', camera_angle: 'Performance angle',
      movement: 'Following performer', lighting_key: 'Stage lighting',
      framing: 'Full figure theatrical', depth_of_field: 'Medium',
      prompt_template: 'Medium full theatrical, {subject} full figure in costume, stage lighting creating drama, Luhrmann showman framing, saturated colors, vintage glamour',
      edit_prompt: 'Adjust to medium full: full figure, theatrical staging, saturated lighting'
    }),
    medium_narrative: createShotSpec({
      lens_mm: '65mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Romantic',
      movement: 'Gentle approach', lighting_key: 'Beauty with color',
      framing: 'Waist up romantic', depth_of_field: 'Selective',
      prompt_template: 'Medium romantic shot, {subject} waist-up, warm beauty lighting, theatrical colored accents, Luhrmann passion, Walker portrait quality, shallow vintage focus',
      edit_prompt: 'Reframe medium romantic: waist up, beauty lighting, theatrical color accents'
    }),
    medium_close: createShotSpec({
      lens_mm: '85mm', aperture: 'f/1.8', camera_height: 'Eye level', camera_angle: 'Intimate',
      movement: 'Slow push in', lighting_key: 'Romantic beauty',
      framing: 'Chest up passion', depth_of_field: 'Shallow',
      prompt_template: 'Medium close romantic, {subject} chest and face, romantic beauty lighting, shallow 65mm focus, theatrical warmth, Luhrmann intimate spectacle',
      edit_prompt: 'Push to medium close: chest and face, romantic lighting, shallow focus'
    }),
    close_up_emotional: createShotSpec({
      lens_mm: '85mm', aperture: 'f/1.4', camera_height: 'Eye level', camera_angle: 'Direct romantic',
      movement: 'Almost imperceptible', lighting_key: 'Beauty perfection',
      framing: 'Face as spectacle', depth_of_field: 'Very shallow',
      prompt_template: 'Romantic close-up, {subject} face filling frame, perfect beauty lighting, eyes glistening with passion, shallow vintage focus, Luhrmann emotional excess, theatrical beauty',
      edit_prompt: 'Transform to romantic close-up: face fills frame, beauty perfection, glistening eyes'
    }),
    close_up_profile: createShotSpec({
      lens_mm: '100mm', aperture: 'f/1.8', camera_height: 'Eye level', camera_angle: 'Profile',
      movement: 'Static romantic', lighting_key: 'Rim with soft key',
      framing: 'Profile passion', depth_of_field: 'Ultra shallow',
      prompt_template: 'Profile romantic shot, {subject} in yearning profile, beautiful rim light, Luhrmann romantic framing, shallow 65mm focus, theatrical longing',
      edit_prompt: 'Reframe to profile: romantic profile, beautiful rim light, longing'
    }),
    extreme_close_up: createShotSpec({
      lens_mm: '100mm', aperture: 'f/2', camera_height: 'Detail level', camera_angle: 'Intimate',
      movement: 'Static worship', lighting_key: 'Jewel lighting',
      framing: 'Detail as treasure', depth_of_field: 'Paper thin',
      prompt_template: 'Extreme close-up, {detail} as precious detail, sparkling theatrical lighting, jewel-like focus, Luhrmann attention to spectacle detail',
      edit_prompt: 'Push to extreme close: precious detail, sparkling light, jewel-like'
    }),
    detail_insert: createShotSpec({
      lens_mm: '85mm', aperture: 'f/2.8', camera_height: 'Tabletop', camera_angle: 'Romantic',
      movement: 'Slow reveal', lighting_key: 'Theatrical practical',
      framing: 'Object with meaning', depth_of_field: 'Selective',
      prompt_template: 'Detail insert, {object} as romantic symbol, theatrical lighting, saturated color, Luhrmann meaningful prop, vintage glamour quality',
      edit_prompt: 'Create detail insert: symbolic object, theatrical lighting, romantic meaning'
    }),
    overhead_god_view: createShotSpec({
      lens_mm: '35mm', aperture: 'f/4', camera_height: 'High crane', camera_angle: 'Looking down',
      movement: 'Slow spiraling descent', lighting_key: 'Stage lighting',
      framing: 'Choreography visible', depth_of_field: 'Medium',
      prompt_template: 'Overhead spectacle, looking down at {subject}, theatrical staging visible, saturated colors from above, Luhrmann choreography, grand descent feel',
      edit_prompt: 'Transform to overhead: grand view, choreography visible, theatrical lighting'
    }),
    low_angle_power: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Stage floor', camera_angle: 'Looking up',
      movement: 'Static or slow rise', lighting_key: 'Backlit star',
      framing: 'Star worship', depth_of_field: 'Medium',
      prompt_template: 'Low angle star shot, {subject} as theatrical star, looking up in worship, backlit glory, Luhrmann showman aesthetic, saturated theatrical excess',
      edit_prompt: 'Shift to low angle: star worship, backlit, theatrical glory'
    }),
    high_angle_vulnerable: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Above', camera_angle: 'Looking down tender',
      movement: 'Slow descent', lighting_key: 'Top soft',
      framing: 'Romantic vulnerability', depth_of_field: 'Medium',
      prompt_template: 'High angle tender, looking down at {subject}, romantic vulnerability, soft top lighting, Luhrmann emotional beat, theatrical intimacy',
      edit_prompt: 'Reframe from above: tender high angle, romantic vulnerability'
    }),
    dutch_angle_tension: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Tilted 15 degrees',
      movement: 'Dramatic tilt', lighting_key: 'Theatrical drama',
      framing: 'World spinning', depth_of_field: 'Medium',
      prompt_template: 'Dutch angle drama, tilted 15 degrees, {subject} in emotional turmoil, saturated theatrical lighting, Luhrmann passionate chaos',
      edit_prompt: 'Apply dutch angle: 15 degree tilt, emotional turmoil, theatrical chaos'
    }),
    pov_subjective: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Subject eyes', camera_angle: 'Their romantic POV',
      movement: 'Romantic approach', lighting_key: 'What they see',
      framing: 'First person wonder', depth_of_field: 'Selective',
      prompt_template: 'POV romantic, first person seeing what {subject} sees, approaching love interest, theatrical world, Luhrmann romantic immersion',
      edit_prompt: 'Convert to POV: romantic first person, approaching wonder'
    }),
    over_shoulder: createShotSpec({
      lens_mm: '85mm', aperture: 'f/2', camera_height: 'Shoulder', camera_angle: 'Romantic past shoulder',
      movement: 'Gentle breathing', lighting_key: 'Beauty both',
      framing: 'Looking at love', depth_of_field: 'Shallow on object of affection',
      prompt_template: 'Over shoulder romance, {subject} seen past shoulder, romantic longing, shallow focus on love, Luhrmann intimate framing',
      edit_prompt: 'Add over-shoulder: romantic gaze, shallow focus on love interest'
    }),
    two_shot: createShotSpec({
      lens_mm: '65mm', aperture: 'f/2.8', camera_height: 'Romantic level', camera_angle: 'Balanced',
      movement: 'Encircling or static', lighting_key: 'Beauty for both',
      framing: 'Lovers together', depth_of_field: 'Both sharp',
      prompt_template: 'Two shot romance, {subjects} together, theatrical lighting on both, Luhrmann romantic pairing, saturated beauty, relationship visible',
      edit_prompt: 'Compose as romantic two-shot: lovers framed, theatrical beauty, relationship visible'
    })
  },
  
  ai_prompts: {
    style_prefix: 'Baz Luhrmann directing, Mandy Walker cinematography, theatrical maximalism, saturated jewel-tone colors, rich period production design, dramatic lighting with colored accents, 65mm large format, 2.39:1 scope, operatic emotion, Moulin Rouge aesthetic',
    master_shot_template: 'Grand theatrical master, {scene_description}, Baz Luhrmann spectacle, Walker saturated cinematography, jewel-tone colors, period excess, theatrical lighting, 35mm large format scope',
    performance_template: 'Theatrical performance shot, {artist} as star, Luhrmann showman framing, saturated beauty lighting, theatrical colored accents, vintage glamour, 65mm romantic focus',
    broll_template: 'Theatrical B-roll, {description}, Luhrmann period excess, saturated colors, no people or background activity, rich production design, theatrical lighting, vintage glamour',
    emotional_template: 'Romantic close-up, {description}, Luhrmann passionate framing, Walker beauty lighting, glistening eyes, shallow 65mm focus, theatrical warmth, operatic emotion',
    action_template: 'Theatrical action, {description}, Luhrmann kinetic spectacle, saturated colors in motion, dancing camera, matched to music, theatrical excess, 65mm scope',
    negative_prompt: 'desaturated muted colors, minimalist design, cold blue lighting, documentary style, static camera, natural lighting, modern aesthetic, understated emotion'
  },
  
  variation_config: {
    max_variations_per_scene: 5,
    variation_types: ['wide_establishing', 'medium_close', 'close_up_emotional', 'detail_insert', 'low_angle_power'],
    energy_based_selection: true,
    beat_sync_enabled: true
  },
  
  // 🎬 EDITING STYLE - Baz Luhrmann: Theatrical, operatic, explosive energy
  editing_style: {
    philosophy: 'Spectacle demands rhythm! Every cut is a dance beat. Opera in editing.',
    pace_modifier: 0.7,           // 30% FASTER - theatrical energy
    minimum_cut_duration: 0.3,    // Flash cuts for spectacle
    maximum_cut_duration: 4.0,    // Hold for romantic crescendos
    beat_alignment: 'any_beat',   // Cut on everything, musical
    hold_on_emotion: true,        // Hold on romantic peaks
    emotion_hold_multiplier: 1.5, // 50% longer on passion
    accelerate_on_energy: true,
    energy_acceleration: 0.5,     // Double speed on climax
    transition_preferences: {
      intro: 'fade',              // Curtain rises
      verse: 'dissolve',          // Romantic dissolves
      chorus: 'flash',            // Theatrical flash
      bridge: 'wipe',             // Stage wipes
      drop: 'flash',              // Explosive
      outro: 'fade'
    },
    cut_patterns: {
      use_jump_cuts: true,        // Theatrical effect
      use_match_cuts: true,       // Dancing cuts
      use_j_cuts: true,
      use_l_cuts: true,
      use_smash_cuts: true        // Operatic impact
    },
    section_beat_overrides: {
      intro: 1.0,                 // Curtain up
      verse: 0.9,                 // Theatrical verse
      chorus: 0.5,                // EXPLOSIVE chorus
      drop: 0.4,                  // Maximum spectacle
      bridge: 1.2,                // Romantic breathing
      outro: 1.5                  // Curtain fall
    }
  }
};

// =============================================================================
// 8. WES ANDERSON + ROBERT YEOMAN
// =============================================================================

export const WES_ANDERSON_YEOMAN: DirectorDPProfile = {
  id: 'wes-anderson-yeoman',
  version: '1.0.0',
  
  director: {
    name: 'Wes Anderson',
    visual_philosophy: 'Perfect symmetry and precise color create emotional worlds of controlled whimsy.',
    signature_techniques: [
      'Perfect symmetrical framing',
      'Pastel color palettes',
      'Tableaux compositions',
      'Whip pans between scenes',
      'Centered one-point perspective',
      'Dollhouse-like production design'
    ],
    narrative_style: 'Melancholic whimsy, deadpan comedy, nostalgic fable',
    emotional_language: 'Controlled sadness, dry wit, tender absurdity',
    pacing: 'Methodical with precise comedic timing',
    iconic_works: [
      { title: 'The Grand Budapest Hotel', year: 2014, visual_highlight: 'Pastel symmetry' },
      { title: 'Moonrise Kingdom', year: 2012, visual_highlight: 'Storybook framing' },
      { title: 'The Royal Tenenbaums', year: 2001, visual_highlight: 'Dollhouse tableaux' }
    ],
    influences: ['Jacques Tati', 'Hal Ashby', 'François Truffaut'],
    awards: ['Academy Award nominations', 'Golden Globe']
  },
  
  cinematographer: {
    name: 'Robert Yeoman',
    technical_philosophy: 'Precision serves emotion. Every technical choice supports the director\'s vision.',
    signature_look: 'Symmetrical compositions with warm pastel tones and flat staging',
    legendary_technique: 'Perfected flat, tableaux-like staging with precise camera moves',
    famous_collaborations: ['Wes Anderson (all films)', 'Noah Baumbach'],
    camera_preference: 'ARRI cameras for consistent color',
    lens_preference: 'Zeiss Master Primes for clinical symmetry',
    lighting_philosophy: 'Soft, even, shadowless for storybook quality. Practical sources visible.',
    awards: ['ASC Award nominations', 'Independent Spirit Awards']
  },
  
  collaboration: {
    synergy_score: 100,
    visual_harmony: 'Perfect partnership - 30 years of identical vision and execution',
    combined_signature: 'Symmetrical pastel dollhouse worlds with deadpan precision',
    best_for_genres: ['Music Videos', 'Comedy', 'Whimsical Drama', 'Period Fantasy'],
    combined_influences: ['French Cinema', 'Graphic Design', 'Mid-Century Modern']
  },
  
  camera: {
    name: 'ARRI Alexa Mini',
    sensor_format: 'Super 35mm',
    resolution: '3.2K',
    dynamic_range: '14+ stops',
    color_science: 'ARRI LogC for precise pastels',
    best_for: ['Controlled environments', 'Precise color matching', 'Compact for sets']
  },
  
  lenses: {
    manufacturer: 'Zeiss',
    series: 'Master Prime',
    format: 'Spherical',
    focal_lengths: [
      { mm: '21mm', use_case: 'Wide symmetry', aperture_sweet_spot: 'f/4', depth_of_field: 'Deep', bokeh_quality: 'Clinical', distortion: 'Controlled' },
      { mm: '27mm', use_case: 'Room tableaux', aperture_sweet_spot: 'f/4', depth_of_field: 'Deep', bokeh_quality: 'Neutral', distortion: 'Minimal' },
      { mm: '32mm', use_case: 'Standard Anderson', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Medium-deep', bokeh_quality: 'Clean', distortion: 'None' },
      { mm: '40mm', use_case: 'Close symmetry', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Medium', bokeh_quality: 'Subtle', distortion: 'None' },
      { mm: '50mm', use_case: 'Portrait deadpan', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Medium', bokeh_quality: 'Clean', distortion: 'None' },
      { mm: '65mm', use_case: 'Close-up centered', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Selective', bokeh_quality: 'Smooth', distortion: 'None' }
    ],
    characteristics: ['Clinical sharpness', 'Neutral color', 'Perfect geometry', 'No distortion'],
    flare_characteristics: 'Avoided - clinical cleanliness preferred',
    cost_tier: 'Premium'
  },
  
  lighting: {
    key_style: 'Soft even flat',
    key_ratio: '1:1 - shadowless',
    fill_approach: 'Full fill for even exposure',
    backlight: 'Subtle separation, not dramatic',
    color_temperature: {
      key: '4500K neutral-warm',
      fill: 'Matching',
      accent: 'Matching practicals'
    },
    practicals: ['Vintage lamps', 'Period sconces', 'Neon signs', 'Natural windows'],
    motivated_sources: ['Large soft windows', 'Overhead silks', 'Practical lamps as decoration'],
    signature_setup: 'Extremely soft, even lighting from large sources. No harsh shadows. Storybook quality. Practicals as design elements more than actual sources. Color temperature matching to pastel palette.'
  },
  
  color_grading: {
    primary_palette: ['Soft pink', 'Powder blue', 'Mint green', 'Cream yellow', 'Salmon', 'Lavender'],
    shadows: { hue: 'Warm neutral', saturation: '10%', lift: '+0.1 lifted' },
    midtones: { hue: 'Pastel matching', saturation: '80%', gamma: '1.1 bright' },
    highlights: { hue: 'Cream white', saturation: '5%', gain: '+0.05' },
    overall_saturation: '75% - soft pastel',
    contrast: 'Low contrast, lifted shadows, soft highlights',
    film_emulation: 'Vintage pastel print look',
    grain: { intensity: 'Fine vintage', size: '35mm', character: 'Nostalgic organic' }
  },
  
  depth_of_field: {
    philosophy: 'Deep focus keeps the designed world visible',
    wide_shots: { aperture: 'f/5.6-f/8', focus_distance: 'Hyperfocal', description: 'Everything sharp for tableaux' },
    medium_shots: { aperture: 'f/4', focus_distance: 'Subjects', description: 'Characters in designed space' },
    close_ups: { aperture: 'f/2.8', focus_distance: 'Face', description: 'Deadpan sharp' },
    extreme_close_ups: { aperture: 'f/4', focus_distance: 'Object', description: 'Design element visible' },
    rack_focus: false,
    focus_pulls: ['Never - too organic']
  },
  
  framing: {
    aspect_ratio: '1.85:1 or 4:3 for period',
    headroom: 'Precise - often minimal',
    lead_room: 'Centered - no lead room',
    nose_room: 'Centered - direct to camera',
    symmetry: { use: true, when: 'Almost always - signature' },
    rule_of_thirds: false,
    center_framing: { use: true, when: 'Default - signature style' },
    negative_space: 'Balanced symmetrically',
    safe_areas: { action: '95%', title: '90%' }
  },
  
  movement: {
    philosophy: 'Camera moves are precise geometric events, not organic.',
    static: { when: ['Tableaux compositions', 'Deadpan dialogue', 'Most shots'], motivation: 'Design perfection' },
    handheld: { when: ['Never'], intensity: 'N/A' },
    steadicam: { when: ['Never - too organic'], speed: 'N/A' },
    dolly: { when: ['Lateral tracking only', 'Push straight in', 'Precise geometric moves'], track_type: 'Perfectly straight' },
    crane: { when: ['Vertical reveals', 'Up/down only'], height: 'Precise increments' },
    drone: { when: ['Never - too organic'], altitude: 'N/A' },
    speed: 'Precise, metronomic'
  },
  
  shot_library: {
    wide_establishing: createShotSpec({
      lens_mm: '21mm', aperture: 'f/5.6', camera_height: 'Precise center', camera_angle: 'Straight symmetrical',
      movement: 'Static or precise lateral', lighting_key: 'Soft even',
      framing: 'Perfect symmetry', depth_of_field: 'Deep',
      prompt_template: 'Wide establishing shot, perfect symmetry, Wes Anderson signature composition, Robert Yeoman flat lighting, pastel color palette, centered one-point perspective, storybook quality, 21mm wide sharp throughout, designed environment',
      edit_prompt: 'Pull back to symmetrical wide: perfect center, pastel palette, Anderson symmetry, designed world visible'
    }),
    wide_environment: createShotSpec({
      lens_mm: '27mm', aperture: 'f/4', camera_height: 'Center', camera_angle: 'Straight',
      movement: 'Static or lateral track', lighting_key: 'Soft even',
      framing: 'Tableaux with figures', depth_of_field: 'Deep',
      prompt_template: 'Wide environment tableaux, {subject} in designed space, Wes Anderson symmetrical staging, pastel palette, flat even lighting, dollhouse composition, 27mm deep focus',
      edit_prompt: 'Reframe as tableaux: symmetrical staging, pastel environment, Anderson composition'
    }),
    medium_full: createShotSpec({
      lens_mm: '32mm', aperture: 'f/4', camera_height: 'Precise', camera_angle: 'Straight',
      movement: 'Static', lighting_key: 'Soft flat',
      framing: 'Full figure centered', depth_of_field: 'Deep',
      prompt_template: 'Medium full centered, {subject} full figure, perfectly symmetrical framing, Wes Anderson deadpan staging, pastel costume, flat even lighting, centered composition',
      edit_prompt: 'Adjust to medium full: full figure centered, symmetrical, pastel palette'
    }),
    medium_narrative: createShotSpec({
      lens_mm: '40mm', aperture: 'f/4', camera_height: 'Eye level', camera_angle: 'Straight center',
      movement: 'Static', lighting_key: 'Soft even',
      framing: 'Waist up centered', depth_of_field: 'Medium-deep',
      prompt_template: 'Medium shot centered, {subject} waist-up, perfect center frame, Wes Anderson direct address, flat even lighting, pastel costume and background, deadpan quality',
      edit_prompt: 'Reframe medium centered: waist up, dead center, flat lighting, deadpan'
    }),
    medium_close: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Direct center',
      movement: 'Static or slow push', lighting_key: 'Soft beauty',
      framing: 'Chest up centered', depth_of_field: 'Medium',
      prompt_template: 'Medium close-up centered, {subject} chest and face, perfectly centered in frame, Wes Anderson direct address, soft flat lighting, pastel tones, deadpan expression',
      edit_prompt: 'Push to medium close: centered chest and face, flat lighting, deadpan'
    }),
    close_up_emotional: createShotSpec({
      lens_mm: '65mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Direct to camera',
      movement: 'Completely static', lighting_key: 'Soft flat beauty',
      framing: 'Face centered', depth_of_field: 'Medium',
      prompt_template: 'Close-up direct address, {subject} face centered in frame, direct to camera, Wes Anderson deadpan emotional, flat soft lighting, pastel tones, symmetrical face placement',
      edit_prompt: 'Transform to centered close-up: face dead center, direct to camera, deadpan emotion'
    }),
    close_up_profile: createShotSpec({
      lens_mm: '65mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: '90 degree profile',
      movement: 'Static', lighting_key: 'Soft from front',
      framing: 'Profile centered', depth_of_field: 'Medium',
      prompt_template: 'Profile close-up, {subject} in perfect profile, centered in frame, Wes Anderson geometric precision, flat soft lighting, pastel background',
      edit_prompt: 'Reframe to profile: 90 degree side, centered in frame, flat lighting'
    }),
    extreme_close_up: createShotSpec({
      lens_mm: '65mm', aperture: 'f/4', camera_height: 'Object level', camera_angle: 'Straight',
      movement: 'Static', lighting_key: 'Soft even',
      framing: 'Detail centered', depth_of_field: 'Sharp',
      prompt_template: 'Extreme close-up, {detail} perfectly centered, Wes Anderson design object, flat even lighting, pastel colors, symmetrical placement, designed detail',
      edit_prompt: 'Push to extreme close: detail centered, designed quality, pastel'
    }),
    detail_insert: createShotSpec({
      lens_mm: '50mm', aperture: 'f/4', camera_height: 'Tabletop', camera_angle: 'Straight down or straight',
      movement: 'Static', lighting_key: 'Soft even',
      framing: 'Object as design', depth_of_field: 'Sharp throughout',
      prompt_template: 'Detail insert, {object} as design element, perfectly centered, Wes Anderson prop quality, flat lighting, pastel surroundings, graphic composition',
      edit_prompt: 'Create detail insert: object centered, designed quality, pastel palette'
    }),
    overhead_god_view: createShotSpec({
      lens_mm: '27mm', aperture: 'f/5.6', camera_height: 'Directly above', camera_angle: '90 degrees down',
      movement: 'Static or precise vertical', lighting_key: 'Even from above',
      framing: 'Flat lay symmetry', depth_of_field: 'Deep',
      prompt_template: 'Overhead flat lay, looking straight down at {subject}, perfect symmetry, Wes Anderson top-down, even lighting, pastel colors, graphic design quality',
      edit_prompt: 'Transform to overhead: straight down, symmetrical arrangement, graphic quality'
    }),
    low_angle_power: createShotSpec({
      lens_mm: '27mm', aperture: 'f/4', camera_height: 'Low', camera_angle: 'Looking up centered',
      movement: 'Static', lighting_key: 'Soft from above',
      framing: 'Centered from below', depth_of_field: 'Deep',
      prompt_template: 'Low angle centered, {subject} from below, centered in frame, Wes Anderson geometric, soft lighting, pastel surroundings, symmetrical composition',
      edit_prompt: 'Shift to low angle: centered from below, symmetrical, soft lighting'
    }),
    high_angle_vulnerable: createShotSpec({
      lens_mm: '32mm', aperture: 'f/4', camera_height: 'Above', camera_angle: 'Looking down centered',
      movement: 'Static', lighting_key: 'Soft from top',
      framing: 'Centered from above', depth_of_field: 'Medium',
      prompt_template: 'High angle centered, looking down at {subject}, centered in frame, Wes Anderson geometric, soft top lighting, pastel colors',
      edit_prompt: 'Reframe from above: centered looking down, geometric framing'
    }),
    dutch_angle_tension: createShotSpec({
      lens_mm: '32mm', aperture: 'f/4', camera_height: 'Eye level', camera_angle: 'Never tilted',
      movement: 'Never', lighting_key: 'N/A',
      framing: 'Never used', depth_of_field: 'N/A',
      prompt_template: 'Wes Anderson never uses dutch angles - always perfectly level symmetrical framing',
      edit_prompt: 'Do not apply dutch angle - maintain perfect symmetry'
    }),
    pov_subjective: createShotSpec({
      lens_mm: '32mm', aperture: 'f/4', camera_height: 'Subject eyes', camera_angle: 'What they see centered',
      movement: 'Precise lateral if any', lighting_key: 'Even',
      framing: 'POV but centered', depth_of_field: 'Deep',
      prompt_template: 'POV shot, first person seeing what {subject} sees, but with Wes Anderson centered framing, symmetrical view, even lighting, pastel world',
      edit_prompt: 'Convert to centered POV: first person but symmetrical, designed world'
    }),
    over_shoulder: createShotSpec({
      lens_mm: '40mm', aperture: 'f/4', camera_height: 'Shoulder', camera_angle: 'Straight past shoulder',
      movement: 'Static', lighting_key: 'Even for both',
      framing: 'Formal over-shoulder', depth_of_field: 'Both sharp',
      prompt_template: 'Over shoulder formal, {subject} seen past shoulder, Wes Anderson formal staging, flat even lighting, pastel tones, geometric precision',
      edit_prompt: 'Add formal over-shoulder: geometric staging, flat lighting, both visible'
    }),
    two_shot: createShotSpec({
      lens_mm: '32mm', aperture: 'f/4', camera_height: 'Centered', camera_angle: 'Straight',
      movement: 'Static or precise lateral', lighting_key: 'Even for both',
      framing: 'Symmetrical pair', depth_of_field: 'Both sharp',
      prompt_template: 'Two shot symmetrical, {subjects} positioned symmetrically in frame, Wes Anderson geometric pairing, flat even lighting, pastel costumes, deadpan staging',
      edit_prompt: 'Compose as symmetrical two-shot: balanced placement, flat lighting, deadpan'
    })
  },
  
  ai_prompts: {
    style_prefix: 'Wes Anderson directing, Robert Yeoman cinematography, perfect symmetry, centered composition, pastel color palette, flat even lighting, storybook quality, deadpan staging, dollhouse production design, 1.85:1 or 4:3 aspect ratio, vintage nostalgia',
    master_shot_template: 'Symmetrical master shot, {scene_description}, Wes Anderson perfect symmetry, Yeoman flat lighting, centered one-point perspective, pastel palette, designed environment, 27mm deep focus, storybook tableaux',
    performance_template: 'Centered performance shot, {artist} dead center frame, Wes Anderson direct address, flat even lighting, pastel costume, deadpan expression, symmetrical background',
    broll_template: 'Designed B-roll, {description}, Wes Anderson symmetrical object placement, pastel colors, no people, graphic design quality, centered composition, flat lighting, vintage nostalgic',
    emotional_template: 'Centered close-up, {description}, Wes Anderson deadpan emotional, direct to camera, perfectly centered face, flat soft lighting, pastel tones, controlled expression',
    action_template: 'Precise action shot, {description}, Wes Anderson controlled movement, lateral tracking only, flat lighting maintained, pastel palette, geometric staging, precise timing',
    negative_prompt: 'asymmetrical composition, dutch angles, handheld shakiness, natural shadows, saturated bold colors, dynamic camera movement, organic lighting, modern minimalist design'
  },
  
  variation_config: {
    max_variations_per_scene: 4,
    variation_types: ['wide_establishing', 'medium_narrative', 'close_up_emotional', 'detail_insert'],
    energy_based_selection: true,
    beat_sync_enabled: true
  },
  
  // 🎬 EDITING STYLE - Wes Anderson: Precise, symmetrical rhythm, storybook pacing
  editing_style: {
    philosophy: 'Every cut is a page turn. Precision timing. Symmetrical rhythm.',
    pace_modifier: 1.3,           // 30% slower - measured, precise
    minimum_cut_duration: 1.5,    // Never rushed, always composed
    maximum_cut_duration: 5.0,    // Tableaux need time
    beat_alignment: 'downbeat',   // Clean, precise cuts
    hold_on_emotion: true,        // Deadpan needs time to land
    emotion_hold_multiplier: 1.4, // 40% longer for effect
    accelerate_on_energy: false,  // Never lose symmetry
    energy_acceleration: 1.0,     // Maintain precision
    transition_preferences: {
      intro: 'iris',              // Storybook opening
      verse: 'whip',              // Signature whip pans
      chorus: 'whip',             // More whip pans
      bridge: 'cut',              // Clean chapter change
      drop: 'whip',
      outro: 'iris'               // Storybook close
    },
    cut_patterns: {
      use_jump_cuts: false,       // Too chaotic
      use_match_cuts: true,       // Graphic matches
      use_j_cuts: false,          // Clean cuts only
      use_l_cuts: false,
      use_smash_cuts: false
    },
    section_beat_overrides: {
      intro: 2.0,                 // Establish the world
      verse: 1.5,                 // Measured storytelling
      chorus: 1.2,                // Slight acceleration
      drop: 1.0,                  // Controlled energy
      bridge: 1.5,                // Return to measured
      outro: 2.5                  // The End card
    }
  }
};

// =============================================================================
// 9. CHRISTOPHER NOLAN + HOYTE VAN HOYTEMA
// =============================================================================

export const CHRISTOPHER_NOLAN_VANHOYTEMA: DirectorDPProfile = {
  id: 'christopher-nolan-vanhoytema',
  version: '1.0.0',
  
  director: {
    name: 'Christopher Nolan',
    visual_philosophy: 'Real is better. Practical effects, IMAX film, and epic scale create visceral truth.',
    signature_techniques: [
      'IMAX 70mm film photography',
      'Practical effects over CGI',
      'Non-linear time structures',
      'Epic scale sequences',
      'Minimal coverage editing',
      'Cross-cutting between timelines'
    ],
    narrative_style: 'Cerebral blockbuster, puzzle-box narrative, epic human drama',
    emotional_language: 'Time, obsession, sacrifice, the weight of choice',
    pacing: 'Building pressure, cross-cut tension, epic climaxes',
    iconic_works: [
      { title: 'Interstellar', year: 2014, visual_highlight: 'IMAX space poetry' },
      { title: 'Dunkirk', year: 2017, visual_highlight: 'Practical IMAX war' },
      { title: 'Oppenheimer', year: 2023, visual_highlight: 'IMAX intimacy and scale' }
    ],
    influences: ['Stanley Kubrick', 'David Lean', 'Ridley Scott'],
    awards: ['Academy Award for Best Director', 'Academy Award for Best Picture']
  },
  
  cinematographer: {
    name: 'Hoyte van Hoytema',
    technical_philosophy: 'Film captures reality in a way digital cannot. IMAX is the ultimate format.',
    signature_look: 'IMAX 70mm intimacy and scale with naturalistic practical lighting',
    legendary_technique: 'Pioneered handheld IMAX 70mm for intimate moments',
    famous_collaborations: ['Christopher Nolan (multiple films)', 'Sam Mendes'],
    camera_preference: 'IMAX 70mm film cameras - Panavision System 65',
    lens_preference: 'Panavision large format anamorphic and spherical',
    lighting_philosophy: 'Practical and natural sources only. Embrace what exists.',
    awards: ['Academy Award nomination for Dunkirk']
  },
  
  collaboration: {
    synergy_score: 97,
    visual_harmony: 'IMAX poets. Practical epic scale with intimate human truth.',
    combined_signature: 'IMAX 70mm practical reality - epic scale, intimate humanity',
    best_for_genres: ['Epic Drama', 'Science Fiction', 'War', 'Thriller', 'Contemplative Music Videos'],
    combined_influences: ['2001: A Space Odyssey', 'Lawrence of Arabia', 'Documentary Realism']
  },
  
  camera: {
    name: 'IMAX 65mm / Panavision System 65',
    sensor_format: '65mm film / 70mm print',
    resolution: '18K equivalent',
    dynamic_range: '15+ stops',
    color_science: 'Kodak film stocks - 5219 500T, 5207 250D',
    best_for: ['Epic scale', 'Maximum resolution', 'Film grain character']
  },
  
  lenses: {
    manufacturer: 'Panavision',
    series: 'IMAX/Panavision custom large format',
    format: 'Large format spherical and anamorphic',
    focal_lengths: [
      { mm: '24mm IMAX', use_case: 'Epic wide scale', aperture_sweet_spot: 'f/4', depth_of_field: 'Deep', bokeh_quality: 'Massive format', distortion: 'Minimal' },
      { mm: '35mm IMAX', use_case: 'Environmental wide', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Medium-deep', bokeh_quality: 'Organic', distortion: 'None' },
      { mm: '50mm IMAX', use_case: 'Standard epic', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Medium', bokeh_quality: 'Beautiful', distortion: 'None' },
      { mm: '75mm IMAX', use_case: 'Close-up intimate', aperture_sweet_spot: 'f/2', depth_of_field: 'Shallow', bokeh_quality: 'Massive LF', distortion: 'None' },
      { mm: '100mm IMAX', use_case: 'Intimate portrait', aperture_sweet_spot: 'f/2', depth_of_field: 'Very shallow', bokeh_quality: 'Enormous format falloff', distortion: 'None' },
      { mm: '150mm', use_case: 'Compressed distance', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Very shallow', bokeh_quality: 'Stacked', distortion: 'None' }
    ],
    characteristics: ['IMAX resolution', 'Film grain character', 'Massive format falloff', 'Natural color'],
    flare_characteristics: 'Natural practical flares from real sources',
    cost_tier: 'Ultra-Premium'
  },
  
  lighting: {
    key_style: 'Practical naturalistic',
    key_ratio: 'As scene dictates naturally',
    fill_approach: 'Minimal - embrace natural contrast',
    backlight: 'Sun or practical sources',
    color_temperature: {
      key: 'As scene - 5600K or mixed',
      fill: 'Ambient natural',
      accent: 'Practicals as they exist'
    },
    practicals: ['Sun', 'Fire', 'Explosions', 'Vehicle lights', 'Practical lamps'],
    motivated_sources: ['Windows', 'Skylights', 'Practical overhead', 'Natural environment'],
    signature_setup: 'Entirely practical and natural sources. Embrace what exists. Let real light tell the story. Enhance only when absolutely necessary. The sun is the key light.'
  },
  
  color_grading: {
    primary_palette: ['Natural earth', 'Warm amber', 'Cool blue', 'Film natural'],
    shadows: { hue: 'Natural deep', saturation: '15%', lift: '0' },
    midtones: { hue: 'Film natural', saturation: '95%', gamma: '1.0' },
    highlights: { hue: 'Natural warm', saturation: '10%', gain: '0' },
    overall_saturation: '95% - near natural',
    contrast: 'Film contrast - natural with character',
    film_emulation: 'Actual film - Kodak 5219 500T / 5207 250D',
    grain: { intensity: 'Natural 70mm', size: 'Large format', character: 'Real film grain' }
  },
  
  depth_of_field: {
    philosophy: 'Large format natural falloff creates organic hierarchy',
    wide_shots: { aperture: 'f/5.6-f/8', focus_distance: 'Hyperfocal', description: 'Epic scale sharp' },
    medium_shots: { aperture: 'f/2.8', focus_distance: 'Subject', description: 'Subject in epic context' },
    close_ups: { aperture: 'f/2', focus_distance: 'Eyes', description: 'Intimate large format' },
    extreme_close_ups: { aperture: 'f/2', focus_distance: 'Detail', description: 'Massive format falloff' },
    rack_focus: false,
    focus_pulls: ['Rarely - natural hierarchy']
  },
  
  framing: {
    aspect_ratio: '1.43:1 IMAX or 2.39:1 scope',
    headroom: 'Variable - often minimal',
    lead_room: 'Dynamic for action',
    nose_room: 'Natural',
    symmetry: { use: true, when: 'Epic scale moments' },
    rule_of_thirds: true,
    center_framing: { use: true, when: 'Direct confrontation' },
    negative_space: 'Used for scale and isolation',
    safe_areas: { action: '85%', title: '80%' }
  },
  
  movement: {
    philosophy: 'Camera should feel present, part of the action, not observing.',
    static: { when: ['Tension building', 'Intimate dialogue'], motivation: 'Weight of moment' },
    handheld: { when: ['IMAX intimate moments', 'War sequences', 'Tension'], intensity: 'Controlled documentary' },
    steadicam: { when: ['Following action smoothly'], speed: 'Match action' },
    dolly: { when: ['Deliberate pushes', 'Epic reveals'], track_type: 'Precise' },
    crane: { when: ['Epic reveals', 'Scale establishment'], height: 'Maximum for scale' },
    drone: { when: ['Rarely - prefer practical'], altitude: 'Epic' },
    speed: 'Deliberate, building, matched to tension'
  },
  
  shot_library: {
    wide_establishing: createShotSpec({
      lens_mm: '24mm IMAX', aperture: 'f/5.6', camera_height: 'Epic perspective', camera_angle: 'Scale establishing',
      movement: 'Slow epic reveal', lighting_key: 'Natural practical',
      framing: 'Human in epic scale', depth_of_field: 'Deep',
      prompt_template: 'Epic IMAX wide, vast practical landscape, Christopher Nolan scale, Hoyte van Hoytema natural light, 70mm film grain, human figure small in epic environment, 1.43:1 IMAX frame, natural practical lighting, real location',
      edit_prompt: 'Pull back to IMAX wide: epic scale, natural lighting, human in vast landscape, film grain'
    }),
    wide_environment: createShotSpec({
      lens_mm: '35mm IMAX', aperture: 'f/4', camera_height: 'Human level', camera_angle: 'Into environment',
      movement: 'Handheld IMAX intimate', lighting_key: 'Practical natural',
      framing: 'Environment as character', depth_of_field: 'Medium-deep',
      prompt_template: 'IMAX environmental wide, {subject} in practical location, natural lighting, Nolan immersive framing, 70mm film quality, van Hoytema naturalism, 35mm IMAX',
      edit_prompt: 'Reframe IMAX environmental: natural lighting, practical location, immersive'
    }),
    medium_full: createShotSpec({
      lens_mm: '50mm IMAX', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Direct',
      movement: 'Handheld or steady', lighting_key: 'Natural practical',
      framing: 'Full figure in world', depth_of_field: 'Medium LF',
      prompt_template: 'Medium full IMAX, {subject} full figure, natural practical lighting, Nolan grounded framing, 70mm film grain, van Hoytema naturalism',
      edit_prompt: 'Adjust to medium full: full figure, natural lighting, IMAX film quality'
    }),
    medium_narrative: createShotSpec({
      lens_mm: '50mm IMAX', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Direct narrative',
      movement: 'Subtle handheld', lighting_key: 'Practical motivated',
      framing: 'Waist up grounded', depth_of_field: 'Medium LF falloff',
      prompt_template: 'Medium narrative IMAX, {subject} waist-up, natural practical lighting, Nolan character focus, 70mm film quality, intimate within epic',
      edit_prompt: 'Reframe medium: waist up, natural lighting, character focused, IMAX intimate'
    }),
    medium_close: createShotSpec({
      lens_mm: '75mm IMAX', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Intimate',
      movement: 'Handheld breathing', lighting_key: 'Natural on face',
      framing: 'Chest up intimate IMAX', depth_of_field: 'Shallow LF',
      prompt_template: 'Medium close IMAX, {subject} chest and face, handheld intimate, natural light on face, massive format shallow focus, Nolan intimate epic, 70mm grain',
      edit_prompt: 'Push to medium close: intimate IMAX, natural light, shallow LF focus'
    }),
    close_up_emotional: createShotSpec({
      lens_mm: '75mm IMAX', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Direct intimate',
      movement: 'Handheld IMAX', lighting_key: 'Natural practical',
      framing: 'Face as landscape', depth_of_field: 'Very shallow LF',
      prompt_template: 'IMAX close-up, {subject} face filling massive frame, handheld intimacy, natural practical light, 70mm film grain on skin, Nolan emotional weight, eyes telling story',
      edit_prompt: 'Transform to IMAX close-up: face fills frame, handheld, natural light, film grain'
    }),
    close_up_profile: createShotSpec({
      lens_mm: '100mm IMAX', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Profile',
      movement: 'Static or handheld', lighting_key: 'Natural rim',
      framing: 'Profile in IMAX', depth_of_field: 'Ultra shallow',
      prompt_template: 'IMAX profile close-up, {subject} in profile, natural rim light, massive format shallow focus, contemplative, Nolan introspection, 70mm film quality',
      edit_prompt: 'Reframe to profile: IMAX scale, natural rim light, contemplative'
    }),
    extreme_close_up: createShotSpec({
      lens_mm: '100mm IMAX', aperture: 'f/2.8', camera_height: 'Detail level', camera_angle: 'Precise',
      movement: 'Static or subtle', lighting_key: 'Natural detail',
      framing: 'Detail in IMAX', depth_of_field: 'Paper thin',
      prompt_template: 'IMAX extreme close-up, {detail} in massive resolution, natural lighting, 70mm grain visible, Nolan attention to practical detail',
      edit_prompt: 'Push to IMAX extreme close: maximum resolution, natural light, film grain'
    }),
    detail_insert: createShotSpec({
      lens_mm: '75mm IMAX', aperture: 'f/2.8', camera_height: 'Object level', camera_angle: 'Practical',
      movement: 'Static', lighting_key: 'Natural motivated',
      framing: 'Object with weight', depth_of_field: 'Selective',
      prompt_template: 'IMAX detail insert, {object} practical, natural lighting, 70mm film quality, Nolan meaningful object, weight of physical thing',
      edit_prompt: 'Create IMAX detail: practical object, natural light, film quality, meaningful'
    }),
    overhead_god_view: createShotSpec({
      lens_mm: '24mm IMAX', aperture: 'f/5.6', camera_height: 'High practical mount', camera_angle: 'Down',
      movement: 'Static or practical crane', lighting_key: 'Natural from above',
      framing: 'Pattern in scale', depth_of_field: 'Deep',
      prompt_template: 'IMAX overhead, practical high angle, looking down at {subject}, natural lighting, epic scale, 70mm resolution, Nolan god perspective',
      edit_prompt: 'Transform to IMAX overhead: practical high angle, natural light, epic scale'
    }),
    low_angle_power: createShotSpec({
      lens_mm: '35mm IMAX', aperture: 'f/4', camera_height: 'Ground', camera_angle: 'Epic up',
      movement: 'Static awe', lighting_key: 'Natural backlight',
      framing: 'Epic low IMAX', depth_of_field: 'Deep',
      prompt_template: 'IMAX low angle, {subject} against sky, epic perspective, natural backlight, 70mm scale, Nolan practical grandeur',
      edit_prompt: 'Shift to IMAX low angle: epic upward, natural backlight, practical grandeur'
    }),
    high_angle_vulnerable: createShotSpec({
      lens_mm: '50mm IMAX', aperture: 'f/2.8', camera_height: 'Above', camera_angle: 'Looking down',
      movement: 'Static or handheld', lighting_key: 'Top natural',
      framing: 'Small in big world', depth_of_field: 'Medium',
      prompt_template: 'IMAX high angle, looking down at {subject}, natural top light, human small in scale, 70mm film quality, Nolan observation',
      edit_prompt: 'Reframe from above: IMAX scale, human vulnerability, natural light'
    }),
    dutch_angle_tension: createShotSpec({
      lens_mm: '35mm IMAX', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Subtle tilt 5-10 degrees',
      movement: 'Handheld chaos', lighting_key: 'Practical dramatic',
      framing: 'Controlled chaos', depth_of_field: 'Medium',
      prompt_template: 'IMAX dutch angle, subtle 8 degree tilt, {subject} in tension, handheld energy, natural lighting, 70mm grain, Nolan controlled chaos',
      edit_prompt: 'Apply subtle dutch: IMAX scale, 8 degree tilt, tension building'
    }),
    pov_subjective: createShotSpec({
      lens_mm: '35mm IMAX', aperture: 'f/2.8', camera_height: 'Subject eyes', camera_angle: 'Their POV',
      movement: 'Handheld immersive', lighting_key: 'As they see it',
      framing: 'First person IMAX', depth_of_field: 'Selective',
      prompt_template: 'IMAX POV shot, first person immersive, seeing what {subject} sees, handheld movement, natural lighting, 70mm scale immersion',
      edit_prompt: 'Convert to IMAX POV: first person immersive, handheld, natural light'
    }),
    over_shoulder: createShotSpec({
      lens_mm: '75mm IMAX', aperture: 'f/2.8', camera_height: 'Shoulder', camera_angle: 'Past shoulder',
      movement: 'Handheld intimate', lighting_key: 'Practical natural',
      framing: 'IMAX intimacy', depth_of_field: 'Shallow on face',
      prompt_template: 'IMAX over shoulder, {subject} through foreground, natural lighting, handheld intimacy, 70mm depth, Nolan relationship framing',
      edit_prompt: 'Add IMAX over-shoulder: intimate framing, natural light, shallow focus'
    }),
    two_shot: createShotSpec({
      lens_mm: '50mm IMAX', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Balanced',
      movement: 'Handheld or steady', lighting_key: 'Natural for both',
      framing: 'Two in IMAX scale', depth_of_field: 'Both in focus',
      prompt_template: 'IMAX two shot, {subjects} in frame, natural lighting, handheld intimacy, 70mm depth, relationship in epic context',
      edit_prompt: 'Compose as IMAX two-shot: natural lighting, relationship visible, film quality'
    })
  },
  
  ai_prompts: {
    style_prefix: 'Christopher Nolan directing, Hoyte van Hoytema cinematography, IMAX 70mm film photography, practical effects, natural lighting, epic scale with intimate humanity, 1.43:1 or 2.39:1 aspect ratio, film grain texture, real locations',
    master_shot_template: 'IMAX epic master, {scene_description}, Christopher Nolan scale, van Hoytema natural light, 70mm film grain, human figure in epic practical environment, 24mm IMAX wide, real location, natural lighting',
    performance_template: 'IMAX performance shot, {artist} in practical environment, Nolan intimate epic, handheld IMAX closeness, natural light on face, 70mm film quality, emotional weight, eyes as windows',
    broll_template: 'IMAX B-roll, {description}, Nolan practical filmmaking, natural lighting, no CGI, real textures, 70mm film grain, epic scale details, no people, physical reality',
    emotional_template: 'IMAX intimate close-up, {description}, Nolan emotional weight, handheld closeness, natural practical light, 70mm grain on skin, eyes holding weight of choice, massive format intimacy',
    action_template: 'IMAX action shot, {description}, Nolan practical action, real stunts, natural lighting, 70mm immersion, visceral reality, minimal CGI, building tension',
    negative_prompt: 'CGI heavy, artificial lighting, desaturated color, digital clean look, slow-motion stylized, fantasy unrealistic, small format, studio lighting'
  },
  
  variation_config: {
    max_variations_per_scene: 4,
    variation_types: ['wide_establishing', 'close_up_emotional', 'medium_narrative', 'detail_insert'],
    energy_based_selection: true,
    beat_sync_enabled: true
  },
  
  // 🎬 EDITING STYLE - Christopher Nolan: IMAX scale, cross-cutting tension, epic patience
  editing_style: {
    philosophy: 'Build tension through patience. Cross-cut for urgency. IMAX demands respect.',
    pace_modifier: 1.2,           // 20% slower - epic scale
    minimum_cut_duration: 1.0,    // Can be quick for cross-cutting
    maximum_cut_duration: 10.0,   // IMAX shots need time
    beat_alignment: 'downbeat',   // Precise, tension-building
    hold_on_emotion: true,        // Eyes hold the weight
    emotion_hold_multiplier: 1.6, // 60% longer on key moments
    accelerate_on_energy: true,
    energy_acceleration: 0.7,     // Cross-cutting gets faster
    transition_preferences: {
      intro: 'fade',              // Emerge into scale
      verse: 'cut',               // Cross-cutting
      chorus: 'cut',              // Tension building
      bridge: 'cut',              // Timeline intercutting
      drop: 'cut',                // Peak cross-cut
      outro: 'fade'
    },
    cut_patterns: {
      use_jump_cuts: false,       // Too jarring for scale
      use_match_cuts: true,       // Timeline connections
      use_j_cuts: true,           // Sound design driven
      use_l_cuts: true,
      use_smash_cuts: true        // For tension peaks
    },
    section_beat_overrides: {
      intro: 2.0,                 // IMAX establishing
      verse: 1.2,                 // Building tension
      chorus: 0.8,                // Cross-cutting urgency
      drop: 0.5,                  // Maximum cross-cut
      bridge: 1.0,                // Maintained tension
      outro: 2.5                  // Epic resolution
    }
  }
};

// =============================================================================
// 10. QUENTIN TARANTINO + ROBERT RICHARDSON
// =============================================================================

export const QUENTIN_TARANTINO_RICHARDSON: DirectorDPProfile = {
  id: 'quentin-tarantino-richardson',
  version: '1.0.0',
  
  director: {
    name: 'Quentin Tarantino',
    visual_philosophy: 'Cinema is quotation. Every shot references something you love, remixed with style.',
    signature_techniques: [
      'Trunk shots looking up',
      '35mm anamorphic film',
      'Long single-take dialogue scenes',
      'Extreme close-ups',
      'Split screens and chapter cards',
      'Violence as art'
    ],
    narrative_style: 'Non-linear storytelling, extended dialogue, genre pastiche',
    emotional_language: 'Cool, tension, dark humor, sudden violence, revenge fantasy',
    pacing: 'Long takes building to explosive release',
    iconic_works: [
      { title: 'Kill Bill', year: 2003, visual_highlight: 'Color chapter coding' },
      { title: 'Inglourious Basterds', year: 2009, visual_highlight: 'Tension in dialogue' },
      { title: 'Once Upon a Time in Hollywood', year: 2019, visual_highlight: '1960s golden hour' }
    ],
    influences: ['Sergio Leone', 'Brian De Palma', 'Grindhouse', 'Hong Kong cinema'],
    awards: ['Academy Award for Best Original Screenplay (2x)']
  },
  
  cinematographer: {
    name: 'Robert Richardson',
    technical_philosophy: 'Light should dramatize. Every shadow has meaning.',
    signature_look: 'High contrast dramatic lighting with bold color and film grain',
    legendary_technique: '3x Academy Award winner, master of dramatic film photography',
    famous_collaborations: ['Martin Scorsese', 'Oliver Stone', 'Quentin Tarantino'],
    camera_preference: 'Panavision film cameras, 35mm and 65mm',
    lens_preference: 'Panavision C-Series Anamorphic for classic scope',
    lighting_philosophy: 'Dramatic motivated sources, embrace contrast, bold color choices.',
    awards: ['3x Academy Award for Best Cinematography']
  },
  
  collaboration: {
    synergy_score: 95,
    visual_harmony: 'Cinephile director meets master visualist. Every frame a love letter to cinema.',
    combined_signature: 'Anamorphic film nostalgia with dramatic bold lighting and genre quotation',
    best_for_genres: ['Music Videos', 'Action', 'Thriller', 'Drama', 'Genre Films'],
    combined_influences: ['Spaghetti Western', 'Film Noir', '70s Hollywood', 'Grindhouse']
  },
  
  camera: {
    name: 'Panavision Panaflex / 65mm',
    sensor_format: '35mm / 65mm film',
    resolution: '6K equivalent',
    dynamic_range: '14+ stops',
    color_science: 'Kodak 5219 500T - rich and dramatic',
    best_for: ['Classic cinema look', 'Dramatic lighting', 'Film grain character']
  },
  
  lenses: {
    manufacturer: 'Panavision',
    series: 'C-Series Anamorphic',
    format: 'Anamorphic 2x squeeze',
    focal_lengths: [
      { mm: '35mm', use_case: 'Wide dramatic', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Deep', bokeh_quality: 'Oval anamorphic', distortion: 'Classic barrel' },
      { mm: '50mm', use_case: 'Standard drama', aperture_sweet_spot: 'f/2', depth_of_field: 'Medium', bokeh_quality: 'Stretched horizontal', distortion: 'Minimal' },
      { mm: '75mm', use_case: 'Dramatic portrait', aperture_sweet_spot: 'f/2', depth_of_field: 'Shallow', bokeh_quality: 'Beautiful oval', distortion: 'None' },
      { mm: '100mm', use_case: 'Extreme close-up', aperture_sweet_spot: 'f/2', depth_of_field: 'Very shallow', bokeh_quality: 'Creamy', distortion: 'None' },
      { mm: '135mm', use_case: 'Face detail', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Ultra shallow', bokeh_quality: 'Stacked', distortion: 'None' },
      { mm: '24mm', use_case: 'Trunk shots', aperture_sweet_spot: 'f/4', depth_of_field: 'Deep', bokeh_quality: 'Wide', distortion: 'Dramatic barrel' }
    ],
    characteristics: ['Classic Hollywood flares', 'Horizontal streaks', 'Oval bokeh', 'Film character'],
    flare_characteristics: 'Blue/cyan horizontal streaks embraced as signature',
    cost_tier: 'Ultra-Premium'
  },
  
  lighting: {
    key_style: 'High contrast dramatic',
    key_ratio: '6:1 or higher - deep shadows',
    fill_approach: 'Minimal - embrace darkness',
    backlight: 'Strong rim for drama',
    color_temperature: {
      key: 'Variable - 3200K to 5600K',
      fill: 'Minimal ambient',
      accent: 'Bold colored gels'
    },
    practicals: ['Neon signs', 'Bare bulbs', 'Firelight', 'Car lights', 'TV glow'],
    motivated_sources: ['Single window', 'Practical lamps', 'Overhead single source'],
    signature_setup: 'Single strong motivated source creating deep shadows. Bold color choices when appropriate. Embrace extreme contrast. Every light tells a story of genre cinema.'
  },
  
  color_grading: {
    primary_palette: ['Bold red', 'Golden amber', 'Deep black', 'Sepia nostalgia', 'Cool blue'],
    shadows: { hue: 'Deep rich black', saturation: '10%', lift: '-0.1 crushed' },
    midtones: { hue: 'Warm or scene-specific', saturation: '110%', gamma: '0.95' },
    highlights: { hue: 'Golden or cool', saturation: '25%', gain: '+0.05' },
    overall_saturation: '105-115% - slightly pushed',
    contrast: 'High contrast, crushed blacks, bold',
    film_emulation: 'Kodak Vision3 500T pushed for grain',
    grain: { intensity: 'Medium-heavy', size: '35mm anamorphic', character: 'Grindhouse grit' }
  },
  
  depth_of_field: {
    philosophy: 'Anamorphic falloff creates classic cinema hierarchy',
    wide_shots: { aperture: 'f/4-f/5.6', focus_distance: 'Staged action', description: 'Classic scope' },
    medium_shots: { aperture: 'f/2.8', focus_distance: 'Subject', description: 'Anamorphic falloff' },
    close_ups: { aperture: 'f/2', focus_distance: 'Eyes', description: 'Dramatic shallow' },
    extreme_close_ups: { aperture: 'f/2', focus_distance: 'Detail', description: 'Extreme isolation' },
    rack_focus: true,
    focus_pulls: ['For reveals', 'Tension building', 'Dramatic emphasis']
  },
  
  framing: {
    aspect_ratio: '2.39:1 anamorphic scope',
    headroom: 'Variable - often minimal for tension',
    lead_room: 'Dynamic',
    nose_room: 'Often violated for tension',
    symmetry: { use: true, when: 'Power shots, confrontations' },
    rule_of_thirds: true,
    center_framing: { use: true, when: 'Direct confrontation, power' },
    negative_space: 'Dramatically used',
    safe_areas: { action: '90%', title: '85%' }
  },
  
  movement: {
    philosophy: 'Camera moves should reference classic cinema - crane up, dolly in, track alongside.',
    static: { when: ['Dialogue tension', 'Holding shots'], motivation: 'Let tension build' },
    handheld: { when: ['Chaos action'], intensity: 'Controlled chaos' },
    steadicam: { when: ['Following characters through space'], speed: 'Smooth classic' },
    dolly: { when: ['Push for emphasis', 'Classic Hollywood moves'], track_type: 'Precise classic' },
    crane: { when: ['Epic reveals', 'Rising above action'], height: 'Epic for scale' },
    drone: { when: ['Rarely - prefer classic'], altitude: 'N/A' },
    speed: 'Classic cinema tempo, building to explosive'
  },
  
  shot_library: {
    wide_establishing: createShotSpec({
      lens_mm: '35mm anamorphic', aperture: 'f/4', camera_height: 'Classic', camera_angle: 'Epic scope',
      movement: 'Classic crane or static', lighting_key: 'Dramatic single source',
      framing: 'Classic scope', depth_of_field: 'Deep',
      prompt_template: 'Wide establishing shot, classic anamorphic scope, Quentin Tarantino cinema homage, Robert Richardson dramatic lighting, 2.39:1 widescreen, classic Hollywood composition, bold shadows, warm film tones, 35mm anamorphic',
      edit_prompt: 'Pull back to scope wide: classic composition, dramatic lighting, anamorphic flares, Tarantino style'
    }),
    wide_environment: createShotSpec({
      lens_mm: '35mm anamorphic', aperture: 'f/2.8', camera_height: 'Scene level', camera_angle: 'Into drama',
      movement: 'Classic dolly', lighting_key: 'Motivated dramatic',
      framing: 'Scene staging', depth_of_field: 'Medium-deep',
      prompt_template: 'Wide scene shot, {subject} in dramatic staging, Tarantino dialogue framing, Richardson high contrast, anamorphic 2.39:1, classic cinema composition, bold shadows',
      edit_prompt: 'Reframe wide dramatic: dialogue staging, high contrast, anamorphic scope'
    }),
    medium_full: createShotSpec({
      lens_mm: '50mm anamorphic', aperture: 'f/2.8', camera_height: 'Classic', camera_angle: 'Drama',
      movement: 'Slow push or static', lighting_key: 'Dramatic side',
      framing: 'Full figure scope', depth_of_field: 'Medium',
      prompt_template: 'Medium full shot, {subject} full figure, Tarantino genre framing, dramatic side lighting, anamorphic bokeh, classic cinema composition',
      edit_prompt: 'Adjust to medium full: full figure, dramatic lighting, anamorphic scope'
    }),
    medium_narrative: createShotSpec({
      lens_mm: '50mm anamorphic', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Direct drama',
      movement: 'Subtle push', lighting_key: 'Classic Hollywood',
      framing: 'Waist up drama', depth_of_field: 'Anamorphic falloff',
      prompt_template: 'Medium dialogue shot, {subject} waist-up, Tarantino extended dialogue framing, Richardson dramatic lighting, anamorphic 50mm, classic tension',
      edit_prompt: 'Reframe medium: dialogue staging, dramatic lighting, anamorphic compression'
    }),
    medium_close: createShotSpec({
      lens_mm: '75mm anamorphic', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Intense',
      movement: 'Subtle or static', lighting_key: 'Dramatic beauty',
      framing: 'Chest up tension', depth_of_field: 'Shallow anamorphic',
      prompt_template: 'Medium close-up, {subject} chest and face, Tarantino intensity, Richardson dramatic key, anamorphic shallow focus, classic cinema beauty, bold shadows',
      edit_prompt: 'Push to medium close: dramatic lighting, anamorphic bokeh, intensity building'
    }),
    close_up_emotional: createShotSpec({
      lens_mm: '75mm anamorphic', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Direct confrontation',
      movement: 'Slow push or static', lighting_key: 'Dramatic single source',
      framing: 'Face as drama', depth_of_field: 'Very shallow',
      prompt_template: 'Close-up confrontation, {subject} face filling scope frame, Tarantino direct address, Richardson dramatic lighting, anamorphic oval bokeh, eyes as weapons, classic cinema close-up',
      edit_prompt: 'Transform to confrontation close-up: face fills frame, dramatic light, anamorphic scope'
    }),
    close_up_profile: createShotSpec({
      lens_mm: '100mm anamorphic', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Profile',
      movement: 'Static', lighting_key: 'Strong rim',
      framing: 'Profile drama', depth_of_field: 'Ultra shallow',
      prompt_template: 'Profile close-up, {subject} in dramatic profile, strong rim light, ultra shallow anamorphic focus, Tarantino cinema homage, classic noir quality',
      edit_prompt: 'Reframe to profile: dramatic rim light, anamorphic compression, noir mood'
    }),
    extreme_close_up: createShotSpec({
      lens_mm: '135mm', aperture: 'f/2', camera_height: 'Detail level', camera_angle: 'Extreme',
      movement: 'Static dramatic', lighting_key: 'Detail drama',
      framing: 'Extreme detail', depth_of_field: 'Paper thin',
      prompt_template: 'Extreme close-up, {detail} filling frame, Tarantino fetishistic detail, dramatic lighting, paper-thin focus, genre obsession, meaningful object',
      edit_prompt: 'Push to extreme close: fetishistic detail, dramatic lighting, obsessive focus'
    }),
    detail_insert: createShotSpec({
      lens_mm: '100mm', aperture: 'f/2.8', camera_height: 'Object level', camera_angle: 'Dramatic',
      movement: 'Static or slow', lighting_key: 'Bold dramatic',
      framing: 'Object as fetish', depth_of_field: 'Selective',
      prompt_template: 'Detail insert, {object} as genre fetish, Tarantino object obsession, bold dramatic lighting, film grain, meaningful prop, classic cinema quality',
      edit_prompt: 'Create detail insert: object fetish, dramatic lighting, genre quality'
    }),
    overhead_god_view: createShotSpec({
      lens_mm: '24mm', aperture: 'f/4', camera_height: 'High crane', camera_angle: 'God POV',
      movement: 'Slow crane', lighting_key: 'Dramatic from above',
      framing: 'Bodies below', depth_of_field: 'Deep',
      prompt_template: 'Overhead god shot, looking down at {subject}, Tarantino violence aftermath or tension, dramatic top lighting, classic crane shot, anamorphic scope',
      edit_prompt: 'Transform to overhead: god view, dramatic lighting, classic cinema crane'
    }),
    low_angle_power: createShotSpec({
      lens_mm: '24mm', aperture: 'f/4', camera_height: 'Trunk level', camera_angle: 'Trunk shot up',
      movement: 'Static', lighting_key: 'Dramatic from above',
      framing: 'Tarantino trunk shot', depth_of_field: 'Deep',
      prompt_template: 'Trunk shot, looking up from low angle, {subject} towering above, Tarantino signature shot, dramatic lighting from above, wide angle distortion, classic genre moment',
      edit_prompt: 'Shift to trunk shot: extreme low angle up, signature Tarantino, dramatic overhead light'
    }),
    high_angle_vulnerable: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Above', camera_angle: 'Looking down',
      movement: 'Static', lighting_key: 'Top dramatic',
      framing: 'Subject below', depth_of_field: 'Medium',
      prompt_template: 'High angle shot, looking down at {subject}, Tarantino power dynamics, dramatic top lighting, anamorphic scope, subject diminished',
      edit_prompt: 'Reframe from above: high angle, power dynamic, dramatic lighting'
    }),
    dutch_angle_tension: createShotSpec({
      lens_mm: '35mm anamorphic', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Tilted 15 degrees',
      movement: 'Static or slow', lighting_key: 'Dramatic',
      framing: 'World askew', depth_of_field: 'Medium',
      prompt_template: 'Dutch angle tension, tilted 15 degrees, {subject} in unstable frame, Tarantino tension building, dramatic lighting, anamorphic flares, world off-kilter',
      edit_prompt: 'Apply dutch angle: 15 degree tilt, tension building, dramatic flares'
    }),
    pov_subjective: createShotSpec({
      lens_mm: '24mm', aperture: 'f/2.8', camera_height: 'Subject eyes', camera_angle: 'Their POV',
      movement: 'Character movement', lighting_key: 'As they see',
      framing: 'First person', depth_of_field: 'Selective',
      prompt_template: 'POV shot, first person view, seeing what {subject} sees, Tarantino immersive perspective, dramatic lighting as environment, anamorphic scope',
      edit_prompt: 'Convert to POV: first person, dramatic environment, anamorphic scope'
    }),
    over_shoulder: createShotSpec({
      lens_mm: '75mm anamorphic', aperture: 'f/2', camera_height: 'Shoulder', camera_angle: 'Past shoulder',
      movement: 'Static or slow push', lighting_key: 'Dramatic both',
      framing: 'Dialogue confrontation', depth_of_field: 'Shallow on face',
      prompt_template: 'Over shoulder dialogue, {subject} through silhouette, Tarantino conversation framing, Richardson dramatic lighting, anamorphic shallow focus, tension visible',
      edit_prompt: 'Add over-shoulder: dialogue tension, dramatic lighting, anamorphic bokeh'
    }),
    two_shot: createShotSpec({
      lens_mm: '50mm anamorphic', aperture: 'f/2.8', camera_height: 'Scene level', camera_angle: 'Balanced',
      movement: 'Static or slow track', lighting_key: 'Dramatic for both',
      framing: 'Confrontation pair', depth_of_field: 'Both sharp',
      prompt_template: 'Two shot confrontation, {subjects} in frame, Tarantino dialogue staging, Richardson dramatic lighting, anamorphic 2.39:1, tension between characters, classic cinema framing',
      edit_prompt: 'Compose as confrontation two-shot: dialogue staging, dramatic lighting, anamorphic scope'
    })
  },
  
  ai_prompts: {
    style_prefix: 'Quentin Tarantino directing, Robert Richardson cinematography, anamorphic 2.39:1 scope, 35mm film grain, high contrast dramatic lighting, bold shadows, classic cinema homage, horizontal lens flares, genre pastiche, bold color choices',
    master_shot_template: 'Wide master shot, {scene_description}, Quentin Tarantino cinema homage, Richardson dramatic lighting, anamorphic scope, classic Hollywood composition, bold shadows, warm film tones, 35mm anamorphic lens flares',
    performance_template: 'Dramatic performance shot, {artist} in Tarantino frame, high contrast lighting, anamorphic shallow focus, confrontational framing, classic cinema beauty, bold shadows, eyes as weapons',
    broll_template: 'Genre B-roll, {description}, Tarantino object fetishism, dramatic lighting, no people, meaningful props, film grain, classic cinema quality, anamorphic scope, bold shadows',
    emotional_template: 'Confrontation close-up, {description}, Tarantino intensity, Richardson dramatic single source, anamorphic oval bokeh, eyes confronting camera, classic cinema close-up, bold shadow division',
    action_template: 'Dramatic action shot, {description}, Tarantino violence choreography, Richardson dynamic lighting, anamorphic scope, practical effects, film grain, genre homage, bold and bloody',
    negative_prompt: 'natural documentary lighting, handheld organic movement, desaturated muted colors, modern minimal design, digital clean look, soft contrast, contemporary aesthetic'
  },
  
  variation_config: {
    max_variations_per_scene: 5,
    variation_types: ['wide_establishing', 'close_up_emotional', 'low_angle_power', 'extreme_close_up', 'detail_insert'],
    energy_based_selection: true,
    beat_sync_enabled: true
  },
  
  // 🎬 EDITING STYLE - Quentin Tarantino: Long dialogue takes, then EXPLOSIVE action cuts
  editing_style: {
    philosophy: 'Let dialogue breathe. Then EXPLODE. Tension and release. Cinema as jazz.',
    pace_modifier: 1.3,           // 30% slower on dialogue
    minimum_cut_duration: 0.25,   // Flash cuts on violence
    maximum_cut_duration: 12.0,   // Long single-take dialogue
    beat_alignment: 'off_beat',   // Jazz timing, unexpected
    hold_on_emotion: true,        // Tension building
    emotion_hold_multiplier: 2.0, // Double time on confrontation
    accelerate_on_energy: true,
    energy_acceleration: 0.3,     // EXPLOSIVE on action
    transition_preferences: {
      intro: 'chapter_card',      // Chapter titles
      verse: 'cut',               // Long take cuts
      chorus: 'cut',
      bridge: 'chapter_card',     // New chapter
      drop: 'smash',              // VIOLENCE
      outro: 'fade'
    },
    cut_patterns: {
      use_jump_cuts: false,       // Clean in dialogue
      use_match_cuts: true,       // Visual quotation
      use_j_cuts: true,           // Dialogue overlap
      use_l_cuts: true,
      use_smash_cuts: true        // Violence impact
    },
    section_beat_overrides: {
      intro: 2.5,                 // Trunk shot opening
      verse: 2.0,                 // Long dialogue takes
      chorus: 1.5,                // Still measured
      drop: 0.3,                  // EXPLOSIVE violence
      bridge: 2.0,                // Return to dialogue
      outro: 3.0                  // Cool resolution
    }
  }
};

// =============================================================================
// Export Part 3 profiles
// =============================================================================

export const DIRECTOR_DP_PROFILES_PART3: Record<string, DirectorDPProfile> = {
  'baz-luhrmann': BAZ_LUHRMANN_WALKER,
  'baz-luhrmann-walker': BAZ_LUHRMANN_WALKER,
  'Baz Luhrmann': BAZ_LUHRMANN_WALKER,
  
  'wes-anderson': WES_ANDERSON_YEOMAN,
  'wes-anderson-yeoman': WES_ANDERSON_YEOMAN,
  'Wes Anderson': WES_ANDERSON_YEOMAN,
  
  'christopher-nolan': CHRISTOPHER_NOLAN_VANHOYTEMA,
  'christopher-nolan-vanhoytema': CHRISTOPHER_NOLAN_VANHOYTEMA,
  'Christopher Nolan': CHRISTOPHER_NOLAN_VANHOYTEMA,
  
  'quentin-tarantino': QUENTIN_TARANTINO_RICHARDSON,
  'quentin-tarantino-richardson': QUENTIN_TARANTINO_RICHARDSON,
  'Quentin Tarantino': QUENTIN_TARANTINO_RICHARDSON,
};
