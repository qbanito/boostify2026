/**
 * VariationsPanel — Genera variaciones de una imagen con distintas perspectivas de cámara
 * 
 * Inspirado en el panel "Variations" de referencia:
 * - Muestra la imagen fuente
 * - Selector de modo (Reframe, Remix, etc.)
 * - Grid de perspectivas con checkboxes
 * - Botón Generate para crear variaciones en batch
 * 
 * Usa: /api/fal/nano-banana/generate-batch con referencia
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  X, Sparkles, Loader2, ChevronLeft, Check,
  Plus, ChevronDown, Maximize2, Settings2,
} from 'lucide-react';
import type { TimelineClip } from '@/interfaces/timeline';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VariationsPanelProps {
  open: boolean;
  onClose: () => void;
  clip: TimelineClip;
  onVariationsGenerated: (results: VariationResult[]) => void;
  onApplyToClip?: (clipId: number, imageUrl: string) => void;
}

export interface VariationResult {
  id: string;
  url: string;
  perspective: string;
  prompt: string;
}

type VariationMode = 'reframe' | 'remix' | 'subtle';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MODES: { value: VariationMode; label: string; description: string }[] = [
  { value: 'reframe', label: 'Reframe', description: 'Same scene, different camera angles' },
  { value: 'remix', label: 'Remix', description: 'Creative reinterpretation with variations' },
  { value: 'subtle', label: 'Subtle', description: 'Minor tweaks, keep composition' },
];

interface Perspective {
  id: string;
  label: string;
  promptSuffix: string;
  default: boolean;
}

const PERSPECTIVES: Perspective[] = [
  { id: 'ext-long', label: 'Ext. long shot', promptSuffix: 'extreme long shot, full environment visible, establishing shot', default: true },
  { id: 'long', label: 'Long shot', promptSuffix: 'long shot, full body visible, wide framing', default: true },
  { id: 'closeup', label: 'Closeup', promptSuffix: 'close-up shot, face filling frame, intimate portrait', default: true },
  { id: 'medium-long', label: 'Medium long', promptSuffix: 'medium long shot, knees up, natural framing', default: true },
  { id: 'extreme-closeup', label: 'Extreme closeup', promptSuffix: 'extreme close-up, eyes and mouth detail, macro portrait', default: true },
  { id: 'low-angle', label: 'Low angle', promptSuffix: 'low angle shot, camera looking up, powerful perspective', default: true },
  { id: 'back-view', label: 'Back view', promptSuffix: 'back view, over the shoulder, rear perspective', default: true },
  { id: 'med-closeup', label: 'Med. closeup', promptSuffix: 'medium close-up, chest up, conversational distance', default: true },
  { id: 'ots', label: 'OTS', promptSuffix: 'over the shoulder shot, depth framing', default: false },
  { id: 'high-angle', label: 'High angle', promptSuffix: 'high angle shot, camera looking down, bird\'s eye perspective', default: true },
  { id: 'wide', label: 'Wide', promptSuffix: 'wide shot, panoramic view, environmental context', default: false },
  { id: 'pov', label: 'POV', promptSuffix: 'point of view shot, first person perspective', default: false },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getClipImageUrl = (clip: TimelineClip): string | null => {
  return clip.imageUrl || clip.thumbnailUrl || clip.url ||
         (typeof clip.generatedImage === 'string' ? clip.generatedImage : null) ||
         clip.image_url || clip.publicUrl || clip.firebaseUrl || null;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function VariationsPanel({
  open,
  onClose,
  clip,
  onVariationsGenerated,
  onApplyToClip,
}: VariationsPanelProps) {
  const { toast } = useToast();

  const [mode, setMode] = useState<VariationMode>('reframe');
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [selectedPerspectives, setSelectedPerspectives] = useState<Set<string>>(
    () => new Set(PERSPECTIVES.filter(p => p.default).map(p => p.id))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<VariationResult[]>([]);

  const sourceUrl = useMemo(() => getClipImageUrl(clip), [clip]);
  const basePrompt = clip.metadata?.imagePrompt || clip.title || 'cinematic scene';

  const selectedCount = selectedPerspectives.size;
  const totalCount = PERSPECTIVES.length;

  const togglePerspective = useCallback((id: string) => {
    setSelectedPerspectives(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const currentMode = MODES.find(m => m.value === mode)!;

  /* ---- Build prompts per perspective ---- */
  const buildPrompt = useCallback((perspective: Perspective): string => {
    switch (mode) {
      case 'reframe':
        return `${basePrompt}. Reframed as ${perspective.promptSuffix}. Maintain exact same subject, lighting, and scene composition.`;
      case 'remix':
        return `${basePrompt}. Creative variation: ${perspective.promptSuffix}. Same subject with artistic reinterpretation.`;
      case 'subtle':
        return `${basePrompt}. ${perspective.promptSuffix}. Subtle variation, keep original mood and composition.`;
    }
  }, [basePrompt, mode]);

  /* ---- Generate ---- */
  const handleGenerate = useCallback(async () => {
    if (selectedCount === 0) {
      toast({ title: 'Selecciona al menos una perspectiva', variant: 'destructive' });
      return;
    }
    if (!sourceUrl) {
      toast({ title: 'No hay imagen fuente', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);

    try {
      const activePerspectives = PERSPECTIVES.filter(p => selectedPerspectives.has(p.id));
      const prompts = activePerspectives.map(p => buildPrompt(p));

      const res = await fetch('/api/fal/nano-banana/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompts,
          aspectRatio: '16:9',
          referenceImages: [sourceUrl],
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error generating variations');

      const newResults: VariationResult[] = (data.results || [])
        .filter((r: any) => r.success && r.imageUrl)
        .map((r: any, i: number) => ({
          id: `var-${Date.now()}-${i}`,
          url: r.imageUrl,
          perspective: activePerspectives[r.index]?.label || activePerspectives[i]?.label || 'Unknown',
          prompt: prompts[r.index] || prompts[i] || '',
        }));

      setResults(newResults);
      onVariationsGenerated(newResults);

      toast({
        title: `✨ ${newResults.length} variaciones generadas`,
        description: `Modo: ${currentMode.label}`,
      });

    } catch (err: any) {
      console.error('VariationsPanel error:', err);
      toast({
        title: 'Error generando variaciones',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [selectedCount, sourceUrl, selectedPerspectives, buildPrompt, currentMode, onVariationsGenerated, toast]);

  if (!open) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[min(340px,92vw)] bg-[#0d0d1a] border-l border-[#2a2a40] z-50 flex flex-col overflow-hidden animate-in slide-in-from-right-5 duration-200">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#2a2a40]">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-[11px] text-[#8888aa] hover:text-white transition-colors mb-1"
        >
          <ChevronLeft size={12} />
          <span>Tools</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">Variations</span>
          <Badge className="bg-[#3d2a10] text-[#f5a623] border-[#5a3d15] text-[8px] px-1.5 py-0">
            Experimental
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Source Image */}
        {sourceUrl && (
          <div className="relative mx-3 mt-3">
            <img
              src={sourceUrl}
              alt="Source"
              className="w-full aspect-video object-cover rounded-lg border border-[#2a2a40]"
            />
            <button
              onClick={onClose}
              className="absolute top-2 right-2 w-6 h-6 rounded-md bg-[#111122] flex items-center justify-center hover:bg-[#1a1a2e] transition-colors"
            >
              <X size={14} className="text-[#8888aa]" />
            </button>
          </div>
        )}

        {/* Mode Selector */}
        <div className="px-3 mt-4">
          <span className="text-[10px] font-bold text-[#8888aa] uppercase tracking-wider">Mode</span>
          <div className="relative mt-1.5">
            <button
              onClick={() => setShowModeSelect(!showModeSelect)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#1a1a30] border border-[#333355] hover:border-[#4466aa] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={14} className="text-[#6699ff]" />
                <span className="text-xs font-semibold text-white">{currentMode.label}</span>
              </div>
              <ChevronDown size={14} className={cn('text-[#8888aa] transition-transform', showModeSelect && 'rotate-180')} />
            </button>

            {showModeSelect && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-[#333355] bg-[#141428] shadow-[0_8px_32px_rgba(0,0,0,0.9)] z-10 overflow-hidden">
                {MODES.map(m => (
                  <button
                    key={m.value}
                    onClick={() => { setMode(m.value); setShowModeSelect(false); }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-3 text-left transition-colors border-b border-[#1e1e35] last:border-b-0',
                      mode === m.value
                        ? 'bg-[#1a2240] hover:bg-[#1e2850]'
                        : 'hover:bg-[#1a1a32]'
                    )}
                  >
                    <div>
                      <div className={cn(
                        'text-[13px] font-semibold',
                        mode === m.value ? 'text-[#6eaaff]' : 'text-white'
                      )}>{m.label}</div>
                      <div className="text-[10px] text-[#777799] mt-0.5">{m.description}</div>
                    </div>
                    {mode === m.value && <Check size={14} className="text-[#6eaaff] flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Perspectives Grid */}
        <div className="px-3 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[#8888aa] uppercase tracking-wider">Perspectives</span>
            <span className="text-[10px] text-[#666688]">({selectedCount}/{totalCount})</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {PERSPECTIVES.map(p => {
              const isChecked = selectedPerspectives.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePerspective(p.id)}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors',
                    isChecked
                      ? 'bg-[#162040] hover:bg-[#1a2550]'
                      : 'bg-[#13132a] hover:bg-[#1a1a35]'
                  )}
                >
                  <div className={cn(
                    'rounded-md flex items-center justify-center flex-shrink-0 transition-colors',
                    isChecked
                      ? 'bg-[#3366cc]'
                      : 'bg-[#1e1e38] border border-[#333355]'
                  )}
                    style={{ width: 18, height: 18 }}
                  >
                    {isChecked && <Check size={11} className="text-white" />}
                  </div>
                  <span className={cn(
                    'text-[11px] font-medium truncate',
                    isChecked ? 'text-white' : 'text-[#777799]'
                  )}>
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Grid */}
        {results.length > 0 && (
          <div className="px-3 mt-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-[#f5a623]" />
              <span className="text-[10px] font-bold text-[#aaaacc] uppercase tracking-wider">Results</span>
              <Badge className="bg-[#3d2a10] text-[#f5a623] text-[8px] px-1 py-0 border-[#5a3d15]">
                {results.length}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {results.map(result => (
                <div key={result.id} className="relative group rounded-lg overflow-hidden border border-[#2a2a40] hover:border-[#4466aa] transition-colors">
                  <img
                    src={result.url}
                    alt={result.perspective}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0d0d1a] to-transparent px-2 py-1.5">
                    <span className="text-[9px] text-white font-medium">{result.perspective}</span>
                  </div>
                  {/* Overlay actions */}
                  {onApplyToClip && (
                    <div className="absolute inset-0 bg-[#0d0d1a] opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => onApplyToClip(clip.id, result.url)}
                        className="flex items-center gap-1 bg-[#3366cc] hover:bg-[#4477dd] text-white text-[9px] px-2 py-1 rounded-md transition-colors"
                      >
                        <Check size={10} /> Apply
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>

      {/* Generate Button - fixed at bottom */}
      <div className="p-3 border-t border-[#2a2a40]">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || selectedCount === 0}
          className="w-full bg-gradient-to-r from-[#2255bb] to-[#3366cc] hover:from-[#3366cc] hover:to-[#4477dd] text-white font-bold text-xs h-10 gap-2 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generating {selectedCount} variations...
            </>
          ) : (
            <>
              Generate
              <Sparkles size={14} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
