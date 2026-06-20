/**
 * useTimelineEngine - Professional Timeline Engine Hook
 * 
 * Core engine for NLE-grade timeline operations.
 * Inspired by Adobe Premiere Pro / DaVinci Resolve workflows.
 * 
 * Features:
 * - Unified snap system (move, resize, split) with visual indicators
 * - Overlap detection & prevention
 * - Ripple edit mode (shift subsequent clips)
 * - Roll trim mode (adjust edit point between two adjacent clips)
 * - Slip edit (move source in/out without changing timeline position)
 * - Slide edit (move clip between neighbors)
 * - Magnetic snap to: beats, sections, clip edges, playhead, markers
 * - Multi-track razor (cut through all visible tracks)
 * - Professional undo/redo with operation descriptors
 * - Frame-accurate snapping
 * 
 * BOOSTIFY 2025 - Professional Timeline Engine
 */

import { useCallback, useRef, useState, useMemo } from 'react';
import type { TimelineClip } from '@/interfaces/timeline';

// ============================================================================
// TYPES
// ============================================================================

/** Snap target types for visual indicators */
export type SnapTargetType = 
  | 'beat' 
  | 'section' 
  | 'clip-start' 
  | 'clip-end' 
  | 'playhead' 
  | 'marker' 
  | 'timeline-start' 
  | 'timeline-end'
  | 'frame';

/** Snap result with visual indicator data */
export interface SnapResult {
  /** The snapped time value */
  time: number;
  /** Whether snap was applied */
  didSnap: boolean;
  /** The type of target snapped to */
  targetType?: SnapTargetType;
  /** The original unsnapped time */
  originalTime: number;
  /** Delta between original and snapped */
  delta: number;
}

/** Edit modes for professional NLE workflow */
export type EditMode = 
  | 'normal'      // Standard move/resize
  | 'ripple'      // Shift subsequent clips when editing
  | 'roll'        // Adjust edit point between adjacent clips
  | 'slip'        // Move source window without changing timeline position
  | 'slide';      // Move clip between neighbors, adjusting them

/** Tool modes */
export type ToolMode = 'select' | 'razor' | 'trim' | 'hand';

/** Operation types for undo/redo descriptors */
export type OperationType = 
  | 'move' 
  | 'resize-start' 
  | 'resize-end' 
  | 'split' 
  | 'delete' 
  | 'ripple-delete'
  | 'duplicate' 
  | 'paste' 
  | 'razor-all'
  | 'roll-trim'
  | 'slip'
  | 'slide'
  | 'add'
  | 'multi-move'
  | 'multi-delete';

/** History entry with operation descriptor */
export interface HistoryEntry {
  clips: TimelineClip[];
  operation: OperationType;
  description: string;
  timestamp: number;
}

/** Overlap detection result */
export interface OverlapInfo {
  hasOverlap: boolean;
  overlappingClipIds: number[];
  /** Nearest valid position that avoids overlap */
  nearestValidStart?: number;
}

