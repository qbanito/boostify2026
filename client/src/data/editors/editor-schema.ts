/**
 * Schema para Editores de Videos Musicales Legendarios
 * Perfiles de los mejores editores del mundo entrenados en ritmo, género y estilo
 */

export interface EditorProfile {
  // Información básica
  id: string;
  name: string;
  title: string;
  bio: string;
  famous_directors: string[];
  iconic_edits: Array<{
    artist: string;
    title: string;
    year: number;
    signature_technique: string;
  }>;
  
  // Firma editorial
  signature_style: {
    description: string;
    pace: "ultra-fast" | "fast" | "moderate" | "slow" | "dynamic";
    cut_frequency: string;
    dominant_technique: string;
    music_sync_philosophy: string;
  };
  
  // Especialidades por género musical
  genre_specialties: {
    hip_hop: {
      beat_sync_approach: string;
      cut_style: string;
      emphasis: string[];
    };
    pop: {
      beat_sync_approach: string;
      cut_style: string;
      emphasis: string[];
    };
    rock: {
      beat_sync_approach: string;
      cut_style: string;
      emphasis: string[];
    };
    electronic: {
      beat_sync_approach: string;
      cut_style: string;
      emphasis: string[];
    };
    indie: {
      beat_sync_approach: string;
      cut_style: string;
      emphasis: string[];
    };
  };
  
  // Técnicas de micro-edición
  micro_edit_techniques: {
    freeze_frames: {
      usage: string;
      frequency: string;
      duration: string;
    };
    speed_ramps: {
      usage: string;
      speed_ranges: string[];
      moments: string;
    };
    whip_transitions: {
      usage: string;
      speed: string;
      effect_style: string;
    };
    jump_cuts: {
      usage: string;
      style: string;
      rhythm_sync: string;
    };
    match_cuts: {
      usage: string;
      technique: string;
      impact: string;
    };
    crossfades: {
      usage: string;
      speed: string;
      color_treatment: string;
    };
    flash_frames: {
      usage: string;
      color: string;
      duration: string;
    };
  };
  
  // Filosofía de edición
  editing_philosophy: {
    core_principle: string;
    emotion_first: boolean;
    rhythm_obsessed: boolean;
    storytelling_vs_style: "equal" | "story-focused" | "style-obsessed";
    performance_vs_broll: string;
  };
  
  // Recomendaciones para AI
  ai_editing_guidelines: {
    must_haves: string[];
    avoid: string[];
    emphasis_on: string[];
    rhythm_keywords: string[];
    visual_keywords: string[];
  };
}
