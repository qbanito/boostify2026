import { motion, AnimatePresence } from "framer-motion";
import { Check, ImageIcon, Sparkles } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
}

interface SequentialImageGalleryProps {
  images: GeneratedImage[];
  currentPrompt?: string;
  total: number;
}

/**
 * Galería secuencial que muestra las imágenes una por una de forma fluida
 * La imagen actual se muestra grande, las anteriores se van apilando abajo
 */
export function SequentialImageGallery({ 
  images, 
  currentPrompt,
  total 
}: SequentialImageGalleryProps) {
  // La imagen más reciente (última generada)
  const latestImage = images[images.length - 1];
  // Las 3 imágenes anteriores para mostrar en miniatura
  const previousImages = images.slice(-4, -1).reverse();

  return (
    <div className="space-y-4">
      {/* Header con contador */}
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-orange-400 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          {images.length > 0 ? 'Visuales Creados' : 'Preparando generación...'}
        </h3>
        <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-500/30">
          {images.length} / {total}
        </Badge>
      </div>

      {images.length > 0 ? (
        <div className="space-y-4">
          {/* Imagen principal - La más reciente */}
          <AnimatePresence mode="wait">
            {latestImage && (
              <motion.div
                key={latestImage.id}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ 
                  type: "spring",
                  stiffness: 200,
                  damping: 25,
                  duration: 0.6
                }}
                className="relative"
              >
                {/* Imagen grande */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border-2 border-orange-500/40 shadow-2xl shadow-orange-500/20">
                  <img
                    src={latestImage.url}
                    alt="Latest generated scene"
                    className="w-full h-full object-cover"
                    data-testid={`featured-image-${latestImage.id}`}
                  />
                  
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Badge de "Nueva" */}
                  <motion.div 
                    className="absolute top-3 left-3"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3, type: "spring" }}
                  >
                    <Badge className="bg-orange-500 text-white shadow-lg">
                      ✨ Nueva
                    </Badge>
                  </motion.div>

                  {/* Número de imagen */}
                  <motion.div 
                    className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/20"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    <span className="text-sm font-bold text-white">#{images.length}</span>
                  </motion.div>

                  {/* Prompt de la imagen */}
                  <motion.div 
                    className="absolute bottom-0 left-0 right-0 p-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <p className="text-xs sm:text-sm text-white/90 line-clamp-2 font-medium">
                      {latestImage.prompt}
                    </p>
                  </motion.div>

                  {/* Checkmark animado */}
                  <motion.div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-500 rounded-full p-3 shadow-xl"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: [0, 1.2, 1],
                      opacity: [0, 1, 0] 
                    }}
                    transition={{ 
                      duration: 1,
                      times: [0, 0.6, 1],
                      delay: 0.1
                    }}
                  >
                    <Check className="w-8 h-8 text-white" />
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Imágenes anteriores en miniatura - Solo las últimas 3 */}
          {previousImages.length > 0 && (
            <motion.div 
              className="space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-xs text-white/50 font-medium">Anteriores:</p>
              <div className="grid grid-cols-3 gap-2">
                {previousImages.map((img, index) => (
                  <motion.div
                    key={img.id}
                    className="relative aspect-video rounded-lg overflow-hidden bg-zinc-800 border border-white/10 group cursor-pointer hover:border-orange-500/50 transition-all"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                  >
                    <img
                      src={img.url}
                      alt={`Previous ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay al hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-[10px] text-white/90 p-2 text-center line-clamp-2">
                        {img.prompt}
                      </p>
                    </div>

                    {/* Número */}
                    <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1.5 py-0.5">
                      <span className="text-[10px] text-white">#{images.length - previousImages.length + index}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        // Estado vacío - Esperando primera imagen
        <div className="border-2 border-dashed border-orange-500/30 rounded-xl p-12 text-center">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <ImageIcon className="w-16 h-16 text-orange-400/50 mx-auto mb-4" />
          </motion.div>
          <p className="text-sm text-white/60 font-medium">
            La primera imagen aparecerá aquí en unos segundos...
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full bg-orange-500",
              "animate-pulse"
            )} style={{ animationDelay: '0ms' }} />
            <div className={cn(
              "w-2 h-2 rounded-full bg-orange-500",
              "animate-pulse"
            )} style={{ animationDelay: '150ms' }} />
            <div className={cn(
              "w-2 h-2 rounded-full bg-orange-500",
              "animate-pulse"
            )} style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Prompt actual que se está generando */}
      {currentPrompt && images.length < total && (
        <motion.div
          className="bg-zinc-800/50 border border-orange-500/20 rounded-lg p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          key={currentPrompt}
        >
          <div className="flex items-start gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-orange-400/60 mb-1 font-medium">Generando ahora:</p>
              <p className="text-sm text-white/90 line-clamp-2">
                {currentPrompt}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Mensaje motivacional final */}
      {images.length === total && images.length > 0 && (
        <motion.div
          className="text-center p-4 bg-green-900/20 border border-green-500/30 rounded-lg"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="text-sm text-green-400 font-semibold">
            🎉 ¡Todas las imágenes generadas exitosamente!
          </p>
        </motion.div>
      )}
    </div>
  );
}
