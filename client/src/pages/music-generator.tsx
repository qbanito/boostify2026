import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "../lib/logger";
import { MusicGenerationSection } from "../components/music/genre-templates/music-generation-section";
import { MusicGenerationAdvancedParams } from "../components/music/genre-templates/advanced-music-params";
import { 
  musicGenreTemplates, 
  getGenreTemplateById, 
  MusicGenreTemplate
} from "../components/music/genre-templates/genre-data";
import { generateMusic, checkGenerationStatus, getRecentGenerations, saveGeneratedSongToProfile, generateMusicWithFAL, checkFALMusicStatus, generateMusicWithStableAudio, checkStableAudioStatus, generateMusicWithLyria3, checkLyria3Status } from "../lib/api/music-generator-service";
import { useToast } from "../hooks/use-toast";
import { Header } from "../components/layout/header";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/use-auth";
import { isAdminEmail } from "../../../shared/constants";
import { Link } from "wouter";

import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { ScrollArea } from "../components/ui/scroll-area";

import {
  Music,
  Play,
  Pause,
  Download,
  Clock,
  Trash2,
  History,
  Disc3,
  MusicIcon,
  Loader2,
  Wand2,
  Headphones,
  Zap,
  Sparkles,
  Mic,
  Shield,
  PenLine,
  ArrowRight,
  Lock,
  Crown,
  ChevronRight,
  AudioWaveform,
  Layers,
  SplitSquareHorizontal,
  Volume2,
  Radio,
  Sliders,
  Music2,
  Upload,
  FileAudio,
  Scissors,
  BarChart3,
  Check,
  FileText,
  MicVocal,
  Drum,
  AlignLeft,
  Send,
} from "lucide-react";

import { VoiceAIStudio } from "../components/music/voice-ai-studio";
import { CopywriteWorkflow } from "../components/music/copywrite-workflow/copywrite-workflow";
import OriginalSongForm from "../components/music/original-song-form";
import CopyrightCertificateCard from "../components/music/copyright-certificate-card";
import AutoMusicPanel from "../components/music/auto-music-panel";

// Plan access check
const PLAN_HIERARCHY: Record<string, number> = {
  free: 0, artist: 1, creator: 2, professional: 3, enterprise: 4,
};
const LEGACY_MAP: Record<string, string> = {
  basic: "creator", Basic: "creator", pro: "professional", Pro: "professional",
  premium: "enterprise", Premium: "enterprise",
};
function resolvePlan(plan: string): string {
  return LEGACY_MAP[plan] || (plan in PLAN_HIERARCHY ? plan : "free");
}

// ─── Navigation items for the sidebar ─────────────────────────────────────
type StudioSection = 'original' | 'create' | 'autopilot' | 'lyrics' | 'voice' | 'mastering' | 'stems' | 'transcribe' | 'beat' | 'clone-voice' | 'history';

const STUDIO_NAV: { id: StudioSection; label: string; icon: any; description: string }[] = [
  { id: 'original', label: 'Original Song', icon: Shield, description: 'Create & certify your work' },
  { id: 'create', label: 'Create', icon: Wand2, description: 'Generate music with AI' },
  { id: 'autopilot', label: 'Auto-Pilot', icon: Zap, description: 'Scheduled auto-generation' },
  { id: 'lyrics', label: 'Lyrics', icon: PenLine, description: 'Write and refine lyrics' },
  { id: 'voice', label: 'Voice AI', icon: Mic, description: 'Clone and design voices' },
  { id: 'mastering', label: 'Master', icon: BarChart3, description: 'AI audio mastering' },
  { id: 'stems', label: 'Stems', icon: Scissors, description: 'Separate tracks' },
  { id: 'transcribe', label: 'Transcribe', icon: FileText, description: 'Extract lyrics & text' },
  { id: 'beat', label: 'Beat Gen', icon: Drum, description: 'Generate beats with AI' },
  { id: 'clone-voice', label: 'Clone Voice', icon: MicVocal, description: 'F5-TTS voice synthesis' },
  { id: 'history', label: 'Library', icon: History, description: 'Your creations' },
];

/**
 * Apple-inspired AI Music Production Studio
 */
