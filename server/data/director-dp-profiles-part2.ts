/**
 * 🎬 DIRECTOR + DP PROFILES PART 2
 * Continuation with remaining 7 Director+DP pairings
 */

import type { DirectorDPProfile, ShotSpec } from './types/cinematography';

// Helper function (duplicate for module independence)
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
// 4. MICHEL GONDRY + BRUNO DELBONNEL
// =============================================================================

export const MICHEL_GONDRY_DELBONNEL: DirectorDPProfile = {
  id: 'michel-gondry-delbonnel',
  version: '1.0.0',
  
  director: {
    name: 'Michel Gondry',
    visual_philosophy: 'Handmade magic. The imperfection of DIY craft creates more wonder than CGI.',
    signature_techniques: [
      'Stop-motion mixed with live action',
      'Forced perspective illusions',
      'Paper/cardboard world-building',
      'Morphing transitions in-camera',
      'Nostalgic childhood wonder',
      'Practical optical illusions'
    ],
    narrative_style: 'Dreamlike nostalgia, whimsical storytelling, emotional surrealism',
    emotional_language: 'Childlike wonder, melancholy playfulness, heartfelt absurdity',
    pacing: 'Playful, surprising, rhythmic with music',
    iconic_works: [
      { title: 'Eternal Sunshine', year: 2004, visual_highlight: 'Memories disintegrating in-camera' },
      { title: 'Come Into My World', year: 2002, visual_highlight: 'Seamless loop multiplication' },
      { title: 'Star Guitar', year: 2002, visual_highlight: 'Music as landscape rhythm' }
    ],
    influences: ['French New Wave', 'Terry Gilliam', 'Jan Švankmajer'],
    awards: ['Academy Award for Best Original Screenplay', 'MTV VMAs']
  },
  
  cinematographer: {
    name: 'Bruno Delbonnel',
    technical_philosophy: 'Light should feel like an emotion, not illumination.',
    signature_look: 'Soft diffused magical light with desaturated yet rich colors',
    legendary_technique: 'Pioneered ultra-soft toplight for Amélie\'s Parisian glow',
    famous_collaborations: ['Jean-Pierre Jeunet', 'Coen Brothers', 'Tim Burton'],
    camera_preference: 'ARRI Alexa Mini for lightweight practical shooting',
    lens_preference: 'Cooke S4/i for warm organic character',
    lighting_philosophy: 'Soft sources, top-heavy lighting, filtered windows. Beauty through diffusion.',
    awards: ['5x Academy Award nominations', 'ASC Awards']
  },
  
  collaboration: {
    synergy_score: 93,
    visual_harmony: 'DIY craft meets painterly cinematography. Handmade worlds glowing with soft magic.',
    combined_signature: 'Tactile cardboard dreams lit with Vermeer softness',
    best_for_genres: ['Music Videos', 'Fantasy', 'Romance', 'Surreal Comedy'],
    combined_influences: ['French Cinema', 'Practical Effects Pioneers', 'Art Direction Masters']
  },
  
  camera: {
    name: 'ARRI Alexa Mini',
    sensor_format: 'Super 35mm',
    resolution: '3.2K',
    dynamic_range: '14+ stops',
    color_science: 'ARRI LogC - forgiving for pastels',
    best_for: ['Run-and-gun practical effects', 'Small spaces', 'Handheld whimsy']
  },
  
  lenses: {
    manufacturer: 'Cooke',
    series: 'S4/i',
    format: 'Spherical',
    focal_lengths: [
      { mm: '18mm', use_case: 'Forced perspective wide', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Deep', bokeh_quality: 'Warm swirl', distortion: 'Playful barrel' },
      { mm: '25mm', use_case: 'World-building wide', aperture_sweet_spot: 'f/2', depth_of_field: 'Medium', bokeh_quality: 'Soft circles', distortion: 'Minimal' },
      { mm: '32mm', use_case: 'Personal wide', aperture_sweet_spot: 'f/2', depth_of_field: 'Medium', bokeh_quality: 'Gentle', distortion: 'None' },
      { mm: '50mm', use_case: 'Standard dreaming', aperture_sweet_spot: 'f/1.8', depth_of_field: 'Selective', bokeh_quality: 'Romantic', distortion: 'None' },
      { mm: '75mm', use_case: 'Tender close-ups', aperture_sweet_spot: 'f/2', depth_of_field: 'Shallow', bokeh_quality: 'Creamy', distortion: 'None' },
      { mm: '100mm', use_case: 'Detail wonder', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Very shallow', bokeh_quality: 'Buttery', distortion: 'None' }
    ],
    characteristics: ['Warm skin tones', 'Gentle rolloff', 'Subtle glow', 'Cooke look'],
    flare_characteristics: 'Warm organic flares, embraced as character',
    cost_tier: 'Premium'
  },
  
  lighting: {
    key_style: 'Soft diffused overhead',
    key_ratio: '2:1 gentle',
    fill_approach: 'Soft bounce for shadow detail',
    backlight: 'Gentle rim for separation',
    color_temperature: {
      key: '4500K warm neutral',
      fill: 'Matching warm',
      accent: 'Colored practicals for magic'
    },
    practicals: ['Paper lanterns', 'Fairy lights', 'Colored bulbs', 'Window silks'],
    motivated_sources: ['Windows with heavy diffusion', 'Skylights', 'Soft overcast'],
    signature_setup: 'Large overhead silk creating wrap. Soft window sources. Colored practicals adding whimsy. Think Vermeer meets handmade craft. Every light source adds to the handcrafted feeling.'
  },
  
  color_grading: {
    primary_palette: ['Warm yellows', 'Soft greens', 'Dusty pinks', 'Paper beige', 'Nostalgic amber'],
    shadows: { hue: 'Warm brown', saturation: '20%', lift: '+0.05 lifted' },
    midtones: { hue: 'Gentle warm', saturation: '90%', gamma: '1.05 bright' },
    highlights: { hue: 'Cream yellow', saturation: '15%', gain: '+0.05' },
    overall_saturation: '75% - slightly muted for nostalgia',
    contrast: 'Low contrast, lifted shadows, soft highlights',
    film_emulation: 'Kodak Portra 400 - warm nostalgic',
    grain: { intensity: 'Medium organic', size: '35mm', character: 'Handmade texture' }
  },
  
  depth_of_field: {
    philosophy: 'Focus tells a story - what we remember, what fades',
    wide_shots: { aperture: 'f/4', focus_distance: 'Layered', description: 'Craft sets need to be seen' },
    medium_shots: { aperture: 'f/2.8', focus_distance: 'Subject', description: 'Person in handmade world' },
    close_ups: { aperture: 'f/2', focus_distance: 'Eyes', description: 'Dreamy intimate' },
    extreme_close_ups: { aperture: 'f/2.8', focus_distance: 'Detail', description: 'Craft textures visible' },
    rack_focus: true,
    focus_pulls: ['Memory transitions', 'Reveal craft details', 'Emotional shifts']
  },
  
  framing: {
    aspect_ratio: '1.85:1 comfortable',
    headroom: 'Comfortable, room to breathe',
    lead_room: 'Follows whimsy',
    nose_room: 'Natural',
    symmetry: { use: false, when: 'Rarely - too controlled' },
    rule_of_thirds: true,
    center_framing: { use: true, when: 'Direct emotional address' },
    negative_space: 'Filled with craft details',
    safe_areas: { action: '90%', title: '85%' }
  },
  
  movement: {
    philosophy: 'Camera should feel handmade too - human, imperfect, alive.',
    static: { when: ['Tableau shots of craft worlds'], motivation: 'Admire the handmade' },
    handheld: { when: ['Following subjects', 'Intimate moments'], intensity: 'Gentle organic' },
    steadicam: { when: ['Flowing through spaces'], speed: 'Dreamlike float' },
    dolly: { when: ['Reveal of craft sets', 'Morphing transitions'], track_type: 'Creative curves' },
    crane: { when: ['Rising to reveal', 'Floating over worlds'], height: 'Low-medium for intimacy' },
    drone: { when: ['Rarely - too smooth'], altitude: 'N/A' },
    speed: 'Matched to music, playful tempo'
  },
  
  shot_library: {
    wide_establishing: createShotSpec({
      lens_mm: '18mm', aperture: 'f/4', camera_height: 'Child eye level', camera_angle: 'Slight up to wonder',
      movement: 'Slow reveal pan', lighting_key: 'Soft overhead glow',
      framing: 'Craft world visible', depth_of_field: 'Deep to show detail',
      prompt_template: 'Wide establishing shot, handmade craft world, Michel Gondry DIY aesthetic, Bruno Delbonnel soft diffused light, cardboard and paper textures visible, warm nostalgic tones, 18mm Cooke lens, playful composition, fairy tale quality',
      edit_prompt: 'Pull back to wide: reveal entire handmade world, soft diffused lighting, warm nostalgic tones, Gondry craft aesthetic'
    }),
    wide_environment: createShotSpec({
      lens_mm: '25mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Straight wonder',
      movement: 'Gentle drift', lighting_key: 'Soft window light',
      framing: 'Environment as character', depth_of_field: 'Medium',
      prompt_template: 'Environmental wide shot, {subject} in handmade space, soft diffused light through paper windows, warm Gondry aesthetic, craft textures throughout, 25mm organic distortion',
      edit_prompt: 'Reframe environmental: show more craft world, soft diffused lighting, handmade textures'
    }),
    medium_full: createShotSpec({
      lens_mm: '32mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Friendly straight',
      movement: 'Following handheld', lighting_key: 'Soft overhead wrap',
      framing: 'Full body in craft world', depth_of_field: 'Medium',
      prompt_template: 'Medium full shot, {subject} full body, surrounded by handmade environment, soft Delbonnel lighting, warm gentle tones, Gondry whimsy, organic camera feel',
      edit_prompt: 'Adjust to medium full: full body visible, craft environment surrounding, soft lighting'
    }),
    medium_narrative: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Intimate straight',
      movement: 'Subtle organic breathing', lighting_key: 'Soft beauty',
      framing: 'Waist up dreamy', depth_of_field: 'Selective',
      prompt_template: 'Medium narrative shot, {subject} waist-up, soft dreamy focus, Delbonnel painterly light, Cooke lens glow, emotional connection, nostalgic warmth',
      edit_prompt: 'Reframe medium: waist up, soft focus background, painterly lighting'
    }),
    medium_close: createShotSpec({
      lens_mm: '75mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Tender',
      movement: 'Minimal breathing', lighting_key: 'Soft wrap',
      framing: 'Chest up tender', depth_of_field: 'Shallow',
      prompt_template: 'Medium close-up, {subject} chest and face, soft shallow focus, Delbonnel beauty lighting, warm gentle tones, tender emotional beat, Cooke look',
      edit_prompt: 'Push to medium close: chest and face, shallow dreamy focus, tender lighting'
    }),
    close_up_emotional: createShotSpec({
      lens_mm: '75mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Intimate',
      movement: 'Barely perceptible', lighting_key: 'Soft beauty diffused',
      framing: 'Face as feeling', depth_of_field: 'Very shallow',
      prompt_template: 'Emotional close-up, {subject} face in soft focus, eyes glistening, Gondry emotional honesty, Delbonnel soft light wrapping face, nostalgic beauty, dreamy shallow focus',
      edit_prompt: 'Transform to emotional close-up: face fills frame, dreamy soft focus, tender lighting'
    }),
    close_up_profile: createShotSpec({
      lens_mm: '100mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Profile',
      movement: 'Static', lighting_key: 'Soft rim and key',
      framing: 'Profile in dream', depth_of_field: 'Ultra shallow',
      prompt_template: 'Profile close-up, {subject} in soft profile, gentle rim light, dreamy background blur, nostalgic contemplation, Gondry melancholy beauty',
      edit_prompt: 'Reframe to profile: 90 degree side, soft rim light, dreamy mood'
    }),
    extreme_close_up: createShotSpec({
      lens_mm: '100mm', aperture: 'f/2.8', camera_height: 'Detail level', camera_angle: 'Intimate',
      movement: 'Static wonder', lighting_key: 'Detail revealing soft',
      framing: 'Detail as emotion', depth_of_field: 'Paper thin',
      prompt_template: 'Extreme close-up, {detail} in intimate detail, handmade texture visible, craft quality, soft diffused light, Gondry attention to small wonders',
      edit_prompt: 'Push to extreme close: single detail, handmade texture visible, soft focus'
    }),
    detail_insert: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Tabletop', camera_angle: 'Wonder angle',
      movement: 'Static or gentle reveal', lighting_key: 'Soft motivated',
      framing: 'Object in craft world', depth_of_field: 'Selective',
      prompt_template: 'Detail insert, {object} handmade quality, craft texture visible, soft diffused lighting, Gondry nostalgic object, meaningful small thing',
      edit_prompt: 'Create detail insert: isolate handmade object, soft lighting, nostalgic quality'
    }),
    overhead_god_view: createShotSpec({
      lens_mm: '18mm', aperture: 'f/4', camera_height: 'Above', camera_angle: 'Looking down',
      movement: 'Slow rotation', lighting_key: 'Even soft',
      framing: 'Pattern and craft', depth_of_field: 'Deep',
      prompt_template: 'Overhead view, looking down at {subject}, handmade world pattern visible, soft even lighting, Gondry playful perspective, craft textures throughout',
      edit_prompt: 'Transform to overhead: looking straight down, reveal handmade patterns, soft lighting'
    }),
    low_angle_power: createShotSpec({
      lens_mm: '25mm', aperture: 'f/2.8', camera_height: 'Ground', camera_angle: 'Looking up',
      movement: 'Static wonder', lighting_key: 'Backlit soft',
      framing: 'Hero wonder', depth_of_field: 'Medium',
      prompt_template: 'Low angle wonder shot, {subject} as hero, looking up with childlike awe, soft backlight, Gondry magical perspective, craft world visible',
      edit_prompt: 'Shift to low angle: ground level looking up, wonder perspective, soft backlight'
    }),
    high_angle_vulnerable: createShotSpec({
      lens_mm: '32mm', aperture: 'f/2.8', camera_height: 'Above', camera_angle: 'Looking down gently',
      movement: 'Static tender', lighting_key: 'Top soft',
      framing: 'Small in big world', depth_of_field: 'Medium',
      prompt_template: 'High angle tender, looking down at {subject}, surrounded by craft world, soft top lighting, Gondry gentle observation',
      edit_prompt: 'Reframe from above: gentle high angle, subject in craft environment, tender observation'
    }),
    dutch_angle_tension: createShotSpec({
      lens_mm: '25mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Tilted 15 degrees',
      movement: 'Playful tilt', lighting_key: 'Soft surreal',
      framing: 'Playful unease', depth_of_field: 'Medium',
      prompt_template: 'Dutch angle playful, tilted 15 degrees, {subject} in surreal moment, Gondry dreamlike tilt, soft lighting, playful disorientation',
      edit_prompt: 'Apply playful dutch: 15 degree tilt, dreamlike quality, soft lighting'
    }),
    pov_subjective: createShotSpec({
      lens_mm: '25mm', aperture: 'f/2.8', camera_height: 'Subject eye level', camera_angle: 'Their view',
      movement: 'Organic handheld', lighting_key: 'As they see',
      framing: 'First person wonder', depth_of_field: 'Selective',
      prompt_template: 'POV shot, first person view, seeing what {subject} sees, handheld organic movement, discovering craft world, Gondry wonder perspective',
      edit_prompt: 'Convert to POV: first person, discovering craft world, organic movement'
    }),
    over_shoulder: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Shoulder', camera_angle: 'Past shoulder',
      movement: 'Gentle breathing', lighting_key: 'Soft both',
      framing: 'Observing discovery', depth_of_field: 'Subject sharp',
      prompt_template: 'Over shoulder discovery, {subject} seen past another, observing reaction, soft Delbonnel lighting, intimate discovery moment',
      edit_prompt: 'Add over-shoulder: foreground soft, main subject discovering, intimate observation'
    }),
    two_shot: createShotSpec({
      lens_mm: '32mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Following action', lighting_key: 'Soft for both',
      framing: 'Together in craft world', depth_of_field: 'Both in focus',
      prompt_template: 'Two shot together, {subjects} in craft environment, soft diffused lighting on both, Gondry relationship dynamics, warm nostalgic quality',
      edit_prompt: 'Compose as two-shot: two figures in craft world, soft lighting, relationship visible'
    })
  },
  
  ai_prompts: {
    style_prefix: 'Michel Gondry directing, Bruno Delbonnel cinematography, handmade craft aesthetic, soft diffused Vermeer lighting, warm nostalgic color palette, cardboard and paper textures, practical magic effects, Cooke lens warmth, 1.85:1 aspect ratio, organic film grain',
    master_shot_template: 'Wide master shot, {scene_description}, Michel Gondry handmade world, Delbonnel soft painterly light, craft textures visible, warm nostalgic tones, practical magic aesthetic, 25mm Cooke wide',
    performance_template: 'Performance shot, {artist} in craft environment, Gondry whimsy, soft diffused beauty light, nostalgic warmth, organic handheld movement, tender emotional connection',
    broll_template: 'Craft B-roll, {description}, Michel Gondry handmade world, no people, cardboard and paper textures, soft diffused light, nostalgic still life, attention to small wonders',
    emotional_template: 'Tender close-up, {description}, Gondry emotional honesty, Delbonnel soft wrap, eyes glistening, shallow dreamy focus, nostalgic beauty, vulnerable moment',
    action_template: 'Playful action shot, {description}, Gondry rhythmic movement, practical effects in motion, organic camera following, soft diffused light throughout, matched to music beat',
    negative_prompt: 'harsh lighting, cold blue tones, digital clinical look, CGI heavy, perfect symmetry, dark noir shadows, sterile environment, modern sleek design'
  },
  
  variation_config: {
    max_variations_per_scene: 4,
    variation_types: ['wide_establishing', 'medium_narrative', 'close_up_emotional', 'detail_insert'],
    energy_based_selection: true,
    beat_sync_enabled: true
  },
  
  // 🎬 EDITING STYLE - Michel Gondry: Handmade rhythm, nostalgic pacing
  editing_style: {
    philosophy: 'Handcrafted edits like paper puppets. Let the wonder breathe.',
    pace_modifier: 1.1,           // 10% slower - savor the craft
    minimum_cut_duration: 1.0,    // Quick enough for whimsy
    maximum_cut_duration: 6.0,    // Long enough for wonder
    beat_alignment: 'half_beat',  // Playful, between beats
    hold_on_emotion: true,        // Tender moments need time
    emotion_hold_multiplier: 1.6, // 60% longer on emotional beats
    accelerate_on_energy: true,
    energy_acceleration: 0.8,     // Gentle acceleration
    transition_preferences: {
      intro: 'wipe',              // Playful wipes
      verse: 'match_cut',         // Handmade match cuts
      chorus: 'cut',
      bridge: 'dissolve',
      drop: 'cut',
      outro: 'iris'
    },
    cut_patterns: {
      use_jump_cuts: false,       // Too jarring
      use_match_cuts: true,       // Core to his style
      use_j_cuts: true,
      use_l_cuts: true,
      use_smash_cuts: false
    },
    section_beat_overrides: {
      intro: 1.5,                 // Setup the handmade world
      verse: 1.2,                 // Nostalgic storytelling
      chorus: 0.9,                // Gentle energy
      drop: 0.7,                  // Whimsical acceleration
      bridge: 1.4,                // Tender moments
      outro: 2.0                  // Wistful ending
    }
  }
};

