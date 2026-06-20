// ─── Character Schema ─────────────────────────────────────────────────────────
// Defines the CharacterAsset loaded from Character Creator (GLB format)

export interface CharacterPosition {
  x: number;
  y: number;
  z: number;
}

export interface CharacterTransform {
  position: CharacterPosition;
  rotation: CharacterPosition;
  scale: number;
}

export interface CharacterAsset {
  id: string;
  name: string;
  glbUrl: string;
  thumbnailUrl?: string;
  fileSize?: number;       // bytes
  importedAt: string;      // ISO date
  transform: CharacterTransform;
  idleAnimation: string;
  availableAnimations: string[];
  rigType: 'humanoid' | 'custom' | 'unknown';
  polyCount?: number;
  textureCount?: number;
  blendshapes?: string[];
  source: 'character_creator' | 'local' | 'demo' | 'url' | 'vrm' | 'readyplayerme' | 'vroid' | 'mixamo';
  format?: 'glb' | 'gltf' | 'vrm' | 'fbx' | 'obj' | 'dae' | 'usdz';
  metadata?: Record<string, unknown>;
}

export const DEMO_CHARACTER: CharacterAsset = {
  id: 'demo-character-001',
  name: 'Hologram Artist (Demo)',
  glbUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
  importedAt: new Date().toISOString(),
  transform: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1.0,
  },
  idleAnimation: 'idle',
  availableAnimations: ['idle', 'walk', 'dance', 'jump', 'wave', 'bow'],
  rigType: 'humanoid',
  polyCount: 12500,
  textureCount: 4,
  blendshapes: ['smile', 'surprise', 'angry', 'blink_l', 'blink_r'],
  source: 'demo',
};
