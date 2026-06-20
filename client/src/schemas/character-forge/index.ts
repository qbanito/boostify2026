// ─── Boostify AI Character Forge — Schemas ───────────────────────────────────
// All TypeScript types for the Character Forge system.
// Based on Character Creator 4 (RL_CC3_Plus skeleton), HoloSuit Studio streaming,
// and iClone HIK bone data from installed software files.

// ─── Base Character Library ───────────────────────────────────────────────────

export type BodyType = 'slim_athletic' | 'average' | 'heavy' | 'slim' | 'muscular' | 'petite';
export type AgeRange = 'teen' | 'young_adult' | 'adult' | 'mature';
export type SkeletonType = 'character_creator_humanoid' | 'mixamo' | 'custom_humanoid';
export type RigType = 'cc4_standard' | 'cc3_plus' | 'cc3' | 'custom';
export type BlendshapeSet = 'cc4_facial_extended' | 'cc4_facial_basic' | 'arkit_52' | 'custom';

export interface BaseCharacter {
  id: string;
  name: string;
  gender_presentation: 'male' | 'female' | 'neutral';
  body_type: BodyType;
  age_range: AgeRange;
  ethnicity_style_category?: string;
  skeleton_type: SkeletonType;
  rig_type: RigType;
  blendshape_set: BlendshapeSet;
  polygon_count: number;
  texture_resolution: '1K' | '2K' | '4K' | '8K';
  compatible_with_holosuit: boolean;
  compatible_with_stageos: boolean;
  base_fbx_url: string;
  base_glb_url: string;
  thumbnail_url: string;
  tags: string[];
  created_at?: string;
}

// ─── Artist Reference Images ──────────────────────────────────────────────────

export type ReferenceImageType =
  | 'face_front' | 'face_side' | 'face_three_quarter'
  | 'full_body' | 'hair_reference' | 'wardrobe_reference' | 'stage_style';

export interface ArtistReferenceImage {
  id: string;
  artist_id: string;
  image_type: ReferenceImageType;
  image_url: string;
  preview_url?: string;
  analysis_status: 'pending' | 'analyzing' | 'done' | 'failed';
  analysis_result?: Record<string, unknown>;
  uploaded_at: string;
}

// ─── Character Identity ───────────────────────────────────────────────────────

export interface FaceAnalysis {
  face_shape: 'oval' | 'round' | 'square' | 'heart' | 'oblong' | 'diamond';
  jaw_width: number;             // 0–1 normalized
  chin_projection: number;
  cheekbone_height: number;
  forehead_height: number;
  eye_spacing: number;
  eye_size: number;
  eyebrow_shape: string;
  nose_width: number;
  nose_bridge_height: number;
  nose_tip_projection: number;
  mouth_width: number;
  lip_fullness: number;
  ear_visibility: 'visible' | 'partially_visible' | 'hidden';
}

export interface BodyAnalysis {
  height_ratio: number;          // relative to average (1.0 = average)
  shoulder_width: number;
  torso_length: number;
  leg_length: number;
  body_type: BodyType;
  posture_style: string;
}

export interface HairAnalysis {
  hair_length: 'very_short' | 'short' | 'medium' | 'long' | 'very_long';
  hair_style: string;
  hair_volume: number;
  hair_color: string;
  hairline_type: 'straight' | 'widows_peak' | 'receding' | 'rounded';
}

export interface StyleAnalysis {
  music_genre: string;
  stage_personality: string;
  wardrobe_style: string;
  color_palette: string[];
  visual_signature: string;
  accessories: string[];
}

export interface CharacterIdentity {
  id: string;
  artist_id: string;
  identity_version: string;
  face: FaceAnalysis;
  body: BodyAnalysis;
  skin: {
    skin_tone_category: string;
    skin_warmth: 'warm' | 'neutral' | 'cool';
    skin_roughness_estimate: number;
    visible_marks?: string[];
  };
  hair: HairAnalysis;
  style: StyleAnalysis;
  confidence_score: number;       // 0–1
  source_images: string[];
  created_at: string;
}

// ─── Base Character Match ─────────────────────────────────────────────────────

export interface BaseCharacterMatch {
  selected_base_character_id: string;
  match_score: number;
  reason: string;
  alternatives: Array<{ id: string; match_score: number }>;
}

