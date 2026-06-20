/**
 * ImageGeneratorPanel — Panel de generación de imágenes con referencias
 * 
 * Permite generar imágenes manteniendo consistencia visual usando referencias
 * de clips existentes en el timeline (estilo, personaje, etc.)
 * 
 * Usa los endpoints:
 * - /api/fal/nano-banana/generate (sin referencia)
 * - /api/fal/nano-banana/generate-with-face (con referencia)
 * - /api/fal/nano-banana/generate-batch (batch paralelo)
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  X, Sparkles, ImagePlus, Loader2,
  Plus, Palette, User, Download, Check,
  Wand2, Layers, Ban,
} from 'lucide-react';
import type { TimelineClip } from '@/interfaces/timeline';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ImageGeneratorPanelProps {
  open: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  selectedClipId?: number | null;
  onImageApplied: (clipId: number, newImageUrl: string, prompt: string) => void;
  onAddAsNewClip?: (imageUrl: string, prompt: string) => void;
  /** Pre-loaded reference from "Use as Reference" context menu */
  initialReference?: { url: string; type: 'style' | 'character' } | null;
}

interface ReferenceImage {
  id: string;
  url: string;
  type: 'style' | 'character';
  clipId?: number;
  label?: string;
}

interface GeneratedResult {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

type AspectRatioOption = '16:9' | '9:16' | '1:1' | '4:3';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ASPECT_RATIOS: { value: AspectRatioOption; label: string }[] = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
];

/** Quick style modifiers appended to the prompt for instant cinematic looks */
const STYLE_PRESETS: { id: string; label: string; modifier: string }[] = [
  { id: 'cinematic', label: '🎬 Cinematic', modifier: 'cinematic lighting, shallow depth of field, film grain, anamorphic, color graded' },
  { id: 'neon', label: '🌃 Neon', modifier: 'neon lighting, cyberpunk, vibrant magenta and cyan, moody atmosphere, bokeh' },
  { id: 'film-noir', label: '🕴️ Noir', modifier: 'film noir, high contrast black and white, dramatic shadows, low key lighting' },
  { id: 'golden', label: '🌅 Golden Hour', modifier: 'golden hour, warm sunlight, lens flare, soft rim light, dreamy' },
  { id: 'studio', label: '💡 Studio', modifier: 'professional studio lighting, clean backdrop, sharp focus, high detail, editorial' },
  { id: 'vintage', label: '📼 Vintage', modifier: 'vintage 35mm film, retro color palette, soft focus, nostalgic, light leaks' },
  { id: 'hdr', label: '✨ HDR', modifier: 'ultra detailed, 8k, HDR, hyper realistic, crisp textures, professional photography' },
  { id: 'dreamy', label: '🌫️ Dreamy', modifier: 'ethereal, soft diffused light, pastel tones, hazy atmosphere, glowing' },
];

