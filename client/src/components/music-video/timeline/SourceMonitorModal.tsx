/**
 * SourceMonitorModal — Set In/Out marks on media before adding to timeline
 * Similar to DaVinci Resolve Source Viewer / Premiere Source Monitor
 * 
 * - Drag handles or click to set In (I) and Out (O) points
 * - Shows preview of image/video with marked region
 * - Keyboard shortcuts: I = set in, O = set out, Space = play (video)
 * - "Add to Timeline" sends item with in/out marks
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { MediaItem } from './MediaLibraryPanel';
import { 
  X as XIcon, Play, Pause, SkipBack, SkipForward,
  Film, Music, Image as ImageIcon, Plus as PlusIcon,
  CornerDownLeft, CornerDownRight,
} from 'lucide-react';

export interface InOutMarks {
  inPoint: number;   // seconds
  outPoint: number;  // seconds
  duration: number;  // out - in
}

interface SourceMonitorModalProps {
  item: MediaItem | null;
  onClose: () => void;
  onAddToTimeline: (item: MediaItem, marks: InOutMarks) => void;
  defaultDuration?: number; // default clip duration for images (seconds)
}

const MIN_DURATION = 0.5;
const MAX_DURATION = 30;
const DEFAULT_IMAGE_DURATION = 4;

export function SourceMonitorModal({ item, onClose, onAddToTimeline, defaultDuration }: SourceMonitorModalProps) {
  const maxDur = item?.type === 'video' ? MAX_DURATION : (defaultDuration || DEFAULT_IMAGE_DURATION) * 2;
  const defaultDur = item?.type === 'video' ? 5 : (defaultDuration || DEFAULT_IMAGE_DURATION);

  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(defaultDur);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Reset on item change
  useEffect(() => {
    setInPoint(0);
    setOutPoint(defaultDur);
    setCurrentTime(0);
    setIsPlaying(false);
    setVideoDuration(null);
  }, [item?.id, defaultDur]);

  // Effective total duration for the ruler
  const totalDuration = videoDuration || maxDur;

  // Video time update loop
  useEffect(() => {
    if (!isPlaying || item?.type !== 'video' || !videoRef.current) return;
    const tick = () => {
      if (videoRef.current) {
        const t = videoRef.current.currentTime;
        setCurrentTime(t);
        if (t >= outPoint) {
          videoRef.current.pause();
          setIsPlaying(false);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, outPoint, item?.type]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setInPoint(Math.min(currentTime, outPoint - MIN_DURATION));
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setOutPoint(Math.max(currentTime, inPoint + MIN_DURATION));
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        handleAdd();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const togglePlay = useCallback(() => {
    if (item?.type !== 'video' || !videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (videoRef.current.currentTime < inPoint || videoRef.current.currentTime >= outPoint) {
        videoRef.current.currentTime = inPoint;
      }
      videoRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, inPoint, outPoint, item?.type]);

  const handleAdd = useCallback(() => {
    if (!item) return;
    onAddToTimeline(item, {
      inPoint,
      outPoint,
      duration: outPoint - inPoint,
    });
    onClose();
  }, [item, inPoint, outPoint, onAddToTimeline, onClose]);

  // Ruler click → set current time (video) or adjust out (image)
  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * totalDuration;
    if (item?.type === 'video' && videoRef.current) {
      videoRef.current.currentTime = t;
      setCurrentTime(t);
    }
  }, [totalDuration, item?.type]);

  // Drag in/out handles — supports both mouse and touch
  const handleDrag = useCallback((which: 'in' | 'out', e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ruler = timelineRef.current;
    if (!ruler) return;
    const rect = ruler.getBoundingClientRect();
    const getClientX = (ev: MouseEvent | TouchEvent) =>
      'touches' in ev
        ? ev.touches[0]?.clientX ?? ev.changedTouches[0]?.clientX ?? 0
        : ev.clientX;
    const onMove = (me: MouseEvent | TouchEvent) => {
      if ('touches' in me) me.preventDefault();
      const pct = Math.max(0, Math.min(1, (getClientX(me) - rect.left) / rect.width));
      const t = pct * totalDuration;
      if (which === 'in') {
        setInPoint(Math.max(0, Math.min(t, outPoint - MIN_DURATION)));
      } else {
        setOutPoint(Math.min(totalDuration, Math.max(t, inPoint + MIN_DURATION)));
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [totalDuration, inPoint, outPoint]);

  if (!item) return null;

  const clipDuration = outPoint - inPoint;
  const inPct = (inPoint / totalDuration) * 100;
  const outPct = (outPoint / totalDuration) * 100;
  const curPct = (currentTime / totalDuration) * 100;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm" style={{ zIndex: 99999 }} onClick={onClose}>
      <div 
        className="bg-neutral-900 border border-white/10 rounded-xl shadow-2xl w-[520px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-neutral-950">
          <div className="flex items-center gap-2">
            {item.type === 'image' ? <ImageIcon size={14} className="text-orange-400" /> :
             item.type === 'video' ? <Film size={14} className="text-purple-400" /> :
             <Music size={14} className="text-cyan-400" />}
            <span className="text-sm font-medium text-white/90 truncate max-w-[300px]">{item.name}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <XIcon size={14} className="text-white/50" />
          </button>
        </div>

        {/* Preview Area */}
        <div className="relative bg-black flex items-center justify-center" style={{ height: 280 }}>
          {item.type === 'image' ? (
            <img src={item.url} alt="" className="max-w-full max-h-full object-contain" />
          ) : item.type === 'video' ? (
            <video
              ref={videoRef}
              src={item.url}
              className="max-w-full max-h-full object-contain"
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  const d = videoRef.current.duration;
                  setVideoDuration(d);
                  setOutPoint(Math.min(d, outPoint));
                }
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/40">
              <Music size={40} />
              <span className="text-xs">Audio Preview</span>
            </div>
          )}

          {/* Duration badge */}
          <div className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 rounded text-xs text-orange-400 font-mono">
            {clipDuration.toFixed(1)}s
          </div>
        </div>

        {/* Transport controls (video only) */}
        {item.type === 'video' && (
          <div className="flex items-center justify-center gap-3 py-1.5 bg-neutral-950 border-t border-white/5">
            <button 
              onClick={() => { if (videoRef.current) { videoRef.current.currentTime = inPoint; setCurrentTime(inPoint); } }}
              className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-white" title="Ir a In"
            >
              <SkipBack size={14} />
            </button>
            <button 
              onClick={togglePlay}
              className="p-1.5 bg-orange-500 hover:bg-orange-600 rounded-full text-white transition-colors"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button 
              onClick={() => { if (videoRef.current) { videoRef.current.currentTime = outPoint; setCurrentTime(outPoint); } }}
              className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-white" title="Ir a Out"
            >
              <SkipForward size={14} />
            </button>
          </div>
        )}

        {/* Timeline ruler with In/Out handles */}
        <div className="px-4 py-3 bg-neutral-900 border-t border-white/5">
          <div 
            ref={timelineRef}
            className="relative h-8 bg-neutral-800 rounded cursor-pointer select-none"
            onClick={handleRulerClick}
          >
            {/* Selected region highlight */}
            <div 
              className="absolute top-0 bottom-0 bg-orange-500/20 border-y border-orange-500/40"
              style={{ left: `${inPct}%`, width: `${outPct - inPct}%` }}
            />

            {/* Tick marks */}
            {Array.from({ length: Math.min(20, Math.ceil(totalDuration)) + 1 }).map((_, i) => {
              const t = i * (totalDuration / Math.min(20, Math.ceil(totalDuration)));
              const pct = (t / totalDuration) * 100;
              return (
                <div key={i} className="absolute top-0 flex flex-col items-center" style={{ left: `${pct}%` }}>
                  <div className="w-px h-2 bg-white/15" />
                  {i % 5 === 0 && <span className="text-[7px] text-white/25 mt-0.5">{t.toFixed(1)}s</span>}
                </div>
              );
            })}

            {/* Current time indicator (video) */}
            {item.type === 'video' && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-white/70 z-10"
                style={{ left: `${curPct}%` }}
              />
            )}

            {/* IN handle */}
            <div 
              className="absolute top-0 bottom-0 w-5 sm:w-2.5 cursor-ew-resize z-20 group flex items-center touch-none"
              style={{ left: `calc(${inPct}% - 10px)` }}
              onMouseDown={(e) => handleDrag('in', e)}
              onTouchStart={(e) => handleDrag('in', e)}
            >
              <div className="w-1.5 h-full bg-cyan-400 rounded-l group-hover:bg-cyan-300 transition-colors flex items-center justify-center">
                <CornerDownRight size={8} className="text-neutral-900" />
              </div>
            </div>

            {/* OUT handle */}
            <div 
              className="absolute top-0 bottom-0 w-5 sm:w-2.5 cursor-ew-resize z-20 group flex items-center touch-none"
              style={{ left: `calc(${outPct}% - 10px)` }}
              onMouseDown={(e) => handleDrag('out', e)}
              onTouchStart={(e) => handleDrag('out', e)}
            >
              <div className="w-1.5 h-full bg-red-400 rounded-r group-hover:bg-red-300 transition-colors flex items-center justify-center">
                <CornerDownLeft size={8} className="text-neutral-900" />
              </div>
            </div>
          </div>

          {/* In/Out time display */}
          <div className="flex items-center justify-between mt-1.5 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="text-cyan-400 font-mono">IN: {inPoint.toFixed(1)}s</span>
              <span className="text-white/20">|</span>
              <span className="text-red-400 font-mono">OUT: {outPoint.toFixed(1)}s</span>
              <span className="text-white/20">|</span>
              <span className="text-orange-400 font-mono">DUR: {clipDuration.toFixed(1)}s</span>
            </div>
            <div className="flex items-center gap-1 text-white/30">
              <kbd className="px-1 py-0 bg-neutral-800 rounded text-[8px] border border-white/10">I</kbd>
              <span>In</span>
              <kbd className="px-1 py-0 bg-neutral-800 rounded text-[8px] border border-white/10 ml-1">O</kbd>
              <span>Out</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10 bg-neutral-950">
          <div className="text-[10px] text-white/30">
            Doble-click para ajustar marcas In/Out
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-white/60 hover:text-white/80 hover:bg-white/5 rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded flex items-center gap-1 transition-colors font-medium"
            >
              <PlusIcon size={12} />
              Agregar al Timeline ({clipDuration.toFixed(1)}s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
