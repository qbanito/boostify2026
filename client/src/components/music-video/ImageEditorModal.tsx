import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from "../../lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Wand2, Sparkles, Palette, Zap,
  Maximize2, Minimize2, Paintbrush, Eraser,
  RotateCcw, Check, X, Eye, EyeOff,
  Sun, Contrast, Film, Camera, Layers,
  Undo2, Download, ZoomIn, ZoomOut,
  ChevronRight, Cpu, Star, Crown, Bolt,
  ImageIcon, SlidersHorizontal, Copy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ImageEditorModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string | undefined;
  originalPrompt?: string;
  onImageEdited: (newImageUrl: string, newPrompt: string) => void;
}

type EditorMode = 'prompt' | 'inpaint';
type PresetCategory = 'style' | 'lighting' | 'color' | 'creative' | 'enhance';

interface BrushStroke {
  points: { x: number; y: number }[];
  size: number;
}

/* ------------------------------------------------------------------ */
/*  Models                                                             */
/* ------------------------------------------------------------------ */

interface EditModel {
  id: string;
  label: string;
  sublabel: string;
  description: string;
  badge: string;
  badgeClass: string;
  estimatedTime: string;
  supportsStrength: boolean;
  icon: any;
  forInpaint?: boolean;
}

const PROMPT_MODELS: EditModel[] = [
  {
    id: 'nano-banana-2',
    label: 'Nano Banana 2',
    sublabel: 'Fast & Reliable',
    description: 'Best for quick iterations and solid results',
    badge: 'FAST',
    badgeClass: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
    estimatedTime: '5–10s',
    supportsStrength: false,
    icon: Bolt,
  },
  {
    id: 'flux-dev-i2i',
    label: 'FLUX.1 Dev I2I',
    sublabel: 'High Quality',
    description: 'State-of-the-art image editing with strength control',
    badge: 'QUALITY',
    badgeClass: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
    estimatedTime: '15–20s',
    supportsStrength: true,
    icon: Star,
  },
  {
    id: 'nano-banana-pro',
    label: 'Nano Banana Pro',
    sublabel: 'Maximum Quality',
    description: 'Premium model for the most demanding edits',
    badge: 'PRO',
    badgeClass: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
    estimatedTime: '20–30s',
    supportsStrength: false,
    icon: Crown,
  },
];

const INPAINT_MODELS: EditModel[] = [
  {
    id: 'flux-fill',
    label: 'FLUX Fill',
    sublabel: 'Native Inpainting',
    description: 'Dedicated inpainting model — best mask regeneration',
    badge: 'BEST',
    badgeClass: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
    estimatedTime: '20–25s',
    supportsStrength: false,
    icon: Crown,
    forInpaint: true,
  },
  {
    id: 'nano-banana-2',
    label: 'Nano Banana 2',
    sublabel: 'Fast Fill',
    description: 'Quick inpainting with solid seamless results',
    badge: 'FAST',
    badgeClass: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
    estimatedTime: '5–10s',
    supportsStrength: false,
    icon: Bolt,
    forInpaint: true,
  },
];

/* ------------------------------------------------------------------ */
/*  Presets                                                            */
/* ------------------------------------------------------------------ */

