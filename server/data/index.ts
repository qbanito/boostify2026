/**
 * 🎬 DIRECTOR + DP PROFILES - Complete Index
 * 
 * Master export file combining all 10 Director+DP legendary pairings
 * for Hollywood-level music video cinematography.
 * 
 * Each profile contains:
 * - Director identity and philosophy
 * - Cinematographer technical specs
 * - Camera and lens packages
 * - Lighting setups
 * - Color grading palettes
 * - Depth of field controls
 * - Framing rules
 * - Camera movement philosophy
 * - 16 shot type specifications with prompts
 * - AI prompt templates for image generation
 * - Shot variation configuration
 */

// Type exports
export type {
  DirectorDPProfile,
  ShotSpec,
  FocalLength,
  LensPackage,
  CameraSpec,
  LightingSetup,
  ColorGrading,
  DepthOfFieldControl,
  FramingRules,
  CameraMovement,
  ShotLibrary,
  DirectorIdentity,
  CinematographerIdentity,
  CollaborationInfo,
  AIPrompts,
  VariationConfig,
  SceneWithCinematography,
} from './types/cinematography';

// Part 1: Spike Jonze, Hype Williams, David Fincher
import {
  SPIKE_JONZE_LUBEZKI,
  HYPE_WILLIAMS_KHONDJI,
  DAVID_FINCHER_CRONENWETH,
  DIRECTOR_DP_PROFILES as PROFILES_PART1,
  getDirectorDPProfile as getProfilePart1,
  getAllDirectorDPProfiles as getAllPart1,
  getShotSpec,
  buildScenePrompt,
  getVariationEditPrompt,
} from './director-dp-profiles';

// Part 2: Michel Gondry, Edgar Wright, Denis Villeneuve
import {
  MICHEL_GONDRY_DELBONNEL,
  EDGAR_WRIGHT_POPE,
  DENIS_VILLENEUVE_DEAKINS,
  DIRECTOR_DP_PROFILES_PART2 as PROFILES_PART2,
} from './director-dp-profiles-part2';

// Part 3: Baz Luhrmann, Wes Anderson, Christopher Nolan, Quentin Tarantino
import {
  BAZ_LUHRMANN_WALKER,
  WES_ANDERSON_YEOMAN,
  CHRISTOPHER_NOLAN_VANHOYTEMA,
  QUENTIN_TARANTINO_RICHARDSON,
  DIRECTOR_DP_PROFILES_PART3 as PROFILES_PART3,
} from './director-dp-profiles-part3';

import type { DirectorDPProfile } from './types/cinematography';

// =============================================================================
// COMPLETE DIRECTOR+DP PROFILES MAP
// =============================================================================

/**
 * All 10 Director+DP profiles indexed by multiple key formats
 */
export const ALL_DIRECTOR_DP_PROFILES: Record<string, DirectorDPProfile> = {
  ...PROFILES_PART1,
  ...PROFILES_PART2,
  ...PROFILES_PART3,
};

// =============================================================================
// PROFILE EXPORTS BY DIRECTOR
// =============================================================================

