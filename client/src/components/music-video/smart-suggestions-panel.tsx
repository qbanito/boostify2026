import { Card } from "../ui/card";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Lightbulb, RefreshCw, Wand2, Sparkles, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Suggestion {
  id: string;
  type: 'warning' | 'tip' | 'optimization';
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}

interface SmartSuggestionsPanelProps {
  timelineItems: any[];
  onApplySuggestion?: (suggestionId: string) => void;
}

export function SmartSuggestionsPanel({ timelineItems, onApplySuggestion }: SmartSuggestionsPanelProps) {
  const suggestions: Suggestion[] = [];

  // Detectar clips muy similares
  const similarClipsCount = timelineItems.filter((item, index, arr) => {
    if (index === 0) return false;
    const prevItem = arr[index - 1];
    return item.shotType === prevItem.shotType && 
           item.description?.substring(0, 50) === prevItem.description?.substring(0, 50);
  }).length;

  if (similarClipsCount > 3) {
    suggestions.push({
      id: 'similar-clips',
      type: 'tip',
      title: 'Clips muy similares detectados',
      description: `${similarClipsCount} clips tienen descripciones similares. Agregar más variedad puede mejorar el dinamismo visual.`,
      action: 'Regenerar con variedad'
    });
  }

  // Detectar duración de clips
  const shortClips = timelineItems.filter(item => (item.duration || 0) < 3000).length;
  const longClips = timelineItems.filter(item => (item.duration || 0) > 6000).length;

  if (shortClips > timelineItems.length * 0.7) {
    suggestions.push({
      id: 'too-many-short-clips',
      type: 'warning',
      title: 'Muchos clips cortos',
      description: 'El 70% de tus clips duran menos de 3 segundos. Esto puede hacer el video muy frenético.',
      action: 'Ajustar duraciones'
    });
  }

  if (longClips > timelineItems.length * 0.5) {
    suggestions.push({
      id: 'too-many-long-clips',
      type: 'tip',
      title: 'Clips largos detectados',
      description: 'Algunos clips son muy largos. Considera usar el ritmo de la música para cortes más dinámicos.',
      action: 'Optimizar ritmo'
    });
  }

  // Detectar imágenes no generadas
  const pendingImages = timelineItems.filter(item => !item.generatedImage && !item.firebaseUrl).length;

  if (pendingImages > 0) {
    suggestions.push({
      id: 'pending-images',
      type: 'warning',
      title: `${pendingImages} imágenes pendientes`,
      description: 'Algunas escenas aún no tienen imágenes generadas.',
      action: 'Generar ahora'
    });
  }

  // Detectar videos no generados
  const pendingVideos = timelineItems.filter(item => 
    (item.generatedImage || item.firebaseUrl) && !item.videoUrl
  ).length;

  if (pendingVideos > 0 && timelineItems.some(item => item.generatedImage || item.firebaseUrl)) {
    suggestions.push({
      id: 'pending-videos',
      type: 'tip',
      title: `${pendingVideos} clips listos para video`,
      description: 'Tienes imágenes que pueden convertirse en video.',
      action: 'Generar videos'
    });
  }

  // Sugerencia de optimización general
  if (timelineItems.length > 0 && suggestions.length === 0) {
    suggestions.push({
      id: 'all-good',
      type: 'optimization',
      title: '✨ Todo se ve bien',
      description: 'Tu proyecto está bien balanceado. Considera agregar efectos de transición para darle un toque profesional.',
      action: 'Ver efectos'
    });
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-5 h-5 text-orange-500" />
        <h3 className="text-sm font-semibold text-white">Sugerencias Inteligentes</h3>
        <Badge variant="outline" className="text-xs">
          {suggestions.length}
        </Badge>
      </div>

      <AnimatePresence>
        {suggestions.map((suggestion, index) => (
          <motion.div
            key={suggestion.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`p-4 border ${
              suggestion.type === 'warning' ? 'border-orange-500/50 bg-orange-900/10' :
              suggestion.type === 'tip' ? 'border-blue-500/50 bg-blue-900/10' :
              'border-green-500/50 bg-green-900/10'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {suggestion.type === 'warning' && <Sparkles className="w-4 h-4 text-orange-500" />}
                    {suggestion.type === 'tip' && <Wand2 className="w-4 h-4 text-blue-500" />}
                    {suggestion.type === 'optimization' && <TrendingUp className="w-4 h-4 text-green-500" />}
                    <h4 className="text-sm font-semibold text-white">{suggestion.title}</h4>
                  </div>
                  <p className="text-xs text-white/70">{suggestion.description}</p>
                </div>
                {suggestion.action && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onApplySuggestion?.(suggestion.id)}
                    className="text-xs shrink-0"
                    data-testid={`button-suggestion-${suggestion.id}`}
                  >
                    {suggestion.action}
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