// ─── Morph Profile ────────────────────────────────────────────────────────────

export type LockState = 'locked' | 'preserve' | 'editable';

export interface ProtectedZones {
  skeleton: LockState;
  skin_weights: LockState;
  uv_layout: LockState;
  facial_blendshapes: LockState;
  hand_rig: LockState;
  eye_rig: LockState;
  jaw_rig: LockState;
}

export interface EditableZones {
  face_shape: boolean;
  nose: boolean;
  eyes: boolean;
  mouth: boolean;
  jaw: boolean;
  cheekbones: boolean;
  body_proportions: boolean;
  skin_texture: boolean;
  hair: boolean;
  clothing: boolean;
}

export interface FaceMorphs {
  jaw_width: number;           // -1 to 1 relative adjustment
  chin_projection: number;
  cheekbone_height: number;
  cheekbone_width: number;
  forehead_height: number;
  nose_width: number;
  nose_bridge_height: number;
  nose_tip_projection: number;
  eye_spacing: number;
  eye_size: number;
  mouth_width: number;
  lip_fullness: number;
  brow_height: number;
}

export interface BodyMorphs {
  height: number;
  shoulder_width: number;
  torso_length: number;
  leg_length: number;
  muscle_definition: number;
  waist_width: number;
}

export interface StyleMorphs {
  stylization_level: number;      // 0 = realistic, 1 = stylized
  stage_exaggeration_level: number;
  likeness_priority: number;      // 0–1
}

export interface MorphProfile {
  morph_profile_id: string;
  character_id?: string;
  base_character_id: string;
  protected_zones: ProtectedZones;
  editable_zones: EditableZones;
  face_morphs: FaceMorphs;
  body_morphs: BodyMorphs;
  style_morphs: StyleMorphs;
  created_at: string;
}

// ─── Rig Validation ───────────────────────────────────────────────────────────

export interface RigIssue {
  area: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  auto_fixable: boolean;
}

export interface RigValidationResult {
  rig_status: 'valid' | 'valid_with_warnings' | 'invalid';
  skeleton_detected: boolean;
  bone_count: number;
  required_bones_present: boolean;
  skin_weights_valid: boolean;
  blendshapes_valid: boolean;
  blendshape_count: number;
  hand_rig_valid: boolean;
  face_rig_valid: boolean;
  eye_bones_valid: boolean;
  jaw_bone_valid: boolean;
  t_pose_valid: boolean;
  scale_valid: boolean;
  root_bone_valid: boolean;
  holosuit_ready: boolean;
  issues: RigIssue[];
  validated_at: string;
}

// ─── HoloSuit Compatibility ─────────────────────────────────────────────────────

// HoloSuit body bone names → CC4 RL_* bone names
// Based on real IkControllerPresets.ini + cc4BoneMapping data
export const HOLOSUIT_TO_CC4_BODY_MAP: Record<string, string> = {
  'Hip':            'RL_BoneRoot',
  'Spine':          'RL_Spine01',
  'Chest':          'RL_Spine02',
  'Neck':           'RL_NeckTwist01',
  'Head':           'RL_Head',
  'LeftShoulder':   'RL_L_Clavicle',
  'LeftUpperArm':   'RL_L_UpperArm',
  'LeftLowerArm':   'RL_L_Forearm',
  'LeftHand':       'RL_L_Hand',
  'RightShoulder':  'RL_R_Clavicle',
  'RightUpperArm':  'RL_R_UpperArm',
  'RightLowerArm':  'RL_R_Forearm',
  'RightHand':      'RL_R_Hand',
  'LeftUpperLeg':   'RL_L_UpperLeg',
  'LeftLowerLeg':   'RL_L_LowerLeg',
  'LeftFoot':       'RL_L_Foot',
  'LeftToe':        'RL_L_ToeBase',
  'RightUpperLeg':  'RL_R_UpperLeg',
  'RightLowerLeg':  'RL_R_LowerLeg',
  'RightFoot':      'RL_R_Foot',
  'RightToe':       'RL_R_ToeBase',
};

