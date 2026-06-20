import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logger } from "../../lib/logger";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Loader2, Check, Camera, RefreshCw, Sparkles, X, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface TimelineClip {
  id: number;
  prompt?: string;
  imagePrompt?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  url?: string;
  generatedImage?: string | boolean;
  image_url?: string;
  publicUrl?: string;
  firebaseUrl?: string;
  [key: string]: any;
}

interface CameraAngleConfig {
  id: string;
  name: string;
  emoji: string;
  description: string;
  prompt: string;
}

interface GeneratedVariation {
  angle: string;
  name: string;
  emoji: string;
  success: boolean;
  imageUrl: string | null;
  error?: string;
  isGenerating?: boolean;
}

interface CameraAnglesModalProps {
  open: boolean;
  onClose: () => void;
  clip: TimelineClip | null;
  onSelectAngle: (imageUrl: string, angleName: string) => void;
  onDuplicateToNearby?: (imageUrl: string, angleName: string) => void;
  // 🎭 Imágenes de referencia del artista para máxima consistencia facial
  artistReferenceImages?: string[];
  // 📝 Prompt original del clip para mantener contexto
  originalPrompt?: string;
}

// 🎬 4 ÁNGULOS PROFESIONALES PARA PERFORMANCE - Optimizado para Nano Banana Pro
// Estos ángulos mantienen máxima consistencia facial mientras varían la composición
const CAMERA_ANGLES: CameraAngleConfig[] = [
  {
    id: 'extreme-closeup',
    name: 'Extreme Close-Up',
    emoji: '🔍',
    description: 'Face-focused framing for emotional detail',
    prompt: 'Professional music video shot: EXTREME CLOSE-UP of artist singing, face filling the frame, emotional facial expression, shallow depth of field, dramatic eye contact with camera, cinematic bokeh background, intimate performance moment, studio lighting, high detail on face and emotion, same person same face exact features'
  },
  {
    id: 'medium-shot',
    name: 'Medium Shot',
    emoji: '👤',
    description: 'Balanced upper-body performance framing',
    prompt: 'Professional music video shot: MEDIUM SHOT of artist performing, framed from waist up, full upper body visible, singing with emotion, dynamic pose, professional stage lighting, cinematic composition, artist in center frame, same person same face exact features, studio quality'
  },
  {
    id: 'side-profile',
    name: 'Side Profile',
    emoji: '↔️',
    description: 'Dramatic 90-degree profile composition',
    prompt: 'Professional music video shot: SIDE PROFILE of artist singing, 90-degree angle shot, dramatic side lighting, artistic silhouette, cinematic profile view, singing performance, emotional moment, same person same face exact features, high contrast lighting, music video aesthetics'
  },
  {
    id: 'overhead-wide',
    name: 'Overhead Wide',
    emoji: '🎥',
    description: 'High-angle or aerial full-scene perspective',
    prompt: 'Professional music video shot: HIGH ANGLE or OVERHEAD shot of artist performing, camera looking down, full body visible or aerial perspective, dramatic bird\'s eye view, cinematic wide composition, artist in performance space, dynamic stage lighting, same person same face exact features, epic music video framing'
  }
];

/**
 * Obtiene la URL de imagen del clip buscando en todos los campos posibles
 */
const getClipImageUrl = (clip: TimelineClip | null): string | null => {
  if (!clip) return null;
  return clip.imageUrl || clip.thumbnailUrl || clip.url || 
         (typeof clip.generatedImage === 'string' ? clip.generatedImage : null) ||
         clip.image_url || clip.publicUrl || clip.firebaseUrl || null;
};

