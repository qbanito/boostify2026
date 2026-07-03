/**
 * OpenMontage → Boostify Timeline importer
 *
 * Convierte artefactos JSON del sistema open-source OpenMontage
 * (https://github.com/calesthio/OpenMontage) en TimelineClip[] compatibles
 * con el editor de timeline de music video.
 *
 * IMPORTANTE (licencia): OpenMontage es AGPL-3.0. Este módulo NO copia código
 * de ese proyecto — únicamente lee sus formatos de datos JSON públicos
 * (schemas/artifacts/*.schema.json) y los mapea a nuestras interfaces propias.
 *
 * Artefactos soportados:
 *  - scene_plan   → { version, scenes: [{ id, type, description, start_seconds, end_seconds, ... }] }
 *  - edit_decisions → { version, cuts: [{ id, source, in_seconds, out_seconds, speed, layer, ... }], audio, overlays }
 *  - asset_manifest → { version, assets: [{ id, type, path, scene_id, duration_seconds, original_url, ... }] }
 *
 * El importador es 100% aditivo y defensivo: nunca lanza (retorna warnings),
 * y no toca ningún estado del editor — solo produce clips nuevos.
 */

import { TimelineClip, ClipType } from '@/interfaces/timeline';

// ── Tipos de entrada (estructuras OpenMontage, definidas aquí de forma laxa) ──

interface OMScene {
  id?: string;
  type?: string;
  description?: string;
  start_seconds?: number;
  end_seconds?: number;
  framing?: string;
  transition_in?: string;
  transition_out?: string;
  shot_language?: { shot_size?: string; camera_movement?: string; [k: string]: any };
  shot_intent?: string;
  narrative_role?: string;
  hero_moment?: boolean;
  [k: string]: any;
}

interface OMCut {
  id?: string;
  source?: string;
  in_seconds?: number;
  out_seconds?: number;
  speed?: number;
  layer?: 'primary' | 'overlay' | 'background' | string;
  transition_in?: string;
  transition_out?: string;
  transition_duration?: number;
  transform?: { scale?: number; [k: string]: any };
  reason?: string;
  [k: string]: any;
}

interface OMAsset {
  id?: string;
  type?: string;
  path?: string;
  scene_id?: string;
  duration_seconds?: number;
  original_url?: string;
  prompt?: string;
  provider?: string;
  [k: string]: any;
}

export interface OpenMontageImportResult {
  clips: TimelineClip[];
  warnings: string[];
  detectedArtifacts: string[]; // p.ej. ['edit_decisions', 'asset_manifest']
  totalDuration: number;       // fin del último clip importado (segundos)
}

export interface OpenMontageImportOptions {
  /** Primer id numérico a asignar (los ids del timeline son number) */
  nextClipId: number;
  /** Mapa nombre-de-archivo (basename, lowercase) → URL utilizable (blob/https) */
  mediaByName?: Map<string, { url: string; mimeType: string }>;
  /** Offset en segundos donde empezar a colocar los clips (default 0) */
  startOffset?: number;
}

// ── Helpers ──

const num = (v: any, fallback = 0): number =>
  typeof v === 'number' && isFinite(v) ? v : fallback;

