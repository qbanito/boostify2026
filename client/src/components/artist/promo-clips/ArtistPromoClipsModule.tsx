/**
 * ArtistPromoClipsModule
 *
 * Song-to-Visual Lipsync Promo Engine
 * Genera videos cortos donde el artista canta sincronizado.
 *
 * Pipeline:
 *  1. Seleccionar canciÃ³n
 *  2. Analizar canciÃ³n â†’ detectar segmento viral (AI)
 *  3. Generar direcciÃ³n visual por gÃ©nero (AI)
 *  4. Generar imagen 9:16 del artista (FAL Flux Kontext)
 *  5. Generar video lipsync/performance (FAL OmniHuman, Seedance 2.0 o Kling+Sync-3)
 *  6. Generar captions/hashtags/CTA
 *  7. Exportar pack completo
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Film,
  Music,
  Sparkles,
  Wand2,
  Image,
  Video,
  Play,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  Crown,
  Share2,
  Copy,
  Star,
  Settings,
  X,
  MessageSquare,
  Camera,
} from 'lucide-react';
import { apiRequest } from '../../../lib/queryClient';
import { DIRECTORS } from '../../../data/directors';
import { storage } from '../../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PromoStyleSelector, VISUAL_STYLES, type VisualStyle } from './PromoStyleSelector';
import { PromoColorMoodPicker, COLOR_MOODS, type ColorPalette } from './PromoColorMoodPicker';
import { PromoAutoFlow, useAutoFlow, type AutoFlowStepId } from './PromoAutoFlow';
import { PromoPosterGenerator } from './PromoPosterGenerator';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Song {
  id: string;
  name?: string;
  title?: string;
  audioUrl?: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  duration?: number | string;
  coverUrl?: string;
  lyrics?: string;
}

interface SongAnalysis {
  detected_genre: string;
  detected_mood: string;
  detected_bpm_feel: string;
  best_segment: {
    start_time: number;
    end_time: number;
    lyrics_excerpt: string;
    reason: string;
  };
  segment_type: string;
  viral_hook: string;
  energy_level: number;
  emotional_trigger: string;
  lyrics_source?: string;
  transcript_quality?: string;
  story_seed?: string;
  transcribed_lyrics_excerpt?: string;
  transcript_segments?: Array<{ start: number; end: number; text: string }>;
}

interface VisualDirection {
  scene_description: string;
  artist_action: string;
  lighting: string;
  camera_movement: string;
  emotion: string;
  wardrobe_detail: string;
  background_detail: string;
  color_grade: string;
  fal_image_prompt: string;
  kling_motion_prompt: string;
}

interface CaptionsData {
  tiktok?: { caption: string; hashtags: string[]; cta_text: string; onscreen_text: string };
  instagram_reels?: { caption: string; hashtags: string[]; cta_text: string; onscreen_text: string };
  youtube_shorts?: { caption: string; hashtags: string[]; cta_text: string; onscreen_text: string };
}

interface GeneratedImage {
  url: string;
  index: number;
}

interface CharacterLock {
  id: string;
  referenceImageUrls: string[];
  primaryReferenceImageUrl: string;
  masterImageUrl?: string;
  identityLabel: string;
  faceLockPrompt: string;
  wardrobeLockPrompt: string;
  accessoryLockPrompt: string;
  brollContinuityPrompt: string;
  lyricContinuityPrompt: string;
  negativePrompt: string;
  scenePromptPrefix: string;
  faceBiblePrompt?: string;
  faceQualityChecklist?: string[];
  qualityChecklist: string[];
}

interface PromoClipsProps {
  artistId: string;
  songs?: Song[];
  colors?: { primary?: string; secondary?: string; accent?: string };
  isOwnProfile?: boolean;
  artistName?: string;
  artistProfileImage?: string;
  artistGenre?: string;
  artistBiography?: string;
}

type Step = 'select' | 'analyze' | 'direction' | 'image' | 'video' | 'captions' | 'export';
type LipsyncMode = 'omnihuman' | 'seedance-fast-r2v' | 'seedance-mini-r2v' | 'kling-v21-standard-sync3' | 'kling-v3-standard-sync3' | 'kling-v3-pro-sync3' | 'pixverse-v6' | 'pixverse-sora-2' | 'pixverse-veo-3.1-fast';
type ClipDuration = 15 | 30 | 60;
type Platform = 'tiktok' | 'instagram_reels' | 'youtube_shorts';
type AudioClipLock = { audioUrl?: string; clipStartSeconds?: number; duration?: number };
type PromoWorkflow = 'single' | 'narrative-30s';
type NarrativeSceneType = 'lipsync' | 'performance' | 'broll' | 'cutaway';
type NarrativeSceneStatus = 'idle' | 'queued' | 'polling' | 'syncing' | 'done' | 'error';

interface NarrativeScene {
  id: string;
  index: number;
  act?: 'ACT_1' | 'ACT_2' | 'ACT_3';
  startTime: number;
  endTime: number;
  duration: number;
  sourceSceneId?: string;
  sourceIndex?: number;
  generationStartTime?: number;
  sourceOffset?: number;
  sourceDuration?: number;
  isContinuationCut?: boolean;
  sceneType: NarrativeSceneType;
  shotType: string;
  cameraMovement: string;
  lyricsExcerpt: string;
  visualIntent: string;
  emotion: string;
  model: LipsyncMode;
  requiresLipsync: boolean;
  estimatedCost: number;
  lyricConnection?: string;
  continuityPrompt?: string;
  brollSubject?: string;
  symbolEvolution?: string;
  palettePrompt?: string;
  identityPrompt?: string;
  cutVariationPrompt?: string;
  lensPrompt?: string;
  lightingPrompt?: string;
  editCue?: string;
  transition?: string;
  shotContinuityPrompt?: string;
  faceBiblePrompt?: string;
  paletteBiblePrompt?: string;
  pipelineRole?: string;
  qualityChecklist?: string[];
  sceneImageUrl?: string;
  imagePrompt: string;
  videoPrompt: string;
}

interface PaletteBible {
  prompt: string;
  colorStory?: string;
  skinToneRule?: string;
  lightingRule?: string;
  gradeRule?: string;
}

interface EditingGrammar {
  bpmFeel: string;
  rhythmRule: string;
  transitionPlan: string;
  microCutRule: string;
}

interface NarrativeStoryboard {
  id: string;
  title: string;
  concept: string;
  narrativeArcPlan?: string;
  songId: string;
  songTitle: string;
  duration: number;
  clipStartSeconds: number;
  clipEndSeconds: number;
  sourceSceneDuration?: number;
  sourceSceneCount?: number;
  totalCuts?: number;
  editMode?: string;
  performancePercent: number;
  lipsyncPercent: number;
  performanceSceneCount: number;
  lipsyncSceneCount: number;
  brollSceneCount: number;
  estimatedCost: number;
  costBreakdown?: { imageGenerationEstimate?: number; totalWithImages?: number };
  visualBible: string;
  palettePrompt?: string;
  faceBiblePrompt?: string;
  faceQualityChecklist?: string[];
  paletteBiblePrompt?: string;
  paletteBible?: PaletteBible;
  editingGrammar?: EditingGrammar;
  editingGrammarPrompt?: string;
  lyricContinuityPlan?: string;
  lyricsSource?: string;
  characterLock?: CharacterLock | null;
  scenes: NarrativeScene[];
}

interface NarrativeSceneJob {
  status: NarrativeSceneStatus;
  requestId?: string;
  endpoint?: string;
  statusUrl?: string;
  resultUrl?: string;
  mode?: string;
  videoUrl?: string;
  error?: string;
  phase?: string;
}

interface NarrativeSceneImageJob {
  status: NarrativeSceneStatus;
  requestId?: string;
  endpoint?: string;
  statusUrl?: string;
  resultUrl?: string;
  imageUrl?: string;
  error?: string;
}

const KLING_SYNC3_MODES = ['kling-v21-standard-sync3', 'kling-v3-standard-sync3', 'kling-v3-pro-sync3', 'kling+sync3'];
const isKlingSync3Mode = (mode?: string) => KLING_SYNC3_MODES.includes(mode || '');

// Seedance reference-to-video (Fast + Mini económico). Ambos pasan por el mismo chain Seedance→Sync-3.
const SEEDANCE_R2V_MODES = ['seedance-fast-r2v', 'seedance-mini-r2v'];
const isSeedanceR2vMode = (mode?: string) => SEEDANCE_R2V_MODES.includes(mode || '');

const PIXVERSE_MODES: LipsyncMode[] = ['pixverse-v6', 'pixverse-sora-2', 'pixverse-veo-3.1-fast'];
const isPixVerseMode = (mode?: string): boolean => PIXVERSE_MODES.includes(mode as LipsyncMode);

const BROLL_MODEL_OPTIONS: LipsyncMode[] = ['kling-v21-standard-sync3', 'kling-v3-standard-sync3', 'kling-v3-pro-sync3', 'pixverse-v6'];
const LIPSYNC_COST_5S: Record<LipsyncMode, number> = {
  omnihuman: 0.75,
  'seedance-fast-r2v': 1.88,
  'seedance-mini-r2v': 1.12,
  'kling-v21-standard-sync3': 0.95,
  'kling-v3-standard-sync3': 1.09,
  'kling-v3-pro-sync3': 1.23,
  'pixverse-v6': 0.60,
  'pixverse-sora-2': 2.00,
  'pixverse-veo-3.1-fast': 0.80,
};
const BROLL_COST_5S: Partial<Record<LipsyncMode, number>> = {
  'kling-v21-standard-sync3': 0.28,
  'kling-v3-standard-sync3': 0.42,
  'kling-v3-pro-sync3': 0.56,
  'pixverse-v6': 0.60,
  'pixverse-veo-3.1-fast': 0.80,
};
const SCENE_TYPE_LABELS: Record<NarrativeSceneType, string> = {
  lipsync: 'Lipsync',
  performance: 'Performance',
  broll: 'B-roll',
  cutaway: 'Cutaway',
};

const LYRICS_SOURCE_LABELS: Record<string, string> = {
  'song.lyrics': 'Letra guardada',
  promoLyricsTranscript: 'Transcripcion guardada',
  stored: 'Letra guardada',
  'whisper-audio-transcription': 'Whisper audio',
  'weak-transcription': 'Transcripcion parcial',
  'missing-audio': 'Sin audio para transcribir',
  unavailable: 'Letra no disponible',
};

const getLyricsSourceLabel = (source?: string) => LYRICS_SOURCE_LABELS[source || ''] || source || 'No indicada';

const LIPSYNC_MODE_INFO: Record<LipsyncMode, { label: string; shortLabel: string; generateLabel: string; pollingLabel: string; description: string; accent: string; cost5s?: string; cost30s?: string }> = {
  omnihuman: {
    label: 'OmniHuman v1.5',
    shortLabel: 'Rapido',
    generateLabel: 'Generar Lipsync Video (OmniHuman) ->',
    pollingLabel: 'OmniHuman v1.5 generando video lipsync...',
    description: 'Opcion rapida de lipsync directo con imagen y audio',
    accent: '#ec4899',
  },
  'seedance-fast-r2v': {
    label: 'Seedance Ritmo + Sync-3',
    shortLabel: 'Ritmo',
    generateLabel: 'Generar Video Ritmico (Seedance + Sync-3) ->',
    pollingLabel: 'Seedance 2.0 generando performance ritmica...',
    description: 'Seedance crea la actuacion; Sync-3 corrige labios; audio final usa la cancion original',
    accent: '#14b8a6',
    cost5s: '$1.88/5s',
    cost30s: '$11.26/30s',
  },
  'seedance-mini-r2v': {
    label: 'Seedance Mini + Sync-3',
    shortLabel: 'Eco',
    generateLabel: 'Generar Video Economico (Seedance Mini + Sync-3) ->',
    pollingLabel: 'Seedance 2.0 Mini generando performance economica...',
    description: 'Misma performance ritmica con Sync-3, en la variante Seedance Mini mas barata para economizar',
    accent: '#10b981',
    cost5s: '$1.12/5s',
    cost30s: '$6.72/30s',
  },
  'kling-v21-standard-sync3': {
    label: 'Kling v2.1 Standard + Sync-3',
    shortLabel: 'Prueba',
    generateLabel: 'Generar Preview Economico (Kling v2.1 + Sync-3) ->',
    pollingLabel: 'Kling v2.1 Standard generando video base...',
    description: 'Mas barato para pruebas o usuarios low-tier',
    accent: '#22c55e',
    cost5s: '$0.95/5s',
    cost30s: '$5.68/30s',
  },
  'kling-v3-standard-sync3': {
    label: 'Kling v3 Standard + Sync-3',
    shortLabel: 'Balance',
    generateLabel: 'Generar Balance Calidad/Precio (Kling v3 Standard + Sync-3) ->',
    pollingLabel: 'Kling v3 Standard generando video base...',
    description: 'Mejor balance calidad/precio para vender clips constantes',
    accent: '#f59e0b',
    cost5s: '$1.09/5s',
    cost30s: '$6.52/30s',
  },
  'kling-v3-pro-sync3': {
    label: 'Kling v3 Pro + Sync-3',
    shortLabel: 'Premium',
    generateLabel: 'Generar Premium Lipsync (Kling v3 Pro + Sync-3) ->',
    pollingLabel: 'Kling v3 Pro generando video base...',
    description: 'Mejor calidad premium razonable para vender como Premium Lipsync',
    accent: '#f97316',
    cost5s: '$1.23/5s',
    cost30s: '$7.36/30s',
  },
};

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram_reels: 'Instagram Reels',
  youtube_shorts: 'YouTube Shorts',
};

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 200; // 200 Ã— 5s = ~16 min â€” OmniHuman puede tardar 5-12 min
const NARRATIVE_PAID_SOURCE_SCENES = 6;
const NARRATIVE_VARIABLE_CUTS = 12;

const getNarrativeSceneJobKey = (scene: Pick<NarrativeScene, 'id' | 'sourceSceneId'>) => scene.sourceSceneId || scene.id;
const getNarrativeSceneImageJobKey = (scene: Pick<NarrativeScene, 'id'>) => scene.id;
const isStoryOnlyNarrativeScene = (scene: Pick<NarrativeScene, 'sceneType'>) => scene.sceneType === 'broll' || scene.sceneType === 'cutaway';
const stripInternalSceneCopy = (value?: string) => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/Visible cut role:\s*/gi, '')
  .replace(/\bDo not show[^.]*\.\s*/gi, '')
  .replace(/\bNo visible person[^.]*\.\s*/gi, '')
  .replace(/\bNo person[^.]*\.\s*/gi, '')
  .replace(/\bObject-only (?:music video |videoclip )?b-roll:?\s*/gi, '')
  .replace(/\bObject-only frame:[^.]*\.\s*/gi, '')
  .replace(/\bMood:\s*[^.]*\.?/gi, '')
  .trim();
