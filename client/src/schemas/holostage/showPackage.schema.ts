// ─── Show Package Schema ──────────────────────────────────────────────────────
// Master JSON schema for the complete Boostify HoloStage show export
// Matches the master Show JSON spec from the StageOS integration document.

import type { CharacterAsset } from './character.schema';
import type { TimelineCue } from './timelineCue.schema';
import type { DMXScene, DMXFixture } from './dmx.schema';
import type { HologramOutputSettings } from './hologramOutput.schema';
import type { HoloSuitConfig } from './motionSource.schema';
import type { CharacterRig } from './characterRig.schema';
import type { VenueMaster } from '../venueos/venueMaster.schema';

// ─── Performance Mode ─────────────────────────────────────────────────────────
export type PerformanceMode = 'live' | 'hybrid' | 'playback';

// ─── Song Sections (intro, verse, chorus, etc.) ───────────────────────────────
export type SectionType =
  | 'intro' | 'verse' | 'pre_chorus' | 'chorus' | 'bridge'
  | 'outro' | 'solo' | 'dance_break' | 'crowd_interaction' | 'instrumental';

export interface SongSection {
  name: SectionType | string;
  start: number;   // seconds
  end: number;     // seconds
  label?: string;
}

// ─── Stem Tracks ─────────────────────────────────────────────────────────────
export interface StemTracks {
  vocals?: string;
  drums?: string;
  bass?: string;
  music?: string;
  fx?: string;
  [key: string]: string | undefined;
}

// ─── Emergency Settings ───────────────────────────────────────────────────────
export interface EmergencySettings {
  blackoutEnabled: boolean;
  fallbackAnimationEnabled: boolean;
  audioContinueOnMocapFailure: boolean;
  dmxBlackoutScene: string;
  autoReconnectHoloSuit: boolean;
  maxLatencyBeforeWarningMs: number;
  maxLatencyBeforeFallbackMs: number;
}

export const DEFAULT_EMERGENCY_SETTINGS: EmergencySettings = {
  blackoutEnabled: true,
  fallbackAnimationEnabled: true,
  audioContinueOnMocapFailure: true,
  dmxBlackoutScene: 'blackout',
  autoReconnectHoloSuit: true,
  maxLatencyBeforeWarningMs: 120,
  maxLatencyBeforeFallbackMs: 250,
};

// ─── Show Song ────────────────────────────────────────────────────────────────
export interface ShowSong {
  id: string;
  title: string;
  artist: string;
  duration: number;            // seconds
  bpm: number;
  key?: string;
  audioUrl?: string;
  stems?: StemTracks;
  waveformData?: number[];
  coverUrl?: string;
  order: number;
  performanceMode?: PerformanceMode;
  fallbackAnimationUrl?: string;
  sections?: SongSection[];
  cues?: TimelineCue[];        // song-level cues (merged with show cues on export)
  outfitId?: string;
}

// ─── DMX Config (top-level in master JSON) ────────────────────────────────────
export interface ShowDMXConfig {
  protocol: 'artnet' | 'sacn' | 'dmx' | 'simulation';
  ip?: string;
  universe: number;
  fixtures: DMXFixture[];
  scenes: DMXScene[];
}

// ─── Show Status ─────────────────────────────────────────────────────────────
export type ShowStatus = 'draft' | 'ready' | 'rehearsal' | 'live' | 'archived';

// ─── Show Metadata ────────────────────────────────────────────────────────────
export interface ShowMetadata {
  venue?: string;
  venueName?: string;
  date?: string;
  capacity?: number;
  city?: string;
  country?: string;
  technician?: string;
  notes?: string;
  licenseType?: 'venue' | 'festival' | 'brand' | 'permanent_installation' | 'private' | 'internal';
}

// ─── HoloShow (master state object) ──────────────────────────────────────────
export interface HoloShow {
  id: string;
  name: string;
  description?: string;
  artistName: string;
  artistId?: string;
  status: ShowStatus;
  performanceMode?: PerformanceMode;
  songs: ShowSong[];
  cues: TimelineCue[];
  dmxScenes: DMXScene[];
  dmxConfig?: ShowDMXConfig;
  character: CharacterAsset | null;
  characterRig?: CharacterRig;
  outputSettings: HologramOutputSettings;
  holosuitConfig: HoloSuitConfig;
  emergency?: EmergencySettings;
  metadata: ShowMetadata;
  venueData?: VenueMaster;
  createdAt: string;
  updatedAt: string;
  version: string;
  stageosVersion?: string;
  format: 'boostify-holostage-v1';
  checksum?: string;
}

// ─── Master Show JSON (export/import format matching spec section 20) ─────────
export interface MasterShowJSON {
  show_id: string;
  artist_id: string;
  artist_name: string;
  show_title: string;
  version: string;
  stageos_version: string;
  performance_mode: PerformanceMode;
  character_pipeline: {
    source: string;
    source_version: string;
    character_id: string;
    fbx_url?: string;
    glb_url?: string;
    texture_folder?: string;
    variant: 'hero' | 'live_hologram' | 'web_preview';
    material_profile: string;
    rig_profile: string;
  };
  motion_source: {
    provider: string;
    bridge: string;
    streaming_mode: string;
    protocol: string;
    ip: string;
    port: number;
    body: boolean;
    hands: boolean;
    face: boolean;
    fallback_enabled: boolean;
  };
  retargeting: {
    profile_id: string;
    scale: number;
    root_motion: boolean;
    foot_locking: boolean;
    smoothing: number;
    latency_compensation_ms: number;
  };
  hologram_output: {
    profile_id: string;
    type: string;
    background: string;
    mirror_mode: boolean;
    brightness: number;
    contrast: number;
    resolution: string;
    fullscreen: boolean;
    scale: number;
    position: { x: number; y: number; z: number };
  };
  songs: Array<{
    song_id: string;
    title: string;
    audio_url: string;
    stems?: StemTracks;
    bpm: number;
    duration: number;
    performance_mode: PerformanceMode;
    fallback_animation?: string;
    sections: SongSection[];
    timeline: TimelineCue[];
  }>;
  dmx: ShowDMXConfig;
  emergency: {
    blackout_enabled: boolean;
    fallback_animation_enabled: boolean;
    audio_continue_on_mocap_failure: boolean;
    dmx_blackout_scene: string;
    auto_reconnect_holosuit: boolean;
    max_latency_before_warning_ms: number;
    max_latency_before_fallback_ms: number;
  };
}
