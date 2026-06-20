/**
 * Schema TypeScript para Directores de Fotografía (Cinematografía)
 * Define la estructura completa del perfil técnico cinematográfico
 * Nivel Hollywood: Panavision, Zeiss, Cooke, Film Stock
 */

export interface CinematographerProfile {
  // Información básica
  id: string;
  name: string;
  title: string; // "Director of Photography"
  bio: string;
  famous_directors_worked_with: string[];
  
  // Obras icónicas
  iconic_films: Array<{
    title: string;
    director: string;
    year: number;
    awards: string[];
  }>;
  
  // Firma visual icónica
  signature_look: {
    description: string;
    key_characteristic: string;
    legendary_technique: string;
  };
  
  // Arsenal de cámaras (nivel Hollywood)
  camera_arsenal: {
    primary_cameras: Array<{
      name: string;
      format: string; // "VistaVision 65mm", "35mm", "Digital 8K", "IMAX"
      sensor: string;
      use_case: string;
    }>;
    
    lens_packages: Array<{
      manufacturer: string; // "Panavision", "Zeiss", "Cooke", "Leica"
      series: string;
      focal_lengths: string[];
      characteristics: string[];
      cost_tier: "Premium" | "Professional" | "Standard";
    }>;
    
    film_stock_emulation: Array<{
      name: string;
      iso: number;
      characteristics: string;
      mood: string;
    }>;
  };
  
  // Especialidades técnicas
  technical_specialties: {
    lighting_approach: string;
    color_science: string;
    exposure_philosophy: string;
    dynamic_range_preference: string;
    frame_rate_preference: string[];
  };
  
  // Colaboración con director
  director_collaboration: {
    communication_style: string;
    strengths_with_narrative: string;
    best_for_genres: string[];
    complements_directors: string[];
  };
  
  // Prioridades para generación AI
  generation_priorities: {
    must_have_characteristics: string[];
    technical_mandates: string[];
    avoid: string[];
    emphasis_on: string[];
  };
}
