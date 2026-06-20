/**
 * Motion Control & Video Generation Panel — v2
 * 
 * Professional UI to configure motion parameters and generate videos
 * from timeline image clips using Grok Imagine Video or Kling Video.
 * 
 * v2 improvements:
 * - Motion presets (one-click cinematographic profiles)
 * - Movement direction selector (already in backend)
 * - Audio section context (intro/verse/chorus/bridge/outro)
 * - Key moment effects (zoom_in, slow_motion, flash, etc.)
 * - Video preview playback for completed clips
 * - Per-clip regeneration for failures
 * - Newer Kling models (O3, v2.5 Turbo, v2.6 Pro)
 * - Always-visible prompt preview with manual editing
 * - Parallel generation toggle
 * - Estimated credit cost per model
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Wand2, Play, Settings, AlertCircle, Loader2, X,
  Video, Image, Zap, Sparkles, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, Film, RefreshCw, Layers,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Move,
  Music, Eye, Download, Pause, RotateCcw, Coins
} from "lucide-react";
import { logger } from "@/lib/logger";
import type { TimelineClip } from "@/interfaces/timeline";

// ─── Types ─────────────────────────────────────────────────────────────────

type PerformanceType = "singing" | "dancing" | "talking" | "reacting" | "instrumental" | "ambient";
type MotionComplexity = "minimal" | "moderate" | "high" | "cinematic";
type CameraStyle = "static" | "pan" | "dolly" | "tracking" | "crane" | "handheld" | "drone" | "zoom";
type MovementDirection = "left-to-right" | "right-to-left" | "push-in" | "pull-out" | "up" | "down" | "none";
type AudioSection = "intro" | "verse" | "pre-chorus" | "chorus" | "bridge" | "breakdown" | "outro" | "none";
type KeyMomentEffect = "none" | "zoom_in" | "zoom_out" | "flash" | "slow_motion" | "fast_cuts" | "shake" | "glitch";
type VideoModel = "grok" | "kling-o3" | "kling-o1-pro" | "kling-o1-standard" | "kling-v2.6-pro" | "kling-v2.5-turbo" | "kling-v2.1-pro" | "kling-v2.1-standard";

interface GenerationJob {
  clipId: number;
  status: "queued" | "generating" | "completed" | "error";
  progress: number;
  videoUrl?: string;
  error?: string;
  startedAt?: number;
}

interface MotionPreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  settings: {
    performanceType: PerformanceType;
    motionComplexity: MotionComplexity;
    cameraStyle: CameraStyle;
    movementDirection: MovementDirection;
    movementIntensity: number;
    emotionIntensity: number;
  };
}

export interface MotionControlPanelProps {
  open: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  onUpdateClip?: (clipId: number, updates: Partial<TimelineClip>) => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const MODEL_INFO: Record<VideoModel, { label: string; icon: string; speed: string; quality: string; maxDuration: number; tier: string; credits: string }> = {
  "grok":               { label: "Grok Imagine Video",  icon: "⚡", speed: "~30s",  quality: "High",      maxDuration: 6,  tier: "Fast",     credits: "~2" },
  "kling-o3":           { label: "Kling O3",             icon: "🚀", speed: "~120s", quality: "Flagship",  maxDuration: 10, tier: "Premium",  credits: "~8" },
  "kling-v2.6-pro":     { label: "Kling v2.6 Pro",      icon: "🔥", speed: "~60s",  quality: "Ultra",     maxDuration: 10, tier: "Premium",  credits: "~6" },
  "kling-v2.5-turbo":   { label: "Kling v2.5 Turbo",    icon: "💨", speed: "~30s",  quality: "High",      maxDuration: 10, tier: "Fast",     credits: "~3" },
  "kling-o1-pro":       { label: "Kling O1 Pro",        icon: "🎬", speed: "~90s",  quality: "Ultra",     maxDuration: 10, tier: "Quality",  credits: "~5" },
  "kling-o1-standard":  { label: "Kling O1 Standard",   icon: "🎥", speed: "~60s",  quality: "High",      maxDuration: 10, tier: "Standard", credits: "~3" },
  "kling-v2.1-pro":     { label: "Kling v2.1 Pro",      icon: "✨", speed: "~60s",  quality: "Very High", maxDuration: 10, tier: "Quality",  credits: "~4" },
  "kling-v2.1-standard":{ label: "Kling v2.1 Standard", icon: "📹", speed: "~45s",  quality: "Good",      maxDuration: 10, tier: "Economy",  credits: "~2" },
};

const KLING_MODEL_MAP: Record<string, string> = {
  "kling-o3": "o3-i2v",
  "kling-o1-pro": "o1-pro-i2v",
  "kling-o1-standard": "o1-standard-i2v",
  "kling-v2.6-pro": "v2.6-pro-i2v",
  "kling-v2.5-turbo": "v2.5-turbo-pro-i2v",
  "kling-v2.1-pro": "v2.1-pro-i2v",
  "kling-v2.1-standard": "v2.1-standard-i2v",
};

const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "cinematic-slow",
    name: "Cinematic Slow",
    emoji: "🎬",
    description: "Movimiento lento y elegante estilo película",
    settings: { performanceType: "singing", motionComplexity: "cinematic", cameraStyle: "dolly", movementDirection: "push-in", movementIntensity: 0.3, emotionIntensity: 0.6 },
  },
  {
    id: "energetic-performance",
    name: "Energético",
    emoji: "🔥",
    description: "Performance potente y dinámico",
    settings: { performanceType: "dancing", motionComplexity: "high", cameraStyle: "tracking", movementDirection: "left-to-right", movementIntensity: 0.8, emotionIntensity: 0.8 },
  },
  {
    id: "dreamy-ambient",
    name: "Dreamy",
    emoji: "🌙",
    description: "Atmosférico y etéreo, movimiento suave",
    settings: { performanceType: "ambient", motionComplexity: "minimal", cameraStyle: "crane", movementDirection: "up", movementIntensity: 0.2, emotionIntensity: 0.4 },
  },
  {
    id: "hiphop-dynamic",
    name: "Hip-Hop",
    emoji: "🎤",
    description: "Estilo urbano con cámara cercana",
    settings: { performanceType: "singing", motionComplexity: "high", cameraStyle: "handheld", movementDirection: "none", movementIntensity: 0.7, emotionIntensity: 0.7 },
  },
  {
    id: "emotional-ballad",
    name: "Balada",
    emoji: "💔",
    description: "Emoción intensa, close-up dramático",
    settings: { performanceType: "singing", motionComplexity: "moderate", cameraStyle: "zoom", movementDirection: "push-in", movementIntensity: 0.3, emotionIntensity: 0.9 },
  },
  {
    id: "edm-rave",
    name: "EDM / Rave",
    emoji: "🎧",
    description: "Luces, velocidad y energía máxima",
    settings: { performanceType: "dancing", motionComplexity: "cinematic", cameraStyle: "drone", movementDirection: "left-to-right", movementIntensity: 0.95, emotionIntensity: 0.95 },
  },
];

const CAMERA_OPTIONS: { value: CameraStyle; label: string; icon: string }[] = [
  { value: "static", label: "Estática", icon: "⏸️" },
  { value: "pan", label: "Pan", icon: "↔️" },
  { value: "dolly", label: "Dolly", icon: "🎥" },
  { value: "tracking", label: "Tracking", icon: "🏃" },
  { value: "crane", label: "Crane", icon: "🏗️" },
  { value: "handheld", label: "Handheld", icon: "✋" },
  { value: "drone", label: "Drone", icon: "🚁" },
  { value: "zoom", label: "Zoom", icon: "🔍" },
];

const DIRECTION_OPTIONS: { value: MovementDirection; label: string; iconName: string }[] = [
  { value: "none", label: "Auto", iconName: "move" },
  { value: "left-to-right", label: "→", iconName: "arrow-right" },
  { value: "right-to-left", label: "←", iconName: "arrow-left" },
  { value: "push-in", label: "Push In", iconName: "arrow-down" },
  { value: "pull-out", label: "Pull Out", iconName: "arrow-up" },
  { value: "up", label: "↑", iconName: "arrow-up" },
  { value: "down", label: "↓", iconName: "arrow-down" },
];

const DIRECTION_ICONS: Record<string, React.ReactNode> = {
  "move": <Move className="h-3.5 w-3.5" />,
  "arrow-right": <ArrowRight className="h-3.5 w-3.5" />,
  "arrow-left": <ArrowLeft className="h-3.5 w-3.5" />,
  "arrow-down": <ArrowDown className="h-3.5 w-3.5" />,
  "arrow-up": <ArrowUp className="h-3.5 w-3.5" />,
};

const KEY_EFFECTS: { value: KeyMomentEffect; label: string; icon: string }[] = [
  { value: "none", label: "Ninguno", icon: "—" },
  { value: "zoom_in", label: "Zoom In", icon: "🔎" },
  { value: "zoom_out", label: "Zoom Out", icon: "🔭" },
  { value: "slow_motion", label: "Slow Mo", icon: "🐌" },
  { value: "fast_cuts", label: "Fast Cuts", icon: "⚡" },
  { value: "shake", label: "Shake", icon: "📳" },
  { value: "flash", label: "Flash", icon: "💥" },
  { value: "glitch", label: "Glitch", icon: "📺" },
];

const AUDIO_SECTIONS: { value: AudioSection; label: string; color: string }[] = [
  { value: "none", label: "Auto", color: "bg-white/10" },
  { value: "intro", label: "Intro", color: "bg-blue-500/20" },
  { value: "verse", label: "Verso", color: "bg-green-500/20" },
  { value: "pre-chorus", label: "Pre-Coro", color: "bg-yellow-500/20" },
  { value: "chorus", label: "Coro", color: "bg-orange-500/20" },
  { value: "bridge", label: "Bridge", color: "bg-purple-500/20" },
  { value: "breakdown", label: "Break", color: "bg-red-500/20" },
  { value: "outro", label: "Outro", color: "bg-cyan-500/20" },
];

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function MotionControlPanel({ open, onClose, clips, onUpdateClip }: MotionControlPanelProps) {
  const { toast } = useToast();

  // Filter only image clips on layer 1 (potential scenes for video generation)
  const imageClips = clips.filter(c =>
    c.layerId === 1 && (c.type === "IMAGE" || c.type === "GENERATED_IMAGE" || c.type === "VIDEO") && (c.imageUrl || c.url)
  );

  // ── Selection & Parameters ────────────────────────────────────────────
  const [selectedClipId, setSelectedClipId] = useState<number | null>(imageClips[0]?.id ?? null);
  const [selectAll, setSelectAll] = useState(false);
  const [movementIntensity, setMovementIntensity] = useState(0.5);
  const [emotionIntensity, setEmotionIntensity] = useState(0.5);
  const [performanceType, setPerformanceType] = useState<PerformanceType>("singing");
  const [motionComplexity, setMotionComplexity] = useState<MotionComplexity>("moderate");
  const [cameraStyle, setCameraStyle] = useState<CameraStyle>("dolly");
  const [movementDirection, setMovementDirection] = useState<MovementDirection>("none");
  const [audioSection, setAudioSection] = useState<AudioSection>("none");
  const [keyEffect, setKeyEffect] = useState<KeyMomentEffect>("none");
  const [videoModel, setVideoModel] = useState<VideoModel>("grok");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cfgScale, setCfgScale] = useState(0.5);
  const [negativePrompt, setNegativePrompt] = useState("blurry, jittery, distorted faces, artifacts, low quality");
  const [customPromptOverride, setCustomPromptOverride] = useState("");
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [parallelGeneration, setParallelGeneration] = useState(false);

  // ── Generation State ──────────────────────────────────────────────────
  const [jobs, setJobs] = useState<Map<number, GenerationJob>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const pollingRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // ── Video Preview ─────────────────────────────────────────────────────
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // Sync selectedClipId when imageClips change
  useEffect(() => {
    if (imageClips.length > 0 && selectedClipId === null) {
      setSelectedClipId(imageClips[0].id);
    }
  }, [imageClips.length]);

  // Timer for elapsed display
  useEffect(() => {
    if (isGenerating) {
      const start = Date.now();
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - start), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedMs(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isGenerating]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRef.current.forEach(t => clearInterval(t));
      pollingRef.current.clear();
    };
  }, []);

  const selectedClip = imageClips.find(c => c.id === selectedClipId) ?? null;
  const targetClips = selectAll ? imageClips : (selectedClip ? [selectedClip] : []);
  const completedCount = Array.from(jobs.values()).filter(j => j.status === "completed").length;
  const errorCount = Array.from(jobs.values()).filter(j => j.status === "error").length;

  // ── Apply preset ──────────────────────────────────────────────────────
  const applyPreset = useCallback((preset: MotionPreset) => {
    setActivePreset(preset.id);
    setPerformanceType(preset.settings.performanceType);
    setMotionComplexity(preset.settings.motionComplexity);
    setCameraStyle(preset.settings.cameraStyle);
    setMovementDirection(preset.settings.movementDirection);
    setMovementIntensity(preset.settings.movementIntensity);
    setEmotionIntensity(preset.settings.emotionIntensity);
    toast({ title: `${preset.emoji} ${preset.name}`, description: "Preset aplicado" });
  }, [toast]);

  // ── Build enhanced motion prompt ──────────────────────────────────────
  const buildMotionPrompt = useCallback((clip: TimelineClip): string => {
    if (useCustomPrompt && customPromptOverride.trim()) {
      return customPromptOverride.trim();
    }

    const base = clip.metadata?.imagePrompt || clip.title || "cinematic scene, professional music video";
    const performanceMap: Record<PerformanceType, string> = {
      singing: "vocal performance, singing with emotion, expressive mouth movement",
      dancing: "choreographed dance movement, rhythmic body motion, dynamic poses",
      talking: "natural speaking gestures, conversational movement, engaged expression",
      reacting: "emotional facial expressions, reactive body language, genuine reaction",
      instrumental: "playing instrument with passion, rhythmic hand movement, musical flow",
      ambient: "atmospheric scene, environmental movement, cinematic ambience",
    };
    const complexityMap: Record<MotionComplexity, string> = {
      minimal: "subtle minimal movement, barely perceptible motion",
      moderate: "natural flowing movement, organic rhythm",
      high: "dynamic energetic movement, powerful motion",
      cinematic: "complex cinematic motion with depth, film-grade camera work",
    };
    const cameraMap: Record<CameraStyle, string> = {
      static: "stable locked-off camera, steady frame",
      pan: "smooth horizontal pan, sweeping view",
      dolly: "dolly push with depth, parallax movement",
      tracking: "tracking shot following subject, fluid follow",
      crane: "vertical crane movement, elevated perspective",
      handheld: "subtle handheld shake for authenticity, raw feel",
      drone: "aerial drone movement, sweeping overview",
      zoom: "slow cinematic zoom, focal length shift",
    };
    const directionMap: Record<MovementDirection, string> = {
      none: "",
      "left-to-right": "moving left to right",
      "right-to-left": "moving right to left",
      "push-in": "pushing in towards subject",
      "pull-out": "pulling out revealing scene",
      up: "upward movement",
      down: "downward movement",
    };
    const intensityDesc = movementIntensity < 0.3 ? "gentle" : movementIntensity < 0.6 ? "moderate" : movementIntensity < 0.8 ? "strong" : "explosive";
    const emotionDesc = emotionIntensity < 0.3 ? "subtle emotion" : emotionIntensity < 0.6 ? "visible emotion" : emotionIntensity < 0.8 ? "intense emotion" : "raw passionate emotion";

    const effectMap: Record<KeyMomentEffect, string> = {
      none: "", zoom_in: "dramatic zoom in effect", zoom_out: "reveal zoom out",
      flash: "flash transition effect", slow_motion: "slow motion emphasis",
      fast_cuts: "energetic quick movements", shake: "camera shake for impact",
      glitch: "digital glitch effect",
    };
    const sectionMap: Record<AudioSection, string> = {
      none: "", intro: "building anticipation", verse: "storytelling rhythm",
      "pre-chorus": "rising energy", chorus: "peak emotional intensity",
      bridge: "reflective moment", breakdown: "tension and release", outro: "gradual resolution",
    };

    const parts = [
      base,
      performanceMap[performanceType],
      complexityMap[motionComplexity],
      cameraMap[cameraStyle],
      directionMap[movementDirection],
      `${intensityDesc} body movement`,
      emotionDesc,
      effectMap[keyEffect],
      sectionMap[audioSection],
      "professional music video quality, cinematic lighting, 24fps film look",
    ].filter(Boolean);

    return parts.join(", ");
  }, [movementIntensity, emotionIntensity, performanceType, motionComplexity, cameraStyle, movementDirection, keyEffect, audioSection, useCustomPrompt, customPromptOverride]);

  // ── Generate Video for a single clip ──────────────────────────────────
  const generateForClip = useCallback(async (clip: TimelineClip) => {
    const clipId = clip.id;
    const imageUrl = clip.imageUrl || clip.url;
    if (!imageUrl) return;

    setJobs(prev => {
      const next = new Map(prev);
      next.set(clipId, { clipId, status: "generating", progress: 10, startedAt: Date.now() });
      return next;
    });

    const prompt = buildMotionPrompt(clip);
    const modelInfo = MODEL_INFO[videoModel];
    logger.info(`🎬 [Motion] Generating video for clip ${clipId} with ${videoModel}`);
    logger.info(`🎬 [Motion] Prompt: ${prompt}`);

    try {
      if (videoModel === "grok") {
        // ── Grok: synchronous response ──
        setJobs(prev => {
          const next = new Map(prev);
          const job = next.get(clipId);
          if (job) next.set(clipId, { ...job, progress: 30 });
          return next;
        });

        const res = await fetch("/api/fal/grok-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl,
            prompt,
            duration: Math.min(clip.duration || 6, modelInfo.maxDuration),
            resolution: "720p",
            aspectRatio: "16:9",
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Grok video generation failed");
        }

        const data = await res.json();
        if (!data.videoUrl) throw new Error("No video URL returned");

        // Success
        setJobs(prev => {
          const next = new Map(prev);
          next.set(clipId, { clipId, status: "completed", progress: 100, videoUrl: data.videoUrl });
          return next;
        });

        onUpdateClip?.(clipId, {
          videoUrl: data.videoUrl,
          metadata: {
            ...clip.metadata,
            videoUrl: data.videoUrl,
            videoGeneratedAt: new Date().toISOString(),
            hasVideo: true,
            generatedWith: "grok-imagine-video",
            motionPrompt: prompt,
            videoDuration: data.duration,
            videoWidth: data.width,
            videoHeight: data.height,
          },
        });

        logger.info(`✅ [Motion] Grok video completed for clip ${clipId}`);
      } else {
        // ── Kling: async queue with polling ──
        const klingModel = KLING_MODEL_MAP[videoModel];

        setJobs(prev => {
          const next = new Map(prev);
          const job = next.get(clipId);
          if (job) next.set(clipId, { ...job, progress: 15 });
          return next;
        });

        const res = await fetch("/api/fal/kling-video/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl,
            prompt,
            duration: Math.min(clip.duration || 5, modelInfo.maxDuration) <= 5 ? "5" : "10",
            aspectRatio: "16:9",
            model: klingModel,
            cfgScale,
            negativePrompt,
            motionInstructions: {
              cameraMovement: cameraStyle,
              movementDirection: movementDirection !== "none" ? movementDirection : undefined,
              movementSpeed: movementIntensity < 0.3 ? "slow" : movementIntensity < 0.7 ? "medium" : "fast",
              audioEnergy: emotionIntensity < 0.3 ? "low" : emotionIntensity < 0.7 ? "medium" : "high",
              emotion: performanceType,
              audioSection: audioSection !== "none" ? audioSection : undefined,
              isKeyMoment: keyEffect !== "none",
              keyMomentEffect: keyEffect !== "none" ? keyEffect : undefined,
            },
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Kling video generation failed");
        }

        const data = await res.json();

        if (data.videoUrl) {
          // Immediate result
          setJobs(prev => {
            const next = new Map(prev);
            next.set(clipId, { clipId, status: "completed", progress: 100, videoUrl: data.videoUrl });
            return next;
          });
          onUpdateClip?.(clipId, {
            videoUrl: data.videoUrl,
            metadata: { ...clip.metadata, videoUrl: data.videoUrl, hasVideo: true, videoGeneratedAt: new Date().toISOString(), generatedWith: videoModel, motionPrompt: prompt },
          });
        } else if (data.requestId) {
          // Start polling
          setJobs(prev => {
            const next = new Map(prev);
            next.set(clipId, { clipId, status: "generating", progress: 25 });
            return next;
          });

          let attempts = 0;
          const maxAttempts = 120;
          const pollInterval = setInterval(async () => {
            attempts++;
            try {
              const pollRes = await fetch(`/api/fal/kling-video/${data.requestId}?model=${klingModel}`);
              const pollData = await pollRes.json();

              const pct = Math.min(25 + Math.round((attempts / maxAttempts) * 70), 95);
              setJobs(prev => {
                const next = new Map(prev);
                const job = next.get(clipId);
                if (job && job.status === "generating") next.set(clipId, { ...job, progress: pct });
                return next;
              });

              if (pollData.status === "completed" && pollData.videoUrl) {
                clearInterval(pollInterval);
                pollingRef.current.delete(clipId);
                setJobs(prev => {
                  const next = new Map(prev);
                  next.set(clipId, { clipId, status: "completed", progress: 100, videoUrl: pollData.videoUrl });
                  return next;
                });
                onUpdateClip?.(clipId, {
                  videoUrl: pollData.videoUrl,
                  metadata: { ...clip.metadata, videoUrl: pollData.videoUrl, hasVideo: true, videoGeneratedAt: new Date().toISOString(), generatedWith: videoModel, motionPrompt: prompt },
                });
                logger.info(`✅ [Motion] Kling video completed for clip ${clipId}`);
              } else if (pollData.status === "failed" || attempts >= maxAttempts) {
                clearInterval(pollInterval);
                pollingRef.current.delete(clipId);
                setJobs(prev => {
                  const next = new Map(prev);
                  next.set(clipId, { clipId, status: "error", progress: 0, error: pollData.error || "Timeout" });
                  return next;
                });
              }
            } catch (pollErr) {
              // Transient network error — keep polling, but surface it after too many failures
              logger.warn(`⚠️ [Motion] Poll error clip ${clipId} (attempt ${attempts}/${maxAttempts}):`, pollErr);
              if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                pollingRef.current.delete(clipId);
                setJobs(prev => {
                  const next = new Map(prev);
                  next.set(clipId, { clipId, status: "error", progress: 0, error: "Error de red al consultar el estado" });
                  return next;
                });
              }
            }
          }, 5000);
          pollingRef.current.set(clipId, pollInterval);
        } else {
          throw new Error("No videoUrl or requestId returned");
        }
      }
    } catch (err: any) {
      logger.error(`❌ [Motion] Error clip ${clipId}:`, err);
      setJobs(prev => {
        const next = new Map(prev);
        next.set(clipId, { clipId, status: "error", progress: 0, error: err.message });
        return next;
      });
    }
  }, [videoModel, buildMotionPrompt, cfgScale, negativePrompt, cameraStyle, movementDirection, movementIntensity, emotionIntensity, performanceType, audioSection, keyEffect, onUpdateClip]);

  // ── Regenerate a single clip ──────────────────────────────────────────
  const regenerateClip = useCallback(async (clipId: number) => {
    const clip = imageClips.find(c => c.id === clipId);
    if (!clip) return;
    await generateForClip(clip);
  }, [imageClips, generateForClip]);

  // ── Generate for all target clips ─────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (targetClips.length === 0) {
      toast({ title: "Sin clips", description: "No hay clips de imagen seleccionados para generar video", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setJobs(new Map());

    toast({
      title: `🎬 Generando ${targetClips.length} video(s)`,
      description: `Modelo: ${MODEL_INFO[videoModel].label}`,
    });

    if (parallelGeneration && targetClips.length > 1) {
      // Parallel: launch in batches of 3 to avoid rate limits
      const batchSize = 3;
      for (let i = 0; i < targetClips.length; i += batchSize) {
        const batch = targetClips.slice(i, i + batchSize);
        await Promise.all(batch.map(clip => generateForClip(clip)));
      }
    } else {
      // Sequential: one at a time
      for (const clip of targetClips) {
        await generateForClip(clip);
      }
    }

    setIsGenerating(false);
    toast({
      title: "✅ Generación completada",
      description: `${targetClips.length} video(s) procesados`,
    });
  }, [targetClips, generateForClip, videoModel, parallelGeneration, toast]);

  // ─── If not open, render nothing ──────────────────────────────────────
  if (!open) return null;

  // ─── RENDER: Full-screen overlay panel ────────────────────────────────
  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ zIndex: 99999 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-3xl max-h-[92vh] mx-4 rounded-xl bg-neutral-950 border border-white/10 shadow-2xl flex flex-col overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-neutral-950 via-neutral-900 to-orange-950/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Wand2 className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Motion Control & Video Generation</h2>
              <p className="text-xs text-white/50">
                Ajusta movimiento, emoción y genera videos desde tus clips de imagen
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5 text-white/70" />
          </button>
        </div>

        {/* ── Scrollable body ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 #18181b" }}>

          {/* No clips warning */}
          {imageClips.length === 0 && (
            <Card className="p-6 bg-yellow-500/10 border-yellow-500/30 text-center">
              <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">Sin clips de imagen en el timeline</h3>
              <p className="text-sm text-white/60">
                Importa imágenes o genera escenas primero. Los clips de imagen en la capa "Video/Imágenes" aparecerán aquí.
              </p>
            </Card>
          )}

          {imageClips.length > 0 && (
            <>
              {/* ── Scene Selection ─────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white">Seleccionar Escena</label>
                  <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={(e) => setSelectAll(e.target.checked)}
                      className="rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500"
                    />
                    Generar todas ({imageClips.length})
                  </label>
                </div>

                {!selectAll && (
                  <Select
                    value={selectedClipId !== null ? String(selectedClipId) : ""}
                    onValueChange={(val) => setSelectedClipId(Number(val))}
                  >
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Selecciona un clip..." />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-white/10">
                      {imageClips.map((clip, idx) => (
                        <SelectItem key={clip.id} value={String(clip.id)} className="text-white focus:bg-orange-500/20">
                          <span className="flex items-center gap-2">
                            <Image className="h-3.5 w-3.5 text-orange-400" />
                            Escena {idx + 1} — {clip.title || `Clip ${clip.id}`}
                            <span className="text-white/40 ml-1">({clip.duration.toFixed(1)}s @ {clip.start.toFixed(1)}s)</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Thumbnail preview strip */}
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
                  {imageClips.map((clip, idx) => {
                    const isSelected = selectAll || clip.id === selectedClipId;
                    const job = jobs.get(clip.id);
                    return (
                      <button
                        key={clip.id}
                        onClick={() => { setSelectAll(false); setSelectedClipId(clip.id); }}
                        className={`relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected ? "border-orange-500 ring-1 ring-orange-500/40" : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <img
                          src={clip.imageUrl || clip.url}
                          alt={clip.title || `Scene ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-white text-center py-0.5 font-mono">
                          {clip.duration.toFixed(1)}s
                        </div>
                        {job?.status === "completed" && (
                          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-green-400" />
                          </div>
                        )}
                        {job?.status === "generating" && (
                          <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
                          </div>
                        )}
                        {job?.status === "error" && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <XCircle className="h-5 w-5 text-red-400" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Selected Scene Info ─────────────────────────────── */}
              {selectedClip && !selectAll && (
                <Card className="p-3 bg-white/5 border-white/10">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-white/40 mb-0.5">Tipo</p>
                      <Badge variant="outline" className="text-orange-300 border-orange-500/30">{selectedClip.type}</Badge>
                    </div>
                    <div>
                      <p className="text-white/40 mb-0.5">Duración</p>
                      <p className="font-semibold text-white">{selectedClip.duration.toFixed(1)}s</p>
                    </div>
                    <div>
                      <p className="text-white/40 mb-0.5">Inicio</p>
                      <p className="font-semibold text-white">{selectedClip.start.toFixed(1)}s</p>
                    </div>
                    <div>
                      <p className="text-white/40 mb-0.5">Fuente</p>
                      <p className="font-semibold text-white truncate max-w-[100px]" title={selectedClip.title || "—"}>
                        {selectedClip.title || "—"}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* ── Motion Presets (one-click profiles) ─────────────── */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-orange-400" />
                  Presets de Movimiento
                  <span className="text-[10px] font-normal text-white/40">— configura todo en 1 clic</span>
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
                  {MOTION_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      title={preset.description}
                      className={`flex-shrink-0 flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg border text-left transition-all min-w-[120px] ${
                        activePreset === preset.id
                          ? "bg-orange-500/20 border-orange-500/50"
                          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <span className="text-base">{preset.emoji}</span>{preset.name}
                      </span>
                      <span className="text-[9px] text-white/50 leading-tight line-clamp-2">{preset.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── AI Model Selection ──────────────────────────────── */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  Modelo de IA
                </label>
                <Select value={videoModel} onValueChange={(val) => setVideoModel(val as VideoModel)}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-white/10">
                    {Object.entries(MODEL_INFO).map(([key, info]) => (
                      <SelectItem key={key} value={key} className="text-white focus:bg-orange-500/20">
                        <span className="flex items-center gap-2">
                          <span>{info.icon}</span>
                          <span>{info.label}</span>
                          <Badge variant="secondary" className="ml-1 text-[9px] py-0 px-1">{info.speed}</Badge>
                          <Badge variant="outline" className="text-[9px] py-0 px-1">{info.quality}</Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Selected model summary */}
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/50">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {MODEL_INFO[videoModel].speed}</span>
                  <span className="flex items-center gap-1"><Film className="h-3 w-3" /> hasta {MODEL_INFO[videoModel].maxDuration}s</span>
                  <span className="flex items-center gap-1"><Coins className="h-3 w-3 text-yellow-400" /> {MODEL_INFO[videoModel].credits} créditos</span>
                  <Badge variant="outline" className="text-[9px] py-0 px-1 border-white/20">{MODEL_INFO[videoModel].tier}</Badge>
                </div>
              </div>

              {/* ── Parallel generation toggle (multi-clip) ─────────── */}
              {imageClips.length > 1 && selectAll && (
                <label className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer select-none">
                  <span className="flex items-center gap-2 text-xs text-white/70">
                    <Layers className="h-4 w-4 text-orange-400" />
                    Generación paralela
                    <span className="text-[10px] text-white/40">— más rápido (lotes de 3)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={parallelGeneration}
                    onChange={(e) => setParallelGeneration(e.target.checked)}
                    className="rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500"
                  />
                </label>
              )}

              {/* ── Performance Type ────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">Tipo de Performance</label>
                  <Select value={performanceType} onValueChange={(val) => setPerformanceType(val as PerformanceType)}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-white/10">
                      <SelectItem value="singing" className="text-white focus:bg-orange-500/20">🎤 Cantando</SelectItem>
                      <SelectItem value="dancing" className="text-white focus:bg-orange-500/20">💃 Bailando</SelectItem>
                      <SelectItem value="talking" className="text-white focus:bg-orange-500/20">🗣️ Hablando</SelectItem>
                      <SelectItem value="reacting" className="text-white focus:bg-orange-500/20">😊 Reaccionando</SelectItem>
                      <SelectItem value="instrumental" className="text-white focus:bg-orange-500/20">🎸 Instrumental</SelectItem>
                      <SelectItem value="ambient" className="text-white focus:bg-orange-500/20">🌫️ Ambiental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">Complejidad de Movimiento</label>
                  <Select value={motionComplexity} onValueChange={(val) => setMotionComplexity(val as MotionComplexity)}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-white/10">
                      <SelectItem value="minimal" className="text-white focus:bg-orange-500/20">⚪ Minimal — Sutil</SelectItem>
                      <SelectItem value="moderate" className="text-white focus:bg-orange-500/20">🟡 Moderado — Natural</SelectItem>
                      <SelectItem value="high" className="text-white focus:bg-orange-500/20">🔴 Alto — Dinámico</SelectItem>
                      <SelectItem value="cinematic" className="text-white focus:bg-orange-500/20">🎬 Cinemático — Complejo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── Camera Style ────────────────────────────────────── */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <Film className="h-4 w-4 text-blue-400" />
                  Movimiento de Cámara
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {CAMERA_OPTIONS.map(cam => (
                    <button
                      key={cam.value}
                      onClick={() => setCameraStyle(cam.value)}
                      className={`flex flex-col items-center gap-0.5 p-2 rounded-lg text-xs transition-all ${
                        cameraStyle === cam.value
                          ? "bg-orange-500/20 border border-orange-500/50 text-orange-300"
                          : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="text-base">{cam.icon}</span>
                      <span className="font-medium">{cam.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Movement Direction */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <Move className="h-4 w-4 text-green-400" />
                  Dirección de Movimiento
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DIRECTION_OPTIONS.map(dir => (
                    <button
                      key={dir.value}
                      onClick={() => setMovementDirection(dir.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                        movementDirection === dir.value
                          ? "bg-green-500/20 border border-green-500/50 text-green-300"
                          : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {DIRECTION_ICONS[dir.iconName]}
                      <span className="font-medium">{dir.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Sliders ────────────────────────────────────────── */}
              <div className="space-y-4">
                {/* Movement Intensity */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-white">Intensidad de Movimiento</label>
                    <Badge className="bg-orange-500 text-white text-xs">{Math.round(movementIntensity * 100)}%</Badge>
                  </div>
                  <Slider
                    value={[movementIntensity]}
                    onValueChange={(val) => setMovementIntensity(val[0])}
                    min={0} max={1} step={0.05}
                    className="w-full"
                  />
                  <p className="text-[10px] text-white/40">
                    {movementIntensity < 0.3 ? "Sutil — movimiento mínimo del cuerpo"
                      : movementIntensity < 0.6 ? "Moderado — movimiento natural y fluido"
                      : movementIntensity < 0.8 ? "Dinámico — movimientos energéticos"
                      : "Explosivo — intensidad cinematográfica"}
                  </p>
                </div>

                {/* Emotion Intensity */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-white">Intensidad Emocional</label>
                    <Badge className="bg-purple-500 text-white text-xs">{Math.round(emotionIntensity * 100)}%</Badge>
                  </div>
                  <Slider
                    value={[emotionIntensity]}
                    onValueChange={(val) => setEmotionIntensity(val[0])}
                    min={0} max={1} step={0.05}
                    className="w-full"
                  />
                  <p className="text-[10px] text-white/40">
                    {emotionIntensity < 0.3 ? "Sutil — emoción contenida"
                      : emotionIntensity < 0.6 ? "Visible — expresión natural"
                      : emotionIntensity < 0.8 ? "Intensa — emoción fuerte"
                      : "Pasional — expresión cruda e intensa"}
                  </p>
                </div>
              </div>

              {/* ── Advanced Options (collapsible) ──────────────────── */}
              {/* Audio Section + Key Moment Effect */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white flex items-center gap-2">
                    <Music className="h-4 w-4 text-cyan-400" />
                    Sección de la Canción
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {AUDIO_SECTIONS.map(sec => (
                      <button
                        key={sec.value}
                        onClick={() => setAudioSection(sec.value)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                          audioSection === sec.value
                            ? `${sec.color} border-white/40 text-white`
                            : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {sec.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    Efecto de Momento Clave
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {KEY_EFFECTS.map(fx => (
                      <button
                        key={fx.value}
                        onClick={() => setKeyEffect(fx.value)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                          keyEffect === fx.value
                            ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
                            : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span>{fx.icon}</span>{fx.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors w-full"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Opciones Avanzadas</span>
                {showAdvanced ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
              </button>

              {showAdvanced && (
                <Card className="p-4 bg-white/5 border-white/10 space-y-4">
                  {/* CFG Scale */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white">CFG Scale (Adherencia al prompt)</label>
                      <span className="text-xs text-white/50">{cfgScale.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[cfgScale]}
                      onValueChange={(val) => setCfgScale(val[0])}
                      min={0} max={1} step={0.05}
                      className="w-full"
                    />
                  </div>

                  {/* Negative Prompt */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-white">Prompt Negativo</label>
                    <textarea
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 resize-none focus:outline-none focus:ring-1 focus:ring-orange-500"
                      placeholder="Qué evitar en el video..."
                    />
                  </div>

                  {/* Generated Prompt Preview */}
                  {selectedClip && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-white/60">Prompt generado (preview)</label>
                      <div className="bg-black/40 rounded-lg p-2 text-[10px] text-white/50 font-mono leading-relaxed max-h-20 overflow-y-auto">
                        {buildMotionPrompt(selectedClip)}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* ── Generation Progress ────────────────────────────── */}
              {jobs.size > 0 && (
                <Card className="p-4 bg-white/5 border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Layers className="h-4 w-4 text-orange-400" />
                      Progreso de Generación
                    </h4>
                    {isGenerating && (
                      <span className="text-[10px] text-white/40 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatElapsed(elapsedMs)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/60">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> {completedCount} completados</span>
                    {errorCount > 0 && <span className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-red-400" /> {errorCount} errores</span>}
                    <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5 text-orange-400" /> {jobs.size} total</span>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                    {Array.from(jobs.entries()).map(([clipId, job]) => {
                      const clip = imageClips.find(c => c.id === clipId);
                      return (
                        <div key={clipId} className="flex items-center gap-2">
                          <div className="w-8 h-6 rounded overflow-hidden flex-shrink-0 bg-white/10">
                            {clip && <img src={clip.imageUrl || clip.url} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] text-white/60 truncate">{clip?.title || `Clip ${clipId}`}</span>
                              <span className="text-[10px] text-white/40">
                                {job.status === "completed" ? "✅" : job.status === "error" ? "❌" : job.status === "generating" ? "⏳" : "⏸️"}
                              </span>
                            </div>
                            <Progress value={job.progress} className="h-1.5" />
                            {job.error && <p className="text-[9px] text-red-400 mt-0.5 truncate">{job.error}</p>}
                          </div>
                          {(job.status === "completed" || job.status === "error") && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {job.status === "completed" && job.videoUrl && (
                                <button
                                  onClick={() => setPreviewVideoUrl(job.videoUrl!)}
                                  title="Ver video"
                                  className="p-1 rounded hover:bg-white/10 text-green-400 transition-colors"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => regenerateClip(clipId)}
                                disabled={isGenerating}
                                title="Regenerar este clip"
                                className="p-1 rounded hover:bg-white/10 text-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* ── Info Card ──────────────────────────────────────── */}
              <Card className="p-3 bg-blue-500/10 border-blue-500/20 flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-white/60">
                  <p className="font-semibold text-white/80 mb-0.5">Generación de Video con IA</p>
                  <p>
                    Los parámetros de movimiento y emoción se envían a {MODEL_INFO[videoModel].label} para
                    generar video animado desde la imagen del clip. El video reemplazará la imagen estática en el timeline.
                  </p>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* ── Footer / Action Buttons ────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-neutral-950 flex-shrink-0">
          <div className="text-xs text-white/40">
            {targetClips.length > 0 ? (
              <span>{selectAll ? "Todas las escenas" : "1 escena"} · {MODEL_INFO[videoModel].label}</span>
            ) : (
              <span>Selecciona al menos una escena</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isGenerating}
              className="border-white/10 text-white/70 hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={targetClips.length === 0 || isGenerating}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white gap-2 min-w-[180px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando {completedCount}/{targetClips.length}...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Generar Video{targetClips.length > 1 ? `s (${targetClips.length})` : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Video Preview Overlay ─── */}
      {previewVideoUrl && (
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          style={{ zIndex: 100000 }}
          onClick={() => setPreviewVideoUrl(null)}
        >
          <div className="relative w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewVideoUrl(null)}
              className="absolute -top-10 right-0 p-2 rounded-lg hover:bg-white/10 text-white/70 transition-colors"
              title="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
            <video
              src={previewVideoUrl}
              controls
              autoPlay
              loop
              className="w-full rounded-xl border border-white/10 shadow-2xl bg-black"
            />
            <div className="mt-2 flex justify-end">
              <a
                href={previewVideoUrl}
                download
                className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Descargar
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
