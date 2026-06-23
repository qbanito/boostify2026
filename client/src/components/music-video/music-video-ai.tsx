import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { logger } from "@/lib/logger";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { TimelineEditor } from "./timeline/TimelineEditor";
import { PortalContainerContext } from "../../contexts/portal-container-context";
import type { TimelineClip } from "./timeline/TimelineEditor";
import { TimelineClipUnified, ensureCompatibleClip, TimelineItem } from "../timeline/TimelineClipUnified";
import { PreviewImagesModal } from "./PreviewImagesModal";
import { Slider } from "../ui/slider";
import { Card } from "../ui/card";
import Editor from "@monaco-editor/react";
import {
  Video, Loader2, Music2, Image as ImageIcon, Download, Play, Pause,
  ZoomIn, ZoomOut, SkipBack, FastForward, Rewind, Edit, RefreshCcw, Plus, RefreshCw,
  Film, CheckCircle2, Share, User, Upload, X, Check, Activity, ChevronUp, ChevronDown,
  Megaphone, Waves, HelpCircle, Sparkles, Scissors, Clock, Zap
} from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { Dialog, DialogContent } from "../ui/dialog";
import { Progress } from "../ui/progress";
import * as fal from "@fal-ai/serverless-client";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../hooks/use-auth";
import { useAuth as useClerkAuth } from "@clerk/clerk-react"; // Para obtener getToken
import { AnalyticsDashboard } from './analytics-dashboard';
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { VideoGenerator } from "./video-generator";
import { ArtistCustomization } from "./artist-customization";
import { MusicianIntegration } from "./musician-integration";
import { MovementIntegration } from "./movement-integration";
import { LipSyncIntegration } from "./lip-sync-integration";
import { FinalRendering, type UpscaleOptions } from "./final-rendering";
import { ProgressSteps } from "./progress-steps";
import { EnhancedProgressSteps, Step } from "./enhanced-progress-steps";
import { 
  ParticleSystem, 
  AnimatedGradient,
  GlowEffect
} from "./animation-effects";
import { 
  analyzeImage, 
  generateVideoPromptWithRetry, 
  generateMusicVideoScript,
  generateMusicVideoConcept,
  generateThreeConceptProposals,
  type VideoPromptParams 
} from "../../lib/api/openrouter";
import { generateSceneImageWithGemini, type ImageGenerationParams } from "../../lib/api/gemini-nano-image-generator";
import { upscaleVideo } from "../../lib/api/video-service";
import { generateVideoScript as generateVideoScriptAPI } from "../../lib/api/openrouter";
import { batchGenerateMasterVariations, blendMasterAndVariations, detectMasterScenes } from "../../lib/api/master-scene-variations";
import { enrichScriptWithNarrative } from "../../lib/api/narrative-script-enricher";
import { FileText } from "lucide-react";
import fluxService, { FluxModel, FluxTaskType } from "../../lib/api/flux/flux-service";
import { FalModelSelector } from "./fal-model-selector";
import { PaymentSection } from "./payment-section";
import { MyGeneratedVideos } from "./my-generated-videos";
import { generateMusicVideoPrompts } from "../../lib/api/music-video-generator";
import { FAL_VIDEO_MODELS, generateVideoWithFAL, generateMultipleVideos } from "../../lib/api/fal-video-service";
import EnhancedProgressModal from "./enhanced-progress-modal";
import { CreativeOnboardingModal } from "./creative-onboarding-modal";
import { DirectorSelectionModal } from "./director-selection-modal";
import { ConceptSelectionModal } from "./concept-selection-modal";
import { applyLipSync } from "../../lib/api/fal-lipsync";
import { applyPixVerseLipsync, batchPixVerseLipsync, estimateLipsyncCost } from "../../lib/api/pixverse-lipsync";
import { musicVideoProjectService, type MusicVideoProject } from "../../lib/services/music-video-project-service";
import { musicVideoProjectServicePostgres, type MusicVideoProjectPostgres } from "../../lib/services/music-video-project-service-postgres";
import { ProjectManager } from "./project-manager";
import { VideoModelSelector } from "./video-model-selector";
import { getDirectorByName, getDirectorById, type DirectorProfile } from "../../data/directors";
import { uploadImageFromUrl } from "../../lib/firebase-storage";
import { QuickStartTemplates, type QuickStartTemplate } from "./quick-start-templates";
import { SmartSuggestionsPanel } from "./smart-suggestions-panel";
import { 
  detectPerformanceClips, 
  processPerformanceClips,
  getPerformanceSegments
} from "../../lib/services/performance-segment-service";
import {
  type SceneLipsyncConfig,
  batchProcessSceneLipsync
} from "../../lib/api/lipsync-scene-processor";
import { PaymentGateModal } from "./payment-gate-modal";
import { CharacterGenerationModalEnhanced } from "./character-generation-modal-enhanced";
import { analyzeFaceFeatures } from "../../lib/api/face-analyzer";
import { generateMasterCharacterMultiAngle, type MasterCharacterMultiAngle } from "../../lib/api/master-character-generator";
import { generateImagesInParallel, createParallelBatches } from "../../lib/api/parallel-image-generator";
import { EnhancedScenesGallery } from "./EnhancedScenesGallery";
import { SequentialImageGallery } from "./SequentialImageGallery";
import { ensureArtistProfile, saveSongToProfile, updateProfileImages } from "../../lib/auto-profile-service";
import { VideoProcessingModal, type ProcessingConfirmation } from "./VideoProcessingModal";

// Fal.ai configuration
fal.config({
  credentials: (import.meta as any).env.VITE_FAL_API_KEY,
});