const DEFAULT_NEGATIVE = 'blurry, low quality, distorted, deformed, extra limbs, watermark, text, logo';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ImageGeneratorPanel({
  open,
  onClose,
  clips,
  selectedClipId,
  onImageApplied,
  onAddAsNewClip,
  initialReference,
}: ImageGeneratorPanelProps) {
  const { toast } = useToast();

  // References
  const [references, setReferences] = useState<ReferenceImage[]>(() => {
    if (initialReference) {
      return [{
        id: `ref-init-${Date.now()}`,
        url: initialReference.url,
        type: initialReference.type,
      }];
    }
    return [];
  });

  // Generation settings
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE);
  const [showNegative, setShowNegative] = useState(false);
  const [activePresets, setActivePresets] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('16:9');
  const [consistencyMode, setConsistencyMode] = useState(true);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Clip picker for adding refs
  const [showClipPicker, setShowClipPicker] = useState(false);
  const [pickerRefType, setPickerRefType] = useState<'style' | 'character'>('style');

  // Esc closes the preview overlay first, then the panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (previewUrl) setPreviewUrl(null);
      else if (showClipPicker) setShowClipPicker(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, previewUrl, showClipPicker, onClose]);

  // Toggle a style preset on/off
  const togglePreset = useCallback((id: string) => {
    setActivePresets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Clips that have images
  const imageClips = useMemo(() =>
    clips.filter(c => c.imageUrl || c.url || c.thumbnailUrl),
    [clips]
  );

  /* ---- Reference management ---- */

  const addReference = useCallback((clip: TimelineClip, type: 'style' | 'character') => {
    const url = clip.imageUrl || clip.url || clip.thumbnailUrl;
    if (!url) return;

    // Don't add duplicates
    if (references.some(r => r.url === url && r.type === type)) {
      toast({ title: 'Referencia ya añadida', variant: 'default' });
      return;
    }

    setReferences(prev => [...prev, {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url,
      type,
      clipId: clip.id,
      label: clip.title || `Clip ${clip.id}`,
    }]);
    setShowClipPicker(false);
  }, [references, toast]);

  const removeReference = useCallback((refId: string) => {
    setReferences(prev => prev.filter(r => r.id !== refId));
  }, []);

  const openClipPicker = useCallback((type: 'style' | 'character') => {
    setPickerRefType(type);
    setShowClipPicker(true);
  }, []);

  /* ---- Generation ---- */

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast({ title: 'Escribe un prompt', description: 'Describe la imagen que quieres generar', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);

    try {
      const referenceUrls = references.map(r => r.url);
      const hasReferences = referenceUrls.length > 0;

      // Compose the final prompt with any active style presets
      const presetModifiers = STYLE_PRESETS
        .filter(p => activePresets.has(p.id))
        .map(p => p.modifier);
      const finalPrompt = [prompt.trim(), ...presetModifiers].filter(Boolean).join(', ');
      const trimmedNegative = negativePrompt.trim();

      if (quantity > 1) {
        // Batch generation
        const prompts = Array(quantity).fill(finalPrompt);
        const res = await fetch('/api/fal/nano-banana/generate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompts,
            aspectRatio,
            ...(trimmedNegative ? { negativePrompt: trimmedNegative } : {}),
            ...(hasReferences && consistencyMode ? { referenceImages: referenceUrls } : {}),
          }),
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error en batch generation');

        const newResults: GeneratedResult[] = (data.results || [])
          .filter((r: any) => r.success && r.imageUrl)
          .map((r: any, i: number) => ({
            id: `gen-${Date.now()}-${i}`,
            url: r.imageUrl,
            prompt: finalPrompt,
            timestamp: Date.now(),
          }));

        setResults(prev => [...newResults, ...prev]);
        toast({
          title: `✨ ${newResults.length} imágenes generadas`,
          description: hasReferences ? 'Con consistencia de referencia' : 'Generación básica',
        });

      } else {
        // Single image
        const endpoint = hasReferences && consistencyMode
          ? '/api/fal/nano-banana/generate-with-face'
          : '/api/fal/nano-banana/generate';

        const body: any = {
          prompt: finalPrompt,
          aspectRatio,
        };

        if (trimmedNegative) {
          body.negativePrompt = trimmedNegative;
        }

        if (hasReferences && consistencyMode) {
          body.referenceImages = referenceUrls;
          body.shotCategory = 'PERFORMANCE'; // default to high fidelity
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error generando imagen');

        const imageUrl = data.imageUrl || data.images?.[0]?.url;
        if (!imageUrl) throw new Error('No image URL in response');

        const newResult: GeneratedResult = {
          id: `gen-${Date.now()}`,
          url: imageUrl,
          prompt: finalPrompt,
          timestamp: Date.now(),
        };

        setResults(prev => [newResult, ...prev]);
        toast({
          title: '✨ Imagen generada',
          description: hasReferences ? 'Con consistencia de referencia' : 'Generación básica',
        });
      }
    } catch (err: any) {
      console.error('ImageGeneratorPanel generation error:', err);
      toast({
        title: 'Error de generación',
        description: err.message || 'No se pudo generar la imagen',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, negativePrompt, activePresets, quantity, aspectRatio, references, consistencyMode, toast]);

  /* ---- Apply result to clip ---- */

  const handleApplyToClip = useCallback((result: GeneratedResult, clipId: number) => {
    onImageApplied(clipId, result.url, result.prompt);
    toast({ title: '✅ Imagen aplicada al clip' });
  }, [onImageApplied, toast]);

  const handleAddAsNew = useCallback((result: GeneratedResult) => {
    onAddAsNewClip?.(result.url, result.prompt);
    toast({ title: '✅ Imagen añadida como nuevo clip' });
  }, [onAddAsNewClip, toast]);

  const handleDownload = useCallback(async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `boostify-image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: open in a new tab if the blob fetch is blocked by CORS
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  /* ---- Render ---- */

  if (!open) return null;

  const styleRefs = references.filter(r => r.type === 'style');
  const characterRefs = references.filter(r => r.type === 'character');

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[min(340px,92vw)] bg-[#0d0d1a]/98 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col overflow-hidden animate-in slide-in-from-right-5 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
        <div className="flex items-center gap-2">
          <ImagePlus size={14} className="text-violet-400" />
          <span className="text-xs font-bold text-white/90">Image Generator</span>
          <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[8px] px-1 py-0">
            AI
          </Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} className="p-1 h-5 w-5 hover:bg-white/10">
          <X size={12} className="text-white/60" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* ---- References Section ---- */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Layers size={11} className="text-violet-400" />
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Referencias</span>
            {references.length > 0 && (
              <Badge className="bg-violet-500/20 text-violet-300 text-[8px] px-1 py-0 border-0">
                {references.length}
              </Badge>
            )}
          </div>

          {/* Style References */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Palette size={10} className="text-pink-400" />
                <span className="text-[9px] text-white/50 font-medium">Estilo</span>
              </div>
              <button
                onClick={() => openClipPicker('style')}
                className="flex items-center gap-0.5 text-[9px] text-pink-400/70 hover:text-pink-400 transition-colors"
              >
                <Plus size={9} /> Añadir
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {styleRefs.map(ref => (
                <div key={ref.id} className="relative group">
                  <img
                    src={ref.url}
                    alt="Style ref"
                    className="w-14 h-14 rounded-md object-cover border border-pink-500/30 cursor-pointer hover:border-pink-500/60 transition-colors"
                    onClick={() => setPreviewUrl(ref.url)}
                  />
                  <button
                    onClick={() => removeReference(ref.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                  >
                    <X size={8} className="text-white" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[7px] text-center text-pink-300 py-0.5 rounded-b-md">
                    Style
                  </div>
                </div>
              ))}
              {styleRefs.length === 0 && (
                <button
                  onClick={() => openClipPicker('style')}
                  className="w-14 h-14 rounded-md border border-dashed border-pink-500/20 flex items-center justify-center hover:border-pink-500/40 hover:bg-pink-500/5 transition-colors"
                >
                  <Plus size={14} className="text-pink-500/30" />
                </button>
              )}
            </div>
          </div>

          {/* Character References */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <User size={10} className="text-cyan-400" />
                <span className="text-[9px] text-white/50 font-medium">Personaje</span>
              </div>
              <button
                onClick={() => openClipPicker('character')}
                className="flex items-center gap-0.5 text-[9px] text-cyan-400/70 hover:text-cyan-400 transition-colors"
              >
                <Plus size={9} /> Añadir
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {characterRefs.map(ref => (
                <div key={ref.id} className="relative group">
                  <img
                    src={ref.url}
                    alt="Character ref"
                    className="w-14 h-14 rounded-md object-cover border border-cyan-500/30 cursor-pointer hover:border-cyan-500/60 transition-colors"
                    onClick={() => setPreviewUrl(ref.url)}
                  />
                  <button
                    onClick={() => removeReference(ref.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                  >
                    <X size={8} className="text-white" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[7px] text-center text-cyan-300 py-0.5 rounded-b-md">
                    Character
                  </div>
                </div>
              ))}
              {characterRefs.length === 0 && (
                <button
                  onClick={() => openClipPicker('character')}
                  className="w-14 h-14 rounded-md border border-dashed border-cyan-500/20 flex items-center justify-center hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-colors"
                >
                  <Plus size={14} className="text-cyan-500/30" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* ---- Prompt ---- */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Wand2 size={11} className="text-fuchsia-400" />
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Prompt</span>
          </div>
          <Textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe la imagen que quieres generar..."
            rows={3}
            className="bg-white/5 border-white/10 text-xs text-white/90 placeholder:text-white/30 resize-none focus:border-violet-500/50 focus:ring-violet-500/20"
          />
        </div>

        {/* ---- Style Presets ---- */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Palette size={11} className="text-amber-400" />
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Estilos</span>
            {activePresets.size > 0 && (
              <Badge className="bg-amber-500/20 text-amber-300 text-[8px] px-1 py-0 border-0">
                {activePresets.size}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {STYLE_PRESETS.map(preset => {
              const active = activePresets.has(preset.id);
              return (
                <button
                  key={preset.id}
                  onClick={() => togglePreset(preset.id)}
                  className={cn(
                    'text-[9px] px-1.5 py-1 rounded-md border transition-colors',
                    active
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- Negative Prompt ---- */}
        <div className="space-y-1.5">
          <button
            onClick={() => setShowNegative(v => !v)}
            className="flex items-center gap-1.5 text-[10px] font-bold text-white/70 uppercase tracking-wider hover:text-white/90 transition-colors"
          >
            <Ban size={11} className="text-red-400" />
            Negative Prompt
            {!showNegative && negativePrompt.trim() && (
              <Badge className="bg-red-500/20 text-red-300 text-[8px] px-1 py-0 border-0">ON</Badge>
            )}
          </button>
          {showNegative && (
            <Textarea
              value={negativePrompt}
              onChange={e => setNegativePrompt(e.target.value)}
              placeholder="Qué evitar en la imagen..."
              rows={2}
              className="bg-white/5 border-white/10 text-xs text-white/90 placeholder:text-white/30 resize-none focus:border-red-500/40 focus:ring-red-500/20"
            />
          )}
        </div>

        {/* ---- Settings Row ---- */}
        <div className="grid grid-cols-3 gap-2">
          {/* Quantity */}
          <div className="space-y-1">
            <span className="text-[9px] text-white/40 font-medium">Cantidad</span>
            <div className="flex items-center gap-1">
              {[1, 2, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setQuantity(n)}
                  className={cn(
                    'flex-1 text-[10px] py-1 rounded-md border transition-colors',
                    quantity === n
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                      : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-1">
            <span className="text-[9px] text-white/40 font-medium">Ratio</span>
            <select
              value={aspectRatio}
              onChange={e => setAspectRatio(e.target.value as AspectRatioOption)}
              className="w-full text-[10px] py-1 px-1.5 rounded-md bg-white/5 border border-white/10 text-white/70 outline-none focus:border-violet-500/50"
            >
              {ASPECT_RATIOS.map(ar => (
                <option key={ar.value} value={ar.value}>{ar.label}</option>
              ))}
            </select>
          </div>

          {/* Consistency Mode */}
          <div className="space-y-1">
            <span className="text-[9px] text-white/40 font-medium">Consistencia</span>
            <button
              onClick={() => setConsistencyMode(!consistencyMode)}
              className={cn(
                'w-full text-[10px] py-1 rounded-md border transition-colors',
                consistencyMode
                  ? 'bg-green-500/20 border-green-500/40 text-green-300'
                  : 'bg-white/5 border-white/10 text-white/40'
              )}
            >
              {consistencyMode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* ---- Generate Button ---- */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-xs h-9 gap-2 disabled:opacity-40"
        >
          {isGenerating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generando{quantity > 1 ? ` ${quantity} imágenes` : ''}...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generar {quantity > 1 ? `${quantity} imágenes` : 'imagen'}
            </>
          )}
        </Button>

        {/* ---- Results Grid ---- */}
        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-amber-400" />
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Resultados</span>
                <Badge className="bg-amber-500/20 text-amber-300 text-[8px] px-1 py-0 border-0">
                  {results.length}
                </Badge>
              </div>
              <button
                onClick={() => setResults([])}
                className="text-[9px] text-white/30 hover:text-red-400 transition-colors"
              >
                Limpiar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {results.map(result => (
                <div key={result.id} className="relative group rounded-lg overflow-hidden border border-white/10 hover:border-violet-500/40 transition-colors">
                  <img
                    src={result.url}
                    alt="Generated"
                    className="w-full aspect-video object-cover cursor-pointer"
                    onClick={() => setPreviewUrl(result.url)}
                  />
                  {/* Overlay actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                    {/* Apply to selected clip */}
                    {selectedClipId && (
                      <button
                        onClick={() => handleApplyToClip(result, selectedClipId)}
                        className="flex items-center gap-1 bg-violet-500/80 hover:bg-violet-500 text-white text-[9px] px-2 py-1 rounded-md transition-colors"
                      >
                        <Check size={10} /> Aplicar al clip
                      </button>
                    )}
                    {/* Add as new clip */}
                    {onAddAsNewClip && (
                      <button
                        onClick={() => handleAddAsNew(result)}
                        className="flex items-center gap-1 bg-fuchsia-500/80 hover:bg-fuchsia-500 text-white text-[9px] px-2 py-1 rounded-md transition-colors"
                      >
                        <Plus size={10} /> Nuevo clip
                      </button>
                    )}
                    {/* Use as reference */}
                    <button
                      onClick={() => {
                        setReferences(prev => [...prev, {
                          id: `ref-${Date.now()}`,
                          url: result.url,
                          type: 'style',
                        }]);
                        toast({ title: 'Referencia añadida' });
                      }}
                      className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-[9px] px-2 py-1 rounded-md transition-colors"
                    >
                      <Layers size={10} /> Usar como ref
                    </button>
                    {/* Download */}
                    <button
                      onClick={() => handleDownload(result.url)}
                      className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-[9px] px-2 py-1 rounded-md transition-colors"
                    >
                      <Download size={10} /> Descargar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- Clip Picker Modal ---- */}
      {showClipPicker && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-xs font-bold text-white/90">
              Seleccionar {pickerRefType === 'style' ? 'referencia de estilo' : 'referencia de personaje'}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setShowClipPicker(false)} className="p-1 h-5 w-5">
              <X size={12} className="text-white/60" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-2">
            {imageClips.length === 0 ? (
              <div className="col-span-3 text-center py-8 text-white/30 text-xs">
                No hay clips con imágenes en el timeline
              </div>
            ) : (
              imageClips.map(clip => {
                const url = clip.imageUrl || clip.url || clip.thumbnailUrl;
                return (
                  <button
                    key={clip.id}
                    onClick={() => addReference(clip, pickerRefType)}
                    className="relative rounded-md overflow-hidden border border-white/10 hover:border-violet-500/50 transition-colors group"
                  >
                    <img
                      src={url}
                      alt={clip.title || `Clip ${clip.id}`}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[8px] text-white/70 px-1 py-0.5 truncate">
                      {clip.title || `Clip ${clip.id}`}
                    </div>
                    <div className="absolute inset-0 bg-violet-500/20 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex items-center justify-center">
                      <Plus size={18} className="text-white/80" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ---- Image Preview Overlay ---- */}
      {previewUrl && (
        <div
          className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center cursor-pointer animate-in fade-in duration-150"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <div className="absolute top-3 right-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => handleDownload(previewUrl)}
              className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-[10px] text-white/80"
              title="Descargar"
            >
              <Download size={14} /> Descargar
            </button>
            <button
              onClick={() => setPreviewUrl(null)}
              className="p-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
              title="Cerrar (Esc)"
            >
              <X size={16} className="text-white/80" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
