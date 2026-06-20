import { useState, useRef, useEffect } from "react";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { 
  Music4, Wand2, ImageIcon, Upload, Loader2, 
  Download, Play, Pause, AlertCircle, Check, RefreshCw, 
  Share2, Save, Sliders, Mic, Info, Clock, Volume2, FileAudio2,
  BadgePlus, Settings2, Settings, FileMusic, Image as ImageLucide,
  Sparkles, Palette, PictureInPicture, HeartPulse, Copy, Eye,
  FileText
} from "lucide-react";
import { masterTrack, separateVocals, splitStems } from "../../lib/api/kits-ai";
import { generateMusic, checkGenerationStatus } from "../../lib/api/zuno-ai";
import { generateImageWithFal } from "../../lib/api/fal-ai";
import { addDoc, collection, serverTimestamp, query, orderBy, getDocs, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Progress } from "../ui/progress";
import { downloadTextFile } from "../../lib/download-helper";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Badge } from "../ui/badge";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";

interface ImageData {
  url: string;
  requestId: string;
  prompt: string;
  category: string;
  createdAt: Date;
}

interface AudioData {
  url: string;
  title: string;
  prompt: string;
  taskId: string;
  createdAt: Date;
}

async function saveMusicianImage(data: ImageData) {
  try {
    const docRef = await addDoc(collection(db, "musician_images"), {
      ...data,
      createdAt: serverTimestamp()
    });
    logger.info("Document written with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    logger.error("Error adding document: ", error);
    throw error;
  }
}

async function saveGeneratedMusic(data: AudioData) {
  try {
    const docRef = await addDoc(collection(db, "generated_music"), {
      ...data,
      createdAt: serverTimestamp()
    });
    logger.info("Music document written with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    logger.error("Error adding music document: ", error);
    throw error;
  }
}

// Estructura musical
interface SongStructure {
  intro?: boolean;
  verse?: boolean;
  chorus?: boolean;
  bridge?: boolean;
  outro?: boolean;
}

// Definición de géneros musicales con sus características
interface MusicGenreTemplate {
  id: string;
  name: string;
  description: string;
  defaultPrompt: string;
  suggestedTags: string[];
  tempo: number; // BPM
  keySignature: string;
  mainInstruments: string[];
  structure: SongStructure;
}

// Parámetros avanzados para generación de música
interface MusicGenerationAdvancedParams {
  // Parámetros comunes
  makeInstrumental: boolean;
  negativeTags: string;
  tags?: string;
  
  // Parámetros específicos para Udio
  lyricsType?: 'generate' | 'user' | 'instrumental';
  customLyrics?: string;
  seed?: number;
  continueClipId?: string;
  continueAt?: number;
  gptDescriptionPrompt?: string;
  
  // Parámetros específicos para Suno
  prompt?: string;
  title?: string;
  
  // Opciones de configuración avanzada
  serviceMode?: 'public' | 'private' | '';
  
  // Flags para funcionalidades adicionales
  generateLyrics?: boolean;
  uploadAudio?: boolean;
  audioUrl?: string;
  
  // Nuevos parámetros de personalización musical
  tempo?: number;
  keySignature?: string;
  mainInstruments?: string[];
  structure?: SongStructure;
  referenceTrackUrl?: string;
  musicTemplate?: string;
}

// Plantillas predefinidas para diferentes géneros musicales
const musicGenreTemplates: MusicGenreTemplate[] = [
  {
    id: "pop",
    name: "Pop",
    description: "Música pop comercial con estructura clara y pegadiza",
    defaultPrompt: "Crear una canción pop moderna con melodía pegadiza, ritmo uptempo y producción contemporánea",
    suggestedTags: ["pop", "commercial", "catchy", "modern", "upbeat"],
    tempo: 120,
    keySignature: "C Major",
    mainInstruments: ["vocals", "synth", "drums", "bass"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  },
  {
    id: "rock",
    name: "Rock",
    description: "Rock energético con guitarras prominentes",
    defaultPrompt: "Componer una canción de rock con guitarras eléctricas distorsionadas, batería intensa y actitud energética",
    suggestedTags: ["rock", "electric guitar", "energetic", "drums", "band"],
    tempo: 130,
    keySignature: "E Minor",
    mainInstruments: ["electric guitar", "drums", "bass", "vocals"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  },
  {
    id: "hiphop",
    name: "Hip Hop",
    description: "Hip hop con beats potentes y espacio para letras",
    defaultPrompt: "Producir un beat hip hop con bajos fuertes, percusión trap y melodía atmosférica para rap",
    suggestedTags: ["hip hop", "trap", "beats", "808", "rap"],
    tempo: 90,
    keySignature: "F Minor",
    mainInstruments: ["808", "drums", "synth", "samples"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: false,
      outro: true
    }
  },
  {
    id: "electronic",
    name: "Electrónica",
    description: "Música electrónica para pistas de baile",
    defaultPrompt: "Crear música electrónica bailable con sintetizadores modernos, ritmos house y build-ups energéticos",
    suggestedTags: ["electronic", "dance", "edm", "synth", "house"],
    tempo: 128,
    keySignature: "G Minor",
    mainInstruments: ["synth", "drums", "bass", "fx"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  },
  {
    id: "rnb",
    name: "R&B",
    description: "R&B moderno con influencias soul",
    defaultPrompt: "Producir una canción R&B moderna con armonías suaves, groove relajado y tonos atmosféricos",
    suggestedTags: ["rnb", "soul", "smooth", "emotional", "modern"],
    tempo: 95,
    keySignature: "D Minor",
    mainInstruments: ["piano", "drums", "bass", "vocals"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  },
  {
    id: "latin",
    name: "Latino",
    description: "Música latina con ritmos bailables",
    defaultPrompt: "Componer música latina con ritmos de reggaeton, percusión tropical y melodía pegadiza para bailar",
    suggestedTags: ["latin", "reggaeton", "danceable", "tropical", "spanish"],
    tempo: 96,
    keySignature: "A Minor",
    mainInstruments: ["reggaeton drums", "bass", "guitar", "vocals"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: false,
      outro: true
    }
  },
  {
    id: "jazz",
    name: "Jazz",
    description: "Jazz clásico o fusión con improvisación",
    defaultPrompt: "Crear una pieza de jazz con piano, contrabajo, batería y saxofón, con secciones de improvisación",
    suggestedTags: ["jazz", "instrumental", "improvisation", "sophisticated", "swing"],
    tempo: 110,
    keySignature: "Bb Major",
    mainInstruments: ["piano", "upright bass", "drums", "saxophone"],
    structure: {
      intro: true,
      verse: true,
      chorus: false,
      bridge: false,
      outro: true
    }
  },
  {
    id: "soundtrack",
    name: "Soundtrack",
    description: "Música para cine, televisión o videojuegos",
    defaultPrompt: "Componer música de soundtrack cinematográfica con orquesta, evolución emocional y temas memorables",
    suggestedTags: ["soundtrack", "cinematic", "orchestral", "emotional", "film"],
    tempo: 80,
    keySignature: "C Minor",
    mainInstruments: ["strings", "brass", "percussion", "piano"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: true,
      outro: true
    }
  }
];

export function MusicAIGenerator() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("mastering");
  
  // Mastering state
  const [isMastering, setIsMastering] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<string>("mastering");
  const [processedAudioUrl, setProcessedAudioUrl] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [masteringIntensity, setMasteringIntensity] = useState(50);
  
  // Music generation state
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [selectedModel, setSelectedModel] = useState("music-s");
  const [generatedMusicUrl, setGeneratedMusicUrl] = useState<string | null>(null);
  const [musicGenerationProgress, setMusicGenerationProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(80);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [recentGenerations, setRecentGenerations] = useState<AudioData[]>([]);
  
  // Advanced music generation params
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [advancedModeType, setAdvancedModeType] = useState<'standard' | 'continuation' | 'lyrics' | 'upload'>('standard');
  const [selectedGenreTemplate, setSelectedGenreTemplate] = useState<string>("");
  const [advancedParams, setAdvancedParams] = useState<MusicGenerationAdvancedParams>({
    // Parámetros comunes
    makeInstrumental: false,
    negativeTags: "bad quality, distortion, noise, repetitive",
    tags: "professional, high quality",
    
    // Parámetros para Udio
    lyricsType: "generate",
    customLyrics: "",
    seed: -1, // -1 para aleatorio
    continueClipId: "",
    continueAt: 0,
    gptDescriptionPrompt: "",
    
    // Parámetros para Suno
    prompt: "",
    title: "",
    
    // Configuración avanzada
    serviceMode: 'public',
    
    // Flags adicionales
    generateLyrics: false,
    uploadAudio: false,
    audioUrl: "",
    
    // Nuevos parámetros musicales
    tempo: 120,
    keySignature: "C Major",
    mainInstruments: ["synth", "drums", "bass", "vocals"],
    structure: {
      intro: true,
      verse: true,
      chorus: true,
      bridge: false,
      outro: true
    },
    musicTemplate: ""
  });
  
  // Cover art state
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverPrompt, setCoverPrompt] = useState("");
  const [coverImageSize, setCoverImageSize] = useState("square");
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState<string | null>(null);
  const [coverGenerationProgress, setCoverGenerationProgress] = useState(0);
  const [imageStyle, setImageStyle] = useState("realistic");
  const [recentCovers, setRecentCovers] = useState<ImageData[]>([]);
  
  // Refs
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  
  // Load recent generations on component mount
  useEffect(() => {
    loadRecentGenerations();
  }, []);
  
  // Aplicar una plantilla de género musical a los parámetros
  const applyMusicTemplate = (templateId: string) => {
    const template = musicGenreTemplates.find(t => t.id === templateId);
    
    if (!template) {
      toast({
        title: "Error",
        description: "Plantilla no encontrada",
        variant: "destructive"
      });
      return;
    }
    
    // Actualizar el prompt y los parámetros avanzados
    setMusicPrompt(template.defaultPrompt);
    setMusicTitle(`${template.name} - ${new Date().toLocaleDateString()}`);
    
    // Actualizar parámetros avanzados con los valores de la plantilla
    setAdvancedParams(prev => ({
      ...prev,
      tags: template.suggestedTags.join(", "),
      tempo: template.tempo,
      keySignature: template.keySignature,
      mainInstruments: template.mainInstruments,
      structure: template.structure,
      musicTemplate: templateId
    }));
    
    // Mostrar notificación
    toast({
      title: "Plantilla aplicada",
      description: `Plantilla de ${template.name} aplicada con éxito`,
    });
    
    // Automáticamente mostrar los parámetros avanzados
    setShowAdvancedParams(true);
  };

  // Load recent generations from Firestore
  const loadRecentGenerations = async () => {
    try {
      // Load recent music generations
      const musicQuery = query(
        collection(db, "generated_music"),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      
      const musicSnapshot = await getDocs(musicQuery);
      const musicData: AudioData[] = [];
      
      musicSnapshot.forEach((doc) => {
        const data = doc.data();
        musicData.push({
          url: data.url,
          title: data.title,
          prompt: data.prompt,
          taskId: data.taskId,
          createdAt: data.createdAt?.toDate() || new Date()
        });
      });
      
      setRecentGenerations(musicData);
      
      // Load recent covers
      const coversQuery = query(
        collection(db, "musician_images"),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      
      const coversSnapshot = await getDocs(coversQuery);
      const coversData: ImageData[] = [];
      
      coversSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.category === 'cover-art') {
          coversData.push({
            url: data.url,
            requestId: data.requestId,
            prompt: data.prompt,
            category: data.category,
            createdAt: data.createdAt?.toDate() || new Date()
          });
        }
      });
      
      setRecentCovers(coversData);
    } catch (error) {
      logger.error("Error loading recent generations:", error);
    }
  };
  
  // Reset progress when changing tabs
  useEffect(() => {
    setProcessingProgress(0);
    setMusicGenerationProgress(0);
    setCoverGenerationProgress(0);
  }, [activeTab]);
  
  // Handle audio player controls and progress
  useEffect(() => {
    const audioEl = audioPlayerRef.current;
    if (!audioEl) return;
    
    const updateProgress = () => {
      setAudioPosition(audioEl.currentTime);
      setAudioDuration(audioEl.duration || 0);
    };
    
    // Función para cargar el audio en el elemento
    const loadAudio = () => {
      if (generatedMusicUrl) {
        // Asegurarnos de que el audio sea recargado
        audioEl.load();
        return true;
      }
      return false;
    };
    
    if (isPlaying) {
      // Establecer volumen antes de reproducir
      audioEl.volume = audioVolume / 100;
      
      // Si tenemos un URL de audio, intentar cargar y reproducir
      if (generatedMusicUrl) {
        loadAudio();
        const playPromise = audioEl.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            logger.error("Error playing audio:", error);
            toast({
              title: "Error de reproducción",
              description: `No se pudo reproducir el audio: ${error.message || 'Error desconocido'}`,
              variant: "destructive"
            });
            setIsPlaying(false);
          });
        }
      } else {
        // No hay URL de audio, no se puede reproducir
        setIsPlaying(false);
        toast({
          title: "Error",
          description: "No hay audio disponible para reproducir",
          variant: "destructive"
        });
      }
    } else {
      audioEl.pause();
    }
    
    // Set up event listeners with named functions for proper cleanup
    const handleTimeUpdate = () => updateProgress();
    const handleLoadedMetadata = () => updateProgress();
    const handleEnded = () => setIsPlaying(false);
    
    audioEl.addEventListener('timeupdate', handleTimeUpdate);
    audioEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioEl.addEventListener('ended', handleEnded);
    
    return () => {
      audioEl.removeEventListener('timeupdate', handleTimeUpdate);
      audioEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioEl.removeEventListener('ended', handleEnded);
    };
  }, [isPlaying, audioVolume, generatedMusicUrl, toast]);

  const handleMasterTrack = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Por favor, selecciona un archivo de audio para procesar",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsMastering(true);
      setProcessingProgress(20);
      
      let result;
      
      // Determinar qué tipo de procesamiento realizar
      if (selectedFileType === "mastering") {
        setProcessingProgress(30);
        result = await masterTrack(selectedFile);
        toast({
          title: "Procesando...",
          description: "Se está masterizando tu pista de audio"
        });
      } else if (selectedFileType === "vocal-separation") {
        setProcessingProgress(30);
        result = await separateVocals(selectedFile);
        toast({
          title: "Procesando...",
          description: "Se están separando las voces del instrumental"
        });
      } else if (selectedFileType === "stem-splitting") {
        setProcessingProgress(30);
        result = await splitStems(selectedFile);
        toast({
          title: "Procesando...",
          description: "Se están separando los stems de la pista"
        });
      }
      
      setProcessingProgress(70);
      
      // Aquí simulamos el procesamiento recibiendo la URL del audio procesado
      // En una implementación real, obtendrías esta URL del resultado de la API
      setProcessedAudioUrl(result?.audio_url || "/assets/music-samples/mastered-sample.mp3");
      setProcessingProgress(100);
      
      toast({
        title: "¡Éxito!",
        description: `¡${selectedFileType === "mastering" ? "Pista masterizada" : 
                        selectedFileType === "vocal-separation" ? "Voces separadas" : 
                        "Stems separados"} con éxito!`
      });

    } catch (error) {
      logger.error("Error procesando el audio:", error);
      toast({
        title: "Error",
        description: `No se pudo procesar el audio. ${error instanceof Error ? error.message : 'Inténtalo de nuevo más tarde.'}`,
        variant: "destructive"
      });
    } finally {
      setIsMastering(false);
    }
  };

  const handleGenerateMusic = async () => {
    if (!musicPrompt && advancedModeType === 'standard') {
      toast({
        title: "Error",
        description: "Por favor, proporciona una descripción para la música que quieres generar",
        variant: "destructive"
      });
      return;
    }

    // Validaciones específicas por tipo de operación
    if (advancedModeType === 'continuation' && !advancedParams.continueClipId) {
      toast({
        title: "Error",
        description: "Para continuar una canción, debes proporcionar un ID de canción válido",
        variant: "destructive"
      });
      return;
    }

    if (advancedModeType === 'upload' && !advancedParams.audioUrl) {
      toast({
        title: "Error",
        description: "Para subir un audio, debes proporcionar una URL válida",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGeneratingMusic(true);
      setMusicGenerationProgress(10);
      
      // Si no hay título, usamos un título genérico
      const title = musicTitle.trim() || "Música Generada";
      
      // Estructura base común para las solicitudes
      let requestParams: any = {
        prompt: musicPrompt,
        modelName: selectedModel,
        title: title
      };

      // ============================================================
      // LYRIA 3 - Enhanced Composition Parameters
      // ============================================================
      if (selectedModel === "music-lyria3") {
        requestParams = {
          prompt: musicPrompt,
          model: "music-lyria3",
          title: title,
          makeInstrumental: advancedParams?.makeInstrumental || false,
          customLyrics: advancedParams?.customLyrics || undefined,
          lyria3Params: {
            genre: advancedParams?.tags || undefined,
            bpm: advancedParams?.seed ? undefined : undefined, // BPM from advanced params if added
            key: advancedParams?.keySignature || undefined,
            mood: undefined, // Extracted from prompt by the backend
            instruments: undefined,
            vocalStyle: undefined,
            durationHint: "2 minutes",
            outputFormat: "mp3",
            useClipModel: false,
            language: undefined,
            productionStyle: undefined,
            dynamics: undefined,
          }
        };

        // Send generation request
        const result = await generateMusic(requestParams);
        setCurrentTaskId(result.taskId);
        setMusicGenerationProgress(30);

        toast({
          title: "Lyria 3 Pro — Generating",
          description: "Google DeepMind's Lyria 3 is composing your song with enhanced AI. This may take ~60 seconds."
        });

        // Poll status
        const checkLyria3Status = async () => {
          if (!result.taskId) return;
          const status = await checkGenerationStatus(result.taskId);
          if (status.status === "processing") {
            setMusicGenerationProgress(60);
            setTimeout(checkLyria3Status, 3000);
          } else if (status.status === "completed") {
            setMusicGenerationProgress(100);
            setIsGeneratingMusic(false);
            if (status.audioUrl) {
              setGeneratedAudioUrl(status.audioUrl);
              toast({ title: "Lyria 3 — Complete!", description: "Your AI-composed song is ready to play." });
            }
          } else if (status.status === "failed") {
            setIsGeneratingMusic(false);
            toast({ title: "Generation Failed", description: status.error || "An error occurred", variant: "destructive" });
          } else if (status.status === "pending") {
            setMusicGenerationProgress(20);
            setTimeout(checkLyria3Status, 3000);
          }
        };
        setTimeout(checkLyria3Status, 3000);
        return;
      }

      // ============================================================
      // STANDARD MODELS (Suno/Udio) - Original flow
      // ============================================================
      
      // Configuración según el modo avanzado seleccionado
      if (showAdvancedParams) {
        // Determinar el tipo de tarea según el modo avanzado
        let taskType = 'generate_music';
        
        if (advancedModeType === 'continuation') {
          // Estamos continuando una canción existente
          taskType = 'generate_music';
          
          // Para Udio (music-u)
          if (selectedModel === "music-u") {
            requestParams = {
              ...requestParams,
              taskType,
              continueClipId: advancedParams.continueClipId,
              continueAt: advancedParams.continueAt || 0,
              lyricsType: advancedParams.lyricsType || "generate",
              customLyrics: advancedParams.customLyrics || "",
              negativeTags: advancedParams.negativeTags,
              gptDescriptionPrompt: musicPrompt,
              seed: advancedParams.seed || -1, // -1 para aleatorio
              serviceMode: advancedParams.serviceMode || 'public'
            };
          } 
          // Para Suno (music-s)
          else if (selectedModel === "music-s") {
            requestParams = {
              ...requestParams,
              taskType,
              continueClipId: advancedParams.continueClipId,
              continueAt: advancedParams.continueAt || 0,
              makeInstrumental: advancedParams.makeInstrumental,
              tags: advancedParams.tags || "generación ai, música profesional",
              negativeTags: advancedParams.negativeTags,
              serviceMode: advancedParams.serviceMode || 'public'
            };
          }
        } 
        else if (advancedModeType === 'upload') {
          // Estamos subiendo un audio
          taskType = 'upload_audio';
          requestParams = {
            ...requestParams,
            taskType,
            audioUrl: advancedParams.audioUrl,
            serviceMode: advancedParams.serviceMode || 'public'
          };
        }
        else if (advancedModeType === 'lyrics') {
          // Estamos generando solo letras
          taskType = 'generate_lyrics';
          requestParams = {
            ...requestParams,
            taskType,
            prompt: musicPrompt,
            serviceMode: advancedParams.serviceMode || 'public'
          };
        }
        else {
          // Generación estándar pero con parámetros avanzados
          // Para modelo Suno (music-s)
          if (selectedModel === "music-s") {
            requestParams = {
              ...requestParams,
              taskType: 'generate_music',
              makeInstrumental: advancedParams.makeInstrumental,
              tags: advancedParams.tags || "generación ai, música profesional",
              negativeTags: advancedParams.negativeTags,
              title: title,
              prompt: musicPrompt,
              serviceMode: advancedParams.serviceMode || 'public'
            };
          } 
          // Para modelo Udio (music-u)
          else if (selectedModel === "music-u") {
            requestParams = {
              ...requestParams,
              taskType: 'generate_music',
              lyricsType: advancedParams.lyricsType || "generate",
              lyrics: advancedParams.customLyrics || "",
              negativeTags: advancedParams.negativeTags,
              gptDescriptionPrompt: musicPrompt,
              seed: advancedParams.seed !== undefined ? advancedParams.seed : Math.floor(Math.random() * 1000000),
              serviceMode: advancedParams.serviceMode || 'public'
            };
          }
        }
      }
      
      // Enviamos la solicitud a la API
      const result = await generateMusic(requestParams);
      
      setCurrentTaskId(result.taskId);
      setMusicGenerationProgress(30);
      
      const modelName = selectedModel === "music-s" ? "Suno" : selectedModel === "music-u" ? "Udio" : selectedModel === "music-fal" ? "FAL Minimax" : "Stable Audio";
      toast({
        title: "Generación iniciada",
        description: `La música se está generando con el modelo ${modelName}, esto puede tomar varios minutos`
      });

      // Consultar el estado periódicamente
      const checkStatus = async () => {
        if (!result.taskId) return;
        
        const status = await checkGenerationStatus(result.taskId);
        
        if (status.status === "processing") {
          setMusicGenerationProgress(60);
          setTimeout(checkStatus, 5000);
        } else if (status.status === "completed") {
          setMusicGenerationProgress(100);
          setIsGeneratingMusic(false);
          
          // Guardar la URL del audio generado
          if (status.audioUrl) {
            setGeneratedMusicUrl(status.audioUrl);
            
            // Guardar en Firestore
            try {
              // Guardar con metadata enriquecida
              const metadataToSave = {
                url: status.audioUrl,
                title: title,
                prompt: musicPrompt,
                taskId: result.taskId,
                model: selectedModel,
                advancedParams: showAdvancedParams ? advancedParams : null,
                createdAt: new Date()
              };
              
              await saveGeneratedMusic({
                url: status.audioUrl,
                title: title,
                prompt: musicPrompt,
                taskId: result.taskId,
                createdAt: new Date()
              });
              
              // Recargar las generaciones recientes
              await loadRecentGenerations();
              
            } catch (saveError) {
              logger.error("Error al guardar la música generada:", saveError);
            }
            
            toast({
              title: "¡Éxito!",
              description: "¡Música generada con éxito! Puedes reproducirla ahora.",
              variant: "default"
            });
          } else {
            toast({
              title: "Advertencia",
              description: "Música generada pero no se pudo obtener la URL del audio.",
              variant: "destructive"
            });
          }
        } else if (status.status === "failed") {
          setIsGeneratingMusic(false);
          // El status puede contener un mensaje pero no siempre está en .error
          const errorMessage = status.message || status.error || 'Error desconocido';
          
          toast({
            title: "Error",
            description: `La generación falló: ${errorMessage}`,
            variant: "destructive"
          });
        }
      };
      
      // Iniciar la verificación de estado
      setTimeout(checkStatus, 3000);

    } catch (error) {
      logger.error("Error generando música:", error);
      setMusicGenerationProgress(0);
      toast({
        title: "Error",
        description: "No se pudo generar la música. Por favor, inténtalo de nuevo.",
        variant: "destructive"
      });
      setIsGeneratingMusic(false);
    }
  };

  const handleGenerateCover = async () => {
    if (!coverPrompt) {
      toast({
        title: "Error",
        description: "Por favor, proporciona una descripción para la portada",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGeneratingCover(true);
      setCoverGenerationProgress(20);
      
      const result = await generateImageWithFal({
        prompt: coverPrompt,
        negativePrompt: "baja calidad, borroso, distorsionado, deformado, poco realista, caricatura, anime, ilustración, texto, marca de agua",
        imageSize: coverImageSize
      });
      
      setCoverGenerationProgress(70);

      if (result.data && result.data.images && result.data.images[0]) {
        const imageUrl = result.data.images[0].url;
        setGeneratedCoverUrl(imageUrl);
        setCoverGenerationProgress(100);

        // Guardar en Firestore
        await saveMusicianImage({
          url: imageUrl,
          requestId: result.requestId,
          prompt: coverPrompt,
          category: 'cover-art',
          createdAt: new Date()
        });

        toast({
          title: "¡Éxito!",
          description: "¡Portada generada y guardada con éxito!"
        });
      } else {
        throw new Error("Formato de respuesta inválido desde Fal.ai");
      }

    } catch (error) {
      logger.error("Error generando portada:", error);
      setCoverGenerationProgress(0);
      toast({
        title: "Error",
        description: "No se pudo generar la portada. Por favor, inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingCover(false);
    }
  };
  
  const handleCopyPrompt = (prompt: string, type: string) => {
    navigator.clipboard.writeText(prompt);
    toast({
      title: "Copiado",
      description: `Prompt para ${type === 'music' ? 'música' : 'portada'} copiado al portapapeles`
    });
  };
  
  const handleDownloadAudio = (url: string | null, title: string = "audio_procesado") => {
    if (!url) {
      toast({
        title: "Error",
        description: "No hay URL de audio disponible para descargar",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Validación de seguridad mejorada
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        toast({
          title: "Error de seguridad",
          description: "La URL del audio no es válida o no está disponible",
          variant: "destructive"
        });
        return;
      }

      // Verificar que sea una URL válida con estructura correcta
      new URL(url);
      
      // Crear un enlace temporal para descargar el audio
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/\s+/g, '_').substring(0, 50)}.mp3`; // Limitar longitud del nombre
      link.type = "audio/mpeg"; // Agregar MIME type para mejor compatibilidad
      
      // Proceso de descarga con manejo de errores
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Descarga iniciada",
        description: "Tu audio se está descargando...",
      });
      
      toast({
        title: "Descargando",
        description: `Descargando ${title}`
      });
    } catch (error) {
      logger.error("Error en la descarga de audio:", error);
      toast({
        title: "Error",
        description: "No se pudo descargar el audio. URL inválida.",
        variant: "destructive"
      });
    }
  };
  
  const handleDownloadImage = (url: string | null) => {
    if (!url) {
      toast({
        title: "Error",
        description: "No hay URL de imagen disponible para descargar",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Validación de seguridad mejorada
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        toast({
          title: "Error de seguridad",
          description: "La URL de la imagen no es válida o no está disponible",
          variant: "destructive"
        });
        return;
      }
      
      // Verificar que sea una URL válida con estructura correcta
      new URL(url);
      
      // Crear un enlace temporal para descargar la imagen
      const link = document.createElement('a');
      link.href = url;
      link.download = `portada_${new Date().getTime()}.jpg`;
      link.type = "image/jpeg"; // Agregar MIME type para mejor compatibilidad
      
      // Proceso de descarga con manejo de errores
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Descarga iniciada",
        description: "Tu imagen se está descargando...",
      });
    } catch (error) {
      logger.error("Error en la descarga de imagen:", error);
      toast({
        title: "Error",
        description: "No se pudo descargar la imagen. La URL no es válida o no se puede acceder al recurso.",
        variant: "destructive"
      });
    }
  };
  
  const handleExportMetadata = (type: 'music' | 'cover') => {
    let metadata = {};
    let filename = "";
    
    if (type === 'music' && currentTaskId) {
      metadata = {
        title: musicTitle || "Música Generada",
        prompt: musicPrompt,
        model: selectedModel,
        taskId: currentTaskId,
        generatedAt: new Date().toISOString(),
        audioUrl: generatedMusicUrl
      };
      filename = `metadata_musica_${currentTaskId}.json`;
    } else if (type === 'cover' && generatedCoverUrl) {
      metadata = {
        prompt: coverPrompt,
        imageSize: coverImageSize,
        generatedAt: new Date().toISOString(),
        imageUrl: generatedCoverUrl
      };
      filename = `metadata_portada_${new Date().getTime()}.json`;
    }
    
    const jsonContent = JSON.stringify(metadata, null, 2);
    downloadTextFile(jsonContent, filename);
    
    toast({
      title: "Exportando",
      description: `Metadata de ${type === 'music' ? 'música' : 'portada'} exportada`
    });
  };

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 music-header-container">
        <h2 className="text-2xl sm:text-3xl font-bold">Herramientas de IA para Música</h2>
        <div className="bg-orange-500/10 dark:bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-1.5 text-xs md:text-sm text-orange-600 dark:text-orange-400">
          <span className="hidden sm:inline">Potenciado por </span>IA avanzada
        </div>
      </div>
      
      <Tabs 
        defaultValue="mastering" 
        className="space-y-6"
        onValueChange={(value) => setActiveTab(value)}
      >
        <TabsList className="w-full flex overflow-x-auto no-scrollbar justify-start sm:justify-center mb-2 music-tabs-list">
          <TabsTrigger value="mastering" className="flex-1 sm:flex-initial music-tab-trigger">
            <Wand2 className="mr-2 h-4 w-4" />
            <span className="hidden xs:inline">AI</span> Mastering
          </TabsTrigger>
          <TabsTrigger value="generation" className="flex-1 sm:flex-initial music-tab-trigger">
            <Music4 className="mr-2 h-4 w-4" />
            <span className="hidden xs:inline">Music</span> Generation
          </TabsTrigger>
          <TabsTrigger value="cover" className="flex-1 sm:flex-initial music-tab-trigger">
            <ImageIcon className="mr-2 h-4 w-4" />
            Cover Art
          </TabsTrigger>
        </TabsList>

        {/* Mastering Tab */}
        <TabsContent value="mastering">
          <Card className="p-4 sm:p-6 backdrop-blur-sm border border-orange-500/10">
            <div className="w-full max-w-xl mx-auto space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-orange-500" />
                    Procesamiento de Audio
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Mejora la calidad de tu música con tecnología avanzada de IA
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="audio-file-type">Tipo de procesamiento</Label>
                  <Select
                    value={selectedFileType}
                    onValueChange={setSelectedFileType}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="Selecciona tipo de procesamiento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mastering">Masterización de Audio</SelectItem>
                      <SelectItem value="vocal-separation">Separación de Voces</SelectItem>
                      <SelectItem value="stem-splitting">Separación de Stems</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="audio-file">Selecciona un archivo de audio (.wav, .mp3, .aif)</Label>
                  <Input
                    id="audio-file"
                    type="file"
                    accept=".wav,.mp3,.aif,.aiff,.flac"
                    onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                    className="mt-1.5"
                  />
                </div>

                <Button
                  onClick={handleMasterTrack}
                  className="w-full"
                  disabled={isMastering || !selectedFile}
                >
                  {isMastering ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      {selectedFileType === "mastering" ? "Masterizar Pista" : 
                       selectedFileType === "vocal-separation" ? "Separar Voces" : 
                       "Separar Stems"}
                    </>
                  )}
                </Button>
                
                {(isMastering || processingProgress > 0) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Procesando audio...</span>
                      <span>{processingProgress}%</span>
                    </div>
                    <Progress value={processingProgress} />
                  </div>
                )}
                
                {processedAudioUrl && (
                  <div className="p-4 rounded-lg border bg-muted/40">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium flex items-center">
                        <Music4 className="h-4 w-4 mr-1 text-orange-500" />
                        Audio procesado
                      </h3>
                      <div className="flex gap-1">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7" 
                          onClick={() => handleDownloadAudio(processedAudioUrl)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    <audio
                      controls
                      className="w-full mt-2"
                      preload="metadata"
                      onError={(e) => {
                        logger.error("Error loading audio:", e);
                        toast({
                          title: "Error de reproducción",
                          description: "No se pudo cargar el audio procesado. Intenta descargar el archivo directamente.",
                          variant: "destructive"
                        });
                      }}
                      onLoadedData={() => {
                        logger.info("Audio cargado correctamente");
                      }}
                    >
                      {processedAudioUrl && (
                        <>
                          <source src={processedAudioUrl} type="audio/mpeg" />
                          <source src={processedAudioUrl} type="audio/mp3" />
                        </>
                      )}
                      Tu navegador no soporta la reproducción de audio
                      <p className="text-xs text-muted-foreground">
                        Tu navegador no soporta la reproducción de audio.
                      </p>
                    </audio>
                    
                    <p className="text-xs text-muted-foreground mt-2">
                      {selectedFileType === "mastering" ? 
                        "La versión masterizada suena más equilibrada y profesional." : 
                        selectedFileType === "vocal-separation" ? 
                        "Se han separado las voces del instrumental." : 
                        "Se han separado los diferentes instrumentos en stems individuales."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Generation Tab */}
        <TabsContent value="generation">
          <Card className="backdrop-blur-sm border border-orange-500/10 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Music4 className="h-5 w-5 text-orange-500" />
                Generación Musical
              </CardTitle>
              <CardDescription>
                Describe la música que quieres crear y la IA la generará para ti
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-5">
              <div className="w-full max-w-xl mx-auto space-y-5">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Label htmlFor="music-title" className="flex items-center gap-1">
                      <FileMusic className="h-3.5 w-3.5 text-orange-400" />
                      Título de la canción
                    </Label>
                    <Input
                      id="music-title"
                      placeholder="Ej: Mi canción de verano"
                      value={musicTitle}
                      onChange={(e) => setMusicTitle(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <Label htmlFor="music-model" className="flex items-center gap-1">
                      <BadgePlus className="h-3.5 w-3.5 text-orange-400" />
                      Modelo de generación
                    </Label>
                    <Select
                      value={selectedModel}
                      onValueChange={setSelectedModel}
                    >
                      <SelectTrigger className="w-full mt-1.5">
                        <SelectValue placeholder="Selecciona un modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="music-s">
                          <div className="flex items-center">
                            <Sparkles className="mr-2 h-4 w-4 text-orange-500" />
                            <span>Suno (Alta calidad, más completo)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="music-u">
                          <div className="flex items-center">
                            <FileMusic className="mr-2 h-4 w-4 text-indigo-500" />
                            <span>Udio (Rápido, más experimental)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="music-prompt" className="flex items-center gap-1">
                      <Mic className="h-3.5 w-3.5 text-orange-400" />
                      Descripción de la música
                    </Label>
                    {musicPrompt && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleCopyPrompt(musicPrompt, 'music')}
                        className="h-7 px-2 text-xs"
                      >
                        <span>Copiar prompt</span>
                      </Button>
                    )}
                  </div>
                  <Textarea
                    id="music-prompt"
                    placeholder="Ej: Una canción pop alegre con guitarra acústica y percusión suave. Tempo medio, ideal para un video de verano con vibración positiva. Mencione el sol, la arena y el mar en la letra."
                    value={musicPrompt}
                    onChange={(e) => setMusicPrompt(e.target.value)}
                    className="mt-1.5 min-h-[100px]"
                  />
                </div>
                
                {/* Toggle para parámetros avanzados */}
                <div className="flex items-center space-x-2 pt-2 border-t">
                  <Switch
                    id="advanced-params"
                    checked={showAdvancedParams}
                    onCheckedChange={setShowAdvancedParams}
                  />
                  <Label htmlFor="advanced-params" className="cursor-pointer">
                    <div className="flex items-center">
                      <Settings className="h-4 w-4 mr-1 text-orange-500" />
                      <span>Opciones avanzadas</span>
                    </div>
                  </Label>
                </div>
                
                {/* Parámetros avanzados */}
                {showAdvancedParams && (
                  <div className="bg-muted/40 p-4 rounded-lg border border-orange-500/10 space-y-4">
                    <h3 className="text-sm font-medium mb-3 flex items-center">
                      <Sliders className="h-4 w-4 mr-1 text-orange-500" />
                      Ajustes avanzados de generación
                    </h3>
                    
                    {/* Controles específicos según el modelo seleccionado */}
                    {selectedModel === "music-s" ? (
                      <>
                        {/* Controles para Suno */}
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="make-instrumental"
                            checked={advancedParams.makeInstrumental}
                            onCheckedChange={(checked) => 
                              setAdvancedParams({...advancedParams, makeInstrumental: checked})
                            }
                          />
                          <Label htmlFor="make-instrumental" className="cursor-pointer">
                            Instrumental (sin letra)
                          </Label>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <Info className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs text-xs">
                                  Activa esta opción para generar música sin letras vocales.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        
                        <div>
                          <Label htmlFor="tags" className="text-sm">Etiquetas adicionales</Label>
                          <Input
                            id="tags"
                            placeholder="pop, energético, verano, profesional"
                            value={advancedParams.tags || ''}
                            onChange={(e) => 
                              setAdvancedParams({...advancedParams, tags: e.target.value})
                            }
                            className="mt-1"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Controles para Udio */}
                        <div>
                          <Label htmlFor="lyrics-type" className="text-sm">Tipo de letra</Label>
                          <Select
                            value={advancedParams.lyricsType || 'generate'}
                            onValueChange={(value) =>
                              setAdvancedParams({
                                ...advancedParams,
                                lyricsType: value as 'generate' | 'user' | 'instrumental'
                              })
                            }
                          >
                            <SelectTrigger id="lyrics-type" className="mt-1">
                              <SelectValue placeholder="Selecciona tipo de letra" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="generate">Generar automáticamente</SelectItem>
                              <SelectItem value="user">Usar mi propia letra</SelectItem>
                              <SelectItem value="instrumental">Instrumental (sin letra)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {advancedParams.lyricsType === 'user' && (
                          <div>
                            <Label htmlFor="custom-lyrics" className="text-sm">Letra personalizada</Label>
                            <Textarea
                              id="custom-lyrics"
                              placeholder="Ingresa tu propia letra para la canción"
                              value={advancedParams.customLyrics || ''}
                              onChange={(e) =>
                                setAdvancedParams({...advancedParams, customLyrics: e.target.value})
                              }
                              className="mt-1 min-h-[100px]"
                            />
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Controles comunes para ambos modelos */}
                    <div>
                      <Label htmlFor="negative-tags" className="text-sm">
                        Etiquetas negativas (lo que NO quieres)
                      </Label>
                      <Input
                        id="negative-tags"
                        placeholder="ruido, distorsión, baja calidad"
                        value={advancedParams.negativeTags}
                        onChange={(e) =>
                          setAdvancedParams({...advancedParams, negativeTags: e.target.value})
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={handleGenerateMusic}
                  className="w-full"
                  disabled={isGeneratingMusic || !musicPrompt}
                  size="lg"
                >
                  {isGeneratingMusic ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generando música...
                    </>
                  ) : (
                    <>
                      <Music4 className="mr-2 h-5 w-5" />
                      Generar con {selectedModel === "music-s" ? "Suno" : "Udio"}
                    </>
                  )}
                </Button>
                
                {(isGeneratingMusic || musicGenerationProgress > 0) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Generando música con {selectedModel === "music-s" ? "Suno" : "Udio"}...</span>
                      <span>{musicGenerationProgress}%</span>
                    </div>
                    <Progress value={musicGenerationProgress} className="h-2" />
                  </div>
                )}
              </div>
              
              {/* Resultado de la generación */}
              {generatedMusicUrl && (
                <div className="p-5 rounded-lg border bg-orange-50/10 dark:bg-orange-900/5 mt-6 border-orange-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-medium flex items-center">
                      <Music4 className="h-5 w-5 mr-2 text-orange-500" />
                      {musicTitle || "Música Generada"}
                    </h3>
                    <div className="flex gap-1.5">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setIsPlaying(!isPlaying)}
                            >
                              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isPlaying ? "Pausar" : "Reproducir"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleDownloadAudio(generatedMusicUrl, musicTitle || "música_generada")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Descargar MP3</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleExportMetadata('music')}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Exportar metadata</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  
                  {/* Audio element (hidden but functional) */}
                  <audio
                    ref={audioPlayerRef}
                    onEnded={() => setIsPlaying(false)}
                    preload="metadata"
                    onError={(e) => {
                      logger.error("Error en reproducción de audio:", e);
                      toast({
                        title: "Error de reproducción",
                        description: "No se pudo reproducir el audio generado. Intenta descargar el archivo directamente.",
                        variant: "destructive"
                      });
                      setIsPlaying(false);
                    }}
                    onLoadedData={() => logger.info("Audio generado cargado correctamente")}
                    className="hidden"
                  >
                    {generatedMusicUrl && (
                      <>
                        <source src={generatedMusicUrl} type="audio/mpeg" />
                        <source src={generatedMusicUrl} type="audio/mp3" />
                      </>
                    )}
                    Tu navegador no soporta la reproducción de audio
                    <p className="text-xs text-muted-foreground">
                      Tu navegador no soporta la reproducción de audio.
                    </p>
                  </audio>
                  
                  {/* Custom audio player */}
                  <div className="space-y-2">
                    <div className="relative w-full h-16 bg-black/5 dark:bg-white/5 rounded-md overflow-hidden flex items-center justify-center">
                      <div className="w-full h-full flex items-center justify-center">
                        {isPlaying ? (
                          <div className="flex items-center gap-2">
                            <HeartPulse className="h-5 w-5 text-orange-500 animate-pulse" />
                            <span className="text-sm">Reproduciendo audio generado...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Volume2 className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Listo para reproducir</span>
                          </div>
                        )}
                      </div>
                      <div 
                        className="absolute bottom-0 left-0 h-2 bg-gradient-to-r from-orange-400 to-orange-600"
                        style={{ 
                          width: `${audioPosition && audioDuration ? (audioPosition / audioDuration) * 100 : isPlaying ? 100 : 0}%`, 
                          transition: isPlaying ? 'width 0.1s linear' : 'none' 
                        }}
                      ></div>
                    </div>
                    
                    {/* Volume control */}
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      <Slider
                        className="flex-1"
                        value={[audioVolume]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(val) => setAudioVolume(val[0])}
                      />
                      <span className="text-xs text-muted-foreground min-w-10 text-right">
                        {audioVolume}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-xs text-muted-foreground space-y-1 border-t pt-3">
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Prompt</Badge>
                      <p className="line-clamp-1">{musicPrompt}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {selectedModel === "music-s" ? "Suno" : "Udio"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        ID: {currentTaskId?.substring(0, 8)}...
                      </Badge>
                      {showAdvancedParams && advancedParams.makeInstrumental && (
                        <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-300 text-[10px] hover:bg-orange-500/30 border-orange-500/30">
                          Instrumental
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Recent generations */}
              {recentGenerations.length > 0 && (
                <div className="border-t pt-5 mt-5">
                  <h3 className="text-sm font-medium mb-3 flex items-center">
                    <Clock className="h-4 w-4 mr-1 text-orange-500" />
                    Generaciones recientes
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recentGenerations.slice(0, 4).map((gen) => (
                      <div key={gen.taskId} className="flex items-center p-2 border rounded-md hover:bg-muted/40 cursor-pointer transition-colors"
                        onClick={() => {
                          setGeneratedMusicUrl(gen.url);
                          setMusicTitle(gen.title);
                          setMusicPrompt(gen.prompt);
                          setCurrentTaskId(gen.taskId);
                          setTimeout(() => {
                            setIsPlaying(true);
                          }, 300);
                        }}
                      >
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 mr-2"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{gen.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{gen.prompt.substring(0, 50)}...</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cover Art Tab */}
        <TabsContent value="cover">
          <Card className="p-4 sm:p-6 backdrop-blur-sm border border-orange-500/10">
            <CardHeader className="px-0 pt-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-orange-500" />
                    Portadas con IA
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Crea portadas profesionales para tus canciones y álbumes
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="px-0">
              <div className="w-full max-w-xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cover-format" className="text-sm font-medium">Formato de portada</Label>
                  <Select
                    value={coverImageSize}
                    onValueChange={setCoverImageSize}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="Selecciona un formato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">Cuadrado (1:1) - Para álbumes</SelectItem>
                      <SelectItem value="landscape_16_9">Apaisado (16:9) - Para banners</SelectItem>
                      <SelectItem value="portrait_9_16">Vertical (9:16) - Para móviles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="cover-style" className="text-sm font-medium">Estilo artístico</Label>
                  <Select
                    value={imageStyle}
                    onValueChange={setImageStyle}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="Selecciona un estilo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realistic">Realista</SelectItem>
                      <SelectItem value="abstract">Abstracto</SelectItem>
                      <SelectItem value="minimalist">Minimalista</SelectItem>
                      <SelectItem value="surreal">Surrealista</SelectItem>
                      <SelectItem value="photographic">Fotográfico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
                
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="cover-prompt" className="text-sm font-medium">Descripción de la portada</Label>
                  {coverPrompt && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleCopyPrompt(coverPrompt, 'cover')}
                      className="h-7 px-2 text-xs"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      <span>Copiar prompt</span>
                    </Button>
                  )}
                </div>
                <Textarea
                  id="cover-prompt"
                  placeholder="Ej: Portada minimalista para un álbum de música electrónica. Tonos azules y púrpuras, con formas geométricas que sugieren ondas sonoras."
                  value={coverPrompt}
                  onChange={(e) => setCoverPrompt(e.target.value)}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Usa palabras descriptivas: colores, ambiente, estilo, elementos a incluir.
                </p>
              </div>

              <div className="flex flex-col space-y-2">
                <Button
                  onClick={handleGenerateCover}
                  className="w-full"
                  disabled={isGeneratingCover || !coverPrompt}
                  size="lg"
                >
                  {isGeneratingCover ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generando portada...
                    </>
                  ) : (
                    <>
                      <Palette className="mr-2 h-5 w-5" />
                      Generar Portada
                    </>
                  )}
                </Button>
                
                {(isGeneratingCover || coverGenerationProgress > 0) && (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Generando imagen...</span>
                      <span>{coverGenerationProgress}%</span>
                    </div>
                    <Progress value={coverGenerationProgress} className="h-2" />
                  </div>
                )}
              </div>
              
              {/* Favoritos y generaciones recientes */}
              {recentCovers.length > 0 && !generatedCoverUrl && (
                <div className="mt-8">
                  <h3 className="text-sm font-medium mb-3 flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    Portadas recientes
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {recentCovers.slice(0, 3).map((cover, index) => (
                      <div 
                        key={index} 
                        className="relative rounded-lg overflow-hidden border border-border aspect-square group cursor-pointer"
                        onClick={() => setGeneratedCoverUrl(cover.url)}
                      >
                        <img 
                          src={cover.url} 
                          alt={`Portada reciente ${index + 1}`} 
                          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button size="sm" variant="secondary">
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Ver
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

                {generatedCoverUrl && (
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center justify-between">
                      <Label>Portada Generada</Label>
                      <div className="flex gap-1">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => handleDownloadImage(generatedCoverUrl)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => handleExportMetadata('cover')}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className={`relative overflow-hidden rounded-lg border ${
                      coverImageSize === 'square' ? 'aspect-square' : 
                      coverImageSize === 'landscape_16_9' ? 'aspect-video' : 
                      'aspect-[9/16]'
                    }`}>
                      <img
                        src={generatedCoverUrl}
                        alt="Portada generada"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Prompt: "{coverPrompt}"
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}