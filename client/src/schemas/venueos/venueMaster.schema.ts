// ─── VenueOS Master Schema ────────────────────────────────────────────────────
// Central JSON spec for a hologram-ready venue.
// Used by HoloStage VenueOS to auto-configure output, DMX, timeline, crew & budget.

// ─── Dimensions ───────────────────────────────────────────────────────────────

export interface StageDimensions {
  stageWidthM:     number;   // meters
  stageDepthM:     number;
  stageHeightM:    number;   // stage platform height from floor
  ceilingHeightM:  number;
  audienceDistanceM: number; // front of stage to first row
  roomWidthM:      number;
  roomDepthM:      number;
}

// ─── Hologram Setup ───────────────────────────────────────────────────────────

export type HologramSurfaceType =
  | 'holo_gauze'
  | 'peppers_ghost_foil'
  | 'rear_projection'
  | 'led_transparent'
  | 'holofan'
  | 'mirror_45';

export type ProjectionMode =
  | 'front_projection'
  | 'rear_projection'
  | 'top_down'
  | 'bottom_up';

export interface ProjectorPosition {
  x: number;  // meters from stage center
  y: number;  // height from floor
  z: number;  // depth from stage front (positive = audience side)
}

export interface HologramSetupSpec {
  surfaceType:          HologramSurfaceType;
  projectionMode:       ProjectionMode;
  screenWidthM:         number;
  screenHeightM:        number;
  projectorLumensRequired: number;
  projectorPosition:    ProjectorPosition;
  artistScale:          'life_size' | 'half_size' | 'double_size' | 'custom';
  artistScaleFactor?:   number;       // for 'custom'
  blackBackgroundRequired: boolean;
  ambientLightLimit:    'none' | 'low' | 'medium';
  throwRatioRequired?:  number;       // projector throw ratio
}

// ─── DMX Venue Profile ────────────────────────────────────────────────────────

export type DMXProtocol = 'artnet' | 'sacn' | 'dmx' | 'simulation';
export type FixtureCategory = 'moving_head' | 'wash' | 'spot' | 'strobe' | 'haze' | 'fog' | 'led_bar' | 'follow_spot' | 'blinder' | 'pixel';

export interface VenueFixture {
  id:       string;
  label:    string;
  category: FixtureCategory;
  position: string;           // 'front_left' | 'truss_center' etc. (free text)
  universe: number;
  address:  number;           // 1–512
  channels: number;
}

export interface VenueDMXProfile {
  protocol:  DMXProtocol;
  ip?:       string;
  universesRequired: number;
  fixtures:  VenueFixture[];
}

// ─── Audio ────────────────────────────────────────────────────────────────────

export interface VenueAudio {
  systemType:       'venue_pa' | 'touring' | 'rental' | 'none';
  fohPosition:      string;
  monitoringRequired: boolean;
  stemsSupported:   boolean;
  timecodeRequired: boolean;
  sampleRate?:      44100 | 48000 | 96000;
}

// ─── Crew Plan ────────────────────────────────────────────────────────────────

export interface CrewRole {
  role:           string;
  responsibility: string;
  optional:       boolean;
}

export interface CrewPlan {
  minimumCrew:     number;
  recommendedCrew: number;
  roles:           CrewRole[];
}

// ─── Budget Estimate ──────────────────────────────────────────────────────────

export interface BudgetLineItem {
  category: string;
  label:    string;
  estimatedUSD: number;
}

export interface BudgetEstimate {
  currency: 'USD' | 'EUR' | 'GBP' | 'MXN';
  items:    BudgetLineItem[];
  totalEstimated: number;
  contingencyPercent: number;
}

// ─── Show Template ────────────────────────────────────────────────────────────

export type ShowTemplateType =
  | 'showcase_15min'
  | 'mini_concert_30min'
  | 'full_show_45min'
  | 'premium_show_60min'
  | 'corporate'
  | 'club'
  | 'festival'
  | 'theater'
  | 'private_event';

export interface ShowTimelineSlot {
  slotIndex:  number;
  label:      string;
  type:       'intro' | 'song' | 'transition' | 'interlude' | 'finale' | 'blackout';
  durationSec: number;
  offsetSec:  number;
  lightingPreset?: string;
  animationPreset?: string;
  dmxCuePreset?:  string;
  fallbackRequired: boolean;
}

export interface ShowTemplate {
  templateType:   ShowTemplateType;
  totalDurationSec: number;
  songSlots:      number;
  slots:          ShowTimelineSlot[];
}

