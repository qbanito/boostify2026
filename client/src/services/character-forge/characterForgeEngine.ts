// ─── Boostify AI Character Forge — Core Engine (MVP 1 Mock) ──────────────────
// Implements all pipeline stages as deterministic mocks.
// Real 3D processing (CC4, geometry morphing) is wired in MVP 2+.
// CC4 / HoloSuit / iClone data is sourced from the installed software files.

import {
  BaseCharacter,
  CharacterIdentity,
  BaseCharacterMatch,
  MorphProfile,
  ProtectedZones,
  RigValidationResult,
  HoloSuitCompatibilityProfile,
  CharacterQualityReport,
  StageOSCharacterPackage,
  CharacterVariant,
  GeneratedCharacter,
  HOLOSUIT_TO_CC4_BODY_MAP,
  HOLOSUIT_TO_CC4_FACE_MAP,
  HOLOSUIT_TO_CC4_HAND_MAP,
  ReferenceImageType,
} from '../../schemas/character-forge/index';

// ─── Base Character Library ───────────────────────────────────────────────────
// Models sourced from Character Creator 4 export presets.
// All use RL_CC3_Plus skeleton with RL_Motion_Bone rig type.

export const BASE_CHARACTER_LIBRARY: BaseCharacter[] = [
  {
    id: 'cc4_male_slim_athletic_001',
    name: 'CC4 Male Slim Athletic',
    gender_presentation: 'male',
    body_type: 'slim_athletic',
    age_range: 'young_adult',
    skeleton_type: 'character_creator_humanoid',
    rig_type: 'cc4_standard',
    blendshape_set: 'cc4_facial_extended',
    polygon_count: 65000,
    texture_resolution: '4K',
    compatible_with_holosuit: true,
    compatible_with_stageos: true,
    base_fbx_url: '/characters/base/cc4_male_slim_athletic_001.fbx',
    base_glb_url: '/characters/base/cc4_male_slim_athletic_001.glb',
    thumbnail_url: '/characters/thumbnails/cc4_male_slim_athletic_001.jpg',
    tags: ['male', 'slim', 'athletic', 'stage_ready', 'holosuit_ready', 'cc4'],
  },
  {
    id: 'cc4_male_average_001',
    name: 'CC4 Male Average',
    gender_presentation: 'male',
    body_type: 'average',
    age_range: 'adult',
    skeleton_type: 'character_creator_humanoid',
    rig_type: 'cc4_standard',
    blendshape_set: 'cc4_facial_extended',
    polygon_count: 62000,
    texture_resolution: '4K',
    compatible_with_holosuit: true,
    compatible_with_stageos: true,
    base_fbx_url: '/characters/base/cc4_male_average_001.fbx',
    base_glb_url: '/characters/base/cc4_male_average_001.glb',
    thumbnail_url: '/characters/thumbnails/cc4_male_average_001.jpg',
    tags: ['male', 'average', 'stage_ready', 'holosuit_ready', 'cc4'],
  },
  {
    id: 'cc4_male_muscular_001',
    name: 'CC4 Male Muscular',
    gender_presentation: 'male',
    body_type: 'muscular',
    age_range: 'adult',
    skeleton_type: 'character_creator_humanoid',
    rig_type: 'cc4_standard',
    blendshape_set: 'cc4_facial_extended',
    polygon_count: 68000,
    texture_resolution: '4K',
    compatible_with_holosuit: true,
    compatible_with_stageos: true,
    base_fbx_url: '/characters/base/cc4_male_muscular_001.fbx',
    base_glb_url: '/characters/base/cc4_male_muscular_001.glb',
    thumbnail_url: '/characters/thumbnails/cc4_male_muscular_001.jpg',
    tags: ['male', 'muscular', 'stage_ready', 'holosuit_ready', 'cc4'],
  },
  {
    id: 'cc4_female_slim_001',
    name: 'CC4 Female Slim',
    gender_presentation: 'female',
    body_type: 'slim',
    age_range: 'young_adult',
    skeleton_type: 'character_creator_humanoid',
    rig_type: 'cc4_standard',
    blendshape_set: 'cc4_facial_extended',
    polygon_count: 63000,
    texture_resolution: '4K',
    compatible_with_holosuit: true,
    compatible_with_stageos: true,
    base_fbx_url: '/characters/base/cc4_female_slim_001.fbx',
    base_glb_url: '/characters/base/cc4_female_slim_001.glb',
    thumbnail_url: '/characters/thumbnails/cc4_female_slim_001.jpg',
    tags: ['female', 'slim', 'stage_ready', 'holosuit_ready', 'cc4'],
  },
  {
    id: 'cc4_female_athletic_001',
    name: 'CC4 Female Athletic',
    gender_presentation: 'female',
    body_type: 'slim_athletic',
    age_range: 'adult',
    skeleton_type: 'character_creator_humanoid',
    rig_type: 'cc4_standard',
    blendshape_set: 'cc4_facial_extended',
    polygon_count: 64000,
    texture_resolution: '4K',
    compatible_with_holosuit: true,
    compatible_with_stageos: true,
    base_fbx_url: '/characters/base/cc4_female_athletic_001.fbx',
    base_glb_url: '/characters/base/cc4_female_athletic_001.glb',
    thumbnail_url: '/characters/thumbnails/cc4_female_athletic_001.jpg',
    tags: ['female', 'athletic', 'stage_ready', 'holosuit_ready', 'cc4'],
  },
  {
    id: 'cc4_neutral_slim_001',
    name: 'CC4 Neutral Slim',
    gender_presentation: 'neutral',
    body_type: 'slim',
    age_range: 'young_adult',
    skeleton_type: 'character_creator_humanoid',
    rig_type: 'cc4_standard',
    blendshape_set: 'cc4_facial_extended',
    polygon_count: 60000,
    texture_resolution: '4K',
    compatible_with_holosuit: true,
    compatible_with_stageos: true,
    base_fbx_url: '/characters/base/cc4_neutral_slim_001.fbx',
    base_glb_url: '/characters/base/cc4_neutral_slim_001.glb',
    thumbnail_url: '/characters/thumbnails/cc4_neutral_slim_001.jpg',
    tags: ['neutral', 'slim', 'stage_ready', 'holosuit_ready', 'cc4'],
  },
];

