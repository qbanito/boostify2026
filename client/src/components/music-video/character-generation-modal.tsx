import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logger } from "../../lib/logger";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, User, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CharacterGenerationModalProps {
  open: boolean;
  stage: string;
  progress: number;
  characterImage?: string | null;
}

export function CharacterGenerationModal({
  open,
  stage,
  progress,
  characterImage
}: CharacterGenerationModalProps) {
  const stages = [
    { name: "Analizando rasgos faciales...", icon: User, min: 0, max: 20 },
    { name: "Optimizando prompt de generación...", icon: Sparkles, min: 20, max: 30 },
    { name: "Generando personaje profesional...", icon: Sparkles, min: 30, max: 95 },
    { name: "Finalizando...", icon: CheckCircle2, min: 95, max: 100 }
  ];

  const currentStage = stages.find(s => progress >= s.min && progress <= s.max) || stages[0];
  const StageIcon = currentStage.icon;

  return (
    <Dialog open={open} modal={true}>
      <DialogContent 
        className="max-w-2xl bg-gradient-to-br from-background via-background to-purple-950/20"
        data-testid="modal-character-generation"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl md:text-3xl font-bold text-center flex items-center justify-center gap-3">
            <User className="h-7 w-7 md:h-8 md:w-8 text-purple-500" />
            Generando tu Personaje
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <StageIcon className={cn(
                  "h-5 w-5",
                  progress < 100 ? "text-purple-500 animate-pulse" : "text-green-500"
                )} />
                <span className="font-medium text-muted-foreground">{stage || currentStage.name}</span>
              </div>
              <span className="font-bold text-purple-500">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {/* Stage Indicators */}
          <div className="grid grid-cols-4 gap-2">
            {stages.map((s, i) => {
              const isActive = progress >= s.min;
              const isCurrent = progress >= s.min && progress <= s.max;
              const Icon = s.icon;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all",
                    isCurrent && "border-purple-500 bg-purple-500/10",
                    isActive && !isCurrent && "border-green-500/50 bg-green-500/5",
                    !isActive && "border-muted bg-muted/30"
                  )}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icon className={cn(
                      "h-5 w-5",
                      isCurrent && "text-purple-500 animate-pulse",
                      isActive && !isCurrent && "text-green-500",
                      !isActive && "text-muted-foreground/50"
                    )} />
                    <span className={cn(
                      "text-[10px] text-center leading-tight",
                      isActive ? "text-foreground font-medium" : "text-muted-foreground/50"
                    )}>
                      {s.name.split('...')[0]}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Character Preview */}
          <AnimatePresence mode="wait">
            {characterImage ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative overflow-hidden rounded-xl border-2 border-green-500 shadow-2xl"
              >
                <img 
                  src={characterImage} 
                  alt="Master Character Generated"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Completado
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative h-64 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl border-2 border-dashed border-purple-500/30 flex items-center justify-center"
              >
                <div className="text-center space-y-3">
                  <Loader2 className="h-12 w-12 text-purple-500 animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Creando un personaje profesional basado en tus fotos...
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Info */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Mejorando tu personaje con IA</p>
                <p className="text-xs text-muted-foreground">
                  Estamos analizando tus fotos para crear un personaje de calidad profesional que se usará en todo tu video musical.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
