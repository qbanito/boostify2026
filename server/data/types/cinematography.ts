/**
 * 🎬 CINEMATOGRAPHY TYPES - Hollywood Level
 * Interfaces completas para Director + DP Collaboration
 * 
 * Este sistema permite que cada imagen generada tenga la firma visual
 * distintiva del director y su cinematógrafo asociado.
 */

// ========== LENS SPECIFICATIONS ==========

export interface FocalLength {
  mm: string;                    // "24mm", "50mm", "135mm"
  use_case: string;              // "Wide establishing", "Portrait close-up"
  aperture_sweet_spot: string;   // "f/2.8", "f/1.4"
  depth_of_field: string;        // "Deep", "Shallow", "Medium"
  bokeh_quality: string;         // "Creamy circular", "Anamorphic oval"
  distortion: string;            // "Minimal", "Barrel distortion for effect"
}

export interface LensPackage {
  manufacturer: string;          // "Panavision", "Zeiss", "Cooke", "Leica"
  series: string;                // "C-Series Anamorphic", "Master Prime"
  format: string;                // "Anamorphic 2x", "Spherical"
  focal_lengths: FocalLength[];
  characteristics: string[];     // ["Warm skin tones", "Gentle falloff"]
  flare_characteristics: string; // "Blue horizontal streaks"
  cost_tier: "Ultra-Premium" | "Premium" | "Professional";
}

// ========== CAMERA SPECIFICATIONS ==========

export interface CameraSpec {
  name: string;                  // "ARRI Alexa 65"
  sensor_format: string;         // "65mm digital", "35mm", "IMAX"
  resolution: string;            // "6.5K", "8K"
  dynamic_range: string;         // "14+ stops"
  color_science: string;         // "ARRI LogC"
  best_for: string[];            // ["Epic landscapes", "Intimate portraits"]
}

// ========== LIGHTING SPECIFICATIONS ==========

export interface LightingSetup {
  key_style: string;             // "High-key", "Low-key", "Natural"
  key_ratio: string;             // "3:1", "8:1", "2:1"
  fill_approach: string;         // "Negative fill", "Soft bounce"
  backlight: string;             // "Strong rim", "Subtle separation"
  color_temperature: {
    key: string;                 // "3200K tungsten"
    fill: string;                // "5600K daylight"
    accent: string;              // "RGB LED for color"
  };
  practicals: string[];          // ["Neons", "Candles", "TV glow"]
  motivated_sources: string[];   // ["Window light", "Street lamps"]
  signature_setup: string;       // Full description
}

// ========== COLOR SCIENCE ==========

export interface ColorGrading {
  primary_palette: string[];     // ["Teal", "Orange", "Desaturated"]
  shadows: {
    hue: string;                 // "Cool teal"
    saturation: string;          // "20%"
    lift: string;                // "-0.1"
  };
  midtones: {
    hue: string;                 // "Neutral"
    saturation: string;          // "Natural"
    gamma: string;               // "1.0"
  };
  highlights: {
    hue: string;                 // "Warm amber"
    saturation: string;          // "15%"
    gain: string;                // "+0.05"
  };
  overall_saturation: string;    // "70%", "Desaturated", "Vivid"
  contrast: string;              // "High contrast noir", "Soft"
  film_emulation: string;        // "Kodak 5219 500T", "Fuji Eterna"
  grain: {
    intensity: string;           // "Fine", "Medium", "Heavy"
    size: string;                // "35mm", "16mm"
    character: string;           // "Organic", "Digital noise"
  };
}

// ========== DEPTH OF FIELD ==========

export interface DepthOfFieldControl {
  philosophy: string;            // "Use shallow DoF for intimacy"
  wide_shots: {
    aperture: string;            // "f/8-f/11"
    focus_distance: string;      // "Hyperfocal"
    description: string;         // "Everything sharp for world-building"
  };
  medium_shots: {
    aperture: string;            // "f/4-f/5.6"
    focus_distance: string;      // "Subject at 3m"
    description: string;         // "Subject sharp, background soft"
  };
  close_ups: {
    aperture: string;            // "f/1.4-f/2"
    focus_distance: string;      // "0.5m"
    description: string;         // "Eyes sharp, ears soft"
  };
  extreme_close_ups: {
    aperture: string;            // "f/2.8"
    focus_distance: string;      // "Minimum"
    description: string;         // "Razor thin focus plane"
  };
  rack_focus: boolean;           // true = use for drama
  focus_pulls: string[];         // ["Subject to background", "Reveal"]
}

// ========== FRAMING ==========