// ─── Hologram Feasibility ─────────────────────────────────────────────────────

export interface HologramFeasibility {
  score:        number;    // 0–100
  grade:        'A' | 'B' | 'C' | 'D' | 'F';
  viable:       boolean;
  warnings:     string[];
  requiredEquipment: string[];
  recommendedSetup: string;
}

// ─── Venue Master JSON ────────────────────────────────────────────────────────

export type VenueScanSource =
  | 'manual'
  | 'mobile_photo'
  | 'mobile_lidar'
  | 'mobile_lidar_plus_manual'
  | 'blueprint';

export type EventType =
  | 'hologram_concert'
  | 'hologram_brand_event'
  | 'hologram_theater'
  | 'hologram_festival'
  | 'hologram_private'
  | 'hologram_corporate';

export interface VenueMaster {
  venueId:      string;
  eventId?:     string;
  venueName:    string;
  address?:     string;
  city?:        string;
  country?:     string;
  eventType:    EventType;
  scanSource:   VenueScanSource;
  scannedAt:    string;    // ISO date
  dimensions:   StageDimensions;
  hologramSetup: HologramSetupSpec;
  dmx:          VenueDMXProfile;
  audio:        VenueAudio;
  crew:         CrewPlan;
  budget:       BudgetEstimate;
  showTemplate: ShowTemplate;
  feasibility?: HologramFeasibility;
  notes?:       string;
  photoUrls?:   string[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_VENUE_DIMENSIONS: StageDimensions = {
  stageWidthM:     10,
  stageDepthM:     6,
  stageHeightM:    0.6,
  ceilingHeightM:  6,
  audienceDistanceM: 4,
  roomWidthM:      20,
  roomDepthM:      30,
};

export const DEFAULT_HOLOGRAM_SETUP: HologramSetupSpec = {
  surfaceType:          'holo_gauze',
  projectionMode:       'front_projection',
  screenWidthM:         8,
  screenHeightM:        4,
  projectorLumensRequired: 20000,
  projectorPosition:    { x: 0, y: 5, z: 4 },
  artistScale:          'life_size',
  blackBackgroundRequired: true,
  ambientLightLimit:    'low',
};

export const DEFAULT_VENUE_AUDIO: VenueAudio = {
  systemType:       'venue_pa',
  fohPosition:      'center_back',
  monitoringRequired: true,
  stemsSupported:   true,
  timecodeRequired: true,
  sampleRate:       48000,
};

export function buildEmptyVenueMaster(venueName = 'New Venue'): VenueMaster {
  const now = new Date().toISOString();
  return {
    venueId:   `venue-${Date.now()}`,
    venueName,
    eventType: 'hologram_concert',
    scanSource: 'manual',
    scannedAt:  now,
    dimensions:    { ...DEFAULT_VENUE_DIMENSIONS },
    hologramSetup: { ...DEFAULT_HOLOGRAM_SETUP },
    dmx: {
      protocol: 'artnet',
      universesRequired: 1,
      fixtures: [],
    },
    audio: { ...DEFAULT_VENUE_AUDIO },
    crew: {
      minimumCrew: 5,
      recommendedCrew: 8,
      roles: [
        { role: 'Technical Director',       responsibility: 'Supervise installation and show execution', optional: false },
        { role: 'Projection Operator',      responsibility: 'Control hologram output and projector alignment', optional: false },
        { role: 'DMX Lighting Operator',    responsibility: 'Manage lighting scenes, Art-Net and blackout', optional: false },
        { role: 'Audio Engineer',           responsibility: 'Manage playback, stems, FOH and timecode', optional: false },
        { role: 'StageOS Operator',         responsibility: 'Run Boostify HoloStage timeline and show package', optional: false },
        { role: 'Stagehand',                responsibility: 'Installation, surface setup, cabling', optional: true },
        { role: 'Hologram Surface Installer', responsibility: 'Mount and tension Holo Gauze / foil', optional: true },
        { role: 'MoCap Operator',           responsibility: 'Operate HoloSuit suit or phone capture', optional: true },
      ],
    },
    budget: {
      currency: 'USD',
      items: [],
      totalEstimated: 0,
      contingencyPercent: 15,
    },
    showTemplate: {
      templateType: 'full_show_45min',
      totalDurationSec: 2700,
      songSlots: 8,
      slots: [],
    },
  };
}
