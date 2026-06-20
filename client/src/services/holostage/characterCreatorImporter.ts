// ─── Character Creator Importer ───────────────────────────────────────────────
// Multi-format character import: GLB, GLTF, VRM, FBX, OBJ, DAE, USDZ, ZIP
// Natively supported: GLB · GLTF · VRM  (loaded as blob URL)
// Conversion-guided:  FBX · OBJ · DAE · USDZ · ZIP (shows export guide)

import type { CharacterAsset } from '../../schemas/holostage/character.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportFormat = 'glb' | 'gltf' | 'vrm' | 'fbx' | 'obj' | 'dae' | 'usdz' | 'zip' | 'unknown';

export interface ImportResult {
  success: boolean;
  character?: CharacterAsset;
  error?: string;
  warnings?: string[];
}

export interface FormatInfo {
  ext: ImportFormat;
  label: string;
  native: boolean;   // true = can load directly; false = needs conversion
  rigSupport: boolean;
  description: string;
  convertNote?: string;
}

// ─── Format Registry ──────────────────────────────────────────────────────────

export const FORMAT_REGISTRY: Record<string, FormatInfo> = {
  glb: {
    ext: 'glb', label: 'GLB', native: true, rigSupport: true,
    description: 'Binary glTF — full rig, animations, textures embedded',
  },
  gltf: {
    ext: 'gltf', label: 'GLTF', native: true, rigSupport: true,
    description: 'Text glTF — external textures, full rig support',
  },
  vrm: {
    ext: 'vrm', label: 'VRM', native: true, rigSupport: true,
    description: 'VTuber humanoid avatar — VRM blendshapes, spring bones',
  },
  fbx: {
    ext: 'fbx', label: 'FBX', native: false, rigSupport: true,
    description: 'Reallusion CC4 / Mixamo native format',
    convertNote: 'Open in Blender → File → Export → glTF 2.0 (.glb). Or use https://www.gltf.report for quick online conversion.',
  },
  obj: {
    ext: 'obj', label: 'OBJ', native: false, rigSupport: false,
    description: 'Static mesh only — no rig or animations',
    convertNote: 'Open in Blender → add armature → Export as GLB. OBJ has no rig support.',
  },
  dae: {
    ext: 'dae', label: 'Collada', native: false, rigSupport: true,
    description: 'COLLADA format — rig supported but needs conversion',
    convertNote: 'Import in Blender → File → Export → glTF 2.0 (.glb).',
  },
  usdz: {
    ext: 'usdz', label: 'USDZ', native: false, rigSupport: false,
    description: 'Apple AR / USD format — limited rig support',
    convertNote: 'Use Reality Converter (Mac) to convert to .usd then Blender USD importer → Export GLB.',
  },
  zip: {
    ext: 'zip', label: 'ZIP', native: false, rigSupport: true,
    description: 'CC4 export bundle — extract the .glb inside',
    convertNote: 'Open the ZIP and drag the .glb file directly into the upload zone.',
  },
};

export const NATIVE_FORMATS: ImportFormat[] = ['glb', 'gltf', 'vrm'];
export const ACCEPTED_EXTENSIONS = '.glb,.gltf,.vrm,.fbx,.obj,.dae,.usdz,.zip';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function detectFormat(filename: string): ImportFormat {
  const ext = filename.split('.').pop()?.toLowerCase() as ImportFormat | undefined;
  return ext && ext in FORMAT_REGISTRY ? ext : 'unknown';
}

export function getFormatInfo(filename: string): FormatInfo | null {
  const fmt = detectFormat(filename);
  return FORMAT_REGISTRY[fmt] ?? null;
}

/**
 * Detects the rig type from bone names (heuristic).
 */