/** Configuration for the timeline engine */
export interface TimelineEngineConfig {
  /** Pixels per second */
  zoom: number;
  /** Total timeline duration in seconds */
  duration: number;
  /** Snap threshold in pixels */
  snapThresholdPx: number;
  /** Whether snapping is enabled */
  snapEnabled: boolean;
  /** Edit mode */
  editMode: EditMode;
  /** Maximum clip duration (seconds) */
  maxClipDuration: number;
  /** Minimum clip duration (seconds) */
  minClipDuration: number;
  /** Framerate for frame-accurate operations */
  framerate: number;
  /** Beat positions (seconds) for musical snap */
  beatGuides: number[];
  /** Section positions (seconds) for structural snap */
  sectionGuides: number[];
  /** Marker positions (seconds) */
  markerPositions: number[];
  /** Current playhead position */
  currentTime: number;
  /** Whether to prevent clip overlaps on the same layer */
  preventOverlap: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: TimelineEngineConfig = {
  zoom: 120,
  duration: 60,
  snapThresholdPx: 8,
  snapEnabled: true,
  editMode: 'normal',
  maxClipDuration: 6,
  minClipDuration: 0.1,
  framerate: 30,
  beatGuides: [],
  sectionGuides: [],
  markerPositions: [],
  currentTime: 0,
  preventOverlap: true,
};

const MAX_HISTORY_SIZE = 100;

// ============================================================================
// SNAP ENGINE
// ============================================================================

/**
 * Universal snap function that works for move, resize, and split operations.
 * Returns snap result with visual indicator data.
 */
function calculateSnap(
  time: number,
  config: TimelineEngineConfig,
  clips: TimelineClip[],
  excludeClipId?: number,
  excludeClipIds?: Set<number>,
): SnapResult {
  if (!config.snapEnabled) {
    return { time, didSnap: false, originalTime: time, delta: 0 };
  }

  const threshold = config.snapThresholdPx / config.zoom;
  let bestSnap = time;
  let bestDist = Infinity;
  let bestType: SnapTargetType | undefined;

  const trySnap = (target: number, type: SnapTargetType) => {
    const dist = Math.abs(time - target);
    if (dist < threshold && dist < bestDist) {
      bestDist = dist;
      bestSnap = target;
      bestType = type;
    }
  };

  // 1. Snap to timeline boundaries
  trySnap(0, 'timeline-start');
  trySnap(config.duration, 'timeline-end');

  // 2. Snap to playhead
  trySnap(config.currentTime, 'playhead');

  // 3. Snap to beat guides (musical sync)
  for (const beat of config.beatGuides) {
    trySnap(beat, 'beat');
  }

  // 4. Snap to section guides
  for (const section of config.sectionGuides) {
    trySnap(section, 'section');
  }

  // 5. Snap to markers
  for (const marker of config.markerPositions) {
    trySnap(marker, 'marker');
  }

  // 6. Snap to other clip edges
  for (const clip of clips) {
    if (clip.id === excludeClipId) continue;
    if (excludeClipIds?.has(clip.id)) continue;
    trySnap(clip.start, 'clip-start');
    trySnap(clip.start + clip.duration, 'clip-end');
  }

  // 7. Frame-accurate snap (lowest priority, only if nothing else snapped)
  if (!bestType) {
    const frameSnapped = Math.round(time * config.framerate) / config.framerate;
    if (Math.abs(time - frameSnapped) > 0.0001) {
      bestSnap = frameSnapped;
      bestType = 'frame';
      bestDist = Math.abs(time - frameSnapped);
    }
  }

  const didSnap = bestType !== undefined && bestType !== 'frame';

  return {
    time: bestSnap,
    didSnap,
    targetType: bestType,
    originalTime: time,
    delta: bestSnap - time,
  };
}

// ============================================================================
// OVERLAP DETECTION
// ============================================================================

/**
 * Check if placing a clip at a given position would overlap with other clips
 * on the same layer.
 */
function detectOverlap(
  clipId: number,
  layerId: number,
  start: number,
  duration: number,
  clips: TimelineClip[],
  excludeIds?: Set<number>,
): OverlapInfo {
  const end = start + duration;
  const overlapping: number[] = [];

  for (const other of clips) {
    if (other.id === clipId) continue;
    if (excludeIds?.has(other.id)) continue;
    if (other.layerId !== layerId) continue;

    const otherEnd = other.start + other.duration;
    // Check overlap: two intervals overlap if start < otherEnd AND end > otherStart
    if (start < otherEnd && end > other.start) {
      overlapping.push(other.id);
    }
  }

  if (overlapping.length === 0) {
    return { hasOverlap: false, overlappingClipIds: [] };
  }

  // Find nearest valid position (scan left and right)
  const sameLayerClips = clips
    .filter(c => c.layerId === layerId && c.id !== clipId && !excludeIds?.has(c.id))
    .sort((a, b) => a.start - b.start);

  // Try to find gap that fits this clip
  let nearestValidStart: number | undefined;
  let minDistance = Infinity;

  // Try placing at start of timeline
  const firstClip = sameLayerClips[0];
  if (firstClip && duration <= firstClip.start) {
    const candidate = firstClip.start - duration;
    const dist = Math.abs(start - candidate);
    if (dist < minDistance) {
      minDistance = dist;
      nearestValidStart = Math.max(0, candidate);
    }
  }

  // Try placing between clips
  for (let i = 0; i < sameLayerClips.length - 1; i++) {
    const gapStart = sameLayerClips[i].start + sameLayerClips[i].duration;
    const gapEnd = sameLayerClips[i + 1].start;
    const gapSize = gapEnd - gapStart;

    if (gapSize >= duration) {
      const candidate = gapStart;
      const dist = Math.abs(start - candidate);
      if (dist < minDistance) {
        minDistance = dist;
        nearestValidStart = candidate;
      }
    }
  }

  // Try placing after last clip
  const lastClip = sameLayerClips[sameLayerClips.length - 1];
  if (lastClip) {
    const candidate = lastClip.start + lastClip.duration;
    const dist = Math.abs(start - candidate);
    if (dist < minDistance) {
      nearestValidStart = candidate;
    }
  }

  return {
    hasOverlap: true,
    overlappingClipIds: overlapping,
    nearestValidStart,
  };
}

// ============================================================================
// ADJACENT CLIP FINDER
// ============================================================================

/**
 * Find clips adjacent to a given clip on the same layer (for roll/slip/slide edits)
 */
function findAdjacentClips(
  clipId: number,
  clips: TimelineClip[],
  tolerance: number = 0.05,
): { prev: TimelineClip | null; next: TimelineClip | null } {
  const clip = clips.find(c => c.id === clipId);
  if (!clip) return { prev: null, next: null };

  const sameLayerClips = clips
    .filter(c => c.layerId === clip.layerId && c.id !== clipId)
    .sort((a, b) => a.start - b.start);

  let prev: TimelineClip | null = null;
  let next: TimelineClip | null = null;

  for (const other of sameLayerClips) {
    const otherEnd = other.start + other.duration;
    // Previous: ends at or just before this clip starts
    if (Math.abs(otherEnd - clip.start) <= tolerance) {
      prev = other;
    }
    // Next: starts at or just after this clip ends
    if (Math.abs(other.start - (clip.start + clip.duration)) <= tolerance) {
      next = other;
    }
  }

  return { prev, next };
}

// ============================================================================
// HOOK
// ============================================================================

export function useTimelineEngine(initialConfig?: Partial<TimelineEngineConfig>) {
  // Configuration
  const configRef = useRef<TimelineEngineConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  // History for undo/redo
  const [history, setHistory] = useState<{
    past: HistoryEntry[];
    future: HistoryEntry[];
  }>({ past: [], future: [] });

  // Active snap indicator for visual feedback
  const [activeSnap, setActiveSnap] = useState<SnapResult | null>(null);

  // Track operation in progress
  const operationClipsRef = useRef<TimelineClip[] | null>(null);

  // ====================================================================
  // CONFIG UPDATE
  // ====================================================================
  
  const updateConfig = useCallback((updates: Partial<TimelineEngineConfig>) => {
    configRef.current = { ...configRef.current, ...updates };
  }, []);

  // ====================================================================
  // HISTORY MANAGEMENT
  // ====================================================================

  const pushHistory = useCallback((
    currentClips: TimelineClip[],
    newClips: TimelineClip[],
    operation: OperationType,
    description: string,
  ): TimelineClip[] => {
    setHistory(h => ({
      past: [
        ...h.past.slice(-(MAX_HISTORY_SIZE - 1)),
        {
          clips: currentClips,
          operation,
          description,
          timestamp: Date.now(),
        },
      ],
      future: [], // Clear redo stack on new operation
    }));
    return newClips;
  }, []);

  const undo = useCallback((currentClips: TimelineClip[]): TimelineClip[] | null => {
    let restored: TimelineClip[] | null = null;
    setHistory(h => {
      if (h.past.length === 0) return h;
      const entry = h.past[h.past.length - 1];
      restored = entry.clips;
      return {
        past: h.past.slice(0, -1),
        future: [
          {
            clips: currentClips,
            operation: entry.operation,
            description: `Undo: ${entry.description}`,
            timestamp: Date.now(),
          },
          ...h.future,
        ],
      };
    });
    return restored;
  }, []);

  const redo = useCallback((currentClips: TimelineClip[]): TimelineClip[] | null => {
    let restored: TimelineClip[] | null = null;
    setHistory(h => {
      if (h.future.length === 0) return h;
      const entry = h.future[0];
      restored = entry.clips;
      return {
        past: [
          ...h.past,
          {
            clips: currentClips,
            operation: entry.operation,
            description: `Redo: ${entry.description}`,
            timestamp: Date.now(),
          },
        ],
        future: h.future.slice(1),
      };
    });
    return restored;
  }, []);

  // ====================================================================
  // OPERATION START/END (for drag/resize tracking)
  // ====================================================================

  const beginOperation = useCallback((clips: TimelineClip[]) => {
    operationClipsRef.current = [...clips];
  }, []);

  const endOperation = useCallback((
    currentClips: TimelineClip[],
    operation: OperationType,
    description: string,
  ): boolean => {
    const startClips = operationClipsRef.current;
    operationClipsRef.current = null;
    setActiveSnap(null);

    if (!startClips) return false;

    // Check if anything changed
    const hasChanges = JSON.stringify(startClips) !== JSON.stringify(currentClips);
    if (hasChanges) {
      pushHistory(startClips, currentClips, operation, description);
      return true;
    }
    return false;
  }, [pushHistory]);

  // ====================================================================
  // SNAP (public, for visual indicator during drag)
  // ====================================================================

  const snap = useCallback((
    time: number,
    clips: TimelineClip[],
    excludeClipId?: number,
    excludeClipIds?: Set<number>,
  ): SnapResult => {
    const result = calculateSnap(time, configRef.current, clips, excludeClipId, excludeClipIds);
    if (result.didSnap) {
      setActiveSnap(result);
    } else {
      setActiveSnap(null);
    }
    return result;
  }, []);

  const clearSnap = useCallback(() => {
    setActiveSnap(null);
  }, []);

  // ====================================================================
  // MOVE CLIP
  // ====================================================================

  const moveClip = useCallback((
    clipId: number,
    newStart: number,
    clips: TimelineClip[],
    newLayerId?: number,
  ): TimelineClip[] => {
    const config = configRef.current;
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return clips;

    // Snap
    const snapResult = calculateSnap(newStart, config, clips, clipId);
    let snappedStart = snapResult.time;

    // Clamp to timeline bounds
    // Audio clips: only clamp start >= 0, can extend past timeline end
    const isAudioClip = clip.type === 'AUDIO' || clip.layerId === 2;
    if (isAudioClip) {
      snappedStart = Math.max(0, snappedStart);
    } else {
      snappedStart = Math.max(0, Math.min(config.duration - clip.duration, snappedStart));
    }

    // Frame-accurate
    snappedStart = Math.round(snappedStart * config.framerate) / config.framerate;

    const targetLayerId = newLayerId ?? clip.layerId;

    // Overlap prevention (audio clips exempt — audio can overlap/mix)
    if (config.preventOverlap && !isAudioClip) {
      const overlap = detectOverlap(clipId, targetLayerId, snappedStart, clip.duration, clips);
      if (overlap.hasOverlap && overlap.nearestValidStart !== undefined) {
        snappedStart = overlap.nearestValidStart;
      }
    }

    // Update snap indicator
    if (snapResult.didSnap) {
      setActiveSnap(snapResult);
    } else {
      setActiveSnap(null);
    }

    // Ripple mode: shift subsequent clips
    if (config.editMode === 'ripple') {
      const originalStart = clip.start;
      const delta = snappedStart - originalStart;
      if (delta !== 0) {
        return clips.map(c => {
          if (c.id === clipId) {
            return { ...c, start: snappedStart, layerId: targetLayerId };
          }
          // Shift clips that start after the original position on the same layer
          if (c.layerId === clip.layerId && c.start >= originalStart + clip.duration) {
            return { ...c, start: Math.max(0, c.start + delta) };
          }
          return c;
        });
      }
    }

    return clips.map(c =>
      c.id === clipId
        ? { ...c, start: snappedStart, layerId: targetLayerId }
        : c
    );
  }, []);

  // ====================================================================
  // MOVE MULTIPLE CLIPS
  // ====================================================================

  const moveMultipleClips = useCallback((
    clipIds: Set<number>,
    deltaTime: number,
    clips: TimelineClip[],
  ): TimelineClip[] => {
    const config = configRef.current;

    // Find the reference clip (earliest start among selected)
    const selectedClips = clips.filter(c => clipIds.has(c.id)).sort((a, b) => a.start - b.start);
    if (selectedClips.length === 0) return clips;

    const refClip = selectedClips[0];
    const refNewStart = refClip.start + deltaTime;

    // Snap the reference clip
    const snapResult = calculateSnap(refNewStart, config, clips, undefined, clipIds);
    const adjustedDelta = snapResult.time - refClip.start;

    if (snapResult.didSnap) {
      setActiveSnap(snapResult);
    } else {
      setActiveSnap(null);
    }

    return clips.map(c => {
      if (!clipIds.has(c.id)) return c;
      const newStart = Math.max(0, c.start + adjustedDelta);
      return { ...c, start: Math.round(newStart * config.framerate) / config.framerate };
    });
  }, []);

  // ====================================================================
  // RESIZE CLIP (with snap, overlap prevention, and mode support)
  // ====================================================================

  const resizeClip = useCallback((
    clipId: number,
    newStart: number,
    newDuration: number,
    edge: 'start' | 'end',
    clips: TimelineClip[],
  ): TimelineClip[] => {
    const config = configRef.current;
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return clips;

    let finalStart = newStart;
    let finalDuration = newDuration;

    if (edge === 'start') {
      // Snapping the start edge
      const snapResult = calculateSnap(finalStart, config, clips, clipId);
      if (snapResult.didSnap) {
        const adjustedDuration = clip.start + clip.duration - snapResult.time;
        if (adjustedDuration >= config.minClipDuration) {
          finalStart = snapResult.time;
          finalDuration = adjustedDuration;
          setActiveSnap(snapResult);
        }
      } else {
        setActiveSnap(null);
      }
    } else {
      // Snapping the end edge
      const endTime = finalStart + finalDuration;
      const snapResult = calculateSnap(endTime, config, clips, clipId);
      if (snapResult.didSnap) {
        const adjustedDuration = snapResult.time - finalStart;
        if (adjustedDuration >= config.minClipDuration) {
          finalDuration = adjustedDuration;
          setActiveSnap(snapResult);
        }
      } else {
        setActiveSnap(null);
      }
    }

    // Enforce constraints
    finalStart = Math.max(0, finalStart);
    finalDuration = Math.max(config.minClipDuration, finalDuration);
    
    // Enforce max clip duration (for video generation compatibility)
    // Audio clips are exempt — songs can be minutes long
    const isAudioClip = clip.type === 'AUDIO' || clip.layerId === 2;
    if (!isAudioClip && finalDuration > config.maxClipDuration) {
      if (edge === 'start') {
        finalStart = clip.start + clip.duration - config.maxClipDuration;
        finalDuration = config.maxClipDuration;
      } else {
        finalDuration = config.maxClipDuration;
      }
    }

    // Don't extend past timeline end
    if (finalStart + finalDuration > config.duration) {
      if (edge === 'end') {
        finalDuration = config.duration - finalStart;
      } else {
        finalStart = config.duration - finalDuration;
      }
    }

    // Frame-accurate
    finalStart = Math.round(finalStart * config.framerate) / config.framerate;
    finalDuration = Math.round(finalDuration * config.framerate) / config.framerate;
    finalDuration = Math.max(config.minClipDuration, finalDuration);

    // Overlap prevention during resize
    if (config.preventOverlap) {
      const overlap = detectOverlap(clipId, clip.layerId, finalStart, finalDuration, clips);
      if (overlap.hasOverlap) {
        // Constrain resize to not overlap
        const sameLayerClips = clips
          .filter(c => c.layerId === clip.layerId && c.id !== clipId)
          .sort((a, b) => a.start - b.start);

        if (edge === 'start') {
          // Find the clip just before us
          const prevClip = sameLayerClips
            .filter(c => c.start + c.duration <= clip.start + 0.01)
            .pop();
          if (prevClip) {
            const minStart = prevClip.start + prevClip.duration;
            if (finalStart < minStart) {
              finalDuration = clip.start + clip.duration - minStart;
              finalStart = minStart;
            }
          }
        } else {
          // Find the clip just after us
          const nextClip = sameLayerClips
            .find(c => c.start >= clip.start + clip.duration - 0.01);
          if (nextClip) {
            const maxEnd = nextClip.start;
            if (finalStart + finalDuration > maxEnd) {
              finalDuration = maxEnd - finalStart;
            }
          }
        }
      }
    }

    // Roll trim: when resizing, also adjust the adjacent clip
    if (config.editMode === 'roll') {
      const { prev, next } = findAdjacentClips(clipId, clips);

      if (edge === 'start' && prev) {
        const prevNewDuration = finalStart - prev.start;
        if (prevNewDuration >= config.minClipDuration) {
          return clips.map(c => {
            if (c.id === clipId) {
              return { ...c, start: finalStart, duration: finalDuration };
            }
            if (c.id === prev.id) {
              return { ...c, duration: prevNewDuration };
            }
            return c;
          });
        }
      }

      if (edge === 'end' && next) {
        const clipNewEnd = finalStart + finalDuration;
        const nextNewStart = clipNewEnd;
        const nextNewDuration = (next.start + next.duration) - clipNewEnd;
        if (nextNewDuration >= config.minClipDuration) {
          return clips.map(c => {
            if (c.id === clipId) {
              return { ...c, start: finalStart, duration: finalDuration };
            }
            if (c.id === next.id) {
              return { ...c, start: nextNewStart, duration: nextNewDuration };
            }
            return c;
          });
        }
      }
    }

    // Ripple trim: shift subsequent clips
    if (config.editMode === 'ripple' && edge === 'end') {
      const originalEnd = clip.start + clip.duration;
      const newEnd = finalStart + finalDuration;
      const delta = newEnd - originalEnd;

      if (delta !== 0) {
        return clips.map(c => {
          if (c.id === clipId) {
            return { ...c, start: finalStart, duration: finalDuration };
          }
          if (c.layerId === clip.layerId && c.start >= originalEnd) {
            return { ...c, start: Math.max(0, c.start + delta) };
          }
          return c;
        });
      }
    }

    // Normal resize
    return clips.map(c =>
      c.id === clipId
        ? {
            ...c,
            start: finalStart,
            duration: finalDuration,
            // Update sourceStart for start-edge trimming
            sourceStart: edge === 'start'
              ? (c.sourceStart || 0) + (finalStart - c.start)
              : c.sourceStart,
          }
        : c
    );
  }, []);

  // ====================================================================
  // SPLIT CLIP (Razor)
  // ====================================================================

  const splitClip = useCallback((
    clipId: number,
    splitTime: number,
    clips: TimelineClip[],
  ): { clips: TimelineClip[]; newClipId: number } | null => {
    const config = configRef.current;
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return null;

    // Snap the split point
    const snapResult = calculateSnap(splitTime, config, clips, clipId);
    let finalSplitTime = snapResult.time;

    // Frame-accurate
    finalSplitTime = Math.round(finalSplitTime * config.framerate) / config.framerate;

    const relativeTime = finalSplitTime - clip.start;
    if (relativeTime <= config.minClipDuration || relativeTime >= clip.duration - config.minClipDuration) {
      return null; // Can't split too close to edges
    }

    const newClipId = Math.max(0, ...clips.map(c => c.id)) + 1;

    const rightClip: TimelineClip = {
      ...clip,
      id: newClipId,
      start: clip.start + relativeTime,
      duration: clip.duration - relativeTime,
      sourceStart: (clip.sourceStart || 0) + relativeTime,
      in: (clip.in || 0) + relativeTime,
    };

    const updatedClips = clips.map(c =>
      c.id === clipId
        ? { ...c, duration: relativeTime, out: (c.in || 0) + relativeTime }
        : c
    );

    if (snapResult.didSnap) {
      setActiveSnap(snapResult);
    }

    return {
      clips: [...updatedClips, rightClip],
      newClipId,
    };
  }, []);

  // ====================================================================
  // RAZOR THROUGH ALL TRACKS (like Premiere's Ctrl+Shift+K)
  // ====================================================================

  const razorAllTracks = useCallback((
    splitTime: number,
    clips: TimelineClip[],
    layerIds?: number[],
  ): TimelineClip[] => {
    const config = configRef.current;

    // Frame-accurate
    const finalTime = Math.round(splitTime * config.framerate) / config.framerate;

    let result = [...clips];
    let nextId = Math.max(0, ...clips.map(c => c.id)) + 1;

    // Find all clips that span the split time
    const clipsToSplit = clips.filter(c => {
      if (layerIds && !layerIds.includes(c.layerId)) return false;
      return finalTime > c.start + config.minClipDuration &&
             finalTime < c.start + c.duration - config.minClipDuration;
    });

    for (const clip of clipsToSplit) {
      const relativeTime = finalTime - clip.start;

      const rightClip: TimelineClip = {
        ...clip,
        id: nextId++,
        start: clip.start + relativeTime,
        duration: clip.duration - relativeTime,
        sourceStart: (clip.sourceStart || 0) + relativeTime,
      };

      result = result.map(c =>
        c.id === clip.id
          ? { ...c, duration: relativeTime }
          : c
      );
      result.push(rightClip);
    }

    return result;
  }, []);

  // ====================================================================
  // DELETE CLIP(S)
  // ====================================================================

  const deleteClip = useCallback((
    clipId: number,
    clips: TimelineClip[],
  ): TimelineClip[] => {
    const config = configRef.current;
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return clips;

    const newClips = clips.filter(c => c.id !== clipId);

    // Ripple delete: shift subsequent clips on same layer
    if (config.editMode === 'ripple') {
      return newClips.map(c => {
        if (c.layerId === clip.layerId && c.start > clip.start) {
          return { ...c, start: Math.max(0, c.start - clip.duration) };
        }
        return c;
      });
    }

    return newClips;
  }, []);

  const deleteMultipleClips = useCallback((
    clipIds: Set<number>,
    clips: TimelineClip[],
  ): TimelineClip[] => {
    return clips.filter(c => !clipIds.has(c.id));
  }, []);

  // ====================================================================
  // DUPLICATE CLIP
  // ====================================================================

  const duplicateClip = useCallback((
    clipId: number,
    clips: TimelineClip[],
  ): { clips: TimelineClip[]; newClipId: number } | null => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return null;

    const newClipId = Math.max(0, ...clips.map(c => c.id)) + 1;
    const newClip: TimelineClip = {
      ...clip,
      id: newClipId,
      start: clip.start + clip.duration + 0.05, // Place right after original
    };

    return {
      clips: [...clips, newClip],
      newClipId,
    };
  }, []);

