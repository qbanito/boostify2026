// ─── Venue Calculator Service ─────────────────────────────────────────────────
// Computes hologram feasibility, recommended setup, equipment list,
// crew plan, budget estimate, and show timeline template from a VenueMaster.

import type {
  VenueMaster, StageDimensions, HologramSetupSpec, HologramFeasibility,
  BudgetEstimate, BudgetLineItem, CrewPlan, ShowTemplate, ShowTimelineSlot,
  ShowTemplateType, VenueDMXProfile, VenueFixture, FixtureCategory,
} from '../../schemas/venueos/venueMaster.schema';

// ─── Hologram Feasibility Calculator ─────────────────────────────────────────

export function calcHologramFeasibility(
  dims: StageDimensions,
  setup: HologramSetupSpec,
): HologramFeasibility {
  const warnings: string[] = [];
  const required: string[] = [];
  let score = 100;

  // Stage width check
  if (dims.stageWidthM < 6) {
    warnings.push(`Stage width (${dims.stageWidthM}m) is too narrow. Minimum 6m recommended.`);
    score -= 20;
  } else if (dims.stageWidthM < 8) {
    warnings.push(`Stage width (${dims.stageWidthM}m) is acceptable but tight. 8m+ is preferred.`);
    score -= 8;
  }

  // Ceiling height check
  if (dims.ceilingHeightM < 4) {
    warnings.push(`Ceiling height (${dims.ceilingHeightM}m) is too low for projector placement.`);
    score -= 25;
  } else if (dims.ceilingHeightM < 5.5) {
    warnings.push(`Ceiling height (${dims.ceilingHeightM}m) is marginal. Projector may need floor placement.`);
    score -= 10;
  }

  // Audience distance
  if (dims.audienceDistanceM < 3) {
    warnings.push(`Audience distance (${dims.audienceDistanceM}m) is too close. Minimum 3m needed.`);
    score -= 15;
  }

  // Ambient light
  if (setup.ambientLightLimit === 'medium') {
    warnings.push('Ambient light level "medium" will reduce hologram visibility. Request blackout capability.');
    score -= 12;
  }

  // Screen vs stage proportions
  if (setup.screenWidthM > dims.stageWidthM * 0.9) {
    warnings.push('Hologram screen is wider than 90% of stage width. Consider narrower screen or wider stage masking.');
    score -= 5;
  }

  // Projector throw check (rough estimate)
  const throwDist = dims.audienceDistanceM + 1.5; // assume projector above audience
  const throwRatio = throwDist / setup.screenWidthM;
  if (throwRatio < 0.8) {
    warnings.push(`Projector throw ratio (~${throwRatio.toFixed(1)}) is very low. May need ultra-short-throw lens.`);
    score -= 10;
  }

  // Build required equipment
  required.push(`${setup.projectorLumensRequired.toLocaleString()} lumen projector`);
  required.push(`${setup.screenWidthM}m × ${setup.screenHeightM}m ${setup.surfaceType.replace(/_/g,' ')}`);
  required.push('Media server (Resolume / disguise / custom)');
  required.push('Art-Net node or DMX interface');
  required.push('Haze machine for beam visibility');
  required.push('Black stage masking / drape');
  if (dims.ceilingHeightM < 5) required.push('Custom projector rigging stand or elevated platform');

  const clampedScore = Math.max(0, Math.min(100, score));
  const grade: HologramFeasibility['grade'] =
    clampedScore >= 90 ? 'A' :
    clampedScore >= 75 ? 'B' :
    clampedScore >= 60 ? 'C' :
    clampedScore >= 40 ? 'D' : 'F';

  return {
    score: clampedScore,
    grade,
    viable: clampedScore >= 50,
    warnings,
    requiredEquipment: required,
    recommendedSetup: `${setup.surfaceType.replace(/_/g,' ')} · ${setup.projectionMode.replace(/_/g,' ')} · ${setup.projectorLumensRequired.toLocaleString()} lumens`,
  };
}

// ─── Lumens Calculator ────────────────────────────────────────────────────────