/**
 * Retry with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param baseDelay Base delay in ms (default: 1000)
 * @param onRetry Callback called on each retry attempt
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  onRetry?: (attempt: number, delay: number, error: Error) => void
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(`🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        
        if (onRetry) {
          onRetry(attempt + 1, delay, lastError);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logger.error(`❌ All ${maxRetries} retry attempts failed`);
  throw lastError!;
}

// Transcribe audio using backend API (secure)
// Ahora acepta un token opcional para autenticación con Clerk
async function transcribeAudio(file: File, authToken?: string | null) {
  try {
    const formData = new FormData();
    formData.append('audio', file);

    logger.info('🌐 Fetching /api/audio/transcribe...');
    logger.info('🔐 Auth token present:', !!authToken);
    
    // Crear AbortController para timeout de 15 minutos (para archivos grandes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 minutos
    
    // Preparar headers con token de autenticación si está disponible
    const headers: HeadersInit = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    try {
      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
        headers,
        signal: controller.signal,
        credentials: 'include' // También enviar cookies por si acaso
      });
      
      clearTimeout(timeoutId);
      logger.info('📊 Server response:', response.status, response.statusText);

      let data;
      try {
        data = await response.json();
        logger.info('📦 Data received:', data);
      } catch (parseError) {
        logger.error('❌ Error parsing response JSON:', parseError);
        throw new Error('El servidor no respondió correctamente. Por favor, intenta de nuevo.');
      }

      if (!response.ok || !data.success) {
        const errorMsg = data.error || `Error del servidor: ${response.status}`;
        logger.error('❌ Error in server response:', errorMsg);
        
        // Mejorar mensajes de error para el usuario
        if (errorMsg.includes('Connection error') || errorMsg.includes('ECONNRESET')) {
          throw new Error('Error de conexión con OpenAI. Por favor, intenta de nuevo. Si el problema persiste, verifica tu conexión a internet o intenta con un archivo de audio más pequeño.');
        } else if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
          throw new Error('La transcripción está tomando demasiado tiempo. Intenta con un archivo más corto o intenta de nuevo.');
        } else {
          throw new Error(errorMsg);
        }
      }

      if (!data.transcription || !data.transcription.text) {
        logger.error('❌ Server response does not contain transcription');
        throw new Error('Transcription was not generated correctly');
      }

      return data.transcription.text;
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        throw new Error('La transcripción tardó demasiado tiempo (más de 15 minutos). Por favor, intenta con un archivo de audio más corto.');
      }
      throw fetchError;
    }
  } catch (error) {
    logger.error("❌ Error in transcribeAudio:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error transcribing audio');
  }
}

const videoStyles = {
  moods: [
    "Energetic", "Melancholic", "Romantic", "Dramatic",
    "Mysterious", "Cheerful", "Epic", "Minimalist"
  ],
  colorPalettes: [
    "Vibrant", "Monochromatic", "Pastel", "Dark and Contrasted",
    "Warm", "Cool", "Retro", "Neon"
  ],
  characterStyles: [
    "Realistic", "Stylized", "Artistic", "Abstract",
    "Cinematic", "Documentary", "Surrealist", "Vintage"
  ],
  cameraFormats: [
    {
      name: "35mm Standard",
      description: "The classic cinema format, offers a natural and cinematic image"
    },
    {
      name: "IMAX",
      description: "High detail and visual breadth, ideal for epic scenes"
    },
    {
      name: "Super 8mm",
      description: "Vintage and grainy look, perfect for nostalgic scenes"
    },
    {
      name: "Anamorphic",
      description: "Panoramic format with characteristic lens flares"
    },
    {
      name: "PANAVISION",
      description: "High-end cinematic with distinctive bokeh"
    },
    {
      name: "Digital RAW",
      description: "Modern and sharp look with high dynamic range"
    }
  ]
};

const editingStyles = [
  {
    id: "phrases",
    name: "Phrase-based Editing",
    description: "Cuts synchronized with musical phrases",
    duration: { min: 4, max: 8 }
  },
  {
    id: "random_bars",
    name: "Random Bars",
    description: "Varied cuts following the rhythm",
    duration: { min: 2, max: 6 }
  },
  {
    id: "dynamic",
    name: "Dynamic",
    description: "Fast cuts in intense moments, slower in soft parts",
    duration: { min: 1.5, max: 4 }
  },
  {
    id: "slow",
    name: "Slow",
    description: "Long cuts and smooth transitions",
    duration: { min: 5, max: 10 }
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Movie style with variety of durations",
    duration: { min: 3, max: 8 }
  },
  {
    id: "music_video",
    name: "Music Video",
    description: "MTV style with fast and dynamic cuts",
    duration: { min: 1, max: 3 }
  },
  {
    id: "narrative",
    name: "Narrative",
    description: "Cuts that follow the story of the lyrics",
    duration: { min: 4, max: 7 }
  },
  {
    id: "experimental",
    name: "Experimental",
    description: "Unconventional cut patterns",
    duration: { min: 1, max: 6 }
  },
  {
    id: "rhythmic",
    name: "Rhythmic",
    description: "Precise cuts on each beat",
    duration: { min: 1, max: 2 }
  },
  {
    id: "minimalist",
    name: "Minimalist",
    description: "Few cuts, smooth transitions",
    duration: { min: 6, max: 12 }
  }
];

// We use the TimelineItem interface imported previously
// No need to import it again

// We use the TimelineItem interface imported to maintain compatibility
// We define a specific type for our application based on TimelineItem
type MusicVideoTimelineItem = TimelineItem;

const groups = [
  { id: 1, title: "Video", stackItems: true },
  { id: 2, title: "Transitions", stackItems: false },
  { id: 3, title: "Audio", stackItems: false }
];

const fallbackImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E";

interface Director {
  id: string;
  name: string;
  specialty: string;
  style: string;
  experience: string;
  rating: number;
  imageUrl?: string;
}

// 🎯 BUSINESS LOGIC: Free tier limits
const FREE_SCENES_LIMIT = 10; // Free users get 10 scenes preview
const FULL_VIDEO_PRICE = 199; // Price in USD for full video generation

interface MusicVideoAIProps {
  preSelectedDirector?: DirectorProfile | null;
  preFilledArtistName?: string;
  preFilledArtistId?: number; // PostgreSQL ID del artista existente (para no crear duplicados)
  preFilledSongName?: string;
  preFilledAudioUrl?: string;
  preFilledCoverArt?: string;
  preFilledImages?: string[];
}

export function MusicVideoAI({ 
  preSelectedDirector,
  preFilledArtistName,
  preFilledArtistId,
  preFilledSongName,
  preFilledAudioUrl,
  preFilledCoverArt,
  preFilledImages
}: MusicVideoAIProps = {}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { getToken } = useClerkAuth(); // Para obtener token de autenticación
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingShots, setIsGeneratingShots] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [selectedImageModel, setSelectedImageModel] = useState<'gemini-2.5-flash' | 'gemini-pro-3.0'>('gemini-2.5-flash');
  const [transcription, setTranscription] = useState<string>("");
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [showLoadProjectDialog, setShowLoadProjectDialog] = useState(false);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  
  // 🎬 VIDEO FORMAT: Store aspect ratio from onboarding (vertical/horizontal)
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [videoStylePreset, setVideoStylePreset] = useState<string>('realistic');
  
  // DEBUG: Monitor timeline changes
  useEffect(() => {
    logger.info(`🔍 [TIMELINE STATE] Timeline updated: ${timelineItems.length} items`);
    if (timelineItems.length > 0) {
      logger.info('🔍 [TIMELINE STATE] Timeline items:', timelineItems);
    }
  }, [timelineItems]);
  
  // Load saved projects when dialog opens
  useEffect(() => {
    if (showLoadProjectDialog && user?.email) {
      musicVideoProjectServicePostgres.getUserProjects(user.email)
        .then(projects => setSavedProjects(projects))
        .catch(error => {
          logger.error('Error loading projects:', error);
          toast({
            title: "Error",
            description: "Could not load projects",
            variant: "destructive"
          });
        });
    }
  }, [showLoadProjectDialog, user, toast]);

  // Pre-seleccionar director cuando viene desde DirectorsList
  // IMPORTANTE: NO cerramos el onboarding, solo pre-seleccionamos el director
  // El usuario debe pasar por todos los pasos (música, imágenes, director)
  useEffect(() => {
    if (preSelectedDirector) {
      logger.info('🎬 [DIRECTOR PRE-SELECTED]', preSelectedDirector.name);
      
      // Convertir DirectorProfile a Director para compatibilidad con el estado existente
      const directorForState: Director = {
        id: preSelectedDirector.id,
        name: preSelectedDirector.name,
        specialty: preSelectedDirector.specialty,
        experience: preSelectedDirector.experience,
        style: preSelectedDirector.visual_style.description,
        rating: preSelectedDirector.rating,
        imageUrl: undefined
      };
      
      // Solo guardamos el director en el estado
      // El onboarding se abre normalmente y el usuario pasa por todos los pasos
      setVideoStyle(prev => ({
        ...prev,
        selectedDirector: directorForState
      }));
      
      toast({
        title: `Director ${preSelectedDirector.name} pre-seleccionado`,
        description: "Comienza subiendo tu música e imágenes",
      });
    }
  }, [preSelectedDirector, toast]);

  // Pre-fill data from artist profile (song, images, etc.)
  useEffect(() => {
    if (preFilledArtistName || preFilledSongName) {
      logger.info('🎨 [PREFILL] Pre-filling from artist profile:', {
        artistName: preFilledArtistName,
        songName: preFilledSongName,
        audioUrl: preFilledAudioUrl ? 'provided' : 'none',
        coverArt: preFilledCoverArt ? 'provided' : 'none',
        images: preFilledImages?.length || 0
      });
      
      // Set artist and song names
      if (preFilledArtistName) {
        setArtistName(preFilledArtistName);
      }
      if (preFilledSongName) {
        setSongName(preFilledSongName);
      }
      if (preFilledArtistName && preFilledSongName) {
        setProjectName(`${preFilledArtistName} - ${preFilledSongName}`);
      }
      
      // Pre-fill reference images from artist profile
      if (preFilledImages && preFilledImages.length > 0) {
        setArtistReferenceImages(preFilledImages.slice(0, 3)); // Max 3 images
        logger.info('🖼️ [PREFILL] Set', preFilledImages.length, 'reference images');
      } else if (preFilledCoverArt) {
        // Use cover art as fallback for reference image
        setArtistReferenceImages([preFilledCoverArt]);
        logger.info('🖼️ [PREFILL] Set cover art as reference image');
      }
      
      // Download audio from URL and convert to File object for transcription
      // Using proxy endpoint to avoid CORS issues with Firebase Storage
      if (preFilledAudioUrl && !selectedFile) {
        logger.info('🎵 [PREFILL] Downloading audio from URL:', preFilledAudioUrl);
        
        // Determinar si es URL de Firebase Storage (necesita proxy) o URL directa
        const isFirebaseUrl = preFilledAudioUrl.includes('storage.googleapis.com') || 
                              preFilledAudioUrl.includes('firebasestorage.googleapis.com');
        const fetchUrl = isFirebaseUrl 
          ? `/api/proxy/firebase-file?url=${encodeURIComponent(preFilledAudioUrl)}`
          : preFilledAudioUrl; // Intentar directamente si no es Firebase
        
        logger.info(`🎵 [PREFILL] Using ${isFirebaseUrl ? 'proxy' : 'direct'} fetch for audio`);
        
        const fetchAudio = async () => {
          try {
            // Intento 1: usar proxy si es Firebase, o directo si no
            let response = await fetch(fetchUrl);
            
            // Si falla y no era Firebase, intentar con proxy genérico
            if (!response.ok && !isFirebaseUrl) {
              logger.warn('⚠️ [PREFILL] Direct fetch failed, trying proxy...');
              response = await fetch(`/api/proxy/firebase-file?url=${encodeURIComponent(preFilledAudioUrl)}`);
            }
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            if (blob.size < 1000) {
              throw new Error(`Audio file too small (${blob.size} bytes), may be invalid`);
            }
            
            const fileName = preFilledSongName ? `${preFilledSongName}.mp3` : 'song.mp3';
            const audioFile = new File([blob], fileName, { type: blob.type || 'audio/mpeg' });
            setSelectedFile(audioFile);
            
            // 🔧 FIX: También establecer audioUrl para que el TimelineEditor reciba el audio
            // Usar la URL original si es HTTP, o crear blob URL
            if (preFilledAudioUrl.startsWith('http')) {
              setAudioUrl(preFilledAudioUrl);
              logger.info('🔗 [PREFILL] audioUrl set to prefilled URL');
            } else {
              const blobUrl = URL.createObjectURL(blob);
              setAudioUrl(blobUrl);
              logger.info('🔗 [PREFILL] audioUrl set to blob URL');
            }
            
            // 🔧 FIX: Decodificar AudioBuffer para que esté disponible inmediatamente
            try {
              const arrayBuffer = await blob.arrayBuffer();
              if (!audioContext.current) {
                audioContext.current = new AudioContext();
              }
              const buffer = await audioContext.current.decodeAudioData(arrayBuffer);
              setAudioBuffer(buffer);
              logger.info(`🎵 [PREFILL] AudioBuffer decoded: ${buffer.duration.toFixed(1)}s`);
            } catch (decodeErr) {
              logger.warn('⚠️ [PREFILL] Could not decode audio buffer:', decodeErr);
            }
            
            logger.info('✅ [PREFILL] Audio file loaded:', fileName, `(${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
            toast({
              title: "🎵 Audio cargado",
              description: `"${preFilledSongName || 'Song'}" listo para crear video`,
            });
          } catch (error) {
            logger.error('❌ [PREFILL] Failed to download audio:', error);
            toast({
              title: "⚠️ Error cargando audio",
              description: "No se pudo cargar el audio automáticamente. Puedes subirlo manualmente.",
              variant: "destructive",
            });
          }
        };
        
        fetchAudio();
      }
      
      // Show toast that data is pre-filled (onboarding modal will show with pre-filled data)
      if (preFilledArtistName && preFilledSongName) {
        toast({
          title: "Data pre-filled!",
          description: `Creating video for "${preFilledSongName}" by ${preFilledArtistName}. Just upload your photos and click Create!`,
        });
      }
    }
  }, [preFilledArtistName, preFilledSongName, preFilledAudioUrl, preFilledCoverArt, preFilledImages, toast, selectedFile]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [visibleTimeStart, setVisibleTimeStart] = useState<number>(0);
  const [visibleTimeEnd, setVisibleTimeEnd] = useState<number>(60000);
  const [hoveredShot, setHoveredShot] = useState<TimelineItem | null>(null);
  const [selectedShot, setSelectedShot] = useState<TimelineItem | null>(null);
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [videoId, setVideoId] = useState<string>("");
  const [songTitle, setSongTitle] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);
  const [scriptContent, setScriptContent] = useState<string>("");
  const [narrativeSummary, setNarrativeSummary] = useState<string>("");
  const playbackRef = useRef<NodeJS.Timeout | null>(null);
  const visualStyleRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [videoStyle, setVideoStyle] = useState({
    mood: "",
    colorPalette: "",
    characterStyle: "",
    visualIntensity: 50,
    cameraFormat: "",
    narrativeIntensity: 50,
    referenceImage: null as string | null,
    styleDescription: "",
    styleReferenceUrl: "",
    selectedDirector: null as Director | null
  });
  const [selectedEditingStyle, setSelectedEditingStyle] = useState(editingStyles[0]);
  const storage = getStorage();
  const [isSaving, setIsSaving] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | undefined>(undefined);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioDuration = audioBuffer?.duration;
  const [transcriptionWithTimestamps, setTranscriptionWithTimestamps] = useState<{
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  } | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const audioSource = useRef<AudioBufferSourceNode | null>(null);
  // 🎭 FACE CONSISTENCY: Store Master Character promise so image generation can await it
  const masterCharacterPromiseRef = useRef<Promise<any> | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [seed, setSeed] = useState<number>(Math.floor(Math.random() * 1000000));
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [upscaledVideoUrl, setUpscaledVideoUrl] = useState<string | null>(null);
  
  // Estado para las 3 imágenes de referencia del artista (para Nano Banana)
  const [artistReferenceImages, setArtistReferenceImages] = useState<string[]>([]);
  const [isUploadingReferences, setIsUploadingReferences] = useState(false);
  
  // Estados para sistema de pago y FAL
  const [isPaidVideo, setIsPaidVideo] = useState(false);
  // 🎬 KLING 2.5 Turbo Pro: Mejor calidad cinematográfica y fluidez de movimiento
  // Para PERFORMANCE con face: usa KLING O1 Ref2V automáticamente
  const [selectedFalModel, setSelectedFalModel] = useState<string>(FAL_VIDEO_MODELS.KLING_2_5_TURBO_PRO_I2V.id);
  const [isGeneratingFullVideo, setIsGeneratingFullVideo] = useState(false);
  const [showMyVideos, setShowMyVideos] = useState(false);

  // Estados para progreso dinámico
  const [showProgress, setShowProgress] = useState(false);
  const [currentProgressStage, setCurrentProgressStage] = useState<string>("transcription");
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string>("");

  // 🔧 FIX: Throttle progress updates to prevent timeline blinking.
  // Only update state when value actually changes by ≥1% or 500ms have passed.
  const lastProgressRef = useRef({ value: 0, time: 0 });
  const throttledSetProgress = useCallback((newValue: number) => {
    const now = Date.now();
    const rounded = Math.round(newValue);
    const last = lastProgressRef.current;
    // Skip if same rounded value AND less than 500ms since last update
    if (rounded === last.value && now - last.time < 500) return;
    lastProgressRef.current = { value: rounded, time: now };
    setProgressPercentage(rounded);
  }, []);

  // Estados para gestión de proyectos
  const [projectName, setProjectName] = useState<string>("Untitled Project");
  const [artistName, setArtistName] = useState<string>("");
  const [songName, setSongName] = useState<string>("");
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(undefined);
  const [isSavingProject, setIsSavingProject] = useState(false);
  
  // Estados para auto-guardado y mejoras de flujo
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // Estados para generación de videos - KLING 2.5 Turbo Pro para máxima calidad cinematográfica
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>(FAL_VIDEO_MODELS.KLING_V3_PRO_I2V.id);
  const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);
  const [videoGenerationProgress, setVideoGenerationProgress] = useState({ current: 0, total: 0 });
  
  // Estado para modal de onboarding
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showDirectorSelection, setShowDirectorSelection] = useState(false);
  
  // Estado para Timeline fullscreen
  const [isTimelineFullscreen, setIsTimelineFullscreen] = useState(false);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Toggle fullscreen nativo (F11-style) + ocultar nav
  const toggleTimelineFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter native fullscreen on the timeline container
        const el = timelineContainerRef.current || document.documentElement;
        await el.requestFullscreen?.();
        setIsTimelineFullscreen(true);
        // Hide header/nav
        document.body.classList.add('timeline-fullscreen-active');
      } else {
        await document.exitFullscreen?.();
        setIsTimelineFullscreen(false);
        document.body.classList.remove('timeline-fullscreen-active');
      }
    } catch {
      // Fallback: CSS-only fullscreen if API fails
      setIsTimelineFullscreen(prev => {
        const next = !prev;
        if (next) {
          document.body.classList.add('timeline-fullscreen-active');
        } else {
          document.body.classList.remove('timeline-fullscreen-active');
        }
        return next;
      });
    }
  }, []);

  // Sync state when user exits fullscreen via Escape or browser controls
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsTimelineFullscreen(false);
        document.body.classList.remove('timeline-fullscreen-active');
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.body.classList.remove('timeline-fullscreen-active');
    };
  }, []);

  const [showConceptSelection, setShowConceptSelection] = useState(false);
  const [selectedVisualStyle, setSelectedVisualStyle] = useState<string>("");

  // Estados para el modal de progreso de generación de imágenes
  const [generationProgress, setGenerationProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0,
    currentPrompt: '',
    generatedImages: [] as Array<{ id: string; url: string; prompt: string }>,
    status: ''
  });
  
  // Estados para las 3 propuestas de concepto
  const [conceptProposals, setConceptProposals] = useState<any[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<any | null>(null);
  const [isGeneratingConcepts, setIsGeneratingConcepts] = useState(false);
  
  // Estados para Master Character Generation
  const [masterCharacter, setMasterCharacter] = useState<any | null>(null);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [characterGenerationProgress, setCharacterGenerationProgress] = useState(0);
  const [characterGenerationStage, setCharacterGenerationStage] = useState("");
  const [showCharacterGeneration, setShowCharacterGeneration] = useState(false);
  const [characterGenerationComplete, setCharacterGenerationComplete] = useState(false);
  const [pendingConceptGeneration, setPendingConceptGeneration] = useState<{ transcription: string; director: DirectorProfile } | null>(null);
  
  // Lip-sync and performance segments states
  const [isProcessingLipSync, setIsProcessingLipSync] = useState(false);
  const [lipSyncProgress, setLipSyncProgress] = useState({ current: 0, total: 0, message: '' });
  const [performanceSegments, setPerformanceSegments] = useState<Map<number, any>>(new Map());
  
  // 🎤 Performance Recording: URL del video grabado por el artista para motion transfer (DreamActor v2)
  const [performanceVideoUrl, setPerformanceVideoUrl] = useState<string | null>(null);
  
  // Estados para templates rápidos
  const [showQuickStartTemplates, setShowQuickStartTemplates] = useState(false);
  
  // Estados para batch operations
  const [selectedClipIds, setSelectedClipIds] = useState<number[]>([]);
  const [isBatchRegenerating, setIsBatchRegenerating] = useState(false);

  // Payment gate states
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [isGeneratingRemaining, setIsGeneratingRemaining] = useState(false);
  const [hasUserPaid, setHasUserPaid] = useState(false);
  const [videoGenerationsCount, setVideoGenerationsCount] = useState(0);

  // Preview states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewImages, setPreviewImages] = useState<Array<{ id: string; url: string; prompt: string }>>([]);

  // Video Processing Modal states - para confirmar renderizado con email
  const [showVideoProcessingModal, setShowVideoProcessingModal] = useState(false);
  const [videoProcessingComplete, setVideoProcessingComplete] = useState(false);
  const [queuedVideoId, setQueuedVideoId] = useState<number | null>(null);

  // Retry states
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState("");

  // Función para generar 3 propuestas de concepto
  const generateConceptProposals = async () => {
    if (!transcription) {
      toast({
        title: "Error",
        description: "You need to transcribe the audio first to analyze the lyrics",
        variant: "destructive",
      });
      return;
    }

    if (!videoStyle.selectedDirector) {
      toast({
        title: "Error",
        description: "Select a director first",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingConcepts(true);
    setShowProgress(true);
    setCurrentProgressStage("script");
    setProgressPercentage(0);
    setProgressMessage("🎬 Generating 3 creative proposals based on your song's lyrics...");

    try {
      logger.info("🎨 [CONCEPTOS] Generando 3 propuestas CON contexto de letra...");
      logger.info("📝 [LYRICS] Transcripción disponible:", transcription.substring(0, 100) + '...');
      
      const audioDurationInSeconds = audioBuffer?.duration || undefined;
      
      const concepts = await generateThreeConceptProposals(
        transcription, // ✅ La transcripción YA está completa
        videoStyle.selectedDirector.name,
        artistReferenceImages.length > 0 ? artistReferenceImages : undefined,
        audioDurationInSeconds,
        artistName || projectName?.split(' - ')[0] || undefined, // artistName real
        songTitle || songName || selectedFile?.name?.replace(/\.[^/.]+$/, "") || undefined // songTitle real
      );
      logger.info("✅ [CONCEPTOS] 3 propuestas generadas con contexto completo");

      setConceptProposals(concepts);
      setProgressPercentage(100);
      
      // Cambiar a paso 1.7 para mostrar los conceptos
      setCurrentStep(1.7);
      
      toast({
        title: "✅ Conceptos generados",
        description: "Elige el concepto que más te guste para continuar",
      });

    } catch (error) {
      logger.error("Error generando conceptos:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error generando conceptos",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingConcepts(false);
      setShowProgress(false);
      setProgressPercentage(0);
      setProgressMessage("");
    }
  };

  // Función auxiliar para ejecutar la generación del script automáticamente
  const executeScriptGeneration = async (transcriptionText: string, buffer: AudioBuffer) => {
    logger.info('🔵 [EXEC SCRIPT] Función executeScriptGeneration iniciada');
    logger.info('🔵 [EXEC SCRIPT] transcriptionText length:', transcriptionText.length);
    logger.info('🔵 [EXEC SCRIPT] buffer duration:', buffer.duration);
    
    try {
      logger.info('📝 [EXEC SCRIPT] Entrando en try block...');
      setIsTranscribing(false);
      setIsGeneratingScript(true);
      setShowProgress(true);  // ACTIVAR MODAL
      setCurrentProgressStage("script");
      setProgressPercentage(0);
      logger.info('📊 [EXEC SCRIPT] Estados actualizados: showProgress=true, isGeneratingScript=true, stage=script');
      
      // Progreso realista para generación de script
      const startTime = Date.now();
      const estimatedDuration = 45000; // ~45 segundos
      
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const estimatedProgress = Math.min(88, (elapsed / estimatedDuration) * 100);
        throttledSetProgress(estimatedProgress);
      }, 250);
      
      // 🎬 OBTENER PERFIL COMPLETO DEL DIRECTOR desde JSON
      let directorProfile: DirectorProfile | undefined = undefined;
      if (videoStyle.selectedDirector) {
        directorProfile = getDirectorByName(videoStyle.selectedDirector.name);
        if (directorProfile) {
          logger.info(`🎬 [DIRECTOR] Perfil completo cargado: ${directorProfile.name}`);
          logger.info(`📋 [DIRECTOR] Estilo: ${directorProfile.visual_style.description}`);
        } else {
          logger.info(`⚠️ [DIRECTOR] No se encontró perfil JSON para ${videoStyle.selectedDirector.name}, usando datos básicos`);
        }
      }
      
      const audioDurationInSeconds = buffer.duration;
      
      // 🆕 Usar el concepto seleccionado por el usuario
      logger.info('🎨 [CONCEPTO] Usando concepto seleccionado por el usuario...');
      const concept = selectedConcept;
      
      if (concept) {
        logger.info('✅ [CONCEPTO] Concepto seleccionado:', concept);
      } else {
        logger.info('⚠️ [CONCEPTO] No hay concepto seleccionado, continuando sin él');
      }
      
      // PASO 2: Generar script usando el concepto como base Y perfil completo del director
      logger.info('📝 [SCRIPT] Generando script con concepto y perfil del director...');
      logger.info(`🔗 [SCRIPT] audioUrl disponible: ${!!audioUrl}`);
      const scriptResponse = await generateMusicVideoScript(
        transcriptionText, 
        undefined, 
        directorProfile, // Ahora pasamos el perfil completo
        audioDurationInSeconds,
        undefined,
        concept,
        audioUrl // 🎵 Pass audioUrl for backend audio analysis enrichment
      );
      
      clearInterval(progressInterval);
      setProgressPercentage(100);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const parsed = JSON.parse(scriptResponse);
        let scenesToUse = parsed.scenes || (Array.isArray(parsed) ? parsed : []);
        
        // ⚠️ Notify user if fallback script was used (no AI enrichment)
        if (parsed._isFallback) {
          logger.warn('⚠️ [FALLBACK] Script generado con fallback local:', parsed._fallbackReason);
          toast({
            title: "Script generado en modo básico",
            description: "El servidor de IA no respondió. Se generó un guión básico que puedes editar manualmente.",
            variant: "destructive",
          });
        }
        
        // 🆕 ENRIQUECER SCRIPT CON CONTEXTO NARRATIVO
        if (scenesToUse.length > 0) {
          logger.info('📖 [ENRICH] Enriqueciendo script con contexto narrativo...');
          const artistDesc = masterCharacter?.description || 'Professional artist';
          
          try {
            scenesToUse = await enrichScriptWithNarrative(
              transcriptionText,
              scenesToUse,
              directorProfile?.name || 'Creative Director',
              artistDesc,
              concept || null,
              buffer.duration,
              directorProfile || undefined  // 🆕 Pasar perfil completo del director para cinematografía
            );
            logger.info('✅ [ENRICH] Script enriquecido con narrativa y cinematografía DP');
          } catch (enrichError) {
            logger.warn('⚠️ [ENRICH] Error enriqueciendo narrativa, continuando con script original:', enrichError);
          }
        }
        
        const enrichedScript = { ...parsed, scenes: scenesToUse };
        setScriptContent(JSON.stringify(enrichedScript, null, 2));
      } catch (parseError) {
        setScriptContent(scriptResponse);
      }
      
      setCurrentStep(3);
      setIsGeneratingScript(false);
      logger.info('✅ [EXEC SCRIPT] Script generado exitosamente, currentStep=3');
      
      // Continuar automáticamente con la sincronización y generación de imágenes
      logger.info('🚀 [FLUJO AUTOMÁTICO] Paso 3: Sincronización de timeline');
      logger.info('🎯 [SIGUIENTE] Llamando executeSyncAndImageGeneration...');
      await executeSyncAndImageGeneration(scriptResponse, buffer);
      logger.info('✅ [FLUJO AUTOMÁTICO] executeSyncAndImageGeneration completado');
      
    } catch (error) {
      logger.error("❌ [EXEC SCRIPT] Error generating script:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error generating music video script",
        variant: "destructive",
      });
      setIsGeneratingScript(false);
      setShowProgress(false);  // Cerrar modal en caso de error
      setProgressPercentage(0);
      throw error; // Re-lanzar el error para detener el flujo
    }
  };

  // Función auxiliar para sincronizar timeline y generar imágenes automáticamente
  const executeSyncAndImageGeneration = async (script: string, buffer: AudioBuffer) => {
    logger.info('🔵 [SYNC] Función executeSyncAndImageGeneration iniciada');
    
    try {
      logger.info('⏱️ [SYNC] Sincronizando timeline...');
      setCurrentProgressStage("timeline-prep");
      setProgressPercentage(0);
      logger.info('📊 [SYNC] Estados actualizados: stage=timeline-prep');
      
      // Sincronizar con timeline
      const parsedScript = JSON.parse(script);
      let scenes = [];
      if (parsedScript.scenes && Array.isArray(parsedScript.scenes)) {
        scenes = parsedScript.scenes;
      } else if (Array.isArray(parsedScript)) {
        scenes = parsedScript;
      }
      
      logger.info(`🔍 [SYNC DEBUG] Scenes count: ${scenes.length}`);
      logger.info('🔍 [SYNC DEBUG] Scenes data:', scenes);
      
      if (scenes.length > 0) {
        const segments = createSegmentsFromScenes(scenes, buffer.duration);
        logger.info(`🔍 [SYNC DEBUG] Segments created: ${segments.length}`);
        logger.info('🔍 [SYNC DEBUG] Segments data:', segments);
        
        setTimelineItems(segments);
        logger.info('✅ [SYNC DEBUG] setTimelineItems called with', segments.length, 'items');
        
        setCurrentStep(4);
        
        // Scroll automático al módulo 4 "Estilo Visual"
        setTimeout(() => {
          visualStyleRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 500);
      } else {
        logger.error('❌ [SYNC DEBUG] NO SCENES FOUND IN SCRIPT!');
      }
      
      setProgressPercentage(100);
      await new Promise(resolve => setTimeout(resolve, 1000));
      logger.info('✅ [SYNC] Timeline sincronizado exitosamente');
      
      // 🚀 PROGRESIVO: Abrir timeline INMEDIATAMENTE con placeholders
      // Las imágenes se generan en background y actualizan el timeline en tiempo real
      logger.info('🚀 [FLUJO PROGRESIVO] Abriendo timeline con placeholders, generación en background...');
      
      setCurrentStep(5); // Abrir timeline AHORA
      setShowProgress(false);
      
      // 📍 SCROLL AUTOMÁTICO AL TIMELINE
      setTimeout(() => {
        timelineRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }, 800);
      
      toast({
        title: "Timeline listo",
        description: "Generando imágenes en paralelo (4 a la vez)... se actualizan en tiempo real.",
      });
      
      // 🔥 Lanzar generación en background (NO await)
      executeImageGeneration(script).then(() => {
        logger.info('✅ [FLUJO PROGRESIVO] Generación de imágenes completada en background');
      }).catch((err) => {
        logger.error('❌ [FLUJO PROGRESIVO] Error en generación background:', err);
      });
      
      logger.info('✅ [FLUJO PROGRESIVO] Script → Timeline abierto → Imágenes generando en background');
      
    } catch (error) {
      logger.error("❌ [SYNC] Error in sync and image generation:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error synchronizing timeline",
        variant: "destructive",
      });
      setShowProgress(false);
      throw error;
    }
  };

  /**
   * 🎤 MEJORADO: Procesa lip-sync usando PixVerse para clips de PERFORMANCE
   * 
   * NUEVO FLUJO:
   * 1. Detecta clips por shotCategory='PERFORMANCE' o criterios legacy
   * 2. Usa videoUrl existente de Kling O1 si está disponible
   * 3. Aplica PixVerse lip-sync (video-to-video) con audio segmentado
   * 4. Actualiza timeline con lipsyncVideoUrl
   */
  const executePerformanceLipSync = async (script: string, buffer: AudioBuffer) => {
    logger.info('🎤 [PIXVERSE LIP-SYNC] Iniciando procesamiento maestro de lip-sync');
    
    try {
      setIsProcessingLipSync(true);
      setCurrentProgressStage("lip-sync");
      setProgressPercentage(0);
      setShowProgress(true);
      
      const parsedScript = JSON.parse(script);
      let scenes = [];
      if (parsedScript.scenes && Array.isArray(parsedScript.scenes)) {
        scenes = parsedScript.scenes;
      } else if (Array.isArray(parsedScript)) {
        scenes = parsedScript;
      }
      
      // 🎯 Detectar clips de performance (ahora usa shotCategory)
      const performanceClips = detectPerformanceClips({ scenes });
      
      logger.info(`🎤 [PIXVERSE] Detectados ${performanceClips.length} clips de PERFORMANCE para lip-sync`);
      
      if (performanceClips.length === 0) {
        logger.info('ℹ️ [PIXVERSE] No hay clips de performance, omitiendo lip-sync');
        toast({
          title: "Lip-Sync Omitido",
          description: "No se detectaron escenas de PERFORMANCE en el script",
        });
        setIsProcessingLipSync(false);
        setShowProgress(false);
        return;
      }
      
      // 💰 Estimar costo
      const costEstimate = estimateLipsyncCost(performanceClips);
      logger.info(`💰 [PIXVERSE] Costo estimado: $${costEstimate.estimatedCost.toFixed(2)} (${costEstimate.totalSeconds}s @ $${costEstimate.costPerSecond}/s)`);
      
      toast({
        title: "🎤 Procesando Lip-Sync con PixVerse",
        description: `${performanceClips.length} escenas de performance (~$${costEstimate.estimatedCost.toFixed(2)})`,
      });
      
      // 🎬 Convertir performanceClips a SceneLipsyncConfig
      // IMPORTANTE: Incluir videoUrl si existe (de Kling O1)
      const sceneConfigs: SceneLipsyncConfig[] = performanceClips.map(clip => {
        // Buscar el timeline item correspondiente
        const timelineItem = timelineItems.find(item => {
          const itemSceneId = parseInt(item.id.toString().match(/(\d+)$/)?.[1] || '0');
          return itemSceneId === clip.id;
        });
        
        // Prioridad: videoUrl (Kling O1) > generatedImage > imageUrl > masterCharacter
        const videoUrl = timelineItem?.videoUrl || '';
        const imageUrl = (typeof timelineItem?.generatedImage === 'string' ? timelineItem.generatedImage : '') || 
                         timelineItem?.imageUrl || 
                         timelineItem?.firebaseUrl ||
                         masterCharacter?.imageUrl || 
                         '';
        
        logger.info(`📋 [SCENE ${clip.id}] videoUrl: ${videoUrl ? 'YES' : 'NO'}, imageUrl: ${imageUrl ? 'YES' : 'NO'}, shotCategory: ${clip.shotCategory || 'UNKNOWN'}`);
        
        return {
          sceneId: clip.id,
          imageUrl: imageUrl,
          videoUrl: videoUrl, // 🆕 Pasar video de Kling O1 si existe
          startTime: clip.startTime,
          endTime: clip.endTime,
          duration: clip.duration,
          shotType: clip.shotType,
          shotCategory: clip.shotCategory // 🆕 Pasar categoría del script
        };
      });
      
      // Verificar que todas las escenas tengan video o imagen
      const missingMedia = sceneConfigs.filter(c => !c.videoUrl && !c.imageUrl);
      if (missingMedia.length > 0) {
        logger.warn(`⚠️ [PIXVERSE] ${missingMedia.length} escenas sin video ni imagen disponible`);
      }
      
      const userId = user?.uid || 'anonymous';
      
      // 🎤 Procesar lip-sync por escena con PixVerse
      const results = await batchProcessSceneLipsync(
        sceneConfigs,
        buffer,
        userId,
        projectName || 'untitled',
        (current, total, message) => {
          logger.info(`🎤 [PIXVERSE Progress] ${current}/${total}: ${message}`);
          setLipSyncProgress({ current, total, message });
          const progress = (current / total) * 100;
          throttledSetProgress(progress);
        }
      );
      
      logger.info(`✅ [PIXVERSE] Procesados ${results.size} escenas con lip-sync`);
      
      // 🔄 Actualizar timeline con videos lip-synced
      setTimelineItems(prevItems => {
        return prevItems.map(item => {
          const sceneId = parseInt(item.id.toString().match(/(\d+)$/)?.[1] || '0');
          const lipsyncResult = results.get(sceneId);
          
          if (lipsyncResult?.success && lipsyncResult?.lipsyncVideoUrl) {
            logger.info(`🎥 [PIXVERSE] Clip ${sceneId}: lip-sync aplicado exitosamente`);
            return {
              ...item,
              lipsyncVideoUrl: lipsyncResult.lipsyncVideoUrl,
              videoUrl: lipsyncResult.lipsyncVideoUrl, // Reemplazar video original con lip-synced
              lipsyncApplied: true,
              metadata: {
                ...item.metadata,
                hasLipSync: true,
                lipsyncProvider: 'pixverse',
                lipsyncVideoUrl: lipsyncResult.lipsyncVideoUrl,
                originalVideoUrl: item.videoUrl, // Preservar original
                lipsyncAppliedAt: new Date().toISOString()
              }
            };
          }
          
          return item;
        });
      });
      
      const successCount = Array.from(results.values()).filter(r => r.success).length;
      const failedCount = results.size - successCount;
      setProgressPercentage(100);
      
      toast({
        title: "✅ PixVerse Lip-Sync Completado",
        description: `${successCount}/${results.size} escenas de PERFORMANCE sincronizadas${failedCount > 0 ? ` (${failedCount} fallidas)` : ''}`,
      });
      
      setIsProcessingLipSync(false);
      setShowProgress(false);
      
    } catch (error) {
      logger.error('❌ [PIXVERSE LIP-SYNC] Error:', error);
      toast({
        title: "Error en PixVerse Lip-Sync",
        description: error instanceof Error ? error.message : "Error procesando lip-sync con PixVerse",
        variant: "destructive",
      });
      setIsProcessingLipSync(false);
      setShowProgress(false);
    }
  };

  // Helper function to save project state to PostgreSQL
  const saveProjectState = async () => {
    if (!user?.email) {
      logger.warn('⚠️ No user email, cannot save project');
      return null;
    }

    try {
      const imagesGenerated = timelineItems.filter(item => item.generatedImage || item.firebaseUrl).length;
      const videosGenerated = timelineItems.filter(item => item.videoUrl || item.lipsyncVideoUrl).length;
      const firstImageItem = timelineItems.find(item => item.generatedImage || item.firebaseUrl);
      const thumbVal = firstImageItem?.generatedImage || firstImageItem?.firebaseUrl;
      const thumbnail = typeof thumbVal === 'string' ? thumbVal : undefined;

      const result = await musicVideoProjectServicePostgres.saveProject({
        userEmail: user.email,
        projectName: projectName || 'Untitled Project',
        artistName: artistName || projectName.split(' - ')[0] || 'Unknown Artist',
        songName: songName || selectedFile?.name?.replace(/\.[^/.]+$/, '') || 'Untitled Song',
        thumbnail,
        audioUrl: audioUrl || undefined,
        audioDuration: audioBuffer?.duration,
        transcription: transcription || undefined,
        scriptContent: scriptContent || undefined,
        timelineItems,
        selectedDirector: videoStyle.selectedDirector ? {
          id: videoStyle.selectedDirector.id || '',
          name: videoStyle.selectedDirector.name || '',
          specialty: videoStyle.selectedDirector.specialty || '',
          style: videoStyle.selectedDirector.style || '',
          experience: videoStyle.selectedDirector.experience || ''
        } : undefined,
        videoStyle: {
          cameraFormat: videoStyle.cameraFormat,
          mood: videoStyle.mood,
          characterStyle: videoStyle.characterStyle,
          colorPalette: videoStyle.colorPalette,
          visualIntensity: videoStyle.visualIntensity,
          narrativeIntensity: videoStyle.narrativeIntensity,
          selectedDirector: videoStyle.selectedDirector
        },
        artistReferenceImages,
        status: videosGenerated === timelineItems.length && timelineItems.length > 0 ? "completed" : 
                imagesGenerated > 0 ? "generating_images" :
                scriptContent ? "generating_script" : "draft",
        progress: {
          scriptGenerated: !!scriptContent,
          imagesGenerated,
          totalImages: timelineItems.length,
          videosGenerated,
          totalVideos: timelineItems.length
        }
      });

      setCurrentProjectId(String(result.project.id));
      setHasUnsavedChanges(false);
      logger.info('✅ Project saved:', result.project.id);
      return result.project;
    } catch (error) {
      logger.error('❌ Error saving project:', error);
      return null;
    }
  };

  // Función auxiliar para generar imágenes automáticamente
  const executeImageGeneration = async (script?: string, startFrom: number = 1) => {
    logger.info(`🔵 [IMG] Función executeImageGeneration iniciada (startFrom: ${startFrom})`);
    
    try {
      logger.info('🎨 [IMG] Generando imágenes con IA...');
      setIsGeneratingImages(true);
      setIsGeneratingShots(true); // Activar modal de visualización en tiempo real
      setShowProgress(false); // Usar el modal de galería en vez del progress modal
      setCurrentProgressStage("images");
      setProgressPercentage(0);
      logger.info('📊 [IMG] Estados actualizados: isGeneratingShots=true (galería en tiempo real activada)');
      
      const scriptToUse = script || scriptContent;
      if (!scriptToUse) {
        throw new Error("No script content available");
      }
      
      logger.info('📝 [IMG] Script disponible, length:', scriptToUse.length);

      const parsedScript = JSON.parse(scriptToUse);
      let scenes = [];
      if (parsedScript.scenes && Array.isArray(parsedScript.scenes)) {
        scenes = parsedScript.scenes;
      } else if (Array.isArray(parsedScript)) {
        scenes = parsedScript;
      }
      
      if (scenes.length === 0) {
        throw new Error("The script has no valid scenes");
      }

      // Extraer información global del script para contexto
      const narrativeSummaryText = parsedScript.narrative_summary || '';
      const directorName = videoStyle.selectedDirector?.name || 'Cinematic Director';
      const conceptStory = selectedConcept?.story_concept || '';
      
      // Store narrative summary in state for TimelineEditor
      if (narrativeSummaryText) {
        setNarrativeSummary(narrativeSummaryText);
      }
      
      logger.info(`🎬 [IMG] Context: Director=${directorName}, Concept=${conceptStory ? 'Yes' : 'No'}, Narrative=${narrativeSummaryText ? 'Yes' : 'No'}`);

      setProgressPercentage(10);

      // 🎬 NOTE: We use `scenes` directly with full data instead of a destructive mapping.
      // The old `geminiScenes` mapping stripped all Director+DP cinematography data.
      // Now each scene retains: enhanced_prompt, director_name, dp_name, film_emulation, lens_mm, etc.
      const totalAvailableScenes = scenes.length;

      // 🎯 BUSINESS LOGIC: Free tier gets FREE_SCENES_LIMIT, paid users get all scenes
      const maxScenesForUser = hasUserPaid ? totalAvailableScenes : FREE_SCENES_LIMIT;
      const totalScenes = Math.min(totalAvailableScenes, maxScenesForUser);
      
      // Calculate how many images to generate based on payment status
      const imagesToGenerate = totalScenes;
      const endAt = totalScenes;
      
      logger.info(`📸 [IMG] Generation settings (isPaid=${hasUserPaid}): startFrom=${startFrom}, endAt=${endAt}, total=${totalScenes}, maxAllowed=${maxScenesForUser}`);
      
      // Decidir qué endpoint usar basado en si hay imágenes de referencia
      const hasReferenceImages = artistReferenceImages && artistReferenceImages.length > 0;
      
      // 🎭 FACE CONSISTENCY: Wait for Master Character before generating images
      if (masterCharacterPromiseRef.current && !masterCharacter) {
        logger.info('⏳ [IMG] Esperando Master Character antes de generar imágenes...');
        setProgressMessage('🎭 Preparing face consistency references...');
        const mcResult = await masterCharacterPromiseRef.current;
        masterCharacterPromiseRef.current = null; // Clear ref after awaiting
        if (mcResult) {
          logger.info('✅ [IMG] Master Character listo, procediendo con consistencia facial');
        } else {
          logger.warn('⚠️ [IMG] Master Character no disponible, usando referencias raw del artista');
        }
      }
      
      logger.info(`📸 [IMG] Generación SECUENCIAL iniciada. Total escenas: ${totalScenes}`);
      logger.info(`📸 [IMG] Referencias faciales: ${hasReferenceImages ? artistReferenceImages.length : 0}`);
      logger.info(`📸 [IMG] Master Character: ${masterCharacter ? 'Sí' : 'No'}`);
      logger.info(`📐 [IMG] Aspect Ratio configurado: ${videoAspectRatio}`);
      
      if (hasReferenceImages) {
        logger.info(`🖼️ [IMG] URLs de referencia:`, artistReferenceImages.map((url, i) => `[${i}] ${url.substring(0, 80)}...`));
      }
      
      // 🆕 MASTER SCENE VARIATIONS SYSTEM
      let masterImageUrls = new Map<string, string>();
      let scenesWithVariations: Map<string, any> = new Map();
      let masterSceneIds: string[] = [];
      
      // Inicializar el estado de progreso del modal
      setGenerationProgress({
        current: startFrom - 1,
        total: totalScenes,
        percentage: 0,
        currentPrompt: 'Iniciando generación...',
        generatedImages: [],
        status: 'Preparando generación de imágenes...'
      });
      
      // 🚀 GENERACIÓN PARALELA POR LOTES DE 4
      // 🎬 CRITICAL: Siempre usar FAL nano-banana con soporte de referencias faciales
      const endpoint = '/api/fal/nano-banana/generate-with-face';
      
      let generatedCount = 0;
      
      // 🔥 Marcar todos los clips como 'generating' al iniciar
      setTimelineItems(prevItems => prevItems.map((item, idx) => {
        if (idx >= startFrom - 1 && idx < endAt) {
          return { ...item, generationStatus: 'generating' as const };
        }
        return item;
      }));
      
      // Helper: generar UNA imagen para una escena individual
      const generateSingleImage = async (i: number): Promise<void> => {
        const sceneIndex = i + 1;
        
        logger.info(`🎨 [IMG ${sceneIndex}/${totalScenes}] Generando imagen para escena...`);
        
        try {
          // Obtener la escena original del JSON con todos los campos narrativos + cinematografía
          const originalScene = scenes[i];
          
          // Construir prompt CINEMATOGRÁFICO RICO usando Director+DP data
          const shotCategory = originalScene.shot_category || 'STORY';
          const narrativeContext = originalScene.narrative_context || '';
          const visualDescription = originalScene.visual_description || originalScene.description || '';
          const emotion = originalScene.emotion || originalScene.mood || 'emotional';
          const shotType = originalScene.shot_type || 'medium-shot';
          
          // 🎬 DIRECTOR+DP: Extraer datos cinematográficos del JSON Maestro
          const sceneDirectorName = originalScene.director_name || directorName;
          const dpName = originalScene.dp_name || '';
          const filmEmulation = originalScene.film_emulation || originalScene.color_grading || '';
          const lensMm = originalScene.lens_mm || '';
          const sceneAperture = originalScene.aperture || '';
          const lightingKey = originalScene.lighting_key || originalScene.lighting || 'natural';
          const directorSignature = originalScene.director_signature || '';
          
          // 🎬 PRIORITY: Use enhanced_prompt from backend cinematography-service if available
          // This prompt contains the full Director+DP shot library specs, film emulation, grain, etc.
          let prompt: string;
          
          if (originalScene.enhanced_prompt && originalScene.enhanced_prompt.length > 50) {
            // ✅ USE THE RICH enhanced_prompt from prepareSceneForImageGeneration()
            // 800 chars preserves TECHNICAL SPECS section (lens, aperture, film emulation)
            const enhancedBase = originalScene.enhanced_prompt.substring(0, 800);
            const shotTypeDescription = 
              shotCategory === 'PERFORMANCE' ? 'Artist performing/singing on stage, facing camera' :
              shotCategory === 'B-ROLL' ? 'Cinematic wide establishing shot, no people, atmospheric' :
              'Narrative cinematic scene';
            // Visual-first ordering: scene type → director vision → technical specs
            prompt = `${shotTypeDescription}. ${enhancedBase}. Avoid: blurry, deformed hands, extra fingers, text overlay, watermark, low quality.`;
            logger.info(`🎬 [IMG ${sceneIndex}] Using ENHANCED PROMPT from Director+DP pipeline (${enhancedBase.length} chars)`);
          } else {
            // Fallback: Build a cinematographically rich prompt from individual fields
            const shotTypeDescription = 
              shotCategory === 'PERFORMANCE' ? 'Artist performing/singing, facing camera' :
              shotCategory === 'B-ROLL' ? 'Cinematic establishing shot, no people' :
              'Narrative scene';
            
            // Build Director+DP style string
            const dpStyle = dpName 
              ? `${sceneDirectorName} directing, ${dpName} cinematography` 
              : `${sceneDirectorName} style`;
            const filmLook = filmEmulation ? `, ${filmEmulation} film look` : '';
            const lensSpec = lensMm ? `, ${lensMm} lens` : '';
            const apertureSpec = sceneAperture ? ` at ${sceneAperture}` : '';
            const signatureStyle = directorSignature ? `, ${directorSignature}` : '';
            
            prompt = `${shotTypeDescription}. ${visualDescription}. ${emotion} mood, ${lightingKey} lighting, ${shotType}${lensSpec}${apertureSpec}. ${dpStyle}${signatureStyle}${filmLook}, professional music video frame, 8K quality. Avoid: blurry, deformed hands, extra fingers, text overlay, watermark.`;
            logger.info(`🎬 [IMG ${sceneIndex}] Using ENRICHED fallback prompt with DP specs`);
          }
          
          logger.info(`📝 [IMG ${sceneIndex}] Shot: ${shotCategory}, Director: ${sceneDirectorName}, DP: ${dpName || 'N/A'}, Film: ${filmEmulation || 'N/A'}`);
          logger.info(`📝 [IMG ${sceneIndex}] Prompt (first 150): ${prompt.substring(0, 150)}...`);
          
          // Detectar si debe usar referencia del artista usando los nuevos campos
          // 🎭 CONSISTENCY FIX: Force B-ROLL to NEVER use artist reference (prevents unwanted face artifacts)
          const rawUseArtistReference = originalScene.use_artist_reference !== false;
          const useArtistReference = shotCategory === 'B-ROLL' ? false : rawUseArtistReference;
          const referenceUsage = shotCategory === 'B-ROLL' 
            ? 'none' 
            : (originalScene.reference_usage || 
               (shotCategory === 'PERFORMANCE' ? 'full_performance' : 'none'));
          
          if (shotCategory === 'B-ROLL' && rawUseArtistReference) {
            logger.info(`🚫 [SCENE ${sceneIndex}] B-ROLL override: LLM set use_artist_reference=true, forcing to false`);
          }
          
          // Determinar si usar la imagen de referencia basado en la lógica avanzada
          const shouldUseReference = useArtistReference && 
                                    (referenceUsage !== 'none') &&
                                    (masterCharacter || hasReferenceImages);
          
          // 🎭 MÚLTIPLES ÁNGULOS: Usar todos los ángulos disponibles del masterCharacter
          // nano-banana/edit acepta múltiples imágenes de referencia para mejor consistencia
          let referenceToUse: string[] = [];
          
          if (shouldUseReference) {
            if (masterCharacter) {
              // Priorizar los ángulos del mainCharacter si existen
              if (masterCharacter.mainCharacter?.angles && masterCharacter.mainCharacter.angles.length > 0) {
                // Usar todos los ángulos disponibles (frontal, left, right, three-quarter)
                referenceToUse = masterCharacter.mainCharacter.angles
                  .filter((angle: any) => angle.imageUrl)
                  .map((angle: any) => angle.imageUrl);
                logger.info(`🎭 [SCENE ${sceneIndex}] Using ${referenceToUse.length} angle references from masterCharacter`);
              } else if (masterCharacter.imageUrl) {
                // Fallback a la imagen principal
                referenceToUse = [masterCharacter.imageUrl];
              }
            } else if (artistReferenceImages && artistReferenceImages.length > 0) {
              // Usar las imágenes de referencia del artista
              referenceToUse = artistReferenceImages.slice(0, 4); // Máximo 4 referencias
            }
          }
          
          
          logger.info(`🎭 [SCENE ${sceneIndex}] Category: ${shotCategory}, Reference Usage: ${referenceUsage}, References: ${referenceToUse.length}`);
          logger.info(`📐 [SCENE ${sceneIndex}] Using aspect ratio: ${videoAspectRatio}`);
          
          const requestBody = { 
            prompt: prompt,
            sceneId: sceneIndex,
            referenceImages: referenceToUse,
            aspectRatio: videoAspectRatio, // Use the videoAspectRatio from state
            shotCategory: shotCategory, // 🎬 Server uses this for smarter face handling
            directorName: sceneDirectorName || directorName || '',
          };
          
          // 🔄 RETRY: Usar retry con exponential backoff para mayor robustez
          const data = await retryWithBackoff(
            async () => {
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
              }

              return await response.json();
            },
            3, // 3 reintentos
            2000, // 2 segundos de delay inicial
            (attempt, delay, error) => {
              // Callback para mostrar feedback visual
              setIsRetrying(true);
              setRetryAttempt(attempt);
              setRetryMessage(`Retrying scene ${sceneIndex}... Attempt ${attempt}/3 (${delay}ms delay)`);
              logger.warn(`🔄 [IMG ${sceneIndex}] Retry ${attempt}/3: ${error.message}`);
            }
          );
          
          // Limpiar estado de retry después de éxito
          setIsRetrying(false);
          setRetryAttempt(0);
          setRetryMessage("");
          
          const isValidImageUrl = data.imageUrl && 
                                  typeof data.imageUrl === 'string' && 
                                  (data.imageUrl.startsWith('http') || data.imageUrl.startsWith('data:image/'));
          
          // Fixed: Check if we got an image URL regardless of success field
          const hasValidUrl = isValidImageUrl && data.imageUrl;
          
          if (hasValidUrl) {
            generatedCount++;
            logger.info(`✅ [IMG ${sceneIndex}/${totalScenes}] Image generated successfully`);
            
            // 💾 GUARDAR EN FIREBASE STORAGE para persistencia
            let permanentImageUrl = data.imageUrl;
            if (user?.uid) {
              try {
                logger.info(`📤 [FIREBASE ${sceneIndex}] Subiendo imagen a Firebase Storage...`);
                permanentImageUrl = await uploadImageFromUrl(data.imageUrl, user?.id, projectName);
                logger.info(`✅ [FIREBASE ${sceneIndex}] Imagen guardada permanentemente`);
                
                // 🎨 AUTO-PERFIL: Actualizar imágenes de perfil con primera imagen de alta calidad
                if (sceneIndex === 1 || sceneIndex === 2) {
                  try {
                    const imageData = sceneIndex === 1 
                      ? { profileImageUrl: permanentImageUrl } // Primera imagen como foto de perfil
                      : { coverImageUrl: permanentImageUrl }; // Segunda imagen como banner
                    
                    await updateProfileImages({
                      ...imageData,
                      onlyIfEmpty: true // Solo actualizar si el usuario no tiene imágenes
                    });
                    logger.info(`✅ Imagen de perfil actualizada automáticamente (escena ${sceneIndex})`);
                  } catch (profileImageError) {
                    // No bloqueamos el flujo
                    logger.warn('⚠️ Error actualizando imagen de perfil (no crítico):', profileImageError);
                  }
                }
              } catch (uploadError) {
                logger.warn(`⚠️ [FIREBASE ${sceneIndex}] Error subiendo a Firebase, usando URL temporal:`, uploadError);
              }
            }
            
            // Actualizar el progreso del modal
            setGenerationProgress(prev => ({
              ...prev,
              current: sceneIndex,
              total: totalScenes,
              percentage: Math.round((sceneIndex / totalScenes) * 100),
              currentPrompt: originalScene.scene || originalScene.visual_description || 'Generating...',
              generatedImages: [
                ...prev.generatedImages,
                {
                  id: `scene-${sceneIndex}`,
                  url: permanentImageUrl,
                  prompt: originalScene.scene || originalScene.visual_description || `Scene ${sceneIndex}`
                }
              ],
              status: `Generando imagen ${sceneIndex} de ${totalScenes}...`
            }));
            
            // Actualizar el timeline
            setTimelineItems(prevItems => {
              return prevItems.map(item => {
                const sceneNumberMatch = item.id.toString().match(/(\d+)$/);
                if (!sceneNumberMatch) return item;
                
                const itemSceneNumber = parseInt(sceneNumberMatch[1]);
                
                if (itemSceneNumber === sceneIndex) {
                  logger.info(`🖼️ [IMG ${sceneIndex}] ✅ Actualizando timeline item ${item.id}`);
                  
                  // Determinar valores de metadata basados en el contexto
                  const itemIsPerformanceScene = item.metadata?.role === 'performance' || 
                                                  item.shotType?.toLowerCase().includes('performance') ||
                                                  shotCategory === 'PERFORMANCE';
                  const itemUsesMasterCharacter = !!shouldUseReference && !!masterCharacter;
                  
                  return {
                    ...item,
                    imageUrl: permanentImageUrl,
                    thumbnail: permanentImageUrl,
                    url: permanentImageUrl,
                    generatedImage: permanentImageUrl,
                    generationStatus: 'done' as const,
                    metadata: {
                      ...item.metadata,
                      isGeneratedImage: true,
                      isPerformanceScene: itemIsPerformanceScene,
                      usesMasterCharacter: itemUsesMasterCharacter,
                      masterCharacterUrl: itemUsesMasterCharacter ? masterCharacter.imageUrl : undefined,
                      imageGeneratedAt: new Date().toISOString(),
                      scene_id: sceneIndex,
                      shot_type: item.shotType || item.metadata?.shot_type,
                      role: item.metadata?.role || 'performance'
                    }
                  };
                }
                
                return item;
              });
            });
            
            // 🆕 GUARDAR URL PARA MASTER SCENE VARIATIONS
            if (!masterImageUrls.has(originalScene.scene_id || `scene-${sceneIndex}`)) {
              masterImageUrls.set(originalScene.scene_id || `scene-${sceneIndex}`, permanentImageUrl);
            }
            
            // Actualizar progreso general
            const progress = 30 + ((generatedCount / totalScenes) * 60);
            throttledSetProgress(progress);
            
            // 💾 AUTO-SAVE: Guardar progreso cada 5 imágenes generadas para evitar pérdida de trabajo
            if (generatedCount > 0 && generatedCount % 5 === 0 && user?.email) {
              logger.info(`💾 [AUTO-SAVE] Guardando progreso automático (${generatedCount} imágenes)...`);
              try {
                await saveProjectState();
                logger.info(`✅ [AUTO-SAVE] Progreso guardado exitosamente`);
              } catch (saveError) {
                logger.warn(`⚠️ [AUTO-SAVE] Error guardando progreso (no crítico):`, saveError);
              }
            }
            
          }
          
        } catch (error) {
          logger.error(`❌ [IMG ${sceneIndex}] Error en generación:`, error);
          // Marcar como error en el timeline
          setTimelineItems(prevItems => prevItems.map(item => {
            const match = item.id.toString().match(/(\d+)$/);
            if (match && parseInt(match[1]) === sceneIndex) {
              return { ...item, generationStatus: 'error' as const };
            }
            return item;
          }));
        }
      };
      
      // 🚀 EJECUTAR POR LOTES DE 4 EN PARALELO
      const BATCH_SIZE = 4;
      const allIndices = [];
      for (let i = startFrom - 1; i < endAt; i++) {
        allIndices.push(i);
      }
      
      logger.info(`🚀 [IMG] Generación PARALELA por lotes de ${BATCH_SIZE}. Total: ${allIndices.length} escenas`);
      
      for (let batchStart = 0; batchStart < allIndices.length; batchStart += BATCH_SIZE) {
        const batch = allIndices.slice(batchStart, batchStart + BATCH_SIZE);
        logger.info(`🎬 [BATCH ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(allIndices.length / BATCH_SIZE)}] Procesando escenas: ${batch.map(i => i + 1).join(', ')}`);
        
        // Ejecutar batch en paralelo
        await Promise.all(batch.map(i => generateSingleImage(i)));
        
        logger.info(`✅ [BATCH] Lote completado. Total generadas: ${generatedCount}/${totalScenes}`);
      }
      
      logger.info(`✅ [IMG] Generación completada: ${generatedCount} imágenes generadas`);

      setProgressPercentage(100);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 🎨 NUEVO: Guardar imágenes generadas en la galería del perfil del artista
      if (generatedCount > 0 && user?.email) {
        try {
          logger.info('📸 [GALLERY] Guardando imágenes generadas en galería del perfil...');
          
          // Obtener el artistProfileId desde el proyecto guardado
          const projects = await musicVideoProjectServicePostgres.listProjects(user.email);
          const currentProject = projects.find(p => p.projectName === projectName);
          
          if (currentProject?.artistProfileId) {
            // Recopilar imágenes generadas con metadata
            const sceneImages = timelineItems
              .filter(item => item.generatedImage || item.imageUrl)
              .map((item, index) => ({
                url: item.generatedImage || item.imageUrl || '',
                sceneNumber: index + 1,
                shotType: item.shotType || item.metadata?.shot_type || undefined,
                mood: item.metadata?.mood || undefined,
                timestamp: item.start || undefined,
                description: item.imagePrompt?.substring(0, 200) || `Scene ${index + 1}`
              }))
              .filter(img => img.url.length > 0);
            
            if (sceneImages.length > 0) {
              const { addSceneImagesToProfile } = await import('@/lib/api/artist-profile-service');
              
              const result = await addSceneImagesToProfile({
                artistProfileId: currentProject.artistProfileId,
                projectId: currentProject.id,
                sceneImages
              });
              
              if (result.success) {
                logger.info(`✅ [GALLERY] ${result.imagesAdded} imágenes agregadas a la galería del perfil`);
              }
            }
          }
        } catch (galleryError) {
          logger.warn('⚠️ [GALLERY] Error agregando imágenes a la galería (no crítico):', galleryError);
        }
      }
      
      // Only process lip-sync if we've completed all images
      if (audioBuffer && user?.uid && generatedCount > 0 && endAt === totalScenes) {
        logger.info('🎤 [LIP-SYNC] Detectando clips de performance para lip-sync...');
        await executePerformanceLipSync(scriptToUse, audioBuffer);
      }
      
      // Mostrar mensaje de éxito
      toast({
        title: "¡Proceso Completado!",
        description: `${generatedCount + startFrom - 1} imágenes generadas exitosamente`,
      });

      logger.info('✅ [IMG] Imágenes generadas exitosamente');
      
      // Timeline ya abierto en executeSyncAndImageGeneration — solo limpiar estados
      setIsGeneratingImages(false);
      setIsGeneratingShots(false); // Cerrar modal de galería en tiempo real
      setShowProgress(false);
      setProgressPercentage(0);
      
      // Limpiar el estado de progreso
      setGenerationProgress({
        current: 0,
        total: 0,
        percentage: 0,
        currentPrompt: '',
        generatedImages: [],
        status: ''
      });
      
      // 📍 SCROLL AUTOMÁTICO AL TIMELINE
      setTimeout(() => {
        timelineRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }, 500);
      
      // 💾 IMMEDIATE SAVE after generation completes to ensure no work is lost
      if (user?.email) {
        logger.info('💾 [SAVE] Guardando proyecto tras finalizar generación de imágenes...');
        try {
          await saveProjectState();
          logger.info('✅ [SAVE] Proyecto guardado tras generación');
        } catch (saveErr) {
          logger.warn('⚠️ [SAVE] Error guardando tras generación (no crítico):', saveErr);
        }
      }
      
      // 🎬 AUTO-OPEN VIDEO PROCESSING MODAL
      // Después de generar todas las imágenes, abrir automáticamente el modal
      // para que el usuario confirme y empiece la generación de video
      // Usamos generatedCount del proceso actual (ya calculado arriba) en vez de timelineItems
      // porque el estado de React puede no estar actualizado aún
      const finalGeneratedCount = generatedCount + startFrom - 1;
      
      logger.info(`🎬 [AUTO-VIDEO] Check: generatedCount=${finalGeneratedCount}, currentProjectId=${currentProjectId}`);
      
      // Abrimos el modal si hay al menos 3 imágenes generadas
      // El currentProjectId puede no estar seteado aún si es un proyecto nuevo
      if (finalGeneratedCount >= 3) {
        logger.info('🎬 [AUTO-VIDEO] Abriendo modal de procesamiento de video automáticamente...');
        
        // Esperar un momento para que el usuario vea el resultado
        setTimeout(() => {
          setShowVideoProcessingModal(true);
          toast({
            title: "🎬 ¡Listo para crear tu video!",
            description: "Confirma tus datos para empezar la generación del video",
          });
        }, 2000);
      } else {
        logger.warn(`⚠️ [AUTO-VIDEO] No se abre modal: generatedCount=${finalGeneratedCount} (mínimo 3)`);
      }
      
    } catch (error) {
      logger.error("❌ [IMG] Error generating images:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error generating images",
        variant: "destructive",
      });
      setIsGeneratingImages(false);
      setIsGeneratingShots(false); // Cerrar modal en caso de error
      setShowProgress(false);
      setProgressPercentage(0);
    }
  };

  // Handle payment success - unlock full video generation
  const handlePaymentSuccess = async (stripePaymentId?: string) => {
    logger.info('💳 [PAYMENT] Payment successful - unlocking full video generation');
    
    // Mark user as paid
    setHasUserPaid(true);
    
    // Close payment gate modal
    setShowPaymentGate(false);
    
    // 💾 PERSIST PAYMENT STATUS: Save to database immediately
    if (currentProjectId && user?.email) {
      try {
        await fetch('/api/music-video-projects/mark-paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: Number(currentProjectId),
            userEmail: user.email,
            paidAmount: FULL_VIDEO_PRICE,
            stripePaymentId: stripePaymentId || undefined
          })
        });
        logger.info('💾 [PAYMENT] Payment status persisted to database');
      } catch (error) {
        logger.error('❌ [PAYMENT] Error persisting payment status:', error);
      }
    }
    
    toast({
      title: "🎉 Payment Successful!",
      description: "Generating your complete music video now...",
    });
    
    // Start generating remaining scenes
    await handleGenerateRemainingScenes();
  };
  
  /**
   * 🎬 FULL VIDEO: Generates remaining scenes after payment
   */
  const handleGenerateRemainingScenes = async () => {
    if (!scriptContent || !audioBuffer) {
      toast({
        title: "Error",
        description: "Missing script or audio data",
        variant: "destructive",
      });
      return;
    }
    
    setIsGeneratingRemaining(true);
    
    try {
      // Parse full script
      const parsedScript = JSON.parse(scriptContent);
      let allScenes = parsedScript.scenes || [];
      
      // Get scenes starting from FREE_SCENES_LIMIT + 1
      const remainingScenes = allScenes.slice(FREE_SCENES_LIMIT);
      
      logger.info(`🎬 [FULL VIDEO] Generating ${remainingScenes.length} remaining scenes...`);
      
      toast({
        title: "🎬 Generating Full Video",
        description: `Creating ${remainingScenes.length} remaining scenes...`,
      });
      
      // Create remaining segments
      const remainingSegments = createSegmentsFromScenes(remainingScenes, audioBuffer.duration);
      
      // Add to existing timeline items
      setTimelineItems(prev => [...prev, ...remainingSegments]);
      
      // Generate images for remaining segments
      setIsGeneratingShots(true);
      
      for (let i = 0; i < remainingSegments.length; i++) {
        const item = remainingSegments[i];
        
        setGenerationProgress({
          current: i + 1,
          total: remainingSegments.length,
          percentage: Math.round(((i + 1) / remainingSegments.length) * 100),
          currentPrompt: item.imagePrompt || '',
          generatedImages: [],
          status: `Generating scene ${FREE_SCENES_LIMIT + i + 1}...`
        });
        
        try {
          const imageUrl = await generateImageForSegment(item);
          
          if (imageUrl) {
            setTimelineItems(prev => prev.map(timelineItem =>
              timelineItem.id === item.id
                ? { ...timelineItem, generatedImage: imageUrl, firebaseUrl: imageUrl }
                : timelineItem
            ));
          }
        } catch (error) {
          logger.error(`Error generating scene ${item.id}:`, error);
        }
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      logger.info('✅ [FULL VIDEO] All images generated, starting video conversion...');
      
      // Auto-convert all remaining scenes to videos
      await handleAutoConvertToVideos();
      
      toast({
        title: "🎉 Full Video Complete!",
        description: "Your complete music video is ready for export!",
      });
      
    } catch (error) {
      logger.error('❌ Error generating remaining scenes:', error);
      toast({
        title: "Error",
        description: "Failed to generate remaining scenes",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRemaining(false);
      setIsGeneratingShots(false);
    }
  };

  // Handle preview approval - continue generating remaining images
  const handlePreviewApprove = async () => {
    logger.info('✅ [PREVIEW] User approved, continuing generation...');
    setShowPreviewModal(false);
    
    toast({
      title: "Preview Approved!",
      description: "Continuing generation for remaining images...",
    });
    
    // Continue from image 11
    await executeImageGeneration(scriptContent, 11);
  };

  // Handle preview rejection - stop and allow adjustments
  const handlePreviewReject = () => {
    logger.info('❌ [PREVIEW] User rejected, stopping generation');
    setShowPreviewModal(false);
    setIsGeneratingImages(false);
    setIsGeneratingShots(false);
    
    toast({
      title: "Generation Stopped",
      description: "You can adjust settings and try again",
    });
  };

  // Función para manejar el resultado del onboarding
  const handleOnboardingComplete = useCallback(async (
    audioFile: File, 
    referenceImages: string[], 
    artistName: string,
    songName: string,
    aspectRatio: string,
    videoStyle: string,
    conceptBrief?: string,
    performanceVideoBlob?: Blob
  ) => {
    logger.info('🎉 Onboarding completed:', {
      audio: audioFile.name,
      imagesCount: referenceImages.length,
      artistName,
      songName,
      aspectRatio,
      videoStyle,
      conceptBrief: conceptBrief || 'No concept provided',
      hasPerformanceVideo: !!performanceVideoBlob
    });
    
    // Set artist name, song name, reference images, and audio file
    setProjectName(`${artistName} - ${songName}`);
    setArtistReferenceImages(referenceImages);
    setSelectedFile(audioFile);
    
    // 🔧 FIX: Crear blob URL inmediatamente para que el TimelineEditor tenga audio
    // Sin esto, audioUrl queda null y el timeline nunca muestra el audio
    if (!audioUrl) {
      const immediateUrl = URL.createObjectURL(audioFile);
      setAudioUrl(immediateUrl);
      logger.info('🔗 [ONBOARDING] audioUrl set to immediate blob URL');
    }
    
    // 🎬 STORE VIDEO FORMAT: Save aspect ratio for all generators
    setVideoAspectRatio(aspectRatio as '16:9' | '9:16' | '1:1');
    setVideoStylePreset(videoStyle);
    logger.info(`📐 Video format set: ${aspectRatio} (${aspectRatio === '9:16' ? 'VERTICAL' : aspectRatio === '1:1' ? 'SQUARE' : 'HORIZONTAL'})`);
    
    // Store concept brief if provided
    if (conceptBrief) {
      logger.info('💡 Concept Brief:', conceptBrief);
    }
    
    // Preparar el audio buffer
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        if (!audioContext.current) {
          audioContext.current = new AudioContext();
        }
        const buffer = await audioContext.current.decodeAudioData(e.target.result);
        setAudioBuffer(buffer);
      }
    };
    reader.readAsArrayBuffer(audioFile);
    
    // 🔧 FIX: Subir audio a Firebase en background para reemplazar blob URL con URL permanente
    const uploadOnboardingAudio = async () => {
      try {
        const storage = getStorage();
        const timestamp = Date.now();
        const sanitizedFileName = audioFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const audioRef = ref(storage, `music-videos/audio/${user?.uid || 'anonymous'}/${timestamp}_${sanitizedFileName}`);
        const snapshot = await uploadBytes(audioRef, audioFile);
        const firebaseAudioUrl = await getDownloadURL(snapshot.ref);
        setAudioUrl(firebaseAudioUrl);
        logger.info('✅ [ONBOARDING] Audio subido a Firebase:', firebaseAudioUrl.substring(0, 80));
      } catch (uploadErr) {
        logger.warn('⚠️ [ONBOARDING] Firebase upload failed, keeping blob URL:', uploadErr);
      }
    };
    uploadOnboardingAudio();
    
    // 🎤 Upload performance video to Firebase if provided (for DreamActor v2 motion transfer)
    if (performanceVideoBlob) {
      const uploadPerformanceVideo = async () => {
        try {
          const storage = getStorage();
          const timestamp = Date.now();
          const videoRef = ref(storage, `music-videos/performance/${user?.uid || 'anonymous'}/${timestamp}_performance.webm`);
          const snapshot = await uploadBytes(videoRef, performanceVideoBlob);
          const firebaseVideoUrl = await getDownloadURL(snapshot.ref);
          setPerformanceVideoUrl(firebaseVideoUrl);
          logger.info('✅ [ONBOARDING] Performance video subido a Firebase:', firebaseVideoUrl.substring(0, 80));
        } catch (uploadErr) {
          logger.warn('⚠️ [ONBOARDING] Performance video upload failed:', uploadErr);
        }
      };
      uploadPerformanceVideo();
    }
    
    // Cerrar el modal de onboarding y mostrar el modal de selección de director
    setShowOnboarding(false);
    setShowDirectorSelection(true);
    
    logger.info('✅ [ONBOARDING COMPLETADO] Mostrando modal de selección de director');
  }, [audioUrl, user?.uid, toast]);

  // Handler para cuando se selecciona director y estilo
  /**
   * Handler para aplicar template rápido
   */
  const handleTemplateSelection = useCallback((template: QuickStartTemplate) => {
    logger.info('📦 Aplicando template:', template.name);
    
    // Buscar director por nombre
    const director = getDirectorByName(template.director.name);
    
    if (director) {
      setVideoStyle(prev => ({
        ...prev,
        mood: template.visualStyle.mood,
        colorPalette: template.visualStyle.colorPalette,
        cameraFormat: template.visualStyle.cameraFormat,
        visualIntensity: template.visualStyle.visualIntensity,
        selectedDirector: {
          id: director.id,
          name: director.name,
          specialty: director.specialty,
          style: director.visual_style?.description || template.director.style,
          experience: director.experience || 'Professional',
          rating: director.rating
        }
      }));
      
      // Aplicar estilo de edición
      const editingStyle = editingStyles.find(s => s.id === template.editingStyle.id);
      if (editingStyle) {
        setSelectedEditingStyle(editingStyle);
      }
      
      toast({
        title: "Template aplicado",
        description: `Configuración "${template.name}" lista para usar`,
      });
      
      logger.info('✅ Template aplicado exitosamente');
    } else {
      toast({
        title: "Error",
        description: "No se pudo encontrar el director del template",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Handler para generar master character con soporte multi-ángulo y casting
  const handleGenerateMasterCharacter = useCallback(async () => {
    if (artistReferenceImages.length === 0) {
      logger.info('⚠️ No reference images available, skipping character generation');
      return null;
    }

    logger.info('🎭 Starting Master Character generation with multi-angle support...');
    setIsGeneratingCharacter(true);
    setShowCharacterGeneration(true);
    setCharacterGenerationProgress(0);
    setCharacterGenerationStage("Analyzing facial features...");

    try {
      const directorStyle = videoStyle.selectedDirector?.visual_style?.description || "Cinematic professional style";
      
      const masterChar = await generateMasterCharacterMultiAngle(
        artistReferenceImages,
        directorStyle,
        (stage, progress) => {
          setCharacterGenerationStage(stage);
          setCharacterGenerationProgress(progress);
        }
      );

      logger.info('✅ Master Character generated with multi-angle support:', {
        angles: masterChar.mainCharacter.angles.length,
        castMembers: masterChar.casting.length
      });

      setCharacterGenerationProgress(100);
      setCharacterGenerationStage("✅ Character and casting generation complete!");
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsGeneratingCharacter(false);
      setCharacterGenerationComplete(true);

      toast({
        title: "Character Profiles Ready",
        description: "Master character with 4 angles + 4 cast members generated",
      });

      setMasterCharacter(masterChar);
      return masterChar;

    } catch (error) {
      logger.error('❌ Error generating master character:', error);
      setIsGeneratingCharacter(false);
      setShowCharacterGeneration(false);

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error generating character",
        variant: "destructive",
      });

      return null;
    }
  }, [artistReferenceImages, videoStyle.selectedDirector?.visual_style?.description, toast]);

  const handleDirectorSelection = useCallback(async (director: DirectorProfile, style: string) => {
    logger.info('🎬 Director seleccionado:', director.name, '| Estilo:', style);
    
    // Guardar director y estilo
    setVideoStyle(prev => ({
      ...prev,
      selectedDirector: director as any // Type compatibility fix
    }));
    setSelectedVisualStyle(style);
    
    // Cerrar modal de director
    setShowDirectorSelection(false);
    
    // Iniciar transcripción si aún no se ha hecho
    if (!transcription && selectedFile) {
      logger.info('🎤 Iniciando transcripción automática...');
      setIsTranscribing(true);
      setShowProgress(true);
      setCurrentProgressStage("transcription");
      setProgressPercentage(0);
      setProgressMessage("🎵 Step 1/2: Analyzing song lyrics to understand the context...");
      
      // Progreso realista basado en el tamaño del archivo
      const startTime = Date.now();
      const fileSizeMB = selectedFile.size / 1024 / 1024;
      const estimatedDuration = fileSizeMB * 10 * 1000; // ~10 seg por MB
      
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const estimatedProgress = Math.min(92, (elapsed / estimatedDuration) * 100);
        throttledSetProgress(estimatedProgress);
      }, 200);
      
      try {
        // Obtener token de Clerk para autenticación
        const authToken = await getToken();
        logger.info('🔐 Token de autenticación obtenido:', !!authToken);
        
        const transcriptionText = await transcribeAudio(selectedFile, authToken);
        logger.info('✅ Transcripción completada, length:', transcriptionText.length, 'characters');
        logger.info('📝 LETRA DE LA CANCIÓN (primeros 500 caracteres):');
        logger.info('═'.repeat(60));
        logger.info(transcriptionText.substring(0, 500));
        logger.info('═'.repeat(60));
        clearInterval(progressInterval);
        setProgressPercentage(100);
        await new Promise(resolve => setTimeout(resolve, 800));
        setTranscription(transcriptionText);
        setCurrentStep(1.5);
        
        // 🎨 AUTO-PERFIL: Guardar canción automáticamente en perfil del artista
        try {
          logger.info('🎨 Guardando canción en perfil del artista...');
          
          // Get genre from director or use default
          const genre = videoStyle.selectedDirector?.name || 'Music Video';
          
          // Ensure profile exists
          const profileResult = await ensureArtistProfile(genre);
          if (profileResult.success) {
            logger.info('✅ Perfil verificado/creado:', profileResult.profile?.slug);
            
            // Save song to Firestore
            const songResult = await saveSongToProfile({
              title: projectName || selectedFile.name.replace(/\.[^/.]+$/, ''),
              audioUrl: audioUrl || '',
              lyrics: transcriptionText,
              genre: genre,
              duration: audioDuration,
              fileName: selectedFile.name,
              format: selectedFile.type
            });
            
            if (songResult.success) {
              logger.info('✅ Canción guardada automáticamente:', songResult.song?.id);
              logger.info('🔗 Ver perfil en: /artist/' + profileResult.profile?.slug);
            }
          }
        } catch (autoProfileError) {
          // No bloqueamos el flujo si falla el auto-perfil
          logger.warn('⚠️ Error en auto-perfil (no crítico):', autoProfileError);
        }
        
        // ✅ TRANSCRIPCIÓN COMPLETADA - Ahora sí generar conceptos con contexto
        setProgressMessage("✅ Lyrics analyzed! Now generating creative proposals...");
        setProgressPercentage(0);
        
        // ⚡ OPTIMIZACIÓN: Generar conceptos INMEDIATAMENTE (sin esperar Master Character)
        // El Master Character se generará en PARALELO en background
        logger.info('🎨 Generando 3 conceptos creativos CON contexto de letra (SIN esperar Master Character)...');
        setProgressMessage("🎬 Generating 3 creative proposals based on your lyrics...");
        
        // Generar conceptos en paralelo con Master Character (si hay imágenes)
        const conceptsPromise = handleGenerateConcepts(transcriptionText, director);
        
        // 🎭 FACE CONSISTENCY: Store MC promise for awaiting before image generation
        // Concepts generate in parallel (fast), but images MUST wait for MC
        if (artistReferenceImages.length > 0) {
          logger.info('🎭 Generando Master Character en PARALELO (se esperará antes de generar imágenes)...');
          masterCharacterPromiseRef.current = handleGenerateMasterCharacter().catch(err => {
            logger.warn('⚠️ Master Character falló, reintentando una vez...', err);
            // Retry once on failure
            return handleGenerateMasterCharacter().catch(retryErr => {
              logger.error('❌ Master Character falló en reintento:', retryErr);
              return null;
            });
          });
        }
        
        // Esperar SOLO a conceptos (mucho más rápido)
        await conceptsPromise;
        
      } catch (err) {
        logger.error("❌ Error transcribing audio:", err);
        clearInterval(progressInterval);
        toast({
          title: "Error de transcripción",
          description: err instanceof Error ? err.message : "Error al transcribir el audio",
          variant: "destructive",
        });
        setIsTranscribing(false);
        setShowProgress(false);
        setProgressPercentage(0);
        setProgressMessage("");
        // Volver al modal de selección
        setShowDirectorSelection(true);
      }
    } else if (transcription) {
      // If transcription exists, generate Master Character FIRST, then WAIT for user to click Next
      logger.info('✅ [TRANSCRIPCIÓN] Ya existe - generando Character PRIMERO');
      
      // 🎭 PASO 1: GENERATE MASTER CHARACTER FIRST
      if (artistReferenceImages.length > 0) {
        logger.info('🎭 Generating Master Character FIRST (with artist + casting)...');
        setShowProgress(false);
        setCharacterGenerationComplete(false);
        // Guardar datos para generar conceptos CUANDO usuario clickee Siguiente
        setPendingConceptGeneration({ transcription, director });
        await handleGenerateMasterCharacter();
        logger.info('✅ Master Character generated - waiting for user to click Next...');
      }
    }
  }, [transcription, artistReferenceImages, selectedFile, videoStyle, audioContext, audioUrl, toast, audioBuffer, projectName, selectedVisualStyle]);























  const handleGenerateConcepts = useCallback(async (transcriptionText: string, director: DirectorProfile) => {
    logger.info('═'.repeat(60));
    logger.info('🎬 [CONCEPTOS] INICIANDO GENERACIÓN DE 3 CONCEPTOS');
    logger.info('═'.repeat(60));
    logger.info('📝 [LYRICS CONTEXT] Letra disponible:', transcriptionText.substring(0, 200) + '...');
    logger.info('🎬 [DIRECTOR] Director seleccionado:', director.name);
    
    setIsGeneratingConcepts(true);
    setShowProgress(true);
    setCurrentProgressStage("concepts");
    setProgressMessage("🎬 Generating 3 creative proposals based on your song's story...");
    
    try {
      const audioDurationInSeconds = audioBuffer ? audioBuffer.duration : 180;
      
      // 🎨 USAR IMÁGENES DEL MASTER CHARACTER GENERADO (ahora siempre existen)
      // El Master Character se genera ANTES de los conceptos, por eso siempre debe estar disponible
      const characterImages = masterCharacter 
        ? [
            masterCharacter.mainCharacter.angles[0]?.imageUrl, // frontal
            masterCharacter.mainCharacter.angles[1]?.imageUrl, // left-profile
            masterCharacter.mainCharacter.angles[2]?.imageUrl, // right-profile
            masterCharacter.mainCharacter.angles[3]?.imageUrl  // three-quarter
          ].filter(Boolean)
        : artistReferenceImages;
      
      const characterReference = characterImages.length > 0 ? characterImages : undefined;
      
      // 🎭 EXTRAER GÉNERO DEL ANÁLISIS FACIAL (para consistencia en conceptos)
      const artistGender = masterCharacter?.analysis?.perceivedGender || 'not-specified';
      logger.info(`🎭 [GÉNERO DETECTADO] ${artistGender}`);
      
      if (characterReference) {
        logger.info(`🎭 [REFERENCIAS] Usando imágenes del Master Character generado (${characterReference.length} ángulos)`);
        logger.info('📸 Ángulos disponibles:', {
          frontal: masterCharacter?.mainCharacter.angles[0]?.imageUrl ? '✅' : '❌',
          leftProfile: masterCharacter?.mainCharacter.angles[1]?.imageUrl ? '✅' : '❌',
          rightProfile: masterCharacter?.mainCharacter.angles[2]?.imageUrl ? '✅' : '❌',
          threeQuarter: masterCharacter?.mainCharacter.angles[3]?.imageUrl ? '✅' : '❌'
        });
      } else {
        logger.info('⚠️ [REFERENCIAS] No hay imágenes del Master Character disponibles');
      }
      
      logger.info('🤖 [AI] Llamando a generateThreeConceptProposals con letra completa...');
      const concepts = await generateThreeConceptProposals(
        transcriptionText, // ✅ CRÍTICO: La letra YA está transcrita aquí
        director.name,
        characterReference,
        audioDurationInSeconds,
        artistName || projectName?.split(' - ')[0] || undefined, // artistName real
        songTitle || songName || selectedFile?.name?.replace(/\.[^/.]+$/, "") || undefined, // songTitle real
        artistGender // 🎭 NUEVO: Género del artista para consistencia visual
      );
      logger.info('✅ [CONCEPTOS] 3 propuestas generadas con contexto de letra');
      
      logger.info('✅ Conceptos generados:', concepts.length);
      
      // 🎬 USAR IMÁGENES DEL BACKEND (ya generadas con premium prompts)
      // El backend genera posters con buildPremiumPosterPrompt() + Flux Dev
      // No necesitamos regenerar — solo usar las que ya vienen en coverImage
      
      const conceptsWithDetails = concepts.map((concept: any, index: number) => {
        const hasBackendImage = !!(concept.coverImage);
        logger.info(`📸 Concepto ${index + 1}: ${concept.title} - Poster: ${hasBackendImage ? '✅ Del backend' : '⏳ Pendiente'}`);
        
        return {
          ...concept,
          // ✅ USAR la imagen del backend si existe, NO sobrescribir a null
          coverImage: concept.coverImage || null,
          isGenerating: !hasBackendImage, // Solo mostrar loading si el backend no generó imagen
          artistName: projectName || 'Artist Name',
          songTitle: selectedFile?.name?.replace(/\.[^/.]+$/, "") || 'Song Title',
          detailedDescription: concept.detailed_description || concept.description || '',
          visualTheme: concept.visual_theme || '',
          cameraWork: concept.camera_angles || concept.cinematography || 'Dynamic camera movements',
          editingStyle: concept.editing_style || 'Fast-paced cuts with creative transitions',
          characterRole: concept.character_description || 'Lead performer',
          lighting: concept.lighting_setup || 'Cinematic lighting with color grading',
          locationDetails: concept.setting || concept.location || 'Various locations',
          emotionalArc: concept.emotional_arc || 'Building intensity throughout',
          specialEffects: concept.special_effects || 'Subtle visual effects',
          paceAndRhythm: concept.pacing || 'Synced to beat drops and verses'
        };
      });
      
      setConceptProposals(conceptsWithDetails);
      setIsGeneratingConcepts(false);
      setShowProgress(false);
      
      // Mostrar modal INMEDIATAMENTE
      logger.info('═'.repeat(60));
      logger.info('🎨 [MODAL] ABRIENDO MODAL DE 3 CONCEPTOS');
      logger.info(`📊 Conceptos disponibles: ${conceptsWithDetails.length}`);
      const withImages = conceptsWithDetails.filter((c: any) => c.coverImage).length;
      logger.info(`📸 Con poster del backend: ${withImages}/${conceptsWithDetails.length}`);
      logger.info('═'.repeat(60));
      setShowConceptSelection(true);
      
      // 🔄 Solo regenerar posters para conceptos que NO recibieron imagen del backend
      const missingPosterConcepts = concepts.filter((c: any) => !c.coverImage);
      
      if (missingPosterConcepts.length > 0) {
        logger.info(`🎬 Regenerando ${missingPosterConcepts.length} posters faltantes...`);
        
        const posterPromises = concepts.map(async (concept: any, index: number) => {
          // Saltar si ya tiene imagen del backend
          if (concept.coverImage) {
            return { success: true, index, source: 'backend' };
          }
          
          try {
            logger.info(`🎬 Generando poster fallback ${index + 1}/3...`);
            
            const posterPrompt = `Cinematic movie poster for music video "${concept.title || `Concept ${index + 1}`}". ${concept.visual_theme || 'Professional cinematography'}. ${concept.story_concept?.substring(0, 200) || 'Dramatic visual story'}. Director: ${director.name}. 4K theatrical quality, dramatic lighting, award-worthy composition.`;
            
            const response = await fetch('/api/fal/nano-banana/generate-with-face', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                prompt: posterPrompt,
                referenceImages: characterReference || [],
                aspectRatio: '3:4'
              })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            if (data.success && data.imageUrl) {
              let posterUrl = data.imageUrl;
              if (user?.uid) {
                try {
                  posterUrl = await uploadImageFromUrl(data.imageUrl, user?.id, `${projectName}/concept-posters`);
                } catch (uploadError) {
                  logger.warn(`⚠️ Error subiendo poster ${index + 1} a Firebase:`, uploadError);
                }
              }
              
              setConceptProposals((prev: any[]) => {
                const updated = [...prev];
                updated[index] = { ...updated[index], coverImage: posterUrl, isGenerating: false };
                return updated;
              });
              return { success: true, index, source: 'fallback' };
            }
            throw new Error(data.error || 'No image URL');
          } catch (error) {
            logger.error(`❌ Error poster fallback ${index + 1}:`, error);
            setConceptProposals((prev: any[]) => {
              const updated = [...prev];
              updated[index] = { ...updated[index], coverImage: null, isGenerating: false, error: true };
              return updated;
            });
            return { success: false, index };
          }
        });
        
        const results = await Promise.all(posterPromises);
        const successCount = results.filter(r => r.success).length;
        logger.info(`✅ Posters: ${successCount}/3 exitosos (${withImages} del backend + ${successCount - withImages} fallback)`);
      } else {
        logger.info('✅ Los 3 posters fueron generados por el backend — no se necesita regenerar');
      }
      
    } catch (err) {
      logger.error("❌ Error generando conceptos:", err);
      setIsGeneratingConcepts(false);

      // 🔄 RESILIENCIA: el paso de conceptos es OPCIONAL. Si falla (p.ej. la IA
      // no respondió), NO regresamos al director — continuamos el workflow
      // generando el guión del video directamente (sin concepto). El generador
      // de guión tiene su propio fallback, así que la fase siempre avanza.
      const buffer = audioBuffer;
      if (buffer && transcriptionText) {
        logger.warn("⚠️ [CONCEPTOS] Fallaron — avanzando directamente a la generación del guión");
        toast({
          title: "Continuando con el guión",
          description: "No se pudieron generar las propuestas de concepto, así que creamos el guión del video directamente.",
        });
        setSelectedConcept(null);
        try {
          await executeScriptGeneration(transcriptionText, buffer);
        } catch (scriptErr) {
          logger.error("❌ [CONCEPTOS] Error generando el guión tras el fallo de conceptos:", scriptErr);
          setShowProgress(false);
        }
      } else {
        // Sin audio/transcripción no hay forma de continuar: informamos y dejamos reintentar.
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Error generando conceptos",
          variant: "destructive",
        });
        setShowProgress(false);
        setShowDirectorSelection(true);
      }
    }
  }, [audioBuffer, transcription, artistReferenceImages, toast, projectName, selectedFile, seed, user, uploadImageFromUrl]);

  // Handler para cuando se selecciona un concepto
  const handleConceptSelection = useCallback(async (concept: any) => {
    logger.info('🎨 Concepto seleccionado:', concept.title || 'Concepto');
    
    setSelectedConcept(concept);
    
    // ⚡ CIERRE INMEDIATO DEL MODAL
    setShowConceptSelection(false);
    
    // 🎬 MOSTRAR PROGRESO INMEDIATAMENTE
    setShowProgress(true);
    setCurrentProgressStage("script");
    setProgressMessage("Generando guión cinematográfico...");
    
    // 🚀 TRABAJO PESADO EN BACKGROUND (no bloquea la UI)
    // Usar Promise.then() para no bloquear el cierre del modal
    Promise.resolve().then(async () => {
      try {
        // Guardar concepto en la base de datos EN BACKGROUND
        if (user?.email) {
          try {
            logger.info('💾 [BG] Guardando concepto seleccionado en base de datos...');
            
            const projectData = {
              userEmail: user.email!,
              projectName: projectName || `Video ${Date.now()}`,
              audioUrl: selectedFile?.name || '',
              audioDuration: audioBuffer?.duration,
              transcription: transcription,
              timelineItems: timelineItems,
              selectedDirector: videoStyle.selectedDirector,
              videoStyle: videoStyle,
              artistReferenceImages: artistReferenceImages,
              selectedConcept: concept,
              generatedConcepts: conceptProposals,
              status: 'generating_script' as const,
              progress: {
                scriptGenerated: false,
                imagesGenerated: 0,
                totalImages: 0,
                videosGenerated: 0,
                totalVideos: 0
              }
            };
            
            const savedProject = await musicVideoProjectServicePostgres.saveProject(projectData);
            logger.info('✅ [BG] Concepto guardado en base de datos');
            
            // 🎨 Crear perfil de artista automáticamente EN BACKGROUND
            if (savedProject?.project?.id) {
              logger.info('👤 [BG] Creando perfil de artista automáticamente...');
              
              const { createArtistProfileFromVideo } = await import('@/lib/api/artist-profile-service');
              
              // Extraer imágenes de conceptos para la galería
              const conceptImages = conceptProposals
                .filter(c => c.coverImage)
                .map(c => ({
                  url: c.coverImage || '',
                  type: 'concept-poster',
                  description: c.title || 'Music Video Concept'
                }));
              
              const profileResult = await createArtistProfileFromVideo({
                projectId: savedProject.project.id,
                userEmail: user.email!,
                creatorUserId: user.id,
                existingArtistId: preFilledArtistId || undefined, // Usar artista existente si viene de su perfil
                artistName: projectName || 'AI Generated Artist',
                songName: selectedFile?.name?.replace(/\.[^/.]+$/, '') || undefined,
                selectedConcept: concept,
                lyrics: transcription || undefined,
                referenceImages: artistReferenceImages,
                conceptImages: conceptImages
              });
              
              if (profileResult.success) {
                const isExisting = profileResult.isNew === false;
                logger.info(`✅ [BG] Perfil de artista ${isExisting ? 'vinculado' : 'creado'}:`, profileResult.profile?.artistName);
                toast({
                  title: isExisting ? "🔗 Artista Vinculado" : "✨ Perfil de Artista Creado",
                  description: isExisting 
                    ? `Video vinculado al perfil existente de "${profileResult.profile?.artistName}"`
                    : `Se ha creado automáticamente el perfil para "${profileResult.profile?.artistName}"`,
                });
              } else {
                logger.warn('⚠️ [BG] No se pudo crear el perfil automático, continuando');
              }
            }
            
          } catch (error) {
            logger.error('❌ [BG] Error guardando concepto:', error);
            // Continuar de todas formas - no es crítico
          }
        }
        
        // Proceder a generar el script completo y las imágenes
        logger.info('📜 Generando script final basado en el concepto...');
        
        if (transcription && audioBuffer) {
          await executeScriptGeneration(transcription, audioBuffer);
        } else {
          logger.error('❌ No hay transcripción o audioBuffer disponible');
          toast({
            title: "Error",
            description: "Falta transcripción o audio para continuar",
            variant: "destructive",
          });
          setShowProgress(false);
        }
        
      } catch (error) {
        logger.error('❌ Error en procesamiento de concepto:', error);
        setShowProgress(false);
      }
    }).catch(error => {
      logger.error('❌ Error en promesa de background:', error);
      setShowProgress(false);
    });
    
  }, [executeScriptGeneration, user, projectName, selectedFile, audioBuffer, transcription, timelineItems, videoStyle, artistReferenceImages, conceptProposals, toast, preFilledArtistId]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File must be smaller than 50MB",
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith("audio/")) {
        toast({
          title: "Error",
          description: "Please upload a valid audio file (MP3)",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setTranscription("");
      setTimelineItems([]);
      setCurrentTime(0);
      setIsPlaying(false);

      // 🎵 SUBIR AUDIO A FIREBASE STORAGE inmediatamente
      // Esto es necesario para que audioUrl sea una URL HTTP válida (no blob:)
      // que pueda ser usada por el servidor para análisis y lipsync
      const uploadAudioToFirebase = async () => {
        try {
          logger.info('═'.repeat(60));
          logger.info('📤 [AUDIO UPLOAD] INICIANDO SUBIDA A FIREBASE STORAGE');
          logger.info('═'.repeat(60));
          logger.info(`📁 Archivo: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
          
          const storage = getStorage();
          const timestamp = Date.now();
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const audioRef = ref(storage, `music-videos/audio/${user?.uid || 'anonymous'}/${timestamp}_${sanitizedFileName}`);
          
          // Subir archivo
          const snapshot = await uploadBytes(audioRef, file);
          const firebaseAudioUrl = await getDownloadURL(snapshot.ref);
          
          // ✅ Guardar URL de Firebase para usar en todo el flujo
          setAudioUrl(firebaseAudioUrl);
          logger.info('═'.repeat(60));
          logger.info('✅ [AUDIO UPLOAD] AUDIO SUBIDO EXITOSAMENTE A FIREBASE');
          logger.info(`🔗 URL: ${firebaseAudioUrl.substring(0, 100)}...`);
          logger.info('═'.repeat(60));
          
          toast({
            title: "Audio uploaded",
            description: "Your audio file has been uploaded successfully",
          });
        } catch (uploadError) {
          logger.error('═'.repeat(60));
          logger.error('❌ [AUDIO UPLOAD] ERROR SUBIENDO AUDIO A FIREBASE');
          logger.error(uploadError);
          logger.error('═'.repeat(60));
          
          // 🔧 FALLBACK: Crear URL local (blob) para que el audio funcione
          const localBlobUrl = URL.createObjectURL(file);
          setAudioUrl(localBlobUrl);
          logger.info(`🔧 [AUDIO FALLBACK] Usando URL local: ${localBlobUrl.substring(0, 50)}...`);
          
          toast({
            title: "Upload warning",
            description: "Audio loaded locally. Some features may be limited.",
            variant: "default",
          });
        }
      };
      
      // Ejecutar upload en background
      uploadAudioToFirebase();

      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          if (!audioContext.current) {
            audioContext.current = new AudioContext();
          }
          const buffer = await audioContext.current.decodeAudioData(e.target.result);
          setAudioBuffer(buffer);

          // Use OpenAI for transcription
          logger.info('🎤 Starting file transcription:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
          setIsTranscribing(true);
          setShowProgress(true);
          setCurrentProgressStage("transcription");
          setProgressPercentage(0);
          
          // Progreso realista basado en el tamaño del archivo
          const startTime = Date.now();
          const fileSizeMB = file.size / 1024 / 1024;
          // Estimar tiempo: ~8-12 segundos por MB de audio
          const estimatedDuration = fileSizeMB * 10 * 1000;
          
          const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const estimatedProgress = Math.min(92, (elapsed / estimatedDuration) * 100);
            throttledSetProgress(estimatedProgress);
          }, 200);
          
          try {
            logger.info('📤 Sending file to server for transcription...');
            // Obtener token de Clerk para autenticación
            const authToken = await getToken();
            logger.info('🔐 Token de autenticación obtenido:', !!authToken);
            
            const transcriptionText = await transcribeAudio(file, authToken);
            logger.info('✅ Transcription completed, length:', transcriptionText.length, 'characters');
            clearInterval(progressInterval);
            setProgressPercentage(100);
            await new Promise(resolve => setTimeout(resolve, 1000));
            setTranscription(transcriptionText);
            setCurrentStep(1.5);
            
            setShowProgress(false);
            setIsTranscribing(false);
            setProgressPercentage(0);
            
            logger.info('✅ [TRANSCRIPCIÓN COMPLETADA] Usuario puede ahora seleccionar director');
            
            toast({
              title: "✅ Transcripción completada",
              description: "Ahora puedes seleccionar un director y estilo para continuar",
            });
            
          } catch (err) {
            logger.error("❌ Error transcribing audio:", err);
            clearInterval(progressInterval);
            toast({
              title: "Transcription error",
              description: err instanceof Error ? err.message : "Error transcribing audio. Please try again.",
              variant: "destructive",
            });
            setIsTranscribing(false);
            setShowProgress(false);
            setProgressPercentage(0);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }, [toast]);

  // Function to handle artist reference image upload
  const handleReferenceImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate that no more than 10 images are uploaded in total
    if (artistReferenceImages.length + files.length > 10) {
      toast({
        title: "Error",
        description: "You can only upload a maximum of 10 reference images",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingReferences(true);

    try {
      const newImages: string[] = [];
      
      for (let i = 0; i < files.length && artistReferenceImages.length + newImages.length < 10; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast({
            title: "Error",
            description: `${file.name} is not a valid image`,
            variant: "destructive",
          });
          continue;
        }

        // Validate size (maximum 5MB per image)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "Error",
            description: `${file.name} exceeds the maximum size of 5MB`,
            variant: "destructive",
          });
          continue;
        }

        // Convert image to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newImages.push(base64);
      }

      setArtistReferenceImages([...artistReferenceImages, ...newImages]);
      
      toast({
        title: "Success",
        description: `${newImages.length} reference image(s) added (${artistReferenceImages.length + newImages.length}/10)`,
      });
    } catch (error) {
      logger.error("Error loading reference images:", error);
      toast({
        title: "Error",
        description: "Error processing reference images",
        variant: "destructive",
      });
    } finally {
      setIsUploadingReferences(false);
    }
  }, [artistReferenceImages, toast]);

  // Function to remove a reference image
  const removeReferenceImage = useCallback((index: number) => {
    setArtistReferenceImages(prev => prev.filter((_, i) => i !== index));
    toast({
      title: "Image removed",
      description: `Reference image ${index + 1} removed`,
    });
  }, [toast]);

  const generateScriptFromTranscription = async () => {
    if (!transcription) {
      toast({
        title: "Error",
        description: "You need to transcribe the audio first",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingScript(true);
    setShowProgress(true);
    setCurrentProgressStage("script");
    setProgressPercentage(0);
    
    // Progreso realista para generación de script completo
    const startTime = Date.now();
    const estimatedDuration = 60000; // ~60 segundos para script completo
    
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const estimatedProgress = Math.min(85, (elapsed / estimatedDuration) * 100);
      throttledSetProgress(estimatedProgress);
    }, 300);
    
    try {
      // Call API to generate the script
      toast({
        title: "Processing",
        description: "Generating script based on song lyrics...",
      });

      // 🎬 OBTENER PERFIL COMPLETO DEL DIRECTOR desde JSON
      let directorProfile: DirectorProfile | undefined = undefined;
      if (videoStyle.selectedDirector) {
        directorProfile = getDirectorByName(videoStyle.selectedDirector.name);
        if (directorProfile) {
          logger.info(`🎬 [DIRECTOR] Perfil completo cargado: ${directorProfile.name}`);
        }
      }
      
      // Pass audio duration to generate scenes every ~4 seconds
      const audioDurationInSeconds = audioBuffer?.duration || undefined;
      
      // � PASO 1: Usar concepto seleccionado por el usuario O generar uno nuevo
      let conceptToUse = selectedConcept;
      
      if (!conceptToUse) {
        // Si no hay concepto seleccionado, generar uno nuevo basado en la letra
        logger.info('🎨 [CONCEPTO] No hay concepto seleccionado, generando uno nuevo basado en la letra...');
        conceptToUse = await generateMusicVideoConcept(
          transcription,
          artistReferenceImages.length > 0 ? artistReferenceImages : undefined,
          audioDurationInSeconds
        );
        
        if (conceptToUse) {
          logger.info('✅ [CONCEPTO] Concepto generado y guardado en estado');
          setSelectedConcept(conceptToUse); // 🆕 Guardar para uso posterior
        } else {
          logger.warn('⚠️ [CONCEPTO] No se pudo generar concepto, el script se generará sin contexto visual');
        }
      } else {
        logger.info('🎨 [CONCEPTO] Usando concepto seleccionado por el usuario:', conceptToUse.title || conceptToUse.story_concept?.substring(0, 50));
      }
      
      // 📝 PASO 2: Generar script usando LETRA + CONCEPTO + DIRECTOR
      // El script debe conectar cada escena con el segmento de letra correspondiente
      logger.info('📝 [SCRIPT] Generando script conectando LETRA ↔ CONCEPTO ↔ ESCENAS...');
      logger.info(`   - Letra: ${transcription.substring(0, 100)}...`);
      logger.info(`   - Concepto: ${conceptToUse?.story_concept?.substring(0, 80) || 'Sin concepto'}...`);
      logger.info(`   - Director: ${directorProfile?.name || 'Creative Director'}`);
      
      const scriptResponse = await generateMusicVideoScript(
        transcription, 
        undefined, 
        directorProfile, // Perfil completo del director
        audioDurationInSeconds,
        undefined,
        conceptToUse // 🆕 Pasar el concepto correcto (seleccionado o generado)
      );
      
      clearInterval(progressInterval);
      setProgressPercentage(100);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to format JSON for better visualization
      try {
        // Check if it's already a valid JSON string, and parse it to format it
        const parsed = JSON.parse(scriptResponse);
        setScriptContent(JSON.stringify(parsed, null, 2));
      } catch (parseError) {
        // If it can't be parsed, use the response directly
        logger.warn("Could not format script JSON, using direct response", parseError);
        setScriptContent(scriptResponse);
      }
      
      // Mark this step as completed
      setCurrentStep(3);
      
      toast({
        title: "Success",
        description: "Music video script generated correctly",
      });
    } catch (error) {
      logger.error("Error generating script:", error);
      clearInterval(progressInterval);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error generating music video script",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingScript(false);
      setShowProgress(false);
      setProgressPercentage(0);
    }
  };

  const syncAudioWithTimeline = async () => {
    if (!audioBuffer) return;

    if (!scriptContent) {
      toast({
        title: "Error",
        description: "You must first generate the music video script",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingShots(true);
    try {
      let segments: TimelineItem[] = [];
      
      // Create segments based on JSON script scenes
      try {
        const parsedScript = JSON.parse(scriptContent);
        
        // Verify script format and extract scenes
        let scenes = [];
        if (parsedScript.scenes && Array.isArray(parsedScript.scenes)) {
          // New format: { scenes: [...] }
          scenes = parsedScript.scenes;
        } else if (Array.isArray(parsedScript) && parsedScript.length > 0 && parsedScript[0].scene_id) {
          // Old format: direct array of scenes
          scenes = parsedScript;
        }
        
        // 🎯 FREE TIER LIMIT: Limit scenes to FREE_SCENES_LIMIT for unpaid users
        const totalScenes = scenes.length;
        if (!hasUserPaid && scenes.length > FREE_SCENES_LIMIT) {
          logger.info(`🎬 [FREE TIER] Limiting ${totalScenes} scenes to ${FREE_SCENES_LIMIT} for free preview`);
          scenes = scenes.slice(0, FREE_SCENES_LIMIT);
          
          toast({
            title: "🎬 Free Preview Mode",
            description: `Creating ${FREE_SCENES_LIMIT} of ${totalScenes} scenes. Pay $${FULL_VIDEO_PRICE} to unlock the full video!`,
          });
        }
        
        // Check if we have valid scenes
        if (scenes.length > 0) {
          segments = createSegmentsFromScenes(scenes, audioBuffer.duration);
          toast({
            title: "Synchronizing",
            description: `Creating ${segments.length} scenes based on the cinematic script`,
          });
        } else {
          throw new Error("The script does not contain valid scenes");
        }
      } catch (e) {
        logger.error("Error parsing script:", e);
        throw new Error("Could not process the script. Please, generate the script again.");
      }
      
      if (segments && segments.length > 0) {
        // ✅ VERIFICAR Y REPORTAR PROMPTS DEL SCRIPT JSON
        const segmentsWithPrompts = segments.filter(s => s.imagePrompt && s.imagePrompt.length > 20);
        logger.info(`📊 RESUMEN DE SINCRONIZACIÓN:`);
        logger.info(`   Total de escenas: ${segments.length}`);
        logger.info(`   Escenas con prompts: ${segmentsWithPrompts.length}`);
        logger.info(`   Prompts únicos detectados: ${new Set(segments.map(s => s.imagePrompt)).size}`);
        
        if (segmentsWithPrompts.length > 0) {
          logger.info(`📝 Primeros 3 prompts del guion:`);
          segmentsWithPrompts.slice(0, 3).forEach((s, i) => {
            logger.info(`   ${i + 1}. ${s.imagePrompt?.substring(0, 80)}...`);
          });
        }
        
        setTimelineItems(segments);
        setCurrentStep(4);

        toast({
          title: "Success",
          description: `${segments.length} scenes synchronized with ${segmentsWithPrompts.length} cinematic prompts`,
        });
      } else {
        throw new Error("No segments detected in the script");
      }
    } catch (error) {
      logger.error("Error synchronizing audio:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error synchronizing audio with timeline",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingShots(false);
    }
  };

  /**
   * 🎬 MEJORADO: Crea segmentos del timeline preservando TODOS los campos narrativos del script
   * Esto permite que generateImageForSegment use el contexto completo para regenerar imágenes
   * @param scenes - Escenas del script JSON
   * @param totalDuration - Duración total del audio
   */
  const createSegmentsFromScenes = (scenes: any[], totalDuration: number): TimelineItem[] => {
    const segments: TimelineItem[] = [];
    
    scenes.forEach((scene, index) => {
      // READ start_time and duration directly from the script JSON
      // DO NOT calculate equal durations - use the random values (3-4 sec) from JSON
      const startTime = (scene.start_time || 0) * 1000; // Convert seconds to milliseconds
      const duration = (scene.duration || 3.5) * 1000; // Duration in milliseconds (default 3.5s)
      const endTime = startTime + duration;
      
      // Support both 'id' and 'scene_id' for compatibility
      // Convert "scene-1" to 1, "scene-2" to 2, etc.
      let sceneId = index + 1; // Default fallback
      if (scene.id) {
        const match = scene.id.toString().match(/\d+/);
        sceneId = match ? parseInt(match[0]) : index + 1;
      } else if (scene.scene_id) {
        const match = scene.scene_id.toString().match(/\d+/);
        sceneId = match ? parseInt(match[0]) : index + 1;
      }
      
      // 🎤 MEJORA CRÍTICA: Construir prompt cinematográfico que SIEMPRE incluya la letra
      // La letra es la base fundamental para la coherencia visual del video
      const lyricsText = scene.lyrics?.trim() || '';
      const hasLyricsForPrompt = lyricsText.length > 0;
      
      // Construir prompt con letra como contexto principal
      let cinematicPrompt: string;
      
      if (scene.visual_description) {
        // Si hay visual_description del backend, enriquecerla con la letra
        cinematicPrompt = hasLyricsForPrompt
          ? `[LYRICS CONTEXT: "${lyricsText.substring(0, 100)}"] ${scene.visual_description}`
          : scene.visual_description;
      } else {
        // Fallback: construir prompt basado en la letra
        const lyricsContext = hasLyricsForPrompt 
          ? `Visual representation of lyrics: "${lyricsText.substring(0, 80)}". ` 
          : 'Instrumental moment. ';
        cinematicPrompt = `${lyricsContext}${scene.shot_type || 'medium-shot'} shot, ${scene.description || 'cinematic scene'}, ${scene.lighting || 'dramatic lighting'}, ${scene.color_grading || 'cinematic colors'}, ${scene.mood || 'emotional'} atmosphere, ${scene.location || 'performance space'}, ${scene.camera_movement || 'smooth camera movement'}`;
      }
      
      logger.info(`🎤 [LYRICS→PROMPT] Scene ${index + 1}: "${lyricsText.substring(0, 40) || 'Instrumental'}..." → Prompt includes lyrics: ${hasLyricsForPrompt}`);
      
      // 🎤 Detectar si la escena necesita lipsync
      const hasLyrics = scene.lyrics && scene.lyrics.trim().length > 0;
      const isPerformanceScene = scene.shot_category === 'PERFORMANCE' || 
                                 (scene.visual_description && (
                                   scene.visual_description.toLowerCase().includes('singing') ||
                                   scene.visual_description.toLowerCase().includes('cantando') ||
                                   scene.visual_description.toLowerCase().includes('performing') ||
                                   scene.visual_description.toLowerCase().includes('close-up face')
                                 ));
      const needsLipsync = scene.needs_lipsync ?? (hasLyrics && isPerformanceScene);
      
      logger.info(`🎬 Creating clip ${sceneId}: start=${scene.start_time}s, duration=${scene.duration}s`);
      logger.info(`📝 Prompt: ${cinematicPrompt.substring(0, 100)}...`);
      logger.info(`🎭 Shot Category: ${scene.shot_category || 'STORY'}, Use Reference: ${scene.use_artist_reference !== false}, Lipsync: ${needsLipsync}`);
      
      segments.push({
        id: sceneId, // CRITICAL: Use numeric ID for React keys
        type: 'image', // Image type for proper display
        group: 1,
        title: needsLipsync 
          ? `🎤 ${scene.title || `Scene ${scene.scene_id || scene.scene_number}`}` 
          : scene.title || `Scene ${scene.scene_id || scene.scene_number}`,
        start_time: startTime,
        end_time: endTime,
        duration: duration,
        shotType: scene.shot_type || scene.camera?.lens || 'MS', // Shot type from JSON
        description: scene.visual_description || scene.description || `Scene ${scene.scene_id || scene.scene_number}`,
        imagePrompt: cinematicPrompt, // ✅ CORREGIDO: Usa visual_description del backend
        thumbnail: '', // Will be assigned when image is generated
        imageUrl: '', // Will be assigned when image is generated
        generationStatus: 'pending' as const, // Progressive generation: pending until image arrives
        
        // 🎤 LIPSYNC: Marcar escenas que necesitan sincronización de labios
        needsLipsync: needsLipsync,
        hasVocals: hasLyrics,
        
        // 🎬 NUEVOS CAMPOS: Control de referencia del artista
        useArtistReference: scene.use_artist_reference !== false, // Default true for backward compatibility
        referenceUsage: scene.reference_usage || (scene.shot_category === 'PERFORMANCE' ? 'full_performance' : 
                                                   scene.shot_category === 'B-ROLL' ? 'none' : 'story_character'),
        shotCategory: scene.shot_category || 'STORY', // PERFORMANCE | B-ROLL | STORY
        
        // 🎭 NUEVOS CAMPOS: Contexto narrativo para regeneración inteligente
        narrativeContext: scene.narrative_context || '',
        lyricConnection: scene.lyric_connection || '',
        visualDescription: scene.visual_description || scene.description || '',
        emotion: scene.emotion || scene.mood || scene.emotional_tone || '',
        storyProgression: scene.story_progression || '',
        musicSection: scene.section || '', // intro, verse, chorus, bridge, outro
        
        // 🎥 NUEVOS CAMPOS: Especificaciones técnicas de cámara
        cameraMovement: scene.camera_movement || 'static',
        lens: scene.lens || scene.lens_mm || 'standard',
        lighting: scene.lighting || scene.lighting_key || 'natural',
        colorGrading: scene.color_grading || scene.film_emulation || 'cinematic',
        location: scene.location || 'performance space',
        lyricsSegment: scene.lyrics || '', // Letra correspondiente
        
        mood: scene.mood || scene.emotional_tone || 'neutral',
        transition: scene.transition || 'cut',
        
        // 🎬 DIRECTOR+DP CINEMATOGRAPHY: Preservar datos ricos del JSON Maestro
        enhancedPrompt: scene.enhanced_prompt || '', // Pre-built prompt from cinematography-service
        editPrompt: scene.edit_prompt || '', // For shot variations
        directorName: scene.director_name || '',
        dpName: scene.dp_name || '',
        directorSignature: scene.director_signature || '',
        filmEmulation: scene.film_emulation || '',
        lensMm: scene.lens_mm || '',
        aperture: scene.aperture || '',
        cameraHeight: scene.camera_height || '',
        cameraAngle: scene.camera_angle || '',
        depthOfField: scene.depth_of_field || '',
        lightingKey: scene.lighting_key || '',
        colorPalette: scene.color_palette || [],
        aspectRatio: scene.aspect_ratio || '',
        framingNotes: scene.framing_notes || '',
        synergyScore: scene.synergy_score || 0,
        
        itemProps: {
          style: {
            background: needsLipsync ? 'linear-gradient(135deg, #f97316, #ea580c)' : `hsl(${(index * 30) % 360}, 70%, 50%)`,
            border: needsLipsync ? '2px solid #fb923c' : '1px solid rgba(255,255,255,0.3)',
            borderRadius: '4px',
            color: 'white'
          }
        },
        metadata: {
          scene_id: scene.scene_id,
          section: scene.section,
          shot_type: scene.shot_type || scene.camera?.lens,
          role: scene.role,
          camera: scene.camera,
          lighting: scene.lighting,
          environment: scene.environment,
          performance: scene.performance,
          sound: scene.sound,
          emotional_tone: scene.emotional_tone,
          transition: scene.transition,
          production_notes: scene.production_notes,
          // � Lipsync info
          needsLipsync: needsLipsync,
          hasVocals: hasLyrics,
          audioSegment: {
            startTime: scene.start_time || 0,
            endTime: (scene.start_time || 0) + (scene.duration || 3.5),
            hasVocals: hasLyrics
          },
          // 🆕 Preserve original script fields for debugging
          _original_shot_category: scene.shot_category,
          _original_use_artist_reference: scene.use_artist_reference,
          _original_reference_usage: scene.reference_usage,
          // 🎬 DIRECTOR+DP: Full cinematography data from enrichment pipeline
          _enhanced_prompt: scene.enhanced_prompt,
          _edit_prompt: scene.edit_prompt,
          _director_name: scene.director_name,
          _dp_name: scene.dp_name,
          _film_emulation: scene.film_emulation,
          _lens_mm: scene.lens_mm,
          _aperture: scene.aperture,
          _cinematography: scene.cinematography,
          _director_dp_context: scene.director_dp_context,
          _motion_descriptor: scene.motion_descriptor
        }
      });
    });
    
    logger.info(`✅ ${segments.length} clips created from JSON with FULL narrative context`);
    
    // 📊 Log resumen de categorías de escenas
    const categories = segments.reduce((acc, s) => {
      const cat = s.shotCategory || 'UNKNOWN';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    logger.info(`📊 Shot categories breakdown: ${JSON.stringify(categories)}`);
    
    // 🎤 Log resumen de escenas con lipsync
    const lipsyncCount = segments.filter(s => s.needsLipsync).length;
    logger.info(`🎤 [LIPSYNC] ${lipsyncCount}/${segments.length} scenes marked for lipsync`);
    
    // 🎤 VALIDACIÓN: Verificar conexión LETRA ↔ ESCENAS
    const scenesWithLyrics = segments.filter(s => s.lyricsSegment && s.lyricsSegment.trim().length > 0);
    const scenesWithLyricConnection = segments.filter(s => s.lyricConnection && s.lyricConnection.trim().length > 0);
    const scenesWithNarrative = segments.filter(s => s.narrativeContext && s.narrativeContext.trim().length > 0);
    
    logger.info(`🎤 [VALIDATION] Lyrics Integration:`);
    logger.info(`   - Scenes with lyrics segment: ${scenesWithLyrics.length}/${segments.length}`);
    logger.info(`   - Scenes with lyric_connection: ${scenesWithLyricConnection.length}/${segments.length}`);
    logger.info(`   - Scenes with narrative_context: ${scenesWithNarrative.length}/${segments.length}`);
    
    if (scenesWithLyrics.length < segments.length * 0.5) {
      logger.warn(`⚠️ [VALIDATION] Less than 50% of scenes have lyrics - script may not be well connected to the song`);
    }
    
    // Log primeras 3 escenas para debug
    logger.info(`🎬 [SAMPLE] First 3 scenes narrative summary:`);
    segments.slice(0, 3).forEach((s, i) => {
      logger.info(`   Scene ${i+1}: "${s.lyricsSegment?.substring(0, 40) || 'No lyrics'}..." → "${s.lyricConnection?.substring(0, 50) || 'No connection'}..."`);
    });
    
    return segments;
  };

  // New function: Generate full video with payment (30 scenes + FAL)
  const handleGenerateFullVideoWithPayment = async () => {
    if (!transcription || !audioBuffer || !user) {
      toast({
        title: "Error",
        description: "You need transcription, loaded audio and be authenticated",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingFullVideo(true);
    
    try {
      // Step 1: Generate script with 30 prompts
      toast({
        title: "Generating complete script",
        description: "Creating 30 cinematic scenes...",
      });
      
      const fullScript = await generateMusicVideoPrompts(
        transcription,
        audioBuffer.duration,
        true, // isPaid = true (30 scenes)
        videoStyle.selectedDirector ? {
          name: videoStyle.selectedDirector.name,
          specialty: videoStyle.selectedDirector.specialty,
          style: videoStyle.selectedDirector.style
        } : undefined,
        selectedEditingStyle
      );
      
      logger.info(`✅ Script generated: ${fullScript.total_scenes} scenes`);
      
      // Step 2: Generate images for each scene using Gemini/Flux
      toast({
        title: "Generating images",
        description: `Generating ${fullScript.total_scenes} images with AI...`,
      });
      
      const imagePromises = fullScript.scenes.map(async (scene, index) => {
        try {
          // Use Flux to generate the image
          const result = await fluxService.generateImage({
            prompt: scene.prompt,
            width: 1280,
            height: 720,
            guidance_scale: 3.5,
            steps: 30
          });
          
          logger.info(`✅ Image ${index + 1}/${fullScript.total_scenes} generated`);
          // FluxTaskResult.images is string[] not objects with url
          return result.images?.[0] || '';
        } catch (error) {
          logger.error(`Error generating image ${index + 1}:`, error);
          throw error;
        }
      });
      
      const imageUrls = await Promise.all(imagePromises);
      
      toast({
        title: "Images generated",
        description: `${imageUrls.length} images successfully created`,
      });
      
      // Step 3: Generate videos with FAL
      const isReferenceModel = selectedFalModel.includes('reference-to-video');
      toast({
        title: "Generating videos",
        description: isReferenceModel && artistReferenceImages.length > 0
          ? `Converting ${imageUrls.length} images to video with O1 Reference-to-Video (consistent artist identity)...`
          : `Converting ${imageUrls.length} images to video with ${selectedFalModel}...`,
      });
      
      const scenesWithImages = fullScript.scenes.map((scene, index) => ({
        prompt: scene.prompt,
        imageUrl: imageUrls[index]
      }));
      
      // Pasar imágenes de referencia del artista para modelos O1
      const videoResults = await generateMultipleVideos(
        selectedFalModel,
        scenesWithImages,
        isReferenceModel && artistReferenceImages.length > 0 ? artistReferenceImages : undefined
      );
      
      const successCount = videoResults.filter(r => r.success).length;
      
      toast({
        title: "Videos generated",
        description: `${successCount}/${videoResults.length} videos successfully generated`,
      });
      
      // Step 4: Save to database
      const videoData = {
        user_id: user?.id,
        song_name: selectedFile?.name || "Music Video",
        video_url: null, // Will be updated when final video is compiled
        thumbnail_url: imageUrls[0],
        duration: audioBuffer.duration,
        is_paid: true,
        amount: 19900, // $199.00 in cents
        status: 'completed',
        metadata: {
          scenes: fullScript.total_scenes,
          model: selectedFalModel,
          video_urls: videoResults.map(r => r.videoUrl)
        }
      };
      
      const response = await fetch('/api/videos/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoData)
      });
      
      if (!response.ok) {
        throw new Error('Error saving video to database');
      }
      
      const savedVideo = await response.json();
      
      toast({
        title: "Full video generated!",
        description: "Your music video has been saved to your account",
      });
      
      // Update states
      setIsPaidVideo(true);
      setShowMyVideos(true);
      
    } catch (error) {
      logger.error('Error generating full video:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error generating full video",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingFullVideo(false);
    }
  };

  const generateVideoScriptFromAudio = async () => {
    if (!transcription || timelineItems.length === 0) return;

    setIsGeneratingScript(true);
    try {
      // Extraemos información de los cortes actuales en el timeline
      const timelineInfo = timelineItems.map((item, index) => ({
        id: item.id,
        start_time: item.start_time,
        end_time: item.end_time,
        duration: item.duration
      }));

      // Calculamos duración exacta y número total de segmentos
      const totalSegments = timelineItems.length;
      const totalDuration = audioBuffer?.duration || 0;

      const prompt = `As a professional music video director, I need you to analyze this song and create a detailed script, perfectly synchronized with the already identified musical cuts.

SONG LYRICS:
${transcription}

TOTAL DURATION: ${totalDuration.toFixed(2)} seconds

MUSICAL CUTS INFORMATION:
${JSON.stringify(timelineInfo, null, 2)}

STRICT SYNCHRONIZATION REQUIREMENTS:
1. You must create EXACTLY ${totalSegments} script segments, one for each predefined musical cut.
2. Each segment must correspond with a specific section of the lyrics that matches the exact time of the cut.
3. If a cut spans an instrumental period without lyrics, specify it is an instrumental moment and describe what should be shown.

SPECIFIC INSTRUCTIONS:
1. LYRICS AND MUSIC ANALYSIS:
   - For each cut, identify what exact part of the lyrics fits its duration
   - Describe the precise musical elements occurring during that cut
   - Point out any changes in rhythm, tone, or instrumentation

2. SYNCHRONIZED VISUAL SCRIPT CREATION:
   - For each segment, relate the scene exactly with the corresponding part of the lyrics
   - Each visual description must reflect the literal or metaphorical meaning of that specific part of the lyrics
   - The shot type and mood must be appropriate for the specific moment of the song

REQUIRED STRUCTURE (exact JSON):
{
  "segments": [
    {
      "id": number (must match the cut ID),
      "timeStart": number (start time in seconds, must match the cut),
      "timeEnd": number (end time in seconds, must match the cut),
      "lyrics": "EXACT part of the lyrics occurring during this time cut",
      "musical_elements": "precise description of musical elements during this cut",
      "description": "detailed visual description that faithfully represents this specific part of the lyrics",
      "imagePrompt": "detailed and specific prompt to generate an image capturing this scene",
      "shotType": "specific shot type (close-up, medium shot, wide shot, etc.)",
      "mood": "precise mood based on this specific part of the lyrics and music",
      "transition": "type of transition to the next segment"
    }
  ]
}

CRUCIAL:
- Each segment must have an ID that exactly matches the ID of the corresponding musical cut
- Start and end times must exactly match the provided musical cuts
- Image prompts must SPECIFICALLY reflect the lyrics content in that exact cut
- The description must explicitly explain how the scene relates to that specific part of the lyrics

COMPLETE SONG LYRICS:
${transcription}`;

      // Validate that the prompt is a text string
      if (typeof prompt !== 'string') {
        throw new Error("The prompt must be a text string");
      }
      
      // Call API to generate script with type validation
      const jsonContent: string = await generateVideoScriptAPI(prompt);

      try {
        // Validate and process response
        let scriptResult;
        try {
          if (typeof jsonContent === 'string') {
            scriptResult = JSON.parse(jsonContent);
          } else {
            throw new Error("The response is not a valid text string");
          }
        } catch (parseError) {
          // Try to extract valid JSON if it's within quotes, markdown, etc.
          const error = parseError as Error;
          logger.error("Error parsing JSON:", error.message);
          
          // Verify jsonContent is a string before using regex
          if (typeof jsonContent === 'string') {
            // Extract a valid JSON object from the response
            try {
              const regex = /\{[\s\S]*"segments"[\s\S]*\}/;
              const match = jsonContent.match(regex);
              if (match && match[0]) {
                scriptResult = JSON.parse(match[0]);
              } else {
                throw new Error("Could not find valid JSON with segments");
              }
            } catch (regexError) {
              logger.error("Error searching for JSON with regex:", regexError);
              throw new Error("Could not extract valid JSON from response");
            }
          } else {
            throw new Error("The response is not a valid text string");
          }
        }

        if (!scriptResult || !scriptResult.segments || !Array.isArray(scriptResult.segments)) {
          throw new Error("Invalid script format: segments array not found");
        }

        // Create a map to search segments by ID efficiently
        const segmentMap = new Map();
        scriptResult.segments.forEach((segment: { id?: number; }) => {
          if (segment && segment.id !== undefined) {
            segmentMap.set(segment.id, segment);
          }
        });

        // Update each timeline element with script information
        const updatedItems = timelineItems.map(item => {
          const scriptSegment = segmentMap.get(item.id);
          
          if (scriptSegment) {
            return {
              ...item,
              description: `Lyrics: "${scriptSegment.lyrics || 'Instrumental'}"\n\nMusic: ${scriptSegment.musical_elements || 'N/A'}\n\nScene: ${scriptSegment.description || 'N/A'}`,
              imagePrompt: `${scriptSegment.imagePrompt || ''} The scene represents these precise lyrics: "${scriptSegment.lyrics || 'Instrumental'}" with musical elements: ${scriptSegment.musical_elements || 'main rhythm'}`,
              shotType: scriptSegment.shotType || 'Medium shot',
              transition: scriptSegment.transition || 'Direct cut',
              mood: scriptSegment.mood || 'Neutral'
            };
          }
          return item;
        });

        setTimelineItems(updatedItems);
        setCurrentStep(4);

        // Save complete script for reference
        setScriptContent(JSON.stringify(scriptResult, null, 2));

        toast({
          title: "Success",
          description: "Synchronized script generated correctly with all musical cuts",
        });

      } catch (parseError) {
        const error = parseError as Error;
        logger.error("Error parsing response:", error);
        logger.error("Response content:", jsonContent);
        throw new Error("Error processing script response: " + error.message);
      }

    } catch (error) {
      logger.error("Error generating script:", error);
      toast({
        title: "Error generating script",
        description: error instanceof Error ? error.message : "Error generating synchronized video script",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  /**
   * 🎬 MEJORADO: Genera una imagen para un segmento usando prompts ricos en narrativa
   * Usa campos del script para coherencia visual y decide si incluir referencia del artista
   * @param item - El segmento del timeline con campos enriquecidos del script
   * @returns Promise<string> URL de imagen generada o null si hay error
   */
  const generateImageForSegment = async (item: TimelineItem): Promise<string | null> => {
    if (!item.imagePrompt && !item.visualDescription) {
      logger.warn(`Segment ${item.id} has no prompt to generate image`);
      return null;
    }

    try {
      logger.info(`🎨 [RICH IMG] Generando imagen para segmento ${item.id}...`);
      
      // 🎬 Construir prompt RICO EN NARRATIVA usando todos los campos del script
      const richPrompt = buildRichCinematicPrompt(item);
      
      // 🎭 Determinar si usar referencia del artista basado en campos del script
      const shouldUseArtistReference = determineArtistReferenceUsage(item);
      
      logger.info(`🎭 [SCENE ${item.id}] Category: ${item.shotCategory || 'UNKNOWN'}, ` +
                  `Reference Usage: ${item.referenceUsage || 'default'}, ` +
                  `Using Reference: ${shouldUseArtistReference}`);

      // Preparar referencias si corresponde
      let referenceImages: string[] | undefined = undefined;
      if (shouldUseArtistReference) {
        if (masterCharacter?.imageUrl) {
          referenceImages = [masterCharacter.imageUrl];
        } else if (artistReferenceImages.length > 0) {
          referenceImages = artistReferenceImages;
        }
      }
      
      // Build image generation params with enriched context
      const geminiParams: ImageGenerationParams = {
        prompt: richPrompt,
        shotType: item.shotType || 'MS',
        cinematicStyle: item.visualDescription ? 'narrative-driven' : (videoStyle.characterStyle || 'cinematic'),
        mood: item.emotion || item.mood || videoStyle.mood || 'neutral',
        duration: item.duration || 2,
        sceneNumber: typeof item.id === 'string' ? parseInt(item.id, 10) : (item.id as number),
        referenceImages: referenceImages, // Pasar referencias condicionalmente
        directorStyle: videoStyle.selectedDirector?.name || 'Cinematic Director'
      };

      logger.info(`📝 Rich Prompt (${item.shotCategory || 'scene'}): ${richPrompt.substring(0, 150)}...`);
      
      // Usar el endpoint correcto según si hay referencias
      let result;
      if (referenceImages && referenceImages.length > 0) {
        // Usar endpoint FAL con referencias faciales
        const response = await fetch('/api/fal/nano-banana/generate-with-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: richPrompt,
            referenceImages: referenceImages,
            sceneId: item.id,
            aspectRatio: '16:9'
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        result = await response.json();
        result = { success: !!result.imageUrl, imageUrl: result.imageUrl, error: result.error };
      } else {
        // Generar sin referencias (B-roll puro) usando FAL nano-banana
        const response = await fetch('/api/fal/nano-banana/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: richPrompt,
            aspectRatio: '16:9'
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        result = await response.json();
        result = { success: !!result.imageUrl, imageUrl: result.imageUrl, error: result.error };
      }

      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || 'Error generating image');
      }

      logger.info(`✅ Imagen generada exitosamente: ${result.imageUrl.substring(0, 100)}`);

      // Upload to Firebase for persistence
      if (user?.id) {
        logger.info(`📤 Subiendo imagen a Firebase Storage...`);
        const permanentUrl = await uploadImageFromUrl(result.imageUrl, user.id, projectName);
        logger.info(`✅ Imagen guardada permanentemente en Firebase Storage`);
        return permanentUrl;
      } else {
        logger.warn(`⚠️ No user ID - using temporary URL`);
        return result.imageUrl;
      }

    } catch (error) {
      logger.error(`❌ Error generando imagen para segmento ${item.id}:`, error);
      return null;
    }
  };
  
  /**
   * 🎬 Construye un prompt cinematográfico RICO usando todos los campos narrativos del script
   */
  const buildRichCinematicPrompt = (item: TimelineItem): string => {
    const parts: string[] = [];
    
    // 1. Descripción visual principal (lo más importante)
    const mainDescription = item.visualDescription || item.imagePrompt || item.description || '';
    parts.push(mainDescription);
    
    // 2. Contexto narrativo si existe
    if (item.narrativeContext) {
      parts.push(`Story context: ${item.narrativeContext}`);
    }
    
    // 3. Conexión con la letra
    if (item.lyricConnection) {
      parts.push(`Lyric connection: ${item.lyricConnection}`);
    }
    
    // 4. Especificaciones técnicas de cámara
    const cameraSpecs: string[] = [];
    if (item.shotType) cameraSpecs.push(`${item.shotType} shot`);
    if (item.cameraMovement) cameraSpecs.push(`${item.cameraMovement} movement`);
    if (item.lens) cameraSpecs.push(`${item.lens} lens`);
    if (cameraSpecs.length > 0) {
      parts.push(`Camera: ${cameraSpecs.join(', ')}`);
    }
    
    // 5. Iluminación y color
    if (item.lighting) {
      parts.push(`Lighting: ${item.lighting}`);
    }
    if (item.colorGrading) {
      parts.push(`Color grade: ${item.colorGrading}`);
    }
    
    // 6. Emoción de la escena
    if (item.emotion) {
      parts.push(`Emotion: ${item.emotion}`);
    }
    
    // 7. Ubicación
    if (item.location) {
      parts.push(`Location: ${item.location}`);
    }
    
    // 8. Contexto de tipo de escena
    const shotCategory = item.shotCategory || 'STORY';
    if (shotCategory === 'PERFORMANCE') {
      parts.push('Music video performance scene with artist singing/performing');
    } else if (shotCategory === 'B-ROLL') {
      parts.push('Cinematic b-roll visual, atmospheric and artistic, no people in focus');
    } else {
      parts.push('Narrative story scene with strong visual storytelling');
    }
    
    // 9. Calidad profesional
    parts.push('Professional music video quality, cinematic composition, broadcast-ready');
    
    return parts.join('. ');
  };
  
  /**
   * 🎭 Determina si se debe usar la referencia del artista basado en campos del script
   */
  const determineArtistReferenceUsage = (item: TimelineItem): boolean => {
    // Si el script especifica explícitamente NO usar referencia
    if (item.useArtistReference === false) {
      return false;
    }
    
    // Si reference_usage es 'none', no usar referencia
    if (item.referenceUsage === 'none') {
      return false;
    }
    
    // B-ROLL puro normalmente no necesita referencia del artista
    if (item.shotCategory === 'B-ROLL' && !item.useArtistReference) {
      return false;
    }
    
    // Para PERFORMANCE siempre usar referencia
    if (item.shotCategory === 'PERFORMANCE') {
      return true;
    }
    
    // Para STORY, depende del reference_usage
    if (item.shotCategory === 'STORY') {
      return item.referenceUsage === 'story_character' || item.useArtistReference === true;
    }
    
    // Tipos específicos que requieren referencia
    const typesRequiringReference = ['full_performance', 'detail_shot', 'alternate_angle', 'story_character'];
    if (item.referenceUsage && typesRequiringReference.includes(item.referenceUsage)) {
      return true;
    }
    
    // Default: usar referencia si está disponible (backward compatibility)
    return true;
  };

  /**
   * Waits for image generation to complete in Flux API via polling
   * @param taskId ID of the image generation task
   * @returns URL of generated image or null if it fails
   */
  const waitForFluxImageGeneration = async (taskId: string): Promise<string | null> => {
    const maxAttempts = 40; // Maximum number of attempts to check status
    const pollingInterval = 1500; // Interval between checks (1.5 seconds)
    let attempts = 0;

    // Function to make a single check attempt
    const checkStatus = async (): Promise<string | null> => {
      const statusResult = await fluxService.checkTaskStatus(taskId);
      
      logger.info(`Task ${taskId} status:`, statusResult.status);
      
      if (statusResult.success && statusResult.status === 'completed' && statusResult.images && statusResult.images.length > 0) {
        return statusResult.images[0];
      } else if (!statusResult.success || statusResult.status === 'failed') {
        throw new Error(`Image generation failed: ${statusResult.error || 'Unknown error'}`);
      }
      
      return null; // Still processing
    };

    // Polling loop
    while (attempts < maxAttempts) {
      try {
        const result = await checkStatus();
        if (result) {
          return result; // Image successfully generated
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
        attempts++;
      } catch (error) {
        logger.error('Error checking generation status:', error);
        return null;
      }
    }

    logger.error(`Timeout expired after ${attempts} attempts for task ${taskId}`);
    return null;
  };

  /**
   * Regenerates the image for a specific segment
   * @param item - The timeline segment whose image will be regenerated
   */
  const regenerateImage = async (item: TimelineItem) => {
    if (!item.imagePrompt) {
      toast({
        title: "Error",
        description: "This segment has no prompt to generate image",
        variant: "destructive",
      });
      return;
    }

    try {
      const imageUrl = await generateImageForSegment(item);
      
      if (imageUrl) {
        const updatedItems = timelineItems.map(timelineItem =>
          timelineItem.id === item.id
            ? { ...timelineItem, generatedImage: imageUrl }
            : timelineItem
        );
        setTimelineItems(updatedItems);

        toast({
          title: "Image regenerated",
          description: "The image has been successfully regenerated",
        });
      } else {
        throw new Error("Could not generate image");
      }
    } catch (error) {
      logger.error("Error regenerating image:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error regenerating image",
        variant: "destructive",
      });
    }
  };

  /**
   * Regenerate image for a specific clip following the script
   */
  const handleRegenerateImageFromTimeline = async (clipId: number) => {
    const item = timelineItems.find(item => item.id === clipId);
    if (!item) {
      toast({
        title: "Error",
        description: "Scene not found in timeline",
        variant: "destructive",
      });
      return;
    }

    if (!scriptContent) {
      toast({
        title: "Error",
        description: "You need a script first to regenerate the image",
        variant: "destructive",
      });
      return;
    }

    try {
      // Extract scene number from item id
      const sceneMatch = item.id.toString().match(/(\d+)$/);
      if (!sceneMatch) {
        throw new Error("Could not identify scene number");
      }
      
      const sceneNumber = parseInt(sceneMatch[1]);
      
      // Get scene data from script
      const parsedScript = JSON.parse(scriptContent);
      const scenes = parsedScript.scenes || parsedScript;
      const scene = scenes[sceneNumber - 1];
      
      if (!scene) {
        throw new Error("Scene not found in script");
      }

      toast({
        title: "Regenerating image",
        description: `Generating new image for scene ${sceneNumber}...`,
      });

      // Build CONTEXT-RICH prompt using the SAME enriched format as initial generation
      const shotCategory = scene.shot_category || 'STORY';
      const narrativeContext = scene.narrative_context || '';
      const lyricConnection = scene.lyric_connection || '';
      const visualDescription = scene.visual_description || scene.description || scene.scene;
      const emotion = scene.emotion || scene.mood || '';
      const storyProgression = scene.story_progression || '';
      
      // Extract global context from parsed script
      const narrativeSummary = parsedScript.narrative_summary || '';
      const directorName = videoStyle.selectedDirector?.name || 'Cinematic Director';
      const conceptStory = selectedConcept?.story_concept || '';
      
      // Build enriched prompt matching initial generation
      const prompt = `MUSIC VIDEO CONTEXT:
${narrativeSummary ? `Overall Story: ${narrativeSummary}` : ''}
${conceptStory ? `Concept: ${conceptStory}` : ''}
Director Style: ${directorName}

SCENE ${sceneNumber} - ${shotCategory} SHOT:
${visualDescription}

NARRATIVE:
${narrativeContext}

LYRIC CONNECTION:
${lyricConnection}

STORY ARC:
${storyProgression}

EMOTION: ${emotion}

TECHNICAL SPECS:
Camera: ${scene.camera_movement || 'static'}, ${scene.shot_type || 'medium-shot'}
Lighting: ${scene.lighting || 'natural lighting'}
Style: ${scene.visual_style || 'cinematic'}
Shot Type: ${scene.shot_type || 'medium-shot'}
Color Grading: ${scene.color_grading || 'cinematic'}
Location: ${scene.location || 'performance space'}

Professional music video frame, ${shotCategory === 'PERFORMANCE' ? 'featuring the artist performing/singing' : shotCategory === 'B-ROLL' ? 'cinematic b-roll visual WITHOUT the artist visible' : 'narrative story scene with characters/elements'}, high production quality, ${directorName} directorial style, cohesive with overall music video narrative.`;
      
      logger.info(`🔄 [REGENERATE] Using enriched prompt for scene ${sceneNumber} with category: ${shotCategory}`);
      
      const hasReferenceImages = artistReferenceImages && artistReferenceImages.length > 0;
      
      // Determine if should use artist reference using the advanced logic
      const useArtistReference = scene.use_artist_reference !== false; // Default true for backward compatibility
      const referenceUsage = scene.reference_usage || 
                            (shotCategory === 'PERFORMANCE' ? 'full_performance' : 'none');
      
      const shouldUseReference = useArtistReference && 
                                (referenceUsage !== 'none') &&
                                (masterCharacter || hasReferenceImages);
      
      const referenceToUse = shouldUseReference 
        ? (masterCharacter ? [masterCharacter.imageUrl] : artistReferenceImages)
        : undefined;
      
      logger.info(`🔄 [REGENERATE ${sceneNumber}] Reference Usage: ${referenceUsage}, Using Reference: ${!!referenceToUse}`);
      
      const endpoint = shouldUseReference
        ? '/api/fal/nano-banana/generate-with-face'
        : '/api/fal/nano-banana/generate';

      const requestBody = shouldUseReference
        ? { 
            prompt: prompt,
            sceneId: sceneNumber,
            referenceImages: referenceToUse,
            aspectRatio: '16:9'
          }
        : { 
            prompt: prompt,
            aspectRatio: '16:9'
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.imageUrl) {
        // Upload to Firebase Storage
        let permanentImageUrl = data.imageUrl;
        if (user?.uid) {
          try {
            permanentImageUrl = await uploadImageFromUrl(data.imageUrl, user?.id, projectName);
          } catch (uploadError) {
            logger.warn('Error uploading to Firebase, using temporary URL:', uploadError);
          }
        }

        // Update timeline
        setTimelineItems(prevItems => 
          prevItems.map(timelineItem =>
            timelineItem.id === item.id
              ? {
                  ...timelineItem,
                  imageUrl: permanentImageUrl,
                  thumbnail: permanentImageUrl,
                  url: permanentImageUrl,
                  generatedImage: permanentImageUrl,
                  metadata: {
                    ...timelineItem.metadata,
                    isGeneratedImage: true,
                    imageGeneratedAt: new Date().toISOString(),
                  }
                }
              : timelineItem
          )
        );

        toast({
          title: "Image regenerated!",
          description: `Scene ${sceneNumber} has been successfully regenerated`,
        });
      } else {
        throw new Error(data.error || 'Failed to generate image');
      }
    } catch (error) {
      logger.error("Error regenerating image:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error regenerating image",
        variant: "destructive",
      });
    }
  };

  /**
   * Generate video from a specific clip image
   */
  const handleGenerateVideoFromTimeline = async (clipId: number) => {
    const item = timelineItems.find(item => item.id === clipId);
    if (!item) {
      toast({
        title: "Error",
        description: "Scene not found in timeline",
        variant: "destructive",
      });
      return;
    }

    const imageUrl = item.imageUrl || item.generatedImage || item.thumbnail;
    if (!imageUrl) {
      toast({
        title: "Error",
        description: "This scene has no image to convert to video",
        variant: "destructive",
      });
      return;
    }

    try {
      const sceneMatch = item.id.toString().match(/(\d+)$/);
      const sceneNumber = sceneMatch ? parseInt(sceneMatch[1]) : 0;

      toast({
        title: "Generating video",
        description: `Converting scene ${sceneNumber} image to video...`,
      });

      // Use FAL AI to generate video from image
      const videoPrompt = item.imagePrompt || item.title || 'Dynamic camera movement';
      
      // Para modelos O1 reference-to-video, pasar las imágenes de referencia del artista
      const isReferenceModel = selectedFalModel.includes('reference-to-video');
      
      const response = await generateVideoWithFAL(selectedFalModel, {
        imageUrl: imageUrl as string,
        prompt: videoPrompt,
        duration: String(Math.floor(item.duration || 3)) as "5" | "10",
        // Pasar imágenes de referencia del artista para consistencia (solo O1 reference-to-video)
        referenceImages: isReferenceModel && artistReferenceImages.length > 0 
          ? artistReferenceImages 
          : undefined
      });

      if (response && response.videoUrl) {
        // Update timeline with video
        setTimelineItems(prevItems =>
          prevItems.map(timelineItem =>
            timelineItem.id === item.id
              ? {
                  ...timelineItem,
                  videoUrl: response.videoUrl,
                  metadata: {
                    ...timelineItem.metadata,
                    videoGenerated: true,
                    videoGeneratedAt: new Date().toISOString(),
                  }
                }
              : timelineItem
          )
        );

        toast({
          title: "Video generated!",
          description: `Scene ${sceneNumber} has been successfully converted to video`,
        });
      } else {
        throw new Error('Failed to generate video');
      }
    } catch (error) {
      logger.error("Error generating video:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error generating video",
        variant: "destructive",
      });
    }
  };

  /**
   * Guardar proyecto en PostgreSQL
   */
  const handleSaveProject = async () => {
    logger.info('🔍 [SAVE] Verificando autenticación:', { 
      user: user ? 'exists' : 'null', 
      uid: user?.uid || 'undefined',
      email: user?.email || 'undefined'
    });
    
    if (!user?.email) {
      logger.error('❌ [SAVE] Usuario no autenticado o sin email');
      toast({
        title: "Autenticación requerida",
        description: "Por favor inicia sesión para guardar tu proyecto.",
        variant: "destructive"
      });
      return;
    }
    
    const userEmail = user.email;
    
    logger.info('✅ [SAVE] Usuario autenticado:', user.email);

    if (!projectName.trim()) {
      toast({
        title: "Project name required",
        description: "Please enter a name for your project",
        variant: "destructive"
      });
      return;
    }

    setIsSavingProject(true);
    try {
      const imagesGenerated = timelineItems.filter(item => item.generatedImage || item.firebaseUrl).length;
      const videosGenerated = timelineItems.filter(item => item.videoUrl || item.lipsyncVideoUrl).length;
      
      // Generar thumbnail desde la primera imagen generada
      const firstImageItem = timelineItems.find(item => item.generatedImage || item.firebaseUrl);
      const thumbnail = firstImageItem?.generatedImage || firstImageItem?.firebaseUrl || undefined;
      
      // Extraer artistName y songName del projectName si no están definidos
      const extractedArtistName = artistName || projectName.split(' - ')[0] || 'Unknown Artist';
      const extractedSongName = songName || selectedFile?.name?.replace(/\.[^/.]+$/, '') || projectName.split(' - ')[1] || 'Untitled Song';
      
      const result = await musicVideoProjectServicePostgres.saveProject({
        userEmail: userEmail,
        projectName,
        artistName: extractedArtistName,
        songName: extractedSongName,
        thumbnail,
        audioUrl: audioUrl || undefined,
        audioDuration: audioBuffer?.duration,
        transcription: transcription || undefined,
        scriptContent: scriptContent || undefined,
        timelineItems,
        selectedDirector: videoStyle.selectedDirector ? {
          id: videoStyle.selectedDirector.id || '',
          name: videoStyle.selectedDirector.name || '',
          specialty: videoStyle.selectedDirector.specialty || '',
          style: videoStyle.selectedDirector.style || '',
          experience: videoStyle.selectedDirector.experience || ''
        } : undefined,
        videoStyle: {
          cameraFormat: videoStyle.cameraFormat,
          mood: videoStyle.mood,
          characterStyle: videoStyle.characterStyle,
          colorPalette: videoStyle.colorPalette,
          visualIntensity: videoStyle.visualIntensity,
          narrativeIntensity: videoStyle.narrativeIntensity,
          selectedDirector: videoStyle.selectedDirector
        },
        artistReferenceImages,
        selectedEditingStyle: {
          id: selectedEditingStyle.id,
          name: selectedEditingStyle.name,
          description: selectedEditingStyle.description,
          duration: selectedEditingStyle.duration
        },
        status: videosGenerated === timelineItems.length && timelineItems.length > 0 ? "completed" : 
                imagesGenerated > 0 ? "generating_images" :
                scriptContent ? "generating_script" : "draft",
        progress: {
          scriptGenerated: !!scriptContent,
          imagesGenerated,
          totalImages: timelineItems.length,
          videosGenerated,
          totalVideos: timelineItems.length
        }
      });

      setCurrentProjectId(String(result.project.id));
      toast({
        title: "Project saved",
        description: `"${projectName}" has been ${result.isNew ? 'created' : 'updated'} successfully`
      });
    } catch (error) {
      logger.error('Error saving project:', error);
      toast({
        title: "Error saving project",
        description: "Could not save your project",
        variant: "destructive"
      });
    } finally {
      setIsSavingProject(false);
    }
  };

  /**
   * Cargar proyecto desde PostgreSQL
   */
  const handleLoadProject = async (projectId: string) => {
    if (!user?.email) return;
    
    try {
      const project = await musicVideoProjectServicePostgres.getProject(Number(projectId));
      if (!project) {
        toast({
          title: "Error",
          description: "Project not found",
          variant: "destructive"
        });
        return;
      }

      setProjectName(project.projectName);
      setArtistName(project.artistName || '');
      setSongName(project.songName || '');
      setCurrentProjectId(String(project.id));
      setAudioUrl(project.audioUrl || null);
      setTranscription(project.transcription || "");
      setScriptContent(project.scriptContent || "");
      setTimelineItems(project.timelineItems);
      setArtistReferenceImages(project.artistReferenceImages || []);
      
      // 🎵 RESTORE AUDIO BUFFER: Load audio for lipsync when restoring project
      if (project.audioUrl) {
        try {
          logger.info('🎵 [LOAD PROJECT] Loading audio buffer from saved URL...');
          // Use proxy for Firebase Storage URLs to avoid CORS issues
          const isFirebaseUrl = project.audioUrl.includes('storage.googleapis.com') || 
                                project.audioUrl.includes('firebasestorage.googleapis.com');
          const fetchUrl = isFirebaseUrl 
            ? `/api/proxy/firebase-file?url=${encodeURIComponent(project.audioUrl)}`
            : project.audioUrl;
          const audioResponse = await fetch(fetchUrl);
          const audioArrayBuffer = await audioResponse.arrayBuffer();
          
          if (!audioContext.current) {
            audioContext.current = new AudioContext();
          }
          const buffer = await audioContext.current.decodeAudioData(audioArrayBuffer);
          setAudioBuffer(buffer);
          logger.info('✅ [LOAD PROJECT] Audio buffer loaded successfully for lipsync');
        } catch (audioError) {
          logger.warn('⚠️ [LOAD PROJECT] Could not load audio buffer (lipsync may not work):', audioError);
        }
      }
      
      // 💳 RESTORE PAYMENT STATUS: Restore isPaid from saved project
      if (project.isPaid) {
        setHasUserPaid(true);
        logger.info('💳 [LOAD PROJECT] Restored isPaid=true from saved project');
      }
      
      if (project.videoStyle) {
        setVideoStyle(project.videoStyle as any);
      }
      
      if (project.selectedEditingStyle) {
        const editingStyle = editingStyles.find(s => s.id === project.selectedEditingStyle?.id);
        if (editingStyle) {
          setSelectedEditingStyle(editingStyle);
        }
      }
      
      toast({
        title: "Project loaded",
        description: `"${project.projectName}" has been loaded successfully`
      });
    } catch (error) {
      logger.error('Error loading project:', error);
      toast({
        title: "Error loading project",
        description: "Could not load the project",
        variant: "destructive"
      });
    }
  };

  /**
   * Auto-guardado silencioso (sin toast)
   */
  const handleAutoSave = useCallback(async () => {
    if (!user?.email || !hasUnsavedChanges || !autoSaveEnabled) {
      return;
    }

    // Use a default name if projectName is empty so auto-save still works
    const effectiveProjectName = projectName.trim() || 'Untitled Project';

    logger.info('🔄 Auto-guardando proyecto...');
    
    const userEmail = user.email;
    
    try {
      const imagesGenerated = timelineItems.filter(item => item.generatedImage || item.firebaseUrl).length;
      const videosGenerated = timelineItems.filter(item => item.videoUrl || item.lipsyncVideoUrl).length;
      
      // Generar thumbnail desde la primera imagen generada
      const firstImageItem = timelineItems.find(item => item.generatedImage || item.firebaseUrl);
      const thumbnail = firstImageItem?.generatedImage || firstImageItem?.firebaseUrl || undefined;
      
      // Extraer artistName y songName del projectName si no están definidos
      const extractedArtistName = artistName || effectiveProjectName.split(' - ')[0] || 'Unknown Artist';
      const extractedSongName = songName || selectedFile?.name?.replace(/\.[^/.]+$/, '') || effectiveProjectName.split(' - ')[1] || 'Untitled Song';
      
      const result = await musicVideoProjectServicePostgres.saveProject({
        userEmail: userEmail,
        projectName: effectiveProjectName,
        artistName: extractedArtistName,
        songName: extractedSongName,
        thumbnail,
        audioUrl: audioUrl || undefined,
        audioDuration: audioBuffer?.duration,
        transcription: transcription || undefined,
        scriptContent: scriptContent || undefined,
        timelineItems,
        selectedDirector: videoStyle.selectedDirector ? {
          id: videoStyle.selectedDirector.id || '',
          name: videoStyle.selectedDirector.name || '',
          specialty: videoStyle.selectedDirector.specialty || '',
          style: videoStyle.selectedDirector.style || '',
          experience: videoStyle.selectedDirector.experience || ''
        } : undefined,
        videoStyle: {
          cameraFormat: videoStyle.cameraFormat,
          mood: videoStyle.mood,
          characterStyle: videoStyle.characterStyle,
          colorPalette: videoStyle.colorPalette,
          visualIntensity: videoStyle.visualIntensity,
          narrativeIntensity: videoStyle.narrativeIntensity,
          selectedDirector: videoStyle.selectedDirector
        },
        artistReferenceImages,
        selectedEditingStyle: {
          id: selectedEditingStyle.id,
          name: selectedEditingStyle.name,
          description: selectedEditingStyle.description,
          duration: selectedEditingStyle.duration
        },
        status: videosGenerated === timelineItems.length && timelineItems.length > 0 ? "completed" : 
                imagesGenerated > 0 ? "generating_images" :
                scriptContent ? "generating_script" : "draft",
        progress: {
          scriptGenerated: !!scriptContent,
          imagesGenerated,
          totalImages: timelineItems.length,
          videosGenerated,
          totalVideos: timelineItems.length
        }
      });

      setCurrentProjectId(String(result.project.id));
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
      logger.info('✅ Auto-guardado completado');
    } catch (error) {
      logger.error('❌ Error en auto-guardado:', error);
    }
  }, [user, projectName, hasUnsavedChanges, autoSaveEnabled, timelineItems, audioUrl, audioBuffer, transcription, scriptContent, videoStyle, artistReferenceImages, selectedEditingStyle]);

  /**
   * Detectar cambios no guardados
   */
  useEffect(() => {
    if (timelineItems.length > 0 || transcription || scriptContent) {
      setHasUnsavedChanges(true);
    }
  }, [timelineItems, transcription, scriptContent]);

  /**
   * Auto-guardado cada 30 segundos
   */
  useEffect(() => {
    if (!autoSaveEnabled) return;

    const autoSaveInterval = setInterval(() => {
      handleAutoSave();
    }, 30000); // 30 segundos

    return () => clearInterval(autoSaveInterval);
  }, [handleAutoSave, autoSaveEnabled]);

  /**
   * Atajos de teclado globales
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S: Guardar
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveProject();
      }
      
      // Ctrl/Cmd + O: Abrir proyecto
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        setShowLoadProjectDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveProject]);

  /**
   * Proteger contra pérdida de trabajo: beforeunload
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && timelineItems.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, timelineItems.length]);

  /**
   * Actualizar estado de guardado cuando se guarda manualmente
   */
  useEffect(() => {
    if (!isSavingProject && currentProjectId) {
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
    }
  }, [isSavingProject, currentProjectId]);

  /**
   * Batch regenerate images - Regenerar múltiples imágenes seleccionadas
   */
  const handleBatchRegenerateImages = useCallback(async () => {
    if (selectedClipIds.length === 0) {
      toast({
        title: "No hay clips seleccionados",
        description: "Selecciona al menos un clip para regenerar",
        variant: "destructive"
      });
      return;
    }

    setIsBatchRegenerating(true);
    
    try {
      let successCount = 0;
      let failCount = 0;

      for (const clipId of selectedClipIds) {
        const item = timelineItems.find(i => i.id === clipId);
        if (!item) continue;

        try {
          logger.info(`🔄 Regenerando imagen ${clipId}...`);
          
          const promptToUse = item.imagePrompt || item.description || `Scene ${clipId}`;
          
          const response = await fetch('/api/fal/nano-banana/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: promptToUse,
              aspectRatio: '16:9'
            })
          });

          if (!response.ok) throw new Error('Failed to generate image');
          
          const data = await response.json();
          
          if (data.success && data.imageUrl) {
            let permanentImageUrl = data.imageUrl;
            
            if (user?.uid) {
              try {
                permanentImageUrl = await uploadImageFromUrl(data.imageUrl, user?.id, projectName);
              } catch (error) {
                logger.warn('Error uploading to Firebase, using temporary URL:', error);
              }
            }
            
            setTimelineItems(prevItems =>
              prevItems.map(prevItem =>
                prevItem.id === clipId
                  ? {
                      ...prevItem,
                      generatedImage: permanentImageUrl,
                      firebaseUrl: permanentImageUrl,
                      metadata: {
                        ...prevItem.metadata,
                        isGeneratedImage: true
                      }
                    }
                  : prevItem
              )
            );
            
            successCount++;
          } else {
            throw new Error('No image URL returned');
          }
        } catch (error) {
          logger.error(`Error regenerating clip ${clipId}:`, error);
          failCount++;
        }
      }

      toast({
        title: "Regeneración completada",
        description: `${successCount} imágenes regeneradas exitosamente${failCount > 0 ? `, ${failCount} fallaron` : ''}`,
      });

      // Limpiar selección
      setSelectedClipIds([]);
    } catch (error) {
      logger.error('Error in batch regeneration:', error);
      toast({
        title: "Error",
        description: "Error al regenerar imágenes",
        variant: "destructive"
      });
    } finally {
      setIsBatchRegenerating(false);
    }
  }, [selectedClipIds, timelineItems, user, projectName, toast]);

  /**
   * Generar video individual para una escena
   */
  const handleGenerateIndividualVideo = async (modelId: string, sceneId?: number) => {
    if (!sceneId) {
      toast({
        title: "Error",
        description: "Please select a scene from the timeline",
        variant: "destructive"
      });
      return;
    }
    
    const scene = timelineItems.find(item => item.id === sceneId);
    if (!scene || (!scene.generatedImage && !scene.imageUrl && !scene.firebaseUrl)) {
      toast({
        title: "Cannot generate video",
        description: "Scene must have a generated image first",
        variant: "destructive"
      });
      return;
    }

    const imageUrl = (scene.generatedImage || scene.imageUrl || scene.firebaseUrl || '') as string;

    setIsGeneratingVideos(true);
    try {
      const prompt = scene.imagePrompt || scene.description || "Cinematic video animation";
      const cameraMove = scene.metadata?._cinematography?.movement || (scene as any).movement || '';
      const filmLook = (scene as any).filmEmulation || scene.metadata?._film_emulation || '';
      const enrichedPrompt = `${prompt}${cameraMove ? `, ${cameraMove}` : ''}${filmLook ? `, ${filmLook} film look` : ''}, professional music video`;
      
      const result = await generateVideoWithFAL(modelId, {
        prompt: enrichedPrompt,
        imageUrl,
        duration: "5",
        aspectRatio: videoAspectRatio || "16:9",
        negativePrompt: 'blur, distort, static, frozen, morphing face, deformed',
        cfgScale: 0.5
      });

      if (result.success && result.videoUrl) {
        const updatedItems = timelineItems.map(item =>
          item.id === sceneId
            ? { ...item, videoUrl: result.videoUrl }
            : item
        );
        setTimelineItems(updatedItems);

        toast({
          title: "Video generated",
          description: `Video for scene ${sceneId} has been generated successfully`
        });
      } else {
        throw new Error(result.error || "Failed to generate video");
      }
    } catch (error) {
      logger.error('Error generating video:', error);
      toast({
        title: "Error generating video",
        description: error instanceof Error ? error.message : "Could not generate video",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingVideos(false);
    }
  };

  /**
   * Generar videos para todas las escenas
   */
  const handleGenerateAllVideos = async (modelId: string) => {
    const scenesWithImages = timelineItems.filter(item => item.generatedImage);
    
    if (scenesWithImages.length === 0) {
      toast({
        title: "No images to animate",
        description: "Please generate images first",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingVideos(true);
    setVideoGenerationProgress({ current: 0, total: scenesWithImages.length });

    try {
      const scenes = scenesWithImages.map(item => {
        const camMove = item.metadata?._cinematography?.movement || (item as any).movement || '';
        const fLook = (item as any).filmEmulation || item.metadata?._film_emulation || '';
        const base = item.imagePrompt || item.description || 'Cinematic video animation';
        return {
          prompt: `${base}${camMove ? `, ${camMove}` : ''}${fLook ? `, ${fLook} film look` : ''}, professional music video`,
          imageUrl: (item.generatedImage || item.firebaseUrl || "") as string
        };
      });

      const results = await generateMultipleVideos(modelId, scenes);

      let successCount = 0;
      const updatedItems = [...timelineItems];

      results.forEach((result, index) => {
        setVideoGenerationProgress({ current: index + 1, total: scenesWithImages.length });
        
        if (result.success && result.videoUrl) {
          const originalScene = scenesWithImages[index];
          const itemIndex = updatedItems.findIndex(item => item.id === originalScene.id);
          if (itemIndex !== -1) {
            updatedItems[itemIndex] = {
              ...updatedItems[itemIndex],
              videoUrl: result.videoUrl
            };
            successCount++;
          }
        }
      });

      setTimelineItems(updatedItems);
      
      toast({
        title: "Videos generated",
        description: `Successfully generated ${successCount} out of ${scenesWithImages.length} videos`
      });
    } catch (error) {
      logger.error('Error generating videos:', error);
      toast({
        title: "Error generating videos",
        description: error instanceof Error ? error.message : "Could not generate videos",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingVideos(false);
      setVideoGenerationProgress({ current: 0, total: 0 });
    }
  };

  // Calculamos un estimado de duración antes de generar los clips
  // para evitar la dependencia circular
  const estimatedDuration = useMemo(() => {
    // Si tenemos audioBuffer, usamos su duración como fuente principal
    if (audioBuffer) {
      return audioBuffer.duration;
    }
    
    // Si tenemos items de timeline, calculamos la duración en base a ellos
    if (timelineItems.length > 0) {
      const lastItem = timelineItems[timelineItems.length - 1];
      return (lastItem.end_time - timelineItems[0].start_time) / 1000; // Convertir a segundos
    }
    
    // Duración predeterminada si no hay otras fuentes
    return 180; // 3 minutos por defecto
  }, [audioBuffer, timelineItems]);

  // Auto-guardar proyecto cada 5 segundos cuando hay cambios
  useEffect(() => {
    if (user?.uid && projectName && timelineItems.length > 0 && audioUrl) {
      musicVideoProjectService.autoSave(
        user?.id,
        projectName,
        {
          audioUrl,
          timelineItems,
          artistReferences: artistReferenceImages,
          editingStyle: selectedEditingStyle.id,
          duration: estimatedDuration
        },
        currentProjectId
      );
    }
  }, [user?.uid, projectName, timelineItems, audioUrl, artistReferenceImages, selectedEditingStyle, currentProjectId, estimatedDuration]);

  const generateTimelineItems = useCallback((shots: { duration?: string; shotType: string; description: string; imagePrompt?: string; transition?: string }[]) => {
    const baseTime = Date.now();
    let currentTime = baseTime;

    const items = shots.map((shot, index) => {
      const duration = shot.duration ? parseFloat(shot.duration) * 1000 : Math.floor(Math.random() * (5000 - 1000) + 1000);
      const item: TimelineItem = {
        id: index + 1,
        group: 1,
        title: shot.shotType,
        start_time: currentTime,
        end_time: currentTime + duration,
        description: shot.description,
        shotType: shot.shotType,
        imagePrompt: shot.imagePrompt,
        generatedImage: undefined,
        duration: duration,
        transition: shot.transition || "cut",
        // Campos necesarios para compatibilidad con TimelineClip
        start: (currentTime - baseTime) / 1000,
        type: 'image',
        thumbnail: undefined,
        mood: 'neutral'
      };
      currentTime += duration;
      return item;
    });

    setTimelineItems(items);
    setVisibleTimeStart(baseTime);
    setVisibleTimeEnd(currentTime);
    setZoomLevel(1);
  }, []);

  const handleTimeChange = (visibleTimeStart: number, visibleTimeEnd: number) => {
    setVisibleTimeStart(visibleTimeStart);
    setVisibleTimeEnd(visibleTimeEnd);
  };

  const togglePlayback = useCallback(() => {
    if (!audioBuffer || !audioContext.current) return;

    if (isPlaying) {
      audioSource.current?.stop();
      setIsPlaying(false);
    } else {
      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
      source.start(0, currentTime / 1000);
      audioSource.current = source;
      setIsPlaying(true);
    }
  }, [isPlaying, audioBuffer, currentTime]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.1));
  };

  const handleReset = () => {
    if (timelineItems.length > 0) {
      setCurrentTime(timelineItems[0].start_time);
      setIsPlaying(false);
    }
  };

  const handleSkipForward = () => {
    if (timelineItems.length > 0) {
      const currentIndex = timelineItems.findIndex(item => item.start_time > currentTime);
      if (currentIndex !== -1) {
        setCurrentTime(timelineItems[currentIndex].start_time);
      }
    }
  };

  const handleSkipBackward = () => {
    if (timelineItems.length > 0) {
      const currentIndex = timelineItems.findIndex(item => item.end_time > currentTime) - 1;
      if (currentIndex >= 0) {
        setCurrentTime(timelineItems[currentIndex].start_time);
      } else {
        setCurrentTime(timelineItems[0].start_time);
      }
    }
  };

  const saveToFirebase = async (item: TimelineItem) => {
    if (!item.generatedImage) return null;

    try {
      // Make sure generatedImage is a valid URL (string)
      const imageUrl = typeof item.generatedImage === 'string' ? item.generatedImage : '';
      if (!imageUrl) return null;
      
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const storageRef = ref(storage, `videos/${Date.now()}_${item.id}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      return url;
    } catch (error) {
      logger.error("Error saving to Firebase:", error);
      return null;
    }
  };

  /**
   * Generates images for all segments that have prompts
   * Processes segments in parallel in batches to optimize time
   */
  const generateShotImages = async () => {
    if (timelineItems.length === 0) {
      toast({
        title: "Error",
        description: "No segments to generate images",
        variant: "destructive",
      });
      return;
    }

    // Verify there are generated prompts
    const itemsWithoutPrompts = timelineItems.filter(item => !item.imagePrompt).length;
    if (itemsWithoutPrompts === timelineItems.length) {
      toast({
        title: "Error",
        description: "Segments have no prompts to generate images",
        variant: "destructive",
      });
      return;
    }

    if (itemsWithoutPrompts > 0) {
      toast({
        title: "Warning",
        description: `${itemsWithoutPrompts} segments have no prompts and will be skipped`,
        variant: "default",
      });
    }

    setIsGeneratingShots(true);
    
    // ✅ ELIMINADO LÍMITE: Generar imágenes para TODOS los segmentos con prompts
    const items = timelineItems
      .filter(item => item.imagePrompt && !item.generatedImage);
    
    logger.info(`🎨 Generando imágenes para ${items.length} segmentos (de ${timelineItems.length} totales)`);

    if (items.length === 0) {
      toast({
        title: "Information",
        description: "All segments already have generated images",
      });
      setIsGeneratingShots(false);
      return;
    }
    
    // Advertir si hay muchas imágenes por generar
    if (items.length > 20) {
      logger.info(`⏱️ Generando ${items.length} imágenes - esto puede tomar varios minutos...`);
    }

    // Inicializar progreso
    setGenerationProgress({
      current: 0,
      total: items.length,
      percentage: 0,
      currentPrompt: items[0]?.imagePrompt || '',
      generatedImages: [],
      status: 'Preparando generación...'
    });

    try {
      let successCount = 0;
      let failCount = 0;

      // Process in batches of 2 to balance speed and stability
      const batchSize = 2;
      
      for (let i = 0; i < items.length; i += batchSize) {
        const currentBatch = items.slice(i, i + batchSize);
        
        try {
          // Actualizar estado antes de procesar el batch
          const batchNumber = Math.floor(i/batchSize) + 1;
          const totalBatches = Math.ceil(items.length/batchSize);
          
          setGenerationProgress(prev => ({
            ...prev,
            status: `Procesando lote ${batchNumber} de ${totalBatches}...`,
            currentPrompt: currentBatch[0]?.imagePrompt || ''
          }));

          // Generate images for current batch - SECUENCIALMENTE para mostrar progreso en tiempo real
          const results = [];
          
          for (let batchIndex = 0; batchIndex < currentBatch.length; batchIndex++) {
            const item = currentBatch[batchIndex];
            const globalIndex = i + batchIndex;
            
            try {
              // Actualizar progreso ANTES de generar
              setGenerationProgress(prev => ({
                ...prev,
                status: `Generando imagen ${globalIndex + 1} de ${items.length}...`,
                currentPrompt: item.imagePrompt || ''
              }));

              // Generar la imagen (ahora retorna URL permanente de Firebase)
              const imageUrl = await generateImageForSegment(item);
              
              // Actualizar timeline inmediatamente con URL permanente
              setTimelineItems(prev => prev.map(timelineItem => 
                timelineItem.id === item.id 
                  ? { 
                      ...timelineItem, 
                      generatedImage: imageUrl as string,
                      firebaseUrl: imageUrl as string  // También guardar en firebaseUrl para persistencia
                    } 
                  : timelineItem
              ));
              
              successCount++;
              
              // Actualizar galería del modal INMEDIATAMENTE
              setGenerationProgress(prev => ({
                ...prev,
                current: successCount,
                percentage: Math.round((successCount / items.length) * 100),
                status: `✅ Imagen ${globalIndex + 1} completada`,
                generatedImages: [...prev.generatedImages, {
                  id: String(item.id),
                  url: imageUrl as string,
                  prompt: item.imagePrompt || ''
                }]
              }));
              
              results.push({
                id: item.id,
                success: true,
                url: imageUrl,
                prompt: item.imagePrompt || ''
              });
              
              // Pequeña pausa para que el usuario vea la imagen aparecer
              await new Promise(resolve => setTimeout(resolve, 500));
              
            } catch (error) {
              logger.error(`Error in generation for segment ${item.id}:`, error);
              failCount++;
              
              results.push({
                id: item.id,
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                prompt: item.imagePrompt || ''
              });
            }
          }
          
          // Wait between batches to avoid rate limits
          if (i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (batchError) {
          logger.error(`Error processing batch ${Math.floor(i/batchSize) + 1}:`, batchError);
          failCount++;
        }
      }

      // Mostrar resultado final
      if (successCount > 0) {
        toast({
          title: "Proceso completado",
          description: `Se generaron ${successCount} de ${items.length} imágenes ${failCount > 0 ? `(${failCount} fallaron)` : ''}`,
        });
        
        if (successCount >= 1) { // Mostrar vista previa incluso si solo se generó una imagen
          // Generar ID único para este video
          const videoId = `video_${Date.now()}`;
          
          // Guardar el videoId en el estado para usarlo en la generación del video
          setVideoId(videoId);
          
          // Calcular duración total en segundos
          const calculateTotalDuration = () => {
            if (timelineItems.length === 0) return 0;
            const lastItem = timelineItems[timelineItems.length - 1];
            return lastItem.end_time / 1000; // Convertir a segundos
          };
          
          // Extraer palabras clave del primer segmento o usar etiquetas predeterminadas
          const extractTags = () => {
            const firstSegment = timelineItems[0];
            if (firstSegment && firstSegment.description) {
              return firstSegment.description
                .split(' ')
                .filter(word => word.length > 5)
                .slice(0, 5);
            }
            return ['música', 'video', 'artista', 'canción', 'generado'];
          };
          
          // Crear un documento de video en Firestore para futuras referencias
          try {
            const videoRef = collection(db, 'videos');
            await addDoc(videoRef, {
              id: videoId,
              userId: user?.uid,
              title: songTitle || 'Video Musical Generado',
              status: 'preview', // Inicialmente solo vista previa
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              duration: duration || calculateTotalDuration(),
              thumbnailUrl: timelineItems.find(item => item.generatedImage)?.generatedImage || '',
              tags: extractTags(),
            });
          } catch (error) {
            logger.error('Error guardando información del video:', error);
          }
          
          setCurrentStep(5); // Avanzar al siguiente paso
          
          // 🎬 AUTO-CONVERT: After generating images, auto-convert to videos for free preview
          if (!hasUserPaid && successCount >= FREE_SCENES_LIMIT) {
            logger.info('🎬 [FREE PREVIEW] Starting auto-conversion to videos...');
            toast({
              title: "🎬 Creating Video Preview",
              description: "Converting your images to video clips with lipsync...",
            });
            
            // Auto-start video conversion for free preview
            setTimeout(() => {
              handleAutoConvertToVideos();
            }, 2000);
          }
        }
      } else {
        toast({
          title: "Error",
          description: "No se pudo generar ninguna imagen",
          variant: "destructive",
        });
      }

    } catch (error) {
      logger.error("Error en el proceso de generación:", error);
      toast({
        title: "Error general",
        description: error instanceof Error ? error.message : "Error en el proceso de generación de imágenes",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingShots(false);
    }
  };
  
  /**
   * 🎬 AUTO-CONVERT: Converts free preview images to videos with lipsync
   * - PERFORMANCE scenes get PixVerse lipsync
   * - B-ROLL and STORY scenes get Kling video generation
   */
  const handleAutoConvertToVideos = async () => {
    const itemsWithImages = timelineItems.filter(item => item.generatedImage || item.firebaseUrl);
    
    if (itemsWithImages.length === 0) {
      logger.warn('⚠️ No images to convert to videos');
      return;
    }
    
    setIsGeneratingVideos(true);
    setVideoGenerationProgress({ current: 0, total: itemsWithImages.length });
    
    logger.info(`🎬 [AUTO-CONVERT] Converting ${itemsWithImages.length} images to videos...`);
    logger.info(`📐 Aspect ratio: ${videoAspectRatio}`);
    
    try {
      // Detect PERFORMANCE clips for lipsync
      const performanceClips = detectPerformanceClips(itemsWithImages);
      const brollAndStoryClips = itemsWithImages.filter(item => 
        item.shotCategory !== 'PERFORMANCE' || !performanceClips.includes(item)
      );
      
      logger.info(`🎤 Performance clips for lipsync: ${performanceClips.length}`);
      logger.info(`🎬 B-roll/Story clips for video: ${brollAndStoryClips.length}`);
      
      let processedCount = 0;
      let lipsyncSuccessCount = 0;
      let lipsyncFailCount = 0;
      const failedLipsyncClips: number[] = [];
      
      // Process PERFORMANCE clips: First generate video, then apply lipsync
      if (performanceClips.length > 0 && audioUrl) {
        setLipSyncProgress({ current: 0, total: performanceClips.length, message: 'Processing performance scenes with lipsync...' });
        
        for (const clip of performanceClips) {
          try {
            const imageUrl = clip.generatedImage || clip.firebaseUrl || clip.imageUrl;
            if (!imageUrl) continue;
            
            // Get segment duration in seconds
            const segmentDuration = (clip.duration || 3500) / 1000;
            
            // STEP 1: Generate video from image (smart model selection per scene type)
            // 🎭 CONSISTENCY FIX: Always pass artist reference images for face identity preservation
            const characterRefs = masterCharacter?.mainCharacter?.angles
              ?.filter((a: any) => a.imageUrl)
              ?.map((a: any) => a.imageUrl) || artistReferenceImages;
            
            // 🎬 PERFORMANCE: Use O3 Ref2V when refs available, O1 Ref2V fallback, or base model
            const perfModel = characterRefs.length > 0
              ? (FAL_VIDEO_MODELS.KLING_O3_4K_REF2V?.id || FAL_VIDEO_MODELS.KLING_O1_STANDARD_REF2V.id)
              : selectedVideoModel;
            
            // 🎬 Build rich video prompt with Director+DP camera data
            const directorMovement = clip.metadata?._motion_descriptor || '';
            const cameraMovement = clip.metadata?._cinematography?.movement || clip.movement || '';
            const filmLook = clip.filmEmulation || clip.metadata?._film_emulation || '';
            const basePrompt = clip.imagePrompt || clip.visualDescription || 'Artist performing';
            const perfPrompt = `${basePrompt}, singing, emotional performance, maintain exact facial identity${cameraMovement ? `, ${cameraMovement}` : ''}${filmLook ? `, ${filmLook} film look` : ''}, cinematic lighting, professional music video`;
            
            logger.info(`🎬 [PERF ${clip.id}] Step 1: Generating video (model: ${perfModel}, refs: ${characterRefs.length})...`);
            const videoResult = await generateVideoWithFAL(perfModel, {
              imageUrl: imageUrl,
              prompt: perfPrompt,
              aspectRatio: videoAspectRatio,
              duration: segmentDuration,
              negativePrompt: 'blur, distort, static, frozen, morphing face, extra limbs, deformed',
              cfgScale: 0.6, // 🎬 Slightly higher adherence for performance scenes
              referenceImages: characterRefs.length > 0 ? characterRefs : undefined
            });
            
            if (!videoResult.success || !videoResult.videoUrl) {
              logger.error(`❌ Video generation failed for clip ${clip.id}`);
              failedLipsyncClips.push(clip.id);
              lipsyncFailCount++;
              continue;
            }
            
            // STEP 2: Apply PixVerse lipsync to the generated video with retry
            logger.info(`🎤 [PERF ${clip.id}] Step 2: Applying PixVerse lipsync...`);
            let lipsyncResult = await applyPixVerseLipsync({
              videoUrl: videoResult.videoUrl,
              audioUrl: audioUrl
            });
            
            // 🔄 RETRY: If lipsync fails, try one more time
            if (!lipsyncResult.success) {
              logger.warn(`⚠️ [PERF ${clip.id}] Lipsync failed, retrying once...`);
              setLipSyncProgress({ 
                current: processedCount, 
                total: performanceClips.length, 
                message: `Retrying lipsync for scene ${clip.id}...` 
              });
              
              // Wait 2 seconds before retry
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              lipsyncResult = await applyPixVerseLipsync({
                videoUrl: videoResult.videoUrl,
                audioUrl: audioUrl
              });
            }
            
            // Use lipsync result if successful, otherwise use original video
            const finalVideoUrl = (lipsyncResult.success && lipsyncResult.videoUrl) 
              ? lipsyncResult.videoUrl 
              : videoResult.videoUrl;
            
            // Track success/failure
            if (lipsyncResult.success) {
              lipsyncSuccessCount++;
            } else {
              lipsyncFailCount++;
              failedLipsyncClips.push(clip.id);
              logger.warn(`⚠️ [PERF ${clip.id}] Lipsync failed after retry, using original video`);
            }
            
            // Update timeline item with video URL
            setTimelineItems(prev => prev.map(item =>
              item.id === clip.id
                ? { 
                    ...item, 
                    generatedVideo: finalVideoUrl, 
                    type: 'video' as const,
                    hasLipsync: lipsyncResult.success,
                    lipsyncFailed: !lipsyncResult.success
                  }
                : item
            ));
            
            processedCount++;
            setVideoGenerationProgress({ current: processedCount, total: itemsWithImages.length });
            setLipSyncProgress({ 
              current: processedCount, 
              total: performanceClips.length, 
              message: `Processed ${processedCount} performance scenes (${lipsyncSuccessCount} with lipsync)` 
            });
            
          } catch (error) {
            logger.error(`❌ Performance processing failed for clip ${clip.id}:`, error);
            failedLipsyncClips.push(clip.id);
            lipsyncFailCount++;
          }
        }
        
        // 📊 Show summary notification for lipsync results
        if (lipsyncFailCount > 0) {
          toast({
            title: "⚠️ Some Lipsync Failed",
            description: `${lipsyncSuccessCount} scenes with lipsync, ${lipsyncFailCount} scenes using original video. Scenes ${failedLipsyncClips.join(', ')} can be retried manually.`,
            variant: "default"
          });
        } else if (lipsyncSuccessCount > 0) {
          toast({
            title: "✅ Lipsync Complete",
            description: `All ${lipsyncSuccessCount} performance scenes synchronized successfully!`,
          });
        }
      }
      
      // Process B-ROLL and STORY clips with video generation (no lipsync needed)
      const storyCharRefs = masterCharacter?.mainCharacter?.angles
        ?.filter((a: any) => a.imageUrl)
        ?.map((a: any) => a.imageUrl) || artistReferenceImages;
      
      for (const clip of brollAndStoryClips) {
        try {
          const imageUrl = clip.generatedImage || clip.firebaseUrl || clip.imageUrl;
          if (!imageUrl) continue;
          
          // 🎭 STORY scenes with artist get references; pure B-ROLL does not
          const clipUsesArtist = clip.shotCategory === 'STORY' && clip.usesMasterCharacter;
          
          // 🎬 Build scene-type-specific video prompt
          const baseClipPrompt = clip.imagePrompt || clip.visualDescription || 'Cinematic video';
          const clipCameraMovement = clip.metadata?._cinematography?.movement || clip.movement || '';
          const clipFilmLook = clip.filmEmulation || clip.metadata?._film_emulation || '';
          const isBRoll = clip.shotCategory === 'B-ROLL';
          
          // B-ROLL: atmospheric slow movement; STORY: character-driven movement
          const motionStyle = isBRoll 
            ? 'slow subtle atmospheric movement, ambient, no sudden changes' 
            : `natural cinematic movement${clipCameraMovement ? `, ${clipCameraMovement}` : ''}`;
          const videoPrompt = `${baseClipPrompt}, ${motionStyle}${clipFilmLook ? `, ${clipFilmLook} film look` : ''}, professional music video`;
          
          // 🎬 Smart model selection: STORY with artist → O1 Ref2V; B-ROLL → base model
          const clipModel = (clipUsesArtist && storyCharRefs.length > 0)
            ? FAL_VIDEO_MODELS.KLING_O1_STANDARD_REF2V.id
            : selectedVideoModel;
          
          const videoResult = await generateVideoWithFAL(clipModel, {
            imageUrl: imageUrl,
            prompt: videoPrompt,
            aspectRatio: videoAspectRatio,
            duration: (clip.duration || 3500) / 1000,
            negativePrompt: isBRoll 
              ? 'blur, static, frozen, people appearing, faces' 
              : 'blur, distort, static, frozen, morphing face, deformed',
            cfgScale: isBRoll ? 0.4 : 0.5, // B-ROLL: more creative freedom
            referenceImages: (clipUsesArtist && storyCharRefs.length > 0) ? storyCharRefs : undefined
          });
          
          if (videoResult.success && videoResult.videoUrl) {
            setTimelineItems(prev => prev.map(item =>
              item.id === clip.id
                ? { ...item, generatedVideo: videoResult.videoUrl, type: 'video' as const }
                : item
            ));
            processedCount++;
            setVideoGenerationProgress({ current: processedCount, total: itemsWithImages.length });
          }
        } catch (error) {
          logger.error(`❌ Video generation failed for clip ${clip.id}:`, error);
        }
      }
      
      logger.info(`✅ [AUTO-CONVERT] Completed: ${processedCount}/${itemsWithImages.length} videos created`);
      
      // Show payment gate after free preview is complete
      if (!hasUserPaid && processedCount > 0) {
        toast({
          title: "🎬 Preview Ready!",
          description: `${processedCount} video clips created. Unlock the full video for $${FULL_VIDEO_PRICE}!`,
        });
        
        // Delay then show payment gate
        setTimeout(() => {
          setShowPaymentGate(true);
        }, 3000);
      }
      
    } catch (error) {
      logger.error('❌ Auto-convert failed:', error);
      toast({
        title: "Error",
        description: "Failed to convert images to videos",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingVideos(false);
    }
  };

  /**
   * Exporta el video generado usando Shotstack API para renderizado real
   * @returns Promise<string> URL del video generado en Firebase Storage
   */
  const handleExportVideo = async (): Promise<string | null> => {
    if (!timelineItems.length || !audioBuffer) {
      toast({
        title: "Error",
        description: "No hay suficientes elementos para exportar el video",
        variant: "destructive",
      });
      return null;
    }
    
    // Verificar que todos los segmentos tengan imágenes o videos generados
    const validItems = timelineItems.filter(item => 
      item.generatedVideo || item.firebaseVideoUrl || item.generatedImage || item.firebaseUrl
    );
    
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "No hay elementos generados para exportar",
        variant: "destructive",
      });
      return null;
    }
    
    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Preparando clips...');
    
    try {
      // 1. Asegurar que todas las imágenes estén en Firebase
      logger.log('📤 [EXPORT] Guardando assets en Firebase...');
      const savePromises = timelineItems.map(async (item) => {
        // Priorizar video sobre imagen
        if (item.generatedVideo || item.firebaseVideoUrl) {
          return {
            id: item.id,
            videoUrl: item.firebaseVideoUrl || item.generatedVideo,
            imageUrl: undefined,
            start: item.startTime / 1000, // Convertir ms a segundos
            duration: item.duration / 1000,
          };
        }
        
        // Si no hay video, usar imagen
        if (item.generatedImage && !item.firebaseUrl) {
          const url = await saveToFirebase(item);
          return {
            id: item.id,
            videoUrl: undefined,
            imageUrl: url || item.generatedImage,
            start: item.startTime / 1000,
            duration: item.duration / 1000,
          };
        }
        
        return {
          id: item.id,
          videoUrl: undefined,
          imageUrl: item.firebaseUrl || item.generatedImage,
          start: item.startTime / 1000,
          duration: item.duration / 1000,
        };
      });
      
      const clips = await Promise.all(savePromises);
      setExportProgress(10);
      setExportStatus('Iniciando renderizado...');
      
      // 2. Iniciar renderizado con Shotstack
      logger.log('🎬 [EXPORT] Iniciando renderizado con Shotstack...');
      const renderResponse = await fetch('/api/video-rendering/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProjectId ? parseInt(currentProjectId) : undefined,
          userId: user?.uid,
          clips: clips.filter(c => c.videoUrl || c.imageUrl),
          audioUrl: audioUrl || undefined,
          audioDuration: estimatedDuration / 1000,
          resolution: '1080p',
          quality: 'high',
          aspectRatio: videoAspectRatio,
        }),
      });
      
      const renderData = await renderResponse.json();
      
      if (!renderData.success || !renderData.renderId) {
        throw new Error(renderData.error || 'Error al iniciar renderizado');
      }
      
      const renderId = renderData.renderId;
      logger.log(`✅ [EXPORT] Renderizado iniciado: ${renderId}`);
      setExportProgress(20);
      setExportStatus('Procesando video...');
      
      // 3. Polling para verificar estado del renderizado
      const pollInterval = 3000; // 3 segundos
      const maxAttempts = 120; // Max 6 minutos (120 * 3s)
      let attempts = 0;
      
      const checkStatus = async (): Promise<string | null> => {
        while (attempts < maxAttempts) {
          attempts++;
          
          const statusResponse = await fetch(
            `/api/video-rendering/status/${renderId}?projectId=${currentProjectId}&userId=${user?.uid}`
          );
          const statusData = await statusResponse.json();
          
          if (!statusData.success) {
            if (statusData.status === 'failed') {
              throw new Error('El renderizado falló');
            }
            // Continuar polling si hay error temporal
          }
          
          // Actualizar progreso
          const progress = statusData.progress || 0;
          setExportProgress(20 + Math.round(progress * 0.7)); // 20-90%
          
          switch (statusData.status) {
            case 'queued':
              setExportStatus('En cola de renderizado...');
              break;
            case 'processing':
              setExportStatus(`Renderizando video... ${progress}%`);
              break;
            case 'done':
              setExportProgress(100);
              setExportStatus('¡Video listo!');
              // Devolver URL de Firebase (o Shotstack si Firebase falló)
              return statusData.firebaseUrl || statusData.url;
            case 'failed':
              throw new Error('El renderizado falló');
          }
          
          // Esperar antes de siguiente verificación
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
        throw new Error('Timeout: El renderizado tardó demasiado');
      };
      
      const finalVideoUrl = await checkStatus();
      
      if (!finalVideoUrl) {
        throw new Error('No se recibió URL del video');
      }
      
      logger.log(`🎉 [EXPORT] Video exportado exitosamente: ${finalVideoUrl}`);
      
      toast({
        title: "¡Exportación completada!",
        description: "Tu video está listo para descargar",
      });
      
      setCurrentStep(6); // Marcar como completado
      
      return finalVideoUrl;
      
    } catch (error) {
      logger.error("Error exportando video:", error);
      toast({
        title: "Error en exportación",
        description: error instanceof Error ? error.message : "Error al exportar el video",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStatus('');
    }
  };

  /**
   * Abre el modal de procesamiento de video después de que las imágenes estén generadas
   * El usuario confirma sus datos y el video entra en cola de renderizado
   */
  const handleOpenVideoProcessingModal = () => {
    if (!currentProjectId) {
      toast({
        title: "Error",
        description: "Primero debes guardar el proyecto",
        variant: "destructive",
      });
      return;
    }
    
    const generatedImagesCount = timelineItems.filter(item => 
      item.generatedImage || item.firebaseUrl
    ).length;
    
    if (generatedImagesCount < 5) {
      toast({
        title: "Faltan imágenes",
        description: `Necesitas al menos 5 imágenes generadas. Tienes ${generatedImagesCount}.`,
        variant: "destructive",
      });
      return;
    }
    
    setShowVideoProcessingModal(true);
  };

  /**
   * Maneja la confirmación del modal de procesamiento
   * Crea un item en la cola de renderizado y envía webhook a Make.com
   */
  const handleVideoProcessingConfirm = async (data: ProcessingConfirmation) => {
    try {
      logger.log('🎬 [VIDEO PROCESSING] Confirmando renderizado...', data);
      
      // Si no hay currentProjectId, creamos el proyecto primero
      let projectId = currentProjectId;
      if (!projectId && user?.email) {
        logger.info('🎬 [VIDEO PROCESSING] Creando proyecto antes de enviar a cola...');
        try {
          const result = await musicVideoProjectServicePostgres.saveProject({
            userEmail: user.email,
            projectName: data.artistName + ' - ' + data.songName,
            artistName: data.artistName,
            songName: data.songName,
            audioUrl: audioUrl || undefined,
            audioDuration: estimatedDuration / 1000,
            timelineItems: timelineItems,
            selectedDirector: videoStyle.selectedDirector,
            videoStyle: videoStyle,
            artistReferenceImages: artistReferenceImages,
            status: 'generating_videos' as const,
            progress: {
              scriptGenerated: true,
              imagesGenerated: timelineItems.filter(t => t.generatedImage || t.firebaseUrl).length,
              totalImages: timelineItems.length,
              videosGenerated: 0,
              totalVideos: timelineItems.length
            }
          });
          projectId = String(result.project.id);
          setCurrentProjectId(projectId);
          logger.info(`✅ [VIDEO PROCESSING] Proyecto creado: ${projectId}`);
        } catch (saveError) {
          logger.error('❌ [VIDEO PROCESSING] Error creando proyecto:', saveError);
          throw new Error('Error al crear el proyecto. Intenta de nuevo.');
        }
      }
      
      if (!projectId) {
        throw new Error('No se pudo obtener o crear el ID del proyecto');
      }
      
      // Preparar datos del proyecto para la cola
      const timelineData = timelineItems.map(item => ({
        id: item.id,
        imageUrl: item.firebaseUrl || item.generatedImage,
        videoUrl: item.generatedVideo || item.firebaseVideoUrl,
        start_time: item.startTime / 1000,
        duration: item.duration / 1000,
        shotCategory: item.shotCategory || 'B-ROLL',
        hasLipsync: item.shotCategory === 'PERFORMANCE'
      }));
      
      // Enviar solicitud a la API de render queue
      const response = await fetch('/api/render-queue/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: parseInt(projectId),
          userEmail: data.email,
          artistName: data.artistName,
          songName: data.songName,
          profileSlug: data.profileUrl.split('/').pop() || generateProfileSlug(data.artistName),
          notifyByEmail: data.notifyByEmail,
          timelineData,
          audioUrl: audioUrl || '',
          audioDuration: estimatedDuration / 1000,
          thumbnailUrl: timelineItems[0]?.firebaseUrl || timelineItems[0]?.generatedImage,
          aspectRatio: videoAspectRatio,
          totalClips: timelineItems.length,
          performanceVideoUrl: performanceVideoUrl || undefined
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Error al crear el trabajo en cola');
      }
      
      setQueuedVideoId(result.queueId);
      setVideoProcessingComplete(true);
      
      logger.log(`✅ [VIDEO PROCESSING] Video en cola: ${result.queueId}`);
      
      toast({
        title: "¡Tu video está en camino!",
        description: "Recibirás un email cuando esté listo",
      });
      
    } catch (error) {
      logger.error('Error en video processing:', error);
      throw error; // Re-throw para que el modal maneje el error
    }
  };

  /**
   * Genera un slug de perfil a partir del nombre del artista
   */
  const generateProfileSlug = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleScriptChange = (value: string | undefined) => {
    if (!value) return;
    setScriptContent(value);
    try {
      const scriptData = JSON.parse(value);
      
      // Extraer las escenas del formato correcto
      let scenesData = [];
      if (scriptData.scenes && Array.isArray(scriptData.scenes)) {
        // Nuevo formato: { scenes: [...] }
        scenesData = scriptData.scenes;
      } else if (scriptData.segments && Array.isArray(scriptData.segments)) {
        // Formato intermedio
        scenesData = scriptData.segments;
      } else if (scriptData.shots && Array.isArray(scriptData.shots)) {
        // Formato antiguo
        scenesData = scriptData.shots;
      }
      
      // Compatibilidad con diferentes formatos de script
      if (scriptData.shots && Array.isArray(scriptData.shots)) {
        // Formato anterior
        generateTimelineItems(scriptData.shots);
      } else if (scenesData.length > 0) {
        // Nuevo formato de script desde generateMusicVideoScript
        const shotItems = scenesData.map((segment: any) => ({
          shotType: segment.tipo_plano || segment.shotType || "Plano medio",
          description: segment.descripción_visual || segment.description || "",
          imagePrompt: segment.imagePrompt || "",
          transition: segment.transición || segment.transition || "corte directo",
          duration: typeof segment.duration === 'number' ? String(segment.duration) : "3"
        }));
        generateTimelineItems(shotItems);
      } else if (scriptData.segmentos && Array.isArray(scriptData.segmentos)) {
        // Formato en español
        const shotItems = scriptData.segmentos.map((segmento: any) => ({
          shotType: segmento.tipo_plano || "Plano medio",
          description: segmento.descripción_visual || "",
          imagePrompt: `Escena musical: ${segmento.descripción_visual || ""}. Estilo: ${segmento.mood || "neutral"}`,
          transition: segmento.transición || "corte directo",
          duration: typeof segmento.duration === 'number' ? String(segmento.duration) : "3"
        }));
        generateTimelineItems(shotItems);
      } else {
        logger.warn("Formato de script no reconocido:", scriptData);
      }
    } catch (error) {
      logger.error("Error parsing script:", error);
      toast({
        title: "Error de formato",
        description: "El script no tiene un formato JSON válido",
        variant: "destructive"
      });
    }
  };

  const itemRenderer = useCallback(({ item, itemContext, getItemProps }: any) => (
    <div
      {...getItemProps()}
      className="relative h-full cursor-pointer group"
      onMouseEnter={() => setHoveredShot(item)}
      onMouseLeave={() => setHoveredShot(null)}
      onClick={() => setSelectedShot(item)}
    >
      <div className={cn(
        "absolute inset-0 bg-card rounded-md border overflow-hidden",
        "transition-all duration-200 ease-in-out",
        currentTime >= item.start_time && currentTime < item.end_time ? "ring-2 ring-orange-500" : "",
        selectedShot?.id === item.id ? "ring-2 ring-blue-500" : "",
        "hover:scale-[1.02] hover:z-10"
      )}>
        <div className="absolute inset-0">
          <img
            src={item.generatedImage || item.firebaseUrl || fallbackImage}
            alt={item.description}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 p-2 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-opacity">
            <div>
              <p className="text-xs font-medium text-white truncate">
                {item.shotType}
              </p>
              <p className="text-xs text-white/80 truncate">
                {item.description}
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>{(item.duration / 1000).toFixed(1)}s</span>
              <span>{item.transition}</span>
            </div>
          </div>
        </div>

        {item.transition && item.transition !== "cut" && (
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-orange-500/20 rounded-full z-10">
            <div className="absolute inset-1 bg-orange-500 rounded-full" />
          </div>
        )}
      </div>
    </div>
  ), [currentTime, selectedShot]);

  // Mapa de clips organizados por capas para el editor profesional multicanal
  const clips: TimelineClip[] = useMemo(() => {
    // Asegurar que siempre hay un clip de audio en la capa 2 si existe audioUrl
    // NOTA: Capa 2 = Audio Track en TimelineEditor/TimelineLayers
    const audioClips = audioUrl ? [
      ensureCompatibleClip({
        id: 9999, // ID especial para audio principal
        start: 0,
        duration: estimatedDuration, // Usamos la duración estimada
        type: 'audio' as const,
        layer: 2, // Capa de audio (2) - coincide con TimelineLayers
        layerId: 2, // También incluir layerId para compatibilidad
        title: 'Audio Principal',
        description: 'Pista de audio importada',
        audioUrl: audioUrl,
        url: audioUrl, // También incluir url para compatibilidad
        visible: true,
        locked: false
      })
    ] : [];
    
    // Mapear los items de timeline a clips visuales
    const visualClips = timelineItems.map(item => {
      // Determinar el tipo de clip basado en sus propiedades
      let clipType: 'video' | 'image' | 'transition' | 'audio' | 'effect' | 'text' = 'image';
      let clipLayer = 1; // Por defecto, capa de imagen (1)
      
      // Si tiene audioUrl, es un clip de audio adicional
      if (item.audioUrl) {
        clipType = 'audio';
        clipLayer = 2; // Capa de audio (2) - coincide con TimelineLayers
      } 
      // Si tiene textContent, es un clip de texto
      else if (item.metadata?.textContent) {
        clipType = 'text';
        clipLayer = 3; // Capa de texto (3)
      }
      // Si tiene movementApplied, es un clip con efecto
      else if (item.metadata?.movementApplied) {
        clipType = 'effect';
        clipLayer = 3; // Capa de efectos (3)
      }
      // Si tiene videoUrl o lipsyncVideoUrl, es un clip de video
      else if (item.videoUrl || item.metadata?.lipsync?.videoUrl || item.lipsyncVideoUrl) {
        clipType = 'video';
        clipLayer = 1; // Capa de video/imagen (1)
      }
      // Si es una imagen generada por IA (tiene generatedImage)
      else if (item.generatedImage) {
        clipType = 'image';
        clipLayer = 1; // Capa 1 = Video/Imágenes (misma capa visual)
      }
      
      // URL del recurso: priorizar video, luego imagen
      const url = item.videoUrl || 
                  item.metadata?.lipsync?.videoUrl || 
                  item.lipsyncVideoUrl || 
                  item.generatedImage || 
                  item.firebaseUrl || 
                  '';
      
      // Create base object with all necessary properties
      const clipBase = {
        id: typeof item.id === 'string' ? parseInt(item.id, 10) : item.id,
        start: (item.start_time - (timelineItems[0]?.start_time || 0)) / 1000,
        duration: (item.duration || 0) / 1000,
        // Usar tipo determinado (video, imagen, audio, texto, efecto)
        type: clipType,
        // Usar capa determinada (0=audio, 1=video/imagen, 2=texto, 3=efectos)
        layer: clipLayer,
        thumbnail: typeof item.generatedImage === 'string' ? item.generatedImage : (typeof item.firebaseUrl === 'string' ? item.firebaseUrl : undefined),
        title: item.shotType || `Clip ${item.id}`,
        description: item.description || '',
        // Propiedades específicas por tipo
        imageUrl: (clipType === 'image') ? url : undefined,
        videoUrl: (clipType === 'video') ? url : undefined,
        audioUrl: (clipType === 'audio') ? item.audioUrl : undefined,
        textContent: (clipType === 'text') ? item.metadata?.textContent : undefined,
        // Agregar imagePrompt, prompt y shotType para regeneración y camera angles
        imagePrompt: item.imagePrompt,
        prompt: item.imagePrompt || item.description || `${item.shotType} shot`,
        shotType: item.shotType,
        // Estado de visibilidad y bloqueo
        visible: true,
        locked: false,
        // Metadatos para preservar el orden exacto del guion
        metadata: {
          sourceIndex: typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10),
          section: item.metadata?.section || 'default',
          movementApplied: !!item.metadata?.movementApplied,
          movementPattern: item.metadata?.movementPattern,
          movementIntensity: item.metadata?.movementIntensity,
          faceSwapApplied: !!item.metadata?.faceSwapApplied,
          // Preservar metadata de lipsync si existe
          lipsync: item.metadata?.lipsync
        }
      };
      
      // Usar ensureCompatibleClip para garantizar compatibilidad con la interfaz unificada
      return ensureCompatibleClip(clipBase);
    });
    
    // Combinar clips de audio con clips visuales
    return [...audioClips, ...visualClips];
  }, [timelineItems, audioUrl, estimatedDuration]);

  // Ahora podemos calcular la duración real basada en los clips
  const totalDuration = useMemo(() => {
    return clips.reduce((acc, clip) => Math.max(acc, clip.start + clip.duration), 0);
  }, [clips]);

  const handleTimeUpdate = (time: number) => {
    const baseTime = timelineItems[0]?.start_time || 0;
    setCurrentTime(baseTime + time * 1000);
  };

  // 🔧 FIX: Memoized onChange for TimelineEditor to prevent re-render blinking
  const handleTimelineChange = useCallback((clips: any[]) => {
    setTimelineItems(clips);
  }, []);

  const handleClipUpdate = (clipId: number, updates: Partial<TimelineClip>) => {
    // Ignorar actualizaciones si no hay items o clipId inválido
    if (!clipId || timelineItems.length === 0) {
      return;
    }
    
    const updatedItems = timelineItems.map(item => {
      if (item.id === clipId) {
        // Crear objeto de actualización base
        const updatedItem = { ...item };
        
        // Si se actualizaron las propiedades de tiempo
        if (updates.start !== undefined) {
          updatedItem.start_time = timelineItems[0].start_time + updates.start * 1000;
        }
        
        if (updates.duration !== undefined) {
          updatedItem.duration = updates.duration * 1000;
        }
        
        // Manejar propiedades específicas de LipSync
        if (updates.lipsyncApplied !== undefined) {
          // Asegurarse de que el objeto metadata existe
          if (!updatedItem.metadata) {
            updatedItem.metadata = {};
          }
          
          // Actualizar el estado de lipsync en metadata
          updatedItem.metadata.lipsync = {
            ...(updatedItem.metadata.lipsync || {}),
            applied: updates.lipsyncApplied !== undefined ? updates.lipsyncApplied : false,
            timestamp: new Date().toISOString(),
          };
        }
        
        if (updates.lipsyncVideoUrl !== undefined) {
          // Asegurarse de que el objeto metadata existe
          if (!updatedItem.metadata) {
            updatedItem.metadata = {};
          }
          
          // Actualizar la URL del video en metadata
          updatedItem.metadata.lipsync = {
            ...(updatedItem.metadata.lipsync || {}),
            applied: true, // Cuando hay URL de video, siempre aplicamos lipsync
            videoUrl: updates.lipsyncVideoUrl,
            timestamp: new Date().toISOString(), // Añadir timestamp para seguimiento
          };
        }
        
        // Manejar el progreso de LipSync si está presente
        if (updates.lipsyncProgress !== undefined) {
          // Asegurarse de que el objeto metadata existe
          if (!updatedItem.metadata) {
            updatedItem.metadata = {};
          }
          
          // Actualizar el progreso en metadata
          updatedItem.metadata.lipsync = {
            ...(updatedItem.metadata.lipsync || {}),
            progress: updates.lipsyncProgress,
            applied: (updatedItem.metadata.lipsync?.applied === undefined) ? false : updatedItem.metadata.lipsync.applied,
          };
        }
        
        return updatedItem;
      }
      return item;
    });
    
    // Solo actualizar si hubo un cambio real
    const clipFound = timelineItems.some(item => item.id === clipId);
    if (clipFound) {
      setTimelineItems(updatedItems);
      logger.info(`✅ Clip ${clipId} actualizado:`, updates);
    }
  };
  
  // Función para manejar la división de clips en la línea de tiempo
  const handleSplitClip = (clipId: number, splitTime: number) => {
    // Encontrar el clip que se va a dividir
    const clipToSplit = timelineItems.find(item => item.id === clipId);
    if (!clipToSplit) return;
    
    // Calcular la posición absoluta del punto de división
    const absoluteSplitTime = timelineItems[0].start_time + splitTime * 1000;
    
    // Crear el nuevo clip para la segunda parte
    const newClipId = Math.max(...timelineItems.map(item => typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10))) + 1;
    const relativeStartInClip = splitTime - ((clipToSplit.start_time - timelineItems[0].start_time) / 1000);
    
    // Nuevo clip (segunda parte)
    // Creamos primero un objeto base TimelineItem
    const newClipBase: TimelineItem = {
      ...clipToSplit,
      id: newClipId,
      start_time: absoluteSplitTime,
      end_time: clipToSplit.end_time,
      start: (absoluteSplitTime - timelineItems[0].start_time) / 1000,
      duration: (clipToSplit.end_time - absoluteSplitTime) / 1000,
      // Conservar otros campos importantes
      title: `${clipToSplit.title} (parte 2)`,
    };
    
    // Aseguramos que el nuevo clip es compatible con TimelineClipUnified
    const newClip = ensureCompatibleClip(newClipBase);
    
    // Actualizar la lista de clips
    const updatedItems = timelineItems.map(item => {
      if (item.id === clipId) {
        // Actualizar el clip original (primera parte)
        const updatedItemBase = {
          ...item,
          duration: relativeStartInClip,
          end_time: absoluteSplitTime
        };
        // Asegurar que el clip original modificado también sea compatible con TimelineClipUnified
        return ensureCompatibleClip(updatedItemBase);
      }
      return item;
    });
    
    // Añadir el nuevo clip
    updatedItems.push(newClip);
    
    // Ordenar los clips por tiempo de inicio
    updatedItems.sort((a, b) => {
      // Compatibilidad con ambos formatos (TimelineItem y TimelineClipUnified)
      const aStart = 'start_time' in a ? a.start_time : a.start;
      const bStart = 'start_time' in b ? b.start_time : b.start;
      return aStart - bStart;
    });
    
    // Actualizar el estado
    setTimelineItems(updatedItems as TimelineItem[]);
    
    logger.info(`Clip ${clipId} dividido en: ${clipId} y ${newClipId} en tiempo ${splitTime}s`);
  };

  /**
   * Aplica todas las restricciones requeridas a los clips del timeline:
   * 1. Duración máxima de clips (5 segundos)
   * 2. Imágenes generadas por IA solo en capa 7
   * 3. No solapamiento de imágenes en la misma capa
   * @param clips Lista de clips a verificar
   * @returns Lista de clips con restricciones aplicadas
   */
  const enforceAllConstraints = (clips: TimelineItem[]): TimelineItem[] => {
    if (!clips || !clips.length) return [];
    
    // Crear una copia de los clips para no modificar los originales
    const processedClips = [...clips];
    const MAX_CLIP_DURATION = 5 * 1000; // 5 segundos en milisegundos
    
    // Ordenamos los clips por tiempo de inicio para facilitar la detección de solapamientos
    processedClips.sort((a, b) => {
      // Garantizar que los clips tienen la propiedad start_time
      const aStart = a.start_time;
      const bStart = b.start_time;
      return aStart - bStart;
    });
    
    // Recorremos todos los clips
    for (let i = 0; i < processedClips.length; i++) {
      const currentClip = processedClips[i];
      
      // 1. Restricción de duración - limitar a 5 segundos máximo
      // Asegurar que la duración esté definida
      const clipDuration = currentClip.duration || (currentClip.end_time - currentClip.start_time);
      
      if (clipDuration > MAX_CLIP_DURATION) {
        logger.info(`Ajustando clip ${currentClip.id} de ${clipDuration}ms a ${MAX_CLIP_DURATION}ms`);
        currentClip.duration = MAX_CLIP_DURATION;
        currentClip.end_time = currentClip.start_time + MAX_CLIP_DURATION;
      }
      
      // 2. Restricción de capa para imágenes generadas por IA - siempre en capa 7
      if (currentClip.generatedImage || (currentClip.metadata && currentClip.metadata.isGeneratedImage)) {
        if (currentClip.group !== 7) {
          logger.info(`Moviendo clip de imagen generada ${currentClip.id} a capa 7`);
          currentClip.group = 7;
        }
      }
      
      // 3. Prevenir solapamiento de clips en la misma capa
      // Solo necesitamos verificar contra los clips que siguen, ya que estamos ordenados
      for (let j = i + 1; j < processedClips.length; j++) {
        const nextClip = processedClips[j];
        
        // Si están en la misma capa y hay solapamiento
        if (currentClip.group === nextClip.group && 
            currentClip.end_time > nextClip.start_time) {
          
          logger.info(`Detectado solapamiento entre clips ${currentClip.id} y ${nextClip.id} en capa ${currentClip.group}`);
          
          // Ajustar la duración del clip actual para evitar el solapamiento
          const newEndTime = nextClip.start_time;
          const newDuration = newEndTime - currentClip.start_time;
          
          // Solo aplicar el cambio si la nueva duración es razonable (más de 0.1 segundos)
          if (newDuration >= 100) {
            logger.info(`Ajustando fin de clip ${currentClip.id} de ${currentClip.end_time}ms a ${newEndTime}ms`);
            currentClip.end_time = newEndTime;
            currentClip.duration = newDuration;
          }
          // Si la duración resultante es demasiado pequeña, movemos el clip siguiente
          else if (newDuration < 100) {
            // Calculamos el nuevo start_time para el clip siguiente
            const newStartTime = currentClip.end_time;
            logger.info(`Ajustando inicio de clip ${nextClip.id} de ${nextClip.start_time}ms a ${newStartTime}ms`);
            nextClip.start_time = newStartTime;
            nextClip.duration = nextClip.end_time - newStartTime;
          }
        }
      }
    }
    
    return processedClips;
  };

  /**
   * Generates a prompt for a specific timeline segment
   * Extracts the lyrics corresponding to the segment and generates a visual prompt
   * @param segment - The timeline segment for which the prompt will be generated
   * @returns A string with the generated prompt or an error message
   */
  const generatePromptForSegment = async (segment: TimelineItem): Promise<string> => {
    if (!segment || typeof segment.id !== 'number') {
      logger.error("Invalid segment:", segment);
      return "Error: invalid segment";
    }
    
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: Error | null = null;
    
    // Determine which part of the transcription corresponds to this segment
    const segmentStartTime = segment.start_time / 1000; // convert to seconds
    const segmentEndTime = segment.end_time / 1000;
    let relevantLyrics = "";
    
    try {
      logger.info(`Generating prompt for segment ${segment.id} (${segmentStartTime.toFixed(2)}s - ${segmentEndTime.toFixed(2)}s)`);
      
      // STEP 1: RELEVANT LYRICS EXTRACTION
      // If we have transcription with timestamps (more precise)
      if (transcriptionWithTimestamps && Array.isArray(transcriptionWithTimestamps.segments)) {
        // Search for transcription segments that match this timeline segment
        const relevantSegments = transcriptionWithTimestamps.segments.filter(
          (s: {start: number, end: number}) => 
            (s.start >= segmentStartTime && s.start <= segmentEndTime) || 
            (s.end >= segmentStartTime && s.end <= segmentEndTime) ||
            (s.start <= segmentStartTime && s.end >= segmentEndTime)
        );
        
        if (relevantSegments.length > 0) {
          relevantLyrics = relevantSegments
            .map((s: {text: string}) => s.text || "")
            .filter(text => text.trim().length > 0)
            .join(" ");
          
          logger.info(`Found ${relevantSegments.length} segments with timestamps for this fragment`);
        }
      }
      
      // If there are no specific lyrics, use general transcription
      if (!relevantLyrics && transcription) {
        // Divide total transcription proportionally
        const totalDuration = timelineItems.length > 0 ? 
          (timelineItems[timelineItems.length - 1].end_time / 1000) - (timelineItems[0].start_time / 1000) : 0;
          
        if (totalDuration > 0) {
          const segmentDuration = segmentEndTime - segmentStartTime;
          const segmentPercent = segmentDuration / totalDuration;
          const startPercent = (segmentStartTime - (timelineItems[0].start_time / 1000)) / totalDuration;
          
          // Estimate which part of the transcription corresponds to this segment
          const transcriptionWords = transcription.split(/\s+/);
          const startWordIndex = Math.floor(startPercent * transcriptionWords.length);
          const wordCount = Math.max(1, Math.floor(segmentPercent * transcriptionWords.length));
          
          if (startWordIndex >= 0 && wordCount > 0 && startWordIndex < transcriptionWords.length) {
            const endWordIndex = Math.min(startWordIndex + wordCount, transcriptionWords.length);
            relevantLyrics = transcriptionWords.slice(startWordIndex, endWordIndex).join(" ");
            logger.info(`Using proportional transcription: words ${startWordIndex}-${endWordIndex} of ${transcriptionWords.length}`);
          }
        }
      }

      // If we still don't have lyrics, use contextual information based on segment
      if (!relevantLyrics || relevantLyrics.trim().length === 0) {
        // Determine context based on position in video and segment characteristics
        const isBeginningSong = timelineItems.indexOf(segment) < Math.min(3, timelineItems.length * 0.2);
        const isEndingSong = timelineItems.indexOf(segment) > timelineItems.length * 0.8;
        const isHighEnergy = segment.energy && segment.averageEnergy && segment.energy > segment.averageEnergy * 1.3;
        const isLowEnergy = segment.energy && segment.averageEnergy && segment.energy < segment.averageEnergy * 0.7;
        
        if (isHighEnergy) {
          relevantLyrics = isBeginningSong 
            ? "Energetic and intense introduction" 
            : isEndingSong 
              ? "Final climax with great energy" 
              : "Instrumental section with high intensity";
        } else if (isLowEnergy) {
          relevantLyrics = isBeginningSong 
            ? "Soft and atmospheric introduction" 
            : isEndingSong 
              ? "Melodic and reflective closure" 
              : "Quiet and contemplative interlude";
        } else {
          relevantLyrics = isBeginningSong 
            ? "Song introduction" 
            : isEndingSong 
              ? "Song conclusion" 
              : "Instrumental";
        }
        
        logger.info(`No specific lyrics found, using context: "${relevantLyrics}"`);
      }

      // STEP 2: PROMPT GENERATION WITH MULTIPLE ATTEMPTS
      while (attempt < maxAttempts) {
        try {
          logger.info(`Generating prompt for segment ${segment.id}, attempt ${attempt + 1}/${maxAttempts}`);
          
          // Validate video style parameters before creating prompt
          if (!videoStyle.cameraFormat || !videoStyle.mood || !videoStyle.characterStyle || 
              !videoStyle.colorPalette || videoStyle.visualIntensity === undefined || 
              videoStyle.narrativeIntensity === undefined) {
            logger.error("Incomplete video styles:", videoStyle);
            throw new Error("Missing style parameters to generate prompt");
          }
          
          // Prepare parameters for prompt with typing
          const promptParams: VideoPromptParams = {
            shotType: segment.shotType || "medium shot",
            cameraFormat: videoStyle.cameraFormat,
            mood: segment.mood === 'intense' 
              ? 'Energetic' 
              : segment.mood === 'calm' 
                ? 'Calm' 
                : videoStyle.mood,
            visualStyle: videoStyle.characterStyle,
            visualIntensity: videoStyle.visualIntensity,
            narrativeIntensity: videoStyle.narrativeIntensity,
            colorPalette: videoStyle.colorPalette,
            duration: (segment.duration || 0) / 1000,
            directorStyle: videoStyle.selectedDirector?.style,
            specialty: videoStyle.selectedDirector?.specialty,
            styleReference: videoStyle.styleReferenceUrl || ""
          };

          // Add lyrics information to parameters
          const promptWithLyrics = `Music video scene representing these lyrics: "${relevantLyrics}". ${await generateVideoPromptWithRetry(promptParams)}`;

          if (promptWithLyrics && promptWithLyrics !== "Error generating prompt") {
            logger.info(`Prompt successfully generated for segment ${segment.id}`);
            return promptWithLyrics;
          }

          logger.warn(`Attempt ${attempt + 1} failed, retrying in ${2 * (attempt + 1)} seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
          attempt++;

        } catch (error) {
          logger.error(`Error in attempt ${attempt + 1}:`, error);
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt === maxAttempts - 1) {
            toast({
              title: "Error",
              description: "Could not generate prompt after several attempts",
              variant: "destructive",
            });
            return segment.imagePrompt || "Error generating prompt";
          }

          // Exponential backoff
          const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
          logger.info(`Retrying in ${backoffTime/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          attempt++;
        }
      }
    } catch (outerError) {
      logger.error("General error in generatePromptForSegment:", outerError);
      lastError = outerError instanceof Error ? outerError : new Error(String(outerError));
    }

    // FALLBACK: If no attempt succeeded
    logger.error(`Could not generate prompt for segment ${segment.id} after multiple attempts:`, lastError);
    
    // As a last resort, use a basic prompt based on shot type and mood
    const fallbackPrompt = `${segment.shotType || 'medium shot'} of a ${segment.mood || 'neutral'} scene with ${videoStyle.colorPalette || 'balanced'} colors. ${relevantLyrics}`;
    
    logger.warn(`Using fallback prompt for segment ${segment.id}: ${fallbackPrompt}`);
    return fallbackPrompt;
  };

  const generatePromptsForSegments = async () => {
    if (timelineItems.length === 0) {
      toast({
        title: "Error",
        description: "You must first detect musical cuts",
        variant: "destructive",
      });
      return;
    }

    // ✅ VERIFICAR SI YA TIENEN PROMPTS DEL SCRIPT JSON
    const itemsWithPrompts = timelineItems.filter(item => item.imagePrompt && item.imagePrompt.length > 20);
    
    if (itemsWithPrompts.length === timelineItems.length) {
      toast({
        title: "✅ Prompts ya generados",
        description: `Todos los ${timelineItems.length} segmentos ya tienen prompts del guion JSON. Puedes proceder a generar imágenes.`,
      });
      setCurrentStep(5);
      return;
    }
    
    if (itemsWithPrompts.length > 0) {
      logger.info(`ℹ️ ${itemsWithPrompts.length}/${timelineItems.length} segmentos ya tienen prompts del JSON`);
    }

    if (!videoStyle.mood || !videoStyle.colorPalette || !videoStyle.characterStyle) {
      toast({
        title: "Error",
        description: "You must configure all style aspects before generating prompts",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingScript(true);

    try {
      // ✅ ELIMINADO LÍMITE: Procesar TODOS los segmentos, no solo 10
      const updatedItems = [...timelineItems];
      let hasError = false;
      let successCount = 0;

      // Procesar los segmentos en grupos de 3 para evitar sobrecargar la API
      for (let i = 0; i < updatedItems.length; i += 3) {
        const batch = updatedItems.slice(i, i + 3);

        try {
          const results = await Promise.all(
            batch.map(async (segment) => {
              const newPrompt = await generatePromptForSegment(segment);
              return {
                segment,
                prompt: newPrompt
              };
            })
          );

          results.forEach(({ segment, prompt }) => {
            if (prompt && prompt !== "Error generating prompt") {
              const index = updatedItems.findIndex(item => item.id === segment.id);
              if (index !== -1) {
                updatedItems[index] = {
                  ...updatedItems[index],
                  imagePrompt: prompt
                };
                successCount++;
              }
            } else {
              hasError = true;
            }
          });

          // Actualizar el estado después de cada batch
          setTimelineItems([...updatedItems]);

          toast({
            title: "Progreso",
            description: `Generados ${successCount} de ${updatedItems.length} prompts`,
          });

          // Esperar entre batches para evitar rate limits
          if (i + 3 < updatedItems.length) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

        } catch (error) {
          logger.error(`Error procesando batch ${i/3 + 1}:`, error);
          hasError = true;
        }
      }

      if (successCount === updatedItems.length) {
        toast({
          title: "Éxito",
          description: "Todos los prompts han sido generados",
        });
        setCurrentStep(5);
      } else {
        toast({
          title: "Completado con advertencias",
          description: `${successCount} de ${updatedItems.length} prompts generados exitosamente`,
          variant: hasError ? "destructive" : "default",
        });
      }

    } catch (error) {
      logger.error("Error en la generación de prompts:", error);
      toast({
        title: "Error",
        description: "Error al generar los prompts",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const generateVideo = async (): Promise<string | null> => {
    if (!timelineItems.length || !audioBuffer) {
      toast({
        title: "Error",
        description: "No hay suficientes elementos para generar el video",
        variant: "destructive",
      });
      return null;
    }

    // Verificar si hay suficientes imágenes generadas
    const itemsWithImages = timelineItems.filter(item => item.generatedImage).length;
    if (itemsWithImages < timelineItems.length * 0.7) { // Al menos 70% de cobertura
      toast({
        title: "Atención",
        description: `Solo ${itemsWithImages} de ${timelineItems.length} segmentos tienen imágenes. Considera generar más imágenes primero.`,
        variant: "default",
      });
    }

    setIsGeneratingVideo(true);
    try {
      toast({
        title: "🎬 Iniciando generación",
        description: "Convirtiendo imágenes a video con IA...",
      });

      // Paso 1: Guardar todas las imágenes en Firebase
      const savePromises = timelineItems
        .filter(item => item.generatedImage && !item.firebaseUrl)
        .map(async (item) => {
          try {
            const url = await saveToFirebase(item);
            if (url) {
              setTimelineItems(prev => prev.map(
                i => i.id === item.id ? { ...i, firebaseUrl: url } : i
              ));
            }
            return { id: item.id, success: !!url, url };
          } catch (error) {
            logger.error(`Error guardando imagen para segmento ${item.id}:`, error);
            return { id: item.id, success: false };
          }
        });

      await Promise.all(savePromises);

      // Paso 2: Generar videos para cada escena (simulado por ahora)
      toast({
        title: "📹 Generando videos",
        description: "Convirtiendo cada escena en video...",
      });

      // En una implementación futura real, aquí generarías videos con MiniMax/FAL
      // Por ahora, simulamos el proceso
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Paso 3: Aplicar lip-sync a escenas de performance
      const performanceScenes = timelineItems.filter(item => 
        item.metadata?.role === 'performance' && item.generatedImage
      );

      if (performanceScenes.length > 0 && audioUrl) {
        toast({
          title: "🎤 Aplicando lip-sync",
          description: `Sincronizando ${performanceScenes.length} escenas de performance...`,
        });

        logger.info(`🎤 Aplicando lip-sync a ${performanceScenes.length} escenas de performance`);

        // Procesar lip-sync para cada escena de performance
        for (const scene of performanceScenes) {
          try {
            // En una implementación real, aquí usarías el video generado
            // Por ahora, usamos la imagen como placeholder
            const videoUrl = scene.firebaseUrl || scene.generatedImage;
            
            if (typeof videoUrl === 'string') {
              logger.info(`🎤 Procesando lip-sync para escena ${scene.id}`);
              
              // Aplicar lip-sync (esto requeriría tener el video generado primero)
              // const syncResult = await applyLipSync({
              //   videoUrl: videoUrl,
              //   audioUrl: audioUrl,
              //   syncMode: 'cut_off'
              // });
              
              // if (syncResult.success) {
              //   setTimelineItems(prev => prev.map(
              //     i => i.id === scene.id ? { ...i, syncedVideoUrl: syncResult.videoUrl } : i
              //   ));
              // }
            }
          } catch (error) {
            logger.error(`Error aplicando lip-sync a escena ${scene.id}:`, error);
          }
        }

        toast({
          title: "✅ Lip-sync completado",
          description: `${performanceScenes.length} escenas sincronizadas con el audio`,
        });
      }

      // Generar ID único para este video
      const videoId = `video_${Date.now()}`;
      setVideoId(videoId);

      // Crear un documento en Firestore para el video
      try {
        const videoRef = collection(db, 'videos');
        await addDoc(videoRef, {
          id: videoId,
          userId: user?.uid,
          title: songTitle || 'Video Musical Generado',
          status: 'preview',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          duration: audioBuffer.duration || 0,
          thumbnailUrl: timelineItems.find(item => item.firebaseUrl || item.generatedImage)?.firebaseUrl || 
                         timelineItems.find(item => item.firebaseUrl || item.generatedImage)?.generatedImage || '',
          tags: ['música', 'video', 'artista', 'canción', 'generado'],
          hasLipSync: performanceScenes.length > 0
        });
      } catch (error) {
        logger.error("Error guardando información del video:", error);
      }

      setCurrentStep(7);

      toast({
        title: "🎉 Video generado exitosamente",
        description: "Tu video musical está listo con lip-sync incluido",
      });

      return videoId;
    } catch (error) {
      logger.error("Error generando video:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al generar el video",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Función para descargar el video final
  const downloadVideo = () => {
    // Usar el video mejorado si está disponible, o el video generado original
    const videoToDownload = upscaledVideoUrl || generatedVideoUrl || "/assets/Standard_Mode_Generated_Video (2).mp4";
    const link = document.createElement('a');
    link.href = videoToDownload;
    link.download = `music-video-${videoId || 'final'}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Descarga iniciada",
      description: "Tu video musical se está descargando ahora"
    });
  };
  
  // Función para compartir el video en redes sociales
  const shareMusicVideo = () => {
    // En una implementación real, aquí se abriría un modal con opciones
    // de compartir en diferentes redes sociales
    
    // Por ahora, simulamos compartir usando el navegador web API
    const videoToShare = upscaledVideoUrl || generatedVideoUrl || "/assets/Standard_Mode_Generated_Video (2).mp4";
    const shareData = {
      title: 'Mi Video Musical Generado con IA',
      text: '¡Mira este increíble video musical que he creado con IA!',
      url: window.location.origin + videoToShare
    };
    
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      navigator.share(shareData)
        .then(() => {
          toast({
            title: "Compartido con éxito",
            description: "Tu video ha sido compartido"
          });
        })
        .catch(error => {
          logger.error('Error al compartir:', error);
          toast({
            title: "Error al compartir",
            description: "No se pudo compartir el video. Intenta otra opción."
          });
        });
    } else {
      // Fallback si Web Share API no está disponible
      toast({
        title: "Enlace copiado",
        description: "Enlace al video copiado al portapapeles. Ahora puedes compartirlo."
      });
    }
  };

  const analyzeReferenceImage = async (image: string) => {
    try {
      const analysis = await analyzeImage(image);

      setVideoStyle(prev => ({
        ...prev,
        styleDescription: analysis
      }));

      toast({
        title: "Análisis completado",
        description: "Estilo de referencia actualizado"
      });
    } catch (error) {
      logger.error("Error analyzing reference image:", error);
      toast({
        title: "Error",
        description: "No se pudo analizar la imagen de referencia",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const loadDirectors = async () => {
      try {
        const directorsSnapshot = await getDocs(collection(db, "directors"));
        const directorsData = directorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Director[];
        setDirectors(directorsData);
      } catch (error) {
        logger.error("Error loading directors:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los directores",
          variant: "destructive",
        });
      }
    };

    loadDirectors();
  }, []);

  // Auto-save project cuando cambien datos importantes
  useEffect(() => {
    if (!user?.email || !projectName.trim() || timelineItems.length === 0) {
      return; // No auto-guardar si no hay usuario, nombre de proyecto o timeline items
    }

    const imagesGenerated = timelineItems.filter(item => item.generatedImage || item.firebaseUrl).length;
    const videosGenerated = timelineItems.filter(item => item.videoUrl || item.lipsyncVideoUrl).length;

    musicVideoProjectServicePostgres.autoSave({
      userEmail: user.email,
      projectName,
      audioUrl: audioUrl || undefined,
      audioDuration: audioBuffer?.duration,
      transcription: transcription || undefined,
      scriptContent: scriptContent || undefined,
      timelineItems,
      selectedDirector: videoStyle.selectedDirector ? {
        id: videoStyle.selectedDirector.id || '',
        name: videoStyle.selectedDirector.name || '',
        specialty: videoStyle.selectedDirector.specialty || '',
        style: videoStyle.selectedDirector.style || '',
        experience: videoStyle.selectedDirector.experience || ''
      } : undefined,
      videoStyle: {
        cameraFormat: videoStyle.cameraFormat,
        mood: videoStyle.mood,
        characterStyle: videoStyle.characterStyle,
        colorPalette: videoStyle.colorPalette,
        visualIntensity: videoStyle.visualIntensity,
        narrativeIntensity: videoStyle.narrativeIntensity,
        selectedDirector: videoStyle.selectedDirector
      },
      artistReferenceImages,
      selectedEditingStyle: {
        id: selectedEditingStyle.id,
        name: selectedEditingStyle.name,
        description: selectedEditingStyle.description,
        duration: selectedEditingStyle.duration
      },
      status: videosGenerated === timelineItems.length && timelineItems.length > 0 ? "completed" : 
              imagesGenerated > 0 ? "generating_images" :
              scriptContent ? "generating_script" : "draft",
      progress: {
        scriptGenerated: !!scriptContent,
        imagesGenerated,
        totalImages: timelineItems.length,
        videosGenerated,
        totalVideos: timelineItems.length
      }
    }, 10000); // Auto-save después de 10 segundos de inactividad
  }, [user?.uid, projectName, audioUrl, transcription, scriptContent, timelineItems, videoStyle, artistReferenceImages, selectedEditingStyle, audioBuffer?.duration]);

  // Convertir los pasos para el componente EnhancedProgressSteps
  // Definir los pasos del workflow con el tipo Step importado
  const workflowSteps: Step[] = [
    {
      id: "transcription",
      name: "Transcripción de Audio",
      description: "Analizando y transcribiendo la letra de tu canción",
      status: currentStep > 1 ? "completed" : currentStep === 1 ? "in-progress" : "pending"
    },
    {
      id: "script",
      name: "Generación de Guion",
      description: "Creando un guion visual basado en la letra",
      status: currentStep > 2 ? "completed" : currentStep === 2 ? "in-progress" : "pending"
    },
    {
      id: "sync",
      name: "Sincronización",
      description: "Alineando el contenido visual con el ritmo musical",
      status: currentStep > 3 ? "completed" : currentStep === 3 ? "in-progress" : "pending"
    },
    {
      id: "scenes",
      name: "Generación de Escenas",
      description: "Creando escenas para cada sección",
      status: currentStep > 4 ? "completed" : currentStep === 4 ? "in-progress" : "pending"
    },
    {
      id: "customization",
      name: "Personalización",
      description: "Ajustando el estilo visual a tus preferencias",
      status: currentStep > 5 ? "completed" : currentStep === 5 ? "in-progress" : "pending"
    },
    {
      id: "movement",
      name: "Integración de Movimiento",
      description: "Añadiendo dinámicas visuales y coreografías",
      status: currentStep > 6 ? "completed" : currentStep === 6 ? "in-progress" : "pending"
    },
    {
      id: "lipsync",
      name: "Sincronización de Labios",
      description: "Sincronizando labios con la letra",
      status: currentStep > 7 ? "completed" : currentStep === 7 ? "in-progress" : "pending"
    },
    {
      id: "generation",
      name: "Generación de Video",
      description: "Creando clips de video con IA",
      status: currentStep > 8 ? "completed" : currentStep === 8 ? "in-progress" : "pending"
    },
    {
      id: "rendering",
      name: "Renderizado Final",
      description: "Combinando todo en un video musical completo",
      status: currentStep > 9 ? "completed" : currentStep === 9 ? "in-progress" : "pending"
    }
  ];

  // Calcular el progreso para las animaciones
  const allStepsCompleted = workflowSteps.every(step => step.status === "completed");
  
  return (
    <div className="min-h-screen bg-black">
      {/* Modal de Onboarding Creativo */}
      <CreativeOnboardingModal
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
        onClose={() => setShowOnboarding(false)}
        preFilledArtistName={preFilledArtistName}
        preFilledSongName={preFilledSongName}
        preFilledAudioFile={selectedFile}
        preFilledImages={artistReferenceImages}
      />

      {/* Modal de Selección de Director y Estilo */}
      <DirectorSelectionModal
        open={showDirectorSelection}
        onSelect={handleDirectorSelection as any}
        preSelectedDirector={videoStyle.selectedDirector}
      />

      {/* Modal de Selección de Concepto */}
      <ConceptSelectionModal
        open={showConceptSelection}
        concepts={conceptProposals}
        directorName={videoStyle.selectedDirector?.name || "El Director"}
        onSelect={handleConceptSelection}
      />

      {/* Character Generation Modal with Multi-Angle & Casting */}
      <CharacterGenerationModalEnhanced
        open={showCharacterGeneration}
        stage={characterGenerationStage}
        progress={characterGenerationProgress}
        character={masterCharacter}
        onContinue={async () => {
          logger.info('👉 Usuario clickeó "Continue to Concept Generation"');
          setShowCharacterGeneration(false);
          
          // Si hay conceptos pendientes de generar, genéralos AHORA
          if (pendingConceptGeneration) {
            logger.info('🎬 Iniciando generación de 3 conceptos...');
            const { transcription, director } = pendingConceptGeneration;
            await handleGenerateConcepts(transcription, director);
            setPendingConceptGeneration(null);
          }
        }}
      />

      {/* Preview Modal - Shows first 10 images for approval */}
      <PreviewImagesModal
        open={showPreviewModal}
        images={previewImages}
        onApprove={handlePreviewApprove}
        onReject={handlePreviewReject}
      />

      {/* Modal de Templates Rápidos */}
      <QuickStartTemplates
        open={showQuickStartTemplates}
        onClose={() => setShowQuickStartTemplates(false)}
        onSelectTemplate={handleTemplateSelection}
      />

      {/* Payment Gate Modal - Shows after free preview generation */}
      <PaymentGateModal
        isOpen={showPaymentGate}
        onClose={() => setShowPaymentGate(false)}
        onPaymentSuccess={handlePaymentSuccess}
        userEmail={user?.email || ''}
        demoImagesCount={FREE_SCENES_LIMIT}
        remainingImagesCount={Math.max(0, (scriptContent ? JSON.parse(scriptContent).scenes?.length || 40 : 40) - FREE_SCENES_LIMIT)}
        totalScenes={scriptContent ? JSON.parse(scriptContent).scenes?.length || 40 : 40}
        aspectRatio={videoAspectRatio}
        songTitle={projectName || songTitle || 'Your Music Video'}
      />

      {/* Timeline Editor Completo - Con todas las herramientas */}
      {!showPreviewModal && (
        <PortalContainerContext.Provider value={isTimelineFullscreen ? timelineContainerRef.current : null}>
        <div 
          ref={timelineContainerRef}
          className={isTimelineFullscreen 
            ? "fixed inset-0 z-[9999] bg-neutral-900" 
            : "relative w-full h-[calc(100vh-200px)] mt-6 rounded-xl overflow-hidden border border-white/10 bg-neutral-900"
          }
        >
          {/* Botón Fullscreen Toggle - Esquina inferior derecha para no interferir */}
          <button
            onClick={toggleTimelineFullscreen}
            className={`absolute z-[60] p-1.5 sm:p-2 bg-orange-500 hover:bg-orange-600 border border-orange-400 rounded-lg transition-all duration-200 group shadow-lg ${
              isTimelineFullscreen 
                ? "bottom-4 right-4" 
                : "bottom-2 right-2 sm:bottom-3 sm:right-3"
            }`}
            title={isTimelineFullscreen ? "Salir de pantalla completa (Esc)" : "Pantalla completa"}
          >
            {isTimelineFullscreen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white sm:w-5 sm:h-5">
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white sm:w-5 sm:h-5">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            )}
          </button>
          
          {typeof window !== 'undefined' && (
            <TimelineEditor
              initialClips={timelineItems}
              duration={audioDuration || 180}
              audioPreviewUrl={audioUrl || undefined}
              audioBuffer={audioBuffer}
              generatedImages={generationProgress.generatedImages}
              onChange={handleTimelineChange}
              projectContext={{
                scriptContent: scriptContent,
                selectedConcept: selectedConcept,
                videoStyle: videoStyle,
                artistReferenceImages: artistReferenceImages,
                masterCharacter: masterCharacter || undefined,
              }}
              onExportComplete={async (videoUrl) => {
                // 🎬 Guardar video en el perfil del artista cuando se exporta
                try {
                  logger.info('📤 [EXPORT] Video exportado, guardando en perfil del artista...');
                  const { saveVideoToProfile } = await import('@/lib/auto-profile-service');
                  const result = await saveVideoToProfile({
                    title: `${songName || projectName || 'Music Video'} - Video Musical`,
                    videoUrl: videoUrl,
                    thumbnailUrl: timelineItems.find(t => t.imageUrl)?.imageUrl || '',
                    description: `Video musical generado con Boostify AI para "${songName || projectName}"`,
                  });
                  if (result.success) {
                    logger.info('✅ [EXPORT] Video guardado en perfil del artista');
                    toast({
                      title: "🎬 Video guardado",
                      description: "El video se ha añadido a tu perfil de artista",
                    });
                  }
                } catch (error) {
                  logger.error('❌ [EXPORT] Error guardando video en perfil:', error);
                }
              }}
            />
          )}
        </div>
        </PortalContainerContext.Provider>
      )}

      {/* Modal de Progreso de Generación de Imágenes */}
      <Dialog open={isGeneratingShots} onOpenChange={() => {}}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-black via-zinc-900 to-black border-orange-500/20">
          <div className="space-y-6 p-2 sm:p-4">
            {/* Encabezado con porcentaje */}
            <div className="text-center space-y-4">
              <motion.div
                className="inline-flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 relative"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute inset-2 rounded-full bg-black flex items-center justify-center">
                  <span className="text-2xl sm:text-4xl font-bold text-orange-400">
                    {generationProgress.percentage}%
                  </span>
                </div>
              </motion.div>
              
              {/* Retry Indicator */}
              {isRetrying && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center gap-2 bg-yellow-500/20 border border-yellow-500/40 rounded-lg px-4 py-2 mt-2"
                >
                  <RefreshCw className="h-4 w-4 text-yellow-400 animate-spin" />
                  <div className="text-sm">
                    <p className="text-yellow-400 font-semibold">Retrying...</p>
                    <p className="text-yellow-300/70 text-xs">{retryMessage}</p>
                  </div>
                </motion.div>
              )}
              
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">
                  Generando Imágenes con IA
                </h2>
                <p className="text-sm sm:text-base text-white/70 mb-1">
                  Creando visuales únicos basados en tu estilo seleccionado
                </p>
                <p className="text-xs sm:text-sm text-orange-400/80">
                  {generationProgress.current} de {generationProgress.total} imágenes completadas
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="space-y-2">
              <Progress value={generationProgress.percentage} className="h-2 bg-zinc-800" />
              <p className="text-xs sm:text-sm text-white/70 text-center">
                {generationProgress.status}
              </p>
            </div>

            {/* Galería secuencial de imágenes - NUEVO COMPONENTE FLUIDO */}
            <SequentialImageGallery 
              images={generationProgress.generatedImages}
              currentPrompt={generationProgress.currentPrompt}
              total={generationProgress.total}
            />

            {/* Mensaje motivacional */}
            <motion.div
              className="text-center text-xs sm:text-sm text-white/60 italic"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ✨ Creando tu video musical único con inteligencia artificial...
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Overlay de progreso mejorado con diseño atractivo */}
      <AnimatePresence>
        {showProgress && (
          <EnhancedProgressModal
            currentStage={currentProgressStage}
            progress={progressPercentage}
            customMessage={progressMessage}
            onComplete={() => {
              setShowProgress(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Efectos visuales para toda la aplicación */}
      {allStepsCompleted && <motion.div className="confetti-container" />}
      
      {/* Sistema de partículas dinámicas basadas en el paso actual - Ajustadas a naranja/negro */}
      {/* Botón de Quick Start - OCULTO pero operativo */}
      {false && currentStep === 1 && !transcription && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="bg-gradient-to-r from-orange-600/20 to-orange-500/20 border-orange-500/30 p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-orange-500 rounded-full p-3">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">🚀 Inicio Rápido con Templates</h3>
                  <p className="text-sm text-white/70">
                    Empieza en segundos con configuración optimizada para tu género musical
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowQuickStartTemplates(true)}
                className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 border-0 shadow-md"
                data-testid="button-quick-start"
              >
                <Zap className="mr-2 h-4 w-4" />
                Ver Templates
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {currentStep === 1 && (
        <ParticleSystem 
          count={30} 
          currentStep={1}
          active={true}
        />
      )}
      
      {currentStep === 2 && (
        <ParticleSystem 
          count={40} 
          currentStep={2}
          active={true}
        />
      )}
      
      {currentStep === 3 && (
        <ParticleSystem 
          count={50} 
          currentStep={3}
          active={true}
        />
      )}
      
      {currentStep === 4 && (
        <ParticleSystem 
          count={60} 
          currentStep={4}
          active={true}
        />
      )}
      
      {currentStep === 6 && (
        <ParticleSystem 
          count={80} 
          currentStep={6}
          active={true}
        />
      )}
      
      {currentStep >= 8 && currentStep < 9 && (
        <ParticleSystem 
          count={120}
          currentStep={8}
          active={true}
        />
      )}
      
      {/* Contenedor principal con posicionamiento relativo para los efectos */}
      <div className="relative">
        {/* Gradiente animado en el fondo - Usando solo naranja y negro */}
        <AnimatedGradient 
          colors={
            currentStep <= 2 ? ["#FF6B00", "#FF8800", "#FF4500", "#111111"] :
            currentStep <= 4 ? ["#FF4500", "#FF8800", "#111111", "#222222"] :
            currentStep <= 6 ? ["#FF7700", "#FF5500", "#111111", "#222222"] :
            currentStep <= 8 ? ["#FF6B00", "#111111", "#FF4500", "#000000"] :
            ["#FF8800", "#FF4500", "#111111", "#000000"]
          } 
          speed={currentStep <= 2 ? 5 : currentStep <= 5 ? 8 : 12} 
          className="opacity-20"
        />
        
        {/* Efectos de brillo según la etapa del proceso */}
        {currentStep >= 5 && currentStep < 7 && (
          <GlowEffect 
            color="purple" 
            size={300} 
            x={25} 
            y={30} 
            pulsate={true} 
            className="opacity-10"
          />
        )}
        
        {currentStep >= 7 && (
          <GlowEffect 
            color="orange" 
            size={350} 
            x={75} 
            y={40} 
            pulsate={true} 
            className="opacity-15"
          />
        )}
        
        {/* Componente de pasos mejorado con animaciones - OCULTO */}
        <div className="hidden">
          <EnhancedProgressSteps
            steps={workflowSteps}
            currentStep={workflowSteps.find(s => s.status === "in-progress")?.id || "transcription"}
            showDescriptions={true}
          />
        </div>
        
        {/* Mantener el ProgressSteps original como fallback (escondido para compatibilidad) */}
        <div className="hidden">
          <ProgressSteps 
            currentStep={String(currentStep)} 
            steps={[
              {
                id: "transcription",
                name: "Transcripción de Audio",
                description: "Analizando y transcribiendo la letra de tu canción",
                status: currentStep > 1 ? "completed" : currentStep === 1 ? "in-progress" : "pending"
              },
              {
                id: "script",
                name: "Generación de Guion",
                description: "Creando un guion visual basado en tu música",
                status: currentStep > 2 ? "completed" : currentStep === 2 ? "in-progress" : "pending"
              },
              {
                id: "sync",
                name: "Sincronización",
                description: "Sincronizando el video con el ritmo de la música",
                status: currentStep > 3 ? "completed" : currentStep === 3 ? "in-progress" : "pending"
              },
              {
                id: "scenes",
                name: "Generación de Escenas",
                description: "Creando las escenas del video musical",
                status: currentStep > 4 ? "completed" : currentStep === 4 ? "in-progress" : "pending"
              },
              {
                id: "customization",
                name: "Personalización",
                description: "Ajustando el estilo visual a tus preferencias",
                status: currentStep > 5 ? "completed" : currentStep === 5 ? "in-progress" : "pending"
              },
              {
                id: "movement",
                name: "Integración de Movimiento",
                description: "Añadiendo coreografías y dinámicas visuales",
                status: currentStep > 6 ? "completed" : currentStep === 6 ? "in-progress" : "pending"
              },
              {
                id: "lipsync",
                name: "Sincronización de Labios",
                description: "Sincronizando labios con la letra de la canción",
                status: currentStep > 7 ? "completed" : currentStep === 7 ? "in-progress" : "pending"
              },
              {
                id: "generation",
                name: "Generación de Video",
                description: "Creando videos con IA a partir de tus escenas",
                status: currentStep > 8 ? "completed" : currentStep === 8 ? "in-progress" : "pending"
              },
              {
                id: "rendering",
                name: "Renderizado Final",
                description: "Combinando todo en tu video musical",
                status: currentStep > 9 ? "completed" : currentStep === 9 ? "in-progress" : "pending"
              }
            ]}
          />
        </div>
      </div> {/* Cierre del div className="relative" */}

      <motion.div 
        className="container py-6 space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ 
            type: "spring",
            stiffness: 300,
            damping: 20,
            delay: 0.1
          }}
        >
          <Card className="p-6 relative overflow-hidden shadow-lg border-none">
            {/* Efectos decorativos múltiples en la esquina */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-radial from-orange-400/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-radial from-purple-500/15 to-transparent rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none" />
            
            {/* Línea decorativa animada - versión mejorada */}
            <motion.div 
              className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-orange-500 via-purple-500 to-blue-500 rounded-full"
              initial={{ width: "0%", opacity: 0.7 }}
              animate={{ 
                width: `${(currentStep / 9) * 100}%`,
                opacity: [0.7, 0.9, 0.7]
              }}
              transition={{ 
                width: { duration: 0.8, ease: "easeOut" },
                opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" }
              }}
            />
            
            {/* Borde brillante animado en la parte superior */}
            <motion.div 
              className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500/0 via-purple-500/30 to-orange-500/0"
              animate={{ 
                opacity: [0, 0.8, 0],
                left: ["-100%", "100%"]
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                ease: "easeInOut", 
                repeatDelay: 1
              }}
            />
            
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <motion.div 
                className="h-14 w-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center border border-orange-500/20 shadow-sm"
                whileHover={{ scale: 1.05 }}
                animate={{ 
                  boxShadow: ["0 0 0 rgba(249, 115, 22, 0)", "0 0 12px rgba(249, 115, 22, 0.3)", "0 0 0 rgba(249, 115, 22, 0)"] 
                }}
                transition={{ 
                  boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" } 
                }}
              >
                <Video className="h-7 w-7 text-orange-500" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-orange-500">
                  Creador de Videos Musicales AI
                </h2>
                <p className="text-sm text-muted-foreground/90 tracking-wide">
                  Transforma tu música en experiencias visuales cautivadoras
                </p>
              </div>
            </div>
            
            {/* Botón para mostrar Mis Videos */}
            <Button
              onClick={() => setShowMyVideos(!showMyVideos)}
              variant={showMyVideos ? "default" : "outline"}
              className={cn(
                "flex items-center gap-2",
                showMyVideos && "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              )}
              data-testid="button-toggle-my-videos"
            >
              <Film className="w-4 h-4" />
              {showMyVideos ? "Volver al Creador" : "Mis Videos"}
            </Button>
          </div>
          
          {/* Dashboard de Mis Videos */}
          {showMyVideos ? (
            <MyGeneratedVideos />
          ) : (
            <>

          {/* Sección de Pasos de Creación - HIDDEN pero operativo */}
          <div className="hidden">
            {/* Título de la sección */}
            <motion.div 
              className="border-b border-orange-500/20 pb-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-orange-500 flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-orange-500" />
                Pasos de Creación
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                Sigue estos pasos para crear tu video musical con IA
              </p>
            </motion.div>

            <div className="space-y-6">
              <motion.div 
                className="border rounded-lg overflow-hidden p-5 bg-gradient-to-br from-zinc-900 to-black shadow-sm relative border-zinc-800"
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  boxShadow: currentStep >= 2 ? "0 0 0 2px rgba(249, 115, 22, 0.2)" : "none"
                }}
                transition={{ duration: 0.5 }}
              >
                {/* Indicador de paso completado */}
                {currentStep >= 2 && (
                  <motion.div 
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-orange-100 text-orange-600 z-10"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </motion.div>
                )}
                
                {/* Título con icono animado */}
                <div className="flex items-center gap-3 mb-4">
                  <motion.div 
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600"
                    whileHover={{ scale: 1.1 }}
                    animate={{ 
                      rotate: isTranscribing ? [0, 10, -10, 0] : 0
                    }}
                    transition={{ 
                      rotate: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
                      scale: { duration: 0.2 }
                    }}
                  >
                    <Music2 className="h-4 w-4" />
                  </motion.div>
                  <Label className="text-lg font-semibold text-orange-500">1. Subir Audio</Label>
                </div>
                
                <div className="space-y-4">
                  <motion.div 
                    className="relative border-2 border-dashed border-orange-300 rounded-lg p-4 hover:border-orange-400 transition-colors bg-black/50"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.webm,.caf,.aiff,.aifc"
                      onChange={handleFileChange}
                      disabled={isTranscribing}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      data-testid="input-audio-file"
                    />
                    <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                      <Upload className="h-8 w-8 text-orange-400 mb-1" />
                      <p className="font-medium text-sm text-center">Arrastra tu archivo de audio o haz clic para seleccionar</p>
                      <p className="text-xs text-muted-foreground text-center">Soporta todos los formatos de audio (MP3, WAV, M4A, iPhone, etc.)</p>
                    </div>
                  </motion.div>
                  
                  {selectedFile && (
                    <motion.div 
                      className="flex items-center gap-3 text-sm p-3 bg-orange-50 rounded-md border border-orange-100"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="bg-orange-100 rounded-full p-1.5">
                        <Music2 className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="flex-1 truncate">
                        <span className="font-medium">{selectedFile.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    </motion.div>
                  )}
                  
                  {isTranscribing && (
                    <motion.div 
                      className="flex items-center gap-3 text-sm p-3 bg-blue-50 rounded-md"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.4 }}
                    >
                      <div className="bg-blue-100 rounded-full p-1.5 relative">
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                        <motion.div 
                          className="absolute inset-0 rounded-full border-2 border-blue-300 border-t-blue-600"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                      <div>
                        <span className="font-medium">Transcribiendo audio...</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          Procesando datos de voz con IA
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              <div className="space-y-6">
                <motion.div 
                  className="border rounded-lg overflow-hidden p-5 bg-gradient-to-br from-zinc-900 to-black shadow-sm relative border-zinc-800"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    boxShadow: currentStep >= 3 ? "0 0 0 2px rgba(79, 70, 229, 0.2)" : "none"
                  }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  {/* Indicador de paso completado */}
                  {currentStep >= 3 && (
                    <motion.div 
                      className="absolute -top-1 -right-1 p-1 rounded-full bg-orange-100 text-orange-600 z-10"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </motion.div>
                  )}
                  
                  {/* Título con icono animado */}
                  <div className="flex items-center gap-3 mb-4">
                    <motion.div 
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600"
                      whileHover={{ scale: 1.1 }}
                      animate={{ 
                        rotate: isGeneratingScript ? [0, 10, -10, 0] : 0
                      }}
                      transition={{ 
                        rotate: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
                        scale: { duration: 0.2 }
                      }}
                    >
                      <FileText className="h-4 w-4" />
                    </motion.div>
                    <Label className="text-lg font-semibold text-orange-500">2. Transcripción</Label>
                  </div>
                  
                  <div className="space-y-4">
                    <motion.div 
                      className="relative"
                      animate={{ opacity: 1 }}
                      initial={{ opacity: 0.8 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ScrollArea className="h-[200px] w-full rounded-md border border-orange-500/20 bg-black/80 p-4 shadow-inner">
                        {transcription ? (
                          <motion.pre 
                            className="text-sm whitespace-pre-wrap font-normal text-slate-700"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                          >
                            {transcription}
                          </motion.pre>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                            <FileText className="h-8 w-8 mb-2 text-slate-400" />
                            <p className="text-sm text-slate-500">Sube un archivo de audio para ver la transcripción</p>
                          </div>
                        )}
                      </ScrollArea>
                    </motion.div>
                    
                    {/* Mostrar botón de continuar cuando la transcripción se ha completado pero no se ha avanzado al paso 2 */}
                    {currentStep === 1.5 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        {/* Sección para seleccionar director */}
                        <div className="border border-orange-500/30 rounded-lg p-4 bg-orange-950/20">
                          <div className="flex items-center gap-2 mb-3">
                            <User className="h-5 w-5 text-orange-400" />
                            <Label className="text-base font-semibold text-orange-400">
                              Seleccionar Director
                            </Label>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            Elige un director para definir el estilo visual del video musical
                          </p>
                          
                          {directors.length > 0 ? (
                            <div className="space-y-3">
                              <Select
                                value={videoStyle.selectedDirector?.id || ""}
                                onValueChange={(directorId) => {
                                  const director = directors.find(d => d.id === directorId);
                                  setVideoStyle(prev => ({
                                    ...prev,
                                    selectedDirector: director || null
                                  }));
                                }}
                              >
                                <SelectTrigger className="bg-black/40">
                                  <SelectValue placeholder="Seleccionar director" />
                                </SelectTrigger>
                                <SelectContent>
                                  {directors.map((director) => (
                                    <SelectItem key={director.id} value={director.id}>
                                      <div className="flex items-center gap-2">
                                        {director.imageUrl && (
                                          <img
                                            src={director.imageUrl}
                                            alt={director.name}
                                            className="w-8 h-8 rounded-full object-cover"
                                          />
                                        )}
                                        <div className="grid gap-0.5">
                                          <span className="font-medium">{director.name}</span>
                                          <span className="text-xs text-muted-foreground">{director.specialty}</span>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {videoStyle.selectedDirector && (
                                <div className="p-3 bg-black/40 rounded-lg border border-orange-500/20">
                                  <div className="flex items-center gap-3">
                                    {videoStyle.selectedDirector.imageUrl && (
                                      <img
                                        src={videoStyle.selectedDirector.imageUrl}
                                        alt={videoStyle.selectedDirector.name}
                                        className="w-12 h-12 rounded-full object-cover"
                                      />
                                    )}
                                    <div className="space-y-1">
                                      <h4 className="font-semibold text-sm">{videoStyle.selectedDirector.name}</h4>
                                      <p className="text-xs text-muted-foreground">{videoStyle.selectedDirector.specialty}</p>
                                      <div className="flex items-center gap-1">
                                        <span className="text-orange-500 text-sm">★</span>
                                        <span className="text-xs">{videoStyle.selectedDirector.rating?.toFixed(1) || 'N/A'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 bg-black/40 rounded-lg">
                              <p className="text-xs text-muted-foreground">Cargando directores...</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Sección para subir imágenes de referencia del artista */}
                        <div className="border border-purple-500/30 rounded-lg p-4 bg-purple-950/20">
                          <div className="flex items-center gap-2 mb-3">
                            <ImageIcon className="h-5 w-5 text-purple-400" />
                            <Label className="text-base font-semibold text-purple-400">
                              Imágenes de Referencia del Artista (Opcional)
                            </Label>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            Sube hasta 3 fotos del artista para que Nano Banana las use como referencia al generar las escenas del video
                          </p>
                          
                          {/* Grid para mostrar las imágenes subidas */}
                          {artistReferenceImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              {artistReferenceImages.map((img, index) => (
                                <div key={index} className="relative group">
                                  <img 
                                    src={img} 
                                    alt={`Referencia ${index + 1}`}
                                    className="w-full h-24 object-cover rounded-md border border-purple-500/40"
                                  />
                                  <button
                                    onClick={() => removeReferenceImage(index)}
                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    data-testid={`remove-reference-${index}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Botón para subir imágenes */}
                          {artistReferenceImages.length < 3 && (
                            <div className="relative">
                              <Input
                                type="file"
                                accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.bmp"
                                multiple
                                onChange={handleReferenceImageUpload}
                                disabled={isUploadingReferences}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                data-testid="upload-reference-images"
                              />
                              <div className="border-2 border-dashed border-purple-400/40 rounded-lg p-3 hover:border-purple-400 transition-colors bg-purple-950/10 cursor-pointer">
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <Upload className="h-6 w-6 text-purple-400" />
                                  <p className="text-xs font-medium text-center text-purple-300">
                                    {isUploadingReferences ? "Cargando..." : `Subir imágenes (${artistReferenceImages.length}/3)`}
                                  </p>
                                  <p className="text-xs text-muted-foreground text-center">
                                    Todos los formatos (JPG, PNG, HEIC, WEBP, etc.) - Máx. 5MB
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <Button
                          onClick={generateConceptProposals}
                          disabled={!videoStyle.selectedDirector || isGeneratingConcepts}
                          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md"
                          data-testid="continue-to-next-step"
                        >
                          {isGeneratingConcepts ? (
                            <motion.div className="flex items-center justify-center">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              <span>Generando conceptos...</span>
                            </motion.div>
                          ) : (
                            <motion.div 
                              className="flex items-center"
                              whileHover={{ scale: 1.02 }}
                            >
                              <Sparkles className="mr-2 h-4 w-4" />
                              <span>Generar 3 Propuestas de Concepto</span>
                            </motion.div>
                          )}
                        </Button>
                      </motion.div>
                    )}
                    
                    {/* Paso 1.7: Mostrar 3 propuestas de concepto para que el usuario escoja */}
                    {currentStep === 1.7 && conceptProposals.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-4 mt-6"
                      >
                        <div className="text-center mb-6">
                          <h3 className="text-xl font-bold text-orange-500 mb-2">🎬 Elige tu Concepto Favorito</h3>
                          <p className="text-sm text-muted-foreground">
                            El director {videoStyle.selectedDirector?.name} ha creado 3 propuestas diferentes. Selecciona la que más te guste.
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {conceptProposals.map((concept, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className={cn(
                                "border rounded-lg p-4 cursor-pointer transition-all",
                                selectedConcept === concept
                                  ? "border-orange-500 bg-orange-500/10 shadow-lg"
                                  : "border-zinc-700 bg-black/40 hover:border-orange-400/50"
                              )}
                              onClick={() => setSelectedConcept(concept)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-lg text-orange-400">
                                  {concept.title || `Concepto ${index + 1}`}
                                </h4>
                                {selectedConcept === concept && (
                                  <CheckCircle2 className="h-5 w-5 text-orange-500" />
                                )}
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-semibold text-white">Historia:</span>
                                  <p className="text-muted-foreground line-clamp-3">
                                    {concept.story_concept}
                                  </p>
                                </div>
                                
                                <div>
                                  <span className="font-semibold text-white">Tema Visual:</span>
                                  <p className="text-muted-foreground line-clamp-2">
                                    {concept.visual_theme}
                                  </p>
                                </div>
                                
                                {concept.color_palette && (
                                  <div>
                                    <span className="font-semibold text-white">Paleta:</span>
                                    <div className="flex gap-1 mt-1">
                                      {concept.color_palette.primary_colors?.slice(0, 3).map((color: string, i: number) => (
                                        <div
                                          key={i}
                                          className="w-6 h-6 rounded-full border border-white/20"
                                          style={{ backgroundColor: color }}
                                          title={color}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                        
                        <Button
                          onClick={() => {
                            if (selectedConcept) {
                              setCurrentStep(2);
                              toast({
                                title: "Concepto seleccionado",
                                description: "Ahora puedes generar el guion completo",
                              });
                            } else {
                              toast({
                                title: "Selecciona un concepto",
                                description: "Haz clic en una de las propuestas para continuar",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={!selectedConcept}
                          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Continuar con este concepto
                        </Button>
                      </motion.div>
                    )}
                    
                    <Button
                      onClick={generateScriptFromTranscription}
                      disabled={!transcription || isGeneratingScript || currentStep < 2}
                      className={cn(
                        "w-full group relative overflow-hidden transition-all",
                        transcription && !isGeneratingScript && currentStep >= 2 
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md" 
                          : ""
                      )}
                    >
                      {isGeneratingScript ? (
                        <motion.div className="flex items-center justify-center w-full">
                          <motion.div 
                            className="mr-2"
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          >
                            <Loader2 className="h-4 w-4" />
                          </motion.div>
                          <span>Generando guion...</span>
                        </motion.div>
                      ) : (
                        <motion.div 
                          className="flex items-center justify-center w-full"
                          whileHover={{ scale: 1.02 }}
                          transition={{ duration: 0.2 }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          <span>Generar Guion Musical</span>
                        </motion.div>
                      )}
                      
                      {/* Efecto de brillo al pasar el mouse */}
                      {transcription && !isGeneratingScript && currentStep >= 2 && (
                        <motion.div 
                          className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"
                          animate={{ translateX: ["100%", "-100%"] }}
                          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", repeatDelay: 0.5 }}
                        />
                      )}
                    </Button>
                  </div>
                </motion.div>

                <motion.div 
                  className="border rounded-lg overflow-hidden p-5 bg-gradient-to-br from-zinc-900 to-black shadow-sm relative border-zinc-800"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    boxShadow: currentStep >= 4 ? "0 0 0 2px rgba(124, 58, 237, 0.2)" : "none"
                  }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  {/* Indicador de paso completado */}
                  {currentStep >= 4 && (
                    <motion.div 
                      className="absolute -top-1 -right-1 p-1 rounded-full bg-orange-100 text-orange-600 z-10"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </motion.div>
                  )}
                  
                  {/* Título con icono animado y badge */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <motion.div 
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600"
                        whileHover={{ scale: 1.1 }}
                        animate={scriptContent ? { 
                          scale: [1, 1.05, 1],
                          rotate: [0, 2, -2, 0]
                        } : {}}
                        transition={{ 
                          repeat: scriptContent ? Infinity : 0,
                          repeatDelay: 3,
                          duration: 1
                        }}
                      >
                        <Film className="h-4 w-4" />
                      </motion.div>
                      <Label className="text-lg font-semibold text-orange-500">3. Guion Profesional</Label>
                    </div>
                    
                    {scriptContent && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Badge variant="outline" className="bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 hover:from-amber-100 hover:to-yellow-100 border-amber-200">
                          <Film className="h-3 w-3 mr-1" />
                          Análisis cinematográfico
                        </Badge>
                      </motion.div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {!scriptContent ? (
                      <motion.div 
                        className="flex flex-col items-center justify-center py-8 text-center rounded-md bg-gradient-to-b from-zinc-900 to-black border border-zinc-800 shadow-sm"
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <motion.div
                          animate={{ 
                            y: [0, -5, 0],
                            opacity: [0.5, 0.8, 0.5]
                          }}
                          transition={{ 
                            repeat: Infinity,
                            duration: 3,
                            ease: "easeInOut"
                          }}
                        >
                          <Film className="h-14 w-14 mb-3 text-orange-400" />
                        </motion.div>
                        <p className="max-w-md font-medium text-gray-600">El guion profesional se generará basado en la transcripción de la letra.</p>
                        <div className="mt-4 grid grid-cols-3 gap-3 max-w-lg">
                          <div className="flex flex-col items-center p-3 rounded-lg bg-orange-50/50 border border-orange-100">
                            <span className="text-xs font-semibold text-orange-800 mb-1">Estilo</span>
                            <span className="text-[10px] text-center text-orange-600">Análisis de género y estética</span>
                          </div>
                          <div className="flex flex-col items-center p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                            <span className="text-xs font-semibold text-amber-800 mb-1">Arco</span>
                            <span className="text-[10px] text-center text-amber-600">Estructura narrativa</span>
                          </div>
                          <div className="flex flex-col items-center p-3 rounded-lg bg-orange-50/50 border border-orange-100">
                            <span className="text-xs font-semibold text-orange-800 mb-1">Técnica</span>
                            <span className="text-[10px] text-center text-orange-600">Dirección escénica</span>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        <motion.div 
                          className="grid grid-cols-3 gap-2 text-xs mb-4"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ 
                            duration: 0.5,
                            staggerChildren: 0.1
                          }}
                        >
                          <motion.div 
                            className="bg-gradient-to-br from-zinc-900 to-black p-3 rounded-md border border-orange-800/30 shadow-sm"
                            whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(251, 191, 36, 0.1)" }}
                            transition={{ duration: 0.2 }}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                          >
                            <span className="font-semibold block text-orange-400">Análisis Musical</span>
                            <span className="text-orange-300">Género y estructura</span>
                          </motion.div>
                          <motion.div 
                            className="bg-gradient-to-br from-zinc-900 to-black p-3 rounded-md border border-orange-800/30 shadow-sm"
                            whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(249, 115, 22, 0.1)" }}
                            transition={{ duration: 0.2 }}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            
                          >
                            <span className="font-semibold block text-orange-400">Narrativa Visual</span>
                            <span className="text-orange-300">Arco emocional y mensajes</span>
                          </motion.div>
                          <motion.div 
                            className="bg-gradient-to-br from-zinc-900 to-black p-3 rounded-md border border-orange-800/30 shadow-sm"
                            whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(249, 115, 22, 0.1)" }}
                            transition={{ duration: 0.2 }}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                          >
                            <span className="font-semibold block text-orange-400">Dirección Técnica</span>
                            <span className="text-orange-300">Planos, transiciones, mood</span>
                          </motion.div>
                        </motion.div>
                        
                        <motion.div
                          className="relative overflow-hidden rounded-lg"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3, duration: 0.5 }}
                        >
                          {/* Efecto de resplandor superior */}
                          <motion.div 
                            className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-orange-400/0 via-orange-500/50 to-orange-400/0 z-10"
                            animate={{ 
                              opacity: [0.3, 0.7, 0.3]
                            }}
                            transition={{ 
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                          
                          <ScrollArea className="h-[300px] w-full rounded-md border border-zinc-800 p-4 bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100 shadow-inner">
                            <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{scriptContent}</pre>
                          </ScrollArea>
                        </motion.div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                <motion.div 
                  ref={visualStyleRef}
                  className="border rounded-lg overflow-hidden p-5 bg-gradient-to-br from-zinc-900 to-black shadow-sm relative border-zinc-800"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    boxShadow: currentStep >= 5 ? "0 0 0 2px rgba(244, 63, 94, 0.2)" : "none"
                  }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  {/* Indicador de paso completado */}
                  {currentStep >= 5 && (
                    <motion.div 
                      className="absolute -top-1 -right-1 p-1 rounded-full bg-orange-100 text-orange-600 z-10"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </motion.div>
                  )}
                  
                  {/* Título con icono animado */}
                  <div className="flex items-center gap-3 mb-6">
                    <motion.div 
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600"
                      whileHover={{ scale: 1.1 }}
                      animate={{ 
                        rotate: [0, -5, 5, 0],
                      }}
                      transition={{ 
                        rotate: { repeat: Infinity, duration: 5, ease: "easeInOut", repeatDelay: 1 },
                        scale: { duration: 0.2 }
                      }}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </motion.div>
                    <div>
                      <Label className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-orange-500">4. Estilo Visual</Label>
                      <p className="text-xs text-muted-foreground">Define la estética visual de tu video musical</p>
                    </div>
                  </div>
                  
                  <div className="grid gap-5">
                    <motion.div 
                      className="space-y-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center justify-between">
                        <Label className="font-medium text-orange-900/80">Formato de Cámara</Label>
                        <motion.div 
                          className="h-6 w-6 rounded-full bg-orange-50 flex items-center justify-center text-orange-500"
                          whileHover={{ scale: 1.2, backgroundColor: "rgb(255 237 213 / 1)" }}
                          transition={{ duration: 0.2 }}
                        >
                          <Film className="h-3 w-3" />
                        </motion.div>
                      </div>
                      <Select
                        value={videoStyle.cameraFormat}
                        onValueChange={(value) => setVideoStyle(prev => ({ ...prev, cameraFormat: value }))}
                      >
                        <SelectTrigger className="bg-black/90 border-orange-500/20 focus:ring-orange-500 h-11 text-white/90">
                          <SelectValue placeholder="Seleccionar formato de cámara" />
                        </SelectTrigger>
                        <SelectContent>
                          {videoStyles.cameraFormats.map((format) => (
                            <SelectItem key={format.name} value={format.name}>
                              <div className="grid gap-1">
                                <span>{format.name}</span>
                                <span className="text-xs text-muted-foreground">{format.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </motion.div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <motion.div 
                        className="space-y-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      >
                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-orange-900/80">Mood</Label>
                          <motion.div 
                            className="h-6 w-6 rounded-full bg-orange-50 flex items-center justify-center text-orange-500"
                            whileHover={{ scale: 1.2, backgroundColor: "rgb(255 237 213 / 1)" }}
                            transition={{ duration: 0.2 }}
                          >
                            <span className="text-xs font-semibold">M</span>
                          </motion.div>
                        </div>
                        <Select
                          value={videoStyle.mood}
                          onValueChange={(value) => setVideoStyle(prev => ({ ...prev, mood: value }))}
                        >
                          <SelectTrigger className="bg-black/90 border-orange-500/20 focus:ring-orange-500 h-11 text-white/90">
                            <SelectValue placeholder="Seleccionar mood" />
                          </SelectTrigger>
                          <SelectContent>
                            {videoStyles.moods.map((mood) => (
                              <SelectItem key={mood} value={mood}>
                                {mood}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </motion.div>

                      <motion.div 
                        className="space-y-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                      >
                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-orange-900/80">Paleta de Colores</Label>
                          <div className="flex space-x-1">
                            <motion.div 
                              className="h-4 w-4 rounded-full bg-orange-400"
                              whileHover={{ scale: 1.2 }}
                              transition={{ duration: 0.2 }}
                            />
                            <motion.div 
                              className="h-4 w-4 rounded-full bg-orange-600"
                              whileHover={{ scale: 1.2 }}
                              transition={{ duration: 0.2 }}
                            />
                            <motion.div 
                              className="h-4 w-4 rounded-full bg-zinc-900"
                              whileHover={{ scale: 1.2 }}
                              transition={{ duration: 0.2 }}
                            />
                          </div>
                        </div>
                        <Select
                          value={videoStyle.colorPalette}
                          onValueChange={(value) => setVideoStyle(prev => ({ ...prev, colorPalette: value }))}
                        >
                          <SelectTrigger className="bg-black/90 border-orange-500/20 focus:ring-orange-500 h-11 text-white/90">
                            <SelectValue placeholder="Seleccionar paleta" />
                          </SelectTrigger>
                          <SelectContent>
                            {videoStyles.colorPalettes.map((palette) => (
                              <SelectItem key={palette} value={palette}>
                                {palette}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </motion.div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <motion.div 
                        className="space-y-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.3 }}
                      >
                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-orange-900/80">Estilo de Personajes</Label>
                          <motion.div 
                            className="h-6 w-6 rounded-full bg-orange-50 flex items-center justify-center text-orange-500"
                            whileHover={{ scale: 1.2, backgroundColor: "rgb(255 237 213 / 1)" }}
                            transition={{ duration: 0.2 }}
                          >
                            <User className="h-3 w-3" />
                          </motion.div>
                        </div>
                        <Select
                          value={videoStyle.characterStyle}
                          onValueChange={(value) => setVideoStyle(prev => ({ ...prev, characterStyle: value }))}
                        >
                          <SelectTrigger className="bg-black/90 border-orange-500/20 focus:ring-orange-500 h-11 text-white/90">
                            <SelectValue placeholder="Seleccionar estilo" />
                          </SelectTrigger>
                          <SelectContent>
                            {videoStyles.characterStyles.map((style) => (
                              <SelectItem key={style} value={style}>
                                {style}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </motion.div>

                      <motion.div 
                        className="space-y-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.4 }}
                      >
                        <div className="flex items-center justify-between">
                          <Label className="font-medium text-orange-900/80">
                            Intensidad Visual
                            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                              {videoStyle.visualIntensity}%
                            </span>
                          </Label>
                        </div>
                        <div className="pt-2">
                          <Slider
                            value={[videoStyle.visualIntensity]}
                            onValueChange={([value]) => setVideoStyle(prev => ({ ...prev, visualIntensity: value }))}
                            max={100}
                            step={1}
                            className="py-2"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>Sutil</span>
                            <span>Impactante</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    <motion.div 
                      className="space-y-3 pt-1"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.5 }}
                    >
                      <div className="flex items-center justify-between">
                        <Label className="font-medium text-orange-900/80">
                          Intensidad Narrativa 
                          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                            {videoStyle.narrativeIntensity}%
                          </span>
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Ajusta qué tan fielmente el video sigue la narrativa de la letra
                      </p>
                      <div className="pt-1">
                        <Slider
                          value={[videoStyle.narrativeIntensity]}
                          onValueChange={([value]) => setVideoStyle(prev => ({ ...prev, narrativeIntensity: value }))}
                          max={100}
                          step={1}
                          className="py-2"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Abstracto</span>
                          <span>Literal</span>
                        </div>
                      </div>
                    </motion.div>

                    <div className="space-y-2">
                      <Label>Imagen de Referencia</Label>
                      <div className="grid gap-4">
                        <Input
                          type="file"
                          accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.bmp"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = async (e) => {
                                const base64 = e.target?.result as string;
                                setVideoStyle(prev => ({
                                  ...prev,
                                  referenceImage: base64
                                }));
                                await analyzeReferenceImage(base64);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        {videoStyle.referenceImage && (
                          <div className="relative aspect-video w-full rounded-lg overflow-hidden">
                            <img
                              src={videoStyle.referenceImage}
                              alt="Referencia de estilo"
                              className="object-cover w-full h-full"
                            />
                          </div>
                        )}
                        {videoStyle.styleDescription && (
                          <div className="p-4 bg-muted rounded-lg">
                            <p className="text-sm">{videoStyle.styleDescription}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Director del Video</Label>
                      {directors.length > 0 ? (
                        <div className="grid gap-4">
                          <Select
                            value={videoStyle.selectedDirector?.id || ""}
                            onValueChange={(directorId) => {
                              const director = directors.find(d => d.id === directorId);
                              setVideoStyle(prev => ({
                                ...prev,
                                selectedDirector: director || null
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar director" />
                            </SelectTrigger>
                            <SelectContent>
                              {directors.map((director) => (
                                <SelectItem key={director.id} value={director.id}>
                                  <div className="flex items-center gap-2">
                                    {director.imageUrl && (
                                      <img
                                        src={director.imageUrl}
                                        alt={director.name}
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    )}
                                    <div className="grid gap-0.5">
                                      <span className="font-medium">{director.name}</span>
                                      <span className="text-xs text-muted-foreground">{director.specialty}</span>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {videoStyle.selectedDirector && (
                            <div className="p-4 bg-muted rounded-lg">
                              <div className="flex items-center gap-4">
                                {videoStyle.selectedDirector.imageUrl && (
                                  <img
                                    src={videoStyle.selectedDirector.imageUrl}
                                    alt={videoStyle.selectedDirector.name}
                                    className="w-16 h-16 rounded-full object-cover"
                                  />
                                )}
                                <div className="space-y-1">
                                  <h4 className="font-semibold">{videoStyle.selectedDirector.name}</h4>
                                  <p className="text-sm text-muted-foreground">{videoStyle.selectedDirector.experience}</p>
                                  <p className="text-sm">{videoStyle.selectedDirector.style}</p>
                                  <div className="flex items-center gap-1">
                                    <span className="text-orange-500">★</span>
                                    <span className="text-sm">{videoStyle.selectedDirector.rating.toFixed(1)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 border rounded-lg bg-muted">
                          <p className="text-sm text-muted-foreground">Cargando directores...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  className="border border-orange-500/30 rounded-lg overflow-hidden p-5 bg-gradient-to-br from-black to-black/70 shadow-sm relative"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    boxShadow: currentStep >= 6 ? "0 0 0 2px rgba(255, 98, 0, 0.4)" : "none"
                  }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  {/* Indicador de paso completado */}
                  {currentStep >= 6 && (
                    <motion.div 
                      className="absolute -top-1 -right-1 p-1 rounded-full bg-orange-100 text-orange-600 z-10"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </motion.div>
                  )}
                  
                  {/* Título con icono animado */}
                  <div className="flex items-center gap-3 mb-6">
                    <motion.div 
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 text-orange-500"
                      whileHover={{ scale: 1.1 }}
                      animate={{ 
                        rotate: [0, -3, 3, 0],
                      }}
                      transition={{ 
                        rotate: { repeat: Infinity, duration: 4, ease: "easeInOut", repeatDelay: 1 },
                        scale: { duration: 0.2 }
                      }}
                    >
                      <Waves className="h-4 w-4" />
                    </motion.div>
                    <div>
                      <Label className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-orange-300">5. Crear Timeline</Label>
                      <p className="text-xs text-white/70">Genera el timeline basado en el guión del video musical</p>
                    </div>
                  </div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Button
                      onClick={syncAudioWithTimeline}
                      disabled={!audioBuffer || isGeneratingShots || currentStep < 3}
                      className="w-full mb-3 h-12 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 border-0 shadow-md"
                    >
                      {isGeneratingShots ? (
                        <motion.div className="flex items-center justify-center gap-2" animate={{ opacity: [0.7, 1] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span>Creando timeline desde guión...</span>
                        </motion.div>
                      ) : (
                        <motion.div className="flex items-center justify-center" whileHover={{ scale: 1.03 }} transition={{ duration: 0.2 }}>
                          <RefreshCcw className="mr-2 h-4 w-4" />
                          <span>Crear Timeline desde Guión</span>
                        </motion.div>
                      )}
                    </Button>
                  </motion.div>
                </motion.div>

                <div className="border rounded-lg p-4 mt-4">
                  <Label className="text-lg font-semibold mb-4">Estilo de Edición</Label>
                  <RadioGroup
                    value={selectedEditingStyle.id}
                    onValueChange={(value) => {
                      const style = editingStyles.find(s => s.id === value);
                      if (style) setSelectedEditingStyle(style);
                    }}
                    className="grid grid-cols-2 gap-4"
                  >
                    {editingStyles.map((style) => (
                      <div key={style.id} className="flex items-start space-x-3">
                        <RadioGroupItem value={style.id} id={style.id} />
                        <div className="grid gap-1.5">
                          <Label htmlFor={style.id} className="font-medium">
                            {style.name}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {style.description} ({style.duration.min}s - {style.duration.max}s)
                          </p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Project Management */}
                {user && (
                  <div className="mt-6">
                    <ProjectManager
                      userId={user?.id}
                      projectName={projectName}
                      onProjectNameChange={setProjectName}
                      onSaveProject={handleSaveProject}
                      onLoadProject={handleLoadProject}
                      isSaving={isSavingProject}
                      currentProjectId={currentProjectId}
                      hasImages={timelineItems.some(item => item.generatedImage || item.firebaseUrl)}
                      clips={timelineItems as any}
                      audioUrl={audioUrl || undefined}
                      audioDuration={audioDuration}
                      hasUserPaid={hasUserPaid}
                      onShowPaymentGate={() => setShowPaymentGate(true)}
                      videoGenerationsCount={videoGenerationsCount}
                      onVideoRenderComplete={(videoUrl) => {
                        logger.info('✅ Video rendered:', videoUrl);
                        setVideoGenerationsCount(prev => prev + 1);
                      }}
                    />
                  </div>
                )}

                {/* Video Generation with FAL Models */}
                {timelineItems.length > 0 && (
                  <div className="mt-6">
                    <VideoModelSelector
                      onGenerateVideo={handleGenerateIndividualVideo}
                      onGenerateAllVideos={handleGenerateAllVideos}
                      isGenerating={isGeneratingVideos}
                      scenesCount={timelineItems.length}
                      hasImages={timelineItems.some(item => item.generatedImage || item.firebaseUrl)}
                      selectedSceneId={selectedSceneId}
                    />
                  </div>
                )}

                {/* Video Generation Progress */}
                {isGeneratingVideos && videoGenerationProgress.total > 0 && (
                  <div className="mt-4 p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="font-medium">Generating Videos...</span>
                    </div>
                    <Progress 
                      value={(videoGenerationProgress.current / videoGenerationProgress.total) * 100} 
                      className="h-2"
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      {videoGenerationProgress.current} of {videoGenerationProgress.total} videos completed
                    </p>
                  </div>
                )}

                {/* Secciones "Generar Prompts" y "Generar Imágenes" eliminadas - ahora automático */}

                {/* Componente de Generación de Video (Paso 8) */}
                {currentStep === 8 && (
                  <div className="mt-6">
                    <div className="border rounded-lg p-4 mb-6">
                      <Label className="text-lg font-semibold mb-4">8. Generación de Video</Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        Genera un video a partir de tus escenas sincronizadas. Este paso utiliza IA para convertir
                        tus imágenes en secuencias de video fluidas con efectos profesionales.
                      </p>
                      <VideoGenerator
                        onGenerateVideo={async (settings) => {
                          logger.info("Configuración para generar video:", settings);
                          toast({
                            title: "Generación iniciada",
                            description: `Generando video con modelo ${settings.model}, calidad ${settings.quality}`
                          });
                          await generateVideo();
                        }}
                        isLoading={isGeneratingVideo}
                        scenesCount={timelineItems.length}
                        clips={timelineItems.map(item => ({
                          id: typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10),
                          start: (item.start_time - (timelineItems[0]?.start_time || 0)) / 1000,
                          duration: (item.duration || 0) / 1000,
                          type: 'image' as const,
                          layer: 1, // Añadimos layer=1 para video/imagen
                          thumbnail: typeof item.generatedImage === 'string' ? item.generatedImage : (typeof item.firebaseUrl === 'string' ? item.firebaseUrl : undefined),
                          title: item.shotType || 'Escena',
                          description: item.description || '',
                          imageUrl: typeof item.generatedImage === 'string' ? item.generatedImage : (typeof item.firebaseUrl === 'string' ? item.firebaseUrl : undefined),
                          imagePrompt: item.imagePrompt,
                          metadata: {
                            section: item.metadata?.section || 'default',
                            movementApplied: item.metadata?.movementApplied,
                            movementPattern: item.metadata?.movementPattern,
                            movementIntensity: item.metadata?.movementIntensity,
                            faceSwapApplied: item.metadata?.faceSwapApplied,
                            musicianIntegrated: item.metadata?.musicianIntegrated
                          }
                        }))}
                        duration={audioBuffer?.duration || 0}
                        isGenerating={isGeneratingVideo}
                        onGenerate={async () => { await generateVideo(); return; }}
                      />
                      {videoId && (
                        <Button 
                          className="w-full mt-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 border-0 shadow-md"
                          onClick={() => setCurrentStep(9)}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Continuar a Renderizado Final
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Pasos 5, 6, 7 eliminados - flujo simplificado */}

                {/* Paso 8: Generación de Video */}
                {currentStep === 8 && (
                  <div className="mt-6">
                    <div className="border rounded-lg p-4 mb-6">
                      <Label className="text-lg font-semibold mb-4">8. Generación de Video</Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        Genera videos dinámicos a partir de tus escenas utilizando inteligencia artificial avanzada.
                      </p>
                      <VideoGenerator
                        scenesCount={timelineItems.length}
                        isLoading={isGeneratingVideo}
                        onGenerateVideo={async (settings) => {
                          logger.info("Configuración para generar video:", settings);
                          toast({
                            title: "Generación iniciada",
                            description: `Generando video con modelo ${settings.model}, calidad ${settings.quality}`
                          });
                          
                          try {
                            await generateVideo();
                            setCurrentStep(9);
                          } catch (error) {
                            logger.error("Error generando video:", error);
                            toast({
                              title: "Error",
                              description: "No se pudo generar el video. Intenta de nuevo.",
                              variant: "destructive"
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Paso 9: Renderizado Final con Upscaling */}
                {currentStep === 9 && (
                  <div className="mt-6">
                    <div className="border rounded-lg p-4 mb-6">
                      <Label className="text-lg font-semibold mb-4">9. Renderizado Final</Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        El proceso de creación ha terminado. Ahora puedes mejorar la calidad de tu video musical con Qubico Video Toolkit antes de exportarlo.
                      </p>
                      
                      {/* Botón prominente para Generar Video Final con Pipeline Completo */}
                      <div className="mb-6 p-4 bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/30 rounded-xl">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-orange-500/20 rounded-full">
                            <Sparkles className="h-6 w-6 text-orange-500" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">🎬 Genera tu Video Musical Completo</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                              Convertiremos tus {timelineItems.filter(item => item.generatedImage || item.firebaseUrl).length} imágenes en un video musical profesional 
                              con lipsync integrado. Recibirás un email cuando esté listo.
                            </p>
                            <Button 
                              onClick={handleOpenVideoProcessingModal}
                              className="bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-purple-700 text-white shadow-lg"
                              disabled={!currentProjectId || timelineItems.filter(item => item.generatedImage || item.firebaseUrl).length < 5}
                            >
                              <Video className="mr-2 h-4 w-4" />
                              Generar Video Final
                              <Sparkles className="ml-2 h-4 w-4" />
                            </Button>
                            {!currentProjectId && (
                              <p className="text-xs text-amber-500 mt-2">⚠️ Guarda el proyecto primero</p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <FinalRendering
                        timelineClips={timelineItems.map(item => ({
                          id: typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10),
                          start: (item.start_time - (timelineItems[0]?.start_time || 0)) / 1000,
                          duration: (item.duration || 0) / 1000,
                          title: item.shotType || 'Escena',
                          type: 'video' as const,
                          layer: 1, // Añadimos layer=1 para video/imagen
                          thumbnail: item.generatedImage || fallbackImage
                        }))}
                        videoUrl={generatedVideoUrl || '/assets/Standard_Mode_Generated_Video (2).mp4'}
                        onUpscaleVideo={async (options) => {
                          try {
                            setIsUpscaling(true);
                            // Llamar al servicio real de upscaling
                            const result = await upscaleVideo(
                              generatedVideoUrl || '/assets/Standard_Mode_Generated_Video (2).mp4', 
                              options
                            );
                            
                            if (result.success && result.url) {
                              setUpscaledVideoUrl(result.url);
                              return result.url;
                            } else {
                              throw new Error(result.error || 'Error al mejorar el video');
                            }
                          } catch (error) {
                            logger.error('Error en upscaling:', error);
                            throw error;
                          } finally {
                            setIsUpscaling(false);
                          }
                        }}
                        onDownloadVideo={downloadVideo}
                        onShareVideo={shareMusicVideo}
                      />
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Separador visual entre creación y edición avanzada */}
            <motion.div 
              className="my-12 py-8 border-t border-orange-500/30"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <motion.div 
                className="border-l-4 border-purple-500 pl-4 mb-6"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-blue-500 to-cyan-500 flex items-center gap-3">
                  <Film className="h-7 w-7 text-purple-500" />
                  Editor de Timeline
                </h3>
                <p className="text-muted-foreground mt-3 text-base">
                  Edita y ajusta las escenas de tu video en el timeline. Perfecciona cada detalle antes de la generación final.
                </p>
              </motion.div>
            </motion.div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-4">
                  {/* Enhanced Scenes Gallery */}
                  {timelineItems.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <EnhancedScenesGallery
                        scenes={timelineItems}
                        currentTime={currentTime}
                        onSceneClick={(scene, index) => {
                          // Navigate to scene in timeline
                          if (scene.start_time !== undefined) {
                            setCurrentTime(scene.start_time);
                          }
                        }}
                        onRegenerateScene={(sceneId) => {
                          // Use existing regenerate function
                          const id = typeof sceneId === 'string' ? parseInt(sceneId) : sceneId;
                          handleRegenerateImageFromTimeline(id);
                        }}
                        onEditScene={(scene) => {
                          // Open scene editor or allow inline editing
                          toast({
                            title: "Edit Scene",
                            description: "Scene editor will be available soon",
                          });
                        }}
                        onDeleteScene={(sceneId) => {
                          // Remove scene from timeline
                          setTimelineItems(prev => prev.filter(item => item.id !== sceneId));
                          toast({
                            title: "Scene deleted",
                            description: "Scene removed from timeline",
                          });
                        }}
                        onReorderScenes={(reorderedScenes) => {
                          // Update timeline with new order
                          setTimelineItems(reorderedScenes);
                        }}
                        generatingScenes={new Set()}
                      />
                    </motion.div>
                  )}
                  
                  {/* Preview Player - Muestra la imagen actual basada en currentTime */}
                  {/* SIEMPRE visible si hay timeline items, muestra placeholder si falta la imagen */}
                  {timelineItems.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-black/60 backdrop-blur-lg border border-white/10 rounded-lg p-4 mb-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Play className="h-5 w-5 text-green-400" />
                        <h3 className="text-sm font-semibold text-white">Preview en Vivo</h3>
                        <Badge variant="secondary" className="ml-auto">
                          {(currentTime / 1000).toFixed(2)}s / {totalDuration.toFixed(2)}s
                        </Badge>
                      </div>
                      
                      {(() => {
                        // Encontrar la imagen actual basada en currentTime
                        const currentScene = timelineItems.find(item => {
                          const itemStart = item.start_time || 0;
                          const itemEnd = (item.start_time || 0) + (item.duration || 0);
                          return currentTime >= itemStart && currentTime < itemEnd;
                        });
                        
                        const currentImage = currentScene?.imageUrl || currentScene?.thumbnail;
                        
                        return (
                          <div className="relative">
                            {/* Preview de imagen actual */}
                            <div className="aspect-video rounded-lg overflow-hidden bg-black/80 border border-white/20 relative">
                              {currentImage ? (
                                <>
                                  <img
                                    src={currentImage}
                                    alt={currentScene?.title || "Vista previa"}
                                    className="w-full h-full object-contain"
                                  />
                                  {/* Información de la escena actual */}
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <p className="text-white font-semibold text-sm mb-1">
                                          {currentScene?.title || "Escena actual"}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs">
                                          {currentScene?.shotType && (
                                            <Badge className="bg-purple-500/80 border-purple-400 text-white font-mono text-[10px] px-1.5 py-0.5">
                                              {currentScene.shotType}
                                            </Badge>
                                          )}
                                          {currentScene?.metadata?.role && (
                                            <Badge className="bg-blue-500/80 border-blue-400 text-white text-[10px] px-1.5 py-0.5">
                                              {currentScene.metadata.role}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      {isPlaying && (
                                        <div className="flex items-center gap-1.5 text-green-400">
                                          <Activity className="h-4 w-4 animate-pulse" />
                                          <span className="text-[10px] font-semibold">EN VIVO</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                  <ImageIcon className="h-12 w-12 text-white/20" />
                                  <p className="text-white/40 text-sm">
                                    {currentScene ? "Imagen aún no generada" : "Ninguna escena activa"}
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            {/* Indicador de progreso */}
                            {currentScene && (
                              <div className="mt-2 bg-white/10 rounded-full h-1 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-100"
                                  style={{
                                    width: `${((currentTime - (currentScene.start_time || 0)) / (currentScene.duration || 1)) * 100}%`
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                  
                  {/* Timeline Section con ref para scroll automático */}
                  <div ref={timelineRef} className="w-full">
                    <TimelineEditor
                      initialClips={clips || []}
                      duration={totalDuration || 0}
                      audioPreviewUrl={audioUrl || undefined}
                      audioBuffer={audioBuffer}
                      generatedImages={generationProgress.generatedImages}
                      onChange={handleClipUpdate || (() => {})}
                      projectContext={{
                        scriptContent: scriptContent,
                        selectedConcept: selectedConcept,
                        videoStyle: videoStyle,
                        artistReferenceImages: artistReferenceImages,
                        masterCharacter: masterCharacter || undefined,
                      }}
                      onExportComplete={async (videoUrl) => {
                        try {
                          logger.info('📤 [EXPORT] Video exportado, guardando en perfil del artista...');
                          const { saveVideoToProfile } = await import('@/lib/auto-profile-service');
                          const result = await saveVideoToProfile({
                            title: `${songName || projectName || 'Music Video'} - Video Musical`,
                            videoUrl: videoUrl,
                            thumbnailUrl: timelineItems.find(t => t.imageUrl)?.imageUrl || '',
                            description: `Video musical generado con Boostify AI para "${songName || projectName}"`,
                          });
                          if (result.success) {
                            toast({
                              title: "🎬 Video guardado",
                              description: "El video se ha añadido a tu perfil de artista",
                            });
                          }
                        } catch (error) {
                          logger.error('❌ [EXPORT] Error guardando video en perfil:', error);
                        }
                      }}
                    />
                  </div>

                  <AnalyticsDashboard
                    clips={clips}
                    audioBuffer={audioBuffer}
                    duration={totalDuration}
                  />

                  {/* Panel de Sugerencias Inteligentes */}
                  {timelineItems.length > 0 && (
                    <SmartSuggestionsPanel
                      timelineItems={timelineItems}
                      onApplySuggestion={(suggestionId) => {
                        logger.info('Aplicando sugerencia:', suggestionId);
                        
                        if (suggestionId === 'pending-images') {
                          // Iniciar generación de imágenes pendientes
                          const pendingItems = timelineItems.filter(item => !item.generatedImage && !item.firebaseUrl);
                          if (pendingItems.length > 0) {
                            toast({
                              title: "Iniciando generación",
                              description: `Generando ${pendingItems.length} imágenes...`,
                            });
                            // Aquí podrías llamar a la función de generación
                          }
                        } else if (suggestionId === 'similar-clips') {
                          // Regenerar clips similares con variedad
                          toast({
                            title: "Optimización iniciada",
                            description: "Regenerando clips para mayor variedad...",
                          });
                        }
                      }}
                    />
                  )}

                  {/* Controles de Batch Operations */}
                  {selectedClipIds.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4"
                    >
                      <Card className="bg-gradient-to-r from-blue-600/20 to-blue-500/20 border-blue-500/30 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-sm">
                              {selectedClipIds.length} clips seleccionados
                            </Badge>
                            <span className="text-sm text-white/70">
                              Operaciones en lote disponibles
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedClipIds([])}
                              className="text-xs"
                              data-testid="button-clear-selection"
                            >
                              Limpiar selección
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleBatchRegenerateImages}
                              disabled={isBatchRegenerating}
                              className="bg-blue-600 hover:bg-blue-700 text-xs"
                              data-testid="button-batch-regenerate"
                            >
                              <RefreshCw className={`mr-1 h-3 w-3 ${isBatchRegenerating ? 'animate-spin' : ''}`} />
                              {isBatchRegenerating ? 'Regenerando...' : 'Regenerar todas'}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* FIN SECCIÓN HIDDEN */}
          </>
          )}
        </Card>
        </motion.div>
      </motion.div>
      
      {/* Load Project Dialog */}
      <Dialog open={showLoadProjectDialog} onOpenChange={setShowLoadProjectDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Load Project</h2>
              <p className="text-sm text-muted-foreground">Select a project to load</p>
            </div>
            
            {savedProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No saved projects found</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {savedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors flex gap-4"
                    onClick={async () => {
                      await handleLoadProject(project.id);
                      setShowLoadProjectDialog(false);
                    }}
                  >
                    {/* Thumbnail */}
                    {project.thumbnail && (
                      <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted">
                        <img 
                          src={project.thumbnail} 
                          alt={project.projectName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-lg truncate">{project.projectName}</h3>
                          <div className="text-sm text-muted-foreground">
                            {project.artistName && <span className="font-medium">{project.artistName}</span>}
                            {project.artistName && project.songName && <span> • </span>}
                            {project.songName && <span>{project.songName}</span>}
                          </div>
                        </div>
                        <Badge variant={
                          project.status === 'completed' ? 'default' :
                          project.status === 'generating_images' ? 'secondary' :
                          'outline'
                        }>
                          {project.status}
                        </Badge>
                      </div>
                    
                      <div className="text-sm text-muted-foreground space-y-1">
                        {project.progress && (
                          <p>
                            Images: {project.progress.imagesGenerated || 0}/{project.progress.totalImages || 0} • 
                            Videos: {project.progress.videosGenerated || 0}/{project.progress.totalVideos || 0}
                          </p>
                        )}
                        <p>Last updated: {new Date(project.lastModified || project.updatedAt || project.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Processing Modal - Para confirmar renderizado final */}
      <VideoProcessingModal
        isOpen={showVideoProcessingModal}
        onClose={() => setShowVideoProcessingModal(false)}
        projectData={{
          projectId: currentProjectId ? parseInt(currentProjectId) : 0,
          artistName: artistName || videoStyle.artistName || '',
          songName: songName || 'Tu Canción',
          thumbnailUrl: timelineItems[0]?.firebaseUrl || timelineItems[0]?.generatedImage,
          totalScenes: timelineItems.length,
          audioUrl: audioUrl || undefined,
          audioDuration: estimatedDuration / 1000
        }}
        initialEmail={user?.email || ''}
        onConfirm={handleVideoProcessingConfirm}
      />
    </div>
  );
}