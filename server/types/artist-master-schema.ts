/**
 * Master Artist JSON Schema
 * Canonical identity document that feeds all AI generation modules for a Boostify artist.
 * All background tasks (news, EPK, merch, video, social, songs) derive context from this.
 */

export interface ArtistGenerationParams {
  genre?: string;
  style?: string;
  gender?: string;
  mood?: string;
  artistName?: string;
}

export interface VisualDNA {
  /** Primary color palette (2-4 hex codes) */
  color_palette: string[];
  /** Descriptive palette name, e.g. "Midnight Noir" */
  palette_name: string;
  /** Overall visual aesthetic */
  aesthetic: string;
  /** Fashion style keywords */
  fashion_keywords: string[];
  /** Physical description for image generation prompts */
  physical_description: string;
  /** Default FAL AI image generation prompt */
  image_prompt_base: string;
  /** Negative prompt for image generation */
  image_prompt_negative: string;
}

export interface MusicalDNA {
  primary_genre: string;
  secondary_genres: string[];
  bpm_range: { min: number; max: number };
  key_signatures: string[];
  vocal_style: string;
  production_style: string;
  influences: string[];
  mood_keywords: string[];
  instrument_set: string[];
  lyric_themes: string[];
}

export interface PersonaArchetype {
  archetype_name: string;
  personality_traits: string[];
  communication_tone: string;
  social_media_voice: string;
  interview_style: string;
  fan_relationship: string;
}

export interface NarrativeContext {
  origin_story: string;
  breakthrough_moment: string;
  current_chapter: string;
  artistic_mission: string;
  controversy_angles: string[];
  press_narrative: string;
}

export interface AudienceProfile {
  primary_demographic: string;
  secondary_demographic: string;
  psychographics: string[];
  platforms: string[];
  engagement_style: string;
}

export interface BusinessModel {
  revenue_pillars: string[];
  merch_aesthetic: string;
  brand_partnerships: string[];
  ticket_price_range: { min: number; max: number };
  streaming_focus: string[];
}

export interface AgentContext {
  news_agent_brief: string;
  epk_agent_brief: string;
  merch_agent_brief: string;
  social_agent_brief: string;
  song_agent_brief: string;
  video_agent_brief: string;
}

export interface SystemRules {
  never_say: string[];
  always_say: string[];
  brand_values: string[];
  content_restrictions: string[];
}

export interface ModuleView {
  /** Module identifier */
  module: string;
  /** Short description specific to this artist for this module */
  description: string;
  /** SEO/display title */
  title: string;
}

export interface BoostifyArtistMaster {
  /** Schema version for future migrations */
  schema_version: string;
  generated_at: string;

  /** Core canonical identity */
  canonical: {
    artist_name: string;
    real_name: string | null;
    gender: 'male' | 'female';
    age_range: string;
    nationality: string;
    city_of_origin: string;
    biography_short: string;
    biography_long: string;
    tagline: string;
  };

  /** Visual identity */
  visual_dna: VisualDNA;

  /** Musical identity */
  musical_dna: MusicalDNA;

  /** Persona and communication style */
  persona: PersonaArchetype;

  /** Storytelling and press narrative */
  narrative: NarrativeContext;

  /** Target audience */
  audience: AudienceProfile;

  /** Business and monetization model */
  business_model: BusinessModel;

  /** Context briefs for each AI agent/module */
  agent_context: AgentContext;

  /** Brand rules */
  system_rules: SystemRules;

  /** Page section descriptions for dynamic UI */
  module_views: ModuleView[];

  /** Memory: facts accumulate over time */
  memory: {
    key_events: string[];
    known_collaborators: string[];
    released_songs: string[];
  };
}