export function calcRequiredLumens(
  screenWidthM: number,
  screenHeightM: number,
  throwDistanceM: number,
  ambientLight: 'none' | 'low' | 'medium',
): number {
  const screenAreaM2 = screenWidthM * screenHeightM;
  const ambientFactor = ambientLight === 'none' ? 1 : ambientLight === 'low' ? 1.4 : 2.0;
  // Holographic projection needs ~1.5× more than normal (transparency of gauze ~40–60%)
  const baseNits = 800; // target nits for good hologram
  const gauzeTransmission = 0.55;
  const lensEfficiency = 0.85;
  const lumens = (baseNits * screenAreaM2 * ambientFactor) / (gauzeTransmission * lensEfficiency);
  return Math.round(lumens / 1000) * 1000; // round to nearest 1000
}

// ─── DMX Auto-Configurator ────────────────────────────────────────────────────

interface AutoDMXOptions {
  stageWidthM: number;
  hasRigging:  boolean;
  budget:      'minimal' | 'standard' | 'premium';
}

export function autoBuildDMXProfile(opts: AutoDMXOptions): VenueDMXProfile {
  const fixtures: VenueFixture[] = [];
  let addr = 1;

  const add = (
    label: string,
    category: FixtureCategory,
    position: string,
    channels: number,
  ) => {
    const universe = addr + channels > 512 ? 1 : 0;
    if (addr > 512) addr = 1;
    fixtures.push({
      id:       `fx-${Date.now()}-${fixtures.length}`,
      label,
      category,
      position,
      universe,
      address:  addr,
      channels,
    });
    addr += channels;
  };

  // Base fixtures for any show
  add('Moving Head Front L',  'moving_head', 'front_truss_left',   16);
  add('Moving Head Front R',  'moving_head', 'front_truss_right',  16);
  add('Haze Machine',         'haze',        'backstage_center',    6);
  add('Blinder L',            'blinder',     'front_floor_left',    4);
  add('Blinder R',            'blinder',     'front_floor_right',   4);

  if (opts.budget !== 'minimal') {
    add('Moving Head Rear L',   'moving_head', 'rear_truss_left',   16);
    add('Moving Head Rear R',   'moving_head', 'rear_truss_right',  16);
    add('LED Bar Upstage',      'led_bar',     'upstage_floor',     12);
    add('Fog Machine',          'fog',         'backstage_left',     4);
    add('Strobe L',             'strobe',      'mid_truss_left',     6);
    add('Strobe R',             'strobe',      'mid_truss_right',    6);
  }

  if (opts.budget === 'premium') {
    add('Follow Spot L',        'follow_spot', 'foh_left',          16);
    add('Follow Spot R',        'follow_spot', 'foh_right',         16);
    add('Pixel Bar Truss',      'pixel',       'front_truss_center',24);
    add('Moving Head Mid L',    'moving_head', 'mid_truss_left',    16);
    add('Moving Head Mid R',    'moving_head', 'mid_truss_right',   16);
  }

  return {
    protocol: 'artnet',
    ip: '2.0.0.1',
    universesRequired: addr > 512 ? 2 : 1,
    fixtures,
  };
}

// ─── Budget Estimator ─────────────────────────────────────────────────────────

export function calcBudgetEstimate(
  dims: StageDimensions,
  setup: HologramSetupSpec,
  templateType: ShowTemplateType,
  crewCount: number,
  budgetTier: 'minimal' | 'standard' | 'premium',
): BudgetEstimate {
  const items: BudgetLineItem[] = [];

  const projectorCost = Math.round((setup.projectorLumensRequired / 10000) * 3500);
  items.push({ category: 'equipment', label: `${setup.projectorLumensRequired.toLocaleString()}L Projector`, estimatedUSD: projectorCost });
  items.push({ category: 'equipment', label: `${setup.surfaceType.replace(/_/g,' ')} (${setup.screenWidthM}×${setup.screenHeightM}m)`, estimatedUSD: setup.screenWidthM * setup.screenHeightM * 120 });
  items.push({ category: 'equipment', label: 'Media Server', estimatedUSD: budgetTier === 'minimal' ? 800 : budgetTier === 'standard' ? 1800 : 4000 });
  items.push({ category: 'equipment', label: 'DMX Node + cables', estimatedUSD: 400 });
  items.push({ category: 'equipment', label: 'Haze/Fog Machine', estimatedUSD: 300 });

  const lightingCost = budgetTier === 'minimal' ? 1200 : budgetTier === 'standard' ? 2800 : 6000;
  items.push({ category: 'lighting', label: 'Lighting Package', estimatedUSD: lightingCost });

  const dailyRate = 600;
  const crewDays = templateType.includes('30min') ? 1 : templateType.includes('45min') ? 2 : 3;
  items.push({ category: 'crew', label: `Crew (${crewCount} × ${crewDays} days)`, estimatedUSD: crewCount * dailyRate * crewDays });

  items.push({ category: 'production', label: 'Setup & Rehearsal Day', estimatedUSD: 1500 });
  items.push({ category: 'production', label: 'Transportation & Logistics', estimatedUSD: 800 });
  items.push({ category: 'production', label: 'Black Stage Masking', estimatedUSD: 600 });

  const subtotal = items.reduce((s, i) => s + i.estimatedUSD, 0);
  const contingencyPct = 15;
  const contingency = Math.round(subtotal * contingencyPct / 100);
  items.push({ category: 'contingency', label: `Contingency (${contingencyPct}%)`, estimatedUSD: contingency });

  return {
    currency: 'USD',
    items,
    totalEstimated: subtotal + contingency,
    contingencyPercent: contingencyPct,
  };
}