export default function MusicGeneratorPage() {
  const { toast } = useToast();
  const { user, userSubscription } = useAuth();
  const isAdmin = isAdminEmail(user?.email);
  
  // Navigation
  const [activeSection, setActiveSection] = useState<StudioSection>('original');

  // Original song pipeline state
  const [activeCertProjectId, setActiveCertProjectId] = useState<string | null>(null);
  
  // Music generator state
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [selectedModel, setSelectedModel] = useState("music-lyria3");
  const [selectedGenreTemplate, setSelectedGenreTemplate] = useState("pop");
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [musicGenerationProgress, setMusicGenerationProgress] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [advancedModeType, setAdvancedModeType] = useState<'standard' | 'continuation' | 'lyrics' | 'upload'>('standard');
  
  // Audio player state
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  
  // Generation history
  const [recentGenerations, setRecentGenerations] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Library organization (filters, search, sort, grouping)
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryGenre, setLibraryGenre] = useState<string>("all");
  const [librarySort, setLibrarySort] = useState<"recent" | "alpha" | "model">("recent");
  const [libraryGroupByGenre, setLibraryGroupByGenre] = useState(false);
  const [librarySource, setLibrarySource] = useState<"mine" | "showcase">("mine");

  // Community Showcase (real AI-generated songs from artists in the DB)
  const [showcaseItems, setShowcaseItems] = useState<any[]>([]);
  const [showcaseGenres, setShowcaseGenres] = useState<{ genre: string; count: number }[]>([]);
  const [showcaseGenre, setShowcaseGenre] = useState<string>("all");
  const [showcaseSort, setShowcaseSort] = useState<"recent" | "popular" | "random">("recent");
  const [isLoadingShowcase, setIsLoadingShowcase] = useState(false);
  
  // Mastering state
  const [masteringFile, setMasteringFile] = useState<File | null>(null);
  const [isMastering, setIsMastering] = useState(false);
  const [masteringResult, setMasteringResult] = useState<any>(null);
  const [masteringProgress, setMasteringProgress] = useState(0);
  const masteringFileRef = useRef<HTMLInputElement>(null);
  
  // Stem separation state
  const [stemsFile, setStemsFile] = useState<File | null>(null);
  const [isSeparating, setIsSeparating] = useState(false);
  const [stemsResult, setStemsResult] = useState<any>(null);
  const [separationType, setSeparationType] = useState<'2stem' | '4stem'>('4stem');
  const [stemsProgress, setStemsProgress] = useState(0);
  const stemsFileRef = useRef<HTMLInputElement>(null);
  const pollAttemptsRef = useRef(0); // tracks poll iterations for 5-min timeout

  // ── Transcribe state
  const [transcribeFile, setTranscribeFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeResult, setTranscribeResult] = useState<string | null>(null);
  const [transcribeChunks, setTranscribeChunks] = useState<any[]>([]);
  const transcribeFileRef = useRef<HTMLInputElement>(null);

  // ── Beat generator state
  const [beatPrompt, setBeatPrompt] = useState('');
  const [beatSeconds, setBeatSeconds] = useState(30);
  const [isGeneratingBeat, setIsGeneratingBeat] = useState(false);
  const [beatResult, setBeatResult] = useState<string | null>(null);

  // ── F5-TTS Clone Voice state
  const [cloneRefFile, setCloneRefFile] = useState<File | null>(null);
  const [cloneGenText, setCloneGenText] = useState('');
  const [cloneRefText, setCloneRefText] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState<string | null>(null);
  const cloneRefFileRef = useRef<HTMLInputElement>(null);
  
  // Advanced parameters
  const [advancedParams, setAdvancedParams] = useState<MusicGenerationAdvancedParams>({
    makeInstrumental: false,
    negativeTags: "",
    tags: "",
    lyricsType: "auto",
    customLyrics: "",
    seed: -1,
    continueClipId: "",
    continueAt: 30,
    gptDescriptionPrompt: "",
    prompt: "",
    title: "",
    serviceMode: "music-s",
    generateLyrics: true,
    uploadAudio: false,
    audioUrl: "",
    tempo: 120,
    keySignature: "C Major",
    mainInstruments: ["synth", "drums", "piano", "vocals"],
    structure: { intro: true, verse: true, chorus: true, bridge: true, outro: true },
    musicTemplate: "pop"
  });
  
  useEffect(() => { loadRecentGenerations(); }, []);
  
  // Check generation status polling — resilient: up to 3 consecutive errors; 5-min timeout
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let consecutiveErrors = 0;
    if (isGeneratingMusic && currentTaskId) {
      pollAttemptsRef.current = 0;
      intervalId = setInterval(async () => {
        pollAttemptsRef.current++;
        // 5-minute hard timeout (150 × 2s)
        if (pollAttemptsRef.current > 150) {
          setGenerationError('Generation timed out — please try a different model or try again.');
          setIsGeneratingMusic(false);
          setMusicGenerationProgress(0);
          clearInterval(intervalId);
          return;
        }
        try {
          let status;
          if (selectedModel === 'music-lyria3') {
            status = await checkLyria3Status(currentTaskId);
          } else if (selectedModel === 'music-stable') {
            status = await checkStableAudioStatus(currentTaskId);
          } else if (selectedModel === 'music-fal') {
            status = await checkFALMusicStatus(currentTaskId);
          } else {
            status = await checkGenerationStatus(currentTaskId);
          }
          consecutiveErrors = 0; // reset on successful poll
          if (status.status === 'pending') {
            setMusicGenerationProgress(prev => Math.max(prev, 10));
          } else if (status.status === 'processing') {
            setMusicGenerationProgress(prev => Math.min(prev + 2, 90));
          } else if (status.status === 'completed') {
            setMusicGenerationProgress(100);
            setIsGeneratingMusic(false);
            clearInterval(intervalId);
            if (status.audioUrl) {
              const newGeneration = {
                id: `local_gen_${Date.now()}`,
                taskId: currentTaskId,
                title: musicTitle || 'Untitled Generation',
                model: selectedModel,
                prompt: musicPrompt,
                audioUrl: status.audioUrl,
                createdAt: new Date().toISOString(),
                status: 'completed'
              };
              setRecentGenerations(prev => [newGeneration, ...prev]);
              try {
                await saveGeneratedSongToProfile({
                  title: musicTitle || 'Untitled Generation',
                  audioUrl: status.audioUrl,
                  prompt: musicPrompt,
                  genre: selectedGenreTemplate,
                });
                toast({ title: "✅ Track ready!", description: "Song saved to your artist library." });
              } catch (e) { logger.error('Profile save error:', e); }
            } else {
              setGenerationError('Generation completed but no audio was returned. Please try again.');
            }
          } else if (status.status === 'failed') {
            setGenerationError(status.message || status.error || 'Generation failed. Please try again.');
            setIsGeneratingMusic(false);
            setMusicGenerationProgress(0);
            clearInterval(intervalId);
          }
        } catch (error) {
          consecutiveErrors++;
          logger.warn(`Status check error (${consecutiveErrors}/3):`, error);
          if (consecutiveErrors >= 3) {
            logger.error('Too many consecutive status check errors:', error);
            setGenerationError('Connection error while checking status. Please try again.');
            setIsGeneratingMusic(false);
            setMusicGenerationProgress(0);
            clearInterval(intervalId);
          }
          // otherwise ignore transient error and retry on next interval
        }
      }, 2000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isGeneratingMusic, currentTaskId, selectedModel]);
  
  useEffect(() => {
    return () => { if (currentAudio) { currentAudio.pause(); currentAudio.src = ""; } };
  }, []);
  
  const loadRecentGenerations = async () => {
    setIsLoadingHistory(true);
    try {
      // Pull from Firestore (legacy) + Postgres (canonical artist library) and merge.
      const [firestoreGens, pgRes] = await Promise.all([
        getRecentGenerations().catch(() => []),
        fetch('/api/songs/generated', { credentials: 'include' })
          .then(r => r.ok ? r.json() : { items: [] })
          .catch(() => ({ items: [] })),
      ]);
      const pgItems = (pgRes?.items || []).map((s: any) => ({
        id: `pg_${s.id}`,
        pgId: s.id,
        taskId: s.id ? `pg-${s.id}` : '',
        title: s.title || 'Untitled',
        model: s.aiProvider || 'unknown',
        prompt: s.description || '',
        audioUrl: s.audioUrl,
        coverArt: s.coverArt,
        genre: s.genre,
        mood: s.mood,
        duration: s.duration,
        createdAt: s.createdAt || new Date().toISOString(),
        status: 'completed',
        source: 'profile',
        plays: s.plays || 0,
      }));
      // Dedupe by audioUrl (firestore + pg may overlap when saveGeneratedSongToProfile writes both)
      const seen = new Set<string>();
      const merged = [...pgItems, ...(firestoreGens || []).map((g: any) => ({ ...g, source: g.source || 'cloud' }))]
        .filter(g => {
          const k = (g.audioUrl || '') + '|' + (g.title || '');
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      setRecentGenerations(merged);
    } catch (error) {
      logger.error('Error loading history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadShowcase = useCallback(async () => {
    setIsLoadingShowcase(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '24');
      params.set('sort', showcaseSort);
      if (showcaseGenre !== 'all') params.set('genre', showcaseGenre);
      const res = await fetch(`/api/songs/showcase?${params.toString()}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setShowcaseItems(data.items || []);
        if (Array.isArray(data.genres) && data.genres.length) setShowcaseGenres(data.genres);
      }
    } catch (e) {
      logger.error('Error loading showcase:', e);
    } finally {
      setIsLoadingShowcase(false);
    }
  }, [showcaseGenre, showcaseSort]);

  // Auto-load showcase whenever the user enters the Library tab or switches filters/source
  useEffect(() => {
    if (activeSection === 'history' && librarySource === 'showcase') {
      loadShowcase();
    }
  }, [activeSection, librarySource, loadShowcase]);
  
  const handlePlay = (audioUrl: string, id: string) => {
    if (currentAudio) {
      currentAudio.pause();
      if (id === currentPlayingId) { setIsPlaying(false); setCurrentPlayingId(null); return; }
    }
    const audio = new Audio(audioUrl);
    audio.onended = () => { setIsPlaying(false); setCurrentPlayingId(null); };
    audio.onpause = () => { setIsPlaying(false); };
    audio.onplay = () => { setIsPlaying(true); };
    audio.onerror = () => { setIsPlaying(false); setCurrentPlayingId(null); };
    audio.play().then(() => { setCurrentAudio(audio); setIsPlaying(true); setCurrentPlayingId(id); })
      .catch(e => { logger.error('Playback error:', e); setIsPlaying(false); setCurrentPlayingId(null); });
  };
  
  const handleDeleteGeneration = (id: string) => {
    if (id === currentPlayingId && currentAudio) { currentAudio.pause(); setIsPlaying(false); setCurrentPlayingId(null); }
    setRecentGenerations(prev => prev.filter(gen => gen.id !== id));
  };
  
  const handleDownload = (audioUrl: string, title: string) => {
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim()) return;
    setGenerationError(null);
    setIsGeneratingMusic(true);
    setMusicGenerationProgress(0);
    try {
      let result: { taskId?: string; requestId?: string };
      pollAttemptsRef.current = 0; // reset poll counter for new generation
      if (selectedModel === 'music-lyria3') {
        try {
          result = await generateMusicWithLyria3({
            prompt: musicPrompt,
            duration: 120,
            instrumental: advancedParams.makeInstrumental,
            genre: selectedGenreTemplate || undefined,
            bpm: advancedParams.tempo || undefined,
            key: advancedParams.keySignature || undefined,
            customLyrics: advancedParams.customLyrics || undefined,
          });
          setCurrentTaskId(result.requestId || '');
        } catch (lyria3Err) {
          logger.warn('Lyria 3 unavailable, falling back to FAL Minimax:', lyria3Err);
          toast({ title: "⚡ Switching to backup model", description: "Lyria 3 is temporarily unavailable — using FAL Minimax.", duration: 4000 });
          try {
            result = await generateMusicWithFAL({ prompt: musicPrompt, duration: 30 });
            setSelectedModel('music-fal');
            setCurrentTaskId(result.requestId || '');
          } catch (falErr) {
            logger.warn('FAL Minimax also unavailable, falling back to Stable Audio:', falErr);
            result = await generateMusicWithStableAudio({ prompt: musicPrompt, duration: 180 });
            setSelectedModel('music-stable');
            setCurrentTaskId(result.requestId || '');
          }
        }
      } else if (selectedModel === 'music-stable') {
        try {
          result = await generateMusicWithStableAudio({ prompt: musicPrompt, duration: 180 });
          setCurrentTaskId(result.requestId || '');
        } catch (stableErr) {
          logger.warn('Stable Audio unavailable, falling back to FAL Minimax:', stableErr);
          toast({ title: "⚡ Switching to backup model", description: "Stable Audio unavailable — using FAL Minimax.", duration: 4000 });
          result = await generateMusicWithFAL({ prompt: musicPrompt, duration: 30 });
          setSelectedModel('music-fal');
          setCurrentTaskId(result.requestId || '');
        }
      } else if (selectedModel === 'music-fal') {
        try {
          result = await generateMusicWithFAL({ prompt: musicPrompt, duration: 30 });
          setCurrentTaskId(result.requestId || '');
        } catch (falErr) {
          logger.warn('FAL Minimax unavailable, falling back to Stable Audio:', falErr);
          toast({ title: "⚡ Switching to backup model", description: "FAL Minimax unavailable — using Stable Audio.", duration: 4000 });
          result = await generateMusicWithStableAudio({ prompt: musicPrompt, duration: 180 });
          setSelectedModel('music-stable');
          setCurrentTaskId(result.requestId || '');
        }
      } else {
        let generationData: any = {
          prompt: musicPrompt, title: musicTitle || undefined, model: selectedModel,
          makeInstrumental: advancedParams.makeInstrumental, negativeTags: advancedParams.negativeTags,
          tags: advancedParams.tags, seed: advancedParams.seed, tempo: advancedParams.tempo,
          keySignature: advancedParams.keySignature,
        };
        if (advancedModeType === 'continuation') { generationData.continueClipId = advancedParams.continueClipId; generationData.continueAt = advancedParams.continueAt; }
        else if (advancedModeType === 'lyrics') { generationData.customLyrics = advancedParams.customLyrics; generationData.generateLyrics = advancedParams.generateLyrics; }
        else if (advancedModeType === 'upload') { generationData.audioUrl = advancedParams.audioUrl; generationData.uploadAudio = true; }
        result = await generateMusic(generationData);
        setCurrentTaskId(result.taskId || '');
      }
    } catch (error) {
      logger.error('Generation error:', error);
      if (error instanceof Error && error.message.includes('401')) {
        setGenerationError('Sign in required');
        toast({ title: "Authentication required", description: "Sign in to create music.", variant: "destructive" });
      } else {
        const msg = error instanceof Error ? error.message : 'Error starting generation';
        setGenerationError(msg);
        toast({ title: "Generation failed", description: msg, variant: "destructive" });
      }
      setIsGeneratingMusic(false);
      setMusicGenerationProgress(0);
    }
  };
  
  const applyMusicTemplate = (templateId: string) => {
    const template = getGenreTemplateById(templateId);
    if (!template) return;
    setAdvancedParams(prev => ({
      ...prev, tempo: template.tempo, keySignature: template.keySignature,
      structure: { ...template.structure }, mainInstruments: [...template.mainInstruments],
      musicTemplate: templateId,
    }));
    if (!musicPrompt.trim() || musicGenreTemplates.some(t => t.id !== templateId && musicPrompt === t.defaultPrompt)) {
      setMusicPrompt(template.defaultPrompt);
    }
  };
  
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
  };

  // ─── Mastering: upload & process ─────────────────────────────────────
  const handleMasteringUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setMasteringFile(file);
  };

  const handleStartMastering = async () => {
    if (!masteringFile) return;
    setIsMastering(true);
    setMasteringProgress(10);
    setMasteringResult(null);
    try {
      // Upload file first
      const formData = new FormData();
      formData.append('audio', masteringFile);
      const uploadRes = await fetch('/api/kits/upload-audio', {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const audioUrl = uploadData.url || uploadData.soundFile;
      setMasteringProgress(40);

      // Separate stems via FAL Demucs (synchronous — no polling)
      const masterRes = await fetch('/api/mastering/separate-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl, model: 'htdemucs' }),
      });
      if (!masterRes.ok) throw new Error('Mastering failed');
      const masterData = await masterRes.json();
      setMasteringProgress(100);
      setMasteringResult({
        vocals: masterData.stems?.vocals || null,
        instrumentals: masterData.stems?.other || masterData.stems?.accompaniment || null,
        drums: masterData.stems?.drums || null,
        bass: masterData.stems?.bass || null,
      });
      toast({ title: '✅ Mastering complete!', description: 'Stems extracted with FAL Demucs.' });
    } catch (error: any) {
      logger.error('Mastering error:', error);
      toast({ title: 'Error processing audio', description: error.message, variant: 'destructive' });
    } finally {
      setIsMastering(false);
    }
  };

  // ─── Stem Separation ────────────────────────────────────────────────
  const handleStemsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setStemsFile(file);
  };

  const handleStartStemSeparation = async () => {
    if (!stemsFile) return;
    setIsSeparating(true);
    setStemsProgress(10);
    setStemsResult(null);
    try {
      const formData = new FormData();
      formData.append('audio', stemsFile);
      const uploadRes = await fetch('/api/kits/upload-audio', {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const audioUrl = uploadData.url || uploadData.soundFile;
      setStemsProgress(40);

      const model = separationType === '4stem' ? 'htdemucs' : 'htdemucs_ft';
      const sepRes = await fetch('/api/mastering/separate-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl, model }),
      });
      if (!sepRes.ok) throw new Error('Separation failed');
      const sepData = await sepRes.json();
      setStemsProgress(100);
      setStemsResult({
        vocals: sepData.stems?.vocals || null,
        instrumentals: separationType === '2stem' ? (sepData.stems?.other || null) : null,
        drums: separationType === '4stem' ? (sepData.stems?.drums || null) : null,
        bass: separationType === '4stem' ? (sepData.stems?.bass || null) : null,
        other: separationType === '4stem' ? (sepData.stems?.other || null) : null,
      });
      toast({ title: '✅ Separation complete', description: `FAL Demucs — ${separationType === '4stem' ? '4 stems' : '2 stems'} extracted.` });
    } catch (error: any) {
      logger.error('Stem separation error:', error);
      toast({ title: 'Error processing audio', description: error.message, variant: 'destructive' });
    } finally {
      setIsSeparating(false);
    }
  };

  // ─── Transcribe handler ─────────────────────────────────────────────
  const handleTranscribe = async () => {
    if (!transcribeFile) return;
    setIsTranscribing(true);
    setTranscribeResult(null);
    setTranscribeChunks([]);
    try {
      const formData = new FormData();
      formData.append('audio', transcribeFile);
      const uploadRes = await fetch('/api/kits/upload-audio', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url } = await uploadRes.json();
      const res = await fetch('/api/mastering/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: url }),
      });
      if (!res.ok) throw new Error('Transcription failed');
      const data = await res.json();
      setTranscribeResult(data.text);
      setTranscribeChunks(data.chunks || []);
      toast({ title: '✅ Transcription complete!' });
    } catch (error: any) {
      toast({ title: 'Transcription failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsTranscribing(false);
    }
  };

  // ─── Beat generator handler ──────────────────────────────────────────
  const handleGenerateBeat = async () => {
    if (!beatPrompt.trim()) return;
    setIsGeneratingBeat(true);
    setBeatResult(null);
    try {
      const res = await fetch('/api/mastering/generate-beat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: beatPrompt, seconds: beatSeconds }),
      });
      if (!res.ok) throw new Error('Beat generation failed');
      const data = await res.json();
      setBeatResult(data.audioUrl);
      toast({ title: '✅ Beat generated!' });
    } catch (error: any) {
      toast({ title: 'Beat generation failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingBeat(false);
    }
  };

  // ─── F5-TTS Clone Voice handler ──────────────────────────────────────
  const handleCloneVoiceF5 = async () => {
    if (!cloneRefFile || !cloneGenText.trim()) return;
    setIsCloning(true);
    setCloneResult(null);
    try {
      const formData = new FormData();
      formData.append('audio', cloneRefFile);
      const uploadRes = await fetch('/api/kits/upload-audio', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url } = await uploadRes.json();
      const res = await fetch('/api/mastering/clone-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refAudioUrl: url, refText: cloneRefText || undefined, genText: cloneGenText }),
      });
      if (!res.ok) throw new Error('Voice cloning failed');
      const data = await res.json();
      setCloneResult(data.audioUrl);
      toast({ title: '✅ Voice cloned!' });
    } catch (error: any) {
      toast({ title: 'Voice cloning failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsCloning(false);
    }
  };

  // Access check
  const resolvedUser = resolvePlan(userSubscription || "free");
  const hasAccess = isAdmin || PLAN_HIERARCHY[resolvedUser] >= PLAN_HIERARCHY["professional"];

  if (!hasAccess) {
    return <MusicGeneratorLockedPage />;
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Header />
      
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* ─── Sidebar Navigation (Apple-style) ─── */}
        <nav className="lg:w-64 lg:min-h-[calc(100vh-4rem)] border-b lg:border-b-0 lg:border-r border-white/[0.06] bg-black/50 backdrop-blur-xl">
          {/* Mobile: Horizontal scroll */}
          <div className="lg:hidden flex overflow-x-auto gap-1 px-4 py-3 scrollbar-hide">
            {STUDIO_NAV.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeSection === item.id
                    ? 'bg-white text-black'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.06]'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
          
          {/* Desktop: Vertical sidebar */}
          <div className="hidden lg:flex flex-col py-6 px-3 gap-1">
            <div className="px-4 mb-6">
              <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/30">
                Studio
              </h2>
            </div>
            {STUDIO_NAV.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group ${
                  activeSection === item.id
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] transition-colors ${
                  activeSection === item.id ? 'text-white' : 'text-white/30 group-hover:text-white/50'
                }`} />
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className={`text-[11px] mt-0.5 transition-colors ${
                    activeSection === item.id ? 'text-white/50' : 'text-white/20'
                  }`}>{item.description}</div>
                </div>
              </button>
            ))}
          </div>
        </nav>

        {/* ─── Content Area ─── */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* ──── CANCIÓN ORIGINAL + COPYRIGHT ──── */}
            {activeSection === 'original' && (
              <motion.div
                key="original"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
              >
                <div className="mb-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                        Original Song — Certified
                      </h1>
                      <p className="text-white/40 mt-1 text-sm">
                        Create a new song or certify one you've already uploaded — with authorship certificate and SHA-256 fingerprint
                      </p>
                    </div>
                  </div>
                </div>

                {activeCertProjectId ? (
                  <CopyrightCertificateCard
                    projectId={activeCertProjectId}
                    onStartNew={() => setActiveCertProjectId(null)}
                  />
                ) : (
                  <OriginalSongForm
                    onComplete={(projectId: string) => setActiveCertProjectId(projectId)}
                  />
                )}
              </motion.div>
            )}

            {/* ──── CREATE / GENERATE ──── */}
            {activeSection === 'create' && (
              <motion.div
                key="create"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
              >
                {/* Section header */}
                <div className="mb-10">
                  <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    Create Music
                  </h1>
                  <p className="text-white/40 mt-2 text-base">
                    Describe your vision. AI handles the rest.
                  </p>
                </div>

                {/* Generation Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                  <div className="p-6 sm:p-8">
                    <MusicGenerationSection 
                      musicGenreTemplates={musicGenreTemplates}
                      selectedGenreTemplate={selectedGenreTemplate}
                      setSelectedGenreTemplate={setSelectedGenreTemplate}
                      isGeneratingMusic={isGeneratingMusic}
                      musicGenerationProgress={musicGenerationProgress}
                      handleGenerateMusic={handleGenerateMusic}
                      musicPrompt={musicPrompt}
                      setMusicPrompt={setMusicPrompt}
                      musicTitle={musicTitle}
                      setMusicTitle={setMusicTitle}
                      selectedModel={selectedModel}
                      setSelectedModel={setSelectedModel}
                      showAdvancedParams={showAdvancedParams}
                      setShowAdvancedParams={setShowAdvancedParams}
                      advancedModeType={advancedModeType}
                      setAdvancedModeType={setAdvancedModeType}
                      advancedParams={advancedParams}
                      setAdvancedParams={setAdvancedParams}
                      applyMusicTemplate={applyMusicTemplate}
                    />
                  </div>
                </div>

                {/* Error */}
                {generationError && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                  >
                    {generationError}
                  </motion.div>
                )}

                {/* Quick models info */}
                <div className="mt-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { name: "Lyria 3 Pro", badge: "👑 #1", icon: Sparkles, active: selectedModel === 'music-lyria3' },
                    { name: "Minimax", badge: "Fast", icon: Zap, active: selectedModel === 'music-fal' },
                    { name: "Stable Audio", badge: "HiFi", icon: AudioWaveform, active: selectedModel === 'music-stable' },
                    { name: "Suno", badge: "Vocals", icon: Music, active: selectedModel === 'music-s' },
                    { name: "Udio", badge: "Pro", icon: Headphones, active: selectedModel === 'music-u' },
                  ].map(m => (
                    <div
                      key={m.name}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-default ${
                        m.active 
                          ? 'border-white/20 bg-white/[0.06]' 
                          : 'border-white/[0.04] bg-white/[0.01]'
                      }`}
                    >
                      <m.icon className={`w-4 h-4 ${m.active ? 'text-white' : 'text-white/20'}`} />
                      <div>
                        <div className={`text-xs font-medium ${m.active ? 'text-white' : 'text-white/30'}`}>{m.name}</div>
                        <div className="text-[10px] text-white/20">{m.badge}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ──── AUTO-PILOT — SCHEDULED AUTO-GENERATION ──── */}
            {activeSection === 'autopilot' && (
              <motion.div
                key="autopilot"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
              >
                <div className="mb-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                        Music Auto-Pilot
                      </h1>
                      <p className="text-white/40 mt-1 text-sm">
                        Active generation: schedule a weekly single or a monthly album — new music is created
                        automatically using your existing songs as creative references.
                      </p>
                    </div>
                  </div>
                </div>

                <AutoMusicPanel />
              </motion.div>
            )}

            {/* ──── LYRICS STUDIO ──── */}
            {activeSection === 'lyrics' && (
              <motion.div
                key="lyrics"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
              >
                <div className="mb-10">
                  <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    Lyrics Studio
                  </h1>
                  <p className="text-white/40 mt-2 text-base">
                    Write, refine, and protect your lyrics with AI assistance.
                  </p>
                </div>

                {/* Copyright badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">Copyright-Protected Workflow</span>
                </div>

                <CopywriteWorkflow
                  userId={user?.id}
                  onLyricsReady={(lyrics) => {
                    setMusicPrompt(lyrics);
                    setActiveSection('create');
                    toast({ title: "Lyrics loaded", description: "Switch to Create to generate your track." });
                  }}
                />
              </motion.div>
            )}

            {/* ──── VOICE AI ──── */}
            {activeSection === 'voice' && (
              <motion.div
                key="voice"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
              >
                <div className="mb-10">
                  <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    Voice AI
                  </h1>
                  <p className="text-white/40 mt-2 text-base">
                    Clone your voice, train custom models, apply to any track.
                  </p>
                </div>
                <VoiceAIStudio recentGenerations={recentGenerations} />
              </motion.div>
            )}

            {/* ──── AI MASTERING ──── */}
            {activeSection === 'mastering' && (
              <motion.div
                key="mastering"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
              >
                <div className="mb-10">
                  <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    AI Mastering
                  </h1>
                  <p className="text-white/40 mt-2 text-base">
                    Professional-grade mastering. Upload, process, download.
                  </p>
                </div>

                {/* Upload area */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                  <div className="p-8">
                    {/* Drop zone */}
                    <div
                      onClick={() => masteringFileRef.current?.click()}
                      className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                        masteringFile
                          ? 'border-white/20 bg-white/[0.04]'
                          : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.02]'
                      }`}
                    >
                      <input
                        ref={masteringFileRef}
                        type="file"
                        accept="audio/*"
                        onChange={handleMasteringUpload}
                        className="hidden"
                      />
                      {masteringFile ? (
                        <div className="space-y-3">
                          <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto">
                            <FileAudio className="w-8 h-8 text-white/60" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{masteringFile.name}</p>
                            <p className="text-xs text-white/30 mt-1">
                              {(masteringFile.size / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setMasteringFile(null); setMasteringResult(null); }}
                            className="text-xs text-white/30 hover:text-white/60 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto">
                            <Upload className="w-8 h-8 text-white/20" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white/60">
                              Drop your audio file here
                            </p>
                            <p className="text-xs text-white/20 mt-1">
                              WAV, MP3, FLAC — up to 50MB
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Process button */}
                    <button
                      onClick={handleStartMastering}
                      disabled={!masteringFile || isMastering}
                      className={`mt-6 w-full py-4 rounded-xl font-semibold text-sm transition-all ${
                        masteringFile && !isMastering
                          ? 'bg-white text-black hover:bg-white/90 active:scale-[0.98]'
                          : 'bg-white/[0.06] text-white/20 cursor-not-allowed'
                      }`}
                    >
                      {isMastering ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing... {masteringProgress}%
                        </span>
                      ) : 'Master Track'}
                    </button>

                    {/* Progress bar */}
                    {isMastering && (
                      <div className="mt-4 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                          className="h-full bg-white rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${masteringProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}

                    {/* Result */}
                    {masteringResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 space-y-4"
                      >
                        <div className="flex items-center gap-2 text-emerald-400">
                          <Check className="w-4 h-4" />
                          <span className="text-sm font-medium">Mastering complete</span>
                        </div>

                        {/* Output tracks */}
                        <div className="space-y-3">
                          {masteringResult.vocals && (
                            <AudioResultRow
                              label="Vocals"
                              url={masteringResult.vocals}
                              onPlay={(url) => handlePlay(url, 'master-vox')}
                              onDownload={(url) => handleDownload(url, 'mastered-vocals')}
                              isPlaying={currentPlayingId === 'master-vox' && isPlaying}
                            />
                          )}
                          {masteringResult.instrumentals && (
                            <AudioResultRow
                              label="Instrumental / Other"
                              url={masteringResult.instrumentals}
                              onPlay={(url) => handlePlay(url, 'master-inst')}
                              onDownload={(url) => handleDownload(url, 'mastered-instrumental')}
                              isPlaying={currentPlayingId === 'master-inst' && isPlaying}
                            />
                          )}
                          {masteringResult.drums && (
                            <AudioResultRow
                              label="Drums"
                              url={masteringResult.drums}
                              onPlay={(url) => handlePlay(url, 'master-drums')}
                              onDownload={(url) => handleDownload(url, 'mastered-drums')}
                              isPlaying={currentPlayingId === 'master-drums' && isPlaying}
                            />
                          )}
                          {masteringResult.bass && (
                            <AudioResultRow
                              label="Bass"
                              url={masteringResult.bass}
                              onPlay={(url) => handlePlay(url, 'master-bass')}
                              onDownload={(url) => handleDownload(url, 'mastered-bass')}
                              isPlaying={currentPlayingId === 'master-bass' && isPlaying}
                            />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="mt-6 flex items-start gap-3 text-white/20 text-xs">
                  <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>
                    Powered by Kits.ai. Your audio is processed securely and never stored permanently.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ──── STEM SEPARATION ──── */}
            {activeSection === 'stems' && (
              <motion.div
                key="stems"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
              >
                <div className="mb-10">
                  <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    Stem Separation
                  </h1>
                  <p className="text-white/40 mt-2 text-base">
                    Split any track into individual stems. Isolate vocals, drums, bass, and more.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                  <div className="p-8">
                    {/* Separation type toggle */}
                    <div className="flex gap-2 mb-8">
                      <button
                        onClick={() => setSeparationType('2stem')}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                          separationType === '2stem'
                            ? 'bg-white text-black'
                            : 'bg-white/[0.04] text-white/40 hover:text-white/60'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <SplitSquareHorizontal className="w-4 h-4" />
                          2 Stems
                        </span>
                        <span className="block text-[10px] mt-1 opacity-60">Vocals + Instrumental</span>
                      </button>
                      <button
                        onClick={() => setSeparationType('4stem')}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                          separationType === '4stem'
                            ? 'bg-white text-black'
                            : 'bg-white/[0.04] text-white/40 hover:text-white/60'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Layers className="w-4 h-4" />
                          4 Stems
                        </span>
                        <span className="block text-[10px] mt-1 opacity-60">Vocals + Drums + Bass + Other</span>
                      </button>
                    </div>

                    {/* Drop zone */}
                    <div
                      onClick={() => stemsFileRef.current?.click()}
                      className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                        stemsFile
                          ? 'border-white/20 bg-white/[0.04]'
                          : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.02]'
                      }`}
                    >
                      <input
                        ref={stemsFileRef}
                        type="file"
                        accept="audio/*"
                        onChange={handleStemsUpload}
                        className="hidden"
                      />
                      {stemsFile ? (
                        <div className="space-y-3">
                          <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto">
                            <FileAudio className="w-8 h-8 text-white/60" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{stemsFile.name}</p>
                            <p className="text-xs text-white/30 mt-1">
                              {(stemsFile.size / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setStemsFile(null); setStemsResult(null); }}
                            className="text-xs text-white/30 hover:text-white/60 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto">
                            <Scissors className="w-8 h-8 text-white/20" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white/60">
                              Drop your audio file here
                            </p>
                            <p className="text-xs text-white/20 mt-1">
                              WAV, MP3, FLAC — up to 50MB
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Separate button */}
                    <button
                      onClick={handleStartStemSeparation}
                      disabled={!stemsFile || isSeparating}
                      className={`mt-6 w-full py-4 rounded-xl font-semibold text-sm transition-all ${
                        stemsFile && !isSeparating
                          ? 'bg-white text-black hover:bg-white/90 active:scale-[0.98]'
                          : 'bg-white/[0.06] text-white/20 cursor-not-allowed'
                      }`}
                    >
                      {isSeparating ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Separating... {stemsProgress}%
                        </span>
                      ) : `Split into ${separationType === '4stem' ? '4' : '2'} Stems`}
                    </button>

                    {/* Progress */}
                    {isSeparating && (
                      <div className="mt-4 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                          className="h-full bg-white rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${stemsProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}

                    {/* Results */}
                    {stemsResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 space-y-4"
                      >
                        <div className="flex items-center gap-2 text-emerald-400">
                          <Check className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {separationType === '4stem' ? '4 stems' : '2 stems'} separated
                          </span>
                        </div>
                        <div className="space-y-3">
                          {stemsResult.vocals && (
                            <AudioResultRow
                              label="Vocals"
                              url={stemsResult.vocals}
                              onPlay={(url) => handlePlay(url, 'stem-vocals')}
                              onDownload={(url) => handleDownload(url, 'stem-vocals')}
                              isPlaying={currentPlayingId === 'stem-vocals' && isPlaying}
                            />
                          )}
                          {stemsResult.instrumentals && (
                            <AudioResultRow
                              label="Instrumental"
                              url={stemsResult.instrumentals}
                              onPlay={(url) => handlePlay(url, 'stem-inst')}
                              onDownload={(url) => handleDownload(url, 'stem-instrumental')}
                              isPlaying={currentPlayingId === 'stem-inst' && isPlaying}
                            />
                          )}
                          {stemsResult.drums && (
                            <AudioResultRow
                              label="Drums"
                              url={stemsResult.drums}
                              onPlay={(url) => handlePlay(url, 'stem-drums')}
                              onDownload={(url) => handleDownload(url, 'stem-drums')}
                              isPlaying={currentPlayingId === 'stem-drums' && isPlaying}
                            />
                          )}
                          {stemsResult.bass && (
                            <AudioResultRow
                              label="Bass"
                              url={stemsResult.bass}
                              onPlay={(url) => handlePlay(url, 'stem-bass')}
                              onDownload={(url) => handleDownload(url, 'stem-bass')}
                              isPlaying={currentPlayingId === 'stem-bass' && isPlaying}
                            />
                          )}
                          {stemsResult.other && (
                            <AudioResultRow
                              label="Other"
                              url={stemsResult.other}
                              onPlay={(url) => handlePlay(url, 'stem-other')}
                              onDownload={(url) => handleDownload(url, 'stem-other')}
                              isPlaying={currentPlayingId === 'stem-other' && isPlaying}
                            />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ──── TRANSCRIBE ──── */}
            {activeSection === 'transcribe' && (
              <motion.div
                key="transcribe"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
              >
                <div className="mb-8">
                  <h1 className="text-2xl font-semibold text-white tracking-tight">Transcribe Audio</h1>
                  <p className="text-white/40 mt-1 text-sm">Extract lyrics and timestamps from any audio file using Whisper v3</p>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 space-y-6">
                  {/* Upload zone */}
                  <div
                    onClick={() => transcribeFileRef.current?.click()}
                    className="border-2 border-dashed border-white/[0.08] rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-white/20 transition-colors"
                  >
                    <FileText className="w-8 h-8 text-white/20" />
                    {transcribeFile ? (
                      <div className="text-center">
                        <p className="text-white text-sm font-medium">{transcribeFile.name}</p>
                        <p className="text-white/40 text-xs mt-1">{(transcribeFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-white/60 text-sm font-medium">Drop audio file here</p>
                        <p className="text-white/30 text-xs mt-1">MP3, WAV, FLAC, M4A</p>
                      </div>
                    )}
                    <input
                      ref={transcribeFileRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setTranscribeFile(f); }}
                    />
                  </div>
                  {/* Action */}
                  <button
                    onClick={handleTranscribe}
                    disabled={!transcribeFile || isTranscribing}
                    className="w-full py-3.5 rounded-xl bg-white text-black text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-white/90 transition-all"
                  >
                    {isTranscribing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Transcribing…</>
                    ) : (
                      <><FileText className="w-4 h-4" /> Transcribe Audio</>
                    )}
                  </button>
                  {/* Result */}
                  {transcribeResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">Transcription complete</span>
                      </div>
                      {transcribeChunks.length > 0 ? (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {transcribeChunks.map((chunk: any, i: number) => (
                            <div key={i} className="flex gap-3 text-sm p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                              <span className="text-white/30 text-xs font-mono whitespace-nowrap pt-0.5">
                                {Math.floor(chunk.timestamp?.[0] / 60)}:{String(Math.floor(chunk.timestamp?.[0] % 60)).padStart(2, '0')}
                              </span>
                              <span className="text-white/80">{chunk.text}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                          <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{transcribeResult}</p>
                        </div>
                      )}
                      <button
                        onClick={() => navigator.clipboard.writeText(transcribeResult)}
                        className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1.5 transition-colors"
                      >
                        <AlignLeft className="w-3 h-3" /> Copy full text
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ──── BEAT GENERATOR ──── */}
            {activeSection === 'beat' && (
              <motion.div
                key="beat"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
              >
                <div className="mb-8">
                  <h1 className="text-2xl font-semibold text-white tracking-tight">AI Beat Generator</h1>
                  <p className="text-white/40 mt-1 text-sm">Generate original beats from a text prompt using Stable Audio</p>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 space-y-6">
                  {/* Quick presets */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Trap beat 140 BPM, 808 bass, rolling hi-hats',
                      'Lo-fi hip hop, jazz chords, soft boom-bap drums',
                      'Deep house 124 BPM, four-on-floor kick, synth pads',
                      'Latin reggaeton dembow, brass stabs, percussion',
                    ].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setBeatPrompt(preset)}
                        className="px-3 py-1.5 rounded-full text-xs text-white/50 border border-white/[0.08] hover:text-white/80 hover:border-white/20 transition-all"
                      >
                        {preset.split(',')[0]}
                      </button>
                    ))}
                  </div>
                  {/* Prompt */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/40 uppercase tracking-widest">Prompt</label>
                    <textarea
                      value={beatPrompt}
                      onChange={(e) => setBeatPrompt(e.target.value)}
                      placeholder="Describe your beat — genre, tempo, instruments, mood…"
                      rows={3}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-none"
                    />
                  </div>
                  {/* Duration */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-white/40 uppercase tracking-widest">Duration</label>
                      <span className="text-sm text-white/60 font-medium">{beatSeconds}s</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={95}
                      step={5}
                      value={beatSeconds}
                      onChange={(e) => setBeatSeconds(Number(e.target.value))}
                      className="w-full accent-white"
                    />
                    <div className="flex justify-between text-xs text-white/20">
                      <span>10s</span><span>95s</span>
                    </div>
                  </div>
                  {/* Generate */}
                  <button
                    onClick={handleGenerateBeat}
                    disabled={!beatPrompt.trim() || isGeneratingBeat}
                    className="w-full py-3.5 rounded-xl bg-white text-black text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-white/90 transition-all"
                  >
                    {isGeneratingBeat ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generating beat…</>
                    ) : (
                      <><Drum className="w-4 h-4" /> Generate Beat</>
                    )}
                  </button>
                  {/* Result */}
                  {beatResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">Beat generated</span>
                      </div>
                      <AudioResultRow
                        label={`Beat — ${beatSeconds}s`}
                        url={beatResult}
                        onPlay={(url) => handlePlay(url, 'beat-result')}
                        onDownload={(url) => handleDownload(url, 'generated-beat')}
                        isPlaying={currentPlayingId === 'beat-result' && isPlaying}
                      />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ──── CLONE VOICE (F5-TTS) ──── */}
            {activeSection === 'clone-voice' && (
              <motion.div
                key="clone-voice"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
              >
                <div className="mb-8">
                  <h1 className="text-2xl font-semibold text-white tracking-tight">Clone Voice</h1>
                  <p className="text-white/40 mt-1 text-sm">Synthesize speech in any voice using F5-TTS — upload a reference, type new lines</p>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 space-y-6">
                  {/* Reference audio upload */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/40 uppercase tracking-widest">Reference Voice (3–15s clip)</label>
                    <div
                      onClick={() => cloneRefFileRef.current?.click()}
                      className="border-2 border-dashed border-white/[0.08] rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-white/20 transition-colors"
                    >
                      <MicVocal className="w-6 h-6 text-white/20" />
                      {cloneRefFile ? (
                        <div className="text-center">
                          <p className="text-white text-sm font-medium">{cloneRefFile.name}</p>
                          <p className="text-white/40 text-xs">{(cloneRefFile.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      ) : (
                        <p className="text-white/40 text-sm">Upload reference audio</p>
                      )}
                      <input
                        ref={cloneRefFileRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) setCloneRefFile(f); }}
                      />
                    </div>
                  </div>
                  {/* Optional: transcript of reference */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/40 uppercase tracking-widest">Reference Text <span className="text-white/20 normal-case">(optional — improves accuracy)</span></label>
                    <input
                      type="text"
                      value={cloneRefText}
                      onChange={(e) => setCloneRefText(e.target.value)}
                      placeholder="What is said in the reference audio…"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20"
                    />
                  </div>
                  {/* Text to generate */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/40 uppercase tracking-widest">Text to Speak</label>
                    <textarea
                      value={cloneGenText}
                      onChange={(e) => setCloneGenText(e.target.value)}
                      placeholder="Type the words you want spoken in the cloned voice…"
                      rows={4}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-none"
                    />
                  </div>
                  {/* Clone button */}
                  <button
                    onClick={handleCloneVoiceF5}
                    disabled={!cloneRefFile || !cloneGenText.trim() || isCloning}
                    className="w-full py-3.5 rounded-xl bg-white text-black text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-white/90 transition-all"
                  >
                    {isCloning ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Cloning voice…</>
                    ) : (
                      <><MicVocal className="w-4 h-4" /> Clone &amp; Speak</>
                    )}
                  </button>
                  {/* Result */}
                  {cloneResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">Voice cloned</span>
                      </div>
                      <AudioResultRow
                        label="Cloned Speech"
                        url={cloneResult}
                        onPlay={(url) => handlePlay(url, 'clone-result')}
                        onDownload={(url) => handleDownload(url, 'cloned-voice')}
                        isPlaying={currentPlayingId === 'clone-result' && isPlaying}
                      />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ──── HISTORY / LIBRARY ──── */}
            {activeSection === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
              >
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                      Library
                    </h1>
                    <p className="text-white/40 mt-2 text-base">
                      Your generated tracks · Discover real AI music from Boostify artists.
                    </p>
                  </div>
                  <button
                    onClick={() => librarySource === 'mine' ? loadRecentGenerations() : loadShowcase()}
                    disabled={isLoadingHistory || isLoadingShowcase}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.08] transition-all flex items-center gap-2"
                  >
                    {(isLoadingHistory || isLoadingShowcase) ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
                  </button>
                </div>

                {/* Source switcher: My Library vs Community Showcase */}
                <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.04] w-fit">
                  <button
                    onClick={() => setLibrarySource('mine')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      librarySource === 'mine' ? 'bg-white text-black' : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    <Disc3 className="w-3.5 h-3.5" /> My Library
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${librarySource === 'mine' ? 'bg-black/10' : 'bg-white/[0.06]'}`}>
                      {recentGenerations.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setLibrarySource('showcase')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      librarySource === 'showcase' ? 'bg-white text-black' : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Community Showcase
                  </button>
                </div>

                {/* ═══════════ MY LIBRARY ═══════════ */}
                {librarySource === 'mine' && (
                  <>
                    {/* Filter / sort / search bar */}
                    {recentGenerations.length > 0 && (
                      <div className="flex items-center gap-2 mb-5 flex-wrap">
                        <input
                          value={librarySearch}
                          onChange={(e) => setLibrarySearch(e.target.value)}
                          placeholder="Search by title or prompt..."
                          className="flex-1 min-w-[180px] bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                        />
                        <select
                          value={libraryGenre}
                          onChange={(e) => setLibraryGenre(e.target.value)}
                          className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20"
                        >
                          <option value="all">All genres</option>
                          {Array.from(new Set(recentGenerations.map((g: any) => g.genre).filter(Boolean))).map((g: any) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                        <select
                          value={librarySort}
                          onChange={(e) => setLibrarySort(e.target.value as any)}
                          className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20"
                        >
                          <option value="recent">Most recent</option>
                          <option value="alpha">A → Z</option>
                          <option value="model">By model</option>
                        </select>
                        <button
                          onClick={() => setLibraryGroupByGenre(v => !v)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                            libraryGroupByGenre ? 'bg-white text-black' : 'bg-white/[0.04] text-white/50 hover:text-white/80'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" /> Group
                        </button>
                      </div>
                    )}

                    {isLoadingHistory ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02]">
                            <Skeleton className="h-12 w-12 rounded-xl" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-2/3" />
                              <Skeleton className="h-3 w-1/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : recentGenerations.length === 0 ? (
                      <div className="text-center py-20">
                        <div className="w-20 h-20 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                          <Music2 className="w-10 h-10 text-white/10" />
                        </div>
                        <h3 className="text-lg font-semibold text-white/60 mb-2">No tracks yet</h3>
                        <p className="text-sm text-white/30 mb-6">Create your first composition or get inspired in the Community Showcase.</p>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setActiveSection('create')}
                            className="px-6 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all"
                          >
                            Start Creating
                          </button>
                          <button
                            onClick={() => setLibrarySource('showcase')}
                            className="px-6 py-3 rounded-xl bg-white/[0.06] text-white text-sm font-semibold hover:bg-white/[0.10] transition-all flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> See examples
                          </button>
                        </div>
                      </div>
                    ) : (() => {
                      // Filter + sort
                      const filtered = recentGenerations.filter((g: any) => {
                        if (libraryGenre !== 'all' && g.genre !== libraryGenre) return false;
                        if (librarySearch.trim()) {
                          const q = librarySearch.toLowerCase();
                          if (!(g.title || '').toLowerCase().includes(q) && !(g.prompt || '').toLowerCase().includes(q)) return false;
                        }
                        return true;
                      });
                      filtered.sort((a: any, b: any) => {
                        if (librarySort === 'alpha') return (a.title || '').localeCompare(b.title || '');
                        if (librarySort === 'model') return (a.model || '').localeCompare(b.model || '');
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                      });

                      const renderRow = (gen: any) => (
                        <div
                          key={gen.id}
                          className="group flex items-center gap-4 p-4 rounded-2xl border border-white/[0.04] hover:border-white/[0.08] bg-white/[0.01] hover:bg-white/[0.03] transition-all"
                        >
                          <button
                            onClick={() => handlePlay(gen.audioUrl, gen.id)}
                            className="w-12 h-12 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center flex-shrink-0 transition-all overflow-hidden relative"
                          >
                            {gen.coverArt && (
                              <img src={gen.coverArt} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                            )}
                            <span className="relative z-10">
                              {currentPlayingId === gen.id && isPlaying
                                ? <Pause className="w-5 h-5 text-white" />
                                : <Play className="w-5 h-5 text-white ml-0.5" />}
                            </span>
                          </button>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-white truncate">{gen.title}</h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/50 font-medium">
                                {gen.model === 'music-fal' || gen.model === 'fal-minimax-music-v2' ? 'Minimax' :
                                 gen.model === 'music-stable' ? 'Stable Audio' :
                                 gen.model === 'music-lyria3' || (gen.model || '').includes('lyria') ? 'Lyria 3' :
                                 gen.model === 'music-s' ? 'Suno' :
                                 (gen.model && gen.model !== 'unknown') ? gen.model : 'AI'}
                              </span>
                              {gen.genre && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300">{gen.genre}</span>
                              )}
                              {gen.source === 'profile' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> Saved to profile
                                </span>
                              )}
                              <span className="text-[10px] text-white/20">{formatDate(gen.createdAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDownload(gen.audioUrl, gen.title)}
                              className="w-8 h-8 rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4 text-white/40" />
                            </button>
                            <button
                              onClick={() => handleDeleteGeneration(gen.id)}
                              className="w-8 h-8 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition-colors"
                              title="Remove from view"
                            >
                              <Trash2 className="w-4 h-4 text-white/20 hover:text-red-400" />
                            </button>
                          </div>
                          {gen.audioUrl && (
                            <audio controls src={gen.audioUrl} className="hidden md:block w-48 h-8 flex-shrink-0" />
                          )}
                        </div>
                      );

                      if (libraryGroupByGenre) {
                        const groups: Record<string, any[]> = {};
                        filtered.forEach((g: any) => {
                          const k = g.genre || 'Uncategorized';
                          (groups[k] = groups[k] || []).push(g);
                        });
                        const groupKeys = Object.keys(groups).sort();
                        return (
                          <div className="space-y-6">
                            {groupKeys.map(k => (
                              <div key={k}>
                                <div className="flex items-center gap-2 mb-2 px-1">
                                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">{k}</h3>
                                  <span className="text-[10px] text-white/20">{groups[k].length} track{groups[k].length === 1 ? '' : 's'}</span>
                                </div>
                                <div className="space-y-2">{groups[k].map(renderRow)}</div>
                              </div>
                            ))}
                          </div>
                        );
                      }

                      return (
                        <>
                          <div className="text-[10px] text-white/30 uppercase tracking-wider px-1 mb-2">
                            {filtered.length} of {recentGenerations.length} track{recentGenerations.length === 1 ? '' : 's'}
                          </div>
                          <div className="space-y-2">{filtered.map(renderRow)}</div>
                        </>
                      );
                    })()}
                  </>
                )}

                {/* ═══════════ COMMUNITY SHOWCASE ═══════════ */}
                {librarySource === 'showcase' && (
                  <>
                    <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent border border-purple-500/20">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-white">Real AI music from Boostify artists</h3>
                          <p className="text-xs text-white/50 mt-1">
                            Browse tracks created by other artists with the same tools you have. Click an artist to visit their profile.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Genre chips */}
                    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                      <button
                        onClick={() => setShowcaseGenre('all')}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 border ${
                          showcaseGenre === 'all' ? 'bg-white text-black border-white' : 'bg-white/[0.04] text-white/50 border-white/[0.06] hover:text-white/80'
                        }`}
                      >All</button>
                      {showcaseGenres.slice(0, 12).map(g => (
                        <button
                          key={g.genre}
                          onClick={() => setShowcaseGenre(g.genre)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 border ${
                            showcaseGenre === g.genre ? 'bg-white text-black border-white' : 'bg-white/[0.04] text-white/50 border-white/[0.06] hover:text-white/80'
                          }`}
                        >
                          {g.genre} <span className="opacity-50">·{g.count}</span>
                        </button>
                      ))}
                      <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                        {(['recent','popular','random'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setShowcaseSort(s)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all ${
                              showcaseSort === s ? 'bg-white/[0.10] text-white' : 'text-white/30 hover:text-white/60'
                            }`}
                          >{s}</button>
                        ))}
                      </div>
                    </div>

                    {isLoadingShowcase ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {[1,2,3,4,5,6,7,8].map(i => (
                          <div key={i} className="aspect-square rounded-2xl bg-white/[0.02]"><Skeleton className="w-full h-full rounded-2xl" /></div>
                        ))}
                      </div>
                    ) : showcaseItems.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                          <Sparkles className="w-7 h-7 text-white/10" />
                        </div>
                        <p className="text-sm text-white/40">No examples found for this filter.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {showcaseItems.map((s: any) => {
                          const playId = `showcase-${s.id}`;
                          return (
                            <div key={s.id} className="group rounded-2xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/[0.10] transition-all overflow-hidden">
                              {/* Cover */}
                              <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-purple-900/40 to-slate-900">
                                {s.coverArt ? (
                                  <img src={s.coverArt} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Music2 className="w-12 h-12 text-white/10" />
                                  </div>
                                )}
                                <button
                                  onClick={() => handlePlay(s.audioUrl, playId)}
                                  className="absolute inset-0 bg-black/0 hover:bg-black/40 flex items-center justify-center transition-all"
                                >
                                  <span className="w-12 h-12 rounded-full bg-white/90 backdrop-blur flex items-center justify-center scale-90 group-hover:scale-100 transition-transform shadow-xl">
                                    {currentPlayingId === playId && isPlaying
                                      ? <Pause className="w-5 h-5 text-black" />
                                      : <Play className="w-5 h-5 text-black ml-0.5" />}
                                  </span>
                                </button>
                                {s.genre && (
                                  <span className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-black/50 backdrop-blur text-white border border-white/20">
                                    {s.genre}
                                  </span>
                                )}
                                {s.plays > 0 && (
                                  <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full bg-black/50 backdrop-blur text-white/80 flex items-center gap-1">
                                    ▶ {s.plays.toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {/* Info */}
                              <div className="p-3">
                                <h4 className="text-sm font-semibold text-white truncate">{s.title}</h4>
                                <Link
                                  href={s.artist?.slug ? `/artist/${s.artist.slug}` : `/artist/id/${s.artist?.id}`}
                                  className="flex items-center gap-2 mt-1.5 group/artist"
                                >
                                  {s.artist?.image ? (
                                    <img src={s.artist.image} alt="" className="w-5 h-5 rounded-full object-cover border border-white/10" />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] text-white/40 font-bold">
                                      {(s.artist?.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span className="text-[11px] text-white/50 group-hover/artist:text-white truncate flex-1">
                                    {s.artist?.name}
                                  </span>
                                  {s.artist?.isAIGenerated && (
                                    <span className="text-[8px] px-1 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 font-bold">AI</span>
                                  )}
                                </Link>
                                <div className="flex items-center justify-between mt-2.5">
                                  <span className="text-[10px] text-white/25">
                                    {s.aiProvider?.includes('lyria') ? 'Lyria 3' : s.aiProvider?.includes('stable') ? 'Stable Audio' : s.aiProvider?.includes('minimax') || s.aiProvider?.includes('fal') ? 'Minimax' : 'AI'}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setMusicPrompt(s.description || `${s.genre || 'song'} inspired by "${s.title}"`);
                                      if (s.genre) setSelectedGenreTemplate(s.genre.toLowerCase());
                                      setActiveSection('create');
                                      toast({ title: '✨ Prompt loaded', description: `Using "${s.title}" as inspiration.` });
                                    }}
                                    className="text-[10px] text-purple-300 hover:text-purple-200 font-semibold flex items-center gap-1"
                                  >
                                    Remix <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ─── Audio Result Row ───────────────────────────────────────────────────
function AudioResultRow({
  label,
  url,
  onPlay,
  onDownload,
  isPlaying,
}: {
  label: string;
  url: string;
  onPlay: (url: string) => void;
  onDownload: (url: string) => void;
  isPlaying: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <button
        onClick={() => onPlay(url)}
        className="w-10 h-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center flex-shrink-0 transition-all"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 text-white" />
        ) : (
          <Play className="w-4 h-4 text-white ml-0.5" />
        )}
      </button>
      <div className="flex-1">
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
      <button
        onClick={() => onDownload(url)}
        className="w-10 h-10 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
      >
        <Download className="w-4 h-4 text-white/40" />
      </button>
    </div>
  );
}

// ─── LOCKED PAGE ────────────────────────────────────────────────────────

const LOCKED_FEATURES = [
  { icon: Wand2, title: "5 AI Music Models", desc: "Lyria 3 Pro, Suno, Udio, Stable Audio & FAL Minimax", gradient: "from-orange-500 to-pink-500" },
  { icon: Mic, title: "Voice AI Studio", desc: "Clone your voice and apply to any track", gradient: "from-blue-500 to-purple-500" },
  { icon: PenLine, title: "AI Lyrics", desc: "Copyright-protected songwriting workflow", gradient: "from-emerald-500 to-cyan-500" },
  { icon: BarChart3, title: "AI Mastering", desc: "Professional mastering powered by Kits.ai", gradient: "from-yellow-500 to-orange-500" },
  { icon: Scissors, title: "Stem Separation", desc: "Isolate vocals, drums, bass, and instruments", gradient: "from-violet-500 to-blue-500" },
  { icon: Shield, title: "Copyright Protection", desc: "Blockchain-verified ownership for every track", gradient: "from-rose-500 to-orange-500" },
];

const MusicGeneratorLockedPage = () => (
  <div className="min-h-screen flex flex-col bg-black overflow-x-hidden">
    <Header />

    {/* Hero */}
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-black" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-purple-600/8 via-pink-600/5 to-transparent blur-3xl" />
      
      <div className="relative z-10 container mx-auto px-4 text-center max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-8">
            <Lock className="h-3 w-3 text-white/40" />
            <span className="text-xs font-medium text-white/40 tracking-wide">Premium Feature</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white tracking-tight leading-[1.05] mb-6">
            AI Music
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/80 to-white/30">
              Production Studio
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-white/30 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Create music from text. Master your tracks. Separate stems.
            <br className="hidden sm:block" />
            All with copyright protection built in.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/pricing">
              <button className="px-8 py-4 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all active:scale-[0.97]">
                Unlock Studio
              </button>
            </Link>
            <Link href="/pricing">
              <button className="px-8 py-4 rounded-full bg-white/[0.06] text-white/60 text-sm font-medium hover:bg-white/[0.1] border border-white/[0.06] transition-all">
                View Plans
              </button>
            </Link>
          </div>
        </motion.div>

        {/* Minimal studio preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-16 max-w-2xl mx-auto"
        >
          <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              </div>
              <span className="text-[11px] text-white/15 ml-2">Boostify AI Studio</span>
            </div>
            <div className="p-6">
              {/* Waveform visualization */}
              <div className="flex items-end gap-[3px] h-16 justify-center">
                {Array.from({ length: 48 }).map((_, i) => {
                  const height = 20 + Math.sin(i * 0.3) * 30 + Math.random() * 30;
                  return (
                    <div
                      key={i}
                      className="flex-1 max-w-[6px] rounded-full bg-gradient-to-t from-white/10 to-white/5"
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center">
                  <Play className="w-4 h-4 text-white/30 ml-0.5" />
                </div>
                <div className="h-1 flex-1 max-w-xs rounded-full bg-white/[0.06]">
                  <div className="h-full w-1/3 rounded-full bg-white/10" />
                </div>
                <span className="text-[11px] text-white/15 font-mono">2:48</span>
              </div>
            </div>
            {/* Lock */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-2xl" />
          </div>
        </motion.div>
      </div>
    </section>

    {/* Features */}
    <section className="py-24 sm:py-32">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
            Everything you need
          </h2>
          <p className="text-white/30 max-w-lg mx-auto">
            A complete music production suite, powered by AI
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LOCKED_FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-6 rounded-2xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}>
                <feature.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">{feature.title}</h3>
              <p className="text-sm text-white/30 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* How it works */}
    <section className="py-24 border-t border-white/[0.04]">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
            From idea to track
          </h2>
          <p className="text-white/30">Three steps. That's it.</p>
        </div>

        <div className="space-y-6">
          {[
            { step: "01", title: "Describe", desc: "Write a prompt — or pick a template. Add mood, genre, tempo.", icon: PenLine },
            { step: "02", title: "Generate", desc: "AI creates your track with vocals, instruments, and mastering.", icon: Wand2 },
            { step: "03", title: "Export", desc: "Download in high quality with copyright protection.", icon: Download },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-6 p-6 rounded-2xl border border-white/[0.04] hover:border-white/[0.08] transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white/30">{item.step}</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-white/30">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Final CTA */}
    <section className="py-24 border-t border-white/[0.04]">
      <div className="container mx-auto px-4 text-center max-w-2xl">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
          Ready to create?
        </h2>
        <p className="text-white/30 mb-8">
          Unlock the full AI Music Production Studio today.
        </p>
        <Link href="/pricing">
          <button className="px-8 py-4 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all active:scale-[0.97]">
            Get Started
          </button>
        </Link>
      </div>
    </section>
  </div>
);
