import { useState } from "react";
import { logger } from "@/lib/logger";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, ChevronRight, Check, Film, Music, Palette, MapPin, Shirt, Clock, Eye, Loader2, Camera, Clapperboard, Flame, Zap, BookOpen, Film as FilmIcon, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface ConceptSelectionModalProps {
  open: boolean;
  concepts: any[];
  directorName: string;
  onSelect: (concept: any) => void;
}

export function ConceptSelectionModal({ 
  open, 
  concepts, 
  directorName,
  onSelect 
}: ConceptSelectionModalProps) {
  const [selectedConcept, setSelectedConcept] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Log cuando el modal se abre o cambia
  if (open) {
    logger.info('═'.repeat(60));
    logger.info(`🎬 [CONCEPT MODAL] Modal ABIERTO`);
    logger.info(`📊 Conceptos recibidos: ${concepts?.length || 0}`);
    logger.info(`🎭 Director: ${directorName}`);
    if (concepts?.length > 0) {
      concepts.forEach((c, i) => {
        logger.info(`  ${i+1}. ${c.title || 'Sin título'} - Poster: ${c.coverImage ? '✅' : '⏳ Generando...'}`);
      });
    }
    logger.info('═'.repeat(60));
  }

  const handleContinue = async () => {
    if (selectedConcept && !isLoading) {
      setIsLoading(true);
      try {
        await onSelect(selectedConcept);
      } catch (error) {
        logger.error('Error in handleContinue:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Dialog open={open} modal={true}>
      <DialogContent className="max-w-7xl h-[95vh] sm:h-[90vh] flex flex-col bg-gradient-to-br from-background via-background to-orange-950/20 p-0 gap-0" data-testid="modal-concept-selection">
        <DialogHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6 shrink-0">
          <DialogTitle className="text-xl sm:text-2xl md:text-3xl font-bold text-center flex items-center justify-center gap-2 sm:gap-3">
            <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-orange-500" />
            <span className="line-clamp-1">{directorName} - Three Concept Proposals</span>
          </DialogTitle>
          <p className="text-center text-xs sm:text-sm md:text-base text-muted-foreground mt-1 sm:mt-2">
            Choose the concept that best captures your music's vision and creative direction
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto px-4 sm:px-6 py-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {concepts.map((concept, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
              >
                <Card
                  className={cn(
                    "p-0 cursor-pointer transition-all hover:border-orange-500/50 hover:shadow-2xl h-full flex flex-col overflow-hidden group",
                    selectedConcept === concept && "border-2 border-orange-500 bg-orange-500/10 shadow-2xl shadow-orange-500/30"
                  )}
                  onClick={() => setSelectedConcept(concept)}
                  data-testid={`concept-${index}`}
                >
                  {/* Cover Image - Cinematic Poster - ENHANCED */}
                  <div className="relative w-full aspect-[2/3] overflow-hidden group bg-gradient-to-br from-gray-900 to-gray-800 border-b-4 border-orange-500/20">
                    <AnimatePresence mode="wait">
                      {concept.isGenerating ? (
                        <motion.div
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black"
                        >
                          <Loader2 className="h-12 w-12 text-orange-500 animate-spin mb-4" />
                          <p className="text-white/70 text-sm font-medium">Generating Cinematic Poster...</p>
                          <p className="text-white/50 text-xs mt-1">Concept #{index + 1} of 3</p>
                        </motion.div>
                      ) : concept.error ? (
                        <motion.div
                          key="error"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-orange-950/40 via-gray-900 to-gray-800 p-4 text-center"
                        >
                          <Clapperboard className="h-14 w-14 text-orange-500/50 mb-3" />
                          <p className="text-white/80 text-sm font-semibold">Concept #{index + 1}</p>
                          <p className="text-white/50 text-xs mt-1">Poster unavailable — select to continue</p>
                        </motion.div>
                      ) : concept.coverImage ? (
                        <motion.div
                          key="loaded"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="relative w-full h-full"
                        >
                          <img 
                            src={concept.coverImage} 
                            alt={concept.title}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                            loading="lazy"
                          />
                          {/* Enhanced gradient overlays */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/20" />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                            <p className="text-white font-bold text-lg md:text-xl mb-2 drop-shadow-lg line-clamp-1">{concept.title || 'Untitled'}</p>
                            <p className="text-white/80 text-xs md:text-sm drop-shadow-lg line-clamp-1">{concept.visual_theme?.split('.')[0] || 'Cinematic vision'}</p>
                          </div>
                          {selectedConcept === concept && (
                            <div className="absolute top-3 right-3">
                              <div className="bg-orange-500 text-white rounded-full p-2 shadow-lg">
                                <Check className="h-5 w-5" />
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="placeholder"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-orange-950/40 via-gray-900 to-gray-800 p-4"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          >
                            <Clapperboard className="h-16 w-16 text-orange-500/60 mb-3" />
                          </motion.div>
                          <p className="text-gray-400 text-sm text-center font-semibold">Concept #{index + 1}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Content Section - Enhanced Styling */}
                  <div className="p-5 md:p-6 flex-1 flex flex-col bg-gradient-to-br from-background to-background/80">
                    {/* Selection Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all shadow-lg",
                        selectedConcept === concept ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white ring-4 ring-orange-500/40" : "bg-gradient-to-br from-orange-400/30 to-orange-500/20 text-orange-500"
                      )}>
                        {selectedConcept === concept ? (
                          <Check className="h-6 w-6" />
                        ) : (
                          <span>#{index + 1}</span>
                        )}
                      </div>
                      
                      {selectedConcept === concept && (
                        <Badge className="bg-orange-500 text-white text-xs animate-pulse shadow-lg">
                          ✓ Selected
                        </Badge>
                      )}
                    </div>

                    {/* Title with Icon */}
                    {concept.title && (
                      <h3 className="text-lg md:text-xl font-bold mb-3 text-foreground line-clamp-2 flex items-start gap-2">
                        <Flame className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        {concept.title}
                      </h3>
                    )}

                    {/* Story Concept with enhanced styling */}
                    {concept.story_concept && (
                      <div className="mb-4 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                        <div className="flex gap-2 mb-2">
                          <BookOpen className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">NARRATIVE</p>
                        </div>
                        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed line-clamp-3">
                          {concept.story_concept}
                        </p>
                      </div>
                    )}

                    <Separator className="my-3" />

                    {/* TECHNICAL CINEMATOGRAPHY DETAILS - key_scenes from GPT */}
                    {(concept.cinematography || (concept.key_scenes && concept.key_scenes.length > 0)) && (
                      <div className="mb-4 p-3 bg-gradient-to-br from-orange-500/15 to-orange-600/10 rounded-lg border border-orange-500/30 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-orange-500" />
                          <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Technical Specs</span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          {concept.cinematography?.cinematographer && (
                            <div className="flex items-start justify-between">
                              <span className="text-muted-foreground">DP:</span>
                              <span className="font-semibold text-foreground text-right">{concept.cinematography.cinematographer}</span>
                            </div>
                          )}
                          {concept.cinematography?.camera_format && (
                            <div className="flex items-start justify-between">
                              <span className="text-muted-foreground">Format:</span>
                              <span className="font-semibold text-foreground text-right">{concept.cinematography.camera_format}</span>
                            </div>
                          )}
                          {concept.cinematography?.lens_package && (
                            <div className="flex items-start justify-between">
                              <span className="text-muted-foreground">Lenses:</span>
                              <span className="font-semibold text-foreground text-right">{concept.cinematography.lens_package}</span>
                            </div>
                          )}
                          {/* Show key_scenes when cinematography object is missing */}
                          {!concept.cinematography && concept.key_scenes?.slice(0, 2).map((scene: any, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <Badge variant="outline" className="text-[8px] px-1.5 py-0 font-mono flex-shrink-0">
                                {scene.timestamp}
                              </Badge>
                              <div className="flex-1">
                                <p className="font-semibold text-foreground line-clamp-1">{scene.visual_style || scene.description}</p>
                                {scene.camera_movement && (
                                  <p className="text-muted-foreground line-clamp-1">{scene.camera_movement}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Visual Theme */}
                  {concept.visual_theme && (
                    <div className="mb-3 p-2.5 bg-muted/30 rounded-lg border border-muted">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Eye className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Visual Style</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {concept.visual_theme}
                      </p>
                    </div>
                  )}

                  {/* Mood / Emotional Arc */}
                  {(concept.mood_progression || concept.mood) && (
                    <div className="mb-3 p-2.5 bg-muted/30 rounded-lg border border-muted">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Music className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Emotional Arc</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {concept.mood_progression || concept.mood}
                      </p>
                    </div>
                  )}

                  {/* Wardrobe */}
                  {(concept.main_wardrobe || concept.wardrobe) && (
                    <div className="mb-3 p-2.5 bg-muted/30 rounded-lg border border-muted">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Shirt className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Wardrobe</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {concept.main_wardrobe?.outfit_description || concept.wardrobe?.main_outfit || ''}
                      </p>
                      {(concept.main_wardrobe?.colors || concept.wardrobe?.alternative_looks) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(concept.main_wardrobe?.colors || concept.wardrobe?.alternative_looks || []).slice(0, 3).map((item: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Locations */}
                  {concept.locations && concept.locations.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <MapPin className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Locations</span>
                      </div>
                      <div className="space-y-1">
                        {concept.locations.slice(0, 2).map((location: any, i: number) => (
                          <div key={i} className="pl-2.5 border-l-2 border-orange-500/50">
                            <p className="text-xs font-semibold text-foreground">{location.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{location.description}</p>
                          </div>
                        ))}
                        {concept.locations.length > 2 && (
                          <p className="text-xs text-muted-foreground italic pl-2.5">
                            +{concept.locations.length - 2} additional locations
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Color Palette */}
                  {concept.color_palette && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Palette className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Color Palette</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(() => {
                          const colors = concept.color_palette.primary_colors || [];
                          return colors.slice(0, 4).map((color: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[9px] px-2 py-0.5">
                              {color}
                            </Badge>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Key Moments (iconic_moments or key_narrative_moments) */}
                  {((concept.iconic_moments && concept.iconic_moments.length > 0) || (concept.key_narrative_moments && concept.key_narrative_moments.length > 0)) && (
                    <div className="mt-auto pt-2.5 border-t border-muted">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Iconic Moments</span>
                      </div>
                      <div className="space-y-1">
                        {(concept.iconic_moments || concept.key_narrative_moments || []).slice(0, 2).map((moment: any, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <Badge variant="outline" className="text-[8px] px-1.5 py-0 font-mono flex-shrink-0">
                              {moment.timestamp}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex-1 line-clamp-1">
                              {moment.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </ScrollArea>

        {/* Continue Button - FIXED AT BOTTOM */}
        <div className="shrink-0 flex flex-col gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t bg-background shadow-lg">
          {/* Mobile: Stack vertically */}
          <div className="flex sm:hidden flex-col gap-3 w-full">
            {selectedConcept && (
              <div className="text-center">
                <p className="text-sm text-green-500 flex items-center justify-center gap-2 font-semibold">
                  <Check className="h-4 w-4" />
                  {selectedConcept.title}
                </p>
              </div>
            )}
            <Button
              size="lg"
              onClick={handleContinue}
              disabled={!selectedConcept || isLoading}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white gap-2 shadow-lg hover:shadow-xl transition-all w-full min-h-[52px] text-base font-semibold disabled:opacity-75"
              data-testid="button-continue-concept"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  {selectedConcept ? 'Generate Music Video' : 'Select a Concept'}
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </div>

          {/* Desktop: Horizontal layout */}
          <div className="hidden sm:flex flex-row justify-between items-center gap-4 w-full">
            <div className="text-sm text-left">
              {selectedConcept ? (
                <div className="space-y-1">
                  <p className="text-green-500 flex items-center gap-2 font-semibold">
                    <Check className="h-4 w-4" />
                    Concept Selected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedConcept.title}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    Select a Concept
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Choose the proposal that best fits your vision
                  </p>
                </div>
              )}
            </div>
            
            <Button
              size="lg"
              onClick={handleContinue}
              disabled={!selectedConcept || isLoading}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white gap-2 shadow-lg hover:shadow-xl transition-all whitespace-nowrap disabled:opacity-75"
              data-testid="button-continue-concept"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Generate Music Video
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