// ─── Show Timeline Template Builder ──────────────────────────────────────────

const TEMPLATE_SPECS: Record<ShowTemplateType, { durationMin: number; songs: number }> = {
  showcase_15min:    { durationMin: 15, songs: 3  },
  mini_concert_30min:{ durationMin: 30, songs: 6  },
  full_show_45min:   { durationMin: 45, songs: 8  },
  premium_show_60min:{ durationMin: 60, songs: 10 },
  corporate:         { durationMin: 20, songs: 4  },
  club:              { durationMin: 30, songs: 7  },
  festival:          { durationMin: 25, songs: 5  },
  theater:           { durationMin: 60, songs: 9  },
  private_event:     { durationMin: 30, songs: 5  },
};

export function buildShowTemplate(templateType: ShowTemplateType): ShowTemplate {
  const spec = TEMPLATE_SPECS[templateType];
  const totalSec = spec.durationMin * 60;
  const slots: ShowTimelineSlot[] = [];
  let offset = 0;

  const add = (
    label: string,
    type: ShowTimelineSlot['type'],
    durationSec: number,
    extras?: Partial<ShowTimelineSlot>,
  ) => {
    slots.push({
      slotIndex: slots.length,
      label,
      type,
      durationSec,
      offsetSec: offset,
      lightingPreset: extras?.lightingPreset ?? type === 'intro' ? 'blue_haze' : type === 'finale' ? 'white_gold' : 'warm_stage',
      animationPreset: extras?.animationPreset,
      dmxCuePreset: extras?.dmxCuePreset,
      fallbackRequired: type === 'song' || type === 'finale',
      ...extras,
    });
    offset += durationSec;
  };

  add('Venue Blackout',   'blackout',    10,  { lightingPreset: 'blackout' });
  add('Opening Sequence', 'intro',       30,  { lightingPreset: 'blue_haze', animationPreset: 'artist_reveal' });
  add('Artist Reveal',    'intro',       20,  { lightingPreset: 'reveal_burst', animationPreset: 'artist_enters' });

  for (let i = 1; i <= spec.songs; i++) {
    add(`Song ${i}`,        'song',       Math.round((totalSec - 120 - 60 * spec.songs) / spec.songs + 60 * 0.6), {
      lightingPreset: i === 1 ? 'warm_verse' : i === spec.songs ? 'finale_full' : 'chorus_burst',
      animationPreset: i % 2 === 0 ? 'dance_loop' : 'idle_singing',
    });
    if (i < spec.songs) {
      add(`Transition ${i}`, 'transition', 10,  { lightingPreset: 'dim_transition' });
    }
  }

  add('Finale Sequence',  'finale',      45,  { lightingPreset: 'white_gold', animationPreset: 'artist_finale' });
  add('Fade Out',         'blackout',    15,  { lightingPreset: 'fade_black' });

  return {
    templateType,
    totalDurationSec: totalSec,
    songSlots: spec.songs,
    slots,
  };
}

// ─── Crew Planner ─────────────────────────────────────────────────────────────