export {
  // Part 1
  SPIKE_JONZE_LUBEZKI,
  HYPE_WILLIAMS_KHONDJI,
  DAVID_FINCHER_CRONENWETH,
  
  // Part 2
  MICHEL_GONDRY_DELBONNEL,
  EDGAR_WRIGHT_POPE,
  DENIS_VILLENEUVE_DEAKINS,
  
  // Part 3
  BAZ_LUHRMANN_WALKER,
  WES_ANDERSON_YEOMAN,
  CHRISTOPHER_NOLAN_VANHOYTEMA,
  QUENTIN_TARANTINO_RICHARDSON,
  
  // Utility functions
  getShotSpec,
  buildScenePrompt,
  getVariationEditPrompt,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get Director+DP Profile by director name (case-insensitive, handles multiple formats)
 */
export function getDirectorDPProfile(directorName: string): DirectorDPProfile | undefined {
  // Direct lookup first
  if (ALL_DIRECTOR_DP_PROFILES[directorName]) {
    return ALL_DIRECTOR_DP_PROFILES[directorName];
  }
  
  // Normalize and try again
  const normalized = directorName.toLowerCase().replace(/\s+/g, '-');
  if (ALL_DIRECTOR_DP_PROFILES[normalized]) {
    return ALL_DIRECTOR_DP_PROFILES[normalized];
  }
  
  // Try partial match
  const keys = Object.keys(ALL_DIRECTOR_DP_PROFILES);
  const matchingKey = keys.find(key => 
    key.toLowerCase().includes(normalized) || 
    normalized.includes(key.toLowerCase().replace(/-/g, ' ').split(' ')[0])
  );
  
  return matchingKey ? ALL_DIRECTOR_DP_PROFILES[matchingKey] : undefined;
}

/**
 * Get all available Director+DP profiles (deduplicated)
 */
export function getAllDirectorDPProfiles(): DirectorDPProfile[] {
  const seen = new Set<string>();
  return Object.values(ALL_DIRECTOR_DP_PROFILES).filter(profile => {
    if (seen.has(profile.id)) return false;
    seen.add(profile.id);
    return true;
  });
}

/**
 * Get list of all director names
 */
export function getDirectorNames(): string[] {
  return getAllDirectorDPProfiles().map(p => p.director.name);
}

/**
 * Get profile by ID
 */
export function getProfileById(id: string): DirectorDPProfile | undefined {
  return getAllDirectorDPProfiles().find(p => p.id === id);
}

// =============================================================================
// PROFILE SUMMARY FOR SELECTION UI
// =============================================================================

export interface DirectorDPSummary {
  id: string;
  directorName: string;
  dpName: string;
  synergy: number;
  bestFor: string[];
  signature: string;
}

/**
 * Get summarized profiles for UI selection
 */
export function getProfileSummaries(): DirectorDPSummary[] {
  return getAllDirectorDPProfiles().map(profile => ({
    id: profile.id,
    directorName: profile.director.name,
    dpName: profile.cinematographer.name,
    synergy: profile.collaboration.synergy_score,
    bestFor: profile.collaboration.best_for_genres,
    signature: profile.collaboration.combined_signature,
  }));
}

// =============================================================================
// DIRECTOR + DP PAIRING TABLE
// =============================================================================

export const DIRECTOR_DP_PAIRINGS = [
  { director: 'Spike Jonze', dp: 'Emmanuel Lubezki', style: 'Natural whimsical poetry' },
  { director: 'Hype Williams', dp: 'Darius Khondji', style: 'Hip-hop luxury noir' },
  { director: 'David Fincher', dp: 'Jeff Cronenweth', style: 'Clinical dark precision' },
  { director: 'Michel Gondry', dp: 'Bruno Delbonnel', style: 'Handmade magical craft' },
  { director: 'Edgar Wright', dp: 'Bill Pope', style: 'Kinetic comic book energy' },
  { director: 'Denis Villeneuve', dp: 'Roger Deakins', style: 'Epic minimalist scale' },
  { director: 'Baz Luhrmann', dp: 'Mandy Walker', style: 'Theatrical romantic excess' },
  { director: 'Wes Anderson', dp: 'Robert Yeoman', style: 'Symmetrical pastel whimsy' },
  { director: 'Christopher Nolan', dp: 'Hoyte van Hoytema', style: 'IMAX practical epic' },
  { director: 'Quentin Tarantino', dp: 'Robert Richardson', style: 'Genre cinema homage' },
] as const;

// =============================================================================
// DEFAULT PROFILE
// =============================================================================

/**
 * Default profile to use when no director is specified
 */
export const DEFAULT_PROFILE = SPIKE_JONZE_LUBEZKI;

/**
 * Get profile or fall back to default
 */
export function getProfileOrDefault(directorName?: string): DirectorDPProfile {
  if (!directorName) return DEFAULT_PROFILE;
  return getDirectorDPProfile(directorName) || DEFAULT_PROFILE;
}