// CC4 face blendshape names from ARKit → CC4 naming
export const HOLOSUIT_TO_CC4_FACE_MAP: Record<string, string> = {
  'jawOpen':          'CC_Base_JawOpen',
  'mouthSmileLeft':   'CC_Base_MouthSmile_L',
  'mouthSmileRight':  'CC_Base_MouthSmile_R',
  'eyeBlinkLeft':     'CC_Base_EyeBlink_L',
  'eyeBlinkRight':    'CC_Base_EyeBlink_R',
  'browInnerUp':      'CC_Base_BrowRaiseInner',
  'browDownLeft':     'CC_Base_BrowDown_L',
  'browDownRight':    'CC_Base_BrowDown_R',
  'browOuterUpLeft':  'CC_Base_BrowRaiseOuter_L',
  'browOuterUpRight': 'CC_Base_BrowRaiseOuter_R',
  'eyeLookUpLeft':    'CC_Base_EyeLookUp_L',
  'eyeLookUpRight':   'CC_Base_EyeLookUp_R',
  'eyeLookDownLeft':  'CC_Base_EyeLookDown_L',
  'eyeLookDownRight': 'CC_Base_EyeLookDown_R',
  'noseSneerLeft':    'CC_Base_NoseSneer_L',
  'noseSneerRight':   'CC_Base_NoseSneer_R',
  'mouthFunnel':      'CC_Base_MouthFunnel',
  'mouthPucker':      'CC_Base_MouthPucker',
  'tongueOut':        'CC_Base_TongueOut',
};

// HoloSuit hand bone format → CC4 RL finger bones
export const HOLOSUIT_TO_CC4_HAND_MAP: Record<string, string> = {
  'LeftThumbMeta':         'RL_L_Finger0',
  'LeftThumbProximal':     'RL_L_Finger01',
  'LeftThumbDistal':       'RL_L_Finger02',
  'LeftIndexProximal':     'RL_L_Finger10',
  'LeftIndexMiddle':       'RL_L_Finger11',
  'LeftIndexDistal':       'RL_L_Finger12',
  'LeftMiddleProximal':    'RL_L_Finger20',
  'LeftMiddleMiddle':      'RL_L_Finger21',
  'LeftMiddleDistal':      'RL_L_Finger22',
  'LeftRingProximal':      'RL_L_Finger30',
  'LeftRingMiddle':        'RL_L_Finger31',
  'LeftRingDistal':        'RL_L_Finger32',
  'LeftPinkyProximal':     'RL_L_Finger40',
  'LeftPinkyMiddle':       'RL_L_Finger41',
  'LeftPinkyDistal':       'RL_L_Finger42',
  'RightThumbMeta':        'RL_R_Finger0',
  'RightThumbProximal':    'RL_R_Finger01',
  'RightThumbDistal':      'RL_R_Finger02',
  'RightIndexProximal':    'RL_R_Finger10',
  'RightIndexMiddle':      'RL_R_Finger11',
  'RightIndexDistal':      'RL_R_Finger12',
  'RightMiddleProximal':   'RL_R_Finger20',
  'RightMiddleMiddle':     'RL_R_Finger21',
  'RightMiddleDistal':     'RL_R_Finger22',
  'RightRingProximal':     'RL_R_Finger30',
  'RightRingMiddle':       'RL_R_Finger31',
  'RightRingDistal':       'RL_R_Finger32',
  'RightPinkyProximal':    'RL_R_Finger40',
  'RightPinkyMiddle':      'RL_R_Finger41',
  'RightPinkyDistal':      'RL_R_Finger42',
};

export interface HoloSuitCompatibilityProfile {
  profile_id: string;
  character_id: string;
  avatar_uid: string;     // e.g. "RL_CC3_Plus"
  bone_uid: string;       // "RL_Motion_Bone"
  body_map: Record<string, string>;
  hand_map: Record<string, string>;
  face_map: Record<string, string>;
  calibration: {
    height_cm: number;
    arm_span_cm: number;
    pose: 'T-pose' | 'A-pose';
    scale_factor: number;
  };
  streaming: {
    udp_port: number;        // 14043
    send_rate: number;       // 60 fps
    body_enabled: boolean;
    hands_enabled: boolean;
    face_enabled: boolean;
  };
  latency_profile: {
    body_delay_ms: number;
    face_delay_ms: number;
  };
  ready: boolean;
  missing: string[];
  created_at: string;
}

