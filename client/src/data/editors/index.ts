/**
 * Editors Database - Legendary Music Video Editors
 */

import type { EditorProfile } from './editor-schema';

import hypeWilliamsData from './hype-williams.json';
import spikeJonzeData from './spike-jonze.json';
import mtvFastPacedData from './mtv-fast-paced.json';
import tarantinoStyleData from './tarantino-style.json';
import tiktokShortFormData from './tiktok-short-form.json';
import cinematicSlowData from './cinematic-slow.json';
import glitchExperimentalData from './glitch-experimental.json';

export const EDITORS: EditorProfile[] = [
  hypeWilliamsData as EditorProfile,
  spikeJonzeData as EditorProfile,
  mtvFastPacedData as EditorProfile,
  tarantinoStyleData as EditorProfile,
  tiktokShortFormData as EditorProfile,
  cinematicSlowData as EditorProfile,
  glitchExperimentalData as EditorProfile,
];

export const HYPE_WILLIAMS = hypeWilliamsData as EditorProfile;
export const SPIKE_JONZE = spikeJonzeData as EditorProfile;
export const MTV_FAST_PACED = mtvFastPacedData as EditorProfile;
export const TARANTINO_STYLE = tarantinoStyleData as EditorProfile;
export const TIKTOK_SHORT_FORM = tiktokShortFormData as EditorProfile;
export const CINEMATIC_SLOW = cinematicSlowData as EditorProfile;
export const GLITCH_EXPERIMENTAL = glitchExperimentalData as EditorProfile;

export function getEditorById(id: string): EditorProfile | undefined {
  return EDITORS.find(editor => editor.id === id);
}

export function getEditorByName(name: string): EditorProfile | undefined {
  return EDITORS.find(editor => editor.name.toLowerCase() === name.toLowerCase());
}

export function getAllEditors(): EditorProfile[] {
  return EDITORS;
}

/**
 * Recomendar editor basado en género musical
 */
export function recommendEditorForGenre(genre: string): EditorProfile {
  const genreLower = genre.toLowerCase();
  
  if (genreLower.includes('hip-hop') || genreLower.includes('rap')) {
    return HYPE_WILLIAMS; // Ultra-fast, beat-synchronized
  } else if (genreLower.includes('pop')) {
    return MTV_FAST_PACED; // Fast-paced, hook-focused
  } else if (genreLower.includes('rock')) {
    return TARANTINO_STYLE; // Bold, narrative-driven
  } else if (genreLower.includes('electronic')) {
    return GLITCH_EXPERIMENTAL; // Experimental, innovative
  } else if (genreLower.includes('indie') || genreLower.includes('alternative')) {
    return SPIKE_JONZE; // Narrative, conceptual
  } else {
    return MTV_FAST_PACED; // Default
  }
}

export type { EditorProfile };
