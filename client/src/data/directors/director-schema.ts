/**
 * Director Agent Schema v2.0
 * Full authorial identity system for music video director agents
 */

export interface DirectorProfile {
  id: string;
  name: string;
  type: string;
  version: string;
  bio: string;
  specialty: string;
  experience_years: number;
  rating: number;

  authorial_identity: {
    core_signature: string;
    cinematic_mission: string;
    permanent_values: string[];
    obsessions: string[];
  };

  visual_style: {
    description: string;
    signature_techniques: string[];
    image_rules: string[];
    forbidden_visuals: string[];
    color_palette: {
      primary_colors: string[];
      accent_colors: string[];
      mood: string;
    };
    influences: string[];
  };

  camera_preferences: {
    favorite_lenses: string[];
    favorite_shot_types: string[];
    favorite_movements: string[];
    shot_composition: string;
    aspect_ratio: string;
    camera_notes: string;
    camera_philosophy: string;
    non_negotiables: string[];
  };

  lighting_style: {
    preferred_lighting: string[];
    color_temperature: string;
    key_techniques: string[];
    mood_lighting: string;
    lighting_philosophy: string;
    lighting_warnings: string[];
  };

  editing_style: {
    pace: string;
    transitions: string[];
    average_shot_length: string;
    rhythm_approach: string;
    editing_philosophy: string;
    editing_non_negotiables: string[];
  };

  storytelling: {
    narrative_approach: string;
    preferred_themes: string[];
    performance_vs_broll_ratio: string;
    symbolism_level: string;
    story_rules: string[];
  };

  post_production: {
    color_grading_style: string;
    vfx_approach: string;
    preferred_effects: string[];
    post_philosophy: string;
    post_restrictions: string[];
  };

  project_translation_engine: {
    input_dependencies: string[];
    translation_rules: string[];
    project_modes: string[];
  };

  department_connections: {
    works_with: string[];
    department_instructions: Record<string, string[]>;
  };

  decision_hierarchy: {
    priority_order: string[];
    rejection_triggers: string[];
  };

  output_contract: {
    required_outputs: string[];
  };

  iconic_videos: Array<{
    title: string;
    artist: string;
    year: number;
    key_techniques: string[];
  }>;

  ai_generation_notes: {
    key_priorities: string[];
    avoid: string[];
    emphasis: string[];
  };

  // Legacy field kept for backward compatibility
  experience?: string;
}
