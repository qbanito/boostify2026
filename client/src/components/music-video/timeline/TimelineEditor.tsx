/**
 * Editor de timeline principal
 * Componente principal para la edici�n de videos con timeline multiples capas
 * 
 * BOOSTIFY 2025 - Con acciones sobre clips:
 * - Edit Image (Nano Banana AI)
 * - Add Musician
 * - Camera Angles
 * - Regenerar Imagen
 * - Generar Video
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PortalContainerContext, usePortalContainer } from '../../../contexts/portal-container-context';
import { TimelineLayers } from './TimelineLayers';
import ClipScriptTooltip from './ClipScriptTooltip';
import DirectorSuggestionsPanel from './DirectorSuggestionsPanel';
import DirectorChatOverlay from './DirectorChatOverlay';
import { getDirectorById, DIRECTORS } from '@/data/directors';
import type { DirectorProfile } from '@/data/directors/director-schema';
import type { DirectorSuggestion, DirectorChatAction } from '@/lib/services/director-ai-service';
import { getDirectorImageUrl } from '@/lib/services/director-ai-service';
import { EditorAgentPanel } from '../editor-agent-panel';
import type { TimelineEditPlan } from '@/lib/api/timeline-editor-agent';
import { MotionControlPanel } from '../motion-control-panel';
import { VideoPreviewModal } from '../video-preview-modal';
import { MusicianModal } from '../MusicianModal';
import CameraAnglesModal from '../CameraAnglesModal';
import { ImageEditorModal } from '../ImageEditorModal';
import { MicroCutsPanel } from '../MicroCutsPanel';
import { VideoBudgetModal } from '../VideoBudgetModal';
import { VideoGenerationModal } from '../VideoGenerationModal';
import { StoryboardPanel } from '../StoryboardPanel';
import { MotionSyncPanel } from '../MotionSyncPanel';
import { ImageGeneratorPanel } from './ImageGeneratorPanel';
import { VariationsPanel } from './VariationsPanel';
import { ExportPanel, ASPECT_RATIOS } from './ExportPanel';
import { MediaLibraryPanel, type MediaItem } from './MediaLibraryPanel';
import { SourceMonitorModal, type InOutMarks } from './SourceMonitorModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { useTimelineEngine } from '@/hooks/useTimelineEngine';
import type { EditMode } from '@/hooks/useTimelineEngine';
import { 
  MAX_CLIP_DURATION,
  MIN_CLIP_DURATION,
  SNAP_THRESHOLD_PX,
  DEFAULT_LAYER_HEIGHT,
} from '@/constants/timeline-constants';
import { 
  createProjectWithImages,
  getUserProjects,
  deleteVideoProject,
  type VideoProject
} from '@/lib/services/video-project-service';
import { 
  Play as PlayIcon, Pause as PauseIcon, 
  Scissors as ScissorIcon, Hand as HandIcon,
  Type as SelectIcon, MoveHorizontal as TrimIcon,
  ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon,
  Redo as RedoIcon, Undo as UndoIcon,
  Magnet as MagnetIcon, Trash as TrashIcon,
  Video as VideoIcon, Volume2 as VolumeIcon, VolumeX as VolumeMuteIcon, Volume1 as VolumeLowIcon, Wand2 as MotionIcon,
  Image as ImageIcon, Plus as PlusIcon, GripVertical, X as XIcon,
  FolderOpen, Save, FolderPlus, Clock, AlertCircle,
  SkipBack, SkipForward, Rewind, FastForward,
  Copy, ClipboardPaste, Split, Layers, Lock, Unlock, Eye, EyeOff, MoreHorizontal,
  Download, RefreshCw, Film, Pencil, Music, Camera, Sparkles, Loader2,
  HelpCircle, Upload, FileAudio, FileVideo, ImagePlus,
  Monitor, Check, Move, RotateCcw, Maximize2, Zap, DollarSign, Megaphone, LayoutList, Smartphone,
  Maximize as FullscreenIcon, Minimize as ExitFullscreenIcon, Grid3X3, Info, Search, SearchIcon, Shield, Tv,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { apiRequest } from '@/lib/queryClient';
import type { MusicVideoScene } from '@/types/music-video-scene';
import {
  type MicroCutConfig,
  type MicroCutPlan,
  type ClipContext,
  generateMicroCutPlan,
  generateTimelineMicroCuts,
  getDefaultMicroCutConfig,
  getBeatSyncedSegments,
  mapToMusicSection,
  detectSectionEnergy,
} from '@/lib/api/micro-cuts-engine';

import { 
  TimelineClip, LayerConfig, ClipType, LayerType, TimelineMarker 
} from '@/interfaces/timeline';
import { Player, type PlayerRef } from '@remotion/player';
import { MusicVideoComposition } from '../../remotion/MusicVideoComposition';
import { convertClipsToRemotionProps, calculateDurationInFrames } from '@/lib/utils/timeline-to-remotion';

// Responsive layer width - se calcula din�micamente
const getLayerLabelWidth = () => {
  if (typeof window === 'undefined') return 120;
  if (window.innerWidth < 480) return 50;
  if (window.innerWidth < 640) return 70;
  if (window.innerWidth < 768) return 100;
  return 140;
};

const PLAYHEAD_WIDTH = 2;

type Tool = 'select' | 'razor' | 'trim' | 'hand';

interface GeneratedImage {
  id: string;
  url: string;
  prompt?: string;
  timestamp?: number;
  sceneId?: string;
}

interface ImportedMediaItem {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'audio' | 'video';
  mimeType: string;
  addedAt: number;
}

// Interface para proyectos guardados
export interface SavedProject {
  id: string;
  name: string;
  thumbnail?: string;
  clips: TimelineClip[];
  generatedImages: GeneratedImage[];
  duration: number;
  createdAt: Date;
  updatedAt: Date;
}

// Contexto del proyecto para regeneraci�n coherente
export interface ProjectContext {
  songTitle?: string;
  scriptContent?: string;
  selectedConcept?: {
    title?: string;
    story_concept?: string;
    visual_style?: string;
    mood?: string;
    color_palette?: string;
  };
  videoStyle?: {
    selectedDirector?: {
      name: string;
      style?: string;
    };
    style?: string;
    mood?: string;
  };
  artistReferenceImages?: string[];
  masterCharacter?: {
    imageUrl: string;
  };
}

interface TimelineEditorProps {
  initialClips: TimelineClip[];
  duration: number;
  initialZoom?: number;
  markers?: TimelineMarker[];
  readOnly?: boolean;
  videoPreviewUrl?: string;
  audioPreviewUrl?: string;
  onChange?: (clips: TimelineClip[]) => void;
  audioBuffer?: AudioBuffer;
  genreHint?: string;
  generatedImages?: GeneratedImage[];
  onAddImageToTimeline?: (image: GeneratedImage) => void;
  // 🎬 Contexto del proyecto para regeneración coherente
  projectContext?: ProjectContext;
  // 📤 Callback cuando el video se exporta exitosamente
  onExportComplete?: (videoUrl: string) => void;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  initialClips,
  duration,
  initialZoom = 120,
  markers = [],
  readOnly = false,
  videoPreviewUrl,
  audioPreviewUrl,
  onChange,
  audioBuffer,
  genreHint,
  generatedImages = [],
  onAddImageToTimeline,
  projectContext,
  onExportComplete,
}) => {
  const [clips, setClips] = useState<TimelineClip[]>(() => normalizeClips(initialClips));
  const [zoom, setZoom] = useState(initialZoom);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<number>>(new Set()); // ?? Multi-select
  const [playbackRate, setPlaybackRate] = useState(1); // ?? J/K/L playback control
  const [tool, setTool] = useState<Tool>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [rippleEnabled, setRippleEnabled] = useState(false);
  
  // 🔊 Audio volume control - Estado para controlar volumen como Adobe Premiere
  const [volume, setVolume] = useState(1); // 0 a 1
  const [isMuted, setIsMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<GeneratedImage | null>(null);
  const [layerLabelWidth, setLayerLabelWidth] = useState(getLayerLabelWidth);
  
  // 🔧 FIXED: effectiveDuration = max(prop duration, actual clip extent)
  // Ensures timeline always extends to show ALL clips, not just the prop value
  const effectiveDuration = useMemo(() => {
    const clipExtent = clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
    return Math.max(duration, clipExtent + 5); // +5s buffer
  }, [duration, clips]);

  // Estados para paneles redimensionables
  const [viewerHeight, setViewerHeight] = useState(55); // Altura del visor en % - Por defecto abierto
  const [galleryWidth, setGalleryWidth] = useState(180); // Ancho de la galer�a en px
  const [layerPanelWidth, setLayerPanelWidth] = useState(100); // Ancho de los labels de capas en px
  
  // Estados de arrastre
  const [isDraggingVertical, setIsDraggingVertical] = useState(false); // Divisor horizontal (visor/timeline)
  const [isDraggingGallery, setIsDraggingGallery] = useState(false); // Divisor vertical (visor/galer�a)
  const [isDraggingLayers, setIsDraggingLayers] = useState(false); // Divisor vertical (labels/tracks)
  
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);
  // Ref to track previous initialClips signature — prevents unnecessary setClips during rapid generation
  const prevClipsSignatureRef = useRef<string>('');
  const [isDraggingFileOver, setIsDraggingFileOver] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<{time: number, layerId: number} | null>(null);
  const { toast } = useToast();

  // 🎬 Remotion Player integration
  const playerRef = useRef<PlayerRef>(null);
  const [useRemotionPreview, setUseRemotionPreview] = useState(true);
  const REMOTION_FPS = 30;
  
  const remotionProps = useMemo(
    () => convertClipsToRemotionProps(clips, audioPreviewUrl),
    [clips, audioPreviewUrl]
  );
  const remotionDurationInFrames = useMemo(
    () => calculateDurationInFrames(clips, duration, REMOTION_FPS),
    [clips, duration]
  );
  //  Audio Analysis para sincronizaci�n con beats
  const { 
    analysis: audioAnalysis, 
    isAnalyzing: isAnalyzingAudio, 
    analyzeAudio, 
    snapToBeat,
    getNearestBeat 
  } = useAudioAnalysis();
  
  // ?? Motion Control & Video Generation
  const [motionPanelOpen, setMotionPanelOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedScene, setSelectedScene] = useState<MusicVideoScene | null>(null);
  
  // ??? Modales de Acciones sobre Clips
  const [showMusicianModal, setShowMusicianModal] = useState(false);
  const [musicianModalClip, setMusicianModalClip] = useState<TimelineClip | null>(null);
  const [showCameraAnglesModal, setShowCameraAnglesModal] = useState(false);
  const [cameraAnglesModalClip, setCameraAnglesModalClip] = useState<TimelineClip | null>(null);
  const [showImageEditorModal, setShowImageEditorModal] = useState(false);
  const [imageEditorModalClip, setImageEditorModalClip] = useState<TimelineClip | null>(null);
  
  // 🎬 Export panel & Aspect Ratio
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  const remotionCompositionSize = useMemo(() => {
    const sizeMap: Record<string, { width: number; height: number }> = {
      '16:9':  { width: 1920, height: 1080 },
      '9:16':  { width: 1080, height: 1920 },
      '1:1':   { width: 1080, height: 1080 },
      '4:3':   { width: 1440, height: 1080 },
      '4:5':   { width: 864,  height: 1080 },
      '21:9':  { width: 2520, height: 1080 },
    };
    return sizeMap[aspectRatio] ?? { width: 1920, height: 1080 };
  }, [aspectRatio]);
  
  // 📋 Storyboard Panel
  const [showStoryboardPanel, setShowStoryboardPanel] = useState(false);

  // 📱 Motion Sync Panel
  const [showMotionSyncPanel, setShowMotionSyncPanel] = useState(false);

  // 🖼️ Image Generator Panel
  const [showImageGenerator, setShowImageGenerator] = useState(false);
  const [imageGenReference, setImageGenReference] = useState<{ url: string; type: 'style' | 'character' } | null>(null);

  // 🔀 Variations Panel
  const [showVariationsPanel, setShowVariationsPanel] = useState(false);
  const [variationsClip, setVariationsClip] = useState<TimelineClip | null>(null);

  // ❤️ Liked clips
  const [likedClips, setLikedClips] = useState<Set<number>>(new Set());

  // 🔍 Upscaling state
  const [isUpscaling, setIsUpscaling] = useState<number | null>(null);

  // ⚡ MicroCuts Engine - Microcortes inteligentes para Kling
  const [microCutConfig, setMicroCutConfig] = useState<MicroCutConfig>(() => 
    getDefaultMicroCutConfig(genreHint)
  );
  const [microCutPlans, setMicroCutPlans] = useState<Map<number | string, MicroCutPlan>>(new Map());
  const [showMicroCutsPanel, setShowMicroCutsPanel] = useState(false);
  const [isApplyingMicroCuts, setIsApplyingMicroCuts] = useState(false);

  // 🎯 CapCut-style media transform editing (scale/position within frame)
  const [isTransformMode, setIsTransformMode] = useState(false);
  const [transformDragging, setTransformDragging] = useState(false);
  const transformStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  // Auto-disable transform mode when clip is deselected
  useEffect(() => {
    if (!selectedClipId) setIsTransformMode(false);
  }, [selectedClipId]);
  
  // 📥 Importacion de archivos multimedia
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<'image' | 'audio' | 'video' | 'all'>('all');
  
  // 📂 Imported media files — shown in gallery panel alongside generated images
  const [importedMedia, setImportedMedia] = useState<ImportedMediaItem[]>([]);
  
  // 🎨 Workflow-generated media (edited, regenerated, camera angles, video frames)
  const [workflowMedia, setWorkflowMedia] = useState<MediaItem[]>([]);
  
  // 📂 Menu contextual de la galeria (click derecho para importar)
  const [galleryContextMenu, setGalleryContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });
  
  // 📁 Proyectos Guardados - Firebase + localStorage como cache
  const { user, isAdmin } = useAuth();
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  
  // 💰 Video Budget System - Pre-generation payment gate
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetApproved, setBudgetApproved] = useState(false);
  const [currentBudgetId, setCurrentBudgetId] = useState<number | null>(null);
  const [pendingGenerateClip, setPendingGenerateClip] = useState<TimelineClip | null>(null);
  // 🎬 Video Generation Modal — direct generation with model picker
  const [videoGenClip, setVideoGenClip] = useState<TimelineClip | null>(null);
  // 🌊 Batch video generation model (persisted across batch runs)
  const [batchVideoModel, setBatchVideoModel] = useState<string>('kling-v2.1-standard');
  // 📐 Source Monitor — double-click to set In/Out marks before adding to timeline
  const [sourceMonitorItem, setSourceMonitorItem] = useState<MediaItem | null>(null);

  // 🖥️ Viewer Enhancements — fullscreen, safe guides, zoom, clip info, play/pause feedback
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  // When this editor is inside an outer fullscreen container (e.g. isTimelineFullscreen in music-video-ai),
  // pass that container through so Radix portals still render inside it.
  const outerPortalContainer = usePortalContainer();
  const [showSafeGuides, setShowSafeGuides] = useState(false);
  const [safeGuideType, setSafeGuideType] = useState<'broadcast' | 'youtube' | 'tiktok' | 'instagram'>('broadcast');
  const [viewerZoom, setViewerZoom] = useState(1);
  const [showClipInfo, setShowClipInfo] = useState(false);
  const [playPauseAnim, setPlayPauseAnim] = useState<'play' | 'pause' | null>(null);
  const [progressHoverTime, setProgressHoverTime] = useState<number | null>(null);
  const [progressHoverX, setProgressHoverX] = useState(0);
  const [firebaseProjects, setFirebaseProjects] = useState<VideoProject[]>([]);
  const [showProjectsPanel, setShowProjectsPanel] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // 🎬🎥 Director Interaction System
  const [directorPanelOpen, setDirectorPanelOpen] = useState(false);
  const [directorAppliedCount, setDirectorAppliedCount] = useState(0);
  const [directorClipsSnapshot, setDirectorClipsSnapshot] = useState<TimelineClip[] | null>(null);
  const [hoveredClip, setHoveredClip] = useState<{ clip: TimelineClip; position: { x: number; y: number } } | null>(null);
  const [chatClip, setChatClip] = useState<TimelineClip | null>(null);
  const [manualDirector, setManualDirector] = useState<DirectorProfile | null>(null);
  const [showDirectorPicker, setShowDirectorPicker] = useState(false);
  const directorPickerRef = useRef<HTMLDivElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const aspectMenuRef = useRef<HTMLDivElement>(null);
  // Portal positions for toolbar dropdowns (to escape overflow-x:auto clipping)
  const [directorPickerPos, setDirectorPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [importMenuPos, setImportMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [aspectMenuPos, setAspectMenuPos] = useState<{ top: number; right: number } | null>(null);
  const hoverHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRegenerateImageRef = useRef<(clip: TimelineClip) => void>();
  const handleGenerateVideoRef = useRef<(clip: TimelineClip) => void>();
  const pushHistoryRef = useRef<(newClips: TimelineClip[], operation?: string) => void>();

  // Resolve the full DirectorProfile from projectContext OR manual pick
  const activeDirector: DirectorProfile | undefined = useMemo(() => {
    if (manualDirector) return manualDirector;
    const dirName = projectContext?.videoStyle?.selectedDirector?.name;
    if (!dirName) return undefined;
    return DIRECTORS.find(
      (d) => d.name.toLowerCase() === dirName.toLowerCase()
    );
  }, [projectContext?.videoStyle?.selectedDirector?.name, manualDirector]);

  // Close director picker when clicking outside
  useEffect(() => {
    if (!showDirectorPicker) return;
    const handler = (e: MouseEvent) => {
      if (directorPickerRef.current && !directorPickerRef.current.contains(e.target as Node)) {
        setShowDirectorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDirectorPicker]);

  // Hover tooltip handlers — delayed hide so user can reach the tooltip
  const handleClipHoverStart = useCallback((clip: TimelineClip, position: { x: number; y: number }) => {
    if (hoverHideTimerRef.current) { clearTimeout(hoverHideTimerRef.current); hoverHideTimerRef.current = null; }
    setHoveredClip({ clip, position });
  }, []);
  const handleClipHoverEnd = useCallback(() => {
    // Short delay so user can move mouse from clip to tooltip without flickering
    hoverHideTimerRef.current = setTimeout(() => {
      setHoveredClip(null);
      hoverHideTimerRef.current = null;
    }, 250);
  }, []);
  // Immediate dismiss — no delay. Used when context menu opens to prevent overlap.
  const handleClipHoverDismiss = useCallback(() => {
    if (hoverHideTimerRef.current) { clearTimeout(hoverHideTimerRef.current); hoverHideTimerRef.current = null; }
    setHoveredClip(null);
  }, []);
  const handleTooltipMouseEnter = useCallback(() => {
    if (hoverHideTimerRef.current) { clearTimeout(hoverHideTimerRef.current); hoverHideTimerRef.current = null; }
  }, []);
  const handleTooltipMouseLeave = useCallback(() => {
    hoverHideTimerRef.current = setTimeout(() => {
      setHoveredClip(null);
      hoverHideTimerRef.current = null;
    }, 200);
  }, []);

  // Open chat for a clip (from tooltip)
  const handleOpenDirectorChat = useCallback((clip: TimelineClip) => {
    setHoveredClip(null); // hide tooltip
    setChatClip(clip);
  }, []);

  // Director suggestion/chat handlers are defined after updateClip below
  
  // ?? Cargar proyectos desde Firebase al montar o cuando cambia el usuario
  useEffect(() => {
    const loadFirebaseProjects = async () => {
      if (!user?.id) {
        setFirebaseProjects([]);
        return;
      }
      
      setIsLoadingProjects(true);
      try {
        const projects = await getUserProjects(String(user.id));
        setFirebaseProjects(projects);
        
        // Convertir a formato SavedProject para compatibilidad
        const converted: SavedProject[] = projects.map(p => ({
          id: p.id,
          name: p.name,
          thumbnail: p.images?.[0]?.publicUrl,
          clips: p.script?.scenes?.map((scene, i) => ({
            id: i + 1,
            start: scene.start_time || 0,
            duration: scene.duration || 3,
            layerId: 1,
            type: ClipType.IMAGE,
            url: p.images?.find(img => img.sceneId === `scene-${i + 1}`)?.publicUrl || '',
            imageUrl: p.images?.find(img => img.sceneId === `scene-${i + 1}`)?.publicUrl || '',
            label: ((scene as any).scene_description || scene.description || `Escena ${i + 1}`).substring(0, 30),
            metadata: { sceneData: scene }
          })) || [],
          generatedImages: p.images?.map((img, i) => ({
            id: img.sceneId,
            url: img.publicUrl,
            sceneId: img.sceneId
          })) || [],
          duration: p.script?.duration || 60,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }));
        
        setSavedProjects(converted);
      } catch (error) {
        console.error('? [FIREBASE] Error cargando proyectos:', error);
        // Fallback a localStorage
        try {
          const saved = localStorage.getItem('boostify_timeline_projects');
          const parsed = saved ? JSON.parse(saved) : [];
          setSavedProjects(parsed);
        } catch (e) {
          setSavedProjects([]);
        }
      } finally {
        setIsLoadingProjects(false);
      }
    };
    
    loadFirebaseProjects();
  }, [user?.id]);
  
  // ?? CRITICAL: Sincronizar clips cuando initialClips cambian (ej: cuando se generan im�genes)
  // Uses a signature-based comparison to avoid re-renders during rapid image generation
  useEffect(() => {
    if (initialClips && initialClips.length > 0) {
      // Build a signature from clip IDs + image URLs to detect REAL changes
      const newSignature = initialClips.map(c => 
        `${c.id}:${c.url || c.imageUrl || c.thumbnailUrl || ''}`
      ).join('|');
      
      // Skip if signature hasn't changed (same clips, same images)
      if (newSignature === prevClipsSignatureRef.current) {
        return;
      }
      prevClipsSignatureRef.current = newSignature;
      
      const normalizedClips = normalizeClips(initialClips);
      
      logger.info(`🔄 [SYNC] Actualizando clips internos: ${normalizedClips.length} clips`);
      
      // Preservar las im�genes existentes y actualizar con las nuevas
      // CRITICAL: También preservar clips importados por el usuario que no estén en initialClips
      setClips(prevClips => {
        const mergedClips = normalizedClips.map(newClip => {
          const existingClip = prevClips.find(c => c.id === newClip.id);
          if (existingClip) {
            // Merge: priorizar im�genes nuevas, pero mantener datos existentes
            return {
              ...existingClip,
              ...newClip,
              // Priorizar URL no vac�a
              url: newClip.url || newClip.imageUrl || existingClip.url || existingClip.imageUrl || '',
              imageUrl: newClip.imageUrl || newClip.url || existingClip.imageUrl || existingClip.url || '',
              thumbnailUrl: newClip.thumbnailUrl || existingClip.thumbnailUrl || newClip.url || newClip.imageUrl || '',
            };
          }
          return newClip;
        });
        
        // 🔒 Preserve clips that don't exist in initialClips:
        // - User-imported clips
        // - Auto-added audio clips (main audio, lipsync segments)
        const preservedClips = prevClips.filter(c => 
          !mergedClips.find(mc => mc.id === c.id) && (
            c.metadata?.isImported || 
            c.metadata?.isMainAudio || 
            c.metadata?.isLipsyncSegment ||
            c.type === ClipType.AUDIO
          )
        );
        
        if (preservedClips.length > 0) {
          logger.info(`📂 [SYNC] Preservando ${preservedClips.length} clip(s) (audio/importados)`);
        }
        
        return [...mergedClips, ...preservedClips];
      });
    }
  }, [initialClips]);
  
  // ??? CRITICAL: Auto-sincronizar im�genes generadas con clips del timeline
  useEffect(() => {
    if (generatedImages && generatedImages.length > 0) {
      logger.info(`??? [AUTO-SYNC] ${generatedImages.length} im�genes generadas detectadas, sincronizando con timeline...`);
      
      setClips(prevClips => {
        let updated = false;
        const newClips = prevClips.map(clip => {
          const sceneNumber = typeof clip.id === 'number' ? clip.id : 
                              parseInt(String(clip.id).match(/(\d+)$/)?.[1] || '0');
          
          const matchingImage = generatedImages.find(img => {
            const imgSceneNumber = parseInt(String(img.id).match(/(\d+)$/)?.[1] || '0');
            return imgSceneNumber === sceneNumber;
          });
          
          if (matchingImage && matchingImage.url && !clip.url && !clip.imageUrl) {
            updated = true;
            logger.info(`??? [AUTO-SYNC] Clip ${clip.id} ? Imagen ${matchingImage.id}`);
            return {
              ...clip,
              layerId: clip.layerId || 1, // Asegurar layerId para capa de im�genes
              url: matchingImage.url,
              imageUrl: matchingImage.url,
              thumbnailUrl: matchingImage.url,
            };
          }
          
          // Asegurar layerId incluso si no hay imagen nueva
          return {
            ...clip,
            layerId: clip.layerId || (clip.type === ClipType.AUDIO ? 2 : 1),
          };
        });
        
        if (updated) {
          logger.info(`? [AUTO-SYNC] Timeline actualizado con im�genes generadas`);
        }
        
        return updated ? newClips : prevClips;
      });
    }
  }, [generatedImages]);

  // 📦 Unified media library items — merges generatedImages + importedMedia + workflowMedia into MediaItem[]
  const mediaLibraryItems = useMemo<MediaItem[]>(() => {
    const fromGenerated: MediaItem[] = generatedImages
      .filter(img => img.url)
      .map((img, i) => ({
        id: `gen_${img.id || i}`,
        url: img.url!,
        name: img.prompt ? img.prompt.slice(0, 40) : `Imagen ${i + 1}`,
        type: 'image' as const,
        source: 'generated' as const,
        prompt: img.prompt,
        addedAt: img.timestamp || Date.now(),
      }));
    const fromImported: MediaItem[] = importedMedia.map(m => ({
      id: `imp_${m.id}`,
      url: m.url,
      name: m.name,
      type: m.type,
      source: 'imported' as const,
      mimeType: m.mimeType,
      addedAt: m.addedAt,
    }));
    return [...fromGenerated, ...fromImported, ...workflowMedia];
  }, [generatedImages, importedMedia, workflowMedia]);

  const handleUpdateMediaItems = useCallback((updated: MediaItem[]) => {
    // Propagate changes back — only workflowMedia items are mutable
    setWorkflowMedia(updated.filter(i => !i.id.startsWith('gen_') && !i.id.startsWith('imp_')));
  }, []);

  const handleDeleteMediaItem = useCallback((id: string) => {
    if (id.startsWith('imp_')) {
      const realId = id.replace('imp_', '');
      setImportedMedia(prev => prev.filter(m => m.id !== realId));
    } else if (id.startsWith('gen_')) {
      // generated images come from props — can't delete directly, just ignore
    } else {
      setWorkflowMedia(prev => prev.filter(m => m.id !== id));
    }
  }, []);

  const handleSelectMediaItem = useCallback((item: MediaItem) => {
    if (item.type === 'image') {
      setSelectedGalleryImage({ id: item.id, url: item.url, prompt: item.prompt || item.name });
    }
  }, []);

  // 📐 Source Monitor — add media item to timeline with in/out marks
  const handleSourceMonitorAdd = useCallback((item: MediaItem, marks: InOutMarks) => {
    const isImage = item.type === 'image';
    const isVideo = item.type === 'video';

    // Calculate where to place the new clip: after all existing clips on layer 0
    const layer0Clips = clips.filter(c => c.layerId === 0);
    const endOfTimeline = layer0Clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);

    const newClip: TimelineClip = {
      id: Math.max(0, ...clips.map(c => c.id)) + 1,
      layerId: 0,
      type: isVideo ? ClipType.VIDEO : ClipType.IMAGE,
      start: endOfTimeline,
      duration: marks.duration,
      url: item.url,
      imageUrl: isImage ? item.url : undefined,
      videoUrl: isVideo ? item.url : undefined,
      title: item.name,
      sourceStart: marks.inPoint,
      in: marks.inPoint,
      out: marks.outPoint,
      metadata: {
        imagePrompt: item.prompt || item.name,
        mediaItemId: item.id,
        addedViaSourceMonitor: true,
      },
    };

    pushHistoryRef.current?.([...clips, newClip], 'add-from-source-monitor');
    logger.info(`📐 [SourceMonitor] Added clip from "${item.name}" — In: ${marks.inPoint.toFixed(1)}s, Out: ${marks.outPoint.toFixed(1)}s, Duration: ${marks.duration.toFixed(1)}s`);
  }, [clips]);

  // 🎬 Media Library clip actions — bridge MediaItem → TimelineClip for modals
  const mediaItemToTempClip = useCallback((item: MediaItem): TimelineClip => ({
    id: Date.now(),
    layerId: 0,
    type: ClipType.IMAGE,
    start: 0,
    duration: 4,
    url: item.url,
    imageUrl: item.url,
    title: item.name,
    metadata: { imagePrompt: item.prompt || item.name, mediaItemId: item.id },
  }), []);

  const handleMediaEditImage = useCallback((item: MediaItem) => {
    const tempClip = mediaItemToTempClip(item);
    setImageEditorModalClip(tempClip);
    setShowImageEditorModal(true);
  }, [mediaItemToTempClip]);

  const handleMediaCameraAngles = useCallback((item: MediaItem) => {
    const tempClip = mediaItemToTempClip(item);
    setCameraAnglesModalClip(tempClip);
    setShowCameraAnglesModal(true);
  }, [mediaItemToTempClip]);

  const handleMediaRegenerate = useCallback(async (item: MediaItem) => {
    const tempClip = mediaItemToTempClip(item);
    handleRegenerateImageRef.current?.(tempClip);
  }, [mediaItemToTempClip]);

  const handleMediaGenerateVideo = useCallback((item: MediaItem) => {
    const tempClip = mediaItemToTempClip(item);
    handleGenerateVideoRef.current?.(tempClip);
  }, [mediaItemToTempClip]);

  // ?? AUTO-ADD: Crear clip de audio autom�ticamente cuando hay audioPreviewUrl
  // Tambi�n crear segmentos de audio para clips que necesitan lipsync
  useEffect(() => {
    if (audioPreviewUrl && duration > 0) {
      setClips(prevClips => {
        // Verificar si ya hay un clip de audio principal
        const hasMainAudioClip = prevClips.some(c => 
          (c.layerId === 2 || c.type === ClipType.AUDIO) && 
          !c.metadata?.isLipsyncSegment
        );
        
        const newClips = [...prevClips];
        
        if (!hasMainAudioClip) {
          const audioClip: TimelineClip = {
            id: 99999, // ID especial para audio
            layerId: 2,
            type: ClipType.AUDIO,
            start: 0,
            duration: duration,
            url: audioPreviewUrl,
            title: '🎵 Audio Principal',
            in: 0,
            out: duration,
            sourceStart: 0,
            metadata: {
              isMainAudio: true,
              totalDuration: duration
            }
          };
          newClips.push(audioClip);
        }
        
        // ?? LIPSYNC: Crear segmentos de audio para clips que necesitan lipsync
        const clipsNeedingLipsync = prevClips.filter(c => 
          c.layerId === 1 && 
          (c.metadata?.needsLipsync || (c as any).needsLipsync) &&
          !prevClips.some(ac => ac.metadata?.parentSceneId === c.id && ac.metadata?.isLipsyncSegment)
        );
        
        if (clipsNeedingLipsync.length > 0) {
          logger.info(`?? [AUTO-ADD] Creando ${clipsNeedingLipsync.length} segmentos de lipsync`);
          
          clipsNeedingLipsync.forEach((clip, index) => {
            const lipsyncSegment: TimelineClip = {
              id: 90000 + index, // IDs especiales para segmentos lipsync
              layerId: 3, // Capa 3 = Lipsync Segments
              type: ClipType.AUDIO,
              start: clip.start,
              duration: clip.duration,
              url: audioPreviewUrl,
              title: `🎤 Vocal ${clip.id}`,
              in: clip.start, // Punto de entrada en el audio
              out: clip.start + clip.duration, // Punto de salida
              sourceStart: clip.start,
              metadata: {
                isLipsyncSegment: true,
                parentSceneId: clip.id,
                lyrics: clip.metadata?.lyrics || '',
                hasVocals: true,
                inPoint: clip.start,
                outPoint: clip.start + clip.duration
              }
            };
            newClips.push(lipsyncSegment);
          });
        }
        
        return newClips.length !== prevClips.length ? newClips : prevClips;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioPreviewUrl, duration]);
  
  // ?? AUTO-ANALYZE: Analizar audio para obtener beats cuando se carga
  useEffect(() => {
    if (audioPreviewUrl && !audioAnalysis && !isAnalyzingAudio) {
      analyzeAudio(audioPreviewUrl).catch(() => {
        // Silently ignore audio analysis errors
      });
    }
  }, [audioPreviewUrl, audioAnalysis, isAnalyzingAudio, analyzeAudio]);

  // 🔊 ACTIVE AUDIO SOURCE: Primary audio for playback (supports imported audio files)
  const activeAudioSource = useMemo(() => {
    // Find audio clips (excluding lipsync segments)
    const audioClips = clips.filter(c => 
      c.type === ClipType.AUDIO && c.url && !c.metadata?.isLipsyncSegment
    );
    
    if (audioClips.length > 0) {
      // Priority: main audio clip > layer 2 clip > any audio clip
      const mainAudio = audioClips.find(c => c.metadata?.isMainAudio) 
        || audioClips.find(c => c.layerId === 2) 
        || audioClips[0];
      return {
        url: mainAudio.url!,
        clipStart: mainAudio.start,
        clipIn: mainAudio.in ?? mainAudio.sourceStart ?? 0,
        clipDuration: mainAudio.duration,
      };
    }
    
    // Fallback to audioPreviewUrl prop directly
    if (audioPreviewUrl) {
      return { url: audioPreviewUrl, clipStart: 0, clipIn: 0, clipDuration: duration };
    }
    
    return null;
  }, [clips, audioPreviewUrl, duration]);
  
  // Generar marcadores de beat para el timeline
  const beatGuides = useMemo(() => {
    if (!audioAnalysis?.beats) return [];
    // Usar beats o downbeats para las gu�as visuales
    const beatsToUse = audioAnalysis.downbeats?.length > 0 
      ? audioAnalysis.downbeats 
      : audioAnalysis.beats.filter((_, i) => i % 4 === 0); // Cada 4 beats si no hay downbeats
    return beatsToUse.slice(0, 200); // Limitar para performance
  }, [audioAnalysis]);
  
  // 🔊 CRITICAL: Constante de duración máxima de clip (Grok Imagine = 6s)
  const MAX_CLIP_DURATION_EDITOR = MAX_CLIP_DURATION;
  
  // ?? CRITICAL: Calcular clip activo basado en currentTime para sincronizaci�n exacta
  const activeClip = useMemo(() => {
    // Buscar clip visual (imagen o video, layerId 1) que esté en el tiempo actual
    const visualClips = clips.filter(c => c.layerId === 1 || c.type === ClipType.IMAGE || c.type === ClipType.GENERATED_IMAGE || c.type === ClipType.VIDEO);
    
    for (const clip of visualClips) {
      const clipEnd = clip.start + clip.duration;
      // currentTime debe estar >= start y < end para estar "dentro" del clip
      if (currentTime >= clip.start && currentTime < clipEnd) {
        return clip;
      }
    }
    return null;
  }, [clips, currentTime]);
  
  // ??? Funci�n helper para obtener URL de imagen de un clip
  const getClipImageUrl = useCallback((clip: TimelineClip | null): string | null => {
    if (!clip) return null;
    return clip.imageUrl || clip.thumbnailUrl || clip.url || 
           (typeof clip.generatedImage === 'string' ? clip.generatedImage : null) ||
           clip.image_url || clip.publicUrl || clip.firebaseUrl || null;
  }, []);
  
  // URL de imagen activa para el visor
  const activeClipImageUrl = useMemo(() => {
    return getClipImageUrl(activeClip);
  }, [activeClip, getClipImageUrl]);

  // ?? URL de video activo para el visor (si se gener� video desde imagen)
  const activeClipVideoUrl = useMemo(() => {
    if (!activeClip) return null;
    // Prioridad: lipsyncVideoUrl > videoUrl en metadata > videoUrl directo > url (si es clip de video importado)
    return activeClip.metadata?.lipsyncVideoUrl || 
           activeClip.metadata?.videoUrl || 
           activeClip.videoUrl || 
           (activeClip.type === ClipType.VIDEO ? activeClip.url : null) ||
           null;
  }, [activeClip]);
  
  // ?? Framerate para timecode (declarado antes de los efectos que lo usan)
  const [framerate, setFramerate] = useState<24 | 30 | 60>(30);
  const frameInterval = 1 / framerate;

  // ?? Ref para el video del clip activo
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);

  // ?? CRITICAL: Sincronizar video del clip activo con el timeline
  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video || !activeClip || !activeClipVideoUrl) return;
    
    // Calcular tiempo local dentro del clip + offset de sourceStart (para clips cortados)
    // sourceStart = offset en el archivo fuente donde empieza este clip
    const mediaOffset = activeClip.sourceStart || activeClip.in || 0;
    const clipLocalTime = (currentTime - activeClip.start) + mediaOffset;
    const videoDur = video.duration || 6;
    
    // Solo actualizar si el tiempo es válido
    if (clipLocalTime >= 0 && clipLocalTime < videoDur) {
      // Frame-accurate sync: tolerancia de 1 frame
      const frameTolerance = 1 / framerate;
      const drift = Math.abs(video.currentTime - clipLocalTime);
      
      if (isPlaying) {
        // During playback: correct drift only if > 2 frames
        if (drift > frameTolerance * 2) {
          video.currentTime = clipLocalTime;
        }
      } else {
        // When paused: precise scrubbing — always sync if > half frame
        if (drift > frameTolerance * 0.5) {
          video.currentTime = clipLocalTime;
        }
      }
    }
    
    // Sync playback rate
    if (video.playbackRate !== Math.abs(playbackRate)) {
      video.playbackRate = Math.abs(playbackRate);
    }
    
    // Controlar play/pause
    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, currentTime, activeClip, activeClipVideoUrl, framerate, playbackRate]);
  
  // ??? Men� Contextual (click derecho)
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    clipId: number | null;
    time: number;
  }>({ visible: false, x: 0, y: 0, clipId: null, time: 0 });
  const [clipboardClip, setClipboardClip] = useState<TimelineClip | null>(null);

  // Funci�n para formatear timecode seg�n framerate (HH:MM:SS:FF)
  const formatTimecode = useCallback((seconds: number): string => {
    const totalFrames = Math.floor(seconds * framerate);
    const frames = totalFrames % framerate;
    const totalSeconds = Math.floor(seconds);
    const secs = totalSeconds % 60;
    const mins = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  }, [framerate]);

  // Snap al frame más cercano
  const snapToFrame = useCallback((time: number): number => {
    return Math.round(time * framerate) / framerate;
  }, [framerate]);

  // 🖥️ Fullscreen toggle — CSS-based (avoids stacking context issues with portals/modals)
  const toggleViewerFullscreen = useCallback(() => {
    setIsViewerFullscreen(prev => !prev);
  }, []);

  // ESC key exits CSS fullscreen
  useEffect(() => {
    if (!isViewerFullscreen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsViewerFullscreen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isViewerFullscreen]);

  // ▶️⏸️ Play/Pause animation feedback
  useEffect(() => {
    setPlayPauseAnim(isPlaying ? 'play' : 'pause');
    const timer = setTimeout(() => setPlayPauseAnim(null), 600);
    return () => clearTimeout(timer);
  }, [isPlaying]);

  // 🔍 Viewer zoom helpers
  const viewerZoomIn = useCallback(() => setViewerZoom(z => Math.min(3, +(z + 0.25).toFixed(2))), []);
  const viewerZoomOut = useCallback(() => setViewerZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2))), []);
  const viewerZoomReset = useCallback(() => setViewerZoom(1), []);

  // 📊 Interactive progress bar click handler
  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setCurrentTime(pct * duration);
  }, [duration]);

  const handleProgressBarHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setProgressHoverTime(pct * duration);
    setProgressHoverX(x);
  }, [duration]);

  // Manejador del divisor vertical (visor/timeline)
  useEffect(() => {
    if (!isDraggingVertical) return;
    
    const getY = (e: MouseEvent | TouchEvent) =>
      'touches' in e ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0 : e.clientY;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if ('touches' in e) e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const toolbarHeight = 60;
      const availableHeight = rect.height - toolbarHeight;
      const mouseY = getY(e) - rect.top - toolbarHeight;
      const percentage = (mouseY / availableHeight) * 100;
      setViewerHeight(Math.max(15, Math.min(65, percentage)));
    };
    
    const handleUp = () => setIsDraggingVertical(false);
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [isDraggingVertical]);

  // Manejador del divisor horizontal (visor/galer�a)
  useEffect(() => {
    if (!isDraggingGallery) return;
    
    const getX = (e: MouseEvent | TouchEvent) =>
      'touches' in e ? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0 : e.clientX;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if ('touches' in e) e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = rect.right - getX(e);
      setGalleryWidth(Math.max(80, Math.min(350, mouseX)));
    };
    
    const handleUp = () => setIsDraggingGallery(false);
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [isDraggingGallery]);

  // Manejador del divisor de capas (labels/tracks)
  useEffect(() => {
    if (!isDraggingLayers) return;
    
    const getX = (e: MouseEvent | TouchEvent) =>
      'touches' in e ? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0 : e.clientX;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if ('touches' in e) e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = getX(e) - rect.left;
      setLayerPanelWidth(Math.max(50, Math.min(200, mouseX)));
    };
    
    const handleUp = () => setIsDraggingLayers(false);
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [isDraggingLayers]);

  // Responsive layer width
  useEffect(() => {
    const handleResize = () => setLayerLabelWidth(getLayerLabelWidth());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 📥 Cerrar menu de importacion al hacer clic fuera
  useEffect(() => {
    if (!showImportMenu) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-import-menu]')) {
        setShowImportMenu(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showImportMenu]);

  // 📂 Cerrar menu contextual de galeria al hacer clic fuera
  useEffect(() => {
    if (!galleryContextMenu.visible) return;
    
    const handleClickOutside = () => {
      setGalleryContextMenu({ visible: false, x: 0, y: 0 });
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [galleryContextMenu.visible]);

  // Handler para menu contextual de la galeria
  const handleGalleryContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuWidth = 180;
    const menuHeight = 150;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + menuWidth > viewportWidth - 20) {
      x = viewportWidth - menuWidth - 20;
    }
    if (y + menuHeight > viewportHeight - 20) {
      y = viewportHeight - menuHeight - 20;
    }
    
    setGalleryContextMenu({ visible: true, x, y });
  }, []);

  // Undo/redo - Now powered by useTimelineEngine
  const [editMode, setEditMode] = useState<EditMode>('normal');

  // Section guides from markers (must be defined before engine init)
  const sectionGuides = useMemo(() => markers.filter(m => m.type === 'section').map(m => m.time), [markers]);
  
  // 🎯 Timeline Engine - Professional NLE operations
  const engine = useTimelineEngine({
    zoom,
    duration,
    snapThresholdPx: SNAP_THRESHOLD_PX,
    snapEnabled,
    editMode,
    maxClipDuration: MAX_CLIP_DURATION,
    minClipDuration: MIN_CLIP_DURATION,
    framerate,
    beatGuides: beatGuides,
    sectionGuides: sectionGuides,
    markerPositions: [],
    currentTime,
    preventOverlap: true,
  });

  // Keep engine config in sync with editor state
  useEffect(() => {
    engine.updateConfig({
      zoom,
      duration,
      snapEnabled,
      editMode,
      framerate,
      beatGuides,
      sectionGuides,
      currentTime,
    });
  }, [zoom, duration, snapEnabled, editMode, framerate, beatGuides, sectionGuides, currentTime, engine]);

  // Legacy compatibility: history object for UI (undo/redo button states)
  const history = engine.history;

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playingRaf = useRef<number | null>(null);
  const lastFrameTime = useRef<number>(0);
  
  // 🔊 Ref estable para activeAudioSource — evita que el play effect se re-ejecute
  const activeAudioSourceRef = useRef(activeAudioSource);
  activeAudioSourceRef.current = activeAudioSource;
  
  // Flag para evitar hammering de .play() en cada tick
  const audioStartedRef = useRef(false);

  // 🎯 Play loop — usa performance.now() como reloj maestro, audio se sincroniza
  useEffect(() => {
    if (!isPlaying) {
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      if (playingRaf.current) cancelAnimationFrame(playingRaf.current);
      lastFrameTime.current = 0;
      audioStartedRef.current = false;
      return;
    }
    
    // 🎯 Reloj maestro: performance.now() SIEMPRE es la fuente de tiempo
    const startPlaybackTime = performance.now();
    const startCurrentTime = currentTime;
    audioStartedRef.current = false;
    
    const tick = () => {
      const elapsedMs = performance.now() - startPlaybackTime;
      const elapsedSeconds = (elapsedMs / 1000) * playbackRate;
      let newTime = startCurrentTime + elapsedSeconds;
      
      // Snap al frame exacto
      newTime = Math.round(newTime * framerate) / framerate;
      
      // Limites
      if (newTime >= duration) {
        setIsPlaying(false);
        setCurrentTime(0);
        setPlaybackRate(1);
        if (audioRef.current) audioRef.current.pause();
        audioStartedRef.current = false;
        return;
      }
      if (newTime < 0) {
        setIsPlaying(false);
        setCurrentTime(0);
        setPlaybackRate(1);
        if (audioRef.current) audioRef.current.pause();
        audioStartedRef.current = false;
        return;
      }
      
      // 🔊 Sincronizar audio con el reloj maestro (NO al revés)
      const src = activeAudioSourceRef.current;
      if (audioRef.current && src && playbackRate === 1) {
        const isWithinClip = newTime >= src.clipStart && 
                              newTime < src.clipStart + src.clipDuration;
        if (isWithinClip) {
          const expectedAudioTime = newTime - src.clipStart + src.clipIn;
          
          if (!audioStartedRef.current) {
            // Primer tick: iniciar audio una sola vez
            audioRef.current.currentTime = expectedAudioTime;
            audioRef.current.play().then(() => {
              audioStartedRef.current = true;
            }).catch(() => {
              audioStartedRef.current = true; // No reintentar
            });
          } else if (!audioRef.current.paused) {
            // Corregir drift si audio se desincroniza > 150ms
            const drift = Math.abs(audioRef.current.currentTime - expectedAudioTime);
            if (drift > 0.15) {
              audioRef.current.currentTime = expectedAudioTime;
            }
          }
        } else {
          // Fuera del rango del clip — pausar audio
          if (!audioRef.current.paused) {
            audioRef.current.pause();
            audioStartedRef.current = false;
          }
        }
      }
      
      setCurrentTime(newTime);
      
      // 🎬 Sync Remotion Player with master clock
      if (playerRef.current && useRemotionPreview) {
        const targetFrame = Math.round(newTime * REMOTION_FPS);
        playerRef.current.seekTo(targetFrame);
      }
      
      playingRaf.current = requestAnimationFrame(tick);
    };
    
    playingRaf.current = requestAnimationFrame(tick);
    
    // Sincronizar video con el tiempo actual al iniciar
    if (videoRef.current) {
      videoRef.current.currentTime = currentTime;
      videoRef.current.playbackRate = Math.abs(playbackRate);
      if (playbackRate > 0) {
        videoRef.current.play().catch((err) => {
          console.warn('🎬 [Video] Error al reproducir:', err.message);
        });
      } else {
        videoRef.current.pause();
      }
    }
    
    // 🔊 Iniciar audio inmediatamente (si hay fuente y estamos en rango)
    const src = activeAudioSourceRef.current;
    if (audioRef.current && src) {
      const audioSeekTime = currentTime - src.clipStart + src.clipIn;
      const isWithinClip = currentTime >= src.clipStart && 
                            currentTime < src.clipStart + src.clipDuration;
      
      audioRef.current.volume = isMuted ? 0 : volume;
      
      if (isWithinClip && audioSeekTime >= 0 && playbackRate === 1) {
        audioRef.current.currentTime = audioSeekTime;
        audioRef.current.playbackRate = 1;
        audioRef.current.play()
          .then(() => {
            setAudioReady(true);
            setAudioError(null);
            audioStartedRef.current = true;
          })
          .catch((err) => {
            console.warn('🔊 [Audio] Error al reproducir:', err.message);
            audioStartedRef.current = true; // No reintentar en loop
            if (err.name === 'NotAllowedError') {
              setAudioError('Haz clic para activar audio');
            } else {
              setAudioError(err.message);
            }
          });
      } else {
        audioRef.current.pause();
      }
    }
    
    return () => {
      if (playingRaf.current) cancelAnimationFrame(playingRaf.current);
    };
  // 🔒 NO incluir activeAudioSource — usar ref para evitar restart del loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, duration, framerate, playbackRate, volume, isMuted]);

  // 🔊 Sincronizar volumen en tiempo real (sin reiniciar playback)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.muted = isMuted;
    }
    // 🔊 Sync imported video clip audio volume
    if (activeVideoRef.current && activeClip?.type === ClipType.VIDEO) {
      activeVideoRef.current.volume = isMuted ? 0 : volume;
      activeVideoRef.current.muted = isMuted;
    }
  }, [volume, isMuted, activeClip?.type]);

  // Sync media time on currentTime change if paused (con offset del clip)
  useEffect(() => {
    if (!isPlaying) {
      if (videoRef.current) videoRef.current.currentTime = currentTime;
      if (audioRef.current && activeAudioSourceRef.current) {
        const src = activeAudioSourceRef.current;
        const seekTime = currentTime - src.clipStart + src.clipIn;
        const isWithinClip = currentTime >= src.clipStart && 
                              currentTime < src.clipStart + src.clipDuration;
        if (isWithinClip && seekTime >= 0) {
          audioRef.current.currentTime = seekTime;
        }
      }
    }
  }, [currentTime, isPlaying]);

  // emit onChange
  useEffect(() => {
    onChange?.(clips);
  }, [clips, onChange]);

  const pushHistory = useCallback((newClips: TimelineClip[], operation: string = 'edit') => {
    engine.pushHistory(clipsRef.current, newClips, operation as any, operation);
    clipsRef.current = newClips; // sync ref immediately so subsequent reads are fresh
    setClips(newClips);
  }, [engine]);
  pushHistoryRef.current = pushHistory;

  // 🤖 Aplicar sugerencias del AI Editor Agent
  const handleApplyAgentSuggestions = useCallback((plan: TimelineEditPlan) => {
    if (!plan.suggestions.length) return;

    const newClips = clips.map(clip => {
      const suggestion = plan.suggestions.find(s => s.scene_id === String(clip.id));
      if (!suggestion) return clip;

      const updatedClip = { ...clip };

      // Aplicar duración sugerida
      if (suggestion.suggested_duration > 0 && suggestion.suggested_duration !== clip.duration) {
        updatedClip.duration = Math.round(suggestion.suggested_duration * 100) / 100;
      }

      // Aplicar posición sugerida
      if (suggestion.suggested_start_time >= 0 && suggestion.suggested_start_time !== clip.start) {
        updatedClip.start = Math.round(suggestion.suggested_start_time * 100) / 100;
      }

      // Aplicar micro-edits como efectos
      if (suggestion.micro_edits.length > 0) {
        const existingEffects = updatedClip.effects || [];
        const newEffects = suggestion.micro_edits.map((edit, idx) => ({
          id: `ai-${clip.id}-${idx}`,
          type: edit.type,
          params: edit.parameters,
          start: 0,
          end: 1,
          intensity: edit.parameters?.intensity ?? 0.8,
        }));
        updatedClip.effects = [...existingEffects, ...newEffects];
      }

      return updatedClip;
    });

    pushHistory(newClips, 'ai-agent-edit');

    toast({
      title: '✨ AI Editor Agent',
      description: `${plan.suggestions.length} sugerencias aplicadas (estilo ${plan.editor.name})`,
    });

    logger.info(`✅ [AI-AGENT] Aplicadas ${plan.suggestions.length} sugerencias al timeline`);
  }, [clips, pushHistory, toast]);

  const handleSaveProject = useCallback(async () => {
    // Verificar usuario autenticado
    if (!user?.id) {
      toast({
        title: "🔒 Usuario no autenticado",
        description: "Debes iniciar sesión para guardar proyectos de forma permanente",
        variant: "destructive"
      });
      return;
    }
    
    const name = projectName.trim() || `Proyecto ${new Date().toLocaleDateString()}`;
    
    // Verificar que hay im�genes para guardar
    const imagesWithUrls = generatedImages.filter(img => img.url);
    if (imagesWithUrls.length === 0) {
      toast({
        title: "🖼️ Sin imágenes",
        description: "Genera imágenes antes de guardar el proyecto",
        variant: "destructive"
      });
      return;
    }
    
    setIsSavingProject(true);
    setSaveProgress(0);
    setSaveStatus('Preparando proyecto...');
    
    try {
      // Preparar datos del script para Firebase
      const scriptData = {
        scenes: clips.map((clip, i) => ({
          scene_number: i + 1,
          start_time: clip.start,
          duration: clip.duration,
          scene_description: clip.title || (clip.metadata as any)?.sceneData?.description || `Escena ${i + 1}`,
          prompt: clip.metadata?.prompt || '',
          camera: clip.metadata?.camera || 'Medium shot'
        })),
        duration: duration,
        sceneCount: clips.length
      };
      
      // Preparar im�genes para subir a Firebase Storage
      const imagesToUpload = imagesWithUrls.map((img, i) => ({
        sceneId: `scene-${i + 1}`,
        imageData: img.url // URL temporal de FAL que se convertir� a permanente
      }));
      
      // Crear proyecto con im�genes en Firebase
      const { projectId, project } = await createProjectWithImages(
        name,
        String(user.id),
        scriptData as any,
        imagesToUpload,
        {
          createdFrom: 'TimelineEditor',
          director: projectContext?.videoStyle?.selectedDirector?.name,
          concept: projectContext?.selectedConcept
        },
        (progress, status) => {
          setSaveProgress(progress);
          setSaveStatus(status);
        }
      );
      
      // Actualizar lista de proyectos
      const newProject: SavedProject = {
        id: projectId,
        name,
        thumbnail: project.images?.[0]?.publicUrl,
        clips: clips.map(c => ({
          ...c,
          // Actualizar URLs a las permanentes de Firebase
          url: project.images?.find(img => img.sceneId === `scene-${c.id}`)?.publicUrl || c.url,
          imageUrl: project.images?.find(img => img.sceneId === `scene-${c.id}`)?.publicUrl || c.imageUrl,
        })),
        generatedImages: project.images?.map((img, i) => ({
          id: img.sceneId,
          url: img.publicUrl, // URL permanente de Firebase Storage
          sceneId: img.sceneId
        })) || generatedImages,
        duration: duration,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      };
      
      setSavedProjects(prev => [newProject, ...prev]);
      setProjectName('');
      
      toast({
        title: "✅ Proyecto guardado en la nube",
        description: `"${name}" guardado con ${clips.length} clips. Las imágenes ahora son permanentes.`,
      });
      
    } catch (error) {
      console.error('❌ [FIREBASE] Error guardando proyecto:', error);
      toast({
        title: "❌ Error al guardar",
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: "destructive"
      });
    } finally {
      setIsSavingProject(false);
      setSaveProgress(0);
      setSaveStatus('');
    }
  }, [clips, generatedImages, duration, projectName, user?.id, projectContext, toast]);

  const handleLoadProject = useCallback((project: SavedProject) => {
    logger.info(`?? Cargando proyecto: ${project.name}`);
    logger.info(`?? Clips: ${project.clips?.length || 0}, Im�genes: ${project.generatedImages?.length || 0}`);
    
    // Usar normalizeClips para manejar la conversi�n de formato
    const normalizedClips = normalizeClips(project.clips || []);
    
    // Asociar im�genes generadas a los clips normalizados
    const loadedClips = normalizedClips.map((clip, index) => {
      // Buscar si hay una imagen generada correspondiente
      const matchingImage = (project.generatedImages || []).find(img => {
        const clipSceneNumber = typeof clip.id === 'number' ? clip.id : 
                                parseInt(String(clip.id).match(/(\d+)$/)?.[1] || '0');
        const imgSceneNumber = parseInt(String(img.id).match(/(\d+)$/)?.[1] || '0');
        return imgSceneNumber === clipSceneNumber;
      });
      
      // Si el clip no tiene imagen pero hay una matching, asignarla
      const finalImageUrl = clip.url || clip.imageUrl || matchingImage?.url || '';
      
      return {
        ...clip,
        url: finalImageUrl,
        imageUrl: finalImageUrl,
        thumbnailUrl: clip.thumbnailUrl || finalImageUrl,
      };
    });
    
    logger.info(`? ${loadedClips.filter(c => c.url || c.imageUrl).length} clips con im�genes cargados`);
    logger.info(`?? Clips por capa: Capa 1: ${loadedClips.filter(c => c.layerId === 1).length}, Capa 2: ${loadedClips.filter(c => c.layerId === 2).length}`);
    
    setClips(loadedClips);
    pushHistory(loadedClips);
    setShowProjectsPanel(false);
    
    toast({
      title: "✅ Proyecto cargado",
      description: `"${project.name}" con ${loadedClips.length} clips`,
    });
  }, [pushHistory, toast]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    // Eliminar de Firebase si el usuario est� autenticado
    if (user?.id) {
      try {
        await deleteVideoProject(projectId, String(user.id));
      } catch (error) {
        // Continuar con eliminaci�n local de todas formas
      }
    }
    
    // Eliminar del estado local
    const updated = savedProjects.filter(p => p.id !== projectId);
    setSavedProjects(updated);
    
    toast({
      title: "🗑️ Proyecto eliminado",
      description: "El proyecto y sus imágenes han sido eliminados",
    });
  }, [savedProjects, user?.id, toast]);

  // 🎬 EXPORT VIDEO - Genera el video final a partir del timeline
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExportVideo = useCallback(async () => {
    if (clips.length === 0) {
      toast({
        title: "Sin clips",
        description: "Añade clips al timeline para exportar",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    toast({
      title: "🎬 Iniciando exportación...",
      description: "Preparando video para renderizado",
    });

    try {
      // Preparar datos del timeline para exportar
      const exportData = {
        clips: clips.map(c => ({
          id: c.id,
          start: c.start,
          duration: c.duration,
          layerId: c.layerId,
          type: c.type,
          imageUrl: c.imageUrl || c.url,
          videoUrl: c.metadata?.videoUrl,
          title: c.title,
          effects: c.effects,
          transition: c.transition,
        })),
        duration: duration,
        audioUrl: audioPreviewUrl,
        projectName: projectName || `Export_${new Date().toISOString().slice(0,10)}`,
      };

      // Llamar al endpoint de exportación (apiRequest adjunta el token de Clerk)
      const data = await apiRequest('/api/video-projects/export', {
        method: 'POST',
        data: exportData,
      });

      if (data.downloadUrl) {
        // Descargar directamente
        window.open(data.downloadUrl, '_blank');
        toast({
          title: "✅ Exportación completa",
          description: "Tu video está listo para descargar",
        });
      } else if (data.jobId) {
        // El renderizado está en proceso
        toast({
          title: "⏳ Renderizando video...",
          description: `Job ID: ${data.jobId}. Te notificaremos cuando esté listo.`,
        });
      }

      logger.info('🎬 [Export] Video exportado exitosamente', data);
    } catch (error) {
      logger.error('❌ [Export] Error exportando video:', error);
      toast({
        title: "Error en exportación",
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }, [clips, duration, audioPreviewUrl, projectName, toast]);

  // Duplicate auto-sync effect removed — the effect above (~line 538) already handles
  // generatedImages → clips sync with the correct thumbnailUrl field.
  
  //  Menú Contextual
  const handleContextMenu = useCallback((e: React.MouseEvent, clipId?: number) => {
    e.preventDefault();
    // Calculate timeline time from click position (for "Set Playhead Here")
    const scrollEl = timelineScrollRef.current;
    let time = currentTime; // fallback to playhead position
    if (scrollEl) {
      const rect = scrollEl.getBoundingClientRect();
      const relX = e.clientX - rect.left - layerPanelWidth + scrollEl.scrollLeft;
      const calculatedTime = relX / zoom;
      if (calculatedTime >= 0 && calculatedTime <= duration) {
        time = Math.round(calculatedTime * framerate) / framerate;
      }
    }
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, clipId: clipId || null, time });
  }, [currentTime, zoom, duration, framerate, layerPanelWidth]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleCopyClip = useCallback(() => {
    if (contextMenu.clipId) {
      const clip = clips.find(c => c.id === contextMenu.clipId);
      if (clip) {
        setClipboardClip({ ...clip });
        logger.info('?? Clip copiado:', clip.id);
      }
    }
    closeContextMenu();
  }, [clips, contextMenu.clipId, closeContextMenu]);

  const handlePasteClip = useCallback(() => {
    if (clipboardClip) {
      const newClip: TimelineClip = {
        ...clipboardClip,
        id: Math.max(0, ...clips.map(c => c.id)) + 1,
        start: currentTime,
      };
      pushHistory([...clips, newClip], 'paste');
      logger.info('?? Clip pegado en:', currentTime);
    }
    closeContextMenu();
  }, [clipboardClip, clips, currentTime, pushHistory, closeContextMenu]);

  const handleDuplicateClip = useCallback(() => {
    if (contextMenu.clipId) {
      const clip = clips.find(c => c.id === contextMenu.clipId);
      if (clip) {
        const newClip: TimelineClip = {
          ...clip,
          id: Math.max(0, ...clips.map(c => c.id)) + 1,
          start: clip.start + clip.duration + 0.1,
        };
        pushHistory([...clips, newClip], 'duplicate');
        logger.info('?? Clip duplicado:', clip.id);
      }
    }
    closeContextMenu();
  }, [clips, contextMenu.clipId, pushHistory, closeContextMenu]);

  const handleDeleteClipContext = useCallback(() => {
    if (contextMenu.clipId) {
      const newClips = clips.filter(c => c.id !== contextMenu.clipId);
      pushHistory(newClips, 'delete');
      setSelectedClipId(null);
      logger.info('??? Clip eliminado:', contextMenu.clipId);
    }
    closeContextMenu();
  }, [clips, contextMenu.clipId, pushHistory, closeContextMenu]);

  const handleSplitAtPlayhead = useCallback(() => {
    // Route through the engine's splitClip so snap, in/out and min-duration
    // guards stay identical to the razor tool / keyboard split.
    const targetId = contextMenu.clipId ?? selectedClipId;
    if (targetId != null) {
      const result = engine.splitClip(targetId, currentTime, clipsRef.current);
      if (result) {
        pushHistory(result.clips, 'split');
        logger.info('✂️ Clip dividido en:', currentTime);
      }
    }
    closeContextMenu();
  }, [contextMenu.clipId, selectedClipId, currentTime, engine, pushHistory, closeContextMenu]);

  const handleSetPlayheadHere = useCallback(() => {
    setCurrentTime(contextMenu.time);
    closeContextMenu();
  }, [contextMenu.time, closeContextMenu]);

  // Cerrar men� al hacer click fuera
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) closeContextMenu();
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible, closeContextMenu]);

  // Ref para acceder al estado actual de clips sin closures obsoletas
  const clipsRef = useRef(clips);
  // Also sync on render (catches setClips calls that bypass pushHistory)
  clipsRef.current = clips;

  // Ref al playhead actual — evita re-suscribir el listener de teclado en cada frame
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const doUndo = useCallback(() => {
    const restored = engine.undo(clipsRef.current);
    if (restored) {
      setClips(restored);
    }
  }, [engine]);

  const doRedo = useCallback(() => {
    const restored = engine.redo(clipsRef.current);
    if (restored) {
      setClips(restored);
    }
  }, [engine]);

  // ??? Selecci�n de clips con soporte para multi-select (Shift+Click, Ctrl+Click)
  const handleSelectClip = useCallback((id: number | null, event?: React.MouseEvent) => {
    if (id === null) {
      setSelectedClipId(null);
      setSelectedClipIds(new Set());
      return;
    }
    
    // Shift+Click: Seleccionar rango de clips
    if (event?.shiftKey && selectedClipId !== null) {
      const sortedClips = [...clips].sort((a, b) => a.start - b.start);
      const startIdx = sortedClips.findIndex(c => c.id === selectedClipId);
      const endIdx = sortedClips.findIndex(c => c.id === id);
      
      if (startIdx !== -1 && endIdx !== -1) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = sortedClips.slice(from, to + 1).map(c => c.id);
        setSelectedClipIds(new Set([...Array.from(selectedClipIds), ...rangeIds]));
      }
      return;
    }
    
    // Ctrl/Cmd+Click: Toggle individual en multi-select
    if (event?.ctrlKey || event?.metaKey) {
      setSelectedClipIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
      setSelectedClipId(id);
      return;
    }
    
    // Click normal: Selecci�n simple
    setSelectedClipId(id);
    setSelectedClipIds(new Set([id]));
  }, [clips, selectedClipId, selectedClipIds]);

  const handleDeleteClip = useCallback((id: number) => {
    if (readOnly) return;
    // Use engine for ripple-aware deletion
    const newClips = engine.deleteClip(id, clipsRef.current);
    pushHistory(newClips, rippleEnabled ? 'ripple-delete' : 'delete');
    setSelectedClipId(null);
    setSelectedClipIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, [pushHistory, readOnly, rippleEnabled, engine.deleteClip]);

  // Al comenzar un drag o resize, guardamos el estado inicial via engine
  const handleDragStart = useCallback(() => {
    engine.beginOperation(clipsRef.current);
  }, [engine.beginOperation]);

  const handleResizeStart = useCallback(() => {
    engine.beginOperation(clipsRef.current);
  }, [engine.beginOperation]);

  // Al terminar un drag, guardamos en el historial via engine
  const handleDragEnd = useCallback(() => {
    engine.endOperation(clipsRef.current, 'move', 'Move clip');
  }, [engine.endOperation]);

  // Al terminar un resize, guardamos en el historial via engine
  const handleResizeEnd = useCallback(() => {
    engine.endOperation(clipsRef.current, 'resize-end', 'Resize clip');
  }, [engine.endOperation]);

  const handleMoveClip = useCallback((id: number, newStart: number, newLayerId?: number) => {
    if (readOnly) return;
    const newClips = engine.moveClip(id, newStart, clipsRef.current, newLayerId);
    // Only setClips (no history push) — history is pushed once on drag end
    clipsRef.current = newClips;
    setClips(newClips);
  }, [readOnly, engine.moveClip]);

  const handleSplitClip = useCallback((id: number, timeAtClip: number) => {
    if (readOnly) return;
    const result = engine.splitClip(id, timeAtClip, clipsRef.current);
    if (result) {
      pushHistory(result.clips, 'split');
    }
  }, [readOnly, pushHistory, engine.splitClip]);

  const handleResizeClip = useCallback((id: number, newStart: number, newDuration: number, edge?: string) => {
    if (readOnly) return;
    const resizeEdge = (edge === 'start' || edge === 'end') ? edge : 'end';
    const newClips = engine.resizeClip(id, newStart, newDuration, resizeEdge, clipsRef.current);
    // Only setClips (no history push) — history is pushed once on resize end
    clipsRef.current = newClips;
    setClips(newClips);
  }, [readOnly, engine.resizeClip]);

  const handleRazorClick = useCallback((clipId: number, timeAtClipGlobal: number) => {
    handleSplitClip(clipId, timeAtClipGlobal);
  }, [handleSplitClip]);

  // 🔪 Razor through ALL tracks at playhead (Premiere's Ctrl+Shift+K)
  const handleRazorAllTracks = useCallback(() => {
    if (readOnly) return;
    const currentClips = clipsRef.current;
    const newClips = engine.razorAllTracks(currentTime, currentClips);
    if (newClips.length !== currentClips.length) {
      pushHistory(newClips, 'razor-all');
    }
  }, [readOnly, currentTime, engine.razorAllTracks, pushHistory]);

  // ⚡ APPLY MICROCUTS: Split layer-1 clips into sub-segments with cinematographic effects
  const handleApplyMicroCuts = useCallback(() => {
    if (readOnly || isApplyingMicroCuts) return;
    
    const currentClips = clipsRef.current;
    const layer1Clips = currentClips.filter(c => c.layerId === 1);
    
    if (layer1Clips.length === 0) {
      toast({
        title: "Sin clips",
        description: "No hay clips de imagen en el timeline para aplicar microcortes",
        variant: "destructive",
      });
      return;
    }

    setIsApplyingMicroCuts(true);

    try {
      // Determine number of cuts per clip based on intensity
      const cutsPerClip: Record<string, number> = {
        subtle: 2,
        medium: 3,
        aggressive: 4,
        extreme: 6,
      };
      const numCuts = cutsPerClip[microCutConfig.intensity] || 3;

      // Build ClipContexts for the engine
      const clipContexts: ClipContext[] = layer1Clips.map((clip, idx) => ({
        id: clip.id,
        shotCategory: (clip.shotCategory as 'PERFORMANCE' | 'B-ROLL' | 'STORY') || 'B-ROLL',
        musicSection: mapToMusicSection(clip.metadata?.section || clip.metadata?.musicSection || 'verse'),
        energy: detectSectionEnergy(clip.metadata?.section || clip.metadata?.musicSection || 'medium'),
        duration: clip.duration,
        isKeyMoment: clip.metadata?.isKeyMoment || false,
        shotType: clip.metadata?.shot_type || clip.metadata?.shotType,
        cameraMovement: clip.metadata?.camera_movement || clip.metadata?.cameraMovement || 'smooth',
        emotion: clip.metadata?.emotion || clip.metadata?.mood,
        lyricsSegment: clip.lyricsSegment || clip.metadata?.lyrics,
        isFirstClip: idx === 0,
        isLastClip: idx === layer1Clips.length - 1,
      }));

      // Generate microcut plans for all clips using the engine
      const basePrompts = new Map<number | string, string>();
      layer1Clips.forEach(clip => {
        basePrompts.set(clip.id, clip.metadata?.imagePrompt || clip.title || '');
      });
      const plans = generateTimelineMicroCuts(clipContexts, basePrompts, microCutConfig);
      setMicroCutPlans(plans);

      // Beats reales para sincronía (si el audio fue analizado).
      const beats: number[] = (audioAnalysis?.beats && audioAnalysis.beats.length > 0)
        ? audioAnalysis.beats
        : (audioAnalysis?.downbeats || []);
      const useBeatSync = microCutConfig.beatSync && beats.length > 0;
      let beatSyncedSegments = 0;

      // Now split each layer-1 clip into sub-segments
      let nextId = Math.max(0, ...currentClips.map(c => c.id)) + 1;
      const nonLayer1Clips = currentClips.filter(c => c.layerId !== 1);
      const newLayer1Clips: TimelineClip[] = [];

      for (const clip of layer1Clips) {
        const plan = plans.get(clip.id);
        const effectCount = plan ? Math.min(plan.effects.length, numCuts) : numCuts;
        const actualCuts = Math.max(1, effectCount); // At least 1 segment

        // Only split if clip is long enough (>= 1 second per segment)
        const minSegmentDuration = 1.0;
        if (clip.duration < minSegmentDuration * 2 || actualCuts <= 1) {
          // Clip too short to split or only 1 segment — keep as-is with effect metadata
          const enrichedClip = {
            ...clip,
            metadata: {
              ...clip.metadata,
              microCutEffect: plan?.effects[0]?.effect || 'none',
              microCutPrompt: plan?.enhancedPrompt || clip.metadata?.imagePrompt || '',
              isMicroCut: true,
            },
          };
          newLayer1Clips.push(enrichedClip);
          continue;
        }

        // Compute segment boundaries — beat-synced when possible, else even split
        const segs = useBeatSync
          ? getBeatSyncedSegments(clip.start, clip.duration, beats, actualCuts, minSegmentDuration)
          : Array.from({ length: actualCuts }, (_, i) => {
              const evenDur = clip.duration / actualCuts;
              const segStart = clip.start + (i * evenDur);
              const segDur = (i === actualCuts - 1) ? (clip.start + clip.duration - segStart) : evenDur;
              return {
                start: Math.round(segStart * 100) / 100,
                duration: Math.round(segDur * 100) / 100,
                onBeat: false,
              };
            });

        const effectsPool = plan?.effects || [];
        segs.forEach((seg, i) => {
          if (seg.onBeat) beatSyncedSegments++;
          // Cycle through the plan's effects so each segment gets a distinct one
          const effect = effectsPool.length > 0
            ? effectsPool[i % effectsPool.length]
            : null;
          const effectName = effect?.effect || 'none';
          const effectPrompt = effect?.klingPromptSuffix || '';

          const segment: TimelineClip = {
            ...clip,
            id: i === 0 ? clip.id : nextId++, // Keep original ID for first segment
            start: seg.start,
            duration: seg.duration,
            title: `${clip.title || 'Clip'} [${effectName}]`,
            sourceStart: (clip.sourceStart || 0) + (seg.start - clip.start),
            metadata: {
              ...clip.metadata,
              microCutEffect: effectName,
              microCutIntensity: effect?.intensityMultiplier || 0.5,
              microCutTiming: effect?.timingNote || '',
              microCutPrompt: effect 
                ? `${clip.metadata?.imagePrompt || clip.title || ''}. ${effectPrompt}`
                : clip.metadata?.imagePrompt || '',
              microCutCategory: effect?.category || 'camera',
              microCutMotion: effect?.motionDescription || '',
              microCutOnBeat: seg.onBeat,
              isMicroCut: true,
              originalClipId: clip.id,
              segmentIndex: i,
              totalSegments: segs.length,
            },
          };

          newLayer1Clips.push(segment);
        });
      }

      // Combine and sort
      const allNewClips = [...nonLayer1Clips, ...newLayer1Clips].sort((a, b) => a.start - b.start);
      pushHistory(allNewClips, 'microcuts-apply');

      const totalSegments = newLayer1Clips.length;
      const originalCount = layer1Clips.length;

      toast({
        title: `⚡ Microcortes Aplicados`,
        description: useBeatSync
          ? `${originalCount} clips → ${totalSegments} segmentos · ${beatSyncedSegments} al beat (${microCutConfig.intensity})`
          : `${originalCount} clips → ${totalSegments} segmentos (${microCutConfig.intensity})`,
      });

      logger.info(`⚡ [MicroCuts] Applied: ${originalCount} clips → ${totalSegments} segments (${microCutConfig.intensity}), beatSync=${useBeatSync}, onBeat=${beatSyncedSegments}`);
    } catch (err) {
      logger.error('Error applying microcuts:', err);
      toast({
        title: "Error",
        description: "No se pudieron aplicar los microcortes",
        variant: "destructive",
      });
    } finally {
      setIsApplyingMicroCuts(false);
    }
  }, [readOnly, isApplyingMicroCuts, microCutConfig, pushHistory, toast, generateTimelineMicroCuts, audioAnalysis]);

  // 🧲 Snap query callback for LayerRow visual snap indicators
  const handleSnapQuery = useCallback((time: number, excludeClipId?: number) => {
    return engine.snap(time, clipsRef.current, excludeClipId);
  }, [engine.snap]);

  // Click en timeline/ruler: posiciona el cursor en el frame m�s cercano
  const handleTimelineClick = useCallback((timeGlobal: number) => {
    const clampedTime = clamp(timeGlobal, 0, duration);
    // Snap al frame exacto
    const snappedTime = Math.round(clampedTime * framerate) / framerate;
    setCurrentTime(snappedTime);
    // 🎬 Sync Remotion Player on scrub/click
    if (playerRef.current && useRemotionPreview) {
      playerRef.current.seekTo(Math.round(snappedTime * REMOTION_FPS));
    }
  }, [duration, framerate, useRemotionPreview]);

  // ═══════════════════════════════════════════════════════════
  // PROFESSIONAL NLE ZOOM — centered on playhead or cursor
  // Adjusts scroll so the focus-point stays in place on screen
  // ═══════════════════════════════════════════════════════════
  const MIN_ZOOM = 10;
  const MAX_ZOOM = 1200;
  const ZOOM_FACTOR = 1.2;

  /**
   * Smart zoom that keeps a given time anchored at a given screen-X offset.
   * @param direction 'in' | 'out'
   * @param anchorTime  the timeline-time to keep fixed (seconds)
   * @param anchorScreenX  pixel offset inside the scroll viewport where anchorTime currently sits
   */
  const smartZoom = useCallback((direction: 'in' | 'out', anchorTime?: number, anchorScreenX?: number) => {
    setZoom(prevZoom => {
      const newZoom = direction === 'in'
        ? Math.min(prevZoom * ZOOM_FACTOR, MAX_ZOOM)
        : Math.max(prevZoom / ZOOM_FACTOR, MIN_ZOOM);

      // Adjust scroll to keep anchor point in place
      requestAnimationFrame(() => {
        const el = timelineScrollRef.current;
        if (!el) return;
        const time = anchorTime ?? currentTime;
        const screenX = anchorScreenX ?? (el.clientWidth / 2); // default: center of viewport
        const newScrollLeft = (time * newZoom + layerPanelWidth) - screenX;
        el.scrollLeft = Math.max(0, newScrollLeft);
      });
      return newZoom;
    });
  }, [currentTime, layerPanelWidth]);

  const zoomIn = useCallback(() => smartZoom('in'), [smartZoom]);
  const zoomOut = useCallback(() => smartZoom('out'), [smartZoom]);

  /** Fit entire duration into visible timeline width */
  const zoomToFit = useCallback(() => {
    const el = timelineScrollRef.current;
    if (!el || effectiveDuration <= 0) return;
    const availableWidth = el.clientWidth - layerPanelWidth - 40;
    const fitZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, availableWidth / effectiveDuration));
    setZoom(fitZoom);
    requestAnimationFrame(() => {
      if (timelineScrollRef.current) timelineScrollRef.current.scrollLeft = 0;
    });
  }, [effectiveDuration, layerPanelWidth]);

  /** Ctrl+MouseWheel zoom handler for the timeline scroll area */
  const handleTimelineWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Only zoom on Ctrl/Meta + wheel; let normal scroll pass through
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    e.stopPropagation();

    const el = timelineScrollRef.current;
    if (!el) return;

    // Calculate the time under the cursor
    const rect = el.getBoundingClientRect();
    const cursorScreenX = e.clientX - rect.left;
    const cursorTimelineX = el.scrollLeft + cursorScreenX - layerPanelWidth;
    const cursorTime = Math.max(0, cursorTimelineX / zoom);

    // Zoom centered on cursor position
    const direction = e.deltaY < 0 ? 'in' : 'out';
    smartZoom(direction, cursorTime, cursorScreenX);
  }, [zoom, layerPanelWidth, smartZoom]);

  // ?? Shortcuts Profesionales (J/K/L, Ctrl+Z, Multi-select, etc)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignorar si estamos en un input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Ctrl/Cmd shortcuts
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            doRedo();
          } else {
            doUndo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          doRedo();
        } else if (e.key.toLowerCase() === 'a') {
          e.preventDefault();
          const allIds = new Set(clips.map(c => c.id));
          setSelectedClipIds(allIds);
          const firstId = clips.length > 0 ? clips[0].id : null;
          if (firstId !== null) setSelectedClipId(firstId);
        } else if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          setSelectedClipIds(new Set());
          setSelectedClipId(null);
        } else if (e.key.toLowerCase() === 'k') {
          // ✂️ Cmd/Ctrl+K = cortar en el playhead (como Premiere). Con Shift = cortar TODAS las pistas.
          e.preventDefault();
          if (!readOnly) {
            if (e.shiftKey) {
              handleRazorAllTracks();
            } else if (selectedClipId !== null) {
              handleSplitClip(selectedClipId, currentTimeRef.current);
            } else {
              handleRazorAllTracks();
            }
          }
        } else if (e.key.toLowerCase() === 'c') {
          // 📋 Cmd/Ctrl+C = copiar el clip seleccionado (solo si hay selección; sino deja copiar texto)
          if (selectedClipId !== null) {
            const clip = clipsRef.current.find(c => c.id === selectedClipId);
            if (clip) {
              e.preventDefault();
              setClipboardClip({ ...clip });
            }
          }
        } else if (e.key.toLowerCase() === 'v') {
          // 📌 Cmd/Ctrl+V = pegar el clip del portapapeles en el playhead
          if (clipboardClip && !readOnly) {
            e.preventDefault();
            const pasteClips = clipsRef.current;
            const newClip: TimelineClip = {
              ...clipboardClip,
              id: Math.max(0, ...pasteClips.map(c => c.id)) + 1,
              start: currentTimeRef.current,
            };
            pushHistory([...pasteClips, newClip], 'paste');
          }
        }
        return;
      }
      
      // ?? J/K/L Playback Control
      if (e.code === 'KeyJ') {
        e.preventDefault();
        setPlaybackRate(prev => prev > 0 ? -1 : Math.max(-4, prev - 1));
        setIsPlaying(true);
      }
      // K = Stop playback (J/K/L). Guard against Ctrl+Shift+K (razor all tracks).
      if (e.code === 'KeyK' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsPlaying(false);
        setPlaybackRate(1);
      }
      if (e.code === 'KeyL') {
        e.preventDefault();
        if (!isPlaying) {
          setIsPlaying(true);
          setPlaybackRate(1);
        } else {
          setPlaybackRate(prev => prev < 0 ? 1 : Math.min(4, prev + 1));
        }
      }
      
      // Space = Play/Pause
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
        setPlaybackRate(1);
      }
      
      // Tool shortcuts
      if (e.code === 'KeyV') setTool('select');
      if (e.code === 'KeyC') setTool('razor');
      if (e.code === 'KeyT') setTool('trim');
      if (e.code === 'KeyH') setTool('hand');
      
      // Delete selected clips - engine-powered with multi-select support
      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        if (readOnly) return;
        if (selectedClipIds.size > 0) {
          const newClips = engine.deleteMultipleClips(selectedClipIds, clips);
          pushHistory(newClips, 'multi-delete');
          setSelectedClipIds(new Set());
          setSelectedClipId(null);
        } else if (selectedClipId !== null) {
          const newClips = engine.deleteClip(selectedClipId, clips);
          pushHistory(newClips, rippleEnabled ? 'ripple-delete' : 'delete');
          setSelectedClipId(null);
        }
      }

      //  Cycle edit mode: N=normal, B=ripple, G=roll, S=slip (when not in input)
      if (e.code === 'KeyN' && !e.ctrlKey && !e.metaKey) {
        setEditMode('normal');
        engine.updateConfig({ editMode: 'normal' });
      }
      if (e.code === 'KeyB' && !e.ctrlKey && !e.metaKey) {
        setEditMode('ripple');
        setRippleEnabled(true);
        engine.updateConfig({ editMode: 'ripple' });
      }
      if (e.code === 'KeyG' && !e.ctrlKey && !e.metaKey) {
        setEditMode('roll');
        engine.updateConfig({ editMode: 'roll' });
      }
      
      // Zoom
      if (e.code === 'Equal' || e.code === 'Plus') {
        e.preventDefault();
        zoomIn();
      }
      if (e.code === 'Minus') {
        e.preventDefault();
        zoomOut();
      }
      // Shift+Z = Fit to Window (como Premiere Pro)
      if (e.code === 'KeyZ' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomToFit();
      }
      
      // Navigation
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? (1 / framerate) : e.ctrlKey ? 5 : 1;
        setCurrentTime(t => Math.round(Math.max(0, t - step) * framerate) / framerate);
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? (1 / framerate) : e.ctrlKey ? 5 : 1;
        setCurrentTime(t => Math.round(Math.min(duration, t + step) * framerate) / framerate);
      }
      if (e.code === 'Comma') {
        e.preventDefault();
        setCurrentTime(t => Math.round(Math.max(0, t - (1 / framerate)) * framerate) / framerate);
      }
      if (e.code === 'Period') {
        e.preventDefault();
        setCurrentTime(t => Math.round(Math.min(duration, t + (1 / framerate)) * framerate) / framerate);
      }
      if (e.code === 'Home') {
        e.preventDefault();
        setCurrentTime(0);
      }
      if (e.code === 'End') {
        e.preventDefault();
        setCurrentTime(Math.round(duration * framerate) / framerate);
      }
      if (e.code === 'Escape') {
        if (isViewerFullscreen) {
          setIsViewerFullscreen(false);
          return;
        }
        setSelectedClipIds(new Set());
        setSelectedClipId(null);
        setShowImportMenu(false);
      }
      
      // 🖥️ F11 = Toggle viewer fullscreen
      if (e.code === 'F11') {
        e.preventDefault();
        toggleViewerFullscreen();
      }
      
      // ?? Import shortcut
      if (e.code === 'KeyI' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleOpenFilePicker('all');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration, framerate, clips, selectedClipId, selectedClipIds, isPlaying, readOnly, rippleEnabled, doUndo, doRedo, pushHistory, zoomIn, zoomOut, zoomToFit, handleSplitClip, handleRazorAllTracks, clipboardClip]);

  // ===== HANDLERS PARA ACCIONES SOBRE CLIPS =====

  // Actualizar un clip espec�fico
  const updateClip = useCallback((clipId: number, updates: Partial<TimelineClip>) => {
    const currentClips = clipsRef.current;
    const newClips = currentClips.map(c => 
      c.id === clipId ? { ...c, ...updates } : c
    );
    pushHistory(newClips, 'edit');
  }, [pushHistory]);

  // Apply a director suggestion to the timeline
  const handleApplyDirectorSuggestion = useCallback((suggestion: DirectorSuggestion) => {
    if (!suggestion.changes) return;
    // Snapshot clips before first director change for revert
    if (!directorClipsSnapshot) {
      setDirectorClipsSnapshot([...clips]);
    }
    if (suggestion.clipId) {
      const changes = suggestion.changes;
      const updates: Partial<TimelineClip> = {};
      if (changes.shotType) updates.shotType = changes.shotType as string;
      if (changes.duration) updates.duration = changes.duration as number;
      if (changes.lyricsSegment) updates.lyricsSegment = changes.lyricsSegment as string;
      if (changes.newPrompt) {
        setClips(prev => prev.map(c => 
          c.id === suggestion.clipId 
            ? { ...c, ...updates, metadata: { ...c.metadata, prompt: changes.newPrompt } } 
            : c
        ));
      } else {
        updateClip(suggestion.clipId, updates);
      }
    }
    setDirectorAppliedCount(prev => prev + 1);
  }, [clips, directorClipsSnapshot, updateClip]);

  // Revert all director suggestions
  const handleRevertDirectorChanges = useCallback(() => {
    if (directorClipsSnapshot) {
      setClips(directorClipsSnapshot);
      setDirectorClipsSnapshot(null);
      setDirectorAppliedCount(0);
      toast({ title: 'Director changes reverted', description: 'All director suggestions have been undone.' });
    }
  }, [directorClipsSnapshot, setClips, toast]);

  // Apply a chat action to a clip
  const handleApplyChatAction = useCallback((clip: TimelineClip, action: DirectorChatAction) => {
    if (!directorClipsSnapshot) {
      setDirectorClipsSnapshot([...clips]);
    }
    const updates: Partial<TimelineClip> = {};
    let metaUpdates: Record<string, any> | null = null;

    switch (action.type) {
      case 'shot_type':
        updates.shotType = action.value;
        break;
      case 'duration':
        updates.duration = Number(action.value) || clip.duration;
        break;
      case 'camera':
        metaUpdates = { cameraMovement: action.value };
        break;
      case 'lens':
        metaUpdates = { lensType: action.value };
        break;
      case 'lighting':
        metaUpdates = { lightingType: action.value };
        break;
      case 'regenerate':
        metaUpdates = { prompt: action.value };
        break;
      case 'transition':
        if (typeof action.value === 'object') {
          updates.transition = { type: action.value.type, duration: action.value.duration || 0.5 };
        }
        break;
    }

    if (metaUpdates) {
      setClips(prev => prev.map(c =>
        c.id === clip.id ? { ...c, ...updates, metadata: { ...c.metadata, ...metaUpdates } } : c
      ));
    } else {
      updateClip(clip.id, updates);
    }
    setDirectorAppliedCount(prev => prev + 1);
    toast({ title: `${activeDirector?.name || 'Director'} change applied`, description: action.label });
  }, [clips, directorClipsSnapshot, updateClip, activeDirector, toast]);

  // ===== ?? IMPORTACI�N DE ARCHIVOS MULTIMEDIA =====
  
  // Obtener tipos de archivo aceptados seg�n el tipo de importaci�n
  const getAcceptedFileTypes = useCallback((type: 'image' | 'audio' | 'video' | 'all') => {
    switch (type) {
      case 'image':
        return 'image/jpeg,image/png,image/gif,image/webp';
      case 'audio':
        return 'audio/mpeg,audio/wav,audio/ogg,audio/mp3,audio/aac,audio/m4a';
      case 'video':
        return 'video/mp4,video/webm,video/quicktime,video/x-msvideo';
      case 'all':
      default:
        return 'image/jpeg,image/png,image/gif,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/mp3,video/mp4,video/webm,video/quicktime';
    }
  }, []);

  // Detectar tipo de archivo
  const detectFileType = useCallback((file: File): 'image' | 'audio' | 'video' | null => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    return null;
  }, []);

  // Abrir selector de archivos
  const handleOpenFilePicker = useCallback((type: 'image' | 'audio' | 'video' | 'all' = 'all') => {
    setImportType(type);
    setShowImportMenu(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = getAcceptedFileTypes(type);
      fileInputRef.current.click();
    }
  }, [getAcceptedFileTypes]);

  // Procesar archivos seleccionados
  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    logger.info(`?? [Import] Procesando ${files.length} archivo(s)...`);

    try {
      const newClips: TimelineClip[] = [];
      const maxClipId = clips.reduce((max, c) => Math.max(max, typeof c.id === 'number' ? c.id : 0), 0);
      let clipIdCounter = maxClipId + 1000; // Offset para nuevos clips importados

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileType = detectFileType(file);
        
        if (!fileType) {
          toast({
            title: "Tipo no soportado",
            description: `El archivo "${file.name}" no es compatible`,
            variant: "destructive"
          });
          continue;
        }

        // Crear URL temporal para el archivo
        const objectUrl = URL.createObjectURL(file);
        
        // Calcular posici�n de inicio (despu�s del �ltimo clip de ese tipo)
        const existingClipsOfType = clips.filter(c => {
          if (fileType === 'image') return c.layerId === 1;
          if (fileType === 'audio') return c.layerId === 2;
          if (fileType === 'video') return c.layerId === 1;
          return false;
        });
        const lastClipEnd = existingClipsOfType.length > 0 
          ? Math.max(...existingClipsOfType.map(c => c.start + c.duration))
          : 0;

        // Obtener duraci�n para audio/video
        let fileDuration = 3; // Default para im�genes
        
        if (fileType === 'audio' || fileType === 'video') {
          fileDuration = await new Promise<number>((resolve) => {
            const media = fileType === 'audio' 
              ? new Audio() 
              : document.createElement('video');
            media.onloadedmetadata = () => {
              resolve(media.duration || 3);
            };
            media.onerror = () => resolve(3);
            media.src = objectUrl;
          });
        }

        const newClip: TimelineClip = {
          id: clipIdCounter++,
          layerId: fileType === 'audio' ? 2 : 1, // Audio en capa 2, imagen/video en capa 1
          type: fileType === 'image' ? ClipType.IMAGE 
              : fileType === 'audio' ? ClipType.AUDIO 
              : ClipType.VIDEO,
          start: currentTime > 0 ? currentTime : lastClipEnd, // Insertar en playhead o al final
          duration: fileType === 'audio'
            ? fileDuration  // Audio: full file duration — user can trim/move freely
            : Math.min(fileDuration, Math.max(0.5, duration - (currentTime > 0 ? currentTime : lastClipEnd))),
          url: objectUrl,
          imageUrl: fileType === 'image' ? objectUrl : undefined,
          title: file.name,
          // Campos necesarios para el sistema de arrastre
          in: 0,
          out: fileDuration,
          sourceStart: 0,
          metadata: {
            isImported: true,
            originalFileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            importedAt: new Date().toISOString()
          }
        };

        newClips.push(newClip);
        logger.info(`?? [Import] Clip creado: ${file.name} (${fileType})`);
      }

      if (newClips.length > 0) {
        const allClips = [...clips, ...newClips];
        pushHistory(allClips, 'import');
        
        // 📂 Add imported files to gallery panel
        const newMediaItems: ImportedMediaItem[] = newClips.map(c => ({
          id: `imported-${c.id}-${Date.now()}`,
          url: c.url || '',
          name: c.title || 'Imported',
          type: (c.type === 'AUDIO' ? 'audio' : c.type === 'VIDEO' ? 'video' : 'image') as 'image' | 'audio' | 'video',
          mimeType: c.metadata?.mimeType || '',
          addedAt: Date.now(),
        }));
        setImportedMedia(prev => [...prev, ...newMediaItems]);
        
        toast({
          title: "✅ Archivos importados",
          description: `${newClips.length} archivo(s) añadido(s) al timeline`,
        });
      }

    } catch (error) {
      logger.error('❌ [Import] Error importando archivos:', error);
      toast({
        title: "Error de importación",
        description: "No se pudieron importar los archivos",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      // Limpiar el input para permitir reimportar el mismo archivo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [clips, currentTime, duration, detectFileType, pushHistory, toast]);

  // ==========================================
  // 🎬 PREMIERE-STYLE DRAG & DROP SYSTEM
  // ==========================================
  const RULER_HEIGHT = 48;
  const TOTAL_LAYERS = 3;

  /** Calculate drop position (time + layer) from mouse coordinates */
  const calcDropPosition = useCallback((clientX: number, clientY: number) => {
    const scrollEl = timelineScrollRef.current;
    if (!scrollEl) return null;
    const rect = scrollEl.getBoundingClientRect();
    const scrollLeft = scrollEl.scrollLeft;

    // Time from X position
    const relX = clientX - rect.left - layerPanelWidth + scrollLeft;
    const time = Math.max(0, relX / zoom);

    // Layer from Y position (skip ruler)
    const relY = clientY - rect.top - RULER_HEIGHT;
    const layerIndex = Math.floor(relY / DEFAULT_LAYER_HEIGHT);
    const layerId = Math.max(1, Math.min(TOTAL_LAYERS, layerIndex + 1));

    return { time, layerId };
  }, [layerPanelWidth, zoom]);

  const handleTimelineDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Set the drop effect to "copy" for a nice cursor icon
    event.dataTransfer.dropEffect = 'copy';
    // Update the drop indicator position
    const pos = calcDropPosition(event.clientX, event.clientY);
    if (pos) setDropIndicator(pos);
  }, [calcDropPosition]);

  const handleTimelineDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setIsDraggingFileOver(true);
    }
  }, []);

  const handleTimelineDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingFileOver(false);
      setDropIndicator(null);
    }
  }, []);

  /** Position-aware drop: places clips exactly where the user drops them */
  const handleTimelineDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Reset drag visual state
    dragCounterRef.current = 0;
    setIsDraggingFileOver(false);
    setDropIndicator(null);

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Calculate exact drop position from cursor
    const pos = calcDropPosition(event.clientX, event.clientY);
    const dropTime = pos ? pos.time : (currentTime > 0 ? currentTime : 0);
    const dropLayerId = pos ? pos.layerId : 1;

    setIsImporting(true);
    logger.info(`🎬 [Drop] Procesando ${files.length} archivo(s) en t=${dropTime.toFixed(2)}s, capa=${dropLayerId}`);

    try {
      const newClips: TimelineClip[] = [];
      const maxClipId = clips.reduce((max, c) => Math.max(max, typeof c.id === 'number' ? c.id : 0), 0);
      let clipIdCounter = maxClipId + 1000;
      let nextStart = dropTime; // Stack multiple files one after another from drop point

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileType = detectFileType(file);
        if (!fileType) {
          toast({ title: 'Tipo no soportado', description: `"${file.name}" no es compatible`, variant: 'destructive' });
          continue;
        }

        const objectUrl = URL.createObjectURL(file);

        // Determine target layer: use drop position, but override for audio if dropped on video layer
        let targetLayerId = dropLayerId;
        if (fileType === 'audio' && dropLayerId === 1) targetLayerId = 2; // Audio always goes to audio layer
        if ((fileType === 'image' || fileType === 'video') && dropLayerId === 2) targetLayerId = 1; // Visual always to video layer

        // Get duration for audio/video
        let fileDuration = 3;
        if (fileType === 'audio' || fileType === 'video') {
          fileDuration = await new Promise<number>((resolve) => {
            const media = fileType === 'audio' ? new Audio() : document.createElement('video');
            media.onloadedmetadata = () => resolve(media.duration || 3);
            media.onerror = () => resolve(3);
            media.src = objectUrl;
          });
        }

        const clipDuration = fileType === 'audio'
          ? fileDuration
          : Math.min(fileDuration, Math.max(0.5, duration - nextStart));

        const newClip: TimelineClip = {
          id: clipIdCounter++,
          layerId: targetLayerId,
          type: fileType === 'image' ? ClipType.IMAGE : fileType === 'audio' ? ClipType.AUDIO : ClipType.VIDEO,
          start: nextStart,
          duration: clipDuration,
          url: objectUrl,
          imageUrl: fileType === 'image' ? objectUrl : undefined,
          title: file.name,
          in: 0,
          out: fileDuration,
          sourceStart: 0,
          metadata: {
            isImported: true,
            originalFileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            importedAt: new Date().toISOString()
          }
        };

        newClips.push(newClip);
        nextStart += clipDuration; // Stack sequentially from drop point
        logger.info(`📎 [Drop] Clip: ${file.name} → layer ${targetLayerId} @ ${newClip.start.toFixed(2)}s`);
      }

      if (newClips.length > 0) {
        const allClips = [...clips, ...newClips];
        pushHistory(allClips, 'import');

        const newMediaItems: ImportedMediaItem[] = newClips.map(c => ({
          id: `imported-${c.id}-${Date.now()}`,
          url: c.url || '',
          name: c.title || 'Imported',
          type: (c.type === 'AUDIO' ? 'audio' : c.type === 'VIDEO' ? 'video' : 'image') as 'image' | 'audio' | 'video',
          mimeType: c.metadata?.mimeType || '',
          addedAt: Date.now(),
        }));
        setImportedMedia(prev => [...prev, ...newMediaItems]);

        toast({
          title: '🎬 Archivos importados',
          description: `${newClips.length} archivo(s) añadido(s) en ${dropTime.toFixed(1)}s`,
        });
      }
    } catch (error) {
      logger.error('❌ [Drop] Error:', error);
      toast({ title: 'Error de importación', description: 'No se pudieron importar los archivos', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  }, [clips, currentTime, duration, detectFileType, pushHistory, toast, calcDropPosition]);

  // ?? Editar Imagen con Nano Banana AI
  const handleEditImage = useCallback((clip: TimelineClip) => {
    setImageEditorModalClip(clip);
    setShowImageEditorModal(true);
    logger.info(`?? [Timeline] Abriendo editor de imagen para clip ${clip.id}`);
  }, []);

  const handleImageEdited = useCallback((newImageUrl: string, newPrompt: string) => {
    if (imageEditorModalClip) {
      updateClip(imageEditorModalClip.id, {
        imageUrl: newImageUrl,
        url: newImageUrl,
        generatedImageUrl: newImageUrl,
        metadata: {
          ...imageEditorModalClip.metadata,
          imagePrompt: newPrompt,
          isGeneratedImage: true
        }
      });
      toast({
        title: "Image Updated",
        description: "The image has been replaced in the timeline.",
      });
      logger.info(`? [Timeline] Imagen editada para clip ${imageEditorModalClip.id}`);
    }
    setShowImageEditorModal(false);
    setImageEditorModalClip(null);
  }, [imageEditorModalClip, updateClip, toast]);

  // ?? Agregar M�sico
  const handleAddMusician = useCallback((clip: TimelineClip) => {
    setMusicianModalClip(clip);
    setShowMusicianModal(true);
    logger.info(`🎸 [Timeline] Opening musician modal for clip ${clip.id}`);
  }, []);

  const handleMusicianAdded = useCallback((musicianData: any) => {
    if (musicianModalClip) {
      const rawType = String(musicianData?.musicianType || 'Musician');
      const instrumentLabel = rawType.charAt(0).toUpperCase() + rawType.slice(1);
      const cleanTitle = (musicianModalClip.title || 'Scene').replace(/^\[[^\]]+\]\s*/, '');
      const nextTitle = `[${instrumentLabel}] ${cleanTitle}`;

      updateClip(musicianModalClip.id, {
        title: nextTitle,
        metadata: {
          ...musicianModalClip.metadata,
          musicianIntegrated: true,
          musicianData: musicianData
        }
      });
      toast({
        title: "Musician added",
        description: `${musicianData.musicianType || 'Musician'} added to timeline`,
      });
      logger.info(`✅ [Timeline] Musician added to clip ${musicianModalClip.id}`);
    }
    setShowMusicianModal(false);
    setMusicianModalClip(null);
  }, [musicianModalClip, updateClip, toast]);

  const handleDuplicateMusicianToNearby = useCallback((musicianData: any) => {
    if (!musicianModalClip) return;

    const source = musicianModalClip;
    const rawType = String(musicianData?.musicianType || 'Musician');
    const instrumentLabel = rawType.charAt(0).toUpperCase() + rawType.slice(1);
    const sourceTime = source.start;
    const nearbyWindowSec = 8;

    const currentClips = clipsRef.current;
    const targetIds = currentClips
      .filter(c => c.id !== source.id)
      .filter(c => c.layerId === source.layerId)
      .filter(c => c.type !== ClipType.AUDIO)
      .filter(c => Math.abs(c.start - sourceTime) <= nearbyWindowSec)
      .map(c => c.id);

    const nextClips = currentClips.map(c => {
      const shouldApply = c.id === source.id || targetIds.includes(c.id);
      if (!shouldApply) return c;

      const cleanTitle = (c.title || 'Scene').replace(/^\[[^\]]+\]\s*/, '');
      return {
        ...c,
        title: `[${instrumentLabel}] ${cleanTitle}`,
        metadata: {
          ...c.metadata,
          musicianIntegrated: true,
          musicianData,
        },
      };
    });

    pushHistory(nextClips, 'edit');

    toast({
      title: 'Musician applied to nearby clips',
      description: `Updated ${targetIds.length + 1} clip(s) within ${nearbyWindowSec}s window.`,
    });

    logger.info(`🎸 [Timeline] Musician duplicated to ${targetIds.length + 1} clips around ${source.id}`);

    setShowMusicianModal(false);
    setMusicianModalClip(null);
  }, [musicianModalClip, pushHistory, toast]);

  // Camera angles
  const handleCameraAngles = useCallback((clip: TimelineClip) => {
    setCameraAnglesModalClip(clip);
    setShowCameraAnglesModal(true);
    logger.info(`📷 [Timeline] Opening camera angles modal for clip ${clip.id}`);
  }, []);

  const handleCameraAngleSelected = useCallback((imageUrl: string, angleName: string) => {
    if (cameraAnglesModalClip) {
      updateClip(cameraAnglesModalClip.id, {
        imageUrl,
        thumbnailUrl: imageUrl,
        metadata: {
          ...cameraAnglesModalClip.metadata,
          cameraAngle: angleName,
        },
      });
      toast({
        title: "Camera angle applied",
        description: `"${angleName}" was applied to this clip.`,
      });
      logger.info(`✅ [Timeline] Camera angle applied to clip ${cameraAnglesModalClip.id}`);
    }
  }, [cameraAnglesModalClip, updateClip, toast]);

  const handleDuplicateCameraAngleToNearby = useCallback((imageUrl: string, angleName: string) => {
    if (!cameraAnglesModalClip) return;

    const source = cameraAnglesModalClip;
    const sourceTime = source.start;
    const nearbyWindowSec = 8;

    const currentClips = clipsRef.current;
    const targetIds = currentClips
      .filter(c => c.id !== source.id)
      .filter(c => c.layerId === source.layerId)
      .filter(c => c.type !== ClipType.AUDIO)
      .filter(c => Math.abs(c.start - sourceTime) <= nearbyWindowSec)
      .map(c => c.id);

    const nextClips = currentClips.map(c => {
      const shouldApply = c.id === source.id || targetIds.includes(c.id);
      if (!shouldApply) return c;

      return {
        ...c,
        imageUrl,
        thumbnailUrl: imageUrl,
        metadata: {
          ...c.metadata,
          cameraAngle: angleName,
        },
      };
    });

    pushHistory(nextClips, 'edit');

    toast({
      title: 'Camera angle duplicated',
      description: `Updated ${targetIds.length + 1} clip(s) in a ${nearbyWindowSec}s window.`,
    });

    logger.info(`📷 [Timeline] Camera angle duplicated to ${targetIds.length + 1} clips around ${source.id}`);

    setShowCameraAnglesModal(false);
    setCameraAnglesModalClip(null);
  }, [cameraAnglesModalClip, pushHistory, toast]);

  // 🔀 Variations — open panel for a clip
  const handleVariations = useCallback((clip: TimelineClip) => {
    setVariationsClip(clip);
    setShowVariationsPanel(true);
    logger.info(`🔀 [Timeline] Opening variations panel for clip ${clip.id}`);
  }, []);

  // ⭐ Use as Style — opens Image Generator with style reference
  const handleUseAsStyle = useCallback((clip: TimelineClip) => {
    const url = clip.imageUrl || clip.url || clip.thumbnailUrl;
    if (url) {
      setImageGenReference({ url, type: 'style' });
      setShowImageGenerator(true);
    }
  }, []);

  // ❤️ Like — toggle clip favourite
  const handleLike = useCallback((clip: TimelineClip) => {
    setLikedClips(prev => {
      const next = new Set(prev);
      if (next.has(clip.id)) {
        next.delete(clip.id);
        toast({ title: '💔 Removed from liked' });
      } else {
        next.add(clip.id);
        toast({ title: '❤️ Liked!' });
      }
      return next;
    });
  }, [toast]);

  // � Choreography — open MotionSync panel on choreography tab
  const [motionSyncInitialTab, setMotionSyncInitialTab] = useState<'motion' | 'choreography'>('motion');
  const handleChoreography = useCallback((clip: TimelineClip) => {
    setMotionSyncInitialTab('choreography');
    setShowMotionSyncPanel(true);
    logger.info(`💃 [Timeline] Opening choreography panel for clip ${clip.id}`);
  }, []);

  // �🔍 Upscale — call FAL creative upscaler
  const handleUpscale = useCallback(async (clip: TimelineClip) => {
    const imgUrl = clip.imageUrl || clip.url || clip.thumbnailUrl;
    if (!imgUrl) return;

    setIsUpscaling(clip.id);
    try {
      const res = await fetch('/api/fal/nano-banana/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imgUrl, scale: 2 }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upscale failed');

      updateClip(clip.id, {
        imageUrl: data.imageUrl,
        url: data.imageUrl,
        thumbnailUrl: data.imageUrl,
        metadata: {
          ...clip.metadata,
          upscaled: true,
          originalImageUrl: imgUrl,
        },
      });

      toast({ title: '🔍 Image upscaled!', description: `${data.scale}x resolution` });
      logger.info(`🔍 [Timeline] Upscaled clip ${clip.id}`);
    } catch (err: any) {
      console.error('Upscale error:', err);
      toast({ title: 'Upscale failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUpscaling(null);
    }
  }, [updateClip, toast]);

  // ?? Regenerar Imagen - Usando FAL Nano-Banana CON CONTEXTO DEL PROYECTO
  const [isRegenerating, setIsRegenerating] = useState<number | null>(null);
  
  const handleRegenerateImage = useCallback(async (clip: TimelineClip) => {
    logger.info(`?? [Timeline] Regenerando imagen para clip ${clip.id} CON CONTEXTO`);
    setIsRegenerating(clip.id);
    
    toast({
      title: "Regenerando imagen...",
      description: "Generando nueva imagen coherente con el concepto del video",
    });

    try {
      // ?? Construir prompt ENRIQUECIDO con contexto del proyecto
      const basePrompt = clip.metadata?.imagePrompt || clip.title || '';
      
      // Extraer contexto del proyecto
      const concept = projectContext?.selectedConcept;
      const director = projectContext?.videoStyle?.selectedDirector;
      const hasReferenceImages = (projectContext?.artistReferenceImages?.length ?? 0) > 0 || 
                                  !!projectContext?.masterCharacter;
      
      // Intentar extraer info de la escena desde el script
      let sceneContext = '';
      if (projectContext?.scriptContent) {
        try {
          const parsedScript = JSON.parse(projectContext.scriptContent);
          const scenes = parsedScript.scenes || parsedScript;
          // Buscar la escena que corresponde al clip por timing o �ndice
          const clipIndex = clips.findIndex(c => c.id === clip.id);
          const scene = scenes[clipIndex];
          
          if (scene) {
            sceneContext = `
SCENE CONTEXT:
Visual: ${scene.visual_description || scene.description || ''}
Narrative: ${scene.narrative_context || ''}
Lyrics: ${scene.lyric_connection || ''}
Emotion: ${scene.emotion || scene.mood || ''}
Shot Type: ${scene.shot_type || 'medium-shot'}
Camera: ${scene.camera_movement || 'static'}
Location: ${scene.location || ''}
Lighting: ${scene.lighting || 'cinematic lighting'}`;
          }
        } catch (e) {
          logger.warn('Could not parse script for context');
        }
      }
      
      // Construir el prompt completo con todo el contexto
      const enrichedPrompt = `MUSIC VIDEO FRAME:
${concept?.story_concept ? `Concept: ${concept.story_concept}` : ''}
${concept?.visual_style ? `Visual Style: ${concept.visual_style}` : ''}
${concept?.mood ? `Mood: ${concept.mood}` : ''}
${director?.name ? `Director Style: ${director.name}` : ''}
${sceneContext}

SCENE DESCRIPTION:
${basePrompt || 'Professional music video scene'}

TECHNICAL:
High production quality, cinematic, 16:9 aspect ratio, professional lighting, cohesive with music video narrative.
${concept?.color_palette ? `Color Palette: ${concept.color_palette}` : ''}`.trim();
      
      logger.info(`?? [Timeline] Prompt enriquecido:`, enrichedPrompt.substring(0, 200) + '...');
      
      // Determinar si usar referencia del artista
      const shouldUseReference = hasReferenceImages && 
        (clip.metadata?.shotCategory === 'PERFORMANCE' || !clip.metadata?.shotCategory);
      
      const referenceImages = shouldUseReference 
        ? (projectContext?.masterCharacter 
            ? [projectContext.masterCharacter.imageUrl] 
            : projectContext?.artistReferenceImages)
        : undefined;
      
      const endpoint = shouldUseReference
        ? '/api/fal/nano-banana/generate-with-face'
        : '/api/fal/nano-banana/generate';
      
      const requestBody = shouldUseReference
        ? { 
            prompt: enrichedPrompt,
            referenceImages: referenceImages,
            aspectRatio: aspectRatio
          }
        : { 
            prompt: enrichedPrompt,
            aspectRatio: aspectRatio
          };
      
      logger.info(`?? [Timeline] Usando endpoint: ${endpoint}, con referencia: ${shouldUseReference}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Error regenerando imagen');
      }

      const data = await response.json();
      
      if (data.imageUrl || data.success) {
        const newImageUrl = data.imageUrl || data.url;
        updateClip(clip.id, {
          imageUrl: newImageUrl,
          url: newImageUrl,
          thumbnailUrl: newImageUrl,
          metadata: {
            ...clip.metadata,
            imagePrompt: enrichedPrompt,
            regeneratedAt: new Date().toISOString(),
            isGeneratedImage: true,
            generatedWith: 'fal-nano-banana',
            usedProjectContext: true,
            usedArtistReference: shouldUseReference,
          },
        });

        toast({
          title: "✅ Imagen regenerada",
          description: "Nueva imagen generada coherente con el concepto",
        });
        logger.info(`? [Timeline] Imagen regenerada para clip ${clip.id} con contexto del proyecto`);
      }
    } catch (error) {
      logger.error(`? [Timeline] Error regenerando imagen:`, error);
      toast({
        title: "Error regenerando",
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(null);
    }
  }, [toast, updateClip, projectContext, clips]);
  handleRegenerateImageRef.current = handleRegenerateImage;

  // ?? Actualizar imageFit de un clip (cover/contain/fill)
  const handleUpdateImageFit = useCallback((clipId: number, fit: string) => {
    updateClip(clipId, {
      metadata: {
        ...clips.find(c => c.id === clipId)?.metadata,
        imageFit: fit,
      }
    });
    toast({
      title: '⚙️ Ajuste aplicado',
      description: `Modo: ${fit === 'cover' ? 'Cubrir' : fit === 'contain' ? 'Contener' : 'Estirar'}`,
    });
  }, [clips, updateClip, toast]);

  // 🎯 CapCut-style media transform handlers (scale/position within aspect ratio frame)
  // Uses functional setClips to avoid stale closure issues during rapid updates
  const transformClipIdRef = useRef<number | null>(null);
  
  const getClipTransform = useCallback((clip: TimelineClip | null) => {
    if (!clip) return { scale: 1, x: 0, y: 0 };
    const t = clip.metadata?.transform;
    return {
      scale: t?.scale ?? 1,
      x: t?.x ?? 0,
      y: t?.y ?? 0,
    };
  }, []);

  // CRITICAL: Uses functional setClips to always read latest state (no stale closures)
  const handleUpdateClipTransform = useCallback((clipId: number, transform: { scale?: number; x?: number; y?: number }) => {
    setClips(prevClips => prevClips.map(c => {
      if (c.id !== clipId) return c;
      const currentTransform = {
        scale: c.metadata?.transform?.scale ?? 1,
        x: c.metadata?.transform?.x ?? 0,
        y: c.metadata?.transform?.y ?? 0,
      };
      return {
        ...c,
        metadata: {
          ...c.metadata,
          transform: { ...currentTransform, ...transform },
        }
      };
    }));
  }, []);

  const handleResetTransform = useCallback(() => {
    if (!activeClip) return;
    const currentClips = clipsRef.current;
    handleUpdateClipTransform(activeClip.id, { scale: 1, x: 0, y: 0 });
    // Push history after the setClips inside handleUpdateClipTransform has run synchronously
    const newClips = clipsRef.current.map(c => c.id === activeClip.id ? { ...c, metadata: { ...c.metadata, transform: { scale: 1, x: 0, y: 0 } } } : c);
    engine.pushHistory(currentClips, newClips, 'edit' as any, 'Reset transform');
    clipsRef.current = newClips;
    toast({ title: '↩️ Transform reseteado', description: 'Posición y escala por defecto' });
  }, [activeClip, handleUpdateClipTransform, toast, engine]);

  const handleFillFrame = useCallback(() => {
    if (!activeClip) return;
    const currentClips = clipsRef.current;
    handleUpdateClipTransform(activeClip.id, { scale: 1.5, x: 0, y: 0 });
    const newClips = clipsRef.current.map(c => c.id === activeClip.id ? { ...c, metadata: { ...c.metadata, transform: { scale: 1.5, x: 0, y: 0 } } } : c);
    engine.pushHistory(currentClips, newClips, 'edit' as any, 'Fill frame');
    clipsRef.current = newClips;
    toast({ title: '📐 Fill Frame', description: 'Imagen escalada para llenar el frame' });
  }, [activeClip, handleUpdateClipTransform, toast, engine]);

  // Transform drag — mousedown sets refs, useEffect attaches document listeners
  const transformSnapshotRef = useRef<TimelineClip[] | null>(null);
  const handleTransformMouseDown = useCallback((e: React.MouseEvent) => {
    if (!activeClip) return;
    e.preventDefault();
    e.stopPropagation();
    transformSnapshotRef.current = [...clipsRef.current]; // snapshot for undo
    const t = getClipTransform(activeClip);
    transformStartRef.current = { x: e.clientX, y: e.clientY, origX: t.x, origY: t.y };
    transformClipIdRef.current = activeClip.id;
    setTransformDragging(true);
  }, [activeClip, getClipTransform]);

  // CRITICAL: Document-level drag listeners — handles fast drags that leave the container
  useEffect(() => {
    if (!transformDragging) return;
    
    const handleDocMouseMove = (e: MouseEvent) => {
      const container = viewerContainerRef.current;
      const start = transformStartRef.current;
      const clipId = transformClipIdRef.current;
      if (!container || !start || clipId == null) return;
      
      const rect = container.getBoundingClientRect();
      const dx = ((e.clientX - start.x) / rect.width) * 100;
      const dy = ((e.clientY - start.y) / rect.height) * 100;
      
      // Functional setClips — always reads latest state
      setClips(prev => {
        const next = prev.map(c => {
          if (c.id !== clipId) return c;
          return {
            ...c,
            metadata: {
              ...c.metadata,
              transform: {
                scale: c.metadata?.transform?.scale ?? 1,
                x: start.origX + dx,
                y: start.origY + dy,
              }
            }
          };
        });
        clipsRef.current = next; // sync ref so mouseup reads fresh state
        return next;
      });
    };
    
    const handleDocMouseUp = () => {
      // Push one history entry for the entire drag
      if (transformSnapshotRef.current) {
        const before = transformSnapshotRef.current;
        const after = clipsRef.current;
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          engine.pushHistory(before, after, 'edit' as any, 'Transform drag');
        }
        transformSnapshotRef.current = null;
      }
      setTransformDragging(false);
      transformStartRef.current = null;
      transformClipIdRef.current = null;
    };
    
    document.addEventListener('mousemove', handleDocMouseMove);
    document.addEventListener('mouseup', handleDocMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleDocMouseMove);
      document.removeEventListener('mouseup', handleDocMouseUp);
    };
  }, [transformDragging]);

  // Wheel-to-scale — uses functional setClips to avoid stale scale values
  const wheelSnapshotRef = useRef<TimelineClip[] | null>(null);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTransformWheel = useCallback((e: React.WheelEvent) => {
    if (!activeClip) return;
    e.stopPropagation();
    // Capture snapshot before first wheel in a sequence
    if (!wheelSnapshotRef.current) {
      wheelSnapshotRef.current = [...clipsRef.current];
    }
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const clipId = activeClip.id;
    setClips(prev => {
      const next = prev.map(c => {
        if (c.id !== clipId) return c;
        const currentScale = c.metadata?.transform?.scale ?? 1;
        const newScale = Math.max(0.1, Math.min(5, currentScale + delta));
        return {
          ...c,
          metadata: {
            ...c.metadata,
            transform: {
              scale: newScale,
              x: c.metadata?.transform?.x ?? 0,
              y: c.metadata?.transform?.y ?? 0,
            }
          }
        };
      });
      clipsRef.current = next;
      return next;
    });
    // Debounce: push history once after wheel stops for 400ms
    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = setTimeout(() => {
      if (wheelSnapshotRef.current) {
        const before = wheelSnapshotRef.current;
        const after = clipsRef.current;
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          engine.pushHistory(before, after, 'edit' as any, 'Scale transform');
        }
        wheelSnapshotRef.current = null;
      }
    }, 400);
  }, [activeClip, engine]);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<number | null>(null);
  
  // 🎬 Open Video Generation Modal directly — no budget gate
  const handleGenerateVideo = useCallback((clip: TimelineClip) => {
    const imageUrl = clip.imageUrl || clip.url || clip.thumbnailUrl;
    if (!imageUrl) {
      toast({
        title: 'Sin imagen',
        description: 'El clip necesita una imagen para generar video',
        variant: 'destructive',
      });
      return;
    }
    setVideoGenClip(clip);
  }, [toast]);
  handleGenerateVideoRef.current = handleGenerateVideo;

  // Callback when VideoGenerationModal finishes generating
  const handleVideoGenerated = useCallback((clipId: number, videoUrl: string, metadata: Record<string, any>) => {
    updateClip(clipId, {
      videoUrl,
      metadata: {
        ...clips.find(c => c.id === clipId)?.metadata,
        ...metadata,
      },
    });
    logger.info(`✅ [Timeline] Video generado para clip ${clipId}: ${videoUrl}`);
  }, [updateClip, clips]);
  
  // Polling para videos as�ncronos de FAL Kling
  const pollVideoStatus = useCallback(async (clipId: number, requestId: string, model: string) => {
    const maxAttempts = 40;
    let attempts = 0;
    let pollDelay = 10000; // start 10s, grows with backoff
    
    const checkStatus = async () => {
      try {
        const isPixVerse = model.startsWith('pixverse-');
        const url = isPixVerse
          ? `/api/fal/pixverse-video/${requestId}`
          : `/api/fal/kling-video/${requestId}?model=${model}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'completed' && (data.videoUrl || data.video_url)) {
          updateClip(clipId, {
            metadata: {
              videoUrl: data.videoUrl || data.video_url,
              videoGeneratedAt: new Date().toISOString(),
              hasVideo: true,
              videoGenerating: false,
              generatedWith: model,
            },
          });
          toast({
            title: "✅ Video listo",
            description: "Tu video ha sido generado exitosamente",
          });
          return;
        }
        
        if (data.status === 'failed') {
          updateClip(clipId, {
            metadata: {
              videoGenerating: false,
              videoError: data.error,
            },
          });
          toast({
            title: "❌ Error en video",
            description: data.error || 'La generación de video falló',
            variant: "destructive",
          });
          return;
        }
        
        // Still processing — exponential backoff: 10s → 15s → 22s → 33s → max 60s
        attempts++;
        if (attempts < maxAttempts) {
          pollDelay = Math.min(pollDelay * 1.5, 60000);
          setTimeout(checkStatus, pollDelay);
        } else {
          toast({
            title: 'Tiempo excedido',
            description: 'La generacion esta tomando mas tiempo del esperado. Revisa mas tarde.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        logger.error('Error polling video status:', error);
      }
    };
    
    setTimeout(checkStatus, 10000);
  }, [updateClip, toast]);

  // Batch generate videos for multiple clips without opening the modal
  const handleBatchGenerateVideos = useCallback(async (clipsToGenerate: TimelineClip[], overrideModel?: string) => {
    const eligible = clipsToGenerate.filter(c => c.imageUrl || c.url || c.thumbnailUrl);
    if (eligible.length === 0) {
      toast({ title: 'Sin imágenes', description: 'Los clips necesitan imágenes para generar videos', variant: 'destructive' });
      return;
    }

    const model = overrideModel ?? batchVideoModel;
    const isPixVerse = model.startsWith('pixverse-');
    const modelLabel = isPixVerse ? model.replace('pixverse-', 'PixVerse ') : `Kling v2.1`;
    toast({ title: '🎬 Generando videos en cola', description: `${eligible.length} videos serán generados con ${modelLabel}` });

    for (const clip of eligible) {
      const imageUrl = clip.imageUrl || clip.url || clip.thumbnailUrl;
      // Motion Sync: prefer the rich captured-motion description over the short token
      const motionClause = clip.metadata?.motionPromptSuffix
        || clip.metadata?.cameraMovement
        || '';
      const prompt = [
        clip.metadata?.imagePrompt || clip.metadata?.scene_description || '',
        motionClause,
        'cinematic motion, professional music video style',
      ].filter(Boolean).join(', ');

      try {
        updateClip(clip.id, {
          metadata: { ...clip.metadata, videoGenerating: true, videoError: undefined },
        });

        if (isPixVerse) {
          // ── PixVerse branch ──
          const pixverseModelName = model.replace('pixverse-', '');
          const response = await fetch('/api/fal/pixverse-video/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl,
              prompt,
              model: pixverseModelName,
              duration: Math.min(clip.duration ?? 5, 8),
            }),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.taskId) {
              pollVideoStatus(clip.id, data.taskId, model);
            }
          } else {
            updateClip(clip.id, { metadata: { ...clip.metadata, videoGenerating: false, videoError: 'PixVerse start failed' } });
          }
        } else {
          // ── Kling branch ──
          const response = await fetch('/api/fal/kling-video/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl,
              prompt,
              model: model.includes('.') ? model : 'kling-v2.1-standard',
              clipId: clip.id,
              duration: Math.min(clip.duration ?? 5, 10),
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.requestId) {
              pollVideoStatus(clip.id, data.requestId, model);
            } else if (data.videoUrl) {
              handleVideoGenerated(clip.id, data.videoUrl, data.metadata || {});
            }
          } else {
            updateClip(clip.id, {
              metadata: { ...clip.metadata, videoGenerating: false, videoError: 'Generation failed' },
            });
          }
        }
      } catch (_err) {
        updateClip(clip.id, {
          metadata: { ...clip.metadata, videoGenerating: false, videoError: 'Network error' },
        });
      }

      // Stagger requests to avoid rate-limiting
      await new Promise(r => setTimeout(r, 800));
    }
  }, [batchVideoModel, updateClip, pollVideoStatus, handleVideoGenerated, toast]);

  // ============================================================================
  // ?? LIPSYNC - Aplicar sincronizaci�n de labios a clips PERFORMANCE
  // ============================================================================
  // WORKFLOW: Video (ya generado) + Audio Segment ? Video con Lipsync
  const [isApplyingLipsync, setIsApplyingLipsync] = useState<number | null>(null);

  const handleApplyLipsync = useCallback(async (clip: TimelineClip) => {
    logger.info(`?? [Timeline] Aplicando lipsync a clip ${clip.id}`);
    
    // 1?? Verificar que el clip tiene video
    const videoUrl = clip.metadata?.videoUrl;
    if (!videoUrl) {
      toast({
        title: "Sin video",
        description: "Primero genera el video del clip antes de aplicar lipsync",
        variant: "destructive",
      });
      return;
    }

    // 2?? Verificar que tenemos audioBuffer disponible
    if (!audioBuffer) {
      toast({
        title: "Sin audio",
        description: "No hay audio disponible para sincronizar",
        variant: "destructive",
      });
      return;
    }

    // 3?? Verificar que el clip tiene timestamps v�lidos
    // NOTA: TimelineClip usa 'start' no 'startTime'
    const startTime = clip.start;
    const endTime = clip.start + clip.duration;
    
    if (startTime === undefined || endTime === undefined || endTime <= startTime) {
      toast({
        title: "Timestamps inválidos",
        description: "El clip no tiene tiempos válidos para cortar audio",
        variant: "destructive",
      });
      return;
    }

    setIsApplyingLipsync(clip.id);

    toast({
      title: "🎤 Aplicando lipsync...",
      description: `Sincronizando labios con audio (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)`,
    });

    try {
      // 4?? Cortar el segmento de audio correspondiente al clip
      logger.info(`?? [Timeline] Cortando audio: ${startTime}s - ${endTime}s`);
      
      // Importar la funci�n de corte de audio
      const { cutAudioSegment } = await import('@/lib/services/audio-segmentation');
      const audioSegment = await cutAudioSegment(audioBuffer, startTime, endTime);
      
      logger.info(`? [Timeline] Audio cortado: ${(audioSegment.blob.size / 1024).toFixed(2)}KB`);

      // 5?? Subir el audio a un servidor temporal para obtener URL
      // Usamos FormData para subir el audio como archivo
      const audioFormData = new FormData();
      audioFormData.append('file', audioSegment.blob, `clip_${clip.id}_audio.wav`);
      
      const uploadResponse = await fetch('/api/upload/temp-audio', {
        method: 'POST',
        body: audioFormData,
      });

      if (!uploadResponse.ok) {
        // Si no hay endpoint de upload, usamos la URL local directamente
        // PixVerse deber�a poder aceptar data URLs o necesitamos un workaround
        logger.warn('?? No hay endpoint de upload, intentando con data URL');
        
        // Convertir blob a base64 data URL
        const reader = new FileReader();
        const audioDataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioSegment.blob);
        });
        
        // Por ahora, loggeamos que necesitamos un endpoint de upload
        toast({
          title: "⏳ Pendiente",
          description: "Se requiere implementar endpoint de upload de audio temporal",
          variant: "destructive",
        });
        setIsApplyingLipsync(null);
        return;
      }

      const uploadData = await uploadResponse.json();
      const audioUrl = uploadData.url;
      
      logger.info(`?? [Timeline] Audio subido: ${audioUrl}`);

      // 6?? Llamar al endpoint de lipsync con video + audio
      const lipsyncResponse = await fetch('/api/fal/pixverse/lipsync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoUrl,
          audioUrl: audioUrl,
          clipId: clip.id,
        }),
      });

      if (!lipsyncResponse.ok) {
        const errorData = await lipsyncResponse.json();
        throw new Error(errorData.error || 'Error aplicando lipsync');
      }

      const lipsyncData = await lipsyncResponse.json();

      if (lipsyncData.success && lipsyncData.videoUrl) {
        // 7?? Actualizar el clip con el video sincronizado
        updateClip(clip.id, {
          metadata: {
            ...clip.metadata,
            lipsyncVideoUrl: lipsyncData.videoUrl,
            lipsyncApplied: true,
            lipsyncAppliedAt: new Date().toISOString(),
            lipsyncProcessingTime: lipsyncData.processingTime,
          },
        });

        toast({
          title: "✅ Lipsync aplicado",
          description: `Labios sincronizados en ${lipsyncData.processingTime?.toFixed(1) || '?'}s`,
        });
        
        logger.info(`? [Timeline] Lipsync aplicado a clip ${clip.id}: ${lipsyncData.videoUrl}`);
      } else {
        throw new Error('No se recibi� URL del video con lipsync');
      }

    } catch (error) {
      logger.error(`? [Timeline] Error aplicando lipsync:`, error);
      toast({
        title: "Error en lipsync",
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: "destructive",
      });
    } finally {
      setIsApplyingLipsync(null);
    }
  }, [audioBuffer, toast, updateClip]);

  return (
    <PortalContainerContext.Provider value={isViewerFullscreen ? containerRef.current : outerPortalContainer}>
      <>
      {/* ?? Input oculto para importaci�n de archivos */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileImport}
        accept={getAcceptedFileTypes('all')}
      />
      
      <div 
        ref={containerRef} 
        className={`flex flex-col bg-neutral-900 text-white rounded-md overflow-hidden select-none ${
          isViewerFullscreen ? 'fixed inset-0 z-[9999] h-screen' : 'h-full'
        }`}
        style={isViewerFullscreen ? {
          paddingTop: 'env(safe-area-inset-top)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        } : undefined}
        onContextMenu={(e) => handleContextMenu(e)}
      >
        {/* Toolbar Principal - Compact & Professional
            Responsive strategy: on phone/tablet/iPad we keep all icons on a
            single line with horizontal scroll (so NOTHING is ever cut off
            or wrapped onto a second row). On xl+ screens we revert to the
            classic left/center/right justify-between layout. */}
        <div
          className="timeline-main-toolbar flex flex-nowrap items-center px-1.5 sm:px-2 py-1 border-b border-white/10 bg-neutral-950 gap-2 flex-shrink-0 overflow-x-auto overflow-y-hidden xl:overflow-x-visible xl:justify-between scroll-smooth [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          
          {/* Herramientas de edición */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Tools */}
            <div className="flex items-center gap-px">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setTool('select')} 
                className={`p-1 h-6 w-6 ${tool==='select'?'bg-orange-500/20 text-orange-400':''}`} 
                title="Seleccionar (V)"
              >
                <SelectIcon size={12} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setTool('razor')} 
                className={`p-1 h-6 w-6 ${tool==='razor'?'bg-orange-500/20 text-orange-400':''}`} 
                title="Cuchilla (C)"
              >
                <ScissorIcon size={12} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setTool('trim')} 
                className={`p-1 h-6 w-6 ${tool==='trim'?'bg-orange-500/20 text-orange-400':''}`} 
                title="Trim (T)"
              >
                <TrimIcon size={12} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setTool('hand')} 
                className={`p-1 h-6 w-6 ${tool==='hand'?'bg-orange-500/20 text-orange-400':''}`} 
                title="Mano (H)"
              >
                <HandIcon size={12} />
              </Button>
            </div>

            <div className="mx-0.5 h-4 w-px bg-white/10" />

            {/* Acciones de corte en el playhead */}
            <div className="flex items-center gap-px">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleSplitAtPlayhead} 
                disabled={readOnly || selectedClipId === null}
                className="p-1 h-6 w-6 text-orange-300 hover:bg-orange-500/20 disabled:opacity-40" 
                title="Cortar clip seleccionado en el playhead (Cmd/Ctrl+K)"
              >
                <Split size={12} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleRazorAllTracks} 
                disabled={readOnly}
                className="p-1 h-6 w-6 text-red-300 hover:bg-red-500/20 disabled:opacity-40" 
                title="Cortar TODAS las pistas en el playhead (Cmd/Ctrl+Shift+K)"
              >
                <ScissorIcon size={12} className="rotate-90" />
              </Button>
            </div>

            <div className="mx-0.5 h-4 w-px bg-white/10" />

            {/* Snap / Edit Mode */}
            <div className="flex items-center gap-px">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setSnapEnabled(s => !s)} 
                className={`p-1 h-6 w-6 ${snapEnabled ? 'bg-orange-500/20 text-orange-400' : ''}`}
                title="Magnetic Snap (toggle)"
              >
                <MagnetIcon size={12} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  const modes: EditMode[] = ['normal', 'ripple', 'roll'];
                  const currentIdx = modes.indexOf(editMode);
                  const nextMode = modes[(currentIdx + 1) % modes.length];
                  setEditMode(nextMode);
                  setRippleEnabled(nextMode === 'ripple');
                  engine.updateConfig({ editMode: nextMode });
                }} 
                className={`p-1 h-6 px-1.5 text-[9px] font-bold ${
                  editMode === 'ripple' ? 'bg-red-500/20 text-red-400' : 
                  editMode === 'roll' ? 'bg-blue-500/20 text-blue-400' :
                  editMode === 'slip' ? 'bg-green-500/20 text-green-400' :
                  ''
                }`}
                title={`Edit Mode: ${editMode.toUpperCase()} (N=Normal, B=Ripple, G=Roll)`}
              >
                {editMode === 'normal' ? 'NRM' : 
                 editMode === 'ripple' ? 'RPL' : 
                 editMode === 'roll' ? 'ROL' : 
                 editMode === 'slip' ? 'SLP' : 'NRM'}
              </Button>
            </div>

            <div className="mx-0.5 h-4 w-px bg-white/10" />

            {/* Import Media */}
            <div className="relative flex items-center gap-px" ref={importMenuRef} data-import-menu>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  const rect = importMenuRef.current?.getBoundingClientRect();
                  if (rect) setImportMenuPos({ top: rect.bottom + 4, left: rect.left });
                  setShowImportMenu(!showImportMenu);
                }}
                disabled={isImporting}
                className="p-1 h-6 px-2 bg-cyan-500/10 hover:bg-cyan-500/20 gap-0.5"
                title="Importar Media (I)"
              >
                {isImporting ? (
                  <Loader2 size={12} className="text-cyan-400 animate-spin" />
                ) : (
                  <Upload size={12} className="text-cyan-400" />
                )}
                <span className="hidden sm:inline text-[10px] text-cyan-400">Import</span>
              </Button>
              
              {/* Import dropdown — portal to escape overflow-x:auto clipping */}
              {showImportMenu && importMenuPos && createPortal(
                <div
                  style={{ position: 'fixed', top: importMenuPos.top, left: importMenuPos.left, zIndex: 2147483647 }}
                  className="bg-neutral-900 border border-white/20 rounded-lg shadow-xl py-1 min-w-[140px]"
                  data-import-menu
                >
                  <button
                    onClick={() => handleOpenFilePicker('all')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-white/10 active:bg-white/20 flex items-center gap-2 text-white/90"
                  >
                    <Upload size={12} className="text-cyan-400" />
                    Todos los archivos
                  </button>
                  <div className="h-px bg-white/10 my-1" />
                  <button
                    onClick={() => handleOpenFilePicker('image')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-white/10 active:bg-white/20 flex items-center gap-2 text-white/90"
                  >
                    <ImagePlus size={12} className="text-green-400" />
                    Imágenes
                  </button>
                  <button
                    onClick={() => handleOpenFilePicker('audio')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-white/10 active:bg-white/20 flex items-center gap-2 text-white/90"
                  >
                    <FileAudio size={12} className="text-yellow-400" />
                    Audio
                  </button>
                  <button
                    onClick={() => handleOpenFilePicker('video')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-white/10 active:bg-white/20 flex items-center gap-2 text-white/90"
                  >
                    <FileVideo size={12} className="text-purple-400" />
                    Video
                  </button>
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* Playback Controls - Centro */}
          <div className="flex items-center justify-center gap-0.5 flex-shrink-0">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setCurrentTime(0)} 
              className="p-1 h-6 w-6 hover:bg-white/10"
              title="Inicio"
            >
              <SkipBack size={11} className="text-white/70"/>
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setCurrentTime(t => Math.max(0, Math.round((t - 1) * framerate) / framerate))} 
              className="p-1 h-6 w-6 hover:bg-white/10"
              title="-1s"
            >
              <Rewind size={11} className="text-white/70"/>
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsPlaying(p=>!p)} 
              className="p-1 h-7 w-7 bg-orange-500/20 hover:bg-orange-500/30"
              title="Play/Pause"
            >
              {isPlaying ? <PauseIcon size={14} className="text-orange-400"/> : <PlayIcon size={14} className="text-orange-400"/>}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setCurrentTime(t => Math.min(duration, Math.round((t + 1) * framerate) / framerate))} 
              className="p-1 h-6 w-6 hover:bg-white/10"
              title="+1s"
            >
              <FastForward size={11} className="text-white/70"/>
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setCurrentTime(Math.round(duration * framerate) / framerate)} 
              className="p-1 h-6 w-6 hover:bg-white/10"
              title="Final"
            >
              <SkipForward size={11} className="text-white/70"/>
            </Button>
            
            <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 bg-black/30 ml-1">
              {formatTime(currentTime)}
            </Badge>
            
            {/* 🎯 Indicador de velocidad J/K/L */}
            {playbackRate !== 1 && (
              <Badge 
                variant="outline" 
                className={`font-mono text-[9px] px-1 py-0 ml-0.5 ${
                  playbackRate < 0 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 
                  playbackRate > 1 ? 'bg-green-500/20 text-green-400 border-green-500/50' : 
                  'bg-black/30'
                }`}
              >
                {playbackRate > 0 ? `${playbackRate}x` : `${playbackRate}x ◀`}
              </Badge>
            )}
            
            {/* 🔊 Control de Volumen - Estilo Adobe Premiere */}
            <div className="flex items-center gap-1 ml-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Si hay error de autoplay, intentar reproducir con interacción
                  if (audioError && audioRef.current) {
                    audioRef.current.play()
                      .then(() => {
                        setAudioError(null);
                        setAudioReady(true);
                      })
                      .catch(err => {
                        setAudioError(err.message);
                      });
                  } else {
                    setIsMuted(m => !m);
                  }
                }}
                className={`p-0.5 h-5 w-5 ${isMuted || audioError ? 'text-red-400' : audioReady ? 'text-green-400' : 'text-white/50'}`}
                title={audioError ? `Clic para activar audio: ${audioError}` : isMuted ? 'Activar audio' : `Volumen: ${Math.round(volume * 100)}%`}
              >
                {audioError ? (
                  <AlertCircle size={11} />
                ) : isMuted || volume === 0 ? (
                  <VolumeMuteIcon size={11} />
                ) : volume < 0.5 ? (
                  <VolumeLowIcon size={11} />
                ) : (
                  <VolumeIcon size={11} />
                )}
              </Button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const newVol = parseFloat(e.target.value);
                  setVolume(newVol);
                  if (newVol > 0 && isMuted) setIsMuted(false);
                }}
                className="w-12 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-orange-500"
                style={{
                  background: `linear-gradient(to right, #f97316 0%, #f97316 ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
                title={`Volumen: ${Math.round(volume * 100)}%`}
              />
            </div>
            
            {/* 📌 Indicador de multi-selección */}
            {selectedClipIds.size > 1 && (
              <Badge 
                variant="outline" 
                className="font-mono text-[9px] px-1 py-0 ml-0.5 bg-blue-500/20 text-blue-400 border-blue-500/50"
              >
                {selectedClipIds.size} sel
              </Badge>
            )}

            <div className="mx-0.5 h-4 w-px bg-white/10" />

            {/* Zoom — con slider, botones, y Fit */}
            <div className="flex items-center gap-px">
              <Button size="sm" variant="ghost" onClick={zoomOut} className="p-0.5 h-5 w-5" title="Zoom Out (-)">
                <ZoomOutIcon size={10}/>
              </Button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={1}
                value={zoom}
                onChange={(e) => {
                  const newZ = Number(e.target.value);
                  // Adjust scroll to keep playhead centered
                  const el = timelineScrollRef.current;
                  if (el) {
                    const centerX = el.clientWidth / 2;
                    requestAnimationFrame(() => {
                      if (timelineScrollRef.current) {
                        timelineScrollRef.current.scrollLeft = Math.max(0, currentTime * newZ + layerPanelWidth - centerX);
                      }
                    });
                  }
                  setZoom(newZ);
                }}
                className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-orange-500"
                style={{
                  background: `linear-gradient(to right, #f97316 0%, #f97316 ${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%, rgba(255,255,255,0.2) ${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
                title={`Zoom: ${Math.round(zoom)} px/s`}
              />
              <Button size="sm" variant="ghost" onClick={zoomIn} className="p-0.5 h-5 w-5" title="Zoom In (+)">
                <ZoomInIcon size={10}/>
              </Button>
              <span className="font-mono text-[8px] text-white/50 w-8 text-center">{Math.round(zoom)}px</span>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={zoomToFit} 
                className="p-0.5 h-5 text-[7px] font-mono text-orange-400/80 hover:text-orange-300" 
                title="Fit to Window (Shift+Z)"
              >
                FIT
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Undo/Redo */}
            <div className="flex items-center gap-px">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={doUndo} 
                disabled={history.past.length===0} 
                className="p-1 h-6 w-6 disabled:opacity-30"
                title="Undo"
              >
                <UndoIcon size={11}/>
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={doRedo} 
                disabled={history.future.length===0} 
                className="p-1 h-6 w-6 disabled:opacity-30"
                title="Redo"
              >
                <RedoIcon size={11}/>
              </Button>
            </div>

            <div className="mx-0.5 h-4 w-px bg-white/10" />

            {/* Quick Actions */}
            <div className="flex items-center gap-px">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowBudgetModal(true)}
                className={`p-1 h-6 w-6 ${budgetApproved ? 'bg-green-500/20' : 'bg-emerald-500/10 hover:bg-emerald-500/20'}`}
                title={budgetApproved ? '💰 Presupuesto Aprobado' : '💰 Ver Presupuesto'}
              >
                <DollarSign size={11} className={budgetApproved ? 'text-green-400' : 'text-emerald-400'} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setMotionPanelOpen(true)}
                className="p-1 h-6 w-6 bg-purple-500/10 hover:bg-purple-500/20"
                title="Motion"
              >
                <MotionIcon size={11} className="text-purple-400" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowMicroCutsPanel(!showMicroCutsPanel)}
                className={`p-1 h-6 w-6 ${showMicroCutsPanel ? 'bg-yellow-500/20' : 'bg-yellow-500/10 hover:bg-yellow-500/20'}`}
                title="⚡ Microcortes Cinematográficos"
              >
                <Zap size={11} className="text-yellow-400" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowStoryboardPanel(!showStoryboardPanel)}
                className={`p-1 h-6 w-6 ${showStoryboardPanel ? 'bg-teal-500/20' : 'bg-teal-500/10 hover:bg-teal-500/20'}`}
                title="📋 Storyboard Visual"
              >
                <LayoutList size={11} className="text-teal-400" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowMotionSyncPanel(!showMotionSyncPanel)}
                className={`p-1 h-6 w-6 ${showMotionSyncPanel ? 'bg-rose-500/20' : 'bg-rose-500/10 hover:bg-rose-500/20'}`}
                title="📱 Motion Sync — Captura de movimiento"
              >
                <Smartphone size={11} className="text-rose-400" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowImageGenerator(!showImageGenerator)}
                className={`p-1 h-6 w-6 ${showImageGenerator ? 'bg-violet-500/20' : 'bg-violet-500/10 hover:bg-violet-500/20'}`}
                title="🖼️ Image Generator — Generar imágenes con referencias"
              >
                <ImagePlus size={11} className="text-violet-400" />
              </Button>
              {/* 🎬 Director AI — always visible */}
              <div className="relative" ref={directorPickerRef}>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    if (activeDirector) {
                      setDirectorPanelOpen(!directorPanelOpen);
                    } else {
                      const rect = directorPickerRef.current?.getBoundingClientRect();
                      if (rect) setDirectorPickerPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 240) });
                      setShowDirectorPicker(!showDirectorPicker);
                    }
                  }}
                  className={`p-1 h-6 gap-1 ${directorPanelOpen || showDirectorPicker ? 'bg-orange-500/20' : 'bg-orange-500/10 hover:bg-orange-500/20'}`}
                  title={activeDirector ? `🎬 ${activeDirector.name} — Director AI` : '🎬 Seleccionar Director AI'}
                >
                  {activeDirector ? (
                    <img
                      src={getDirectorImageUrl(activeDirector)}
                      alt={activeDirector.name}
                      className="w-4 h-4 rounded-full object-cover border border-orange-500/50"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Megaphone size={11} className="text-orange-400" />
                  )}
                  {activeDirector ? (
                    <span className="hidden md:inline text-[9px] text-orange-400 font-semibold">{activeDirector.name.split(' ')[0]}</span>
                  ) : (
                    <span className="hidden md:inline text-[9px] text-orange-400/70 font-semibold">Director</span>
                  )}
                  {directorAppliedCount > 0 && (
                    <span className="text-[8px] font-bold bg-orange-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">
                      {directorAppliedCount}
                    </span>
                  )}
                </Button>
                {/* Director picker dropdown — rendered in portal to escape overflow-x:auto clipping */}
                {showDirectorPicker && directorPickerPos && createPortal(
                  <div
                    style={{ position: 'fixed', top: directorPickerPos.top, left: directorPickerPos.left, zIndex: 2147483647 }}
                    className="w-56 max-h-72 overflow-y-auto rounded-lg border border-orange-500/30 bg-[#1a1a2e]/98 backdrop-blur-xl shadow-2xl shadow-black/60"
                  >
                    <div className="px-3 py-2 border-b border-white/10">
                      <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Seleccionar Director</span>
                    </div>
                    {DIRECTORS.map((d) => (
                      <button
                        key={d.name}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-orange-500/15 active:bg-orange-500/25 transition-colors ${
                          activeDirector?.name === d.name ? 'bg-orange-500/20 border-l-2 border-orange-500' : ''
                        }`}
                        onClick={() => {
                          setManualDirector(d);
                          setShowDirectorPicker(false);
                          setDirectorPanelOpen(true);
                        }}
                      >
                        <img
                          src={getDirectorImageUrl(d)}
                          alt={d.name}
                          className="w-7 h-7 rounded-full object-cover border-2 border-orange-500/30 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(d.name)}&scale=80`; }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] text-white/90 font-medium truncate">{d.name}</span>
                          <span className="text-[9px] text-white/40 truncate">{d.visual_style?.description || d.editing_style?.pace || 'Director AI'}</span>
                        </div>
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
                {/* Change director button when one is selected */}
                {activeDirector && !showDirectorPicker && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDirectorPicker(true); }}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white/10 hover:bg-orange-500/30 flex items-center justify-center transition-colors"
                    title="Cambiar director"
                  >
                    <span className="text-[7px] text-white/60">↻</span>
                  </button>
                )}
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowProjectsPanel(!showProjectsPanel)}
                className={`p-1 h-6 w-6 ${showProjectsPanel ? 'bg-blue-500/20' : 'bg-blue-500/10 hover:bg-blue-500/20'}`}
                title="Proyectos"
              >
                <FolderOpen size={11} className="text-blue-400" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleSaveProject}
                disabled={isSavingProject}
                className="p-1 h-6 w-6 bg-green-500/10 hover:bg-green-500/20"
                title={user?.id ? "Guardar en la nube" : "Inicia sesi�n para guardar"}
              >
                {isSavingProject ? (
                  <Loader2 size={11} className="text-green-400 animate-spin" />
                ) : (
                  <Save size={11} className="text-green-400" />
                )}
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowExportPanel(true)}
                className="p-1 h-6 w-6 bg-orange-500/10 hover:bg-orange-500/20"
                title="Exportar Video"
              >
                <Download size={11} className="text-orange-400" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setUseRemotionPreview(prev => !prev)}
                className={`p-1 h-6 px-1.5 text-[9px] font-bold gap-0.5 ${useRemotionPreview ? 'bg-purple-500/30 text-purple-300 ring-1 ring-purple-500/50' : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400'}`}
                title={useRemotionPreview ? 'Vista Remotion ACTIVA — efectos Ken Burns, transiciones, audio (clic para modo estático)' : 'Vista estática — clic para activar Remotion con efectos visuales completos'}
              >
                <Film size={9} />
                {useRemotionPreview ? 'LIVE' : 'STATIC'}
              </Button>
              
              {/* Aspect Ratio Selector */}
              <div className="relative" ref={aspectMenuRef}>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    const rect = aspectMenuRef.current?.getBoundingClientRect();
                    if (rect) setAspectMenuPos({ top: rect.bottom + 4, right: Math.max(4, window.innerWidth - rect.right) });
                    setShowAspectMenu(!showAspectMenu);
                  }}
                  className="p-1 h-6 px-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-[9px] font-bold text-cyan-400 gap-0.5"
                  title="Aspect Ratio"
                >
                  <Monitor size={9} className="text-cyan-400" />
                  {aspectRatio}
                </Button>
                {showAspectMenu && aspectMenuPos && createPortal(
                  <>
                  <div className="fixed inset-0 z-[2147483646]" onClick={() => setShowAspectMenu(false)} />
                  <div
                    style={{ position: 'fixed', top: aspectMenuPos.top, right: aspectMenuPos.right, zIndex: 2147483647 }}
                    className="min-w-[160px] rounded-lg border border-white/15 bg-neutral-900/98 backdrop-blur-xl shadow-2xl py-1 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    {ASPECT_RATIOS.map(ar => (
                      <button
                        key={ar.id}
                        onClick={() => { setAspectRatio(ar.id); setShowAspectMenu(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors ${
                          aspectRatio === ar.id
                            ? 'bg-orange-500/15 text-orange-400'
                            : 'text-white/60 hover:bg-white/8 active:bg-white/15 hover:text-white'
                        }`}
                      >
                        <span className="font-bold w-8">{ar.label}</span>
                        <span className="text-white/30 text-[9px]">{ar.desc}</span>
                        {aspectRatio === ar.id && <Check size={10} className="ml-auto text-orange-400" />}
                      </button>
                    ))}
                  </div>
                  </>,
                  document.body
                )}
              </div>
              
              {/* ?? Bot�n de Shortcuts */}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="p-1 h-6 w-6 hover:bg-white/10"
                    >
                      <HelpCircle size={11} className="text-white/50" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-neutral-900 border-white/20 text-white p-3 max-w-xs">
                    <div className="text-xs space-y-1.5">
                      <p className="font-bold text-orange-400 mb-2">⌨️ Atajos de Teclado</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                        <span className="text-white/70">Space</span><span>Play/Pause</span>
                        <span className="text-white/70">J / K / L</span><span>◀ Pause ▶</span>
                        <span className="text-white/70">← →</span><span>±1s (Shift: frame)</span>
                        <span className="text-white/70">, .</span><span>Frame anterior/siguiente</span>
                        <span className="text-white/70">Home / End</span><span>Inicio / Final</span>
                        <span className="text-white/70">V / C / T / H</span><span>Select/Razor/Trim/Hand</span>
                        <span className="text-white/70">I</span><span>Importar archivos</span>
                        <span className="text-white/70">Ctrl+Z / Y</span><span>Undo / Redo</span>
                        <span className="text-white/70">Ctrl+A / D</span><span>Seleccionar / Deseleccionar</span>
                        <span className="text-white/70">Shift+Click</span><span>Multi-selección</span>
                        <span className="text-white/70">Delete</span><span>Eliminar clips</span>
                        <span className="text-white/70">+ / -</span><span>Zoom In/Out</span>
                      </div>
                      <p className="text-white/50 mt-2 text-[10px]">💡 También puedes arrastrar archivos al timeline</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <EditorAgentPanel 
                timeline={clips.map((c, i) => ({
                  id: String(c.id),
                  group: c.layerId || 0,
                  label: `Clip ${i + 1}`,
                  start_time: c.start,
                  end_time: c.start + c.duration,
                  duration: c.duration,
                }))}
                audioBuffer={audioBuffer}
                genreHint={genreHint}
                onApplySuggestions={handleApplyAgentSuggestions}
              />
            </div>
          </div>
        </div>

        {/* 🎨 Barra de progreso de generación progresiva */}
        {(() => {
          const totalLayer1 = clips.filter(c => c.layerId === 1).length;
          const doneLayer1 = clips.filter(c => c.layerId === 1 && c.imageUrl && c.imageUrl.length > 0).length;
          const isGenerating = totalLayer1 > 0 && doneLayer1 < totalLayer1;
          if (!isGenerating) return null;
          const pct = Math.round((doneLayer1 / totalLayer1) * 100);
          return (
            <div className="flex items-center gap-2 px-2 py-1 bg-neutral-950 border-b border-white/10 flex-shrink-0">
              <Loader2 size={12} className="text-purple-400 animate-spin" />
              <span className="text-[10px] text-white/70 whitespace-nowrap">
                Generando: {doneLayer1}/{totalLayer1} imágenes
              </span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, #a855f7, #3b82f6, #a855f7)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s linear infinite',
                  }}
                />
              </div>
              <span className="text-[10px] text-purple-400 font-mono">{pct}%</span>
            </div>
          );
        })()}

        {/* Panel de Proyectos Guardados */}
        {showProjectsPanel && (
          <div className="px-2 sm:px-3 py-2 bg-neutral-900 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className="text-blue-400" />
                <span className="text-sm font-medium text-white">Proyectos Guardados</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 border-blue-500/30 text-blue-400">
                  {savedProjects.length}
                </Badge>
              </div>
              <button
                onClick={() => setShowProjectsPanel(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <XIcon size={14} className="text-white/60" />
              </button>
            </div>
            
            {/* Input para nombre del proyecto */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Nombre del proyecto..."
                className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                disabled={isSavingProject}
              />
              <Button
                size="sm"
                onClick={handleSaveProject}
                disabled={isSavingProject || !user?.id}
                className="bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 disabled:opacity-50"
              >
                {isSavingProject ? (
                  <>
                    <Loader2 size={14} className="mr-1 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <FolderPlus size={14} className="mr-1" />
                    {user?.id ? 'Guardar en Nube' : 'Inicia sesi�n'}
                  </>
                )}
              </Button>
            </div>
            
            {/* Barra de progreso de guardado */}
            {isSavingProject && (
              <div className="mb-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">{saveStatus}</span>
                  <span className="text-green-400">{Math.round(saveProgress)}%</span>
                </div>
                <Progress value={saveProgress} className="h-1.5" />
              </div>
            )}
            
            {/* Indicador de carga de proyectos */}
            {isLoadingProjects && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin mr-2" />
                <span className="text-sm text-white/60">Cargando proyectos...</span>
              </div>
            )}
            
            {/* Grid de proyectos */}
            {!isLoadingProjects && savedProjects.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {savedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="relative group bg-black/30 rounded-lg border border-white/10 hover:border-blue-500/50 transition-all overflow-hidden cursor-pointer"
                    onClick={() => handleLoadProject(project)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-gradient-to-br from-neutral-800 to-neutral-900 overflow-hidden">
                      {project.thumbnail ? (
                        <img
                          src={project.thumbnail}
                          alt={project.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <VideoIcon size={20} className="text-white/20" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="p-1.5">
                      <p className="text-[10px] sm:text-xs font-medium text-white truncate">{project.name}</p>
                      <div className="flex items-center gap-1 text-[8px] sm:text-[9px] text-white/50">
                        <Clock size={8} />
                        <span>{formatTime(project.duration)}</span>
                        <span>·</span>
                        <span>{project.clips.length} clips</span>
                      </div>
                    </div>
                    
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar proyecto"
                    >
                      <XIcon size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            ) : !isLoadingProjects ? (
              <div className="flex flex-col items-center justify-center py-4 text-white/40">
                <FolderOpen size={24} className="mb-1" />
                <span className="text-xs">{user?.id ? 'No hay proyectos guardados' : 'Inicia sesión para ver tus proyectos'}</span>
                <span className="text-[10px]">{user?.id ? 'Guarda tu proyecto actual para verlo aquí' : 'Los proyectos se guardan en la nube de forma permanente'}</span>
              </div>
            ) : null}
          </div>
        )}

        {/* ?? Panel de Acciones del Clip Seleccionado */}
        {selectedClipId && (
          <div className="px-1.5 py-1 bg-gradient-to-r from-purple-900/20 via-neutral-900 to-orange-900/20 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              {/* Info del clip */}
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500/20 to-orange-500/20 border border-white/10 flex items-center justify-center">
                  <ImageIcon size={11} className="text-orange-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-white leading-tight">
                    Clip #{selectedClipId}
                  </span>
                  <span className="text-[8px] text-white/50 leading-tight">
                    {clips.find(c => c.id === selectedClipId)?.title || 'Sin título'}
                  </span>
                </div>
              </div>
              
              {/* Botones de Acci�n */}
              <div className="flex items-center gap-0.5">
                {/* Edit Image */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const clip = clips.find(c => c.id === selectedClipId);
                    if (clip) handleEditImage(clip);
                  }}
                  className="p-1 h-6 w-6 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20"
                  title="Editar Imagen"
                >
                  <Pencil size={11} className="text-blue-400" />
                </Button>

                {/* Add Musician */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const clip = clips.find(c => c.id === selectedClipId);
                    if (clip) handleAddMusician(clip);
                  }}
                  className="p-1 h-6 w-6 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20"
                  title="Agregar Músico"
                >
                  <Music size={11} className="text-green-400" />
                </Button>

                {/* Camera Angles */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const clip = clips.find(c => c.id === selectedClipId);
                    if (clip) handleCameraAngles(clip);
                  }}
                  className="p-1 h-6 w-6 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20"
                  title="Ángulos de Cámara"
                >
                  <Camera size={11} className="text-purple-400" />
                </Button>

                {/* Regenerate */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const clip = clips.find(c => c.id === selectedClipId);
                    if (clip) handleRegenerateImage(clip);
                  }}
                  disabled={isRegenerating === selectedClipId}
                  className="p-1 h-6 w-6 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 disabled:opacity-50"
                  title="Regenerar Imagen"
                >
                  {isRegenerating === selectedClipId ? (
                    <Loader2 size={11} className="text-yellow-400 animate-spin" />
                  ) : (
                    <RefreshCw size={11} className="text-yellow-400" />
                  )}
                </Button>

                {/* Generate Video */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const clip = clips.find(c => c.id === selectedClipId);
                    if (clip) handleGenerateVideo(clip);
                  }}
                  disabled={isGeneratingVideo === selectedClipId}
                  className="p-1 h-6 w-6 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 disabled:opacity-50"
                  title="Generar Video"
                >
                  {isGeneratingVideo === selectedClipId ? (
                    <Loader2 size={11} className="text-orange-400 animate-spin" />
                  ) : (
                    <Film size={11} className="text-orange-400" />
                  )}
                </Button>

                {/* Deselect */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedClipId(null)}
                  className="p-1 h-6 w-6 bg-white/5 hover:bg-white/10"
                  title="Deseleccionar"
                >
                  <XIcon size={11} className="text-white/60" />
                </Button>

                {/* Transform Mode — CapCut-style */}
                <div className="w-px h-4 bg-white/10 mx-0.5" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsTransformMode(!isTransformMode)}
                  className={`p-1 h-6 px-1.5 text-[9px] font-medium ${
                    isTransformMode 
                      ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50' 
                      : 'bg-white/5 hover:bg-white/10 text-white/50'
                  }`}
                  title="Transformar — mover y escalar en el frame"
                >
                  <Move size={10} className="mr-0.5" />
                  Ajustar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Visor de Video + Galer�a de Im�genes - Altura ajustable */}
        <div 
          className="flex items-stretch px-2 sm:px-3 py-2 bg-neutral-950 flex-shrink-0"
          style={{ height: `${viewerHeight}%`, minHeight: '100px', maxHeight: '70%' }}
        >
          {/* Visor Principal */}
          <div className="relative flex-1 min-w-0 bg-neutral-900 rounded-md overflow-hidden border border-white/10 flex items-center justify-center">
            {/* Viewer Toolbar — always visible when a clip is active */}
            {activeClip && !selectedGalleryImage && (
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-black/80 backdrop-blur-md rounded-lg px-2.5 py-1 border border-white/10 shadow-xl shadow-black/40">
                {/* Transform toggle */}
                <button
                  onClick={() => setIsTransformMode(!isTransformMode)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    isTransformMode 
                      ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/40' 
                      : 'bg-white/8 text-white/60 hover:bg-white/15 hover:text-white'
                  }`}
                  title="Transform — drag to move, scroll to scale"
                >
                  <Move size={11} />
                  Transform
                </button>
                <div className="w-px h-5 bg-white/10" />
                {/* Reset */}
                <button
                  onClick={handleResetTransform}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] text-white/50 hover:bg-white/10 hover:text-white transition-all"
                  title="Reset position & scale"
                >
                  <RotateCcw size={10} />
                </button>
                {/* Fill */}
                <button
                  onClick={handleFillFrame}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] text-white/50 hover:bg-white/10 hover:text-white transition-all"
                  title="Scale to fill frame"
                >
                  <Maximize2 size={10} />
                </button>
                {/* Scale indicator */}
                {getClipTransform(activeClip).scale !== 1 && (
                  <>
                    <div className="w-px h-5 bg-white/10" />
                    <span className="text-[9px] text-orange-400 font-mono font-bold px-1">
                      {Math.round(getClipTransform(activeClip).scale * 100)}%
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Aspect Ratio Badge — always visible */}
            <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1 border border-white/10">
              <Monitor size={10} className="text-cyan-400" />
              <span className="text-[10px] font-bold text-cyan-400 tracking-wide">{aspectRatio}</span>
            </div>
            
            {/* Aspect Ratio Container */}
            <div 
              ref={viewerContainerRef}
              className="relative overflow-hidden bg-black"
              style={{
                width: '100%',
                height: '100%',
                maxWidth: (() => {
                  const ar = ASPECT_RATIOS.find(a => a.id === aspectRatio);
                  if (!ar) return '100%';
                  return ar.ratio > (16/9) ? '100%' : `${(ar.ratio / (16/9)) * 100}%`;
                })(),
                aspectRatio: (() => {
                  const parts = aspectRatio.split(':');
                  return parts.length === 2 ? `${parts[0]}/${parts[1]}` : '16/9';
                })(),
                maxHeight: '100%',
                margin: 'auto',
                cursor: activeClip ? (transformDragging ? 'grabbing' : 'grab') : 'default',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 0 30px rgba(0,0,0,0.5)',
                transition: 'max-width 0.3s ease, aspect-ratio 0.3s ease',
              }}
              onMouseDown={(e) => {
                if (activeClip) {
                  if (!isTransformMode) setIsTransformMode(true);
                  handleTransformMouseDown(e);
                }
              }}
              onWheel={(e) => {
                if (activeClip) {
                  if (!isTransformMode) setIsTransformMode(true);
                  handleTransformWheel(e);
                }
              }}
              onDoubleClick={() => {
                if (activeClip) setIsTransformMode(prev => !prev);
              }}
            >
              {/* Frame corner marks */}
              <div className="absolute inset-0 pointer-events-none z-20">
                {/* Top-left */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/25" />
                {/* Top-right */}
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white/25" />
                {/* Bottom-left */}
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white/25" />
                {/* Bottom-right */}
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/25" />
              </div>
            {useRemotionPreview && !selectedGalleryImage && remotionDurationInFrames > 0 ? (
              // 🎬 Remotion Player — real-time composition preview with effects & transitions
              <div className="relative w-full h-full">
                <Player
                  ref={playerRef}
                  component={MusicVideoComposition}
                  inputProps={remotionProps}
                  durationInFrames={Math.max(1, remotionDurationInFrames)}
                  compositionWidth={remotionCompositionSize.width}
                  compositionHeight={remotionCompositionSize.height}
                  fps={REMOTION_FPS}
                  style={{ width: '100%', height: '100%' }}
                  controls={false}
                  autoPlay={false}
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-purple-500/80 rounded text-[9px] text-white font-medium flex items-center gap-1">
                  <Film size={10} />
                  REMOTION
                </div>
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 rounded font-mono text-[10px] text-orange-400">
                  {formatTimecode(currentTime)}
                </div>
              </div>
            ) : selectedGalleryImage ? (
              // Mostrar imagen seleccionada de la galer�a
              <div className="relative w-full h-full">
                <img 
                  src={selectedGalleryImage.url} 
                  alt="Preview" 
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={() => setSelectedGalleryImage(null)}
                  className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
                  title="Volver al video"
                >
                  <XIcon size={14} className="text-white" />
                </button>
                {selectedGalleryImage.prompt && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[9px] sm:text-[10px] text-white/70 line-clamp-2">{selectedGalleryImage.prompt}</p>
                  </div>
                )}
              </div>
            ) : activeClipVideoUrl ? (
              // 🎬 CRITICAL: Mostrar VIDEO del clip activo (prioridad sobre imagen)
              <div className="relative w-full h-full overflow-hidden" style={{ pointerEvents: isTransformMode ? 'none' : 'auto' }}>
                <video
                  ref={activeVideoRef}
                  src={activeClipVideoUrl}
                  className="w-full h-full"
                  style={{
                    objectFit: activeClip?.metadata?.imageFit || 'contain',
                    transform: (() => {
                      const t = getClipTransform(activeClip || null);
                      return `translate(${t.x}%, ${t.y}%) scale(${t.scale})`;
                    })(),
                    transformOrigin: 'center center',
                  }}
                  playsInline
                  muted={activeClip?.type !== ClipType.VIDEO}
                  loop={!(activeClip?.sourceStart || activeClip?.in)}
                  autoPlay={isPlaying}
                  key={`video-${activeClip?.id}-${activeClipVideoUrl}`}
                  onLoadedMetadata={() => {
                    const vid = activeVideoRef.current;
                    if (vid && activeClip) {
                      // Sync time — account for sourceStart (cut clips start from offset)
                      const mediaOffset = activeClip.sourceStart || activeClip.in || 0;
                      const clipLocalTime = (currentTime - activeClip.start) + mediaOffset;
                      if (clipLocalTime >= 0 && clipLocalTime < (vid.duration || 6)) {
                        vid.currentTime = clipLocalTime;
                      }
                      // Set volume for imported video clips (their audio IS the source)
                      if (activeClip.type === ClipType.VIDEO) {
                        vid.volume = isMuted ? 0 : volume;
                        vid.muted = false;
                      }
                    }
                  }}
                />
                {/* Badge indicando que es video */}
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-orange-500/80 rounded text-[9px] text-white font-medium flex items-center gap-1">
                  <Film size={10} />
                  VIDEO � {activeClip?.title || `Escena ${activeClip?.id}`}
                </div>
                {/* Timecode */}
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 rounded font-mono text-[10px] text-orange-400">
                  {formatTimecode(currentTime)}
                </div>
              </div>
            ) : activeClipImageUrl ? (
              // 🖼️ Mostrar IMAGEN del clip activo (fallback cuando no hay video)
              <div className="relative w-full h-full overflow-hidden" style={{ pointerEvents: isTransformMode ? 'none' : 'auto' }}>
                <img 
                  src={activeClipImageUrl} 
                  alt={activeClip?.title || 'Preview'} 
                  className="w-full h-full transition-opacity duration-75"
                  style={{
                    objectFit: (activeClip?.metadata?.imageFit as any) || 'contain',
                    transform: (() => {
                      const t = getClipTransform(activeClip || null);
                      return `translate(${t.x}%, ${t.y}%) scale(${t.scale})`;
                    })(),
                    transformOrigin: 'center center',
                    pointerEvents: isTransformMode ? 'none' : 'auto',
                  }}
                  key={activeClip?.id}
                  draggable={false}
                />
                {/* Indicador de clip activo */}
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[9px] text-white/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  {activeClip?.title || `Escena ${activeClip?.id}`}
                </div>
                {/* Timecode */}
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 rounded font-mono text-[10px] text-orange-400">
                  {formatTimecode(currentTime)}
                </div>
              </div>
            ) : videoPreviewUrl ? (
              <video
                ref={videoRef}
                src={videoPreviewUrl}
                playsInline
                muted
                controls={false}
                className="w-full h-full object-contain"
                onClick={() => setIsPlaying(p=>!p)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 gap-2">
                <VideoIcon size={24} className="sm:w-8 sm:h-8" />
                <span className="text-[10px] sm:text-xs">Vista previa del video</span>
              </div>
            )}
            {/* 🎯 Transform mode overlay — rule-of-thirds grid + frame border */}
            {isTransformMode && activeClip && (
              <div className="absolute inset-0 pointer-events-none z-20" style={{ border: '2px solid rgba(249, 115, 22, 0.7)' }}>
                {/* Rule of thirds grid */}
                <div className="absolute inset-0 opacity-40" style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
                  `,
                  backgroundSize: '33.333% 33.333%',
                  backgroundPosition: '33.333% 33.333%',
                }} />
                {/* Center crosshair */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-orange-500/40" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-orange-500/40" />
                {/* Bright corner marks */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-orange-500" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-orange-500" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-orange-500" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-orange-500" />
                {/* Instructions */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/80 backdrop-blur-sm rounded-md text-[9px] text-white/70 whitespace-nowrap pointer-events-none border border-white/10">
                  <span className="text-orange-400 font-medium">Drag</span> to move · <span className="text-orange-400 font-medium">Scroll</span> to scale · <span className="text-orange-400 font-medium">Double-click</span> to exit
                </div>
              </div>
            )}
            {/* Barra de progreso */}
            {!selectedGalleryImage && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-10">
                <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-100" style={{ width: `${(currentTime/duration)*100}%` }}/>
              </div>
            )}
            </div>{/* End Aspect Ratio Container */}
          </div>

          {/* Divisor Vertical - Entre Visor y Galer�a */}
          <div 
            className={`w-3 sm:w-2 cursor-col-resize flex items-center justify-center transition-colors flex-shrink-0 hidden sm:flex touch-none ${
              isDraggingGallery ? 'bg-orange-500' : 'bg-neutral-800 hover:bg-orange-500/50 active:bg-orange-500/60'
            }`}
            onMouseDown={() => setIsDraggingGallery(true)}
            onTouchStart={() => setIsDraggingGallery(true)}
            title="Arrastra para ajustar ancho de galería"
          >
            <div className="h-8 w-0.5 bg-white/20 rounded-full" />
          </div>

          {/* Galeria de Archivos — Media Pool con bins estilo DaVinci Resolve */}
          <div 
            className="hidden sm:flex flex-col flex-shrink-0 bg-neutral-900/50 rounded-md border border-white/5 overflow-hidden"
            style={{ width: `${galleryWidth}px`, minWidth: '80px', maxWidth: '350px' }}
          >
            <MediaLibraryPanel
              items={mediaLibraryItems}
              onUpdateItems={handleUpdateMediaItems}
              onDelete={handleDeleteMediaItem}
              onSelect={handleSelectMediaItem}
              onAddToTimeline={onAddImageToTimeline ? (item) => {
                if (item.type === 'image') {
                  onAddImageToTimeline({ id: item.id, url: item.url, prompt: item.prompt || item.name });
                }
              } : undefined}
              onImport={() => handleOpenFilePicker('all')}
              selectedId={selectedGalleryImage?.id || null}
              width={galleryWidth}
              onOpenSourceMonitor={setSourceMonitorItem}
              onEditImage={handleMediaEditImage}
              onCameraAngles={handleMediaCameraAngles}
              onRegenerate={handleMediaRegenerate}
              onGenerateVideo={handleMediaGenerateVideo}
            />
          </div>
          
          {/* 🔊 Audio Element - Mejorado con manejo de eventos */}
          {activeAudioSource && (
            <audio 
              ref={audioRef} 
              src={activeAudioSource.url} 
              preload="auto"
              onCanPlayThrough={() => {
                setAudioReady(true);
                setAudioError(null);
              }}
              onError={(e) => {
                const error = e.currentTarget.error;
                const errorMsg = error ? `Error ${error.code}: ${error.message}` : 'Error desconocido';
                setAudioError(errorMsg);
                setAudioReady(false);
              }}
              onPlay={() => {}}
              onPause={() => {}}
              onEnded={() => {
                // Audio file reached its end — just mark as not started
                // The performance.now() clock keeps running, timeline continues
                audioStartedRef.current = false;
              }}
            />
          )}
        </div>

        {/* Divisor Arrastrable Horizontal - Entre Visor y Timeline */}
        <div 
          className={`h-3 sm:h-2 cursor-row-resize flex items-center justify-center transition-colors flex-shrink-0 touch-none ${
            isDraggingVertical ? 'bg-orange-500' : 'bg-neutral-800 hover:bg-orange-500/50 active:bg-orange-500/60'
          }`}
          onMouseDown={() => setIsDraggingVertical(true)}
          onTouchStart={() => setIsDraggingVertical(true)}
          title="Arrastra para ajustar altura del visor"
        >
          <div className="w-12 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Timeline con Capas - Ocupa el resto del espacio — DROP ZONE */}
        <div
          ref={timelineScrollRef}
          className="relative flex-1 overflow-x-auto overflow-y-hidden min-h-[120px]"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 #18181b' }}
          onWheel={handleTimelineWheel}
          onDrop={handleTimelineDrop}
          onDragOver={handleTimelineDragOver}
          onDragEnter={handleTimelineDragEnter}
          onDragLeave={handleTimelineDragLeave}
        >
          {/* 🎬 Drop zone overlay — visible while dragging files over timeline */}
          {isDraggingFileOver && (
            <div
              className="absolute inset-0 z-30 pointer-events-none"
              style={{ background: 'rgba(249, 115, 22, 0.06)', border: '2px dashed rgba(249, 115, 22, 0.5)', borderRadius: 6 }}
            >
              {/* Drop position vertical line */}
              {dropIndicator && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{ left: layerPanelWidth + dropIndicator.time * zoom, width: 2, background: '#f97316', zIndex: 35 }}
                >
                  {/* Top triangle */}
                  <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-orange-500" />
                </div>
              )}

              {/* Highlighted target layer band */}
              {dropIndicator && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: layerPanelWidth,
                    right: 0,
                    top: RULER_HEIGHT + (dropIndicator.layerId - 1) * DEFAULT_LAYER_HEIGHT,
                    height: DEFAULT_LAYER_HEIGHT,
                    background: 'rgba(249, 115, 22, 0.12)',
                    borderTop: '1px solid rgba(249, 115, 22, 0.4)',
                    borderBottom: '1px solid rgba(249, 115, 22, 0.4)',
                    zIndex: 31,
                  }}
                />
              )}

              {/* "Drop here" label */}
              <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 32 }}>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/70 border border-orange-500/50 shadow-lg">
                  <Upload size={16} className="text-orange-400" />
                  <span className="text-sm font-medium text-orange-300">Suelta aquí para importar</span>
                </div>
              </div>
            </div>
          )}
          {/* Divisor para ajustar ancho del panel de capas */}
          <div 
            className={`absolute top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center transition-colors ${
              isDraggingLayers ? 'bg-orange-500' : 'bg-transparent hover:bg-orange-500/50'
            }`}
            style={{ left: `${layerPanelWidth - 4}px` }}
            onMouseDown={() => setIsDraggingLayers(true)}
            onTouchStart={() => setIsDraggingLayers(true)}
            title="Arrastra para ajustar ancho del panel de capas"
          >
            <div className="w-0.5 h-8 bg-white/30 rounded-full" />
          </div>

          {/* Regla superior con timecode y playhead */}
          <div className="relative border-b border-white/10 bg-gradient-to-b from-neutral-800 to-neutral-900" style={{ height: 48, minWidth: `${layerPanelWidth + duration * zoom + 40}px` }}>
            {/* Panel de Timecode y Framerate - siempre visible */}
            <div 
              className="flex flex-col items-center justify-center bg-gradient-to-r from-neutral-800 to-neutral-700 z-20 shadow-lg border-r border-white/10"
              style={{ width: layerPanelWidth, position: 'sticky', left: 0, top: 0, bottom: 0, height: 48 }}
            >
              {/* Timecode principal */}
              <div className="text-[9px] sm:text-[11px] md:text-xs font-mono font-bold text-orange-400 tracking-wider" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {formatTimecode(currentTime)}
              </div>
              
              {/* Selector de Framerate */}
              <div className="flex items-center gap-0.5 mt-0.5">
                {[24, 30, 60].map((fps) => (
                  <button
                    key={fps}
                    onClick={() => setFramerate(fps as 24 | 30 | 60)}
                    className={`text-[7px] sm:text-[8px] px-1 py-0.5 rounded font-bold transition-all ${
                      framerate === fps 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80'
                    }`}
                  >
                    {fps}fps
                  </button>
                ))}
              </div>
            </div>
            
            <Ruler 
              zoom={zoom} 
              duration={effectiveDuration} 
              labelWidth={layerPanelWidth} 
              onRulerClick={handleTimelineClick}
              framerate={framerate}
            />
            
            {/* Playhead indicator en regla */}
            <div
              className="absolute top-0 bottom-0 bg-orange-500 z-10 pointer-events-none"
              style={{ left: layerPanelWidth + currentTime * zoom, width: PLAYHEAD_WIDTH }}
            >
              {/* Cabeza del playhead */}
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-orange-500" />
            </div>
          </div>

          <TimelineLayers
            clips={clips}
            currentTime={currentTime}
            duration={effectiveDuration}
            zoom={zoom}
            tool={tool}
            snapEnabled={snapEnabled}
            beatMarkers={beatGuides.map(time => ({ time }))}
            onSelectClip={handleSelectClip}
            selectedClipId={selectedClipId}
            onMoveClip={handleMoveClip}
            onResizeClip={handleResizeClip}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onResizeStart={handleResizeStart}
            onResizeEnd={handleResizeEnd}
            onRazorClick={handleRazorClick}
            onTimelineClick={handleTimelineClick}
            onDeleteClip={handleDeleteClip}
            layerLabelWidth={layerPanelWidth}
            // Acciones sobre clips
            onEditImage={handleEditImage}
            onAddMusician={handleAddMusician}
            onCameraAngles={handleCameraAngles}
            onRegenerateImage={handleRegenerateImage}
            onGenerateVideo={handleGenerateVideo}
            onUseAsReference={(clip) => {
              const url = clip.imageUrl || clip.url || clip.thumbnailUrl;
              if (url) {
                setImageGenReference({ url, type: 'style' });
                setShowImageGenerator(true);
              }
            }}
            onUseAsStyle={handleUseAsStyle}
            onVariations={handleVariations}
            onUpscale={handleUpscale}
            onLike={handleLike}
            onChoreography={handleChoreography}
            onUpdateImageFit={handleUpdateImageFit}
            onSnapQuery={handleSnapQuery}
            activeSnap={engine.activeSnap}
            onClipHoverStart={handleClipHoverStart}
            onClipHoverEnd={handleClipHoverEnd}
          />
        </div>

        {/* Barra de estado inferior - Mobile friendly */}
        <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 border-t border-white/10 bg-neutral-950/80 text-[9px] sm:text-[10px] text-white/50">
          <div className="flex items-center gap-2 sm:gap-4">
            <span>Clips: {clips.length}</span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">Duraci�n: {formatTime(duration)}</span>
            {/* BPM y estado de an�lisis */}
            {isAnalyzingAudio && (
              <span className="text-blue-400 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Analizando...
              </span>
            )}
            {audioAnalysis?.bpm && (
              <span className="text-green-400">? {Math.round(audioAnalysis.bpm)} BPM</span>
            )}
            {beatGuides.length > 0 && (
              <span className="hidden md:inline text-purple-400">{beatGuides.length} beats</span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden md:inline text-orange-400/60">Space: Play</span>
            <span className="hidden lg:inline">V/C/T/H: Tools</span>
            <span className="hidden xl:inline">Ctrl+Z/Y: Undo/Redo</span>
          </div>
        </div>
      </div>

      {/* Motion Control Panel */}
      <MotionControlPanel
        open={motionPanelOpen}
        onClose={() => setMotionPanelOpen(false)}
        clips={clips}
        onUpdateClip={updateClip}
      />

      {/* 📋 Storyboard Panel — Visual preview with script */}
      <StoryboardPanel
        open={showStoryboardPanel}
        onClose={() => setShowStoryboardPanel(false)}
        clips={clips}
        duration={effectiveDuration}
        aspectRatio={aspectRatio}
        projectContext={projectContext}
        artistReferenceImages={projectContext?.artistReferenceImages}
        onEditImage={handleEditImage}
        onCameraAngles={handleCameraAngles}
        onRegenerateImage={handleRegenerateImage}
        onGenerateVideo={handleGenerateVideo}
        onBatchGenerateVideos={handleBatchGenerateVideos}
        onAnimatedScene={(order, videoUrl) => {
          const sorted = [...clips].filter(c => c.layerId === 1).sort((a, b) => a.start - b.start);
          const target = sorted[order];
          if (target) {
            updateClip(target.id, {
              metadata: { videoUrl, hasVideo: true, videoGenerating: false, generatedWith: 'pipeline' },
            });
          }
        }}
        onAddMusician={handleAddMusician}
        onSelectClip={(clipId) => setSelectedClipId(clipId)}
        onSeekTo={(time) => setCurrentTime(time)}
        regeneratingId={isRegenerating}
        generatingVideoId={typeof isGeneratingVideo === 'number' ? isGeneratingVideo : null}
      />

      {/* 📱 Motion Sync Panel — Phone motion capture */}
      <MotionSyncPanel
        open={showMotionSyncPanel}
        onClose={() => setShowMotionSyncPanel(false)}
        clips={clips}
        onUpdateClip={updateClip}
        audioPreviewUrl={audioPreviewUrl}
        initialTab={motionSyncInitialTab}
      />

      {/* ⚡ MicroCuts Panel - Microcortes Cinematográficos */}
      {showMicroCutsPanel && (
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '16px',
          zIndex: 40,
          width: '320px',
          maxWidth: 'calc(100vw - 32px)',
        }}>
          <MicroCutsPanel
            config={microCutConfig}
            onConfigChange={setMicroCutConfig}
            onApplyMicroCuts={handleApplyMicroCuts}
            plans={microCutPlans}
            genre={genreHint}
            bpm={audioAnalysis?.bpm}
            totalClips={clips.filter(c => c.layerId === 1).length}
            isApplying={isApplyingMicroCuts}
            beatsAvailable={audioAnalysis?.beats?.length || 0}
          />
        </div>
      )}

      {/* Video Preview Modal */}
      <VideoPreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        scene={selectedScene}
        videoUrl={selectedScene?.video_url}
        isGenerating={selectedScene?.video_status === 'generating'}
        onApprove={(scene) => {
          logger.info(`? [Preview] Video aprobado para ${scene.scene_id}`);
          setPreviewModalOpen(false);
        }}
        onRegenerate={(scene) => {
          logger.info(`?? [Preview] Regenerando video para ${scene.scene_id}`);
        }}
      />

      {/* ?? Modal de M�sico */}
      {showMusicianModal && musicianModalClip && (
        <MusicianModal
          open={showMusicianModal}
          onClose={() => {
            setShowMusicianModal(false);
            setMusicianModalClip(null);
          }}
          timelineItem={{
            id: String(musicianModalClip.id),
            timestamp: musicianModalClip.start,
            imageUrl: musicianModalClip.imageUrl || musicianModalClip.url,
            clipTitle: musicianModalClip.title,
          }}
          scriptContext={musicianModalClip.title || ''}
          onMusicianCreated={handleMusicianAdded}
          onDuplicateToNearby={handleDuplicateMusicianToNearby}
        />
      )}

      {/* 🎬 Modal de Ángulos de Cámara - PERFORMANCE ONLY */}
      {showCameraAnglesModal && cameraAnglesModalClip && (
        <CameraAnglesModal
          open={showCameraAnglesModal}
          onClose={() => {
            setShowCameraAnglesModal(false);
            setCameraAnglesModalClip(null);
          }}
          clip={cameraAnglesModalClip}
          onSelectAngle={handleCameraAngleSelected}
          onDuplicateToNearby={handleDuplicateCameraAngleToNearby}
          // 🎭 Pasar referencias del artista para máxima consistencia facial
          artistReferenceImages={projectContext?.artistReferenceImages || []}
          originalPrompt={
            cameraAnglesModalClip.metadata?.imagePrompt ||
            (cameraAnglesModalClip.metadata as any)?.prompt ||
            cameraAnglesModalClip.title
          }
        />
      )}

      {/* ?? Modal de Editor de Imagen (Nano Banana AI) */}
      {showImageEditorModal && imageEditorModalClip && (
        <ImageEditorModal
          open={showImageEditorModal}
          onClose={() => {
            setShowImageEditorModal(false);
            setImageEditorModalClip(null);
          }}
          imageUrl={imageEditorModalClip.imageUrl || imageEditorModalClip.url}
          originalPrompt={imageEditorModalClip.metadata?.imagePrompt || imageEditorModalClip.title}
          onImageEdited={handleImageEdited}
        />
      )}

      {/* 🎬 Video Generation Modal — direct generation with model picker */}
      {videoGenClip && (
        <VideoGenerationModal
          isOpen={!!videoGenClip}
          onClose={() => setVideoGenClip(null)}
          clip={videoGenClip}
          aspectRatio={aspectRatio}
          onVideoGenerated={handleVideoGenerated}
        />
      )}

      {/* � Source Monitor — set In/Out marks before adding to timeline */}
      <SourceMonitorModal
        item={sourceMonitorItem}
        onClose={() => setSourceMonitorItem(null)}
        onAddToTimeline={handleSourceMonitorAdd}
      />

      {/* �💰 Video Budget Modal — Pre-generation payment gate */}
      <VideoBudgetModal
        isOpen={showBudgetModal}
        onClose={() => {
          setShowBudgetModal(false);
          setPendingGenerateClip(null);
        }}
        onBudgetApproved={(budgetId) => {
          setBudgetApproved(true);
          setCurrentBudgetId(budgetId);
          setShowBudgetModal(false);
          toast({
            title: '✅ Presupuesto Aprobado',
            description: 'Ya puedes generar videos. ¡Manos a la obra!',
          });
          if (pendingGenerateClip) {
            const clipToGenerate = pendingGenerateClip;
            setPendingGenerateClip(null);
            setTimeout(() => handleGenerateVideo(clipToGenerate), 300);
          }
        }}
        isAdmin={isAdmin}
        songDuration={duration}
        numClips={clips.length}
        clipDuration={clips.length > 0 ? Math.round(clips.reduce((sum, c) => sum + c.duration, 0) / clips.length) : 5}
        songTitle={projectName || projectContext?.songTitle || 'Video Musical'}
        userEmail={user?.email || ''}
        userId={user?.id ? String(user.id) : undefined}
        projectId={undefined}
      />

      {/* ?? Export Panel */}
      <ExportPanel
        open={showExportPanel}
        onClose={() => setShowExportPanel(false)}
        clips={clips}
        duration={duration}
        audioUrl={audioPreviewUrl}
        projectName={projectName || 'boostify-export'}
        aspectRatio={aspectRatio}
        onExportComplete={onExportComplete}
      />

      {/* 🖼️ Image Generator Panel */}
      <ImageGeneratorPanel
        open={showImageGenerator}
        onClose={() => {
          setShowImageGenerator(false);
          setImageGenReference(null);
        }}
        clips={clips}
        selectedClipId={selectedClipId}
        onImageApplied={(clipId, newImageUrl, prompt) => {
          setClips(prev => prev.map(c =>
            c.id === clipId
              ? { ...c, imageUrl: newImageUrl, url: newImageUrl, thumbnailUrl: newImageUrl, generatedImage: true, metadata: { ...c.metadata, imagePrompt: prompt } }
              : c
          ));
        }}
        onAddAsNewClip={(imageUrl, prompt) => {
          const maxId = clips.reduce((max, c) => Math.max(max, c.id), 0);
          const lastClip = clips[clips.length - 1];
          const start = lastClip ? lastClip.start + lastClip.duration : 0;
          setClips(prev => [...prev, {
            id: maxId + 1,
            layerId: 1,
            type: 'IMAGE' as any,
            start,
            duration: 5,
            imageUrl,
            url: imageUrl,
            thumbnailUrl: imageUrl,
            generatedImage: true,
            title: prompt.substring(0, 50),
            metadata: { imagePrompt: prompt },
          }]);
        }}
        initialReference={imageGenReference}
      />

      {/* 🔀 Variations Panel */}
      {showVariationsPanel && variationsClip && (
        <VariationsPanel
          open={showVariationsPanel}
          onClose={() => {
            setShowVariationsPanel(false);
            setVariationsClip(null);
          }}
          clip={variationsClip}
          onVariationsGenerated={(results) => {
            logger.info(`🔀 [Timeline] ${results.length} variations generated for clip ${variationsClip.id}`);
          }}
          onApplyToClip={(clipId, imageUrl) => {
            updateClip(clipId, {
              imageUrl,
              url: imageUrl,
              thumbnailUrl: imageUrl,
              metadata: {
                ...variationsClip.metadata,
                variationApplied: true,
              },
            });
            toast({ title: '✅ Variation applied' });
          }}
        />
      )}

      {/* ??? Men� Contextual (Click Derecho) */}
      {contextMenu.visible && (
        <div 
          className="fixed z-50 bg-neutral-900 border border-white/20 rounded-lg shadow-2xl py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header del men� */}
          <div className="px-3 py-1.5 border-b border-white/10 mb-1">
            <span className="text-[10px] text-white/50 uppercase tracking-wide">
              {contextMenu.clipId ? 'Opciones del Clip' : 'Timeline'}
            </span>
          </div>

          {/* Opciones para clips */}
          {contextMenu.clipId && (
            <>
              <button
                onClick={handleCopyClip}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-orange-500/20 hover:text-orange-400 transition-colors"
              >
                <Copy size={14} />
                <span>Copiar</span>
                <span className="ml-auto text-[10px] text-white/40">Ctrl+C</span>
              </button>
              
              <button
                onClick={handleDuplicateClip}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
              >
                <Layers size={14} />
                <span>Duplicar</span>
                <span className="ml-auto text-[10px] text-white/40">Ctrl+D</span>
              </button>

              <button
                onClick={handleSplitAtPlayhead}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-purple-500/20 hover:text-purple-400 transition-colors"
              >
                <Split size={14} />
                <span>Dividir en playhead</span>
                <span className="ml-auto text-[10px] text-white/40">C</span>
              </button>

              <div className="my-1 border-t border-white/10" />

              {/* ?? Generar Video */}
              {(() => {
                const clip = clips.find(c => c.id === contextMenu.clipId);
                const hasImage = clip?.imageUrl || clip?.url || clip?.thumbnailUrl;
                const hasVideo = clip?.metadata?.videoUrl || clip?.metadata?.hasVideo;
                return hasImage && !hasVideo && (
                  <button
                    onClick={() => {
                      if (clip) handleGenerateVideo(clip);
                      closeContextMenu();
                    }}
                    disabled={isGeneratingVideo === clip?.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-blue-500/20 hover:text-blue-400 transition-colors disabled:opacity-50"
                  >
                    {isGeneratingVideo === clip?.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Film size={14} />
                    )}
                    <span>Generar Video</span>
                  </button>
                );
              })()}

              {/* ?? Aplicar Lipsync - Solo para clips PERFORMANCE con video */}
              {(() => {
                const clip = clips.find(c => c.id === contextMenu.clipId);
                const hasVideo = clip?.metadata?.videoUrl;
                const isPerformance = clip?.metadata?.shotCategory === 'PERFORMANCE';
                const hasLipsync = clip?.metadata?.lipsyncApplied;
                return hasVideo && isPerformance && !hasLipsync && (
                  <button
                    onClick={() => {
                      if (clip) handleApplyLipsync(clip);
                      closeContextMenu();
                    }}
                    disabled={isApplyingLipsync === clip?.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-pink-500/20 hover:text-pink-400 transition-colors disabled:opacity-50"
                  >
                    {isApplyingLipsync === clip?.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Music size={14} />
                    )}
                    <span>?? Aplicar Lipsync</span>
                  </button>
                );
              })()}

              {/* ?? Mostrar si ya tiene lipsync aplicado */}
              {(() => {
                const clip = clips.find(c => c.id === contextMenu.clipId);
                const hasLipsync = clip?.metadata?.lipsyncApplied;
                return hasLipsync && (
                  <div className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-400">
                    <Music size={14} />
                    <span>? Lipsync aplicado</span>
                  </div>
                );
              })()}

              <div className="my-1 border-t border-white/10" />

              <button
                onClick={handleDeleteClipContext}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <TrashIcon size={14} />
                <span>Eliminar</span>
                <span className="ml-auto text-[10px] text-white/40">Del</span>
              </button>
            </>
          )}

          {/* Opciones generales */}
          {!contextMenu.clipId && (
            <>
              <button
                onClick={handlePasteClip}
                disabled={!clipboardClip}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  clipboardClip 
                    ? 'text-white/90 hover:bg-green-500/20 hover:text-green-400' 
                    : 'text-white/30 cursor-not-allowed'
                }`}
              >
                <ClipboardPaste size={14} />
                <span>Pegar aquí</span>
                <span className="ml-auto text-[10px] text-white/40">Ctrl+V</span>
              </button>

              <button
                onClick={handleSetPlayheadHere}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-orange-500/20 hover:text-orange-400 transition-colors"
              >
                <MoreHorizontal size={14} />
                <span>Mover playhead aquí</span>
              </button>

              <div className="my-1 border-t border-white/10" />

              <button
                onClick={() => { setSnapEnabled(s => !s); closeContextMenu(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors"
              >
                <MagnetIcon size={14} className={snapEnabled ? 'text-orange-400' : ''} />
                <span>Snap magnético</span>
                <span className={`ml-auto text-[10px] ${snapEnabled ? 'text-orange-400' : 'text-white/40'}`}>
                  {snapEnabled ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                onClick={() => { setRippleEnabled(r => !r); closeContextMenu(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors"
              >
                <TrashIcon size={14} className={rippleEnabled ? 'text-red-400' : ''} />
                <span>Ripple delete</span>
                <span className={`ml-auto text-[10px] ${rippleEnabled ? 'text-red-400' : 'text-white/40'}`}>
                  {rippleEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            </>
          )}

          {/* Footer con timestamp */}
          <div className="px-3 py-1.5 border-t border-white/10 mt-1">
            <span className="text-[10px] text-white/40 font-mono">
              @ {formatTime(currentTime)}
            </span>
          </div>
        </div>
      )}

      {/* 📂 Menu Contextual de la Galeria (Click Derecho) */}
      {galleryContextMenu.visible && (
        <div
          className="fixed z-50 bg-neutral-900 border border-white/20 rounded-lg shadow-2xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: galleryContextMenu.x, top: galleryContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-white/10 mb-1">
            <span className="text-[10px] text-white/50 uppercase tracking-wide">
              Importar Media
            </span>
          </div>
          
          <button
            onClick={() => { handleOpenFilePicker('image'); setGalleryContextMenu({ visible: false, x: 0, y: 0 }); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-green-500/20 hover:text-green-400 transition-colors"
          >
            <ImagePlus size={14} />
            <span>Importar Imagenes</span>
          </button>
          
          <button
            onClick={() => { handleOpenFilePicker('audio'); setGalleryContextMenu({ visible: false, x: 0, y: 0 }); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-yellow-500/20 hover:text-yellow-400 transition-colors"
          >
            <FileAudio size={14} />
            <span>Importar Audio</span>
          </button>
          
          <button
            onClick={() => { handleOpenFilePicker('video'); setGalleryContextMenu({ visible: false, x: 0, y: 0 }); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-purple-500/20 hover:text-purple-400 transition-colors"
          >
            <FileVideo size={14} />
            <span>Importar Video</span>
          </button>
          
          <div className="my-1 border-t border-white/10" />
          
          <button
            onClick={() => { handleOpenFilePicker('all'); setGalleryContextMenu({ visible: false, x: 0, y: 0 }); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-cyan-500/20 hover:text-cyan-400 transition-colors"
          >
            <Upload size={14} />
            <span>Todos los archivos</span>
          </button>
        </div>
      )}

      {/* 🎬 Director AI — Script Tooltip (hover on clips) */}
      {hoveredClip && hoveredClip.clip && (
        <ClipScriptTooltip
          clip={hoveredClip.clip}
          director={activeDirector}
          clipIndex={clips.filter(c => c.layerId === 1).findIndex(c => c.id === hoveredClip.clip.id)}
          totalClips={clips.filter(c => c.layerId === 1).length}
          songDuration={duration}
          position={hoveredClip.position}
          onOpenChat={activeDirector ? handleOpenDirectorChat : undefined}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
          onEditImage={handleEditImage}
          onRegenerateImage={handleRegenerateImage}
          onGenerateVideo={handleGenerateVideo}
          onCameraAngles={handleCameraAngles}
        />
      )}

      {/* 🎬 Director Suggestions Panel */}
      {activeDirector && (
        <DirectorSuggestionsPanel
          director={activeDirector}
          clips={clips}
          isOpen={directorPanelOpen}
          onClose={() => setDirectorPanelOpen(false)}
          onApplySuggestion={handleApplyDirectorSuggestion}
          onRevertAll={handleRevertDirectorChanges}
          appliedCount={directorAppliedCount}
          scriptContent={projectContext?.scriptContent}
        />
      )}

      {/* 🎬 Director Chat Overlay */}
      {chatClip && activeDirector && (
        <DirectorChatOverlay
          director={activeDirector}
          clip={chatClip}
          allClips={clips}
          clipIndex={clips.filter(c => c.layerId === 1).findIndex(c => c.id === chatClip.id)}
          onClose={() => setChatClip(null)}
          onApplyAction={handleApplyChatAction}
          scriptContent={projectContext?.scriptContent}
        />
      )}
      </>
    </PortalContainerContext.Provider>
  );
};

/** ---------- Helpers ---------- */
// Función que acepta clips en cualquier formato (TimelineClip o TimelineItem) y los normaliza
// También segmenta clips mayores de MAX_CLIP_DURATION para compatibilidad con generación de video
function normalizeClips(clips: any[]): TimelineClip[] {
  if (!clips || !Array.isArray(clips)) return [];
  
  const normalizedClips: TimelineClip[] = [];
  let globalId = 1;
  
  clips.forEach((c, index) => {
    // Priorizar URLs de imagen en este orden
    const imageUrl = c.url || c.imageUrl || c.image_url || c.generatedImageUrl || 
                     c.publicUrl || c.firebaseUrl || c.thumbnailUrl || '';
    
    // CRITICAL: Asignar layerId por defecto basado en el tipo de clip
    // Capa 1 = Video/Imágenes, Capa 2 = Audio Principal, Capa 3 = Lipsync Segments
    // NOTA: Aceptar tanto 'layerId' como 'layer' para compatibilidad con TimelineClipUnified
    const typeStr = typeof c.type === 'string' ? c.type.toUpperCase() : 'IMAGE';
    const normalizedType = (typeStr === 'AUDIO' ? ClipType.AUDIO : 
                            typeStr === 'VIDEO' ? ClipType.VIDEO :
                            typeStr === 'GENERATED_IMAGE' ? ClipType.GENERATED_IMAGE :
                            ClipType.IMAGE) as ClipType;
    
    // Determinar layerId: 1=Video/Imagen, 2=Audio Principal, 3=Lipsync Segments
    let layerId = c.layerId || c.layer;
    if (!layerId) {
      if (normalizedType === ClipType.AUDIO) {
        // Si es segmento de lipsync, usar capa 3; sino capa 2
        layerId = c.metadata?.isLipsyncSegment ? 3 : 2;
      } else {
        layerId = 1;
      }
    }
    
    // CRITICAL: Convertir start_time/end_time (ms) a start/duration (segundos)
    // TimelineItem usa start_time en ms, TimelineClip usa start en segundos
    let startSeconds: number;
    let durationSeconds: number;
    
    if (typeof c.start_time === 'number') {
      // Es un TimelineItem - convertir de ms a segundos
      startSeconds = c.start_time / 1000;
      if (typeof c.end_time === 'number') {
        durationSeconds = (c.end_time - c.start_time) / 1000;
      } else if (typeof c.duration === 'number' && c.duration > 100) {
        // duration en ms
        durationSeconds = c.duration / 1000;
      } else {
        durationSeconds = c.duration || 3;
      }
    } else {
      // Ya es TimelineClip format
      startSeconds = typeof c.start === 'number' ? c.start : 0;
      durationSeconds = typeof c.duration === 'number' ? c.duration : 3;
    }
    
    // ?? CRITICAL: Segmentar clips mayores de MAX_CLIP_DURATION
    // Las generaciones de video solo soportan hasta 6 segundos
    // NOTA: NO segmentar clips de VIDEO importados — solo IMAGE/GENERATED_IMAGE para AI generation
    if (durationSeconds > MAX_CLIP_DURATION && normalizedType !== ClipType.AUDIO && normalizedType !== ClipType.VIDEO) {
      const segmentCount = Math.ceil(durationSeconds / MAX_CLIP_DURATION);
      
      for (let i = 0; i < segmentCount; i++) {
        const segmentStart = startSeconds + (i * MAX_CLIP_DURATION);
        const remainingDuration = durationSeconds - (i * MAX_CLIP_DURATION);
        const segmentDuration = Math.min(MAX_CLIP_DURATION, remainingDuration);
        
        normalizedClips.push({
          ...c,
          id: globalId++,
          layerId: layerId,
          in: 0,
          out: segmentDuration,
          sourceStart: 0,
          type: normalizedType,
          start: segmentStart,
          duration: segmentDuration,
          url: imageUrl,
          imageUrl: imageUrl,
          thumbnailUrl: c.thumbnailUrl || imageUrl,
          title: c.title ? `${c.title} (${i + 1}/${segmentCount})` : `Escena ${globalId - 1}`,
          // Marcar como segmento para posible regeneración
          isSegment: true,
          originalDuration: durationSeconds,
          segmentIndex: i,
        } as TimelineClip);
      }
    } else {
      // Clip dentro de límites - agregar normalmente
      normalizedClips.push({
        ...c,
        id: typeof c.id === 'number' ? c.id : globalId++,
        layerId: layerId,
        in: c.in ?? 0,
        out: c.out ?? durationSeconds,
        sourceStart: c.sourceStart ?? 0,
        type: normalizedType,
        start: startSeconds,
        duration: durationSeconds,
        url: imageUrl,
        imageUrl: imageUrl,
        thumbnailUrl: c.thumbnailUrl || imageUrl,
      } as TimelineClip);
    }
  });
  
  return normalizedClips;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const d = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${d}`;
}

const Ruler: React.FC<{ zoom: number; duration: number; labelWidth: number; onRulerClick?: (time: number) => void; framerate?: number }> = ({ zoom, duration, labelWidth, onRulerClick, framerate = 30 }) => {

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onRulerClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const time = clickX / zoom;
    const snappedTime = Math.round(time * framerate) / framerate;
    onRulerClick(Math.max(0, Math.min(duration, snappedTime)));
  };

  // ═══════════════════════════════════════════════════════════
  // PROFESSIONAL NLE RULER — Premiere Pro / DaVinci Resolve style
  // Dynamically selects major/minor intervals based on px/s zoom
  // Always shows SMPTE timecode (HH:MM:SS:FF)
  // ═══════════════════════════════════════════════════════════

  const frameTime = 1 / framerate;

  // Formatear timecode SMPTE: MM:SS:FF (o HH:MM:SS:FF si > 1h)
  const fmtTC = (seconds: number): string => {
    const totalFrames = Math.round(seconds * framerate);
    const ff = totalFrames % framerate;
    const totalSec = Math.floor(totalFrames / framerate);
    const ss = totalSec % 60;
    const mm = Math.floor(totalSec / 60) % 60;
    const hh = Math.floor(totalSec / 3600);
    if (hh > 0) return `${String(hh)}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}:${String(ff).padStart(2,'0')}`;
    return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}:${String(ff).padStart(2,'0')}`;
  };

  // Short format for when labels need to be compact
  const fmtShort = (seconds: number): string => {
    const totalSec = Math.floor(seconds);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    if (mm > 0) return `${mm}:${String(ss).padStart(2,'0')}`;
    return `${ss}s`;
  };

  // ── Determine intervals based on zoom (px per second) ──
  // The goal: major labels should be spaced ~80-200px apart
  // We pick the smallest interval whose px width >= minLabelSpacing
  const minLabelSpacing = 70;
  
  // Candidate intervals in seconds, from finest to coarsest
  // Each: [majorInterval, minorSubdivisions, labelStyle]
  type IntervalDef = { major: number; minorCount: number; mode: 'frames' | 'time' };
  const candidates: IntervalDef[] = [
    { major: frameTime,       minorCount: 1, mode: 'frames' },  // 1 frame
    { major: frameTime * 2,   minorCount: 2, mode: 'frames' },  // 2 frames
    { major: frameTime * 5,   minorCount: 5, mode: 'frames' },  // 5 frames
    { major: frameTime * 10,  minorCount: 5, mode: 'frames' },  // 10 frames
    { major: 0.5,             minorCount: 5, mode: 'time' },    // half second
    { major: 1,               minorCount: framerate <= 30 ? 5 : 6, mode: 'time' },  // 1s
    { major: 2,               minorCount: 4, mode: 'time' },     // 2s
    { major: 5,               minorCount: 5, mode: 'time' },     // 5s
    { major: 10,              minorCount: 5, mode: 'time' },     // 10s
    { major: 15,              minorCount: 3, mode: 'time' },     // 15s
    { major: 30,              minorCount: 6, mode: 'time' },     // 30s
    { major: 60,              minorCount: 6, mode: 'time' },     // 1min
    { major: 120,             minorCount: 4, mode: 'time' },     // 2min
    { major: 300,             minorCount: 5, mode: 'time' },     // 5min
    { major: 600,             minorCount: 5, mode: 'time' },     // 10min
  ];

  // Pick the finest interval that still gives enough label spacing
  let chosen = candidates[candidates.length - 1];
  for (const c of candidates) {
    if (c.major * zoom >= minLabelSpacing) {
      chosen = c;
      break;
    }
  }

  const majorInterval = chosen.major;
  const minorInterval = majorInterval / chosen.minorCount;
  const showFrameNumbers = chosen.mode === 'frames';

  // ── Generate all ticks ──
  const ticks: React.ReactNode[] = [];
  const totalTicks = Math.ceil(duration / minorInterval) + 1;
  
  // Limit total tick count for performance
  const maxTicks = 3000;
  const step = totalTicks > maxTicks ? Math.ceil(totalTicks / maxTicks) : 1;

  for (let i = 0; i <= totalTicks; i += step) {
    const time = i * minorInterval;
    if (time > duration + minorInterval) break;
    
    const x = time * zoom;
    
    // Determine tick rank
    const isMajor = Math.abs(time % majorInterval) < frameTime * 0.5 || 
                     Math.abs(time % majorInterval - majorInterval) < frameTime * 0.5;
    const halfInterval = majorInterval / 2;
    const isMid = !isMajor && (
      Math.abs(time % halfInterval) < frameTime * 0.5 || 
      Math.abs(time % halfInterval - halfInterval) < frameTime * 0.5
    );
    
    // Visual properties by rank
    let height: number, width: number, opacity: number;
    if (isMajor) {
      height = 65; width = 1.5; opacity = 1;
    } else if (isMid) {
      height = 42; width = 1; opacity = 0.45;
    } else {
      height = 22; width = 1; opacity = 0.18;
    }

    ticks.push(
      <div key={`t-${i}`} className="absolute h-full pointer-events-none" style={{ left: x }}>
        {/* Tick line */}
        <div 
          className="absolute bottom-0"
          style={{ 
            width, 
            height: `${height}%`,
            background: isMajor 
              ? 'rgba(249,115,22,0.9)' 
              : isMid 
                ? 'rgba(255,255,255,0.35)' 
                : `rgba(255,255,255,${opacity})`,
            boxShadow: isMajor ? '0 0 4px rgba(249,115,22,0.3)' : 'none',
          }}
        />
        
        {/* Label — only on major ticks */}
        {isMajor && (
          <div className="absolute top-[2px] -translate-x-1/2" style={{ left: 0 }}>
            <span 
              className="font-mono font-semibold text-white whitespace-nowrap px-1 py-0.5 rounded-sm leading-none"
              style={{ 
                fontSize: showFrameNumbers ? '9px' : majorInterval >= 60 ? '10px' : '9.5px',
                background: 'rgba(0,0,0,0.65)',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                border: '1px solid rgba(249,115,22,0.2)',
                letterSpacing: '0.02em',
              }}
            >
              {showFrameNumbers ? fmtTC(time) : majorInterval < 1 ? fmtTC(time) : fmtTC(time)}
            </span>
            {/* Frame number below label at high zoom */}
            {showFrameNumbers && (
              <div className="text-center mt-0.5">
                <span className="font-mono text-orange-300/50 leading-none" style={{ fontSize: '7px' }}>
                  f{Math.round(time * framerate)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div 
      className="absolute inset-0 select-none overflow-visible cursor-pointer" 
      style={{ marginLeft: labelWidth }}
      onClick={handleClick}
    >
      {/* Professional dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-800/80 via-neutral-900/90 to-black" />
      
      {/* Bottom baseline */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-orange-500/40 via-orange-400/25 to-orange-500/40" />
      
      {/* All ticks */}
      {ticks}
      
      {/* FPS badge — sticky right */}
      <div 
        className="absolute top-1 right-2 font-mono font-bold text-orange-400/80 px-1.5 py-0.5 rounded"
        style={{ 
          fontSize: '8px',
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(249,115,22,0.3)',
          letterSpacing: '0.04em',
        }}
      >
        {framerate}fps · {majorInterval >= 1 ? `${majorInterval}s` : `${Math.round(majorInterval * framerate)}f`}
      </div>
    </div>
  );
};

export default TimelineEditor;