// =============================================================================
// 5. EDGAR WRIGHT + BILL POPE
// =============================================================================

export const EDGAR_WRIGHT_POPE: DirectorDPProfile = {
  id: 'edgar-wright-pope',
  version: '1.0.0',
  
  director: {
    name: 'Edgar Wright',
    visual_philosophy: 'Every cut, every pan, every camera move must serve rhythm and comedy. Editing is music.',
    signature_techniques: [
      'Whip pans and whip zooms',
      'Crash zooms on details',
      'Match cuts on action',
      'Perfect sync to music',
      'Visual puns and gags',
      'Smash cuts for comedy'
    ],
    narrative_style: 'Kinetic comedy, genre-loving parody, rhythmic storytelling',
    emotional_language: 'Excitement, wit, homage, pure cinematic joy',
    pacing: 'Machine-gun editing, zero dead space, musical precision',
    iconic_works: [
      { title: 'Baby Driver', year: 2017, visual_highlight: 'Music-synced action' },
      { title: 'Scott Pilgrim', year: 2010, visual_highlight: 'Comic book cinematics' },
      { title: 'Hot Fuzz', year: 2007, visual_highlight: 'Action movie parody' }
    ],
    influences: ['Sam Raimi', 'Jackie Chan', 'Music video directors'],
    awards: ['BAFTA nominations', 'Saturn Awards']
  },
  
  cinematographer: {
    name: 'Bill Pope',
    technical_philosophy: 'Camera should be an active participant, not a passive observer.',
    signature_look: 'High contrast comic book colors with dynamic movement',
    legendary_technique: 'Created bullet-time for The Matrix trilogy',
    famous_collaborations: ['Sam Raimi', 'Wachowskis', 'Edgar Wright'],
    camera_preference: 'ARRI Alexa with high frame rates for action',
    lens_preference: 'Zeiss Master Primes for sharpness in motion',
    lighting_philosophy: 'Bold, theatrical, high contrast. Light for movement.',
    awards: ['Saturn Awards', 'BAFTA nominations']
  },
  
  collaboration: {
    synergy_score: 96,
    visual_harmony: 'Speed and precision meet bold visuals. Every frame designed for impact.',
    combined_signature: 'Kinetic comic book energy with surgical editing precision',
    best_for_genres: ['Music Videos', 'Action', 'Comedy', 'Genre Mash-ups'],
    combined_influences: ['Comic Books', 'Hong Kong Action Cinema', 'Music Videos']
  },
  
  camera: {
    name: 'ARRI Alexa XT Plus',
    sensor_format: 'Super 35mm',
    resolution: '3.4K',
    dynamic_range: '14+ stops',
    color_science: 'ARRI LogC for bold grading',
    best_for: ['High speed action', 'Dynamic movement', 'Bold colors']
  },
  
  lenses: {
    manufacturer: 'Zeiss',
    series: 'Master Prime',
    format: 'Spherical',
    focal_lengths: [
      { mm: '16mm', use_case: 'Extreme wide gags', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Ultra deep', bokeh_quality: 'Clean', distortion: 'Controlled for effect' },
      { mm: '25mm', use_case: 'Wide action', aperture_sweet_spot: 'f/2', depth_of_field: 'Deep', bokeh_quality: 'Neutral', distortion: 'Minimal' },
      { mm: '35mm', use_case: 'Standard kinetic', aperture_sweet_spot: 'f/1.8', depth_of_field: 'Medium', bokeh_quality: 'Clean', distortion: 'None' },
      { mm: '50mm', use_case: 'Close-up punchlines', aperture_sweet_spot: 'f/1.4', depth_of_field: 'Selective', bokeh_quality: 'Smooth', distortion: 'None' },
      { mm: '100mm', use_case: 'Crash zoom targets', aperture_sweet_spot: 'f/2', depth_of_field: 'Very shallow', bokeh_quality: 'Compressed', distortion: 'None' },
      { mm: '24-290mm zoom', use_case: 'Crash zooms', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Variable', bokeh_quality: 'Action', distortion: 'Minimal' }
    ],
    characteristics: ['Razor sharp', 'Perfect contrast', 'No flare issues', 'Clinical precision'],
    flare_characteristics: 'Controlled, used for stylistic pop when desired',
    cost_tier: 'Premium'
  },
  
  lighting: {
    key_style: 'High contrast theatrical',
    key_ratio: '4:1 dramatic but readable',
    fill_approach: 'Minimal for pop, controlled shadows',
    backlight: 'Strong colored rims for pop',
    color_temperature: {
      key: '5600K neutral',
      fill: '5600K controlled',
      accent: 'Bold neon colors'
    },
    practicals: ['Neon signs', 'TV glow', 'Club lights', 'Window shafts'],
    motivated_sources: ['Windows', 'Practical lamps', 'Screen glow'],
    signature_setup: 'High contrast with bold colored accents. Strong backlights for separation. Neon practicals adding energy. Comic book lighting - bold, readable, theatrical. Every light serves the rhythm.'
  },
  
  color_grading: {
    primary_palette: ['Bold primaries', 'Neon accents', 'Comic book saturation', 'Clean blacks'],
    shadows: { hue: 'Deep black or colored', saturation: '20%', lift: '0 crushed' },
    midtones: { hue: 'Saturated natural', saturation: '120%', gamma: '1.0' },
    highlights: { hue: 'Clean white or colored', saturation: '30%', gain: '+0.1' },
    overall_saturation: '120% - pushed for comic pop',
    contrast: 'High contrast, punchy, readable',
    film_emulation: 'Digital push for comic book look',
    grain: { intensity: 'Minimal', size: 'Fine', character: 'Clean digital' }
  },
  
  depth_of_field: {
    philosophy: 'Deep focus for action, shallow for jokes and reveals',
    wide_shots: { aperture: 'f/5.6-f/8', focus_distance: 'Hyperfocal', description: 'Everything readable for action' },
    medium_shots: { aperture: 'f/2.8', focus_distance: 'Action', description: 'Subject and action sharp' },
    close_ups: { aperture: 'f/2', focus_distance: 'Face', description: 'Punchline delivery sharp' },
    extreme_close_ups: { aperture: 'f/2.8', focus_distance: 'Detail', description: 'Object gag sharp' },
    rack_focus: true,
    focus_pulls: ['For gags', 'Reveal punchlines', 'Crash zoom holds']
  },
  
  framing: {
    aspect_ratio: '2.39:1 scope for epic comedy',
    headroom: 'Minimal for tension',
    lead_room: 'Precise for movement',
    nose_room: 'Broken for gags',
    symmetry: { use: true, when: 'Power shots, confrontations' },
    rule_of_thirds: true,
    center_framing: { use: true, when: 'Direct address, punchlines' },
    negative_space: 'Filled or used for reveals',
    safe_areas: { action: '95%', title: '85%' }
  },
  
  movement: {
    philosophy: 'Every move is a joke or a beat. Dead camera = dead comedy.',
    static: { when: ['Only for specific beats', 'Setup shots'], motivation: 'Pause before punch' },
    handheld: { when: ['Chaos moments'], intensity: 'Controlled chaos' },
    steadicam: { when: ['Following action through space'], speed: 'Fast and precise' },
    dolly: { when: ['Push for emphasis', 'Tracking action'], track_type: 'Precise' },
    crane: { when: ['Reveal shots', 'Action climaxes'], height: 'Variable for impact' },
    drone: { when: ['Epic establishing'], altitude: 'Dynamic' },
    speed: 'Fast, matched to beats, whip pans and zooms'
  },
  
  shot_library: {
    wide_establishing: createShotSpec({
      lens_mm: '16mm', aperture: 'f/5.6', camera_height: 'Variable', camera_angle: 'Dynamic',
      movement: 'Whip pan arrival', lighting_key: 'High contrast bold',
      framing: 'Deep composition', depth_of_field: 'Deep',
      prompt_template: 'Wide establishing shot, Edgar Wright kinetic style, Bill Pope bold lighting, high contrast saturated colors, deep composition, comic book visual energy, 16mm wide with controlled distortion, 2.39:1 scope',
      edit_prompt: 'Pull back to dynamic wide: Edgar Wright style, bold colors, high contrast, deep focus, comic book energy'
    }),
    wide_environment: createShotSpec({
      lens_mm: '25mm', aperture: 'f/4', camera_height: 'Dynamic', camera_angle: 'Action oriented',
      movement: 'Tracking or steady', lighting_key: 'Bold theatrical',
      framing: 'Action staging', depth_of_field: 'Deep',
      prompt_template: 'Wide environment shot, {subject} in action space, Edgar Wright staging, bold saturated colors, high contrast lighting, comic book cinematography, ready for action',
      edit_prompt: 'Reframe wide environment: action staging visible, bold colors, high contrast, Edgar Wright style'
    }),
    medium_full: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Dynamic', camera_angle: 'Action',
      movement: 'Following or pushing', lighting_key: 'High contrast',
      framing: 'Full body action ready', depth_of_field: 'Medium',
      prompt_template: 'Medium full action shot, {subject} full body, Edgar Wright dynamic framing, bold colors, strong backlight, ready for movement, comic book energy',
      edit_prompt: 'Adjust to medium full: full body visible, action ready pose, bold lighting'
    }),
    medium_narrative: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Direct',
      movement: 'Subtle or pushing', lighting_key: 'Theatrical',
      framing: 'Waist up punchline', depth_of_field: 'Selective',
      prompt_template: 'Medium narrative shot, {subject} waist-up, Edgar Wright comedy timing, saturated colors, strong key light, center composition for impact',
      edit_prompt: 'Reframe medium: waist up, punchline composition, bold lighting'
    }),
    medium_close: createShotSpec({
      lens_mm: '50mm', aperture: 'f/1.8', camera_height: 'Eye level', camera_angle: 'Direct',
      movement: 'Push or crash zoom', lighting_key: 'Beauty with pop',
      framing: 'Chest up impact', depth_of_field: 'Shallow',
      prompt_template: 'Medium close-up, {subject} chest and face, Edgar Wright comedy beat, sharp focus on expression, bold colors, theatrical lighting, impact framing',
      edit_prompt: 'Push to medium close: chest and face, punchline delivery, sharp focus'
    }),
    close_up_emotional: createShotSpec({
      lens_mm: '50mm', aperture: 'f/1.4', camera_height: 'Eye level', camera_angle: 'Direct punch',
      movement: 'Crash zoom or static hold', lighting_key: 'Theatrical beauty',
      framing: 'Face as punchline', depth_of_field: 'Very shallow',
      prompt_template: 'Close-up reaction shot, {subject} face filling frame, Edgar Wright comedic timing, eyes delivering punchline, bold saturated colors, theatrical lighting',
      edit_prompt: 'Transform to reaction close-up: face fills frame, comedic expression, bold lighting'
    }),
    close_up_profile: createShotSpec({
      lens_mm: '75mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Profile',
      movement: 'Static or whip', lighting_key: 'Strong rim',
      framing: 'Profile silhouette pop', depth_of_field: 'Shallow',
      prompt_template: 'Profile shot, {subject} in strong profile, bold rim light, comic book silhouette, Edgar Wright graphic composition',
      edit_prompt: 'Reframe to profile: 90 degree side, strong rim light, graphic composition'
    }),
    extreme_close_up: createShotSpec({
      lens_mm: '100mm', aperture: 'f/2.8', camera_height: 'Object level', camera_angle: 'Direct crash',
      movement: 'Crash zoom target', lighting_key: 'Detail pop',
      framing: 'Object gag', depth_of_field: 'Very shallow',
      prompt_template: 'Extreme close-up, crash zoom on {detail}, Edgar Wright object gag, sharp focus, bold lighting, graphic isolation, comic book detail shot',
      edit_prompt: 'Crash to extreme close: object isolated, sharp focus, gag reveal'
    }),
    detail_insert: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Tabletop', camera_angle: 'Graphic',
      movement: 'Whip pan in', lighting_key: 'Bold graphic',
      framing: 'Object as punchline', depth_of_field: 'Selective',
      prompt_template: 'Detail insert, {object} as visual punchline, Edgar Wright graphic insert, bold saturated lighting, clean isolation, comic book quality',
      edit_prompt: 'Create detail insert: object isolated, graphic lighting, punchline framing'
    }),
    overhead_god_view: createShotSpec({
      lens_mm: '16mm', aperture: 'f/4', camera_height: 'High', camera_angle: '90 degrees down',
      movement: 'Slow reveal or whip', lighting_key: 'Even graphic',
      framing: 'Pattern action', depth_of_field: 'Deep',
      prompt_template: 'Overhead shot, looking down at {subject}, Edgar Wright god POV, bold graphic patterns, high contrast, action visible, comic book panel',
      edit_prompt: 'Transform to overhead: 90 degrees down, graphic patterns, bold colors'
    }),
    low_angle_power: createShotSpec({
      lens_mm: '25mm', aperture: 'f/2.8', camera_height: 'Ground', camera_angle: 'Looking up',
      movement: 'Push or static', lighting_key: 'Heroic backlight',
      framing: 'Hero power', depth_of_field: 'Deep',
      prompt_template: 'Low angle hero shot, {subject} towering above, Edgar Wright heroic framing, bold backlight, comic book power pose, saturated colors',
      edit_prompt: 'Shift to low angle: ground level hero, bold backlight, power pose'
    }),
    high_angle_vulnerable: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Above', camera_angle: 'Looking down',
      movement: 'Slow push down', lighting_key: 'Top contrast',
      framing: 'Subject below', depth_of_field: 'Medium',
      prompt_template: 'High angle shot, looking down at {subject}, Edgar Wright visual commentary, bold lighting from above, comedic vulnerability',
      edit_prompt: 'Reframe from above: high angle looking down, comedic framing'
    }),
    dutch_angle_tension: createShotSpec({
      lens_mm: '25mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Tilted 20 degrees',
      movement: 'Whip pan with tilt', lighting_key: 'Dramatic',
      framing: 'Chaos angle', depth_of_field: 'Medium',
      prompt_template: 'Dutch angle chaos, tilted 20 degrees, {subject} in unstable frame, Edgar Wright visual energy, bold colors, comic book dynamism',
      edit_prompt: 'Apply dutch angle: 20 degree tilt, visual chaos, comic book energy'
    }),
    pov_subjective: createShotSpec({
      lens_mm: '25mm', aperture: 'f/2.8', camera_height: 'Subject eye', camera_angle: 'Their POV',
      movement: 'Fast kinetic', lighting_key: 'As environment',
      framing: 'First person action', depth_of_field: 'Deep',
      prompt_template: 'POV action shot, first person view, seeing what {subject} sees, kinetic movement, Edgar Wright immersion, bold colors',
      edit_prompt: 'Convert to POV: first person, kinetic movement, action immersion'
    }),
    over_shoulder: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Shoulder', camera_angle: 'Past shoulder',
      movement: 'Whip or push', lighting_key: 'Dramatic both',
      framing: 'Confrontation', depth_of_field: 'Subject sharp',
      prompt_template: 'Over shoulder confrontation, {subject} through foreground, Edgar Wright framing, bold lighting, tension building, comic book cinematography',
      edit_prompt: 'Add over-shoulder: confrontation framing, subject sharp, bold lighting'
    }),
    two_shot: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Balanced',
      movement: 'Push or static', lighting_key: 'Bold for both',
      framing: 'Duo dynamics', depth_of_field: 'Both sharp',
      prompt_template: 'Two shot, {subjects} in frame, Edgar Wright buddy dynamics, bold saturated lighting, comic book framing, both faces sharp, relationship dynamics visible',
      edit_prompt: 'Compose as two-shot: duo framing, bold lighting, relationship visible'
    })
  },
  
  ai_prompts: {
    style_prefix: 'Edgar Wright directing, Bill Pope cinematography, kinetic comic book style, bold saturated colors, high contrast lighting, 2.39:1 scope, crash zooms, whip pans, deep focus action, theatrical lighting, visual rhythm matched to music',
    master_shot_template: 'Wide master shot, {scene_description}, Edgar Wright kinetic composition, Bill Pope bold lighting, saturated comic book colors, deep focus staging, action ready framing, 25mm Zeiss sharpness',
    performance_template: 'Performance shot, {artist} in Edgar Wright frame, bold theatrical lighting, saturated colors, center composition, comedic intensity, crash zoom potential, direct camera address',
    broll_template: 'Kinetic B-roll, {description}, Edgar Wright visual gag quality, bold graphic lighting, no people, objects as punchlines, crash zoom targets, comic book composition, saturated colors',
    emotional_template: 'Reaction close-up, {description}, Edgar Wright comedy timing, sharp focus on expression, bold saturated colors, theatrical lighting, punchline delivery, eyes telling joke',
    action_template: 'Action shot, {description}, Edgar Wright kinetic energy, crash zooms, whip pans, bold colors, deep focus throughout, matched to music beat, comic book dynamism',
    negative_prompt: 'desaturated muted colors, soft low contrast, handheld organic movement, natural lighting, slow pacing, empty dead frames, documentary style, neutral grading'
  },
  
  variation_config: {
    max_variations_per_scene: 5,
    variation_types: ['wide_establishing', 'extreme_close_up', 'close_up_emotional', 'dutch_angle_tension', 'detail_insert'],
    energy_based_selection: true,
    beat_sync_enabled: true
  },
  
  // 🎬 EDITING STYLE - Edgar Wright: ULTRA FAST, kinetic, comedic precision
  editing_style: {
    philosophy: 'Every. Single. Cut. Matters. Editing IS the comedy. Rhythm IS music.',
    pace_modifier: 0.5,           // 50% FASTER - hyper-kinetic
    minimum_cut_duration: 0.15,   // Flash cuts for comedy
    maximum_cut_duration: 2.0,    // Never hold too long
    beat_alignment: 'any_beat',   // Cut on EVERYTHING
    hold_on_emotion: false,       // Comedy keeps moving
    emotion_hold_multiplier: 1.0,
    accelerate_on_energy: true,
    energy_acceleration: 0.4,     // Gets even faster
    transition_preferences: {
      intro: 'smash',             // Smash in
      verse: 'whip',              // Whip pans
      chorus: 'crash_zoom',       // Crash zooms
      bridge: 'match_cut',        // Visual puns
      drop: 'smash',              // Impact
      outro: 'smash'
    },
    cut_patterns: {
      use_jump_cuts: true,        // For comedy
      use_match_cuts: true,       // Visual puns
      use_j_cuts: true,
      use_l_cuts: true,
      use_smash_cuts: true        // Signature move
    },
    section_beat_overrides: {
      intro: 0.8,                 // Fast even in intro
      verse: 0.6,                 // Quick verse
      chorus: 0.4,                // Hyper-fast chorus
      drop: 0.3,                  // INSANE on drops
      bridge: 0.7,                // Slight breathing room
      outro: 0.5                  // Smash out
    }
  }
};