const PRESET_CATEGORIES: Record<PresetCategory, { label: string; icon: any; presets: { label: string; instruction: string }[] }> = {
  style: {
    label: 'Style',
    icon: Film,
    presets: [
      { label: 'Cinematic', instruction: 'Apply cinematic color grading: deep shadows, lifted blacks, teal-orange contrast, anamorphic lens quality, subtle film grain and vignette. Hollywood blockbuster look.' },
      { label: 'Vintage Film', instruction: 'Vintage 35mm film look: warm faded tones, organic grain, light leaks, lifted shadows, slightly desaturated highlights, halation.' },
      { label: 'Film Noir', instruction: 'Classic film noir: extreme black and white contrast, deep dramatic shadows, single hard key light, moody atmospheric presence.' },
      { label: 'Anime Art', instruction: 'Convert to high quality anime illustration: clean cel shading, vibrant saturated colors, precise linework, anime stylized proportions.' },
      { label: 'Oil Painting', instruction: 'Transform into an oil painting: rich visible brushwork, layered textures, depth of color, classical painterly interpretation.' },
      { label: 'Watercolor', instruction: 'Soft watercolor painting: fluid color washes, wet-edge bleeding, paper texture, translucent layers, organic unpredictable color flow.' },
    ],
  },
  lighting: {
    label: 'Lighting',
    icon: Sun,
    presets: [
      { label: 'Golden Hour', instruction: 'Golden hour sunlight: warm orange and gold tones, long soft shadows, glowing edge rim lights, soft atmospheric haze.' },
      { label: 'Dramatic', instruction: 'Dramatic chiaroscuro lighting: extreme contrast, single powerful key light, deep theatrical shadows, moody atmosphere.' },
      { label: 'Neon Night', instruction: 'Nighttime neon cityscape lighting: vibrant cyan, magenta and purple neon reflections, wet pavement reflections, cyberpunk energy.' },
      { label: 'Studio', instruction: 'Perfect studio photography lighting: soft-box key light balanced with fill, clean seamless background, commercial photo look.' },
      { label: 'Backlit', instruction: 'Strong sunset backlight: silhouetted subject, glowing rim light, lens flare, warm radiant halo from behind.' },
      { label: 'Blue Hour', instruction: 'Blue hour twilight: cool blue ambient sky light, warm interior accent lights, balanced exposure, dreamlike serene atmosphere.' },
    ],
  },
  color: {
    label: 'Color',
    icon: Palette,
    presets: [
      { label: 'Boost Colors', instruction: 'Significantly boost color vibrancy and saturation across all channels, make every color pop and feel intensely alive.' },
      { label: 'Muted Analog', instruction: 'Desaturate to a subtle muted analog look: reduce saturation 30%, add gentle film tone, soft contrast.' },
      { label: 'Teal & Orange', instruction: 'Cinematic split color grade: warm orange-toned shadows, cool teal-blue highlights, high cinematic contrast.' },
      { label: 'Black & White', instruction: 'Striking high-contrast black and white conversion: rich deep blacks, luminous whites, full tonal range.' },
      { label: 'Color Pop', instruction: 'Selective color effect: keep main subject in full vivid color, convert background to black and white.' },
      { label: 'Duotone', instruction: 'Bold duotone effect in deep navy and bright orange: high contrast, graphic, poster-quality visual impact.' },
    ],
  },
  creative: {
    label: 'Creative',
    icon: Sparkles,
    presets: [
      { label: 'Neon Glow', instruction: 'Vibrant neon glow effects: glowing cyan outlines, magenta highlights, electric particles, cyberpunk energy pulse.' },
      { label: 'Glitch Art', instruction: 'Digital glitch art: RGB channel displacement, horizontal scan-line artifacts, pixel sorting, digital fragmentation.' },
      { label: 'Lens Flare', instruction: 'Cinematic anamorphic lens flares: horizontal blue streak flares, light streaks, warm bokeh orbs, filmic shimmering.' },
      { label: 'Fog & Haze', instruction: 'Atmospheric fog and haze: soft volumetric light rays, floating dust particles, depth-layered atmosphere, misty presence.' },
      { label: 'Light Leak', instruction: 'Vintage light leak effect: warm orange and pink overexposure along edges, halation, faded film border glow.' },
      { label: 'Smoke & Fire', instruction: 'Add dramatic smoke and fire visual effects: volumetric smoke wisps, ember particles, heat haze distortion.' },
    ],
  },
  enhance: {
    label: 'Enhance',
    icon: Layers,
    presets: [
      { label: 'Sharpen', instruction: 'Increase sharpness and local clarity: crisp edges, enhanced fine texture, strong high-frequency detail.' },
      { label: 'Fix Faces', instruction: 'Enhance and fix faces: balanced natural lighting, accurate skin tones, detailed eyes and hair, subtle professional retouch.' },
      { label: 'Add Detail', instruction: 'Add and enhance fine micro-details: fabric texture, hair strands, skin pores, surface materials, architectural detail.' },
      { label: 'Pro Retouch', instruction: 'Professional photo retouch: even smooth skin, balanced exposure, corrected color temperature, clean composition.' },
      { label: 'Restoration', instruction: 'Image restoration: remove compression artifacts, improve clarity, correct color, sharpen blurry areas, professional clean-up.' },
      { label: 'HDR Look', instruction: 'HDR photography look: enhanced local contrast, ultra-detailed highlights and shadows, vivid natural colors.' },
    ],
  },
};