// ─── Quality Report ───────────────────────────────────────────────────────────

export interface QualityIssue {
  area: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface CharacterQualityReport {
  character_id: string;
  character_quality_score: number;  // 0–100
  likeness_score: number;
  rig_score: number;
  texture_score: number;
  hair_score: number;
  wardrobe_score: number;
  blendshape_score: number;
  holosuit_score: number;
  hologram_score: number;
  performance_score: number;
  optimization_score: number;
  status: 'stageos_ready' | 'stageos_ready_with_warnings' | 'not_ready';
  issues: QualityIssue[];
  created_at: string;
}

// ─── StageOS Character Package ────────────────────────────────────────────────

export interface TextureProfile {
  variant: 'hero' | 'live_hologram' | 'web_preview';
  skin_base_color_url: string;
  skin_roughness_url?: string;
  normal_map_url?: string;
  resolution: '1K' | '2K' | '4K' | '8K';
  material_warnings: QualityIssue[];
}

export type CharacterStatus = 'analyzing' | 'base_selected' | 'morphing' | 'texturing' | 'validating' | 'ready' | 'exported';

export interface GeneratedCharacter {
  id: string;
  artist_id: string;
  base_character_id: string;
  name: string;
  status: CharacterStatus;
  current_version: string;
  quality_score: number;
  stageos_ready: boolean;
  holosuit_ready: boolean;
  identity?: CharacterIdentity;
  morph_profile?: MorphProfile;
  rig_validation?: RigValidationResult;
  holosuit_profile?: HoloSuitCompatibilityProfile;
  quality_report?: CharacterQualityReport;
  created_at: string;
  updated_at: string;
}

export interface StageOSCharacterPackage {
  package_type: 'stageos_character_package';
  version: string;
  artist_id: string;
  character_id: string;
  source: {
    base_model: string;
    created_with: 'boostify_ai_character_forge';
    avatar_uid: string;
  };
  variants: {
    hero: string;
    live_hologram: string;
    web_preview: string;
  };
  profiles: {
    morph_profile: string;
    rig_profile: string;
    holosuit_profile: string;
    hologram_profile: string;
  };
  face_blendshape_map: Record<string, string>;
  hand_map: Record<string, string>;
  quality_report: string;
  stageos_ready: boolean;
  created_at: string;
}

// ─── Character Variant ────────────────────────────────────────────────────────

export type VariantType = 'hero' | 'live_hologram' | 'web_preview';

export interface CharacterVariant {
  type: VariantType;
  label: string;
  description: string;
  use_case: string[];
  glb_url?: string;
  fbx_url?: string;
  polygon_count: number;
  texture_resolution: string;
  file_size_mb: number;
  ready: boolean;
}

// ─── Wizard Step ──────────────────────────────────────────────────────────────

export type ForgeStep =
  | 'upload'
  | 'analyzing'
  | 'base_selection'
  | 'morph_editor'
  | 'texture_hair'
  | 'rig_validation'
  | 'holosuit'
  | 'quality'
  | 'variants'
  | 'export';

export const FORGE_STEPS: Array<{ id: ForgeStep; label: string; description: string }> = [
  { id: 'upload',        label: 'Referencias',    description: 'Sube fotos del artista' },
  { id: 'analyzing',     label: 'Análisis IA',    description: 'Analiza rostro y cuerpo' },
  { id: 'base_selection',label: 'Base Model',     description: 'Selecciona modelo CC4' },
  { id: 'morph_editor',  label: 'Morphing',       description: 'Personaliza proporciones' },
  { id: 'texture_hair',  label: 'Look',           description: 'Textura, cabello, ropa' },
  { id: 'rig_validation',label: 'Rig Check',      description: 'Valida estructura técnica' },
  { id: 'holosuit',        label: 'HoloSuit',         description: 'MoCap compatibility' },
  { id: 'quality',       label: 'Quality Score',  description: 'Reporte técnico' },
  { id: 'variants',      label: 'Variantes',      description: 'Hero / Live / Web' },
  { id: 'export',        label: 'StageOS Export', description: 'Enviar a StageOS' },
];