// ─── Simulated delay utility ──────────────────────────────────────────────────

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// ─── 1. Artist Image Analyzer (Mock) ─────────────────────────────────────────

export interface AnalysisProgressEvent {
  stage: string;
  progress: number;  // 0–100
  message: string;
}

export type AnalysisProgressCallback = (e: AnalysisProgressEvent) => void;

export async function analyzeArtistImages(
  artistId: string,
  uploadedImages: Array<{ type: ReferenceImageType; dataUrl: string }>,
  onProgress?: AnalysisProgressCallback,
): Promise<CharacterIdentity> {
  const stages = [
    { stage: 'Detecting faces',          msg: 'Running face detection model…',    pct: 10 },
    { stage: 'Mapping facial landmarks', msg: 'Extracting 468 facial landmarks…', pct: 25 },
    { stage: 'Analyzing proportions',    msg: 'Measuring facial geometry…',       pct: 40 },
    { stage: 'Body analysis',            msg: 'Estimating body proportions…',     pct: 55 },
    { stage: 'Skin tone analysis',       msg: 'Sampling skin tone regions…',      pct: 65 },
    { stage: 'Hair analysis',            msg: 'Classifying hair style & color…',  pct: 75 },
    { stage: 'Style analysis',           msg: 'Inferring stage style & genre…',   pct: 88 },
    { stage: 'Generating identity',      msg: 'Composing Character Identity…',    pct: 97 },
  ];

  for (const s of stages) {
    onProgress?.({ stage: s.stage, progress: s.pct, message: s.msg });
    await delay(350);
  }

  const hasFace = uploadedImages.some(i =>
    i.type === 'face_front' || i.type === 'face_three_quarter' || i.type === 'face_side',
  );
  const hasBody   = uploadedImages.some(i => i.type === 'full_body');
  const hasStyle  = uploadedImages.some(i => i.type === 'stage_style' || i.type === 'wardrobe_reference');
  const confidence = 0.55 + (hasFace ? 0.2 : 0) + (hasBody ? 0.1 : 0) + (hasStyle ? 0.08 : 0);

  const identity: CharacterIdentity = {
    id:               `identity_${artistId}_${Date.now()}`,
    artist_id:        artistId,
    identity_version: '1.0.0',
    face: {
      face_shape:          'oval',
      jaw_width:           0.42,
      chin_projection:     0.36,
      cheekbone_height:    0.68,
      forehead_height:     0.55,
      eye_spacing:         0.52,
      eye_size:            0.48,
      eyebrow_shape:       'arched',
      nose_width:          0.47,
      nose_bridge_height:  0.58,
      nose_tip_projection: 0.51,
      mouth_width:         0.49,
      lip_fullness:        0.61,
      ear_visibility:      'visible',
    },
    body: {
      height_ratio:    1.04,
      shoulder_width:  0.56,
      torso_length:    0.51,
      leg_length:      0.58,
      body_type:       'slim_athletic',
      posture_style:   'confident_stage_presence',
    },
    skin: {
      skin_tone_category:    'medium_warm',
      skin_warmth:           'warm',
      skin_roughness_estimate: 0.35,
    },
    hair: {
      hair_length: 'short',
      hair_style:  'curly',
      hair_volume: 0.62,
      hair_color:  'dark_brown',
      hairline_type: 'rounded',
    },
    style: {
      music_genre:      'afrobeat_deep_house',
      stage_personality: 'mysterious_confident',
      wardrobe_style:   'futuristic_caribbean',
      color_palette:    ['black', 'orange', 'silver'],
      visual_signature: 'orange_light_reflections_dark_stage',
      accessories:      ['minimal_chain', 'ear_stud'],
    },
    confidence_score: Math.min(1, confidence),
    source_images:    uploadedImages.map(i => i.type),
    created_at:       new Date().toISOString(),
  };

  onProgress?.({ stage: 'Done', progress: 100, message: 'Character Identity ready.' });
  return identity;
}