export default function CameraAnglesModal({ 
  open, 
  onClose, 
  clip, 
  onSelectAngle,
  onDuplicateToNearby,
  artistReferenceImages = [],
  originalPrompt = ''
}: CameraAnglesModalProps) {
  const [variations, setVariations] = useState<GeneratedVariation[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const { toast } = useToast();

  const sourceImageUrl = getClipImageUrl(clip);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setVariations([]);
      setSelectedAngle(null);
      setIsGeneratingAll(false);
    }
  }, [open]);

  // 🎬 Generar una variación con MÁXIMA CONSISTENCIA FACIAL
  // Usa Nano Banana Pro directo con referencias del artista en lugar de Edit
  const generateVariation = async (angle: CameraAngleConfig): Promise<GeneratedVariation> => {
    if (!sourceImageUrl) {
      return {
        angle: angle.id,
        name: angle.name,
        emoji: angle.emoji,
        success: false,
        imageUrl: null,
        error: 'No source image available'
      };
    }

    try {
      // Extraer contexto del clip original (descripción, estilo, mood)
      const clipContext = clip?.prompt || clip?.imagePrompt || originalPrompt || '';
      
      // Construir prompt enriquecido que mantiene identidad + cambia ángulo
      // Formato: [Descripción del artista] + [Ángulo específico] + [Contexto original]
      const enhancedPrompt = `${angle.prompt}. ${clipContext ? `Scene context: ${clipContext}.` : ''} Maintain exact same person, same facial features, same identity, same styling. Professional music video production quality, cinematic lighting.`;

      logger.info(`🎬 [ANGLES] Generando ${angle.name} con Nano Banana Pro...`);
      logger.info(`📝 [ANGLES] Prompt: ${enhancedPrompt.substring(0, 100)}...`);

      const response = await fetch('/api/fal/nano-banana', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          // 🎭 CLAVE: Usar referencias del artista para máxima consistencia
          referenceImages: artistReferenceImages.length > 0 
            ? artistReferenceImages 
            : [sourceImageUrl], // Fallback a imagen actual si no hay referencias
          aspectRatio: '16:9',
          numImages: 1,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate variation');
      }

      const data = await response.json();

      if (data.success && data.imageUrl) {
        logger.info(`✅ [ANGLES] ${angle.name} generado exitosamente`);
        return {
          angle: angle.id,
          name: angle.name,
          emoji: angle.emoji,
          success: true,
          imageUrl: data.imageUrl
        };
      } else {
        throw new Error('Image generation did not return a result');
      }
    } catch (error: any) {
      logger.error(`❌ [ANGLES] Error generando ${angle.name}:`, error);
      return {
        angle: angle.id,
        name: angle.name,
        emoji: angle.emoji,
        success: false,
        imageUrl: null,
        error: error.message || 'Unknown error'
      };
    }
  };

  // Generar todas las variaciones
  const generateAllVariations = async () => {
    if (!sourceImageUrl) {
      toast({
        title: "Error",
        description: "No image is available to generate angle variations.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAll(true);
    setSelectedAngle(null);

    // Inicializar con estado "generando"
    const initialVariations: GeneratedVariation[] = CAMERA_ANGLES.map(angle => ({
      angle: angle.id,
      name: angle.name,
      emoji: angle.emoji,
      success: false,
      imageUrl: null,
      isGenerating: true
    }));
    setVariations(initialVariations);

    toast({
      title: "Generating 4 professional camera angles...",
      description: "Using Nano Banana Pro with strong identity consistency. This may take 20-30 seconds.",
    });

    // 🚀 OPTIMIZACIÓN: Generar TODOS los ángulos en paralelo (4 al mismo tiempo)
    // Esto reduce el tiempo de ~80s (4 x 20s secuencial) a ~20-25s (paralelo)
    logger.info(`🚀 [ANGLES] Generando 4 ángulos en paralelo...`);
    const results = await Promise.all(
      CAMERA_ANGLES.map(angle => generateVariation(angle))
    );

    // Actualizar todos los resultados de una vez
    setVariations(results.map(result => ({ ...result, isGenerating: false })));
    setIsGeneratingAll(false);

    const firstSuccess = results.find(v => v.success && v.imageUrl);
    if (firstSuccess) {
      setSelectedAngle(firstSuccess.angle);
    }

    const successCount = results.filter(v => v.success).length;
    if (successCount === 0) {
      toast({
        title: "Generation failed",
        description: "No angles were generated. Check your connection and try again.",
        variant: "destructive",
      });
    } else if (successCount === 4) {
      toast({
        title: "All angles are ready",
        description: "All 4 camera angles were generated successfully.",
      });
    } else {
      toast({
        title: "Partially completed",
        description: `${successCount} of 4 angles were generated. You can regenerate failed items.`,
      });
    }
  };

  const regenerateFailed = async () => {
    const failedIds = variations.filter(v => !v.success).map(v => v.angle);
    if (failedIds.length === 0) return;

    await Promise.all(failedIds.map(id => regenerateAngle(id)));
  };

  // Regenerar un ángulo específico
  const regenerateAngle = async (angleId: string) => {
    const angle = CAMERA_ANGLES.find(a => a.id === angleId);
    if (!angle) return;

    // Marcar como generando
    setVariations(prev => prev.map(v => 
      v.angle === angleId ? { ...v, isGenerating: true, error: undefined } : v
    ));

    const result = await generateVariation(angle);

    setVariations(prev => prev.map(v => 
      v.angle === angleId ? { ...result, isGenerating: false } : v
    ));

    if (result.success) {
      toast({
        title: "Angle regenerated",
        description: `${angle.name} was regenerated successfully.`,
      });

      setSelectedAngle((prev) => prev || angleId);
    }
  };

  const handleSelectAngle = (variation: GeneratedVariation) => {
    if (!variation.success || !variation.imageUrl || variation.isGenerating) return;
    setSelectedAngle(variation.angle);
  };

  const handleApply = () => {
    if (!selectedAngle) return;

    const selectedVariation = variations.find(v => v.angle === selectedAngle);
    if (selectedVariation && selectedVariation.imageUrl) {
      onSelectAngle(selectedVariation.imageUrl, selectedVariation.name);
      toast({
        title: "Camera angle applied",
        description: `The clip now uses "${selectedVariation.name}".`,
      });
      onClose();
    }
  };

  const handleApplyAndDuplicate = () => {
    if (!selectedAngle || !onDuplicateToNearby) return;

    const selectedVariation = variations.find(v => v.angle === selectedAngle);
    if (selectedVariation && selectedVariation.imageUrl) {
      onDuplicateToNearby(selectedVariation.imageUrl, selectedVariation.name);
      toast({
        title: "Applied to nearby clips",
        description: `"${selectedVariation.name}" was propagated to nearby clips.`,
      });
      onClose();
    }
  };

  const handleClose = () => {
    setVariations([]);
    setSelectedAngle(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header - Fixed */}
        <DialogHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Camera className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
            <span>Performance Camera Angles</span>
            <Badge variant="outline" className="ml-2 text-[10px] sm:text-xs bg-orange-500/10 border-orange-500/30 text-orange-400">
              <Sparkles className="h-3 w-3 mr-1" />
              4 Cinematic Presets
            </Badge>
          </DialogTitle>
          <p className="text-xs text-white/50 mt-1">
            Generate four visual alternatives of the same moment using different camera framings for PERFORMANCE clips.
          </p>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {/* Source Image Preview */}
          {sourceImageUrl && (
            <div className="mb-4 sm:mb-6">
              <p className="text-xs sm:text-sm text-white/60 mb-2">Reference frame:</p>
              <div className="relative w-full max-w-[200px] sm:max-w-[280px] mx-auto">
                <img 
                  src={sourceImageUrl} 
                  alt="Original frame" 
                  className="w-full aspect-video object-cover rounded-lg border border-white/10"
                />
                <Badge className="absolute top-2 left-2 text-[9px] sm:text-[10px] bg-black/60">
                  Original
                </Badge>
              </div>
            </div>
          )}

          {/* Generate Button (when no variations) */}
          {variations.length === 0 && (
            <div className="text-center py-6 sm:py-8">
              <p className="text-white/70 mb-2 text-sm sm:text-base">
                Generate four camera-angle options:
              </p>
              <div className="text-xs text-white/40 mb-4 space-y-1">
                <p>🔍 Extreme Close-Up • 👤 Medium Shot</p>
                <p>↔️ Side Profile • 🎥 Overhead Wide</p>
              </div>
              <p className="text-xs text-white/50 mb-4 max-w-md mx-auto">
                All angles are generated in parallel with Nano Banana Pro using your references to preserve facial identity.
              </p>
              <Button
                onClick={generateAllVariations}
                disabled={!sourceImageUrl}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate {CAMERA_ANGLES.length} Angles
              </Button>
              {!sourceImageUrl && (
                <p className="text-red-400 text-xs mt-2">
                  This clip has no image available
                </p>
              )}
            </div>
          )}

          {/* Variations Grid */}
          {variations.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
              {variations.map((variation) => (
                <div
                  key={variation.angle}
                  className={`relative group rounded-lg overflow-hidden transition-all cursor-pointer
                    ${selectedAngle === variation.angle
                      ? 'ring-2 sm:ring-4 ring-green-500 scale-[0.98]'
                      : variation.success && !variation.isGenerating
                      ? 'hover:ring-2 hover:ring-orange-500/50'
                      : ''
                    }
                    ${variation.isGenerating ? 'pointer-events-none' : ''}
                  `}
                  onClick={() => handleSelectAngle(variation)}
                >
                  {/* Image or Loading/Error State */}
                  <div className="aspect-video relative bg-neutral-900">
                    {variation.isGenerating ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900">
                        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-orange-500 mb-2" />
                        <span className="text-[10px] sm:text-xs text-white/40">Generating...</span>
                      </div>
                    ) : variation.success && variation.imageUrl ? (
                      <>
                        <img
                          src={variation.imageUrl}
                          alt={variation.name}
                          className="w-full h-full object-cover"
                        />
                        {selectedAngle === variation.angle && (
                          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                            <div className="bg-green-500 text-white rounded-full p-1.5 sm:p-2">
                              <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                          </div>
                        )}
                        {/* Regenerate button on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            regenerateAngle(variation.angle);
                          }}
                          className="absolute top-1 right-1 sm:top-2 sm:right-2 p-1 sm:p-1.5 rounded-full bg-black/60 
                            opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                          title="Regenerate"
                        >
                          <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                        </button>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                        <span className="text-2xl sm:text-3xl mb-1">{variation.emoji}</span>
                        <span className="text-[10px] sm:text-xs text-red-400 text-center line-clamp-2">
                          {variation.error || 'Error'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-6 text-[10px] sm:text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            regenerateAngle(variation.angle);
                          }}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 sm:p-2">
                    <div className="flex items-center gap-1">
                      <span className="text-sm sm:text-base">{variation.emoji}</span>
                      <span className="text-[10px] sm:text-xs font-medium text-white truncate">
                        {variation.name}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        {variations.length > 0 && (
          <div className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-t border-white/10 bg-neutral-950">
            <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-4">
              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full sm:w-auto"
                disabled={isGeneratingAll}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={regenerateFailed}
                  disabled={isGeneratingAll || !variations.some(v => !v.success)}
                  className="flex-1 sm:flex-none"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Regenerate Failed</span>
                  <span className="sm:hidden">Fix Failed</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={generateAllVariations}
                  disabled={isGeneratingAll}
                  className="flex-1 sm:flex-none"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingAll ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Regenerate All</span>
                  <span className="sm:hidden">Regen All</span>
                </Button>

                {onDuplicateToNearby && (
                  <Button
                    onClick={handleApplyAndDuplicate}
                    disabled={!selectedAngle || isGeneratingAll}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Apply + Duplicate Nearby</span>
                    <span className="sm:hidden">Apply+Near</span>
                  </Button>
                )}
                
                <Button
                  onClick={handleApply}
                  disabled={!selectedAngle || isGeneratingAll}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                >
                  <Check className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Apply Angle</span>
                  <span className="sm:hidden">Apply</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