const basename = (p: string): string => {
  const clean = String(p).split(/[?#]/)[0];
  const parts = clean.split(/[\\/]/);
  return (parts[parts.length - 1] || '').toLowerCase();
};

const isHttpUrl = (s: string | undefined): boolean =>
  typeof s === 'string' && /^https?:\/\//i.test(s);

const guessMediaKind = (
  pathOrUrl: string,
  mimeType?: string
): 'image' | 'video' | 'audio' | null => {
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
  }
  const ext = basename(pathOrUrl).split('.').pop() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
  return null;
};

/** Mapea el campo `type` de un asset del manifest a un tipo de media */
const assetTypeToKind = (t?: string): 'image' | 'video' | 'audio' | null => {
  if (t === 'image' || t === 'diagram') return 'image';
  if (t === 'video' || t === 'animation') return 'video';
  if (t === 'audio' || t === 'narration' || t === 'music' || t === 'sfx') return 'audio';
  return null;
};

/** Detecta qué artefacto OpenMontage es un JSON parseado (o null si no lo es) */
export function detectOpenMontageArtifact(
  doc: any
): 'scene_plan' | 'edit_decisions' | 'asset_manifest' | null {
  if (!doc || typeof doc !== 'object') return null;
  if (Array.isArray(doc.cuts)) return 'edit_decisions';
  if (Array.isArray(doc.scenes)) return 'scene_plan';
  if (Array.isArray(doc.assets)) return 'asset_manifest';
  return null;
}

// ── Resolución de assets ──

class AssetResolver {
  private byId = new Map<string, OMAsset>();
  private bySceneId = new Map<string, OMAsset[]>();

  constructor(
    manifests: any[],
    private mediaByName: Map<string, { url: string; mimeType: string }>
  ) {
    for (const m of manifests) {
      const assets: OMAsset[] = Array.isArray(m?.assets) ? m.assets : [];
      for (const a of assets) {
        if (a?.id) this.byId.set(String(a.id), a);
        if (a?.scene_id) {
          const list = this.bySceneId.get(String(a.scene_id)) || [];
          list.push(a);
          this.bySceneId.set(String(a.scene_id), list);
        }
      }
    }
  }

  /** Resuelve una referencia (asset id o ruta) a URL + tipo de media */
  resolveRef(ref: string | undefined): {
    url?: string;
    kind: 'image' | 'video' | 'audio' | null;
    asset?: OMAsset;
  } {
    if (!ref) return { kind: null };
    const asset = this.byId.get(String(ref));
    const path = asset?.path || String(ref);
    const assetKind = assetTypeToKind(asset?.type);

    // 1) archivo local seleccionado por el usuario (match por basename)
    const local = this.mediaByName.get(basename(path));
    if (local) return { url: local.url, kind: guessMediaKind(path, local.mimeType) ?? assetKind, asset };

    // 2) URL http(s) directa (ruta o original_url del manifest)
    if (isHttpUrl(path)) return { url: path, kind: guessMediaKind(path) ?? assetKind, asset };
    if (isHttpUrl(asset?.original_url)) {
      return { url: asset!.original_url, kind: guessMediaKind(asset!.original_url!) ?? assetKind, asset };
    }

    // 3) sin media utilizable — devolvemos el tipo inferido para placeholder
    return { kind: guessMediaKind(path) ?? assetKind, asset };
  }

  /** Primer asset visual asociado a una escena del scene_plan */
  resolveScene(sceneId: string | undefined): {
    url?: string;
    kind: 'image' | 'video' | 'audio' | null;
    asset?: OMAsset;
  } {
    if (!sceneId) return { kind: null };
    const assets = this.bySceneId.get(String(sceneId)) || [];
    const visual = assets.find((a) => ['image', 'video', 'diagram', 'animation'].includes(String(a.type)));
    if (!visual?.path && !visual?.original_url) return { kind: null };
    return this.resolveRef(visual.id || visual.path);
  }
}

// ── Conversores ──

function convertEditDecisions(
  doc: any,
  resolver: AssetResolver,
  idRef: { next: number },
  startOffset: number,
  warnings: string[]
): TimelineClip[] {
  const clips: TimelineClip[] = [];
  const cuts: OMCut[] = Array.isArray(doc.cuts) ? doc.cuts : [];
  let cursor = startOffset;

  for (let i = 0; i < cuts.length; i++) {
    const cut = cuts[i] || {};
    const inSec = Math.max(0, num(cut.in_seconds));
    const outSec = num(cut.out_seconds);
    const speed = num(cut.speed, 1) > 0 ? num(cut.speed, 1) : 1;
    const srcDuration = outSec - inSec;

    if (!(srcDuration > 0)) {
      warnings.push(`Cut "${cut.id || i}" ignorado: out_seconds <= in_seconds`);
      continue;
    }
    const timelineDuration = srcDuration / speed;
    const { url, kind } = resolver.resolveRef(cut.source);

    // Si hay URL pero el tipo es desconocido (URL sin extensión), asumimos imagen
    const effectiveKind = kind ?? (url ? 'image' : null);
    const clipType =
      effectiveKind === 'video' ? ClipType.VIDEO
      : effectiveKind === 'image' ? ClipType.IMAGE
      : ClipType.PLACEHOLDER;

    if (!url) {
      warnings.push(
        `Cut "${cut.id || i}": no se encontró el media "${cut.source || '?'}" — importado como placeholder`
      );
    }

    const clip: TimelineClip = {
      id: idRef.next++,
      layerId: 1, // capa visual del editor
      type: clipType,
      start: cursor,
      duration: timelineDuration,
      url,
      imageUrl: clipType === ClipType.IMAGE ? url : undefined,
      title: cut.id ? `OM · ${cut.id}` : `OM cut ${i + 1}`,
      sourceStart: inSec,
      in: inSec,
      out: outSec,
      scale: cut.transform?.scale && num(cut.transform.scale, 1) !== 1 ? num(cut.transform.scale, 1) : undefined,
      transition: cut.transition_in
        ? { type: String(cut.transition_in), duration: Math.max(0, num(cut.transition_duration, 0.5)) }
        : undefined,
      metadata: {
        source: 'openmontage',
        artifact: 'edit_decisions',
        omCutId: cut.id,
        omSource: cut.source,
        speed,
        layer: cut.layer || 'primary',
        reason: cut.reason,
        transitionOut: cut.transition_out,
        importedAt: new Date().toISOString(),
      },
    };
    clips.push(clip);
    cursor += timelineDuration;
  }

  // Audio: narración + música (capa 2)
  const audio = doc.audio || {};
  const narrationSegments: any[] = audio?.narration?.segments || [];
  for (const seg of narrationSegments) {
    const { url, asset } = resolver.resolveRef(seg?.asset_id);
    const segStart = startOffset + Math.max(0, num(seg?.start_seconds));
    const segEnd = num(seg?.end_seconds);
    const segDuration = segEnd > segStart - startOffset
      ? segEnd - (segStart - startOffset)
      : num(asset?.duration_seconds, 5);
    if (!url) {
      warnings.push(`Narración "${seg?.asset_id || '?'}": media no encontrado — omitida`);
      continue;
    }
    clips.push({
      id: idRef.next++,
      layerId: 2,
      type: ClipType.AUDIO,
      start: segStart,
      duration: Math.max(0.25, segDuration),
      url,
      title: `OM · narración ${seg?.asset_id || ''}`.trim(),
      volume: 1,
      metadata: { source: 'openmontage', artifact: 'edit_decisions', role: 'narration', omAssetId: seg?.asset_id },
    });
  }

  const music = audio?.music || doc.music;
  if (music?.asset_id) {
    const { url, asset } = resolver.resolveRef(music.asset_id);
    if (url) {
      const totalVisual = cursor - startOffset;
      clips.push({
        id: idRef.next++,
        layerId: 2,
        type: ClipType.AUDIO,
        start: startOffset,
        duration: Math.max(1, num(asset?.duration_seconds, totalVisual || 30)),
        url,
        title: 'OM · música',
        volume: Math.min(1, Math.max(0, num(music.volume, 0.6))),
        metadata: { source: 'openmontage', artifact: 'edit_decisions', role: 'music', omAssetId: music.asset_id },
      });
    } else {
      warnings.push(`Música "${music.asset_id}": media no encontrado — omitida`);
    }
  }

  return clips;
}

function convertScenePlan(
  doc: any,
  resolver: AssetResolver,
  idRef: { next: number },
  startOffset: number,
  warnings: string[]
): TimelineClip[] {
  const clips: TimelineClip[] = [];
  const scenes: OMScene[] = Array.isArray(doc.scenes) ? doc.scenes : [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i] || {};
    const start = startOffset + Math.max(0, num(scene.start_seconds));
    const end = startOffset + num(scene.end_seconds);
    const sceneDuration = end - start;
    if (!(sceneDuration > 0)) {
      warnings.push(`Escena "${scene.id || i}" ignorada: end_seconds <= start_seconds`);
      continue;
    }

    const sceneType = String(scene.type || '');
    if (sceneType === 'transition') continue; // las transiciones van en clip.transition, no como clips propios

    const { url, kind } = resolver.resolveScene(scene.id);
    const isText = sceneType === 'text_card';
    const effectiveKind = kind ?? (url ? 'image' : null);

    const clipType = isText
      ? ClipType.TEXT
      : effectiveKind === 'video' ? ClipType.VIDEO
      : effectiveKind === 'image' ? ClipType.IMAGE
      : ClipType.PLACEHOLDER;

    const shotCategory: TimelineClip['shotCategory'] =
      sceneType === 'broll' ? 'B-ROLL'
      : sceneType === 'talking_head' ? 'PERFORMANCE'
      : 'STORY';

    clips.push({
      id: idRef.next++,
      layerId: 1,
      type: clipType,
      start,
      duration: sceneDuration,
      url,
      imageUrl: clipType === ClipType.IMAGE ? url : undefined,
      text: isText ? String(scene.description || '') : undefined,
      title: scene.id ? `OM · ${scene.id}` : `OM escena ${i + 1}`,
      shotCategory,
      shotType: scene.shot_language?.shot_size,
      transition: scene.transition_in
        ? { type: String(scene.transition_in), duration: 0.5 }
        : undefined,
      metadata: {
        source: 'openmontage',
        artifact: 'scene_plan',
        omSceneId: scene.id,
        omSceneType: sceneType,
        description: scene.description,
        framing: scene.framing,
        shotIntent: scene.shot_intent,
        narrativeRole: scene.narrative_role,
        heroMoment: scene.hero_moment === true,
        shotLanguage: scene.shot_language,
        transitionOut: scene.transition_out,
        importedAt: new Date().toISOString(),
      },
    });

    if (clipType === ClipType.PLACEHOLDER) {
      warnings.push(
        `Escena "${scene.id || i}": sin asset asociado — importada como placeholder (${scene.description ? String(scene.description).slice(0, 60) : 'sin descripción'})`
      );
    }
  }

  return clips;
}