const cleanBrollDisplayCopy = (value?: string) => stripInternalSceneCopy(value)
  .replace(/,?\s*connected to lyric meaning:\s*/i, ' Â· letra: ')
  .replace(/,?\s*answering the nearby lyric:\s*/i, ' Â· responde a: ')
  .replace(/,?\s*carrying the instrumental groove without inventing lyrics/i, ' Â· groove instrumental')
  .trim();
const getNarrativeSceneDisplayIntent = (scene: NarrativeScene) => {
  if (isStoryOnlyNarrativeScene(scene)) {
    return cleanBrollDisplayCopy(scene.brollSubject || scene.visualIntent || scene.lyricConnection) || 'B-roll de objetos, instrumentos y espacio narrativo.';
  }
  return stripInternalSceneCopy(scene.visualIntent) || `${SCENE_TYPE_LABELS[scene.sceneType]} conectado a la frase vocal.`;
};
const getNarrativeSceneDisplayMeta = (scene: NarrativeScene) => {
  const shot = stripInternalSceneCopy(scene.shotType);
  const camera = stripInternalSceneCopy(scene.cameraMovement);
  return [shot, camera].filter(Boolean).join(' Â· ');
};
const looksStaticRepeatedSymbol = (_value?: string) => {
  // REFACTOR 2026-05: AI has full creative freedom per cut; we no longer
  // mark scenes as "stale" by matching hard-coded duality symbols.
  return false;
};
const needsObjectOnlyRefresh = (scene: NarrativeScene) => isStoryOnlyNarrativeScene(scene)
  && /\b(hand|hands|silhouette|profile angle|singer face|artist face|artist appears|visible singing|mouth close|portrait pose|body language)\b/i.test(
    `${scene.visualIntent || ''} ${scene.cutVariationPrompt || ''} ${scene.shotType || ''} ${scene.cameraMovement || ''}`,
  );