export interface FramingRules {
  aspect_ratio: string;          // "2.39:1", "1.85:1", "16:9"
  headroom: string;              // "Minimal", "Comfortable", "Tight"
  lead_room: string;             // "Generous for motion", "Tight"
  nose_room: string;             // "Following gaze"
  symmetry: {
    use: boolean;
    when: string;                // "For power, control, Wes Anderson moments"
  };
  rule_of_thirds: boolean;
  center_framing: {
    use: boolean;
    when: string;                // "For direct address, isolation"
  };
  negative_space: string;        // "Uses for isolation and mood"
  safe_areas: {
    action: string;              // "90%"
    title: string;               // "80%"
  };
}

// ========== CAMERA MOVEMENT ==========

export interface CameraMovement {
  philosophy: string;            // "Camera moves with purpose"
  static: {
    when: string[];              // ["Contemplative moments", "Tableaux"]
    motivation: string;
  };
  handheld: {
    when: string[];              // ["Chaos", "Intimacy", "Documentary feel"]
    intensity: string;           // "Subtle breathing", "Aggressive shake"
  };
  steadicam: {
    when: string[];              // ["Following subjects", "Ethereal float"]
    speed: string;               // "Slow, deliberate"
  };
  dolly: {
    when: string[];              // ["Reveals", "Push for emphasis"]
    track_type: string;          // "Straight", "Curved"
  };
  crane: {
    when: string[];              // ["Establishing scale", "God's eye"]
    height: string;              // "20ft max"
  };
  drone: {
    when: string[];              // ["Epic landscapes", "Chase sequences"]
    altitude: string;            // "Varied for dynamism"
  };
  speed: string;                 // "Slow, deliberate" | "Fast, kinetic"
}

// ========== SHOT LIBRARY ==========

export interface ShotSpec {
  lens_mm: string;               // "24mm"
  aperture: string;              // "f/2.8"
  camera_height: string;         // "Eye level", "Low", "High"
  camera_angle: string;          // "Straight", "Dutch 15°"
  movement: string;              // "Static", "Slow push"
  lighting_key: string;          // "High-key beauty"
  framing: string;               // "Center frame, symmetrical"
  depth_of_field: string;        // "Deep focus"
  prompt_template: string;       // Full AI prompt
  edit_prompt: string;           // For nano-banana/edit variations
}

export interface ShotLibrary {
  wide_establishing: ShotSpec;
  wide_environment: ShotSpec;
  medium_full: ShotSpec;
  medium_narrative: ShotSpec;
  medium_close: ShotSpec;
  close_up_emotional: ShotSpec;
  close_up_profile: ShotSpec;
  extreme_close_up: ShotSpec;
  detail_insert: ShotSpec;
  overhead_god_view: ShotSpec;
  low_angle_power: ShotSpec;
  high_angle_vulnerable: ShotSpec;
  dutch_angle_tension: ShotSpec;
  pov_subjective: ShotSpec;
  over_shoulder: ShotSpec;
  two_shot: ShotSpec;
}

// ========== DIRECTOR IDENTITY ==========

export interface DirectorIdentity {
  name: string;
  visual_philosophy: string;
  signature_techniques: string[];
  narrative_style: string;
  emotional_language: string;
  pacing: string;
  iconic_works: {
    title: string;
    year: number;
    visual_highlight: string;
  }[];
  influences: string[];
  awards: string[];
}

// ========== CINEMATOGRAPHER IDENTITY ==========

export interface CinematographerIdentity {
  name: string;
  technical_philosophy: string;
  signature_look: string;
  legendary_technique: string;
  famous_collaborations: string[];
  camera_preference: string;
  lens_preference: string;
  lighting_philosophy: string;
  awards: string[];
}

// ========== MAIN INTERFACE: DIRECTOR + DP PROFILE ==========

export interface DirectorDPProfile {
  id: string;                    // "spike-jonze-lubezki"
  version: string;               // "1.0.0"
  
  // === IDENTITIES ===
  director: DirectorIdentity;
  cinematographer: CinematographerIdentity;
  
  // === COLLABORATION ===
  collaboration: {
    synergy_score: number;       // 0-100
    visual_harmony: string;      // Description of how they work together
    combined_signature: string;  // The unique look when combined
    best_for_genres: string[];   // ["Drama", "Music Video", "Sci-Fi"]
    combined_influences: string[];
  };
  
  // === TECHNICAL SPECIFICATIONS ===
  camera: CameraSpec;
  lenses: LensPackage;
  lighting: LightingSetup;
  color_grading: ColorGrading;
  depth_of_field: DepthOfFieldControl;
  framing: FramingRules;
  movement: CameraMovement;
  