export function detectRigType(boneNames: string[]): 'humanoid' | 'custom' | 'unknown' {
  const humanoidBones = ['Hips', 'Spine', 'Head', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg'];
  const matchCount = humanoidBones.filter(b => boneNames.some(n => n.includes(b))).length;
  if (matchCount >= 4) return 'humanoid';
  if (boneNames.length > 0) return 'custom';
  return 'unknown';
}

/**
 * Formats file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Core Importers ───────────────────────────────────────────────────────────

/**
 * Import a character from a local File.
 * Natively handles GLB / GLTF / VRM.
 * Returns an informative error with conversion guide for FBX / OBJ / DAE / USDZ / ZIP.
 */
export async function importGLBFromFile(file: File): Promise<ImportResult> {
  try {
    const format = detectFormat(file.name);
    const info = FORMAT_REGISTRY[format];

    if (!info) {
      return {
        success: false,
        error: `Formato desconocido. Soportados nativamente: GLB, GLTF, VRM. Para FBX/OBJ/DAE convierte a GLB primero.`,
      };
    }

    if (!info.native) {
      return {
        success: false,
        error: `${info.label} necesita conversión a GLB. ${info.convertNote ?? ''}`,
        warnings: ['conversion_needed'],
      };
    }

    if (file.size > 200 * 1024 * 1024) {
      return { success: false, error: 'El archivo supera el límite de 200 MB' };
    }

    const objectUrl = URL.createObjectURL(file);
    const name = file.name.replace(/\.(glb|gltf|vrm)$/i, '');

    const isVRM = format === 'vrm';
    const warnings: string[] = isVRM
      ? ['VRM detectado: blendshapes VTuber activos. Spring bones pueden requerir ajuste manual.']
      : [];

    const character: CharacterAsset = {
      id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      glbUrl: objectUrl,
      fileSize: file.size,
      importedAt: new Date().toISOString(),
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1.0,
      },
      idleAnimation: 'idle',
      availableAnimations: ['idle'],
      rigType: isVRM ? 'humanoid' : 'unknown',
      source: isVRM ? 'vrm' : 'local',
      format,
    };

    return { success: true, character, warnings };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Import a character from a remote URL.
 * Supports ReadyPlayerMe shortcodes: "rpm:{id}" → full GLB URL.
 */
export async function importGLBFromURL(url: string, name: string): Promise<ImportResult> {
  try {
    let resolvedUrl = url.trim();
    let source: CharacterAsset['source'] = 'url';
    let format: CharacterAsset['format'] = 'glb';

    // ReadyPlayerMe shortcode: rpm:{id} or full RPM URL
    if (resolvedUrl.startsWith('rpm:')) {
      const id = resolvedUrl.slice(4).trim();
      resolvedUrl = `https://models.readyplayer.me/${id}.glb`;
      source = 'readyplayerme';
    } else if (resolvedUrl.includes('models.readyplayer.me')) {
      source = 'readyplayerme';
      if (!resolvedUrl.endsWith('.glb')) resolvedUrl += '.glb';
    } else if (resolvedUrl.includes('hub.vroid.com')) {
      source = 'vroid';
      format = 'vrm';
    } else if (resolvedUrl.includes('mixamo.com')) {
      source = 'mixamo';
    }

    // Basic URL validation
    try { new URL(resolvedUrl); } catch {
      return { success: false, error: 'URL inválida. Ingresa una URL completa (https://...)' };
    }

    const detectedFmt = detectFormat(resolvedUrl);
    if (detectedFmt !== 'unknown') format = detectedFmt;

    const character: CharacterAsset = {
      id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || 'Remote Character',
      glbUrl: resolvedUrl,
      importedAt: new Date().toISOString(),
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1.0,
      },
      idleAnimation: 'idle',
      availableAnimations: ['idle'],
      rigType: ['readyplayerme', 'vroid'].includes(source) ? 'humanoid' : 'unknown',
      source,
      format,
    };

    return { success: true, character };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Releases object URLs for local characters to avoid memory leaks.
 */
export function releaseCharacterAsset(character: CharacterAsset): void {
  if (
    (character.source === 'local' || character.source === 'vrm') &&
    character.glbUrl.startsWith('blob:')
  ) {
    URL.revokeObjectURL(character.glbUrl);
  }
}