const INPAINT_PRESETS = [
  { label: 'Remove Object', instruction: 'Completely remove everything in the masked area and fill seamlessly with the natural surrounding background. No trace left.' },
  { label: 'Add Person', instruction: 'Add a person standing naturally in the masked area, matching the scene lighting, perspective and visual style.' },
  { label: 'Change Background', instruction: 'Replace the masked area with an atmospheric cinematic background that naturally fits the scene mood and lighting.' },
  { label: 'Fix Face', instruction: 'Enhance the face in the masked area: natural lighting, clear detailed eyes, smooth skin, correct any artifacts.' },
  { label: 'Add VFX', instruction: 'Generate dramatic visual effects in the masked area: fire, smoke, sparks, neon energy, particle effects.' },
  { label: 'Change Clothing', instruction: 'Change the clothing or outfit in the masked area, naturally matching the figure, lighting and scene.' },
  { label: 'Add Object', instruction: 'Generate a fitting prop or object in the masked area, with correct perspective, shadows and scene integration.' },
  { label: 'Sky Replacement', instruction: 'Replace the sky in the masked area with a dramatic cinematic sky: vibrant clouds, sunset colors, atmosphere.' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ImageEditorModal({
  open,
  onClose,
  imageUrl,
  originalPrompt = '',
  onImageEdited,
}: ImageEditorModalProps) {
  const { toast } = useToast();

  // Core state
  const [mode, setMode] = useState<EditorMode>('prompt');
  const [editInstructions, setEditInstructions] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Model selector
  const [selectedModelId, setSelectedModelId] = useState<string>('nano-banana-2');
  const [strength, setStrength] = useState(0.85);
  const [numOutputs, setNumOutputs] = useState(1);
  const [activePresetCategory, setActivePresetCategory] = useState<PresetCategory>('style');

  // Brush / inpaint state
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<BrushStroke | null>(null);
  const [showMask, setShowMask] = useState(true);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Zoom state
  const [zoom, setZoom] = useState(1);

  // Edit history for undo
  const [editHistory, setEditHistory] = useState<string[]>([]);

  // Image loaded state
  const [imageLoaded, setImageLoaded] = useState(false);

  // Comparison slider
  const [comparePosition, setComparePosition] = useState(50);
  const [isDraggingCompare, setIsDraggingCompare] = useState(false);
  const compareContainerRef = useRef<HTMLDivElement>(null);

  // Derive active model info
  const activeModels = mode === 'inpaint' ? INPAINT_MODELS : PROMPT_MODELS;
  const activeModel = activeModels.find(m => m.id === selectedModelId) ?? activeModels[0];

  /* ----- Load image onto canvas ----- */
  const loadImageToCanvas = useCallback(() => {
    if (!imageUrl) return;

    // If canvas isn't mounted yet, retry after a short delay
    if (!canvasRef.current || !maskCanvasRef.current) {
      setTimeout(() => loadImageToCanvas(), 100);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const drawToCanvas = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      const mask = maskCanvasRef.current;
      if (!canvas || !mask) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      mask.width = img.naturalWidth;
      mask.height = img.naturalHeight;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const maskCtx = mask.getContext('2d')!;
      maskCtx.clearRect(0, 0, mask.width, mask.height);
      setImageLoaded(true);
    };

    img.onload = drawToCanvas;

    // If CORS fails, retry without crossOrigin (image will still display, just can't export canvas)
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => {
        imageRef.current = img2;
        const canvas = canvasRef.current;
        const mask = maskCanvasRef.current;
        if (!canvas || !mask) return;
        canvas.width = img2.naturalWidth;
        canvas.height = img2.naturalHeight;
        mask.width = img2.naturalWidth;
        mask.height = img2.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img2, 0, 0);
        const maskCtx = mask.getContext('2d')!;
        maskCtx.clearRect(0, 0, mask.width, mask.height);
        setImageLoaded(true);
      };
      img2.src = imageUrl;
    };

    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (open && imageUrl) {
      setImageLoaded(false);
      setStrokes([]);
      setCurrentStroke(null);
      setPreviewUrl(null);
      setEditInstructions('');
      setZoom(1);
      // Delay to ensure Dialog has rendered the canvas element
      const timer = setTimeout(() => loadImageToCanvas(), 150);
      return () => clearTimeout(timer);
    }
  }, [open, imageUrl, loadImageToCanvas]);

  // Reset model selection when switching modes
  useEffect(() => {
    setSelectedModelId(mode === 'inpaint' ? 'flux-fill' : 'nano-banana-2');
  }, [mode]);

  /* ----- Comparison slider drag ----- */
  const handleCompareDragStart = useCallback((clientX: number) => {
    setIsDraggingCompare(true);
    const rect = compareContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
    setComparePosition(pct);
  }, []);

  useEffect(() => {
    if (!isDraggingCompare) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const rect = compareContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
      setComparePosition(pct);
    };
    const onUp = () => setIsDraggingCompare(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDraggingCompare]);

  /* ----- Draw mask overlay ----- */
  const redrawMask = useCallback(() => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d')!;
    ctx.clearRect(0, 0, mask.width, mask.height);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    if (allStrokes.length === 0) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';

    for (const stroke of allStrokes) {
      ctx.strokeStyle = 'rgba(255, 100, 0, 0.55)';
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      const pts = stroke.points;
      if (pts.length === 1) {
        ctx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 100, 0, 0.55)';
        ctx.fill();
      } else {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }
    }
  }, [strokes, currentStroke]);

  useEffect(() => { redrawMask(); }, [redrawMask]);

  /* ----- Canvas event helpers ----- */
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handlePointerDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'inpaint') return;
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setCurrentStroke({ points: [coords], size: brushSize });
  }, [mode, brushSize, getCanvasCoords]);

  const handlePointerMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || mode !== 'inpaint' || !currentStroke) return;
    const coords = getCanvasCoords(e);
    setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, coords] } : null);
  }, [isDrawing, mode, currentStroke, getCanvasCoords]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawing || !currentStroke) return;
    setStrokes(prev => [...prev, currentStroke]);
    setCurrentStroke(null);
    setIsDrawing(false);
  }, [isDrawing, currentStroke]);

  /* ----- Touch support for canvas ----- */
  const getTouchCanvasCoords = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (mode !== 'inpaint') return;
    e.preventDefault();
    const coords = getTouchCanvasCoords(e);
    setIsDrawing(true);
    setCurrentStroke({ points: [coords], size: brushSize });
  }, [mode, brushSize, getTouchCanvasCoords]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || mode !== 'inpaint' || !currentStroke) return;
    e.preventDefault();
    const coords = getTouchCanvasCoords(e);
    setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, coords] } : null);
  }, [isDrawing, mode, currentStroke, getTouchCanvasCoords]);

  /* ----- Generate mask data URL for API ----- */
  const generateMaskDataUrl = useCallback((): string | null => {
    if (strokes.length === 0) return null;
    const canvas = document.createElement('canvas');
    const w = canvasRef.current?.width || 1024;
    const h = canvasRef.current?.height || 1024;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Black background = keep
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // White strokes = inpaint
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#FFFFFF';
    ctx.fillStyle = '#FFFFFF';

    for (const stroke of strokes) {
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      const pts = stroke.points;
      if (pts.length === 1) {
        ctx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }
    }

    return canvas.toDataURL('image/png');
  }, [strokes]);

  /* ----- API call ----- */
  const handleEditImage = async () => {
    if (!editInstructions.trim()) {
      toast({ title: 'Missing Instructions', description: 'Please enter editing instructions.', variant: 'destructive' });
      return;
    }
    if (!imageUrl) {
      toast({ title: 'No Image', description: 'There is no image to edit.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);

    try {
      const maskDataUrl = mode === 'inpaint' ? generateMaskDataUrl() : null;

      const requestModel = activeModel?.id ?? 'nano-banana-2';
      const requestBody: Record<string, unknown> = {
        imageUrl,
        prompt: editInstructions,
        model: requestModel,
        numImages: numOutputs,
        ...(maskDataUrl ? { maskUrl: maskDataUrl } : {}),
        ...(activeModel?.supportsStrength ? { strength } : {}),
      };

      const response = await fetch('/api/fal/nano-banana/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to edit image');
      }

      const data = await response.json();

      if (previewUrl) {
        setEditHistory(prev => [...prev, previewUrl]);
      }
      setPreviewUrl(data.imageUrl);
      setEditedPrompt(data.prompt || editInstructions);

      toast({ title: 'Edit Complete', description: 'Your edited image is ready for review.' });
    } catch (error) {
      logger.error('Error editing image:', error);
      toast({
        title: 'Edit Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  /* ----- Actions ----- */
  const handleApply = () => {
    if (previewUrl) {
      onImageEdited(previewUrl, editedPrompt);
      handleClose();
    }
  };

  const handleUndo = () => {
    if (mode === 'inpaint' && strokes.length > 0) {
      setStrokes(prev => prev.slice(0, -1));
    } else if (editHistory.length > 0) {
      setPreviewUrl(editHistory[editHistory.length - 1]);
      setEditHistory(prev => prev.slice(0, -1));
    }
  };

  const handleClearMask = () => {
    setStrokes([]);
    setCurrentStroke(null);
  };

  const handleClose = () => {
    setEditInstructions('');
    setPreviewUrl(null);
    setEditedPrompt('');
    setStrokes([]);
    setCurrentStroke(null);
    setEditHistory([]);
    setMode('prompt');
    setIsFullscreen(false);
    setZoom(1);
    onClose();
  };

  const handleCopyPrompt = () => {
    const text = editInstructions || originalPrompt;
    if (text) {
      navigator.clipboard.writeText(text).then(() =>
        toast({ title: 'Copied', description: 'Prompt copied to clipboard.' })
      );
    }
  };

  const handleDownload = () => {
    const url = previewUrl || imageUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `edited-image-${Date.now()}.png`;
    a.click();
  };

  const hasMask = strokes.length > 0;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "overflow-hidden border-zinc-800 bg-zinc-950 text-white p-0 gap-0",
          isFullscreen
            ? "fixed inset-0 max-w-none w-screen h-screen rounded-none z-[200]"
            : "max-w-6xl max-h-[92vh] rounded-xl"
        )}
      >
        {/* ---- Header ---- */}
        <DialogHeader className="px-5 py-3 border-b border-zinc-800 flex flex-row items-center justify-between bg-zinc-950/80 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
              <Paintbrush className="h-4 w-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight">Image Editor</DialogTitle>
              <p className="text-[11px] text-zinc-500 font-medium">Nano Banana AI &middot; Professional Inpainting</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Mode toggle */}
            <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
              <button
                onClick={() => setMode('prompt')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  mode === 'prompt'
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <Wand2 className="h-3.5 w-3.5 inline mr-1.5" />
                Prompt Edit
              </button>
              <button
                onClick={() => setMode('inpaint')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  mode === 'inpaint'
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <Paintbrush className="h-3.5 w-3.5 inline mr-1.5" />
                Inpaint Brush
              </button>
            </div>

            <Separator orientation="vertical" className="h-6 bg-zinc-800" />

            {/* Undo */}
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-white"
              onClick={handleUndo}
              disabled={mode === 'inpaint' ? strokes.length === 0 : editHistory.length === 0}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>

            {/* Download */}
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-white"
              onClick={handleDownload}
              title="Download Image"
            >
              <Download className="h-4 w-4" />
            </Button>

            {/* Copy Prompt */}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={handleCopyPrompt} title="Copy Prompt">
              <Copy className="h-4 w-4" />
            </Button>

            {/* Fullscreen toggle */}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            {/* Close */}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={handleClose} title="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* ---- Body ---- */}
        <div className={cn("flex flex-1 overflow-hidden", isFullscreen ? "h-[calc(100vh-52px-60px)]" : "max-h-[calc(92vh-52px-60px)]")}>
          {/* ----- Left: Canvas / Preview ----- */}
          <div className="flex-1 flex flex-col bg-zinc-950 min-w-0">
            {/* Zoom controls */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/60 bg-zinc-900/40 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white"
                onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} title="Zoom Out">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] text-zinc-500 min-w-[3rem] text-center font-mono">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white"
                onClick={() => setZoom(z => Math.min(3, z + 0.25))} title="Zoom In">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] text-zinc-500 hover:text-white px-2"
                onClick={() => setZoom(1)}>
                Fit
              </Button>

              {mode === 'inpaint' && (
                <>
                  <Separator orientation="vertical" className="h-4 bg-zinc-800 mx-1" />
                  <button
                    className="text-[11px] text-zinc-500 hover:text-white flex items-center gap-1"
                    onClick={() => setShowMask(m => !m)}
                    title={showMask ? "Hide Mask Overlay" : "Show Mask Overlay"}
                  >
                    {showMask ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    Mask
                  </button>
                  {hasMask && (
                    <button
                      className="text-[11px] text-red-400/70 hover:text-red-400 flex items-center gap-1"
                      onClick={handleClearMask}
                    >
                      <Eraser className="h-3.5 w-3.5" /> Clear
                    </button>
                  )}
                </>
              )}

              {/* Status badges */}
              <div className="flex-1" />
              {previewUrl && (
                <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 text-[10px]">
                  Edited Preview
                </Badge>
              )}
              {hasMask && mode === 'inpaint' && (
                <Badge className="bg-orange-600/20 text-orange-400 border-orange-600/30 text-[10px]">
                  Mask Active
                </Badge>
              )}
              {activeModel && (
                <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold", activeModel.badgeClass)}>
                  <Cpu className="h-2.5 w-2.5" />
                  {activeModel.label}
                </div>
              )}
            </div>

            {/* Canvas area */}
            <div
              ref={containerRef}
              className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[#0a0a0a]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '24px 24px' }}
            >
              {previewUrl && mode === 'prompt' ? (
                /* -- Before/After comparison -- */
                /* -- Overlay comparison slider -- */
                <div
                  ref={compareContainerRef}
                  className="relative select-none rounded-lg overflow-hidden border border-zinc-800 cursor-ew-resize"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                  onMouseDown={e => handleCompareDragStart(e.clientX)}
                  onTouchStart={e => handleCompareDragStart(e.touches[0].clientX)}
                >
                  <img src={imageUrl} alt="Original" className="block max-h-full w-auto object-contain" style={{ maxHeight: isFullscreen ? '72vh' : '56vh' }} />
                  <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}>
                    <img src={previewUrl} alt="Edited" className="block w-full h-full object-cover" />
                  </div>
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none" style={{ left: `${comparePosition}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center pointer-events-none" style={{ left: `${comparePosition}%` }}>
                    <ChevronRight className="h-3 w-3 text-zinc-800 -mr-0.5" />
                    <ChevronRight className="h-3 w-3 text-zinc-800 rotate-180 -ml-0.5" />
                  </div>
                  <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/70 rounded text-[10px] font-bold text-zinc-400 pointer-events-none">ORIGINAL</div>
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-600/80 rounded text-[10px] font-bold text-white pointer-events-none">EDITED</div>
                </div>
              ) : mode === 'prompt' && !previewUrl ? (
                /* -- Prompt mode: show image directly (no canvas needed) -- */
                <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Image to edit"
                      className="max-w-full rounded-lg border border-zinc-800 object-contain"
                      style={{ maxHeight: isFullscreen ? '78vh' : '58vh' }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-zinc-600">
                      <p>No image available</p>
                    </div>
                  )}
                </div>
              ) : (
                /* -- Inpaint mode: Canvas with mask overlay -- */
                <div
                  className="relative inline-block"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                >
                  {!imageLoaded && imageUrl && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    className={cn(
                      "rounded-lg border border-zinc-800 max-w-full cursor-crosshair",
                      !imageLoaded && "opacity-0"
                    )}
                    style={{ maxHeight: isFullscreen ? '78vh' : '58vh', objectFit: 'contain', width: 'auto', height: 'auto' }}
                    onMouseDown={handlePointerDown}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onMouseLeave={handlePointerUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handlePointerUp}
                  />
                  {/* Mask overlay */}
                  {showMask && (
                    <canvas
                      ref={maskCanvasRef}
                      className="absolute inset-0 rounded-lg pointer-events-none"
                      style={{ width: '100%', height: '100%' }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ----- Right Sidebar: Controls ----- */}
          <div className={cn(
            "border-l border-zinc-800 bg-zinc-900/50 flex flex-col shrink-0 overflow-hidden",
            isFullscreen ? "w-[400px]" : "w-[340px]"
          )}>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Brush Controls (inpaint mode) */}
              {/* ── Model Selector ── */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5" /> AI Model
                </h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {activeModels.map(m => {
                    const ModelIcon = m.icon;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedModelId(m.id)}
                        disabled={isProcessing}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                          selectedModelId === m.id
                            ? "border-orange-500/50 bg-orange-600/10 shadow-sm shadow-orange-900/20"
                            : "border-zinc-700/30 bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-600/50"
                        )}
                      >
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", selectedModelId === m.id ? "bg-orange-600/20" : "bg-zinc-700/40")}>
                          <ModelIcon className={cn("h-4 w-4", selectedModelId === m.id ? "text-orange-400" : "text-zinc-500")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[12px] font-semibold", selectedModelId === m.id ? "text-white" : "text-zinc-300")}>{m.label}</span>
                            <Badge className={cn("text-[9px] px-1.5 py-0 border", m.badgeClass)}>{m.badge}</Badge>
                          </div>
                          <span className="text-[10px] text-zinc-500 truncate block">{m.description}</span>
                        </div>
                        <span className="text-[9px] text-zinc-600 shrink-0 font-mono">~{m.estimatedTime}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Strength Slider (flux-dev-i2i only) ── */}
              {activeModel?.supportsStrength && (
                <div className="space-y-2 p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /> Edit Strength</span>
                    <span className="text-[11px] font-mono text-orange-400">{Math.round(strength * 100)}%</span>
                  </div>
                  <Slider value={[strength]} onValueChange={([v]) => setStrength(v)} min={0.1} max={1.0} step={0.05}
                    className="[&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-600" />
                  <div className="flex justify-between text-[9px] text-zinc-600">
                    <span>Subtle</span><span>Balanced</span><span>Maximum</span>
                  </div>
                </div>
              )}

              <Separator className="bg-zinc-800/60" />

              {/* ── Brush Controls (inpaint mode) ── */}
              {mode === 'inpaint' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Paintbrush className="h-3.5 w-3.5" />
                    Brush
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">Size</span>
                      <span className="text-[11px] text-zinc-500 font-mono">{brushSize}px</span>
                    </div>
                    <Slider
                      value={[brushSize]}
                      onValueChange={([v]) => setBrushSize(v)}
                      min={5}
                      max={150}
                      step={1}
                      className="[&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-600"
                    />
                    <div className="flex gap-1.5 mt-1">
                      {[10, 30, 60, 100].map(size => (
                        <button
                          key={size}
                          onClick={() => setBrushSize(size)}
                          className={cn(
                            "flex-1 py-1 rounded text-[10px] font-medium transition-all border",
                            brushSize === size
                              ? "bg-orange-600/20 border-orange-600/40 text-orange-400"
                              : "bg-zinc-800/50 border-zinc-700/30 text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          {size}px
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Brush preview */}
                  <div className="flex items-center justify-center py-2">
                    <div
                      className="rounded-full bg-orange-500/40 border border-orange-500/60 transition-all"
                      style={{ width: Math.min(brushSize, 80), height: Math.min(brushSize, 80) }}
                    />
                  </div>

                  <p className="text-[10px] text-zinc-600 leading-relaxed">
                    Paint over the area you want to edit. The AI will regenerate only the masked region based on your instructions.
                  </p>

                  <Separator className="bg-zinc-800" />
                </div>
              )}

              {/* Inpaint Presets */}
              {mode === 'inpaint' && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Inpaint Presets
                  </h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {INPAINT_PRESETS.map(p => (
                      <button
                        key={p.label}
                        onClick={() => setEditInstructions(p.instruction)}
                        disabled={isProcessing}
                        className={cn(
                          "text-left px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all border",
                          editInstructions === p.instruction
                            ? "bg-orange-600/15 border-orange-600/30 text-orange-300"
                            : "bg-zinc-800/40 border-zinc-700/20 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Style Presets (prompt mode) ── */}
              {mode === 'prompt' && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" /> Style Presets
                  </h3>
                  <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {(Object.keys(PRESET_CATEGORIES) as PresetCategory[]).map(cat => {
                      const catData = PRESET_CATEGORIES[cat];
                      const CategoryIcon = catData.icon;
                      return (
                        <button key={cat} onClick={() => setActivePresetCategory(cat)}
                          className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all border shrink-0",
                            activePresetCategory === cat
                              ? "bg-orange-600/15 border-orange-600/30 text-orange-400"
                              : "bg-zinc-800/40 border-zinc-700/20 text-zinc-500 hover:text-zinc-300")}>
                          <CategoryIcon className="h-3 w-3" />{catData.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PRESET_CATEGORIES[activePresetCategory].presets.map(p => (
                      <button key={p.label} onClick={() => setEditInstructions(p.instruction)} disabled={isProcessing}
                        className={cn("text-left px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all border",
                          editInstructions === p.instruction
                            ? "bg-orange-600/15 border-orange-600/30 text-orange-300"
                            : "bg-zinc-800/40 border-zinc-700/20 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60")}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="bg-zinc-800/60" />

              {/* ── Instructions textarea ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {mode === 'inpaint' ? 'Inpaint Instructions' : 'Edit Instructions'}
                  </h3>
                  {editInstructions && (
                    <button onClick={() => setEditInstructions('')} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Clear</button>
                  )}
                </div>
                <Textarea
                  placeholder={mode === 'inpaint' ? "Describe what should appear in the painted area..." : "Describe how to transform the image..."}
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  rows={3}
                  disabled={isProcessing}
                  className="bg-zinc-800/50 border-zinc-700/40 text-sm placeholder:text-zinc-600 resize-none focus-visible:ring-orange-500/50"
                />
                <p className="text-[10px] text-zinc-600">{editInstructions.length}/500 characters</p>
              </div>

              {/* Original prompt reference */}
              {originalPrompt && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Original Scene Prompt</span>
                  <p className="text-[11px] text-zinc-500 bg-zinc-800/30 px-3 py-2 rounded-lg leading-relaxed line-clamp-3">{originalPrompt}</p>
                </div>
              )}
            </div>

            {/* ----- Sidebar Footer: Actions ----- */}
            <div className="border-t border-zinc-800 p-4 space-y-2 bg-zinc-900/80 shrink-0">
              {/* Generate button */}
              <Button
                onClick={handleEditImage}
                disabled={isProcessing || !editInstructions.trim() || (mode === 'inpaint' && !hasMask)}
                className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-semibold shadow-lg shadow-orange-900/30"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    {mode === 'inpaint' ? 'Regenerate Area' : 'Generate Edit'}
                  </>
                )}
              </Button>

              {/* Apply / Discard */}
              {previewUrl && (
                <div className="flex gap-2">
                  <Button
                    variant="outline" className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    onClick={() => { setPreviewUrl(null); setEditedPrompt(''); loadImageToCanvas(); }} disabled={isProcessing}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Discard
                  </Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold" onClick={handleApply} disabled={isProcessing}>
                    <Check className="h-3.5 w-3.5 mr-1.5" />Apply to Timeline
                  </Button>
                </div>
              )}

              {mode === 'inpaint' && !hasMask && (
                <p className="text-[10px] text-zinc-600 text-center">Paint on the image to select the area to regenerate.</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