  // === SHOT LIBRARY ===
  shot_library: ShotLibrary;
  
  // === AI GENERATION ===
  ai_prompts: {
    style_prefix: string;        // Added to all prompts
    master_shot_template: string;
    performance_template: string;
    broll_template: string;
    emotional_template: string;
    action_template: string;
    negative_prompt: string;     // What to avoid
  };
  
  // === SHOT VARIATION ENGINE ===
  variation_config: {
    max_variations_per_scene: number;
    variation_types: string[];   // ["wide", "medium", "closeup", "detail"]
    energy_based_selection: boolean;
    beat_sync_enabled: boolean;
  };
  
  // === EDITING STYLE (Influences cut duration) ===
  editing_style: DirectorEditingStyle;
}

// ========== DIRECTOR EDITING STYLE ==========

/**
 * 🎬 EDITING STYLE - How the director's vision influences cut duration
 * This connects the Director+DP profile with the auto-cut-engine
 */
export interface DirectorEditingStyle {
  // Core pacing philosophy
  philosophy: string;            // "Patient, contemplative edits" or "Frenetic energy"
  
  // Pace modifier (multiplies beat duration)
  // < 1.0 = faster cuts, > 1.0 = slower cuts
  pace_modifier: number;         // 0.7 to 1.5
  
  // Minimum cut duration (seconds) - never cut faster than this
  minimum_cut_duration: number;  // 0.25 to 3.0
  
  // Maximum cut duration (seconds) - never hold longer than this
  maximum_cut_duration: number;  // 2.0 to 15.0
  
  // Beat alignment preference
  beat_alignment: 'downbeat' | 'any_beat' | 'half_beat' | 'off_beat';
  
  // Whether to extend duration on emotional/close-up shots
  hold_on_emotion: boolean;
  emotion_hold_multiplier: number;  // 1.0 to 2.5
  
  // Whether to speed up on action/energy peaks
  accelerate_on_energy: boolean;
  energy_acceleration: number;   // 0.5 to 1.0 (multiplier when energy is peak)
  
  // Transition preferences by section
  transition_preferences: {
    intro: 'cut' | 'fade' | 'dissolve' | 'crossfade';
    verse: 'cut' | 'fade' | 'dissolve' | 'crossfade';
    chorus: 'cut' | 'flash' | 'zoom' | 'glitch';
    bridge: 'cut' | 'fade' | 'dissolve' | 'crossfade';
    drop: 'cut' | 'flash' | 'glitch' | 'shake';
    outro: 'cut' | 'fade' | 'dissolve';
  };
  
  // Cut pattern preferences
  cut_patterns: {
    use_jump_cuts: boolean;
    use_match_cuts: boolean;
    use_j_cuts: boolean;        // Audio leads video
    use_l_cuts: boolean;        // Video leads audio
    use_smash_cuts: boolean;
  };
  
  // Section-specific beat multipliers (overrides genre defaults)
  section_beat_overrides: {
    intro?: number;    // e.g., 2.0 = double the beats per cut
    verse?: number;
    chorus?: number;
    bridge?: number;
    drop?: number;
    outro?: number;
  };
}

// ========== SCENE WITH CINEMATOGRAPHY ==========

export interface SceneWithCinematography {
  scene_id: string;
  shot_type: string;
  description: string;
  lyrics?: string;
  emotion?: string;
  energy_level?: string;
  
  // Injected from DirectorDPProfile
  cinematography: {
    camera: string;
    lens: string;
    aperture: string;
    depth_of_field: string;
    framing: string;
    lighting: string;
    color_grade: string;
    movement: string;
    director_signature: string;
    dp_signature: string;
    full_prompt: string;
  };
}

// ========== HELPER TYPES ==========

export type ShotType = 
  | 'wide-establishing'
  | 'wide-environment'
  | 'medium-full'
  | 'medium-narrative'
  | 'medium-close'
  | 'close-up-emotional'
  | 'close-up-profile'
  | 'extreme-close-up'
  | 'detail-insert'
  | 'overhead'
  | 'low-angle'
  | 'high-angle'
  | 'dutch'
  | 'pov'
  | 'over-shoulder'
  | 'two-shot';

export type EnergyLevel = 'low' | 'medium' | 'high' | 'peak';

export type MusicSection = 
  | 'intro'
  | 'verse'
  | 'pre-chorus'
  | 'chorus'
  | 'bridge'
  | 'breakdown'
  | 'drop'
  | 'outro';