export function buildCrewPlan(
  hasLiveMoCap: boolean,
  hasLiveAudio: boolean,
  isLargeVenue: boolean,
): CrewPlan {
  const roles = [
    { role: 'Technical Director',       responsibility: 'Supervise installation and show execution', optional: false },
    { role: 'Projection Operator',      responsibility: 'Control hologram output and projector alignment', optional: false },
    { role: 'DMX Lighting Operator',    responsibility: 'Manage lighting scenes, Art-Net and blackout', optional: false },
    { role: 'Audio Engineer',           responsibility: 'Manage playback, stems, FOH and timecode', optional: !hasLiveAudio },
    { role: 'StageOS Operator',         responsibility: 'Run Boostify HoloStage timeline and show package', optional: false },
    { role: 'Stagehand',                responsibility: 'Installation, surface setup, cabling', optional: false },
    { role: 'Hologram Surface Installer', responsibility: 'Mount and tension Holo Gauze / foil', optional: false },
    { role: 'MoCap Operator',           responsibility: 'Operate HoloSuit suit or phone capture', optional: !hasLiveMoCap },
    ...(isLargeVenue ? [
      { role: 'Second Stagehand',       responsibility: 'Support installation in large venue', optional: true },
      { role: 'Venue Coordinator',      responsibility: 'Liaison with venue technical staff', optional: true },
    ] : []),
  ];

  const required = roles.filter(r => !r.optional).length;
  return {
    minimumCrew: required,
    recommendedCrew: roles.length,
    roles,
  };
}

// ─── Technical Rider Text Generator ──────────────────────────────────────────

export function generateTechnicalRider(venue: VenueMaster): string {
  const d = venue.dimensions;
  const h = venue.hologramSetup;
  const f = venue.feasibility;

  return `
BOOSTIFY HOLOSTAGE — TECHNICAL RIDER
Event: ${venue.venueName} | ${venue.eventType.replace(/_/g,' ').toUpperCase()}
Generated: ${new Date().toLocaleDateString()}
─────────────────────────────────────────────────────

VENUE DIMENSIONS
Stage: ${d.stageWidthM}m (W) × ${d.stageDepthM}m (D) × ${d.stageHeightM}m (H)
Ceiling: ${d.ceilingHeightM}m | Room: ${d.roomWidthM}m × ${d.roomDepthM}m
Audience Distance: ${d.audienceDistanceM}m from stage front

HOLOGRAM SETUP
Surface: ${h.surfaceType.replace(/_/g,' ')} — ${h.screenWidthM}m × ${h.screenHeightM}m
Projection: ${h.projectionMode.replace(/_/g,' ')}
Projector: ${h.projectorLumensRequired.toLocaleString()} lumens minimum
Projector Position: X=${h.projectorPosition.x}m · Y=${h.projectorPosition.y}m · Z=${h.projectorPosition.z}m
Artist Scale: ${h.artistScale.replace(/_/g,' ')}
Ambient Light: ${h.ambientLightLimit} (MUST be respected during performance)

DMX / LIGHTING
Protocol: ${venue.dmx.protocol.toUpperCase()} | Universes: ${venue.dmx.universesRequired}
Fixtures Required: ${venue.dmx.fixtures.length}
  ${venue.dmx.fixtures.map(f => `• ${f.label} — ${f.category} @ ${f.position} (U${f.universe} A${f.address})`).join('\n  ')}

AUDIO
System: ${venue.audio.systemType.replace(/_/g,' ')}
FOH Position: ${venue.audio.fohPosition}
Stems: ${venue.audio.stemsSupported ? 'Required' : 'Not required'}
Timecode: ${venue.audio.timecodeRequired ? 'Required (LTC 25fps)' : 'Not required'}
Sample Rate: ${venue.audio.sampleRate ?? 48000}Hz

CREW REQUIREMENTS
Minimum crew: ${venue.crew.minimumCrew} | Recommended: ${venue.crew.recommendedCrew}
  ${venue.crew.roles.map(r => `• ${r.role}${r.optional ? ' (optional)' : ''}: ${r.responsibility}`).join('\n  ')}

BUDGET ESTIMATE (${venue.budget.currency})
  ${venue.budget.items.map(i => `• ${i.label}: $${i.estimatedUSD.toLocaleString()}`).join('\n  ')}
TOTAL ESTIMATED: $${venue.budget.totalEstimated.toLocaleString()}

FEASIBILITY${f ? ` — Score: ${f.score}/100 (${f.grade}) — ${f.viable ? 'VIABLE' : 'NOT VIABLE'}` : ': Not calculated'}
${f?.warnings?.map(w => `⚠ ${w}`).join('\n') ?? ''}

EQUIPMENT LIST
${f?.requiredEquipment?.map(e => `  ✓ ${e}`).join('\n') ?? 'Run feasibility calculation.'}
─────────────────────────────────────────────────────
Generated by Boostify HoloStage VenueOS
`.trim();
}