const formatTimelineSeconds = (value: number) => Number(value || 0).toFixed(Number.isInteger(value) ? 0 : 1);

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ArtistPromoClipsModule({ artistId, songs = [], colors, isOwnProfile, artistName, artistProfileImage, artistGenre, artistBiography }: PromoClipsProps) {
  const accent = colors?.accent || '#ec4899';
  const primary = colors?.primary || '#1a1a2e';

  // â”€â”€ State â”€â”€
  const [activeStep, setActiveStep] = useState<Step>('select');

  // Step 1: Song selection
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [clipDuration, setClipDuration] = useState<ClipDuration>(30);
  const [targetPlatforms, setTargetPlatforms] = useState<Platform[]>(['tiktok', 'instagram_reels']);
  const [promoWorkflow, setPromoWorkflow] = useState<PromoWorkflow>('single');
  const [lipsyncMode, setLipsyncMode] = useState<LipsyncMode>('omnihuman');
  const [brollMode, setBrollMode] = useState<LipsyncMode>('kling-v3-standard-sync3');
  const [performancePercent, setPerformancePercent] = useState(40);
  const [lipsyncPercent, setLipsyncPercent] = useState(20);
  const selectedModeInfo = LIPSYNC_MODE_INFO[lipsyncMode];
  const videoModeAccent = lipsyncMode === 'omnihuman' ? accent : selectedModeInfo.accent;
  const effectiveLipsyncPercent = Math.min(lipsyncPercent, performancePercent);
  const narrativeBudget = useMemo(() => {
    const sourceScenes = NARRATIVE_PAID_SOURCE_SCENES;
    const totalCuts = NARRATIVE_VARIABLE_CUTS;
    const lipsyncScenes = Math.max(1, Math.min(sourceScenes, Math.round(sourceScenes * (effectiveLipsyncPercent / 100))));
    const performanceScenes = Math.max(lipsyncScenes, Math.min(sourceScenes, Math.round(sourceScenes * (performancePercent / 100))));
    const brollScenes = sourceScenes - performanceScenes;
    const performanceOnlyScenes = performanceScenes - lipsyncScenes;
    const lipsyncCost = lipsyncScenes * (LIPSYNC_COST_5S[lipsyncMode] || LIPSYNC_COST_5S['kling-v3-standard-sync3']);
    const brollCost = (brollScenes + performanceOnlyScenes) * (BROLL_COST_5S[brollMode] || BROLL_COST_5S['kling-v3-standard-sync3'] || 0.42);
    return {
      totalScenes: totalCuts,
      totalCuts,
      sourceScenes,
      lipsyncScenes,
      performanceScenes,
      performanceOnlyScenes,
      brollScenes,
      estimatedCost: Number((lipsyncCost + brollCost).toFixed(2)),
      estimatedCostWithImages: Number((lipsyncCost + brollCost + 0.12).toFixed(2)),
    };
  }, [effectiveLipsyncPercent, performancePercent, lipsyncMode, brollMode]);
  // Auto-carga la foto de perfil del artista como referencia para Flux Kontext
  const [referenceImageUrl, setReferenceImageUrl] = useState(artistProfileImage || '');
  const [characterReferenceUrls, setCharacterReferenceUrls] = useState<string[]>(() => artistProfileImage ? [artistProfileImage] : []);
  const [characterReferenceInput, setCharacterReferenceInput] = useState('');
  const [characterNotes, setCharacterNotes] = useState('');
  const [characterLock, setCharacterLock] = useState<CharacterLock | null>(null);
  const [characterLockLoading, setCharacterLockLoading] = useState(false);
  const [characterImageUploading, setCharacterImageUploading] = useState(false);
  const [targetGoal, setTargetGoal] = useState('virality');

  // Director selection
  const [selectedDirector, setSelectedDirector] = useState<any | null>(null);
  const [showDirectorSelector, setShowDirectorSelector] = useState(false);

  // Sincronizar si la foto de perfil llega tarde (async)
  useEffect(() => {
    if (artistProfileImage && !referenceImageUrl) {
      setReferenceImageUrl(artistProfileImage);
    }
  }, [artistProfileImage]);

  useEffect(() => {
    if (artistProfileImage) {
      setCharacterReferenceUrls(prev => prev.includes(artistProfileImage) ? prev : [artistProfileImage, ...prev].slice(0, 8));
    }
  }, [artistProfileImage]);

  // Step 2: Analysis
  const [analysis, setAnalysis] = useState<SongAnalysis | null>(null);
  const [analyzingLoading, setAnalyzingLoading] = useState(false);

  // Step 3: Visual direction
  const [direction, setDirection] = useState<VisualDirection | null>(null);
  const [directionLoading, setDirectionLoading] = useState(false);
  const [customImagePrompt, setCustomImagePrompt] = useState('');

  // Step 4: Image generation
  const [imageRequestId, setImageRequestId] = useState<string | null>(null);
  const [imageEndpoint, setImageEndpoint] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imagePollStatus, setImagePollStatus] = useState<'idle' | 'polling' | 'done' | 'error'>('idle');

  // Step 5: Video generation
  const [videoRequestId, setVideoRequestId] = useState<string | null>(null);
  const [videoEndpoint, setVideoEndpoint] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoPollStatus, setVideoPollStatus] = useState<'idle' | 'polling' | 'done' | 'error'>('idle');
  const [videoStep2RequestId, setVideoStep2RequestId] = useState<string | null>(null);
  const [videoQueuePosition, setVideoQueuePosition] = useState<number | null>(null);
  const [videoQueuePhase, setVideoQueuePhase] = useState<string>('');
  const videoStartTime = useRef<number>(0);

  // Narrative 30s workflow
  const [narrativeStoryboard, setNarrativeStoryboard] = useState<NarrativeStoryboard | null>(null);
  const [storyboardLoading, setStoryboardLoading] = useState(false);
  const [narrativeSceneJobs, setNarrativeSceneJobs] = useState<Record<string, NarrativeSceneJob>>({});
  const [narrativeSceneImageJobs, setNarrativeSceneImageJobs] = useState<Record<string, NarrativeSceneImageJob>>({});
  const [narrativeRenderLoading, setNarrativeRenderLoading] = useState(false);
  const [narrativeVideoUrl, setNarrativeVideoUrl] = useState<string | null>(null);
  const activeCharacterLock = useMemo(() => narrativeStoryboard?.characterLock || characterLock, [narrativeStoryboard?.characterLock, characterLock]);

  // Step 6: Captions
  const [captions, setCaptions] = useState<CaptionsData | null>(null);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [activeCaptionPlatform, setActiveCaptionPlatform] = useState<Platform>('tiktok');

  // Errors
  const [error, setError] = useState<string | null>(null);

  // Saved jobs
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [showSavedJobs, setShowSavedJobs] = useState(false);

  // Polling refs
  const imagePollRef = useRef<NodeJS.Timeout | null>(null);
  const videoPollRef = useRef<NodeJS.Timeout | null>(null);
  // Evita guardar dos veces el mismo video en la coleccion 'videos'
  const savedVideoUrlRef = useRef<string | null>(null);
  const imagePollCount = useRef(0);
  // Ref to hold the latest autoSave fn â€” avoids circular dependency in startImagePolling
  const autoSaveRef = useRef<(overrides?: any) => void>(() => {});
  const applySync3Ref = useRef<(videoUrl: string, sourceMode?: string, clipLock?: AudioClipLock) => Promise<void>>(async () => {});
  const videoPollCount = useRef(0);

  // â”€â”€ New: Style, Palette, Auto-Flow â”€â”€
  const [selectedStyleId, setSelectedStyleId] = useState<string | undefined>();
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | undefined>();
  const selectedPalette = COLOR_MOODS.find(p => p.id === selectedPaletteId);
  const selectedVisualStyle = VISUAL_STYLES.find(s => s.id === selectedStyleId);
  const autoFlow = useAutoFlow();
  const autoFlowAbortRef = useRef(false);

  const handleSelectStyle = useCallback((style: VisualStyle) => {
    setSelectedStyleId(style.id);
  }, []);

  const handleSelectPalette = useCallback((palette: ColorPalette) => {
    setSelectedPaletteId(palette.id);
  }, []);

  // â”€â”€ Cleanup on unmount
  useEffect(() => {
    return () => {
      if (imagePollRef.current) clearTimeout(imagePollRef.current);
      if (videoPollRef.current) clearTimeout(videoPollRef.current);
    };
  }, []);

  // Load saved jobs on mount
  useEffect(() => {
    apiRequest('GET', `/api/promo-clips/${artistId}/jobs`)
      .then(data => { if (data.success && data.jobs?.length) setSavedJobs(data.jobs); })
      .catch(() => {});
  }, [artistId]);

  // â”€â”€ Helpers â”€â”€
  const clearError = () => setError(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const addCharacterReferenceUrl = useCallback((url?: string) => {
    const cleanUrl = (url || '').trim();
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) return;
    setCharacterReferenceUrls(prev => prev.includes(cleanUrl) ? prev : [...prev, cleanUrl].slice(0, 8));
    setCharacterLock(null);
  }, []);

  const addCharacterReferenceFromInput = useCallback(() => {
    addCharacterReferenceUrl(characterReferenceInput);
    setCharacterReferenceInput('');
  }, [addCharacterReferenceUrl, characterReferenceInput]);

  const removeCharacterReferenceUrl = useCallback((url: string) => {
    setCharacterReferenceUrls(prev => prev.filter(item => item !== url));
    setCharacterLock(null);
  }, []);

  const uploadCharacterReferenceImages = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'));
    event.target.value = '';
    if (files.length === 0) return;
    setCharacterImageUploading(true);
    setError(null);
    try {
      const uploadedUrls = await Promise.all(files.slice(0, 6).map(async (file, index) => {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileRef = ref(storage, `promo-clips/${artistId}/character-lock/${Date.now()}_${index}_${safeName}`);
        await uploadBytes(fileRef, file);
        return getDownloadURL(fileRef);
      }));
      setCharacterReferenceUrls(prev => Array.from(new Set([...prev, ...uploadedUrls])).slice(0, 8));
      setCharacterLock(null);
    } catch (e: any) {
      setError(e.message || 'No se pudieron subir las imÃ¡genes de referencia.');
    } finally {
      setCharacterImageUploading(false);
    }
  }, [artistId]);

  const createCharacterLock = useCallback(async () => {
    const references = Array.from(new Set([
      artistProfileImage,
      referenceImageUrl,
      ...characterReferenceUrls,
    ].filter(Boolean).map(url => String(url).trim()))).slice(0, 8);

    if (references.length === 0) {
      setError('Necesitamos al menos una imagen de referencia para bloquear el personaje.');
      return;
    }

    setCharacterLockLoading(true);
    setError(null);
    try {
      const data = await apiRequest('POST', `/api/promo-clips/${artistId}/create-character-lock`, {
        referenceImageUrls: references,
        primaryReferenceImageUrl: artistProfileImage || referenceImageUrl || references[0],
        artistProfileImage,
        artistName: artistName || selectedSong?.name || selectedSong?.title || '',
        artistBiography,
        characterNotes,
        direction,
        analysis,
        songTitle: selectedSong?.name || selectedSong?.title || '',
      });
      if (!data.success) throw new Error(data.error || 'Character Lock failed');
      setCharacterLock(data.characterLock);
      setCharacterReferenceUrls(data.characterLock?.referenceImageUrls || references);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCharacterLockLoading(false);
    }
  }, [analysis, artistBiography, artistId, artistName, artistProfileImage, characterNotes, characterReferenceUrls, direction, referenceImageUrl, selectedSong]);

  // â”€â”€ Step 2: Analyze Song â”€â”€
  const analyzeSong = useCallback(async () => {
    if (!selectedSong) return;
    setAnalyzingLoading(true);
    setError(null);
    try {
      const data = await apiRequest('POST', `/api/promo-clips/${artistId}/analyze-song`, {
        songId: selectedSong.id,
        clipDuration,
        targetGoal,
      });
      if (!data.success) throw new Error(data.error || 'Analysis failed');
      setAnalysis(data.analysis);
      setActiveStep('analyze');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAnalyzingLoading(false);
    }
  }, [selectedSong, artistId, clipDuration, targetGoal]);

  // â”€â”€ Step 3: Create Visual Direction â”€â”€
  const createVisualDirection = useCallback(async () => {
    if (!analysis || !selectedSong) return;
    setDirectionLoading(true);
    setError(null);
    try {
      const data = await apiRequest('POST', `/api/promo-clips/${artistId}/create-visual-direction`, {
        genre: analysis.detected_genre || selectedSong.genre || artistGenre,
        mood: analysis.detected_mood || selectedSong.mood,
        segmentType: analysis.segment_type,
        artistName: artistName || selectedSong.name || selectedSong.title,
        artistBiography: artistBiography,
        artistProfileImage: referenceImageUrl || artistProfileImage,
        targetPlatforms,
        campaignGoal: targetGoal,
        // Song analysis data â€” drives the actual visual concept
        lyricsExcerpt: analysis.best_segment?.lyrics_excerpt || '',
        emotionalTrigger: analysis.emotional_trigger || '',
        viralHook: analysis.viral_hook || '',
        energyLevel: analysis.energy_level,
        bpmFeel: analysis.detected_bpm_feel || '',
      });
      if (!data.success) throw new Error(data.error || 'Visual direction failed');
      setDirection(data.direction);
      setCustomImagePrompt(data.direction.fal_image_prompt || '');
      setActiveStep('direction');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDirectionLoading(false);
    }
  }, [analysis, selectedSong, artistId, targetPlatforms, targetGoal]);

  // â”€â”€ Step 4: Generate Image â”€â”€
  // El endpoint llama FAL async queue y retorna jobs con requestId.
  // Polling acumula imÃ¡genes de los 3 jobs (wide + closeup + stage).
  const generateImage = useCallback(async () => {
    if (!direction && !customImagePrompt) return;
    setImageLoading(true);
    setImagePollStatus('polling');
    setGeneratedImages([]);
    setSelectedImageUrl(null);
    setError(null);
    let asyncMode = false;
    try {
      const falImagePrompt = customImagePrompt || direction?.fal_image_prompt;
      const data = await apiRequest('POST', `/api/promo-clips/${artistId}/generate-fal-image`, {
        falImagePrompt,
        referenceImageUrl: referenceImageUrl || undefined,
        artistProfileImage: artistProfileImage || undefined,
        songName: selectedSong?.name || selectedSong?.title || '',
        artistName: artistName || '',
      });
      if (!data.success) throw new Error(data.error || 'Image generation failed');

      if (data.pending) {
        asyncMode = true;
        imagePollCount.current = 0;

        const jobs: Array<{ requestId: string; statusUrl?: string; resultUrl?: string; shotType?: string }> =
          data.jobs || [{ requestId: data.requestId, statusUrl: data.statusUrl, resultUrl: data.resultUrl }];

        // Shared counter: when all jobs complete â†’ stop loading
        const pendingRef = { count: jobs.length };

        jobs.forEach((job) => {
          startImagePolling(
            job.requestId,
            data.endpoint,
            job.statusUrl,
            job.resultUrl,
            falImagePrompt,
            data.songName,
            data.artistName,
            pendingRef,
          );
        });
        return;
      }

      // â”€â”€ SYNC MODE: Flux Dev T2I (no reference photo) â”€â”€
      const imgs: Array<{ url: string }> = data.images || [];
      if (imgs.length === 0) throw new Error('FAL no retornÃ³ imÃ¡genes');
      const newImages = imgs.map((img, i) => ({ url: img.url, index: i }));
      setGeneratedImages(newImages);
      setSelectedImageUrl(newImages[0]?.url || null);
      setImagePollStatus('done');
      setActiveStep('image');
      autoSave({ images: newImages, selectedImg: newImages[0]?.url || null });
    } catch (e: any) {
      setError(e.message);
      setImagePollStatus('error');
    } finally {
      if (!asyncMode) setImageLoading(false);
    }
  }, [direction, customImagePrompt, artistId, referenceImageUrl, artistProfileImage, artistName, selectedSong]);

  const startImagePolling = useCallback((
    requestId: string,
    endpoint: string,
    statusUrl?: string,
    resultUrl?: string,
    falImagePrompt?: string,
    songName?: string,
    artistName?: string,
    pendingRef?: { count: number }, // shared counter for multi-job accumulation
  ) => {
    const poll = async () => {
      if (imagePollCount.current >= MAX_POLLS) {
        setImagePollStatus('error');
        setImageLoading(false);
        setError('Image generation timed out');
        return;
      }
      imagePollCount.current++;
      try {
        const data = await apiRequest('POST', `/api/promo-clips/${artistId}/poll-fal`, {
          requestId,
          endpoint,
          statusUrl,
          resultUrl,
          jobType: 'image',
          falImagePrompt,
          songName,
          artistName,
        });
        if (data.status === 'COMPLETED' && data.result) {
          const imgs: any[] = data.result?.images || [];
          const newImages = imgs.map((img: any, i: number) => ({ url: img.url, index: i }));
          // Accumulate: add to existing images (multiple jobs may complete at different times)
          setGeneratedImages(prev => {
            const allImages = [...prev, ...newImages].map((img, i) => ({ ...img, index: i }));
            // Auto-select first image when first batch arrives
            if (prev.length === 0 && allImages.length > 0) {
              setSelectedImageUrl(allImages[0].url);
            }
            return allImages;
          });
          setImagePollStatus('done');
          setActiveStep('image');
          // Decrement shared counter â€” when all jobs done, stop loading
          if (pendingRef) {
            pendingRef.count--;
            if (pendingRef.count <= 0) {
              setImageLoading(false);
              autoSaveRef.current();
            }
          } else {
            setImageLoading(false);
            autoSaveRef.current();
          }
          return;
        }
        if (data.status === 'FAILED') {
          if (pendingRef) pendingRef.count--;
          if (!pendingRef || pendingRef.count <= 0) {
            setImagePollStatus('error');
            setImageLoading(false);
          }
          setError(data.error || 'Image generation failed');
          return;
        }
      } catch (e) {
        // Continue polling on transient error
      }
      imagePollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };
    imagePollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [artistId]);

  // â”€â”€ Step 5: Generate Lipsync Video â”€â”€
  const generateVideo = useCallback(async () => {
    if (!selectedImageUrl || !selectedSong?.audioUrl) return;
    setVideoLoading(true);
    setVideoPollStatus('idle');
    setGeneratedVideoUrl(null);
    setVideoStep2RequestId(null);
    setVideoQueuePosition(null);
    setVideoQueuePhase('');
    setError(null);
    videoStartTime.current = Date.now();
    try {
      const data = await apiRequest('POST', `/api/promo-clips/${artistId}/generate-lipsync-video`, {
        mode: lipsyncMode,
        imageUrl: selectedImageUrl,
        identityImageUrl: artistProfileImage || referenceImageUrl || selectedImageUrl,
        audioUrl: selectedSong.audioUrl,
        klingPrompt: direction?.kling_motion_prompt,
        seedancePrompt: direction?.kling_motion_prompt,
        clipStartSeconds: analysis?.best_segment?.start_time || 0,
        lyricsExcerpt: analysis?.best_segment?.lyrics_excerpt || '',
        mood: analysis?.detected_mood || selectedSong.mood || '',
        energyLevel: analysis?.energy_level || 6,
        bpmFeel: analysis?.detected_bpm_feel || '',
        segmentType: analysis?.segment_type || '',
        songTitle: selectedSong.name || selectedSong.title || '',
      });
      if (!data.success) throw new Error(data.error || 'Video generation failed');
      setVideoRequestId(data.requestId);
      setVideoEndpoint(data.endpoint);
      setVideoPollStatus('polling');
      setActiveStep('video');
      videoPollCount.current = 0;
      startVideoPolling(data.requestId, data.endpoint, data.mode, data.statusUrl, data.resultUrl, {
        audioUrl: selectedSong.audioUrl,
        clipStartSeconds: analysis?.best_segment?.start_time || 0,
        duration: data.duration || 5,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setVideoLoading(false);
    }
  }, [selectedImageUrl, selectedSong, artistId, lipsyncMode, direction, analysis, artistProfileImage, referenceImageUrl]);

  const startVideoPolling = useCallback((
    requestId: string,
    endpoint: string,
    mode: string,
    statusUrl?: string,
    resultUrl?: string,
    seedanceLock?: AudioClipLock,
  ) => {
    let consecutiveErrors = 0;
    const poll = async () => {
      if (videoPollCount.current >= MAX_POLLS) {
        const elapsed = Math.round((Date.now() - videoStartTime.current) / 1000);
        setVideoPollStatus('error');
        setError(`Video generation timed out after ${elapsed}s. El servidor de FAL puede estar ocupado â€” intenta de nuevo.`);
        return;
      }
      videoPollCount.current++;
      try {
        const data = await apiRequest('POST', `/api/promo-clips/${artistId}/poll-fal`, {
          requestId,
          endpoint,
          statusUrl,
          resultUrl,
          deferSave: isSeedanceR2vMode(mode) || isKlingSync3Mode(mode),
          ...(isSeedanceR2vMode(mode) ? seedanceLock : {}),
        });
        consecutiveErrors = 0; // reset on success
        // Update queue info
        if (data.queuePosition !== undefined) setVideoQueuePosition(data.queuePosition);
        if (data.status) setVideoQueuePhase(data.status);
        if (data.phase === 'SYNC3_QUEUED' && data.sync3RequestId) {
          setVideoStep2RequestId(data.sync3RequestId);
          setVideoQueuePhase('SYNC3_QUEUED');
        }
        if (data.status === 'COMPLETED' && data.result) {
          const videoUrl = data.result?.video?.url
            || data.result?.video_url
            || data.result?.output?.video?.url
            || data.result?.output?.url
            || data.result?.url;
          // Kling modes use a client-visible two-step flow: base video first, then Sync-3.
          if (videoUrl && isKlingSync3Mode(mode)) {
            await applySync3Ref.current(videoUrl, mode, seedanceLock);
            return;
          }
          if (videoUrl) {
            setGeneratedVideoUrl(videoUrl);
            setVideoPollStatus('done');
            setVideoQueuePhase('COMPLETED');
            autoSave({ videoUrl });
            return;
          }
          // COMPLETED but no videoUrl found â†’ show result for debugging, stop polling
          if (!videoUrl) {
            console.warn('[VideoPolling] COMPLETED but no video URL found. Result:', JSON.stringify(data.result).substring(0, 300));
            setVideoPollStatus('error');
            setError(`Video completado pero sin URL de video. Resultado FAL: ${JSON.stringify(data.result).substring(0, 150)}`);
            return;
          }
        }
        if (data.status === 'FAILED') {
          setVideoPollStatus('error');
          setError(`FAL error: ${data.error || 'Video generation failed'}`);
          return;
        }
      } catch (e: any) {
        consecutiveErrors++;
        console.warn(`[VideoPolling] poll error (${consecutiveErrors}):`, e.message);
        // Stop after 5 consecutive server errors (prevents infinite loop on persistent backend failures)
        if (consecutiveErrors >= 5) {
          setVideoPollStatus('error');
          setError(`Error del servidor al consultar estado del video: ${e.message}`);
          return;
        }
      }
      videoPollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };
    videoPollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [artistId]);

  const applySync3 = useCallback((async (
    videoUrl: string,
    sourceMode: string = 'kling-v3-pro-sync3',
    clipLock?: AudioClipLock,
  ) => {
    if (!selectedSong?.audioUrl) return;
    const clipStartSeconds = clipLock?.clipStartSeconds ?? analysis?.best_segment?.start_time ?? 0;
    const duration = clipLock?.duration ?? 5;
    try {
      const data = await apiRequest('POST', `/api/promo-clips/${artistId}/apply-sync3`, {
        videoUrl,
        audioUrl: selectedSong.audioUrl,
        clipStartSeconds,
        duration,
        sourceMode,
      });
      if (!data.success) throw new Error(data.error || 'Sync-3 failed');
      setVideoStep2RequestId(data.requestId);
      videoPollCount.current = 0;
      startSync3Polling(data.requestId, data.endpoint, data.statusUrl, data.resultUrl, {
        audioUrl: selectedSong.audioUrl,
        clipStartSeconds,
        duration,
      });
    } catch (e: any) {
      setVideoPollStatus('error');
      setError(e.message);
    }
  }) as (videoUrl: string, sourceMode?: string, clipLock?: AudioClipLock) => Promise<void>, [artistId, selectedSong, analysis]);

  useEffect(() => {
    applySync3Ref.current = applySync3;
  }, [applySync3]);

  const startSync3Polling = useCallback((
    requestId: string,
    endpoint: string,
    statusUrl?: string,
    resultUrl?: string,
    syncLock?: AudioClipLock,
  ) => {
    const poll = async () => {
      if (videoPollCount.current >= MAX_POLLS) {
        setVideoPollStatus('error');
        setError('Sync-3 lipsync timed out');
        return;
      }
      videoPollCount.current++;
      try {
        const data = await apiRequest('POST', `/api/promo-clips/${artistId}/poll-fal`, {
          requestId,
          endpoint,
          statusUrl,
          resultUrl,
          ...(syncLock || {}),
        });
        if (data.status === 'COMPLETED' && data.result) {
          const videoUrl = data.result?.video?.url || data.result?.url;
          if (videoUrl) {
            setGeneratedVideoUrl(videoUrl);
            setVideoPollStatus('done');
            autoSave({ videoUrl });
            return;
          }
        }
        if (data.status === 'FAILED') {
          setVideoPollStatus('error');
          setError(data.error || 'Sync-3 lipsync failed');
          return;
        }
      } catch (e) {
        // Continue
      }
      videoPollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };
    videoPollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [artistId]);

  // â”€â”€ Auto-save current job state â”€â”€
  const autoSave = useCallback(async (overrides: { images?: GeneratedImage[]; selectedImg?: string | null; videoUrl?: string | null } = {}) => {
    try {
      const imgs = overrides.images ?? generatedImages;
      const selImg = overrides.selectedImg !== undefined ? overrides.selectedImg : selectedImageUrl;
      const vid = overrides.videoUrl !== undefined ? overrides.videoUrl : generatedVideoUrl;
      const saved = await apiRequest('POST', `/api/promo-clips/${artistId}/save-job`, {
        artist_id: artistId,
        song_id: selectedSong?.id,
        song_name: selectedSong?.name || selectedSong?.title,
        song_audio_url: selectedSong?.audioUrl,
        song_cover_url: selectedSong?.coverUrl,
        direction,
        analysis,
        image_urls: imgs.map(i => i.url),
        selected_image_url: selImg,
        video_url: vid,
        captions,
        lipsync_mode: lipsyncMode,
        status: vid ? 'complete' : selImg ? 'has_image' : 'draft',
      });
      if (saved.success) {
        // Refresh saved jobs list
        const list = await apiRequest('GET', `/api/promo-clips/${artistId}/jobs`);
        if (list.success) setSavedJobs(list.jobs || []);
      }
      // Para los modos Seedance el servidor difiere el guardado (deferSave), por lo que el video
      // nunca llega a la coleccion 'videos' (que alimenta la seccion de Videos). Lo guardamos aqui.
      // OmniHuman y Kling+Sync-3 ya los guarda el backend en poll-fal, asi que solo cubrimos Seedance.
      if (vid && vid !== savedVideoUrlRef.current && isSeedanceR2vMode(lipsyncMode)) {
        savedVideoUrlRef.current = vid;
        try {
          await apiRequest('POST', `/api/promo-clips/${artistId}/save-to-videos`, {
            videoUrl: vid,
            songName: selectedSong?.name || selectedSong?.title || 'Promo Clip',
            songId: selectedSong?.id,
            imageUrl: selImg || selectedImageUrl || '',
            artistName: artistName || '',
            mode: lipsyncMode,
          });
        } catch (_) { /* silent: el job ya quedo guardado */ }
      }
    } catch (_) { /* silent */ }
  }, [artistId, selectedSong, direction, analysis, generatedImages, selectedImageUrl, generatedVideoUrl, captions, lipsyncMode, artistName]);

  // Keep autoSaveRef in sync so startImagePolling can call autoSave without a circular dep
  useEffect(() => { autoSaveRef.current = autoSave; }, [autoSave]);

  const updateNarrativeSceneJob = useCallback((sceneId: string, patch: Partial<NarrativeSceneJob>) => {
    setNarrativeSceneJobs(prev => ({
      ...prev,
      [sceneId]: { status: 'idle', ...(prev[sceneId] || {}), ...patch },
    }));
  }, []);

  const updateNarrativeSceneImageJob = useCallback((sceneId: string, patch: Partial<NarrativeSceneImageJob>) => {
    setNarrativeSceneImageJobs(prev => ({
      ...prev,
      [sceneId]: { status: 'idle', ...(prev[sceneId] || {}), ...patch },
    }));
  }, []);

  const updateNarrativeScene = useCallback((sceneId: string, patch: Partial<NarrativeScene>) => {
    setNarrativeStoryboard(prev => prev ? {
      ...prev,
      scenes: prev.scenes.map(scene => scene.id === sceneId ? { ...scene, ...patch } : scene),
    } : prev);
  }, []);

  const updateNarrativeSceneGroup = useCallback((sceneKey: string, patch: Partial<NarrativeScene>) => {
    setNarrativeStoryboard(prev => prev ? {
      ...prev,
      scenes: prev.scenes.map(scene => getNarrativeSceneJobKey(scene) === sceneKey ? { ...scene, ...patch } : scene),
    } : prev);
  }, []);

  const createNarrativeStoryboard = useCallback(async () => {
    if (!selectedSong || !analysis) return;
    setStoryboardLoading(true);
    setError(null);
    setNarrativeStoryboard(null);
    setNarrativeSceneJobs({});
    setNarrativeSceneImageJobs({});
    setNarrativeVideoUrl(null);
    try {
      const data = await apiRequest('POST', `/api/promo-clips/${artistId}/create-narrative-storyboard`, {
        songId: selectedSong.id,
        analysis,
        direction,
        performancePercent,
        lipsyncPercent: effectiveLipsyncPercent,
        performanceMode: lipsyncMode,
        brollMode,
        characterLock,
        artistName: artistName || selectedSong.name || selectedSong.title || '',
        artistBiography,
        targetGoal,
        director: selectedDirector || null,
      });
      if (!data.success) throw new Error(data.error || 'Storyboard failed');
      setNarrativeStoryboard(data.storyboard);
      if (data.storyboard?.characterLock) {
        setCharacterLock(data.storyboard.characterLock);
      }
      setActiveStep('video');
      autoSave({ videoUrl: null });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStoryboardLoading(false);
    }
  }, [selectedSong, analysis, direction, performancePercent, effectiveLipsyncPercent, lipsyncMode, brollMode, characterLock, artistId, artistName, artistBiography, targetGoal, selectedDirector, autoSave]);

  const pollNarrativeScene = useCallback((
    scene: NarrativeScene,
    requestId: string,
    endpoint: string,
    mode: string,
    statusUrl?: string,
    resultUrl?: string,
    stage: 'base' | 'sync3' = 'base',
  ) => {
    const sceneKey = getNarrativeSceneJobKey(scene);
    const sourceClipStart = scene.generationStartTime ?? scene.startTime;
    const sourceDuration = scene.sourceDuration ?? Math.max(5, scene.duration || 5);
    let polls = 0;
    let consecutiveErrors = 0;
    const poll = async () => {
      if (polls >= MAX_POLLS) {
        updateNarrativeSceneJob(sceneKey, { status: 'error', error: 'Scene generation timed out' });
        return;
      }
      polls++;
      try {
        const data = await apiRequest('POST', `/api/promo-clips/${artistId}/poll-fal`, {
          requestId,
          endpoint,
          statusUrl,
          resultUrl,
          deferSave: true,
          ...(mode === 'seedance-fast-r2v' || stage === 'sync3'
            ? { audioUrl: selectedSong?.audioUrl, clipStartSeconds: sourceClipStart, duration: sourceDuration }
            : {}),
        });
        consecutiveErrors = 0;
        if (data.phase === 'SYNC3_QUEUED') {
          updateNarrativeSceneJob(sceneKey, { status: 'syncing', phase: 'SYNC3_QUEUED' });
        }
        if (data.status === 'COMPLETED' && data.result) {
          const videoUrl = data.result?.video?.url
            || data.result?.video_url
            || data.result?.output?.video?.url
            || data.result?.output?.url
            || data.result?.url;
          if (videoUrl && scene.requiresLipsync && isKlingSync3Mode(mode) && stage === 'base') {
            const syncData = await apiRequest('POST', `/api/promo-clips/${artistId}/apply-sync3`, {
              videoUrl,
              audioUrl: selectedSong?.audioUrl,
              clipStartSeconds: sourceClipStart,
              duration: sourceDuration,
              sourceMode: mode,
            });
            if (!syncData.success) throw new Error(syncData.error || 'Sync-3 failed');
            updateNarrativeSceneJob(sceneKey, {
              status: 'syncing',
              requestId: syncData.requestId,
              endpoint: syncData.endpoint,
              statusUrl: syncData.statusUrl,
              resultUrl: syncData.resultUrl,
              mode: 'sync3',
              phase: 'SYNC3_QUEUED',
            });
            pollNarrativeScene(scene, syncData.requestId, syncData.endpoint, 'sync3', syncData.statusUrl, syncData.resultUrl, 'sync3');
            return;
          }
          if (videoUrl) {
            updateNarrativeSceneJob(sceneKey, { status: 'done', videoUrl, phase: 'COMPLETED' });
            return;
          }
          updateNarrativeSceneJob(sceneKey, { status: 'error', error: 'Scene completed without video URL' });
          return;
        }
        if (data.status === 'FAILED') {
          updateNarrativeSceneJob(sceneKey, { status: 'error', error: data.error || 'Scene generation failed' });
          return;
        }
      } catch (e: any) {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          updateNarrativeSceneJob(sceneKey, { status: 'error', error: e.message });
          return;
        }
      }
      window.setTimeout(poll, POLL_INTERVAL_MS);
    };
    window.setTimeout(poll, POLL_INTERVAL_MS);
  }, [artistId, selectedSong, updateNarrativeSceneJob]);

  const pollNarrativeSceneImage = useCallback((
    scene: NarrativeScene,
    requestId: string,
    endpoint: string,
    statusUrl?: string,
    resultUrl?: string,
  ) => {
    const imageKey = getNarrativeSceneImageJobKey(scene);
    let polls = 0;
    let consecutiveErrors = 0;
    const poll = async () => {
      if (polls >= MAX_POLLS) {
        updateNarrativeSceneImageJob(imageKey, { status: 'error', error: 'Scene still generation timed out' });
        return;
      }
      polls++;
      try {
        const data = await apiRequest('POST', `/api/promo-clips/${artistId}/poll-fal`, {
          requestId,
          endpoint,
          statusUrl,
          resultUrl,
          deferSave: true,
        });
        consecutiveErrors = 0;
        if (data.status === 'COMPLETED' && data.result) {
          const imageUrl = data.result?.images?.[0]?.url || data.result?.image?.url || data.result?.url;
          if (imageUrl) {
            updateNarrativeSceneImageJob(imageKey, { status: 'done', imageUrl });
            updateNarrativeScene(scene.id, { sceneImageUrl: imageUrl });
            return;
          }
          updateNarrativeSceneImageJob(imageKey, { status: 'error', error: 'Scene still completed without image URL' });
          return;
        }
        if (data.status === 'FAILED') {
          updateNarrativeSceneImageJob(imageKey, { status: 'error', error: data.error || 'Scene still generation failed' });
          return;
        }
      } catch (e: any) {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          updateNarrativeSceneImageJob(imageKey, { status: 'error', error: e.message });
          return;
        }
      }
      window.setTimeout(poll, POLL_INTERVAL_MS);
    };
    window.setTimeout(poll, POLL_INTERVAL_MS);
  }, [artistId, updateNarrativeScene, updateNarrativeSceneImageJob]);

  const generateNarrativeSceneImage = useCallback(async (scene: NarrativeScene) => {
    const imageKey = getNarrativeSceneImageJobKey(scene);
    const isStoryOnlyScene = isStoryOnlyNarrativeScene(scene);
    const identityReferenceUrl = isStoryOnlyScene
      ? undefined
      : activeCharacterLock?.primaryReferenceImageUrl || activeCharacterLock?.masterImageUrl || artistProfileImage || referenceImageUrl || selectedImageUrl;
    updateNarrativeScene(scene.id, { sceneImageUrl: undefined });
    updateNarrativeSceneImageJob(imageKey, { status: 'queued', error: undefined, imageUrl: undefined });
    try {
      const data = await apiRequest('POST', `/api/promo-clips/${artistId}/generate-narrative-scene-image`, {
        scene,
        identityReferenceUrl,
        characterLock: isStoryOnlyScene ? undefined : activeCharacterLock,
        director: selectedDirector || null,
      });
      if (!data.success) throw new Error(data.error || 'Scene still generation failed');
      if (data.imageUrl) {
        updateNarrativeSceneImageJob(imageKey, { status: 'done', imageUrl: data.imageUrl });
        updateNarrativeScene(scene.id, { sceneImageUrl: data.imageUrl });
        return;
      }
      updateNarrativeSceneImageJob(imageKey, {
        status: 'polling',
        requestId: data.requestId,
        endpoint: data.endpoint,
        statusUrl: data.statusUrl,
        resultUrl: data.resultUrl,
      });
      pollNarrativeSceneImage(scene, data.requestId, data.endpoint, data.statusUrl, data.resultUrl);
    } catch (e: any) {
      updateNarrativeSceneImageJob(imageKey, { status: 'error', error: e.message });
      setError(e.message);
    }
  }, [activeCharacterLock, artistId, artistProfileImage, pollNarrativeSceneImage, referenceImageUrl, selectedDirector, selectedImageUrl, updateNarrativeScene, updateNarrativeSceneImageJob]);

  const generateNarrativeScene = useCallback(async (scene: NarrativeScene) => {
    if (!selectedSong?.audioUrl) return;
    const sceneKey = getNarrativeSceneJobKey(scene);
    const isStoryOnlyScene = isStoryOnlyNarrativeScene(scene);
    const sceneNeedsRefresh = needsObjectOnlyRefresh(scene);
    const generatedStillUrl = sceneNeedsRefresh ? undefined : scene.sceneImageUrl || narrativeSceneImageJobs[getNarrativeSceneImageJobKey(scene)]?.imageUrl;
    const sourceStillUrl = narrativeStoryboard?.scenes
      .filter(candidate => getNarrativeSceneJobKey(candidate) === sceneKey)
      .map(candidate => candidate.sceneImageUrl || narrativeSceneImageJobs[getNarrativeSceneImageJobKey(candidate)]?.imageUrl)
      .find(Boolean);
    const baseImageUrl = isStoryOnlyScene
      ? generatedStillUrl
      : generatedStillUrl
        || sourceStillUrl
        || activeCharacterLock?.masterImageUrl
        || selectedImageUrl
        || activeCharacterLock?.primaryReferenceImageUrl
        || referenceImageUrl
        || artistProfileImage;
    if (!baseImageUrl) {
      setError(isStoryOnlyScene
        ? 'Genera primero el concepto/still de b-roll. No se usarÃ¡ la imagen del artista para escenas de historia.'
        : 'Necesitamos una imagen base del artista para generar escenas narrativas.');
      return;
    }
    const sceneForRequest = generatedStillUrl ? { ...scene, sceneImageUrl: generatedStillUrl } : scene;
    updateNarrativeSceneJob(sceneKey, { status: 'queued', error: undefined, videoUrl: undefined, phase: 'QUEUED' });
    try {
      const data = await apiRequest('POST', `/api/promo-clips/${artistId}/generate-narrative-scene`, {
        scene: sceneForRequest,
        imageUrl: baseImageUrl,
        identityImageUrl: isStoryOnlyScene ? undefined : activeCharacterLock?.primaryReferenceImageUrl || artistProfileImage || referenceImageUrl || baseImageUrl,
        characterLock: isStoryOnlyScene ? undefined : activeCharacterLock,
        referenceImageUrls: isStoryOnlyScene ? [] : activeCharacterLock?.referenceImageUrls || characterReferenceUrls,
        audioUrl: selectedSong.audioUrl,
        performanceMode: lipsyncMode,
        brollMode,
        songTitle: selectedSong.name || selectedSong.title || '',
      });
      if (!data.success) throw new Error(data.error || 'Scene generation failed');
      updateNarrativeSceneJob(sceneKey, {
        status: 'polling',
        requestId: data.requestId,
        endpoint: data.endpoint,
        statusUrl: data.statusUrl,
        resultUrl: data.resultUrl,
        mode: data.mode,
        phase: data.nextStep || 'POLLING',
      });
      pollNarrativeScene(scene, data.requestId, data.endpoint, data.mode, data.statusUrl, data.resultUrl, 'base');
    } catch (e: any) {
      updateNarrativeSceneJob(sceneKey, { status: 'error', error: e.message });
      setError(e.message);
    }
  }, [activeCharacterLock, selectedSong, narrativeStoryboard, narrativeSceneImageJobs, selectedImageUrl, referenceImageUrl, artistProfileImage, artistId, lipsyncMode, brollMode, characterReferenceUrls, updateNarrativeSceneJob, pollNarrativeScene]);

  const generateAllNarrativeScenes = useCallback(() => {
    if (!narrativeStoryboard) return;
    const queuedKeys = new Set<string>();
    narrativeStoryboard.scenes.forEach(scene => {
      const sceneKey = getNarrativeSceneJobKey(scene);
      if (queuedKeys.has(sceneKey)) return;
      queuedKeys.add(sceneKey);
      const current = narrativeSceneJobs[sceneKey];
      if (!current || current.status === 'idle' || current.status === 'error') {
        generateNarrativeScene(scene);
      }
    });
  }, [narrativeStoryboard, narrativeSceneJobs, generateNarrativeScene]);

  const generateAllNarrativeSceneImages = useCallback(() => {
    if (!narrativeStoryboard) return;
    narrativeStoryboard.scenes.forEach(scene => {
      const imageKey = getNarrativeSceneImageJobKey(scene);
      const current = narrativeSceneImageJobs[imageKey];
      const sceneNeedsRefresh = needsObjectOnlyRefresh(scene);
      const hasStill = Boolean(scene.sceneImageUrl || current?.imageUrl);
      if ((sceneNeedsRefresh || !hasStill) && (!current || current.status === 'idle' || current.status === 'error' || sceneNeedsRefresh)) {
        generateNarrativeSceneImage(scene);
      }
    });
  }, [generateNarrativeSceneImage, narrativeSceneImageJobs, narrativeStoryboard]);

  const renderNarrativeVideo = useCallback(async () => {
    if (!narrativeStoryboard || !selectedSong?.audioUrl) return;
    const sceneVideos = narrativeStoryboard.scenes.map(scene => ({
      id: scene.id,
      videoUrl: narrativeSceneJobs[getNarrativeSceneJobKey(scene)]?.videoUrl,
      startTime: scene.startTime,
      duration: scene.duration,
      sourceOffset: scene.sourceOffset || 0,
    }));
    if (sceneVideos.some(scene => !scene.videoUrl)) {
      setError('Faltan escenas por completar antes del render final.');
      return;
    }
    setNarrativeRenderLoading(true);
    setError(null);
    try {
      const data = await apiRequest('POST', `/api/promo-clips/${artistId}/render-narrative-video`, {
        storyboardId: narrativeStoryboard.id,
        scenes: sceneVideos,
        audioUrl: selectedSong.audioUrl,
        clipStartSeconds: narrativeStoryboard.clipStartSeconds,
        totalDuration: narrativeStoryboard.duration,
        songId: selectedSong.id,
        songName: selectedSong.name || selectedSong.title || '',
        artistName: artistName || '',
      });
      if (!data.success) throw new Error(data.error || 'Final render failed');
      setNarrativeVideoUrl(data.videoUrl);
      setGeneratedVideoUrl(data.videoUrl);
      setVideoPollStatus('done');
      setActiveStep('video');
      autoSave({ videoUrl: data.videoUrl });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setNarrativeRenderLoading(false);
    }
  }, [narrativeStoryboard, narrativeSceneJobs, selectedSong, artistId, artistName, autoSave]);

  // â”€â”€ Load a saved job into current state â”€â”€
  const loadJob = useCallback((job: any) => {
    if (job.analysis) setAnalysis(job.analysis);
    if (job.direction) { setDirection(job.direction); setCustomImagePrompt(job.direction.fal_image_prompt || ''); }
    if (job.image_urls?.length) {
      setGeneratedImages(job.image_urls.map((url: string, i: number) => ({ url, index: i })));
      setImagePollStatus('done');
    }
    if (job.selected_image_url) setSelectedImageUrl(job.selected_image_url);
    if (job.video_url) { setGeneratedVideoUrl(job.video_url); setVideoPollStatus('done'); }
    if (job.captions) { setCaptions(job.captions); setActiveStep('captions'); }
    else if (job.video_url) setActiveStep('video');
    else if (job.selected_image_url) setActiveStep('image');
    else if (job.direction) setActiveStep('direction');
    setShowSavedJobs(false);
  }, []);

  // â”€â”€ Step 6: Generate Captions â”€â”€
  const generateCaptions = useCallback(async () => {
    if (!analysis || !selectedSong) return;
    setCaptionsLoading(true);
    setError(null);
    try {
      const data = await apiRequest('POST', `/api/promo-clips/${artistId}/generate-captions`, {
        songTitle: selectedSong.name || selectedSong.title,
        lyricsExcerpt: analysis.best_segment?.lyrics_excerpt,
        genre: analysis.detected_genre,
        mood: analysis.detected_mood,
        targetPlatforms,
      });
      if (!data.success) throw new Error(data.error || 'Captions failed');
      setCaptions(data.captions);
      setActiveStep('captions');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCaptionsLoading(false);
    }
  }, [analysis, selectedSong, artistId, targetPlatforms]);

  // â”€â”€ Auto-Flow: Full automated pipeline â”€â”€
  const runAutoFlow = useCallback(async () => {
    if (!selectedSong) { setError('Select a song first'); return; }
    autoFlowAbortRef.current = false;
    autoFlow.startFlow();

    const pollUntilDone = (checkFn: () => boolean, errorFn: () => boolean, timeoutMs = 600000): Promise<void> => {
      return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
          if (autoFlowAbortRef.current) { reject(new Error('Cancelled')); return; }
          if (errorFn()) { reject(new Error('Step failed')); return; }
          if (checkFn()) { resolve(); return; }
          if (Date.now() - start > timeoutMs) { reject(new Error('Timeout')); return; }
          setTimeout(check, 1200);
        };
        setTimeout(check, 1200);
      });
    };

    try {
      // Step 1: Analyze
      autoFlow.setStepRunning('analyze', 'Detecting viral hook...');
      const analyzeData = await apiRequest('POST', `/api/promo-clips/${artistId}/analyze-song`, {
        songId: selectedSong.id,
        clipDuration,
        targetGoal,
      });
      if (!analyzeData.success) throw new Error(analyzeData.error || 'Analysis failed');
      setAnalysis(analyzeData.analysis);
      setActiveStep('analyze');
      autoFlow.setStepDone('analyze', `Found hook: "${analyzeData.analysis?.viral_hook?.substring(0, 40) || '...'}"`);

      if (autoFlowAbortRef.current) return;

      // Step 2: Visual Direction
      autoFlow.setStepRunning('direction', 'AI director composing scene...');
      const paletteSuffix = selectedPalette?.promptHint || '';
      const styleSuffix = selectedVisualStyle?.promptSuffix || '';
      const dirData = await apiRequest('POST', `/api/promo-clips/${artistId}/create-visual-direction`, {
        genre: analyzeData.analysis.detected_genre || selectedSong.genre || artistGenre,
        mood: analyzeData.analysis.detected_mood || selectedSong.mood,
        segmentType: analyzeData.analysis.segment_type,
        artistName: artistName || selectedSong.name || selectedSong.title,
        artistBiography: artistBiography,
        artistProfileImage: referenceImageUrl || artistProfileImage,
        targetPlatforms,
        campaignGoal: targetGoal,
        lyricsExcerpt: analyzeData.analysis.best_segment?.lyrics_excerpt || '',
        emotionalTrigger: analyzeData.analysis.emotional_trigger || '',
        viralHook: analyzeData.analysis.viral_hook || '',
        energyLevel: analyzeData.analysis.energy_level,
        bpmFeel: analyzeData.analysis.detected_bpm_feel || '',
        paletteHint: paletteSuffix,
        styleHint: styleSuffix,
      });
      if (!dirData.success) throw new Error(dirData.error || 'Visual direction failed');
      setDirection(dirData.direction);
      setCustomImagePrompt(dirData.direction.fal_image_prompt || '');
      setActiveStep('direction');
      autoFlow.setStepDone('direction', 'Visual direction composed âœ“');

      if (autoFlowAbortRef.current) return;

      // Step 3: Generate Image
      autoFlow.setStepRunning('style-image', 'Flux Kontext Pro rendering...');
      autoFlow.setStepProgress('style-image', 10, 'Submitting to Flux Kontext Pro...');

      const falPromptBase = dirData.direction.fal_image_prompt || '';
      const falPromptWithStyle = [falPromptBase, paletteSuffix, styleSuffix].filter(Boolean).join(', ');

      const imgData = await apiRequest('POST', `/api/promo-clips/${artistId}/generate-fal-image`, {
        falImagePrompt: falPromptWithStyle,
        referenceImageUrl: referenceImageUrl || undefined,
        artistProfileImage: artistProfileImage || undefined,
        songName: selectedSong?.name || selectedSong?.title || '',
        artistName: artistName || '',
      });
      if (!imgData.success) throw new Error(imgData.error || 'Image generation failed');

      autoFlow.setStepProgress('style-image', 40, 'Polling Flux Kontext Pro...');

      if (imgData.pending) {
        // Async polling for image
        const jobs: Array<{ requestId: string; statusUrl?: string; resultUrl?: string }> =
          imgData.jobs || [{ requestId: imgData.requestId, statusUrl: imgData.statusUrl, resultUrl: imgData.resultUrl }];
        
        const imageResolvers: Promise<void>[] = jobs.map(job => new Promise<void>((resolve) => {
          let polls = 0;
          const pollImage = async () => {
            if (autoFlowAbortRef.current || polls > MAX_POLLS) { resolve(); return; }
            polls++;
            try {
              const pollData = await apiRequest('POST', `/api/promo-clips/${artistId}/poll-fal`, {
                requestId: job.requestId,
                endpoint: imgData.endpoint,
                statusUrl: job.statusUrl,
                resultUrl: job.resultUrl,
                jobType: 'image',
                falImagePrompt: falPromptWithStyle,
              });
              if (pollData.status === 'COMPLETED' && pollData.result?.images?.length) {
                const imgs = pollData.result.images.map((img: any, i: number) => ({ url: img.url, index: i }));
                setGeneratedImages(prev => {
                  const all = [...prev, ...imgs].map((img, i) => ({ ...img, index: i }));
                  if (prev.length === 0 && all.length > 0) setSelectedImageUrl(all[0].url);
                  return all;
                });
                setImagePollStatus('done');
                setActiveStep('image');
                resolve();
                return;
              }
              if (pollData.status === 'FAILED') { resolve(); return; }
            } catch {}
            setTimeout(pollImage, POLL_INTERVAL_MS);
          };
          setTimeout(pollImage, POLL_INTERVAL_MS);
        }));

        await Promise.all(imageResolvers);
      } else {
        // Sync mode
        const imgs: any[] = imgData.images || [];
        const newImages = imgs.map((img: any, i: number) => ({ url: img.url, index: i }));
        setGeneratedImages(newImages);
        setSelectedImageUrl(newImages[0]?.url || null);
        setImagePollStatus('done');
        setActiveStep('image');
      }

      autoFlow.setStepDone('style-image', 'Artist frame generated âœ“');

      if (autoFlowAbortRef.current) return;

      // Step 4: Generate Video â€” requires selected image and audio
      const imageForVideo = generatedImages[0]?.url;
      if (imageForVideo && selectedSong.audioUrl) {
        autoFlow.setStepRunning('video', 'Lipsync engine composing frames...');
        autoFlow.setStepProgress('video', 5, 'Submitting to lipsync engine...');

        const vidData = await apiRequest('POST', `/api/promo-clips/${artistId}/generate-lipsync-video`, {
          mode: lipsyncMode,
          imageUrl: imageForVideo,
          identityImageUrl: artistProfileImage || referenceImageUrl || imageForVideo,
          audioUrl: selectedSong.audioUrl,
          klingPrompt: dirData.direction?.kling_motion_prompt,
          clipStartSeconds: analyzeData.analysis?.best_segment?.start_time || 0,
          lyricsExcerpt: analyzeData.analysis?.best_segment?.lyrics_excerpt || '',
          mood: analyzeData.analysis?.detected_mood || selectedSong.mood || '',
          energyLevel: analyzeData.analysis?.energy_level || 6,
          bpmFeel: analyzeData.analysis?.detected_bpm_feel || '',
          segmentType: analyzeData.analysis?.segment_type || '',
          songTitle: selectedSong.name || selectedSong.title || '',
        });

        if (vidData.success) {
          setVideoRequestId(vidData.requestId);
          setVideoPollStatus('polling');
          setActiveStep('video');

          // Poll video
          let vidPolls = 0;
          await new Promise<void>((resolve) => {
            const pollVideo = async () => {
              if (autoFlowAbortRef.current || vidPolls > MAX_POLLS) { resolve(); return; }
              vidPolls++;
              const prog = Math.min(90, 5 + vidPolls * 2);
              autoFlow.setStepProgress('video', prog, `Lipsync processing... (${vidPolls * 5}s elapsed)`);
              try {
                const pollData = await apiRequest('POST', `/api/promo-clips/${artistId}/poll-fal`, {
                  requestId: vidData.requestId,
                  endpoint: vidData.endpoint,
                  jobType: 'video',
                });
                if (pollData.status === 'COMPLETED' && pollData.result?.video?.url) {
                  setGeneratedVideoUrl(pollData.result.video.url);
                  setVideoPollStatus('done');
                  resolve();
                  return;
                }
                if (pollData.status === 'FAILED') { resolve(); return; }
              } catch {}
              setTimeout(pollVideo, POLL_INTERVAL_MS);
            };
            setTimeout(pollVideo, POLL_INTERVAL_MS);
          });

          autoFlow.setStepDone('video', 'Promo video rendered âœ“');
        } else {
          autoFlow.setStepSkipped('video');
        }
      } else {
        autoFlow.setStepSkipped('video');
      }

      if (autoFlowAbortRef.current) return;

      // Step 5: Captions
      autoFlow.setStepRunning('captions', 'AI copywriter crafting viral hooks...');
      try {
        const capData = await apiRequest('POST', `/api/promo-clips/${artistId}/generate-captions`, {
          songTitle: selectedSong.name || selectedSong.title,
          lyricsExcerpt: analyzeData.analysis.best_segment?.lyrics_excerpt,
          genre: analyzeData.analysis.detected_genre,
          mood: analyzeData.analysis.detected_mood,
          targetPlatforms,
        });
        if (capData.success) {
          setCaptions(capData.captions);
          setActiveStep('captions');
          autoFlow.setStepDone('captions', 'Viral captions written âœ“');
        } else {
          autoFlow.setStepError('captions', capData.error);
        }
      } catch (e: any) {
        autoFlow.setStepError('captions', e.message);
      }

      if (autoFlowAbortRef.current) return;

      // Step 6: Hollywood Poster
      autoFlow.setStepRunning('poster', 'Designing Hollywood movie poster...');
      try {
        const posterData = await apiRequest('POST', `/api/promo-clips/${artistId}/generate-hollywood-poster`, {
          artistName: artistName || '',
          songName: selectedSong.name || selectedSong.title || '',
          songGenre: analyzeData.analysis.detected_genre || selectedSong.genre || '',
          viralHook: analyzeData.analysis.viral_hook || '',
          storySeed: analyzeData.analysis.story_seed || '',
          mood: analyzeData.analysis.detected_mood || '',
          energyLevel: analyzeData.analysis.energy_level || '',
          referenceImageUrl: imageForVideo || referenceImageUrl || '',
          colorPromptHint: selectedPalette?.promptHint || '',
        });
        if (posterData.success) {
          autoFlow.setStepDone('poster', `Poster created: "${posterData.headline}"`);
        } else {
          autoFlow.setStepError('poster', posterData.error);
        }
      } catch (e: any) {
        autoFlow.setStepError('poster', e.message);
      }

      if (autoFlowAbortRef.current) return;

      // Step 7: Save to gallery
      autoFlow.setStepRunning('gallery', 'Publishing to profile...');
      if (imageForVideo) {
        try {
          await apiRequest('POST', `/api/promo-clips/${artistId}/save-to-gallery`, {
            imageUrls: generatedImages.map(i => i.url),
            songName: selectedSong.name || selectedSong.title || '',
            artistName: artistName || '',
          });
          autoFlow.setStepDone('gallery', 'Saved to your gallery âœ“');
        } catch {
          autoFlow.setStepError('gallery', 'Could not save to gallery');
        }
      } else {
        autoFlow.setStepSkipped('gallery');
      }

    } catch (e: any) {
      if (e.message !== 'Cancelled') {
        setError(e.message);
      }
    }
  }, [selectedSong, artistId, clipDuration, targetGoal, artistGenre, artistName, artistBiography,
      referenceImageUrl, artistProfileImage, targetPlatforms, lipsyncMode,
      selectedPalette, selectedVisualStyle, autoFlow, generatedImages]);

  // â”€â”€ Render Helpers â”€â”€

  const StepBadge = ({ step, label, icon: Icon }: { step: Step; label: string; icon: any }) => {
    const steps: Step[] = ['select', 'analyze', 'direction', 'image', 'video', 'captions', 'export'];
    const currentIdx = steps.indexOf(activeStep);
    const stepIdx = steps.indexOf(step);
    const isDone = stepIdx < currentIdx;
    const isActive = step === activeStep;
    return (
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
          isActive ? 'text-white' : isDone ? 'opacity-70' : 'opacity-40'
        }`}
        style={{
          background: isActive ? accent : isDone ? `${accent}44` : 'rgba(255,255,255,0.06)',
          border: `1px solid ${isActive ? accent : 'rgba(255,255,255,0.1)'}`,
        }}
        onClick={() => isDone || isActive ? setActiveStep(step) : undefined}
      >
        {isDone ? <CheckCircle size={12} /> : <Icon size={12} />}
        {label}
      </div>
    );
  };

  const narrativeSourceKeys = narrativeStoryboard
    ? Array.from(new Set(narrativeStoryboard.scenes.map(scene => getNarrativeSceneJobKey(scene))))
    : [];
  const narrativeSourceCount = narrativeStoryboard?.sourceSceneCount || narrativeSourceKeys.length || 0;
  const narrativeCutCount = narrativeStoryboard?.totalCuts || narrativeStoryboard?.scenes.length || 0;
  const narrativeScenesComplete = narrativeStoryboard
    ? narrativeStoryboard.scenes.every(scene => narrativeSceneJobs[getNarrativeSceneJobKey(scene)]?.status === 'done' && narrativeSceneJobs[getNarrativeSceneJobKey(scene)]?.videoUrl)
    : false;
  const narrativeScenesInProgress = narrativeSourceKeys.some(sceneKey => ['queued', 'polling', 'syncing'].includes(narrativeSceneJobs[sceneKey]?.status || ''));
  const narrativeSceneImagesInProgress = narrativeStoryboard?.scenes.some(scene => ['queued', 'polling'].includes(narrativeSceneImageJobs[getNarrativeSceneImageJobKey(scene)]?.status || '')) || false;
  const narrativeCompletedCount = narrativeSourceKeys.filter(sceneKey => narrativeSceneJobs[sceneKey]?.status === 'done').length;
  const narrativeSceneImageCount = narrativeStoryboard?.scenes.filter(scene => !needsObjectOnlyRefresh(scene) && (scene.sceneImageUrl || narrativeSceneImageJobs[getNarrativeSceneImageJobKey(scene)]?.imageUrl)).length || 0;

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl overflow-hidden text-white"
      style={{
        background: '#0a0a14',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 12px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
      }}
    >
      {/* Auto-Flow overlay */}
      <PromoAutoFlow
        isOpen={autoFlow.isOpen}
        steps={autoFlow.steps}
        currentStepId={autoFlow.currentStepId}
        onCancel={() => { autoFlowAbortRef.current = true; autoFlow.closeFlow(); }}
        accent={accent}
        songName={selectedSong?.name || selectedSong?.title}
      />

      {/* Cinematic gradient top bar */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent 0%, ${accent} 30%, #8b5cf6 70%, transparent 100%)` }} />

      {/* â”€â”€â”€ HEADER â”€â”€â”€ */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${accent}30, rgba(139,92,246,0.2))`, border: `1px solid ${accent}44` }}
          >
            <Film size={20} style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-black tracking-tight leading-none">Promo Clips</h2>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0"
                style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}40` }}
              >
                Lipsync Engine
              </span>
            </div>
            <p className="text-white/35 text-xs mt-1 leading-none">AI music video generation Â· Flux Kontext Pro</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {savedJobs.length > 0 && (
            <button
              onClick={() => setShowSavedJobs(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)' }}
            >
              <Clock size={13} /> {savedJobs.length}
            </button>
          )}
          {isOwnProfile && selectedSong && (
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: `0 0 28px ${accent}55` }}
              whileTap={{ scale: 0.96 }}
              onClick={runAutoFlow}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)`, color: '#fff', boxShadow: `0 0 16px ${accent}33` }}
            >
              <Zap className="w-3.5 h-3.5" />
              Auto-Generate
            </motion.button>
          )}
        </div>
      </div>

      {/* â”€â”€â”€ STEP PROGRESS â”€â”€â”€ */}
      <div className="px-5 py-3 flex items-center gap-0 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {([
          { step: 'select' as Step, label: 'Song', num: 1 },
          { step: 'analyze' as Step, label: 'Analysis', num: 2 },
          { step: 'direction' as Step, label: 'Visual', num: 3 },
          { step: 'image' as Step, label: 'Image', num: 4 },
          { step: 'video' as Step, label: 'Video', num: 5 },
          { step: 'captions' as Step, label: 'Captions', num: 6 },
        ] as Array<{ step: Step; label: string; num: number }>).map(({ step, label, num }, idx) => {
          const steps: Step[] = ['select', 'analyze', 'direction', 'image', 'video', 'captions', 'export'];
          const currentIdx = steps.indexOf(activeStep);
          const stepIdx = steps.indexOf(step);
          const isDone = stepIdx < currentIdx;
          const isActive = step === activeStep;
          return (
            <div key={step} className="flex items-center flex-shrink-0">
              <button
                onClick={() => isDone || isActive ? setActiveStep(step) : undefined}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  color: isActive ? '#fff' : isDone ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.25)',
                  cursor: isDone || isActive ? 'pointer' : 'default',
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{
                    background: isActive ? accent : isDone ? `${accent}50` : 'rgba(255,255,255,0.07)',
                    color: isActive || isDone ? '#fff' : 'rgba(255,255,255,0.3)',
                  }}
                >
                  {isDone ? <CheckCircle size={11} /> : num}
                </div>
                <span className="hidden sm:block">{label}</span>
              </button>
              {idx < 5 && (
                <div className="w-4 h-px mx-0.5 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.09)' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Saved jobs dropdown */}
      {savedJobs.length > 0 && showSavedJobs && (
        <div className="mx-5 mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.4)' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">Saved Jobs</span>
            <button onClick={() => setShowSavedJobs(false)} className="text-white/35 hover:text-white/70 transition-colors"><X size={14} /></button>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {savedJobs.map((job, i) => (
              <div key={job.job_id || i} className="flex items-center gap-3 px-4 py-3 text-xs">
                {job.selected_image_url && (
                  <img src={job.selected_image_url} alt="" className="w-8 h-12 object-cover rounded-lg flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{job.song_name || 'No song'}</p>
                  <p className="text-white/35 mt-0.5">{job.status === 'complete' ? 'âœ… Complete' : job.status === 'has_image' ? 'ðŸ–¼ Has image' : 'ðŸ“ Draft'} Â· {new Date(job.created_at || 0).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => loadJob(job)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
                  style={{ background: accent, color: '#fff' }}
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-5 mt-4 flex items-center gap-3 p-3.5 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#fca5a5' }}>
          <AlertCircle size={15} className="flex-shrink-0" />
          <span className="flex-1 text-xs leading-snug">{error}</span>
          <button onClick={clearError} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"><X size={13} /></button>
        </div>
      )}

      <div className="p-5 space-y-5">

      {/* â”€â”€â”€ STEP 1: SELECT SONG â”€â”€â”€ */}
      {(activeStep === 'select' || true) && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: `${accent}22`, color: accent }}>1</div>
              <h3 className="font-bold text-sm tracking-tight">Select Song</h3>
            </div>
            {selectedSong && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: accent }}>
                <CheckCircle size={12} /> {selectedSong.name || selectedSong.title}
              </div>
            )}
          </div>

          <div className="p-5 space-y-5">
            {songs.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-8">No songs available. Upload a song first.</p>
            ) : (
              <div className="grid gap-2 max-h-[280px] overflow-y-auto pr-1">
                {songs.map(song => {
                  const isSelected = selectedSong?.id === song.id;
                  return (
                    <motion.button
                      key={song.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedSong(song)}
                      className="flex items-center gap-4 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: isSelected ? `${accent}18` : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${isSelected ? accent : 'rgba(255,255,255,0.07)'}`,
                        boxShadow: isSelected ? `0 0 16px ${accent}22` : 'none',
                      }}
                    >
                      {song.coverUrl ? (
                        <img src={song.coverUrl} alt={song.name || song.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
                          <Music size={20} style={{ color: accent }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{song.name || song.title || 'Untitled'}</p>
                        <p className="text-white/40 text-xs mt-0.5">{song.genre || 'No genre'}{song.mood ? ` Â· ${song.mood}` : ''}</p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: accent }}>
                          <CheckCircle size={13} className="text-white" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Video type + Duration + Platforms */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/35 block mb-2">Video Type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => setPromoWorkflow('single')}
                    className="py-2 text-xs rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all"
                    style={{ background: promoWorkflow === 'single' ? accent : 'rgba(255,255,255,0.06)', color: promoWorkflow === 'single' ? '#fff' : 'rgba(255,255,255,0.55)', border: `1px solid ${promoWorkflow === 'single' ? accent : 'transparent'}` }}>
                    <Video size={12} /> Single
                  </button>
                  <button onClick={() => { setPromoWorkflow('narrative-30s'); setClipDuration(30); }}
                    className="py-2 text-xs rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all"
                    style={{ background: promoWorkflow === 'narrative-30s' ? '#14b8a6' : 'rgba(255,255,255,0.06)', color: promoWorkflow === 'narrative-30s' ? '#fff' : 'rgba(255,255,255,0.55)', border: `1px solid ${promoWorkflow === 'narrative-30s' ? '#14b8a6' : 'transparent'}` }}>
                    <Film size={12} /> Narrative
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/35 block mb-2">Duration</label>
                <div className="flex gap-1.5">
                  {([15, 30, 60] as ClipDuration[]).map(d => (
                    <button key={d} onClick={() => setClipDuration(d)}
                      className="flex-1 py-2 text-xs rounded-xl font-bold transition-all"
                      style={{ background: clipDuration === d ? accent : 'rgba(255,255,255,0.06)', color: clipDuration === d ? '#fff' : 'rgba(255,255,255,0.55)', border: `1px solid ${clipDuration === d ? accent : 'transparent'}` }}>
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/35 block mb-2">Platforms</label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(PLATFORM_LABELS) as Platform[]).map(p => (
                    <button key={p} onClick={() => setTargetPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                      className="px-2.5 py-1 text-xs rounded-lg font-semibold transition-all"
                      style={{ background: targetPlatforms.includes(p) ? `${accent}25` : 'rgba(255,255,255,0.05)', border: `1px solid ${targetPlatforms.includes(p) ? accent : 'transparent'}`, color: targetPlatforms.includes(p) ? accent : 'rgba(255,255,255,0.45)' }}>
                      {PLATFORM_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Lipsync engine */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/35 block mb-2">Lipsync Engine</label>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
                {([
                  { mode: 'omnihuman' as LipsyncMode, label: 'Fast', color: accent },
                  { mode: 'seedance-mini-r2v' as LipsyncMode, label: 'Eco', color: '#10b981' },
                  { mode: 'seedance-fast-r2v' as LipsyncMode, label: 'Rhythm', color: '#14b8a6' },
                  { mode: 'kling-v21-standard-sync3' as LipsyncMode, label: 'Test', color: '#22c55e' },
                  { mode: 'kling-v3-standard-sync3' as LipsyncMode, label: 'Balance', color: '#f59e0b' },
                  { mode: 'kling-v3-pro-sync3' as LipsyncMode, label: 'Premium', color: '#f97316' },
                ]).map(({ mode, label, color }) => (
                  <button key={mode} onClick={() => setLipsyncMode(mode)}
                    className="py-2 text-xs rounded-xl font-bold transition-all"
                    style={{ background: lipsyncMode === mode ? color : 'rgba(255,255,255,0.05)', color: lipsyncMode === mode ? '#fff' : 'rgba(255,255,255,0.5)', border: `1px solid ${lipsyncMode === mode ? color : 'transparent'}` }}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-white/35 leading-snug">
                {selectedModeInfo.label}{selectedModeInfo.cost5s ? ` Â· ${selectedModeInfo.cost5s} Â· ${selectedModeInfo.cost30s}` : ''}
              </p>
            </div>

            {/* Narrative 30s config */}
            {promoWorkflow === 'narrative-30s' && (
              <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.18)' }}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Performance</label>
                      <span className="text-xs font-bold" style={{ color: '#14b8a6' }}>{performancePercent}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={10} value={performancePercent}
                      onChange={e => { const v = Number(e.target.value); setPerformancePercent(v); setLipsyncPercent(prev => Math.min(prev, v)); }}
                      className="w-full accent-teal-500" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Lipsync</label>
                      <span className="text-xs font-bold" style={{ color: '#14b8a6' }}>{effectiveLipsyncPercent}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={10} value={effectiveLipsyncPercent}
                      onChange={e => setLipsyncPercent(Math.min(Number(e.target.value), performancePercent))}
                      className="w-full accent-teal-500" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 block mb-2">B-roll Model</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {BROLL_MODEL_OPTIONS.map(mode => (
                      <button key={mode} onClick={() => setBrollMode(mode)}
                        className="py-2 px-1 text-[11px] rounded-xl font-bold transition-all"
                        style={{ background: brollMode === mode ? '#14b8a6' : 'rgba(255,255,255,0.06)', color: brollMode === mode ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                        {LIPSYNC_MODE_INFO[mode].shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Cuts', value: narrativeBudget.totalCuts },
                    { label: 'Lipsync', value: narrativeBudget.lipsyncScenes },
                    { label: 'B-roll', value: narrativeBudget.brollScenes },
                    { label: 'Cost', value: `~$${narrativeBudget.estimatedCostWithImages}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-white/40 text-[10px] mb-0.5">{label}</p>
                      <p className="font-bold text-sm">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reference image */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/35 block mb-2">Artist Reference Image (optional)</label>
              <input type="text" value={referenceImageUrl} onChange={e => setReferenceImageUrl(e.target.value)}
                placeholder="https://... (preserves artist identity in generations)"
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-transparent outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff', background: 'rgba(255,255,255,0.03)' }} />
            </div>

            {/* â”€â”€ VISUAL STYLE SELECTOR â”€â”€ */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-0.5 h-4 rounded-full" style={{ background: accent }} />
                <span className="text-xs font-bold uppercase tracking-widest text-white/50">Visual Style</span>
              </div>
              <PromoStyleSelector
                artistId={artistId}
                referenceImageUrl={referenceImageUrl || artistProfileImage}
                selectedStyleId={selectedStyleId}
                onSelectStyle={handleSelectStyle}
                accent={accent}
              />
            </div>

            {/* â”€â”€ COLOR MOOD PICKER â”€â”€ */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-0.5 h-4 rounded-full" style={{ background: '#a855f7' }} />
                <span className="text-xs font-bold uppercase tracking-widest text-white/50">Color Mood</span>
              </div>
              <PromoColorMoodPicker
                artistId={artistId}
                selectedPaletteId={selectedPaletteId}
                onSelectPalette={handleSelectPalette}
                accent={accent}
              />
            </div>

            {/* Character Lock (narrative only) */}
            {promoWorkflow === 'narrative-30s' && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.025)', border: `1.5px solid ${characterLock ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: characterLock ? 'rgba(34,197,94,0.2)' : 'rgba(20,184,166,0.18)' }}>
                      {characterLock ? <CheckCircle size={13} style={{ color: '#22c55e' }} /> : <Image size={13} style={{ color: '#14b8a6' }} />}
                    </div>
                    <span className="text-sm font-bold">Character Lock</span>
                    {characterLock && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: 'rgba(34,197,94,0.18)', color: '#86efac' }}>Active</span>}
                  </div>
                  <span className="text-[11px] text-white/35">{characterReferenceUrls.length}/8 refs</span>
                </div>
                {characterReferenceUrls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {characterReferenceUrls.map(url => (
                      <div key={url} className="relative w-12 h-16 rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img src={url} alt="Character ref" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeCharacterReferenceUrl(url)}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-black/70">
                          <X size={9} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input type="text" value={characterReferenceInput} onChange={e => setCharacterReferenceInput(e.target.value)}
                    placeholder="Extra face / look URL"
                    className="px-3 py-2 rounded-xl text-xs bg-transparent outline-none"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                  <button type="button" onClick={addCharacterReferenceFromInput}
                    className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    Add
                  </button>
                </div>
                <div className="flex gap-2">
                  <label className="flex-1 py-2 rounded-xl text-xs font-bold text-center cursor-pointer" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {characterImageUploading ? 'Uploading...' : 'Upload Photos'}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={uploadCharacterReferenceImages} />
                  </label>
                  <button type="button" onClick={createCharacterLock}
                    disabled={characterLockLoading || characterImageUploading || characterReferenceUrls.length === 0}
                    className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
                    style={{ background: characterLock ? 'rgba(34,197,94,0.18)' : '#14b8a6', color: characterLock ? '#86efac' : '#fff' }}>
                    {characterLockLoading ? <Loader2 size={12} className="animate-spin" /> : characterLock ? <CheckCircle size={12} /> : <Sparkles size={12} />}
                    {characterLock ? 'Lock Active' : 'Create Lock'}
                  </button>
                </div>
                <textarea rows={2} value={characterNotes} onChange={e => { setCharacterNotes(e.target.value); setCharacterLock(null); }}
                  placeholder="Notes: face, hair, beard, hat, glasses, outfit, accessories..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-transparent outline-none resize-none"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                {characterLock && (
                  <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <p className="font-bold" style={{ color: '#86efac' }}>{characterLock.identityLabel}</p>
                    <p className="text-white/50 line-clamp-2">{characterLock.faceLockPrompt}</p>
                  </div>
                )}
              </div>
            )}

            {/* Analyze CTA */}
            <motion.button
              whileHover={{ scale: 1.01, boxShadow: selectedSong ? `0 0 30px ${accent}44` : 'none' }}
              whileTap={{ scale: 0.99 }}
              onClick={analyzeSong}
              disabled={!selectedSong || analyzingLoading}
              className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2.5 disabled:opacity-30"
              style={{ background: selectedSong ? `linear-gradient(135deg, ${accent}, #8b5cf6)` : 'rgba(255,255,255,0.07)', color: '#fff' }}
            >
              {analyzingLoading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {analyzingLoading ? 'Analyzing Song...' : 'Analyze Song â†’'}
            </motion.button>
          </div>
        </div>
      )}

      {/* â”€â”€â”€ STEP 2: SONG ANALYSIS â”€â”€â”€ */}
      {analysis && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(139,92,246,0.22)', color: '#a78bfa' }}>2</div>
            <h3 className="font-bold text-sm tracking-tight">Song Analysis</h3>
            <CheckCircle size={14} style={{ color: '#22c55e' }} className="ml-auto" />
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Genre', value: analysis.detected_genre },
                { label: 'Mood', value: analysis.detected_mood },
                { label: 'Segment', value: analysis.segment_type },
              ].filter(({ value }) => value).map(({ label, value }) => (
                <div key={label} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-white/40 text-[10px] uppercase tracking-wide mb-1">{label}</p>
                  <p className="font-semibold capitalize">{value}</p>
                </div>
              ))}
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-white/40 text-[10px] uppercase tracking-wide mb-1.5">Energy</p>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex-1 h-2.5 rounded-sm" style={{ background: i < analysis.energy_level ? accent : 'rgba(255,255,255,0.1)' }} />
                  ))}
                </div>
              </div>
            </div>
            {(analysis.lyrics_source || analysis.transcribed_lyrics_excerpt) && (
              <div className="p-3 rounded-xl space-y-1 text-xs" style={{ background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.15)' }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold" style={{ color: '#5eead4' }}>Lyrics: {getLyricsSourceLabel(analysis.lyrics_source)}</p>
                  {analysis.transcript_quality && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(20,184,166,0.18)', color: '#99f6e4' }}>{analysis.transcript_quality}</span>}
                </div>
                {analysis.story_seed && <p className="text-white/55">{analysis.story_seed}</p>}
                {analysis.transcribed_lyrics_excerpt && <p className="text-white/40 italic line-clamp-2">"{analysis.transcribed_lyrics_excerpt}"</p>}
              </div>
            )}
            <div className="p-3.5 rounded-xl space-y-1" style={{ background: `${accent}10`, border: `1px solid ${accent}28` }}>
              <p className="text-white/40 text-xs">Best segment: {analysis.best_segment?.start_time}s â€“ {analysis.best_segment?.end_time}s</p>
              <p className="font-semibold text-sm italic">"{analysis.best_segment?.lyrics_excerpt}"</p>
              <p className="text-white/50 text-xs">{analysis.best_segment?.reason}</p>
            </div>
            {analysis.viral_hook && (
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Star size={14} style={{ color: '#f59e0b' }} className="flex-shrink-0 mt-0.5" />
                <p className="text-xs">{analysis.viral_hook}</p>
              </div>
            )}
            <div className={promoWorkflow === 'narrative-30s' ? 'grid grid-cols-2 gap-2' : ''}>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={createVisualDirection} disabled={directionLoading}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}>
                {directionLoading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                {directionLoading ? 'Creating...' : 'Visual Direction â†’'}
              </motion.button>
              {promoWorkflow === 'narrative-30s' && (
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={createNarrativeStoryboard} disabled={storyboardLoading}
                  className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
                  {storyboardLoading ? <Loader2 size={15} className="animate-spin" /> : <Film size={15} />}
                  {storyboardLoading ? 'Building...' : 'Storyboard 30s â†’'}
                </motion.button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€â”€ STEP 3: VISUAL DIRECTION â”€â”€â”€ */}
      {direction && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(139,92,246,0.22)', color: '#a78bfa' }}>3</div>
            <h3 className="font-bold text-sm tracking-tight">Visual Direction</h3>
            <CheckCircle size={14} style={{ color: '#22c55e' }} className="ml-auto" />
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              {[
                { label: 'Scene', value: direction.scene_description },
                { label: 'Artist', value: direction.artist_action },
                { label: 'Lighting', value: direction.lighting },
                { label: 'Camera', value: direction.camera_movement },
                { label: 'Look', value: direction.wardrobe_detail },
              ].filter(({ value }) => value).map(({ label, value }) => (
                <div key={label} className="flex gap-2 p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span className="text-white/35 text-xs font-bold min-w-14 pt-0.5 flex-shrink-0">{label}</span>
                  <span className="text-xs leading-relaxed">{value}</span>
                </div>
              ))}
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/35 block mb-2">FAL Image Prompt (editable)</label>
              <textarea rows={4} value={customImagePrompt} onChange={e => setCustomImagePrompt(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-xs bg-transparent outline-none resize-none leading-relaxed"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff', background: 'rgba(255,255,255,0.03)' }} />
            </div>
            <motion.button whileHover={{ scale: 1.01, boxShadow: `0 0 26px ${accent}44` }} whileTap={{ scale: 0.99 }}
              onClick={generateImage} disabled={imageLoading || (!customImagePrompt && !direction.fal_image_prompt)}
              className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}>
              {imageLoading ? <Loader2 size={16} className="animate-spin" /> : <Image size={16} />}
              {imageLoading ? 'Generating with Flux Kontext Pro...' : 'Generate 9:16 Image â†’'}
            </motion.button>
            {promoWorkflow === 'narrative-30s' && (
              <>
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-2"><Film size={13} /> Visual Director</p>
                    <button onClick={() => setShowDirectorSelector(s => !s)}
                      className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }}>
                      {showDirectorSelector ? 'Close' : 'Choose Director'}
                    </button>
                  </div>
                  {selectedDirector ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: accent }}>{selectedDirector.name?.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{selectedDirector.name}</p>
                        <p className="text-white/40 text-[11px] line-clamp-1">{selectedDirector.visual_style?.description?.slice(0, 60)}</p>
                      </div>
                      <button onClick={() => setSelectedDirector(null)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
                    </div>
                  ) : (
                    <p className="text-xs text-white/30">No director â€” AI decides visual style</p>
                  )}
                  {showDirectorSelector && (
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                      {DIRECTORS.map(d => (
                        <button key={d.id} onClick={() => { setSelectedDirector(d); setShowDirectorSelector(false); }}
                          className="text-left px-3 py-2 rounded-xl text-xs transition-all"
                          style={{ background: selectedDirector?.id === d.id ? `${accent}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${selectedDirector?.id === d.id ? accent : 'rgba(255,255,255,0.08)'}` }}>
                          <p className="font-semibold truncate">{d.name}</p>
                          <p className="text-white/40 truncate">{d.specialty}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={createNarrativeStoryboard} disabled={storyboardLoading}
                  className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
                  {storyboardLoading ? <Loader2 size={15} className="animate-spin" /> : <Film size={15} />}
                  {storyboardLoading ? 'Refining storyboard...' : 'Create Narrative Storyboard 30s â†’'}
                </motion.button>
              </>
            )}
          </div>
        </div>
      )}

      {/* â”€â”€â”€ STEP 4: IMAGE RESULTS â”€â”€â”€ */}
      {(imageRequestId || generatedImages.length > 0 || imagePollStatus === 'polling') && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(139,92,246,0.22)', color: '#a78bfa' }}>4</div>
            <h3 className="font-bold text-sm tracking-tight">Artist Images</h3>
            {imagePollStatus === 'polling' && <Loader2 size={13} className="animate-spin text-white/50 ml-1" />}
            {imagePollStatus === 'done' && <CheckCircle size={14} style={{ color: '#22c55e' }} className="ml-auto" />}
            {generatedImages.length > 0 && <span className="text-xs text-white/40 ml-auto">{generatedImages.length}/6</span>}
          </div>
          <div className="p-5 space-y-4">
            {imagePollStatus === 'polling' && (
              <div className="flex items-center gap-3 p-3 rounded-xl text-xs text-white/50" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Clock size={13} className="flex-shrink-0" />
                <span>Generating 6 images â€” 3 framings: wide Â· close-up Â· stage</span>
                {generatedImages.length > 0 && <span className="ml-auto" style={{ color: accent }}>âœ“ {generatedImages.length} ready...</span>}
              </div>
            )}
            {generatedImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {generatedImages.map(img => (
                  <motion.button key={img.index} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedImageUrl(img.url)}
                    className="relative rounded-xl overflow-hidden"
                    style={{ aspectRatio: '9/16', border: `2px solid ${selectedImageUrl === img.url ? accent : 'rgba(255,255,255,0.08)'}`, boxShadow: selectedImageUrl === img.url ? `0 0 20px ${accent}44` : 'none' }}>
                    <img src={img.url} alt={`Generated ${img.index + 1}`} className="w-full h-full object-cover" />
                    {selectedImageUrl === img.url && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${accent}2a` }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: accent }}>
                          <CheckCircle size={18} className="text-white" />
                        </div>
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
            {selectedImageUrl && (
              <motion.button whileHover={{ scale: 1.01, boxShadow: `0 0 28px ${videoModeAccent}44` }} whileTap={{ scale: 0.99 }}
                onClick={generateVideo} disabled={videoLoading || !selectedSong?.audioUrl}
                className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${videoModeAccent}, #8b5cf6)` }}>
                {videoLoading ? <Loader2 size={16} className="animate-spin" /> :
                  lipsyncMode === 'omnihuman' ? <Zap size={16} /> :
                  lipsyncMode === 'seedance-fast-r2v' ? <Music size={16} /> :
                  lipsyncMode === 'kling-v21-standard-sync3' ? <Settings size={16} /> :
                  lipsyncMode === 'kling-v3-standard-sync3' ? <Star size={16} /> : <Crown size={16} />}
                {videoLoading ? 'Sending to FAL...' : selectedModeInfo.generateLabel}
              </motion.button>
            )}
            {!selectedSong?.audioUrl && selectedImageUrl && (
              <p className="text-xs text-center" style={{ color: '#f59e0b' }}>âš  This song has no audio URL. Upload audio first.</p>
            )}
          </div>
        </div>
      )}

      {/* â”€â”€â”€ NARRATIVE 30S STORYBOARD â”€â”€â”€ */}
      {promoWorkflow === 'narrative-30s' && narrativeStoryboard && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(20,184,166,0.25)' }}>
          <div className="flex items-start justify-between gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(20,184,166,0.12)' }}>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(20,184,166,0.2)' }}>
                  <Film size={13} style={{ color: '#14b8a6' }} />
                </div>
                <h3 className="font-bold text-sm tracking-tight">Narrative Storyboard 30s</h3>
              </div>
              <p className="text-white/40 text-xs mt-1 ml-8">{narrativeStoryboard.concept}</p>
            </div>
            <div className="text-right text-xs flex-shrink-0">
              <p className="font-bold text-sm" style={{ color: '#14b8a6' }}>~${narrativeStoryboard.costBreakdown?.totalWithImages || narrativeStoryboard.estimatedCost}</p>
              <p className="text-white/35 mt-0.5">{narrativeCompletedCount}/{narrativeSourceCount} Â· {narrativeCutCount} cuts</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Timeline', value: `${narrativeCutCount} cuts` },
                { label: 'Lipsync', value: `${narrativeStoryboard.lipsyncSceneCount}/${narrativeSourceCount}` },
                { label: 'B-roll', value: `${narrativeStoryboard.brollSceneCount}` },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-xl text-center" style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.12)' }}>
                  <p className="text-white/40 text-[10px] uppercase tracking-wide mb-1">{label}</p>
                  <p className="font-bold text-sm" style={{ color: '#5eead4' }}>{value}</p>
                </div>
              ))}
            </div>
            {(narrativeStoryboard.characterLock || narrativeStoryboard.lyricContinuityPlan || narrativeStoryboard.narrativeArcPlan || narrativeStoryboard.faceBiblePrompt || narrativeStoryboard.paletteBiblePrompt || narrativeStoryboard.editingGrammarPrompt) && (
              <div className="rounded-xl p-3 text-xs space-y-1.5" style={{ background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.15)' }}>
                {narrativeStoryboard.lyricsSource && <p><span className="text-white/40">Lyrics: </span><span className="font-semibold">{getLyricsSourceLabel(narrativeStoryboard.lyricsSource)}</span></p>}
                {narrativeStoryboard.characterLock && <p><span className="text-white/40">Identity: </span><span className="font-semibold">{narrativeStoryboard.characterLock.identityLabel}</span></p>}
                {narrativeStoryboard.palettePrompt && <p><span className="text-white/40">Palette: </span><span className="text-white/60">{narrativeStoryboard.palettePrompt}</span></p>}
                {narrativeStoryboard.faceBiblePrompt && <p className="text-white/50 line-clamp-2"><span className="text-white/40">Face bible: </span>{narrativeStoryboard.faceBiblePrompt}</p>}
                {narrativeStoryboard.paletteBiblePrompt && <p className="text-white/50 line-clamp-2"><span className="text-white/40">Palette bible: </span>{narrativeStoryboard.paletteBiblePrompt}</p>}
                {(narrativeStoryboard.editingGrammarPrompt || narrativeStoryboard.editingGrammar?.microCutRule) && <p className="text-white/50 line-clamp-2"><span className="text-white/40">Edit: </span>{narrativeStoryboard.editingGrammarPrompt || narrativeStoryboard.editingGrammar?.microCutRule}</p>}
                {narrativeStoryboard.lyricContinuityPlan && <p className="text-white/50 line-clamp-2">{narrativeStoryboard.lyricContinuityPlan}</p>}
                {narrativeStoryboard.narrativeArcPlan && <p className="text-white/50 line-clamp-2">Arc: {narrativeStoryboard.narrativeArcPlan}</p>}
              </div>
            )}
            <div className="space-y-2">
              {narrativeStoryboard.scenes.map(scene => {
                const sceneKey = getNarrativeSceneJobKey(scene);
                const job = narrativeSceneJobs[sceneKey];
                const stillJob = narrativeSceneImageJobs[getNarrativeSceneImageJobKey(scene)];
                const sceneNeedsRefresh = needsObjectOnlyRefresh(scene);
                const sceneStillUrl = sceneNeedsRefresh ? undefined : scene.sceneImageUrl || stillJob?.imageUrl;
                const status = job?.status || 'idle';
                const stillStatus = stillJob?.status || 'idle';
                const isBusy = ['queued', 'polling', 'syncing'].includes(status);
                const isStillBusy = ['queued', 'polling'].includes(stillStatus);
                const displayIntent = getNarrativeSceneDisplayIntent(scene);
                const displayMeta = getNarrativeSceneDisplayMeta(scene);
                return (
                  <div key={scene.id} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-16 rounded-xl overflow-hidden flex items-center justify-center text-sm font-black flex-shrink-0" style={{ background: scene.requiresLipsync ? 'rgba(20,184,166,0.2)' : 'rgba(255,255,255,0.06)', color: scene.requiresLipsync ? '#5eead4' : 'rgba(255,255,255,0.5)' }}>
                        {sceneStillUrl ? <img src={sceneStillUrl} alt={`Scene ${scene.index + 1}`} className="w-full h-full object-cover" /> : scene.index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="text-xs font-bold">{formatTimelineSeconds(scene.startTime)}sâ€“{formatTimelineSeconds(scene.endTime)}s Â· {formatTimelineSeconds(scene.duration)}s</span>
                          {scene.sourceSceneId && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: scene.isContinuationCut ? 'rgba(255,255,255,0.06)' : 'rgba(20,184,166,0.15)', color: scene.isContinuationCut ? 'rgba(255,255,255,0.45)' : '#5eead4' }}>
                              {scene.isContinuationCut ? 'cut' : 'source'} {Number(scene.sourceIndex ?? scene.index) + 1}
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded-md text-[10px]" style={{ background: scene.requiresLipsync ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.06)', color: scene.requiresLipsync ? '#5eead4' : 'rgba(255,255,255,0.55)' }}>
                            {SCENE_TYPE_LABELS[scene.sceneType]}
                          </span>
                          {scene.act && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] text-white/45" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              {scene.act.replace('_', ' ')}
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] text-white/45" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            {LIPSYNC_MODE_INFO[scene.model]?.shortLabel || 'Model'} Â· ${scene.estimatedCost}
                          </span>
                        </div>
                        <p className="text-xs font-medium leading-snug line-clamp-2">{displayIntent}</p>
                        {displayMeta && <p className="text-[11px] text-white/40 mt-1">{displayMeta}</p>}
                        {scene.lyricsExcerpt && <p className="text-[11px] text-white/50 italic mt-1">"{scene.lyricsExcerpt}"</p>}
                        {scene.lyricConnection && <p className="text-[11px] mt-1" style={{ color: '#5eead4' }}>{stripInternalSceneCopy(scene.lyricConnection)}</p>}
                        {scene.brollSubject && <p className="text-[11px] text-white/35 mt-1">B-roll: {cleanBrollDisplayCopy(scene.brollSubject)}</p>}
                        {(scene.pipelineRole || scene.transition || scene.editCue) && <p className="text-[11px] text-white/35 mt-1">Edit/QC: {[scene.pipelineRole, scene.transition, scene.editCue].filter(Boolean).join(' Â· ')}</p>}
                        {scene.qualityChecklist?.length ? <p className="text-[11px] text-white/35 mt-1 line-clamp-2">QC: {scene.qualityChecklist.slice(0, 3).join(' Â· ')}</p> : null}
                        {sceneNeedsRefresh && <p className="text-[11px] mt-1" style={{ color: '#fbbf24' }}>Redo concept before generating video.</p>}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button onClick={() => generateNarrativeSceneImage(scene)} disabled={isStillBusy}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 disabled:opacity-40"
                          style={{ background: sceneStillUrl ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.07)', color: sceneStillUrl ? '#5eead4' : 'rgba(255,255,255,0.7)' }}>
                          {isStillBusy ? <Loader2 size={11} className="animate-spin" /> : sceneStillUrl ? <CheckCircle size={11} /> : <Image size={11} />}
                          {sceneStillUrl ? 'Redo' : 'Still'}
                        </button>
                        <button onClick={() => generateNarrativeScene(scene)} disabled={isBusy || !selectedSong?.audioUrl}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 disabled:opacity-40"
                          style={{ background: status === 'done' ? 'rgba(34,197,94,0.18)' : '#14b8a6', color: status === 'done' ? '#86efac' : '#fff' }}>
                          {isBusy ? <Loader2 size={11} className="animate-spin" /> : status === 'done' ? <CheckCircle size={11} /> : <Play size={11} />}
                          {status === 'done' ? 'Done' : isBusy ? '...' : 'Gen'}
                        </button>
                        {job?.videoUrl && (
                          <a href={job.videoUrl} target="_blank" rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg text-[11px] text-center font-semibold" style={{ background: 'rgba(255,255,255,0.07)' }}>
                            View
                          </a>
                        )}
                      </div>
                    </div>
                    {stillJob?.error && <p className="text-[11px] text-red-400">{stillJob.error}</p>}
                    {job?.error && <p className="text-[11px] text-red-400">{job.error}</p>}
                    {job?.phase && status !== 'done' && !job?.error && <p className="text-[11px] text-white/35">{job.phase}</p>}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={generateAllNarrativeSceneImages} disabled={narrativeSceneImagesInProgress}
                className="py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {narrativeSceneImagesInProgress ? <Loader2 size={13} className="animate-spin" /> : <Image size={13} />}
                Stills
              </button>
              <button onClick={generateAllNarrativeScenes} disabled={narrativeScenesInProgress || !selectedSong?.audioUrl}
                className="py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {narrativeScenesInProgress ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Gen All
              </button>
              <button onClick={renderNarrativeVideo} disabled={!narrativeScenesComplete || narrativeRenderLoading}
                className="py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{ background: narrativeScenesComplete ? 'linear-gradient(135deg, #14b8a6, #0d9488)' : 'rgba(255,255,255,0.08)' }}>
                {narrativeRenderLoading ? <Loader2 size={13} className="animate-spin" /> : <Video size={13} />}
                {narrativeRenderLoading ? 'Rendering...' : 'Render 30s'}
              </button>
            </div>
            {narrativeVideoUrl && (
              <video src={narrativeVideoUrl} controls className="w-full max-w-xs mx-auto rounded-xl" style={{ aspectRatio: '9/16', maxHeight: '480px' }} />
            )}
          </div>
        </div>
      )}

      {/* â”€â”€â”€ STEP 5: VIDEO RESULTS â”€â”€â”€ */}
      {(videoRequestId || generatedVideoUrl) && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(139,92,246,0.22)', color: '#a78bfa' }}>5</div>
            <h3 className="font-bold text-sm tracking-tight">Lipsync Video</h3>
            {videoPollStatus === 'polling' && <Loader2 size={13} className="animate-spin text-white/50 ml-1" />}
            {videoStep2RequestId && videoPollStatus === 'polling' && <span className="text-xs text-white/40">(Sync-3...)</span>}
            {videoPollStatus === 'done' && <CheckCircle size={14} style={{ color: '#22c55e' }} className="ml-auto" />}
          </div>
          <div className="p-5 space-y-4">
            {videoPollStatus === 'polling' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: accent }} />
                  <span className="text-xs text-white/70">
                    {lipsyncMode === 'omnihuman' ? 'OmniHuman v1.5 generating lipsync...'
                      : videoStep2RequestId ? 'Sync-3 syncing lips to song...'
                      : lipsyncMode === 'seedance-fast-r2v' ? 'Seedance 2.0 generating rhythmic performance...'
                      : selectedModeInfo.pollingLabel}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/35 flex-wrap">
                  {videoQueuePhase && (
                    <span className="px-2.5 py-1 rounded-lg" style={{ background: videoQueuePhase === 'IN_PROGRESS' ? `${accent}22` : 'rgba(255,255,255,0.06)' }}>
                      {videoQueuePhase === 'IN_QUEUE' ? 'ðŸ• In queue' : videoQueuePhase === 'IN_PROGRESS' ? 'âš¡ Processing' : videoQueuePhase}
                    </span>
                  )}
                  {videoQueuePosition !== null && videoQueuePosition > 0 && <span>Queue #{videoQueuePosition}</span>}
                  <span>{Math.round(videoPollCount.current * POLL_INTERVAL_MS / 1000)}s elapsed</span>
                </div>
                {videoPollCount.current * POLL_INTERVAL_MS / 1000 > 600 && (
                  <button onClick={generateVideo} className="text-xs px-3 py-1.5 rounded-xl opacity-60 hover:opacity-100 transition-opacity" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    âŸ³ Retry with new request
                  </button>
                )}
              </div>
            )}
            {generatedVideoUrl && (
              <div className="space-y-3">
                <video src={generatedVideoUrl} controls className="w-full max-w-xs mx-auto rounded-xl" style={{ aspectRatio: '9/16', maxHeight: '480px' }} />
                <div className="flex gap-2">
                  <a href={generatedVideoUrl} download="promo-clip.mp4" target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}>
                    <Download size={15} /> Download
                  </a>
                  <button onClick={generateCaptions} disabled={captionsLoading}
                    className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {captionsLoading ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
                    {captionsLoading ? 'Generating...' : 'Captions â†’'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* â”€â”€â”€ STEP 6: CAPTIONS â”€â”€â”€ */}
      {captions && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(139,92,246,0.22)', color: '#a78bfa' }}>6</div>
            <h3 className="font-bold text-sm tracking-tight">Captions & Hashtags</h3>
            <CheckCircle size={14} style={{ color: '#22c55e' }} className="ml-auto" />
          </div>
          <div className="p-5 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(PLATFORM_LABELS) as Platform[]).filter(p => targetPlatforms.includes(p)).map(p => (
                <button key={p} onClick={() => setActiveCaptionPlatform(p)}
                  className="px-3 py-1.5 text-xs rounded-xl font-bold transition-all"
                  style={{ background: activeCaptionPlatform === p ? accent : 'rgba(255,255,255,0.06)', border: `1px solid ${activeCaptionPlatform === p ? accent : 'rgba(255,255,255,0.08)'}`, color: activeCaptionPlatform === p ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
            {captions[activeCaptionPlatform] && (
              <div className="space-y-2.5">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Caption</p>
                    <button onClick={() => handleCopy(captions[activeCaptionPlatform]?.caption || '')} className="opacity-40 hover:opacity-70 transition-opacity"><Copy size={12} /></button>
                  </div>
                  <p className="text-sm leading-relaxed">{captions[activeCaptionPlatform]?.caption}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Hashtags</p>
                    <button onClick={() => handleCopy((captions[activeCaptionPlatform]?.hashtags || []).join(' '))} className="opacity-40 hover:opacity-70 transition-opacity"><Copy size={12} /></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(captions[activeCaptionPlatform]?.hashtags || []).map((tag, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: `${accent}18`, color: accent }}>
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">CTA</p>
                    <p className="text-xs">{captions[activeCaptionPlatform]?.cta_text}</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">On-screen</p>
                    <p className="text-xs font-bold">{captions[activeCaptionPlatform]?.onscreen_text}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* â”€â”€â”€ EXPORT SUMMARY â”€â”€â”€ */}
      {generatedVideoUrl && captions && (
        <div className="rounded-2xl p-5" style={{ background: `linear-gradient(135deg, ${accent}0d, rgba(34,197,94,0.05))`, border: `1px solid ${accent}28` }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.2)' }}>
              <CheckCircle size={16} style={{ color: '#22c55e' }} />
            </div>
            <h3 className="font-black text-sm">Promo Clip Pack Ready</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {['Lipsync video generated', '9:16 artist image rendered', `Captions for ${targetPlatforms.length} platforms`, 'Hashtags included'].map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-white/60">
                <CheckCircle size={11} style={{ color: '#22c55e' }} /> {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* â”€â”€â”€ HOLLYWOOD POSTER â”€â”€â”€ */}
      {(analysis || generatedImages.length > 0) && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.2)' }}>
              <Crown size={13} style={{ color: '#f97316' }} />
            </div>
            <h3 className="font-bold text-sm tracking-tight">Hollywood Poster</h3>
          </div>
          <div className="p-5">
            <PromoPosterGenerator
              artistId={artistId}
              artistName={artistName || ''}
              songName={selectedSong?.name || selectedSong?.title}
              songGenre={analysis?.detected_genre || selectedSong?.genre}
              analysis={analysis ? {
                viral_hook: analysis.viral_hook,
                story_seed: analysis.story_seed,
                mood: analysis.detected_mood,
                energy_level: String(analysis.energy_level),
              } : undefined}
              referenceImageUrl={referenceImageUrl || artistProfileImage}
              colorGradient={selectedPalette?.gradient}
              colorPromptHint={selectedPalette?.promptHint}
              generatedImageUrl={selectedImageUrl || generatedImages[0]?.url}
              accent={accent}
            />
          </div>
        </div>
      )}

      </div>{/* end p-5 inner wrapper */}
    </motion.div>
  );
}