// =============================================================================
// 6. DENIS VILLENEUVE + ROGER DEAKINS
// =============================================================================

export const DENIS_VILLENEUVE_DEAKINS: DirectorDPProfile = {
  id: 'denis-villeneuve-deakins',
  version: '1.0.0',
  
  director: {
    name: 'Denis Villeneuve',
    visual_philosophy: 'Scale as emotion. Epic vistas containing intimate human truth.',
    signature_techniques: [
      'Massive scale with intimate focus',
      'Desaturated vast landscapes',
      'Slow contemplative pacing',
      'Geometric architectural framing',
      'Silence as tool',
      'Brutalist compositions'
    ],
    narrative_style: 'Philosophical science fiction, existential drama, slow-burn tension',
    emotional_language: 'Awe, isolation, wonder, existential weight',
    pacing: 'Deliberate, patient, building to overwhelming',
    iconic_works: [
      { title: 'Blade Runner 2049', year: 2017, visual_highlight: 'Orange wasteland scale' },
      { title: 'Dune', year: 2021, visual_highlight: 'Desert mysticism' },
      { title: 'Arrival', year: 2016, visual_highlight: 'Alien intimacy' }
    ],
    influences: ['Andrei Tarkovsky', 'Ridley Scott', 'Stanley Kubrick'],
    awards: ['Academy Award nominations for Best Director']
  },
  
  cinematographer: {
    name: 'Roger Deakins',
    technical_philosophy: 'Simplicity is the ultimate sophistication. One light source, perfectly placed.',
    signature_look: 'Naturalistic minimalism with epic scale and precise light control',
    legendary_technique: '15x Academy Award nominated, GOAT cinematographer',
    famous_collaborations: ['Coen Brothers', 'Sam Mendes', 'Denis Villeneuve'],
    camera_preference: 'ARRI Alexa LF for scale and natural color',
    lens_preference: 'Custom Deakins lenses, Panavision Primo for naturalism',
    lighting_philosophy: 'Single motivated source, embrace negative space, let darkness speak.',
    awards: ['2x Academy Award for Best Cinematography', '15 nominations']
  },
  
  collaboration: {
    synergy_score: 99,
    visual_harmony: 'Epic minimalism. Scale and simplicity creating transcendent imagery.',
    combined_signature: 'Vast geometric landscapes with single-source light precision',
    best_for_genres: ['Science Fiction', 'Epic Drama', 'Art House', 'Contemplative Music Videos'],
    combined_influences: ['2001: A Space Odyssey', 'Tarkovsky', 'Brutalist Architecture']
  },
  
  camera: {
    name: 'ARRI Alexa LF',
    sensor_format: 'Large Format 36.70mm x 25.54mm',
    resolution: '4.5K',
    dynamic_range: '14+ stops',
    color_science: 'ARRI LogC - natural and forgiving',
    best_for: ['Epic landscapes', 'Low light precision', 'Natural color rendition']
  },
  
  lenses: {
    manufacturer: 'Panavision',
    series: 'Primo 70 / Custom Deakins glass',
    format: 'Large format spherical',
    focal_lengths: [
      { mm: '24mm', use_case: 'Vast landscapes', aperture_sweet_spot: 'f/4', depth_of_field: 'Deep', bokeh_quality: 'Controlled', distortion: 'Minimal' },
      { mm: '35mm', use_case: 'Environmental portrait', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Medium-deep', bokeh_quality: 'Natural', distortion: 'None' },
      { mm: '50mm', use_case: 'Standard epic', aperture_sweet_spot: 'f/2', depth_of_field: 'Medium', bokeh_quality: 'Subtle', distortion: 'None' },
      { mm: '75mm', use_case: 'Contemplative portrait', aperture_sweet_spot: 'f/2', depth_of_field: 'Shallow', bokeh_quality: 'Smooth', distortion: 'None' },
      { mm: '100mm', use_case: 'Intimate isolation', aperture_sweet_spot: 'f/2', depth_of_field: 'Very shallow', bokeh_quality: 'Creamy', distortion: 'None' },
      { mm: '150mm', use_case: 'Compressed landscapes', aperture_sweet_spot: 'f/2.8', depth_of_field: 'Very shallow', bokeh_quality: 'Stacked', distortion: 'None' }
    ],
    characteristics: ['Clinical sharpness', 'Neutral color', 'Large format falloff', 'Minimal distortion'],
    flare_characteristics: 'Avoided through precise flagging - clean imagery',
    cost_tier: 'Ultra-Premium'
  },
  
  lighting: {
    key_style: 'Single source naturalistic',
    key_ratio: '6:1 or higher - embrace shadows',
    fill_approach: 'Negative fill, minimal intervention',
    backlight: 'Motivated sun/artificial edge',
    color_temperature: {
      key: '5600K natural or tungsten warm',
      fill: 'Ambient only',
      accent: 'Environmental practicals'
    },
    practicals: ['Windows (primary source)', 'Industrial lights', 'Fire/flame', 'Screen glow'],
    motivated_sources: ['Single window', 'Sun shaft', 'Industrial overhead', 'Practical lamp'],
    signature_setup: 'Single large source - often a window or practical - with extensive negative fill. Let subjects fall into darkness. Embrace shadows as composition element. Environmental light as character.'
  },
  
  color_grading: {
    primary_palette: ['Desaturated earth', 'Orange/teal contrast', 'Monochromatic moments', 'Industrial gray'],
    shadows: { hue: 'Deep cold blue or neutral', saturation: '10%', lift: '-0.05' },
    midtones: { hue: 'Desaturated natural', saturation: '60%', gamma: '0.95' },
    highlights: { hue: 'Warm or cold depending on mood', saturation: '20%', gain: '0' },
    overall_saturation: '50-70% - heavily desaturated',
    contrast: 'High contrast with preserved detail',
    film_emulation: 'Digital with subtle film reference',
    grain: { intensity: 'Fine subtle', size: 'Large format', character: 'Clean organic' }
  },
  
  depth_of_field: {
    philosophy: 'Large format falloff creates natural hierarchy in vast spaces',
    wide_shots: { aperture: 'f/5.6-f/8', focus_distance: 'Landscape infinity', description: 'Epic scale sharp throughout' },
    medium_shots: { aperture: 'f/2.8', focus_distance: 'Subject precise', description: 'Subject in vast space' },
    close_ups: { aperture: 'f/2', focus_distance: 'Eyes', description: 'Intimate isolation' },
    extreme_close_ups: { aperture: 'f/2.8', focus_distance: 'Detail', description: 'Texture and meaning' },
    rack_focus: false,
    focus_pulls: ['Rarely - too distracting']
  },
  
  framing: {
    aspect_ratio: '2.39:1 or 2.76:1 IMAX',
    headroom: 'Generous - room for scale',
    lead_room: 'Balanced or isolating',
    nose_room: 'Natural or violated for isolation',
    symmetry: { use: true, when: 'Architectural, epic moments' },
    rule_of_thirds: true,
    center_framing: { use: true, when: 'Confrontation, power, awe' },
    negative_space: 'Extensive - subjects small in vastness',
    safe_areas: { action: '85%', title: '80%' }
  },
  
  movement: {
    philosophy: 'Camera moves should feel like breathing of the universe. Slow, inexorable.',
    static: { when: ['Tableaux moments', 'Contemplation', 'Awe'], motivation: 'Let scale speak' },
    handheld: { when: ['Rarely - too human'], intensity: 'N/A' },
    steadicam: { when: ['Following through epic spaces'], speed: 'Very slow, gliding' },
    dolly: { when: ['Slow reveals', 'Push into vastness'], track_type: 'Long, precise' },
    crane: { when: ['Epic reveals', 'Scale establishment'], height: 'Maximum for scale' },
    drone: { when: ['Landscape establishing'], altitude: 'High for perspective' },
    speed: 'Glacially slow, contemplative'
  },
  
  shot_library: {
    wide_establishing: createShotSpec({
      lens_mm: '24mm', aperture: 'f/8', camera_height: 'Elevated epic', camera_angle: 'Looking across',
      movement: 'Static or imperceptible drift', lighting_key: 'Single source natural',
      framing: 'Vast with small human', depth_of_field: 'Deep throughout',
      prompt_template: 'Epic wide establishing, vast landscape, Denis Villeneuve scale, Roger Deakins single-source light, desaturated earth tones, human figure tiny in frame, geometric composition, 24mm large format, 2.39:1 scope, contemplative silence',
      edit_prompt: 'Pull back to epic wide: vast landscape scale, subject tiny, Villeneuve minimalism, Deakins light'
    }),
    wide_environment: createShotSpec({
      lens_mm: '35mm', aperture: 'f/4', camera_height: 'Human perspective', camera_angle: 'Straight into vastness',
      movement: 'Slow push forward', lighting_key: 'Single motivated source',
      framing: 'Subject in architectural space', depth_of_field: 'Deep',
      prompt_template: 'Environmental wide, {subject} in vast architectural space, single window light source, Villeneuve brutalist aesthetic, Deakins precise lighting, desaturated palette, scale and isolation',
      edit_prompt: 'Reframe environmental: show vast space, single light source, brutalist composition'
    }),
    medium_full: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Static or slow approach', lighting_key: 'Single source with shadow',
      framing: 'Full figure in space', depth_of_field: 'Medium with falloff',
      prompt_template: 'Medium full shot, {subject} full figure in minimal space, single source lighting creating shadow division, Villeneuve contemplation, Deakins precision, desaturated tones',
      edit_prompt: 'Adjust to medium full: full figure, single light source, minimal environment'
    }),
    medium_narrative: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Contemplative',
      movement: 'Almost imperceptible push', lighting_key: 'Single source drama',
      framing: 'Waist up isolated', depth_of_field: 'Selective LF falloff',
      prompt_template: 'Medium narrative, {subject} waist-up in isolation, single source creating half-shadow, Villeneuve existential framing, Deakins sculptural light, desaturated contemplation',
      edit_prompt: 'Reframe medium: waist up, single source shadow division, contemplative isolation'
    }),
    medium_close: createShotSpec({
      lens_mm: '75mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Intimate',
      movement: 'Static observation', lighting_key: 'Precise beauty',
      framing: 'Chest up intimate isolation', depth_of_field: 'Shallow LF',
      prompt_template: 'Medium close-up, {subject} chest and face, precise single-source lighting, large format shallow focus, Villeneuve intimate epic, Deakins sculptural beauty',
      edit_prompt: 'Push to medium close: chest and face, large format falloff, sculptural light'
    }),
    close_up_emotional: createShotSpec({
      lens_mm: '75mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Direct contemplative',
      movement: 'Completely static', lighting_key: 'Deakins precision',
      framing: 'Face as landscape', depth_of_field: 'Very shallow LF',
      prompt_template: 'Contemplative close-up, {subject} face filling frame, single source sculptural light, eyes holding universe, Villeneuve existential weight, Deakins precision, shallow large format focus',
      edit_prompt: 'Transform to contemplative close-up: face as landscape, single source, existential depth'
    }),
    close_up_profile: createShotSpec({
      lens_mm: '100mm', aperture: 'f/2', camera_height: 'Eye level', camera_angle: 'Profile',
      movement: 'Static', lighting_key: 'Rim and key separation',
      framing: 'Profile contemplation', depth_of_field: 'Ultra shallow',
      prompt_template: 'Profile close-up, {subject} in contemplative profile, single rim light creating edge, ultra shallow focus, Villeneuve introspection, Deakins sculptural precision',
      edit_prompt: 'Reframe to profile: 90 degree side, single rim light, contemplative'
    }),
    extreme_close_up: createShotSpec({
      lens_mm: '100mm', aperture: 'f/2.8', camera_height: 'Detail level', camera_angle: 'Precise',
      movement: 'Static examination', lighting_key: 'Precise detail',
      framing: 'Detail as universe', depth_of_field: 'Paper thin',
      prompt_template: 'Extreme close-up, {detail} as cosmic detail, precise lighting revealing texture, paper-thin focus, Villeneuve attention to meaningful minutiae',
      edit_prompt: 'Push to extreme close: detail as universe, precise lighting, cosmic significance'
    }),
    detail_insert: createShotSpec({
      lens_mm: '75mm', aperture: 'f/2.8', camera_height: 'Object level', camera_angle: 'Contemplative',
      movement: 'Static or slow reveal', lighting_key: 'Single source precision',
      framing: 'Object with meaning', depth_of_field: 'Selective',
      prompt_template: 'Detail insert, {object} with weight of meaning, single source lighting, Villeneuve symbolic object, minimal composition, significance in simplicity',
      edit_prompt: 'Create detail insert: object isolated, single light, symbolic weight'
    }),
    overhead_god_view: createShotSpec({
      lens_mm: '24mm', aperture: 'f/5.6', camera_height: 'High crane/drone', camera_angle: 'Straight down',
      movement: 'Slow descent or static', lighting_key: 'Natural from above',
      framing: 'Geometric pattern', depth_of_field: 'Deep',
      prompt_template: 'Overhead god view, looking down at {subject}, geometric patterns in landscape, Villeneuve cosmic perspective, Deakins natural light from above, existential distance',
      edit_prompt: 'Transform to overhead: straight down, geometric patterns, cosmic perspective'
    }),
    low_angle_power: createShotSpec({
      lens_mm: '35mm', aperture: 'f/4', camera_height: 'Ground', camera_angle: 'Looking up at scale',
      movement: 'Static awe', lighting_key: 'Backlit epic',
      framing: 'Figure against vastness', depth_of_field: 'Deep',
      prompt_template: 'Low angle epic, {subject} against vast sky or structure, looking up in awe, Villeneuve scale, backlit edge lighting, human smallness against cosmic vastness',
      edit_prompt: 'Shift to low angle: looking up at vastness, human scale against epic backdrop'
    }),
    high_angle_vulnerable: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Above', camera_angle: 'Looking down',
      movement: 'Static observation', lighting_key: 'Top single source',
      framing: 'Small in vast space', depth_of_field: 'Medium',
      prompt_template: 'High angle isolation, looking down at {subject} small in space, Villeneuve existential framing, single overhead source, vulnerability in vastness',
      edit_prompt: 'Reframe from above: high angle, subject small in vast space, isolated'
    }),
    dutch_angle_tension: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Slight tilt 8 degrees',
      movement: 'Static unease', lighting_key: 'Single source drama',
      framing: 'Subtle disorientation', depth_of_field: 'Medium',
      prompt_template: 'Subtle dutch angle, slight 8 degree tilt, {subject} in unstable world, Villeneuve tension, minimal but unsettling, single dramatic source',
      edit_prompt: 'Apply subtle dutch: 8 degree tilt, subtle unease, dramatic lighting'
    }),
    pov_subjective: createShotSpec({
      lens_mm: '35mm', aperture: 'f/2.8', camera_height: 'Subject eye level', camera_angle: 'Their view',
      movement: 'Slow deliberate', lighting_key: 'As environment',
      framing: 'First person wonder', depth_of_field: 'Selective',
      prompt_template: 'POV contemplation, first person view, seeing what {subject} sees, slow movement through vast space, Villeneuve wonder, encountering scale',
      edit_prompt: 'Convert to POV: first person, encountering vastness, contemplative movement'
    }),
    over_shoulder: createShotSpec({
      lens_mm: '75mm', aperture: 'f/2.8', camera_height: 'Shoulder', camera_angle: 'Past shoulder into vastness',
      movement: 'Static', lighting_key: 'Motivated single',
      framing: 'Looking into scale', depth_of_field: 'Subject sharp, distance sharp',
      prompt_template: 'Over shoulder vista, {subject} looking into vast landscape, Villeneuve perspective framing, human observing cosmic scale, Deakins precise light',
      edit_prompt: 'Add over-shoulder: looking into vastness, human perspective on scale'
    }),
    two_shot: createShotSpec({
      lens_mm: '50mm', aperture: 'f/2.8', camera_height: 'Eye level', camera_angle: 'Straight',
      movement: 'Static observation', lighting_key: 'Single source for both',
      framing: 'Two in isolation together', depth_of_field: 'Both in focus',
      prompt_template: 'Two shot isolation, {subjects} together in vast space, Villeneuve shared loneliness, single source lighting, connected in emptiness',
      edit_prompt: 'Compose as two-shot: two figures in vast space, shared isolation, single light'
    })
  },
  
  ai_prompts: {
    style_prefix: 'Denis Villeneuve directing, Roger Deakins cinematography, epic minimalism, single-source lighting, desaturated earth tones, vast scale with intimate focus, brutalist architecture, large format cinematography, 2.39:1 scope, contemplative pacing, existential weight',
    master_shot_template: 'Epic wide master, {scene_description}, Denis Villeneuve scale, Roger Deakins single-source precision, vast landscape, tiny human figure, desaturated palette, geometric composition, 24mm large format, silence and awe',
    performance_template: 'Contemplative performance shot, {artist} in vast isolation, Villeneuve existential framing, single source sculptural light, desaturated beauty, large format shallow focus, weight of existence',
    broll_template: 'Epic B-roll, {description}, Villeneuve minimalism, Deakins single source, vast landscapes, no people, architectural geometry, desaturated earth tones, cosmic scale, contemplative stillness',
    emotional_template: 'Existential close-up, {description}, Villeneuve contemplation, Deakins precision light, single source sculptural, large format shallow focus, eyes as windows to universe, desaturated beauty',
    action_template: 'Epic action shot, {description}, Villeneuve scale, slow-motion contemplative action, vast environment, single dramatic lighting, desaturated palette, action as meditation',
    negative_prompt: 'saturated colors, multiple light sources, handheld shakiness, warm cozy lighting, cluttered composition, intimate small spaces, bright cheerful tones, fast pacing'
  },
  
  variation_config: {
    max_variations_per_scene: 4,
    variation_types: ['wide_establishing', 'medium_close', 'close_up_emotional', 'overhead_god_view'],
    energy_based_selection: true,
    beat_sync_enabled: true
  },
  
  // 🎬 EDITING STYLE - Denis Villeneuve: EPIC, contemplative, patient
  editing_style: {
    philosophy: 'Let the vastness breathe. Scale needs time to be felt. Patience is power.',
    pace_modifier: 1.5,           // 50% SLOWER - epic contemplation
    minimum_cut_duration: 2.5,    // Never rush the vastness
    maximum_cut_duration: 15.0,   // Can hold for eternity
    beat_alignment: 'off_beat',   // Cuts feel cosmic, not rhythmic
    hold_on_emotion: true,        // Existential moments need time
    emotion_hold_multiplier: 2.0, // Double time on emotional beats
    accelerate_on_energy: false,  // Epic never rushes
    energy_acceleration: 1.2,     // Even on energy, stay measured
    transition_preferences: {
      intro: 'fade',              // Emerge from black
      verse: 'dissolve',          // Slow dissolves
      chorus: 'cut',              // Clean cuts
      bridge: 'dissolve',
      drop: 'cut',
      outro: 'fade'               // Return to void
    },
    cut_patterns: {
      use_jump_cuts: false,       // Never jarring
      use_match_cuts: true,       // Scale matching
      use_j_cuts: true,           // Sound design driven
      use_l_cuts: true,
      use_smash_cuts: false       // Too crude for epic
    },
    section_beat_overrides: {
      intro: 3.0,                 // Epic opening
      verse: 2.0,                 // Contemplative
      chorus: 1.5,                // Slightly faster but still epic
      drop: 1.0,                  // Even drops are measured
      bridge: 2.5,                // Return to contemplation
      outro: 4.0                  // Vast ending
    }
  }
};

// =============================================================================
// Export Part 2 profiles
// =============================================================================

export const DIRECTOR_DP_PROFILES_PART2: Record<string, DirectorDPProfile> = {
  'michel-gondry': MICHEL_GONDRY_DELBONNEL,
  'michel-gondry-delbonnel': MICHEL_GONDRY_DELBONNEL,
  'Michel Gondry': MICHEL_GONDRY_DELBONNEL,
  
  'edgar-wright': EDGAR_WRIGHT_POPE,
  'edgar-wright-pope': EDGAR_WRIGHT_POPE,
  'Edgar Wright': EDGAR_WRIGHT_POPE,
  
  'denis-villeneuve': DENIS_VILLENEUVE_DEAKINS,
  'denis-villeneuve-deakins': DENIS_VILLENEUVE_DEAKINS,
  'Denis Villeneuve': DENIS_VILLENEUVE_DEAKINS,
};