// ─── 2. Base Character Matcher ────────────────────────────────────────────────

export function matchBaseCharacter(identity: CharacterIdentity): BaseCharacterMatch {
  const scored = BASE_CHARACTER_LIBRARY.map(base => {
    let score = 0;

    // Body type match
    if (base.body_type === identity.body.body_type) score += 30;
    else if (
      (base.body_type === 'slim_athletic' && identity.body.body_type === 'slim') ||
      (base.body_type === 'slim' && identity.body.body_type === 'slim_athletic')
    ) score += 18;
    else score += 5;

    // Gender presentation inferred from style
    const isFemale = identity.style.stage_personality.includes('feminine') ||
      identity.style.wardrobe_style.includes('feminine');
    if (!isFemale && base.gender_presentation === 'male')   score += 20;
    if (isFemale  && base.gender_presentation === 'female') score += 20;

    // Stage readiness bonus
    if (base.compatible_with_holosuit)  score += 15;
    if (base.compatible_with_stageos) score += 15;

    // Height ratio — penalize extreme difference
    if (identity.body.height_ratio > 1.05 && base.body_type === 'muscular') score -= 5;

    // Normalize to 0–1
    return { base, score: Math.min(score, 80) / 80 };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];

  return {
    selected_base_character_id: top.base.id,
    match_score: Math.round(top.score * 100) / 100,
    reason: `Best match: ${top.base.body_type} body type, ${top.base.gender_presentation} presentation, fully HoloSuit & StageOS compatible (RL_CC3_Plus skeleton).`,
    alternatives: scored.slice(1, 3).map(s => ({
      id:          s.base.id,
      match_score: Math.round(s.score * 100) / 100,
    })),
  };
}

// ─── 3. Morph Profile Generator ───────────────────────────────────────────────

export function generateMorphProfile(
  identity: CharacterIdentity,
  baseCharacterId: string,
): MorphProfile {
  const f = identity.face;
  const b = identity.body;

  // Clamp morph values to safe range (-0.25 to +0.25 relative to neutral 0.5)
  const morphDelta = (val: number) => Math.max(-0.25, Math.min(0.25, (val - 0.5) * 0.5));

  const protectedZones: ProtectedZones = {
    skeleton:          'locked',
    skin_weights:      'locked',
    uv_layout:         'preserve',
    facial_blendshapes:'preserve',
    hand_rig:          'locked',
    eye_rig:           'preserve',
    jaw_rig:           'preserve',
  };

  return {
    morph_profile_id:  `morph_${identity.artist_id}_${Date.now()}`,
    character_id:      undefined,
    base_character_id: baseCharacterId,
    protected_zones:   protectedZones,
    editable_zones: {
      face_shape:        true,
      nose:              true,
      eyes:              true,
      mouth:             true,
      jaw:               true,
      cheekbones:        true,
      body_proportions:  true,
      skin_texture:      true,
      hair:              true,
      clothing:          true,
    },
    face_morphs: {
      jaw_width:           morphDelta(f.jaw_width),
      chin_projection:     morphDelta(f.chin_projection),
      cheekbone_height:    morphDelta(f.cheekbone_height),
      cheekbone_width:     0,
      forehead_height:     morphDelta(f.forehead_height),
      nose_width:          morphDelta(f.nose_width),
      nose_bridge_height:  morphDelta(f.nose_bridge_height),
      nose_tip_projection: morphDelta(f.nose_tip_projection),
      eye_spacing:         morphDelta(f.eye_spacing),
      eye_size:            morphDelta(f.eye_size),
      mouth_width:         morphDelta(f.mouth_width),
      lip_fullness:        morphDelta(f.lip_fullness),
      brow_height:         0,
    },
    body_morphs: {
      height:            (b.height_ratio - 1.0) * 0.5,
      shoulder_width:    morphDelta(b.shoulder_width),
      torso_length:      morphDelta(b.torso_length),
      leg_length:        morphDelta(b.leg_length),
      muscle_definition: b.body_type === 'muscular' ? 0.15 : b.body_type === 'slim_athletic' ? 0.08 : 0,
      waist_width:       0,
    },
    style_morphs: {
      stylization_level:      0.2,
      stage_exaggeration_level: 0.18,
      likeness_priority:      0.82,
    },
    created_at: new Date().toISOString(),
  };
}

// ─── 4. Rig Preservation Validator (Mock) ─────────────────────────────────────

export async function validateRig(
  characterId: string,
  baseCharacterId: string,
  onProgress?: AnalysisProgressCallback,
): Promise<RigValidationResult> {
  const checks = [
    'Checking skeleton root bone…',
    'Verifying 53 CC4 RL_* bones…',
    'Validating skin weights…',
    'Checking 220+ blendshapes…',
    'Validating jaw & eye rigs…',
    'Checking 30 hand/finger bones…',
    'Verifying T-pose alignment…',
    'HoloSuit bone name check…',
  ];

  for (let i = 0; i < checks.length; i++) {
    onProgress?.({ stage: 'Rig Validation', progress: Math.round((i / checks.length) * 100), message: checks[i] });
    await delay(220);
  }

  const result: RigValidationResult = {
    rig_status:                'valid_with_warnings',
    skeleton_detected:         true,
    bone_count:                53,
    required_bones_present:    true,
    skin_weights_valid:        true,
    blendshapes_valid:         true,
    blendshape_count:          228,
    hand_rig_valid:            true,
    face_rig_valid:            true,
    eye_bones_valid:           true,
    jaw_bone_valid:            true,
    t_pose_valid:              true,
    scale_valid:               true,
    root_bone_valid:           true,
    holosuit_ready:              true,
    issues: [
      {
        area:         'hair_mesh',
        severity:     'medium',
        message:      'Hair transparency mesh may create artifacts in hologram output. Use Live Hologram optimized hair preset.',
        auto_fixable: true,
      },
      {
        area:         'face_likeness',
        severity:     'low',
        message:      'Nose bridge differs from reference by estimated 11%. Manual refinement recommended.',
        auto_fixable: false,
      },
    ],
    validated_at: new Date().toISOString(),
  };

  onProgress?.({ stage: 'Done', progress: 100, message: 'Rig validation complete.' });
  return result;
}

// ─── 5. HoloSuit Compatibility Builder ─────────────────────────────────────────

export async function buildHoloSuitProfile(
  characterId: string,
  identity: CharacterIdentity,
  onProgress?: AnalysisProgressCallback,
): Promise<HoloSuitCompatibilityProfile> {
  const stages = [
    'Mapping 21 body bones to RL_* names…',
    'Building hand bone map (30 bones)…',
    'Mapping 19 ARKit face blendshapes…',
    'Generating calibration profile…',
    'Setting HoloSuit streaming defaults…',
    'Validating completeness…',
  ];

  for (let i = 0; i < stages.length; i++) {
    onProgress?.({ stage: 'HoloSuit Build', progress: Math.round((i / stages.length) * 100), message: stages[i] });
    await delay(280);
  }

  const profile: HoloSuitCompatibilityProfile = {
    profile_id:   `holosuit_${characterId}_${Date.now()}`,
    character_id: characterId,
    avatar_uid:   'RL_CC3_Plus',
    bone_uid:     'RL_Motion_Bone',
    body_map:     HOLOSUIT_TO_CC4_BODY_MAP,
    hand_map:     HOLOSUIT_TO_CC4_HAND_MAP,
    face_map:     HOLOSUIT_TO_CC4_FACE_MAP,
    calibration: {
      height_cm:    170 * identity.body.height_ratio,
      arm_span_cm:  170 * identity.body.height_ratio * 1.02,
      pose:         'T-pose',
      scale_factor: identity.body.height_ratio,
    },
    streaming: {
      udp_port:      14043,
      send_rate:     60,
      body_enabled:  true,
      hands_enabled: true,
      face_enabled:  true,
    },
    latency_profile: {
      body_delay_ms: 0,
      face_delay_ms: 0,
    },
    ready:      true,
    missing:    [],
    created_at: new Date().toISOString(),
  };

  onProgress?.({ stage: 'Done', progress: 100, message: 'HoloSuit profile ready.' });
  return profile;
}

// ─── 6. Character Quality Score Engine ───────────────────────────────────────

export function generateQualityReport(
  characterId: string,
  identity: CharacterIdentity,
  rigResult: RigValidationResult,
  holosuitProfile: HoloSuitCompatibilityProfile,
): CharacterQualityReport {
  const imageCount = identity.source_images.length;
  const hasFront   = identity.source_images.includes('face_front');
  const hasBody    = identity.source_images.includes('full_body');

  const likeness   = Math.round(60 + (hasFront ? 14 : 0) + (hasBody ? 5 : 0) + Math.min(imageCount * 3, 8));
  const rig        = rigResult.rig_status === 'valid' ? 98 : 94;
  const texture    = 80 + (hasFront ? 5 : 0);
  const hair       = 72;
  const wardrobe   = 76;
  const blendshape = rigResult.blendshape_count > 200 ? 93 : 80;
  const holosuit     = holosuitProfile.ready ? 97 : 60;
  const hologram   = 84;
  const perf       = 88;
  const optim      = 85;

  const overall = Math.round(
    (likeness * 0.15) + (rig * 0.15) + (texture * 0.1) + (hair * 0.08) +
    (wardrobe * 0.07) + (blendshape * 0.1) + (holosuit * 0.12) +
    (hologram * 0.1) + (perf * 0.07) + (optim * 0.06),
  );

  const issues = [...rigResult.issues.map(i => ({ area: i.area, severity: i.severity, message: i.message }))];
  if (likeness < 75) {
    issues.push({ area: 'likeness', severity: 'low', message: 'Add more reference images (face front + 3/4) to improve likeness accuracy.' });
  }

  return {
    character_id:              characterId,
    character_quality_score:   overall,
    likeness_score:            likeness,
    rig_score:                 rig,
    texture_score:             texture,
    hair_score:                hair,
    wardrobe_score:            wardrobe,
    blendshape_score:          blendshape,
    holosuit_score:              holosuit,
    hologram_score:            hologram,
    performance_score:         perf,
    optimization_score:        optim,
    status:                    overall >= 85 ? 'stageos_ready' :
                               overall >= 70 ? 'stageos_ready_with_warnings' : 'not_ready',
    issues,
    created_at:                new Date().toISOString(),
  };
}

// ─── 7. Character Variant Builder ─────────────────────────────────────────────

export function buildCharacterVariants(
  characterId: string,
  baseCharacterId: string,
): CharacterVariant[] {
  const base = BASE_CHARACTER_LIBRARY.find(b => b.id === baseCharacterId);
  const polyCount = base?.polygon_count ?? 65000;

  return [
    {
      type:              'hero',
      label:             'Hero Character',
      description:       'Alta calidad para renders, videos y promos.',
      use_case:          ['Videos musicales', 'Renders', 'Promos', 'Close-ups', 'Cinematics'],
      fbx_url:           `/characters/${characterId}/hero/character.fbx`,
      glb_url:           `/characters/${characterId}/hero/character.glb`,
      polygon_count:     polyCount,
      texture_resolution:'4K',
      file_size_mb:      48,
      ready:             true,
    },
    {
      type:              'live_hologram',
      label:             'Live Hologram',
      description:       'Optimizado para StageOS, proyección y HoloSuit.',
      use_case:          ['StageOS', 'Holograma', 'HoloSuit', 'Shows', 'DMX sync'],
      glb_url:           `/characters/${characterId}/live/character.glb`,
      polygon_count:     Math.round(polyCount * 0.5),
      texture_resolution:'2K',
      file_size_mb:      18,
      ready:             true,
    },
    {
      type:              'web_preview',
      label:             'Web Preview',
      description:       'Ligero para el editor de Boostify y ensayos.',
      use_case:          ['Editor Boostify', 'Preview', 'Calibración', 'Repertorio'],
      glb_url:           `/characters/${characterId}/web/character.glb`,
      polygon_count:     Math.round(polyCount * 0.25),
      texture_resolution:'1K',
      file_size_mb:      6,
      ready:             true,
    },
  ];
}

// ─── 8. StageOS Character Exporter ────────────────────────────────────────────

export async function exportToStageOS(
  character: GeneratedCharacter,
  onProgress?: AnalysisProgressCallback,
): Promise<StageOSCharacterPackage> {
  const stages = [
    'Bundling character variants…',
    'Attaching rig profile…',
    'Embedding HoloSuit profile…',
    'Compressing textures for StageOS…',
    'Writing quality report…',
    'Generating hologram optimization…',
    'Finalizing package…',
  ];

  for (let i = 0; i < stages.length; i++) {
    onProgress?.({ stage: 'StageOS Export', progress: Math.round((i / stages.length) * 100), message: stages[i] });
    await delay(300);
  }

  const pkg: StageOSCharacterPackage = {
    package_type:  'stageos_character_package',
    version:       '1.0.0',
    artist_id:     character.artist_id,
    character_id:  character.id,
    source: {
      base_model:    character.base_character_id,
      created_with:  'boostify_ai_character_forge',
      avatar_uid:    'RL_CC3_Plus',
    },
    variants: {
      hero:          `/characters/${character.id}/hero/character.fbx`,
      live_hologram: `/characters/${character.id}/live/character.glb`,
      web_preview:   `/characters/${character.id}/web/character.glb`,
    },
    profiles: {
      morph_profile:    `/characters/${character.id}/profiles/morph.json`,
      rig_profile:      `/characters/${character.id}/profiles/rig.json`,
      holosuit_profile:   `/characters/${character.id}/profiles/holosuit.json`,
      hologram_profile: `/characters/${character.id}/profiles/hologram.json`,
    },
    face_blendshape_map: HOLOSUIT_TO_CC4_FACE_MAP,
    hand_map:            HOLOSUIT_TO_CC4_HAND_MAP,
    quality_report:      `/characters/${character.id}/reports/quality.json`,
    stageos_ready:       (character.quality_report?.character_quality_score ?? 0) >= 70,
    created_at:          new Date().toISOString(),
  };

  onProgress?.({ stage: 'Done', progress: 100, message: 'StageOS package ready.' });
  return pkg;
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { BASE_CHARACTER_LIBRARY as baseCharacterLibrary };