// ── Entrada principal ──

/**
 * Importa un proyecto OpenMontage a partir de sus JSON parseados.
 *
 * Prioridad: si hay edit_decisions se usa como timeline visual (es el corte
 * final); el scene_plan solo se usa cuando NO hay edit_decisions. Los
 * asset_manifest siempre se usan para resolver rutas → URLs.
 */
export function importOpenMontageProject(
  docs: any[],
  options: OpenMontageImportOptions
): OpenMontageImportResult {
  const warnings: string[] = [];
  const detectedArtifacts: string[] = [];
  const startOffset = Math.max(0, options.startOffset ?? 0);
  const idRef = { next: Math.max(1, Math.floor(options.nextClipId)) };
  const mediaByName = options.mediaByName ?? new Map();

  const scenePlans: any[] = [];
  const editDecisions: any[] = [];
  const manifests: any[] = [];

  for (const doc of docs) {
    const kind = detectOpenMontageArtifact(doc);
    if (!kind) {
      warnings.push('Un JSON no coincide con ningún artefacto OpenMontage conocido — ignorado');
      continue;
    }
    detectedArtifacts.push(kind);
    if (kind === 'scene_plan') scenePlans.push(doc);
    else if (kind === 'edit_decisions') editDecisions.push(doc);
    else manifests.push(doc);
  }

  const resolver = new AssetResolver(manifests, mediaByName);
  let clips: TimelineClip[] = [];

  try {
    if (editDecisions.length > 0) {
      for (const doc of editDecisions) {
        clips = clips.concat(convertEditDecisions(doc, resolver, idRef, startOffset, warnings));
      }
      if (scenePlans.length > 0) {
        warnings.push('scene_plan detectado pero se usó edit_decisions (corte final) como timeline');
      }
    } else if (scenePlans.length > 0) {
      for (const doc of scenePlans) {
        clips = clips.concat(convertScenePlan(doc, resolver, idRef, startOffset, warnings));
      }
    } else if (manifests.length > 0) {
      warnings.push('Solo se encontró asset_manifest — añade scene_plan.json o edit_decisions.json para construir el timeline');
    }
  } catch (err) {
    // Nunca romper el editor: cualquier error inesperado se degrada a warning
    warnings.push(`Error procesando artefactos: ${err instanceof Error ? err.message : String(err)}`);
  }

  const totalDuration = clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
  return { clips, warnings, detectedArtifacts, totalDuration };
}
