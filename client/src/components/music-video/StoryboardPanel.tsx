/**
 * StoryboardPanel — Previsualización visual del video musical
 * Muestra todas las escenas como cards verticales con guión + acciones interactivas
 * Permite retoques de cámara, edición, regeneración y generación de video
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  X, Camera, Pencil, RefreshCw, Film, Music, Wand2,
  ChevronDown, ChevronUp, Eye, LayoutList,
  Play, Loader2, CheckCircle2, AlertCircle, Clock,
  Maximize2, Minimize2, Search, Download,
  Image as ImageIcon, Video as VideoIcon, Sparkles, Zap,
} from 'lucide-react';
import type { TimelineClip } from '@/interfaces/timeline';
import type { ProjectContext } from './timeline/TimelineEditor';

// ============================================
// TYPES
// ============================================
interface StoryboardPanelProps {
  open: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  duration: number;
  aspectRatio: string;
  projectContext?: ProjectContext;
  artistReferenceImages?: string[];
  // Callbacks — reuse existing handlers from TimelineEditor
  onEditImage: (clip: TimelineClip) => void;
  onCameraAngles: (clip: TimelineClip) => void;
  onRegenerateImage: (clip: TimelineClip) => void;
  onGenerateVideo: (clip: TimelineClip) => void;
  onBatchGenerateVideos?: (clips: TimelineClip[], model?: string) => void;
  onAnimatedScene?: (order: number, videoUrl: string) => void;
  conceptProjectId?: number;
  onAddMusician: (clip: TimelineClip) => void;
  onSelectClip: (clipId: number) => void;
  onSeekTo: (time: number) => void;
  // Status tracking
  regeneratingId?: number | null;
  generatingVideoId?: number | null;
}

type FilterMode = 'all' | 'performance' | 'b-roll' | 'story' | 'with-video' | 'no-video';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PERFORMANCE: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  'B-ROLL': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  STORY: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  done: { icon: <CheckCircle2 size={10} />, color: 'text-green-400', label: 'Listo' },
  generating: { icon: <Loader2 size={10} className="animate-spin" />, color: 'text-yellow-400', label: 'Generando...' },
  pending: { icon: <Clock size={10} />, color: 'text-white/40', label: 'Pendiente' },
  error: { icon: <AlertCircle size={10} />, color: 'text-red-400', label: 'Error' },
};

// ============================================
// HELPERS
// ============================================
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getClipCategory(clip: TimelineClip): string {
  return clip.metadata?.shotCategory || clip.shotCategory || 'B-ROLL';
}

function getClipStatus(clip: TimelineClip, regeneratingId?: number | null, generatingVideoId?: number | null): string {
  if (regeneratingId === clip.id || generatingVideoId === clip.id || clip.metadata?.videoGenerating) return 'generating';
  if (clip.metadata?.videoUrl || clip.metadata?.hasVideo) return 'done';
  if (clip.metadata?.videoError || clip.generationStatus === 'error') return 'error';
  if (clip.imageUrl || clip.url) return 'pending'; // Has image, no video yet
  return 'pending';
}

function getClipLyrics(clip: TimelineClip): string {
  return clip.lyricsSegment 
    || clip.metadata?.lyricsSegment 
    || clip.metadata?.lyricConnection 
    || clip.metadata?.narrativeContext 
    || clip.title 
    || '';
}

function getClipPrompt(clip: TimelineClip): string {
  return clip.metadata?.imagePrompt 
    || clip.metadata?.scene_description 
    || clip.metadata?.visualDescription 
    || '';
}

// ============================================
// SCENE CARD COMPONENT
// ============================================
interface SceneCardProps {
  clip: TimelineClip;
  index: number;
  isExpanded: boolean;
  status: string;
  onToggleExpand: () => void;
  onEditImage: () => void;
  onCameraAngles: () => void;
  onRegenerateImage: () => void;
  onGenerateVideo: () => void;
  onAddMusician: () => void;
  onSelect: () => void;
  onSeekTo: () => void;
  onPreview: () => void;
}

const SceneCard: React.FC<SceneCardProps> = React.memo(({
  clip,
  index,
  isExpanded,
  status,
  onToggleExpand,
  onEditImage,
  onCameraAngles,
  onRegenerateImage,
  onGenerateVideo,
  onAddMusician,
  onSelect,
  onSeekTo,
  onPreview,
}) => {
  const category = getClipCategory(clip);
  const catStyle = CATEGORY_COLORS[category] || CATEGORY_COLORS['B-ROLL'];
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const imageUrl = clip.imageUrl || clip.url || clip.thumbnailUrl;
  const videoUrl = clip.metadata?.videoUrl;
  const lyrics = getClipLyrics(clip);
  const prompt = getClipPrompt(clip);
  const shotType = clip.shotType || clip.metadata?.shotType || clip.metadata?.shot_type || '';
  const cameraMove = clip.metadata?.cameraMovement || clip.metadata?.camera_movement || '';

  return (
    <div 
      className={`group relative rounded-lg border transition-all duration-200 hover:border-white/20 ${catStyle.border} bg-white/[0.02] hover:bg-white/[0.04]`}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer"
        onClick={onSeekTo}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono text-white/30 shrink-0">#{String(index + 1).padStart(2, '0')}</span>
          <Badge variant="outline" className={`text-[8px] px-1.5 py-0 h-4 ${catStyle.bg} ${catStyle.text} border-0`}>
            {category}
          </Badge>
          {shotType && (
            <span className="text-[9px] text-white/40 truncate">{shotType}</span>
          )}
          <span className="text-[9px] text-white/25 font-mono shrink-0">
            {formatTime(clip.start)} — {formatTime(clip.start + clip.duration)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`flex items-center gap-0.5 text-[9px] ${statusConfig.color}`}>
            {statusConfig.icon}
          </span>
          {videoUrl && (
            <VideoIcon size={10} className="text-blue-400" />
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="p-0.5 hover:bg-white/10 rounded"
          >
            {isExpanded ? <ChevronUp size={10} className="text-white/40" /> : <ChevronDown size={10} className="text-white/40" />}
          </button>
        </div>
      </div>

      {/* Main content — Image + Script */}
      <div className="flex gap-2 px-3 pb-2">
        {/* Image */}
        <div 
          className="relative shrink-0 rounded-md overflow-hidden cursor-pointer group/img border border-white/10"
          style={{ width: 160, height: 90 }}
          onClick={() => { onSelect(); onPreview(); }}
          title={videoUrl ? 'Reproducir video' : 'Ampliar imagen'}
        >
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={`Scene ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center">
              <ImageIcon size={20} className="text-white/20" />
            </div>
          )}
          {/* Preview overlay indicator */}
          {(videoUrl || imageUrl) && status !== 'generating' && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
              {videoUrl ? <Play size={20} className="text-white" /> : <Eye size={18} className="text-white" />}
            </div>
          )}
          {/* Status overlay */}
          {status === 'generating' && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 size={16} className="text-yellow-400 animate-spin" />
            </div>
          )}
          {/* Scene number badge */}
          <div className="absolute top-1 left-1 bg-black/70 rounded px-1 py-0.5">
            <span className="text-[8px] font-bold text-white/80">{index + 1}</span>
          </div>
        </div>

        {/* Script / Lyrics */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {lyrics && (
            <div className="bg-white/[0.03] rounded px-2 py-1.5 border border-white/5">
              <div className="text-[8px] text-white/30 uppercase tracking-wide mb-0.5 font-medium">Guión</div>
              <p className="text-[11px] text-white/70 leading-relaxed line-clamp-3 italic">
                "{lyrics}"
              </p>
            </div>
          )}
          {cameraMove && (
            <div className="flex items-center gap-1">
              <Camera size={9} className="text-teal-400 shrink-0" />
              <span className="text-[9px] text-teal-400/70 truncate">{cameraMove}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded section — Prompt + extra details */}
      {isExpanded && (
        <div className="px-3 pb-2 space-y-1.5 border-t border-white/5 pt-2">
          {prompt && (
            <div className="bg-white/[0.02] rounded px-2 py-1.5">
              <div className="text-[8px] text-white/25 uppercase tracking-wide mb-0.5">Prompt</div>
              <p className="text-[10px] text-white/50 leading-relaxed">{prompt}</p>
            </div>
          )}
          {clip.metadata?.lighting && (
            <div className="flex items-center gap-2 text-[9px] text-white/30">
              <Sparkles size={9} /> Lighting: {clip.metadata.lighting}
            </div>
          )}
          {clip.metadata?.colorGrading && (
            <div className="flex items-center gap-2 text-[9px] text-white/30">
              <Sparkles size={9} /> Color: {clip.metadata.colorGrading}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-3 pb-2 pt-0.5">
        <Button
          size="sm" variant="ghost"
          onClick={(e) => { e.stopPropagation(); onCameraAngles(); }}
          className="h-6 px-2 text-[9px] gap-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400"
          title="Camera Angles"
        >
          <Camera size={10} /> Angles
        </Button>
        <Button
          size="sm" variant="ghost"
          onClick={(e) => { e.stopPropagation(); onEditImage(); }}
          className="h-6 px-2 text-[9px] gap-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
          title="Editar Imagen"
          disabled={!imageUrl}
        >
          <Pencil size={10} /> Edit
        </Button>
        <Button
          size="sm" variant="ghost"
          onClick={(e) => { e.stopPropagation(); onRegenerateImage(); }}
          className="h-6 px-2 text-[9px] gap-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400"
          title="Regenerar Imagen"
          disabled={status === 'generating'}
        >
          <RefreshCw size={10} /> Regen
        </Button>
        <Button
          size="sm" variant="ghost"
          onClick={(e) => { e.stopPropagation(); onGenerateVideo(); }}
          className="h-6 px-2 text-[9px] gap-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400"
          title="Generar Video"
          disabled={!imageUrl || status === 'generating'}
        >
          <Film size={10} /> Video
        </Button>
        <Button
          size="sm" variant="ghost"
          onClick={(e) => { e.stopPropagation(); onAddMusician(); }}
          className="h-6 px-2 text-[9px] gap-1 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400"
          title="Agregar Músico"
        >
          <Music size={10} />
        </Button>
      </div>
    </div>
  );
});
SceneCard.displayName = 'SceneCard';

// ============================================
// MAIN STORYBOARD PANEL
// ============================================
export const StoryboardPanel: React.FC<StoryboardPanelProps> = ({
  open,
  onClose,
  clips,
  duration,
  aspectRatio,
  projectContext,
  artistReferenceImages,
  onEditImage,
  onCameraAngles,
  onRegenerateImage,
  onGenerateVideo,
  onBatchGenerateVideos,
  onAnimatedScene,
  conceptProjectId,
  onAddMusician,
  onSelectClip,
  onSeekTo,
  regeneratingId,
  generatingVideoId,
}) => {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isPipelineAnimating, setIsPipelineAnimating] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchModel, setBatchModel] = useState<string>('kling-v2.1-standard');
  const [previewClip, setPreviewClip] = useState<TimelineClip | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Esc closes the lightbox first, then the panel
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (previewClip) setPreviewClip(null);
      else onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, previewClip, onClose]);

  // Filter to only Layer 1 (image/video clips), sorted by start time
  const imageClips = useMemo(() => {
    return clips
      .filter(c => c.layerId === 1)
      .sort((a, b) => a.start - b.start);
  }, [clips]);

  // Apply filters
  const filteredClips = useMemo(() => {
    let result = imageClips;

    // Category filter
    if (filter === 'performance') result = result.filter(c => getClipCategory(c) === 'PERFORMANCE');
    else if (filter === 'b-roll') result = result.filter(c => getClipCategory(c) === 'B-ROLL');
    else if (filter === 'story') result = result.filter(c => getClipCategory(c) === 'STORY');
    else if (filter === 'with-video') result = result.filter(c => c.metadata?.videoUrl || c.metadata?.hasVideo);
    else if (filter === 'no-video') result = result.filter(c => !c.metadata?.videoUrl && !c.metadata?.hasVideo);

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        getClipLyrics(c).toLowerCase().includes(q) ||
        getClipPrompt(c).toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [imageClips, filter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = imageClips.length;
    const withVideo = imageClips.filter(c => c.metadata?.videoUrl || c.metadata?.hasVideo).length;
    const performance = imageClips.filter(c => getClipCategory(c) === 'PERFORMANCE').length;
    const broll = imageClips.filter(c => getClipCategory(c) === 'B-ROLL').length;
    const story = imageClips.filter(c => getClipCategory(c) === 'STORY').length;
    const generating = imageClips.filter(c => 
      c.id === regeneratingId || c.id === generatingVideoId || c.metadata?.videoGenerating
    ).length;
    return { total, withVideo, performance, broll, story, generating };
  }, [imageClips, regeneratingId, generatingVideoId]);

  const toggleExpand = useCallback((clipId: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(imageClips.map(c => c.id)));
  }, [imageClips]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  // Clips that have images but no generated video yet
  const clipsNeedingVideo = useMemo(() => {
    return imageClips.filter(c => {
      const hasImage = !!(c.imageUrl || c.url || c.thumbnailUrl);
      const hasVideo = !!(c.metadata?.videoUrl || c.metadata?.hasVideo);
      const isGenerating = c.id === regeneratingId || c.id === generatingVideoId || c.metadata?.videoGenerating;
      return hasImage && !hasVideo && !isGenerating;
    });
  }, [imageClips, regeneratingId, generatingVideoId]);

  const handleBatchGenerate = useCallback(async () => {
    if (clipsNeedingVideo.length === 0) return;
    setIsBatchGenerating(true);
    if (onBatchGenerateVideos) {
      onBatchGenerateVideos(clipsNeedingVideo, batchModel);
    } else {
      // Fallback: trigger each clip's generate handler with a stagger delay
      for (let i = 0; i < clipsNeedingVideo.length; i++) {
        await new Promise(r => setTimeout(r, i * 800));
        onGenerateVideo(clipsNeedingVideo[i]);
      }
    }
    // Reset after a short delay (the actual generation runs async)
    setTimeout(() => setIsBatchGenerating(false), 2000);
  }, [clipsNeedingVideo, batchModel, onBatchGenerateVideos, onGenerateVideo]);

  // SSE-based pipeline animation using the animateFullStoryboard server endpoint
  const handlePipelineAnimate = useCallback(async () => {
    if (!conceptProjectId || isPipelineAnimating) return;
    setIsPipelineAnimating(true);
    setPipelineProgress({ done: 0, total: imageClips.length });
    try {
      const response = await fetch(`/api/video-concepts/${conceptProjectId}/storyboard/animate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'pixverse' }),
      });
      if (!response.body) throw new Error('No SSE stream');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const eventBlock of events) {
          const dataLine = eventBlock.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(5));
            if (payload.videoUrl && typeof payload.order === 'number' && onAnimatedScene) {
              onAnimatedScene(payload.order, payload.videoUrl);
            }
            if (typeof payload.progress === 'number') {
              setPipelineProgress({ done: Math.round(payload.progress * imageClips.length), total: imageClips.length });
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('[StoryboardPanel] Pipeline animate error', err);
    } finally {
      setIsPipelineAnimating(false);
      setPipelineProgress(null);
    }
  }, [conceptProjectId, isPipelineAnimating, imageClips.length, onAnimatedScene]);

  if (!open) return null;

  const panelWidth = isFullscreen ? '100%' : '420px';

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-50 flex flex-col border-l border-white/10 bg-[#0d0d1a]/98 backdrop-blur-xl shadow-2xl shadow-black/60"
      style={{ width: panelWidth, maxWidth: '100vw' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <LayoutList size={16} className="text-teal-400" />
          <span className="text-sm font-semibold text-white">Storyboard</span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-teal-500/30 text-teal-400">
            {filteredClips.length}/{stats.total}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm" variant="ghost"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-6 w-6 p-0 text-white/40 hover:text-white/70"
            title={isFullscreen ? 'Reducir' : 'Expandir'}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </Button>
          <Button
            size="sm" variant="ghost"
            onClick={onClose}
            className="h-6 w-6 p-0 text-white/40 hover:text-white/70"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-white/5 text-[9px]">
        <span className="text-white/30">{stats.total} escenas</span>
        <span className="text-purple-400">{stats.performance} performance</span>
        <span className="text-cyan-400">{stats.broll} b-roll</span>
        <span className="text-amber-400">{stats.story} story</span>
        {stats.generating > 0 && (
          <span className="flex items-center gap-1 text-teal-400">
            <Loader2 size={9} className="animate-spin" /> {stats.generating} generando
          </span>
        )}
        <span className="text-green-400 ml-auto">{stats.withVideo}/{stats.total} videos</span>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en guión..."
            className="h-7 pl-7 text-[11px] bg-white/5 border-white/10"
          />
        </div>
        <div className="flex gap-px">
          {([
            { key: 'all', label: 'Todo' },
            { key: 'performance', label: 'Perf' },
            { key: 'b-roll', label: 'B-Roll' },
            { key: 'story', label: 'Story' },
            { key: 'no-video', label: 'Sin Video' },
          ] as { key: FilterMode; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2 py-1 text-[8px] rounded font-medium transition-colors ${
                filter === f.key 
                  ? 'bg-teal-500/20 text-teal-400' 
                  : 'text-white/30 hover:text-white/50 hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expand/Collapse controls */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-white/5">
        <div className="flex gap-2">
          <button onClick={expandAll} className="text-[9px] text-white/30 hover:text-teal-400 transition-colors">
            Expandir todo
          </button>
          <span className="text-white/10">|</span>
          <button onClick={collapseAll} className="text-[9px] text-white/30 hover:text-teal-400 transition-colors">
            Colapsar todo
          </button>
        </div>
        <span className="text-[9px] text-white/20">
          {formatTime(duration)} total
        </span>
      </div>

      {/* Scene cards */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="p-3 space-y-2">
          {filteredClips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon size={32} className="text-white/10 mb-3" />
              <p className="text-sm text-white/30">No hay escenas</p>
              <p className="text-[11px] text-white/20 mt-1">
                {filter !== 'all' ? 'Prueba cambiando el filtro' : 'Genera imágenes desde el timeline'}
              </p>
            </div>
          ) : (
            filteredClips.map((clip, index) => {
              const globalIndex = imageClips.findIndex(c => c.id === clip.id);
              const status = getClipStatus(clip, regeneratingId, generatingVideoId);

              return (
                <SceneCard
                  key={clip.id}
                  clip={clip}
                  index={globalIndex}
                  isExpanded={expandedIds.has(clip.id)}
                  status={status}
                  onToggleExpand={() => toggleExpand(clip.id)}
                  onEditImage={() => onEditImage(clip)}
                  onCameraAngles={() => onCameraAngles(clip)}
                  onRegenerateImage={() => onRegenerateImage(clip)}
                  onGenerateVideo={() => onGenerateVideo(clip)}
                  onAddMusician={() => onAddMusician(clip)}
                  onSelect={() => onSelectClip(clip.id)}
                  onSeekTo={() => onSeekTo(clip.start)}
                  onPreview={() => setPreviewClip(clip)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Footer with progress */}
      <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02] space-y-2">
        {/* Batch Model Selector + Batch Generate button */}
        {clipsNeedingVideo.length > 0 && (
          <Select value={batchModel} onValueChange={setBatchModel}>
            <SelectTrigger className="w-full h-7 text-[10px] bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/10 text-white">
              <SelectItem value="kling-v2.1-standard" className="text-[10px]">Kling v2.1 Standard</SelectItem>
              <SelectItem value="kling-v2.1-pro" className="text-[10px]">Kling v2.1 Pro</SelectItem>
              <SelectItem value="pixverse-v6" className="text-[10px]">PixVerse V6</SelectItem>
              <SelectItem value="pixverse-veo-3.1-fast" className="text-[10px]">PixVerse Veo 3.1 Fast</SelectItem>
              <SelectItem value="pixverse-sora-2" className="text-[10px]">PixVerse Sora 2</SelectItem>
              <SelectItem value="pixverse-seedance-2.0-fast" className="text-[10px]">PixVerse Seedance 2.0 Fast</SelectItem>
            </SelectContent>
          </Select>
        )}
        {clipsNeedingVideo.length > 0 && (
          <Button
            size="sm"
            onClick={handleBatchGenerate}
            disabled={isBatchGenerating}
            className="w-full h-8 text-[11px] bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-500 hover:to-pink-500 text-white gap-1.5 border-0 shadow-lg shadow-purple-500/20"
          >
            {isBatchGenerating ? (
              <><Loader2 size={11} className="animate-spin" /> Iniciando cola de generación...</>
            ) : (
              <><Zap size={11} /> Generar todos los videos ({clipsNeedingVideo.length} pendientes)</>
            )}
          </Button>
        )}
        {/* Pipeline Animate button — only shown when concept project is linked */}
        {conceptProjectId && (
          <Button
            size="sm"
            onClick={handlePipelineAnimate}
            disabled={isPipelineAnimating}
            className="w-full h-8 text-[11px] bg-gradient-to-r from-teal-600/80 to-cyan-600/80 hover:from-teal-500 hover:to-cyan-500 text-white gap-1.5 border-0 shadow-lg shadow-teal-500/20"
          >
            {isPipelineAnimating ? (
              <><Loader2 size={11} className="animate-spin" /> {pipelineProgress ? `${pipelineProgress.done}/${pipelineProgress.total} escenas...` : 'Animando...'}</>
            ) : (
              <><Sparkles size={11} /> Animar via Pipeline SSE</>
            )}
          </Button>
        )}
        {/* Progress bar */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-white/30">Progreso de video</span>
          <span className="text-[9px] text-teal-400 font-medium">
            {stats.withVideo}/{stats.total} ({stats.total > 0 ? Math.round((stats.withVideo / stats.total) * 100) : 0}%)
          </span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-500"
            style={{ width: `${stats.total > 0 ? (stats.withVideo / stats.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Preview lightbox — video playback / image zoom */}
      {previewClip && (() => {
        const pImage = previewClip.imageUrl || previewClip.url || previewClip.thumbnailUrl;
        const pVideo = previewClip.metadata?.videoUrl;
        const pIndex = imageClips.findIndex(c => c.id === previewClip.id);
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
            onClick={() => setPreviewClip(null)}
          >
            <div
              className="relative max-w-4xl w-full max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-white/40">#{String(pIndex + 1).padStart(2, '0')}</span>
                  <span className="text-sm font-medium text-white truncate">{previewClip.title || `Escena ${pIndex + 1}`}</span>
                  {pVideo ? (
                    <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-400 gap-1">
                      <VideoIcon size={9} /> Video
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] border-white/20 text-white/40 gap-1">
                      <ImageIcon size={9} /> Imagen
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(pVideo || pImage) && (
                    <a
                      href={pVideo || pImage}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                      title="Descargar"
                    >
                      <Download size={12} /> Descargar
                    </a>
                  )}
                  <button
                    onClick={() => setPreviewClip(null)}
                    className="flex items-center justify-center w-7 h-7 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    title="Cerrar (Esc)"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 rounded-lg overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                {pVideo ? (
                  <video
                    src={pVideo}
                    poster={pImage}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                ) : pImage ? (
                  <img
                    src={pImage}
                    alt={previewClip.title || `Escena ${pIndex + 1}`}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-white/30">
                    <ImageIcon size={40} className="mb-3" />
                    <p className="text-sm">Esta escena aún no tiene imagen</p>
                  </div>
                )}
              </div>
              {getClipLyrics(previewClip) && (
                <p className="mt-2 text-[12px] text-white/60 italic text-center line-clamp-2">
                  "{getClipLyrics(previewClip)}"
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default StoryboardPanel;
