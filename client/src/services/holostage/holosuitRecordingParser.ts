// ─── HoloSuit Recording Parser ──────────────────────────────────────────────────
// Parses HoloSuit Studio .srec_meta files (text-based binary format)
// discovered in: StreamingAssets/Studio/DefaultRecordings/
//
// Format: key-value pairs, "object"/"endobject" blocks, "list"/"endlist" blocks
// Actor name field: "actorName:C2J"
// Filter: GaitPhaseLockFilter with BezierFrame keyframe curves
//
// Used for: offline playback, recording metadata display, BVH pre-processing

import type { HoloSuitRecordingMeta, HoloSuitRecordingFilter, HoloSuitBezierFrame } from './holosuitStreamingProtocol';
import { HOLOSUIT_DEFAULT_RECORDINGS, type HoloSuitDefaultRecordingName } from './holosuitStreamingProtocol';

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseHoloSuitMeta(raw: string): HoloSuitRecordingMeta {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const meta: HoloSuitRecordingMeta = {
    filename: '',
    hasBody: true,
    hasFace: false,
    hasHands: false,
    filters: [],
    regions: [],
  };

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('field:actorName:')) {
      meta.actorName = line.replace('field:actorName:', '');
    }

    if (line.startsWith('Fullname:HoloSuit.HoloSuit.Studio.Filters.GaitPhaseLockFilter')) {
      // Parse filter block
      const filter = parseFilterBlock(lines, i);
      meta.filters.push(filter.filter);
      i = filter.nextIndex;
      continue;
    }

    // Detect face capture from recording name hint (FaceCap.srec)
    if (line.includes('FaceCap')) {
      meta.hasFace = true;
    }

    i++;
  }

  return meta;
}

function parseFilterBlock(
  lines: string[],
  startIndex: number
): { filter: HoloSuitRecordingFilter; nextIndex: number } {
  const filter: HoloSuitRecordingFilter = {
    filterType: 'GaitPhaseLockFilter',
    actorName: '',
    active: true,
    curves: [],
  };

  let i = startIndex;
  let currentCurveFrames: HoloSuitBezierFrame[] | null = null;
  let inCurve = false;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('field:actorName:')) {
      filter.actorName = line.replace('field:actorName:', '');
    } else if (line.startsWith('field:active:')) {
      filter.active = line.replace('field:active:', '') !== 'False';
    } else if (line === 'list:curves') {
      inCurve = true;
    } else if (line === 'endlist' && inCurve) {
      inCurve = false;
      break;
    } else if (line === 'list:keys' && inCurve) {
      currentCurveFrames = [];
    } else if (line === 'endlist' && currentCurveFrames) {
      filter.curves.push(currentCurveFrames);
      currentCurveFrames = null;
    } else if (currentCurveFrames) {
      // Parse BezierFrame fields
      const timeMatch = line.match(/^field:time:(.+)$/);
      const valueMatch = line.match(/^field:value:(.+)$/);
      if (timeMatch) {
        const frame: HoloSuitBezierFrame = { time: parseFloat(timeMatch[1]), value: 0 };
        currentCurveFrames.push(frame);
      } else if (valueMatch && currentCurveFrames.length > 0) {
        currentCurveFrames[currentCurveFrames.length - 1].value = parseFloat(valueMatch[1]);
      }
    }

    i++;
  }

  return { filter, nextIndex: i };
}

// ─── Recording Catalog ────────────────────────────────────────────────────────

export interface HoloSuitRecordingInfo {
  name: HoloSuitDefaultRecordingName | string;
  displayName: string;
  category: string;
  hasFace: boolean;
  duration?: number;
  srecPath: string;
  metaPath: string;
  recommendedForBoostify: boolean;
}

export const HOLOSUIT_RECORDING_CATALOG: HoloSuitRecordingInfo[] = HOLOSUIT_DEFAULT_RECORDINGS.map(r => ({
  name: r.name,
  displayName: r.name
    .replace(/([A-Z])/g, ' $1')
    .replace('_Face Cap', ' (FaceCap)')
    .trim(),
  category: r.category,
  hasFace: r.hasFace,
  srecPath: `StreamingAssets/Studio/DefaultRecordings/${r.name}${r.hasFace ? '_FaceCap' : ''}.srec`,
  metaPath: `StreamingAssets/Studio/DefaultRecordings/${r.name}${r.hasFace ? '_FaceCap' : ''}.srec_meta`,
  recommendedForBoostify: r.category === 'music',
}));

// ─── Gait Phase Lock Filter ───────────────────────────────────────────────────
// Reproduces the GaitPhaseLockFilter logic from .srec_meta curves
// Used for foot locking during offline playback.
// The filter uses BezierFrame curves (value=1 = locked, value=0 = free)

export function evaluateGaitPhaseLock(
  filter: HoloSuitRecordingFilter,
  timeSeconds: number
): { leftFootLocked: boolean; rightFootLocked: boolean } {
  const eval_ = (curve: HoloSuitBezierFrame[]): boolean => {
    if (curve.length === 0) return false;
    // Find the most recent keyframe at or before timeSeconds
    let val = curve[0].value;
    for (const frame of curve) {
      if (frame.time <= timeSeconds) val = frame.value;
      else break;
    }
    return val > 0.5;
  };

  return {
    leftFootLocked:  filter.curves[0] ? eval_(filter.curves[0]) : false,
    rightFootLocked: filter.curves[1] ? eval_(filter.curves[1]) : false,
  };
}

// ─── Offline Recording Player ─────────────────────────────────────────────────
// Reads .srec_meta to drive playback parameters (no actual .srec parsing —
// those are Unity binary files, but we use the meta for timing/foot lock)

export class HoloSuitRecordingPlayer {
  private meta: HoloSuitRecordingMeta | null = null;
  private startTime: number | null = null;
  private playing = false;

  load(metaText: string, filename: string): void {
    this.meta = parseHoloSuitMeta(metaText);
    this.meta.filename = filename;
    this.playing = false;
    this.startTime = null;
  }

  play(): void {
    this.startTime = Date.now();
    this.playing = true;
  }

  pause(): void {
    this.playing = false;
  }

  stop(): void {
    this.playing = false;
    this.startTime = null;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getElapsedSeconds(): number {
    if (!this.startTime || !this.playing) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  getFootLockState(): { leftFootLocked: boolean; rightFootLocked: boolean } {
    if (!this.meta || this.meta.filters.length === 0) {
      return { leftFootLocked: false, rightFootLocked: false };
    }
    const t = this.getElapsedSeconds();
    return evaluateGaitPhaseLock(this.meta.filters[0], t);
  }

  getMeta(): HoloSuitRecordingMeta | null {
    return this.meta;
  }
}

export const holosuitRecordingPlayer = new HoloSuitRecordingPlayer();