  // ====================================================================
  // SLIP EDIT (move source window, keep timeline position)
  // ====================================================================

  const slipClip = useCallback((
    clipId: number,
    deltaSourceTime: number,
    clips: TimelineClip[],
  ): TimelineClip[] => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return clips;

    const newSourceStart = Math.max(0, (clip.sourceStart || 0) + deltaSourceTime);
    const newIn = Math.max(0, (clip.in || 0) + deltaSourceTime);

    return clips.map(c =>
      c.id === clipId
        ? { ...c, sourceStart: newSourceStart, in: newIn, out: newIn + c.duration }
        : c
    );
  }, []);

  // ====================================================================
  // SLIDE EDIT (move clip between neighbors, adjusting their durations)
  // ====================================================================

  const slideClip = useCallback((
    clipId: number,
    deltaTime: number,
    clips: TimelineClip[],
  ): TimelineClip[] => {
    const config = configRef.current;
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return clips;

    const { prev, next } = findAdjacentClips(clipId, clips);
    if (!prev && !next) return clips; // Need at least one neighbor

    const newStart = clip.start + deltaTime;

    // Check that neighbors can accommodate the slide
    if (prev) {
      const prevNewDuration = newStart - prev.start;
      if (prevNewDuration < config.minClipDuration) return clips;
    }
    if (next) {
      const nextNewStart = newStart + clip.duration;
      const nextNewDuration = (next.start + next.duration) - nextNewStart;
      if (nextNewDuration < config.minClipDuration) return clips;
    }

    return clips.map(c => {
      if (c.id === clipId) {
        return { ...c, start: newStart };
      }
      if (prev && c.id === prev.id) {
        return { ...c, duration: newStart - prev.start };
      }
      if (next && c.id === next.id) {
        const nextNewStart = newStart + clip.duration;
        return {
          ...c,
          start: nextNewStart,
          duration: (next.start + next.duration) - nextNewStart,
        };
      }
      return c;
    });
  }, []);

  // ====================================================================
  // VALIDATION
  // ====================================================================

  const validateClipPlacement = useCallback((
    clip: TimelineClip,
    newStart: number,
    newDuration?: number,
    clips?: TimelineClip[],
  ): { valid: boolean; reason?: string } => {
    const config = configRef.current;
    const duration = newDuration ?? clip.duration;

    if (newStart < 0) return { valid: false, reason: 'Start before timeline beginning' };
    if (newStart + duration > config.duration) return { valid: false, reason: 'Extends beyond timeline end' };
    if (duration < config.minClipDuration) return { valid: false, reason: 'Duration too short' };
    if (duration > config.maxClipDuration) return { valid: false, reason: 'Duration exceeds maximum' };

    if (clips && config.preventOverlap) {
      const overlap = detectOverlap(clip.id, clip.layerId, newStart, duration, clips);
      if (overlap.hasOverlap) return { valid: false, reason: 'Overlaps with existing clip' };
    }

    return { valid: true };
  }, []);

  // ====================================================================
  // RETURN
  // ====================================================================

  return {
    // Config
    updateConfig,
    config: configRef,

    // History
    history,
    pushHistory,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,

    // Operations tracking
    beginOperation,
    endOperation,

    // Snap
    snap,
    activeSnap,
    clearSnap,

    // Clip operations
    moveClip,
    moveMultipleClips,
    resizeClip,
    splitClip,
    razorAllTracks,
    deleteClip,
    deleteMultipleClips,
    duplicateClip,
    slipClip,
    slideClip,

    // Validation
    validateClipPlacement,
    detectOverlap: (clipId: number, layerId: number, start: number, duration: number, clips: TimelineClip[]) =>
      detectOverlap(clipId, layerId, start, duration, clips),
    findAdjacentClips: (clipId: number, clips: TimelineClip[]) =>
      findAdjacentClips(clipId, clips),
  };
}

export default useTimelineEngine;
