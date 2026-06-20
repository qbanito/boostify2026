import { useState, useEffect } from "react";
import { logger } from "../../lib/logger";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { 
  ChevronLeft, 
  ChevronRight, 
  ImageIcon, 
  Trash2, 
  PlusCircle, 
  MoveHorizontal,
  ZoomIn,
  Layers,
  Music,
  AlertCircle,
  Play,
  Sparkles,
  Settings2
} from "lucide-react";
import { ShotType, CameraMovementPattern } from "../../lib/professional-editor-types";
import { GSAPVideoPreview } from "./gsap-video-preview";
import { BlurEffect, BrightnessEffect, OpacityEffect, ShadowEffect, ShadowValue } from "../effects";

export interface ImageEffects {
  blur?: number;
  brightness?: number;
  opacity?: number;
  shadow?: ShadowValue;
}

// Tipo para cada elemento de imagen en la secuencia
interface ImageSequenceItem {
  id: string;
  url: string;
  shotType: ShotType;
  duration: number; // duración en segundos
  transitionType?: string;
  transitionDuration?: number;
  effects?: ImageEffects;
  metadata?: {
    movementApplied?: boolean;
    movementPattern?: CameraMovementPattern;
    movementIntensity?: number;
    shotType?: ShotType;
  };
}

// Props del componente
interface ImageSequenceManagerProps {
  images: ImageSequenceItem[];
  onUpdate: (images: ImageSequenceItem[]) => void;
  onGenerateSequence?: () => void;
  onSyncToBeats?: () => void;
  onAddToTimeline?: (images: ImageSequenceItem[]) => void;
  className?: string;
  showControls?: boolean;
}

/**
 * Componente para gestionar secuencias de imágenes en el editor de video musical
 * 
 * Este componente proporciona una interfaz profesional para organizar
 * y gestionar secuencias de imágenes que serán usadas en un video musical,
 * con sincronización de beats y movimientos de cámara.
 */
export function ImageSequenceManager({
  images,
  onUpdate,
  onGenerateSequence,
  onSyncToBeats,
  onAddToTimeline,
  className = "",
  showControls = true
}: ImageSequenceManagerProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [reordering, setReordering] = useState(false);
  const [showGSAPPreview, setShowGSAPPreview] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Función para cambiar el tipo de plano de una imagen
  const changeShotType = (index: number, shotType: ShotType) => {
    const updatedImages = [...images];
    updatedImages[index] = {
      ...updatedImages[index],
      shotType,
      metadata: {
        ...updatedImages[index].metadata,
        shotType
      }
    };
    onUpdate(updatedImages);
  };
  
  // Función para cambiar el tipo de transición
  const changeTransitionType = (index: number, transitionType: string) => {
    const updatedImages = [...images];
    updatedImages[index] = {
      ...updatedImages[index],
      transitionType
    };
    onUpdate(updatedImages);
  };
  
  // Función para aplicar movimiento a una imagen
  const applyMovement = (index: number, movementPattern: CameraMovementPattern) => {
    const updatedImages = [...images];
    updatedImages[index] = {
      ...updatedImages[index],
      metadata: {
        ...updatedImages[index].metadata,
        movementApplied: true,
        movementPattern,
        movementIntensity: 0.5
      }
    };
    onUpdate(updatedImages);
  };

  // Función para actualizar efectos de una imagen
  const updateEffect = (index: number, effectType: keyof ImageEffects, value: any) => {
    const updatedImages = [...images];
    updatedImages[index] = {
      ...updatedImages[index],
      effects: {
        ...updatedImages[index].effects,
        [effectType]: value
      }
    };
    onUpdate(updatedImages);
  };

  // Función para verificar si una imagen tiene efectos aplicados
  const hasEffects = (image: ImageSequenceItem): boolean => {
    return !!(
      image.effects?.blur ||
      image.effects?.brightness !== undefined ||
      image.effects?.opacity !== undefined ||
      image.effects?.shadow
    );
  };
  
  // Función para remover una imagen de la secuencia
  const removeImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    onUpdate(updatedImages);
    if (selectedImageIndex === index) {
      setSelectedImageIndex(-1);
    } else if (selectedImageIndex > index) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };
  
  // Función para mover una imagen en la secuencia
  const moveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    
    const updatedImages = [...images];
    const [movedImage] = updatedImages.splice(fromIndex, 1);
    updatedImages.splice(toIndex, 0, movedImage);
    
    onUpdate(updatedImages);
    setSelectedImageIndex(toIndex);
  };
  
  // Obtener el color de borde según el tipo de plano
  const getShotTypeColor = (shotType: ShotType): string => {
    switch (shotType) {
      case "close-up": return "border-indigo-500";
      case "medium": return "border-green-500";
      case "wide": return "border-amber-500";
      case "transition": return "border-pink-500";
      default: return "border-blue-500";
    }
  };
  
  // Obtener el ícono para el tipo de transición
  const getTransitionIcon = (transitionType: string) => {
    switch (transitionType) {
      case "crossfade": return <Layers className="w-4 h-4" />;
      case "slide": return <MoveHorizontal className="w-4 h-4" />;
      case "zoom": return <ZoomIn className="w-4 h-4" />;
      default: return null;
    }
  };

  // Renderizar contenido del panel de edición (compartido entre móvil y desktop)
  const renderEditPanel = (index: number) => {
    const image = images[index];
    const buttonSize = isMobile ? "default" : "sm";
    const buttonHeight = isMobile ? "h-10" : "h-6";

    return (
      <div className={`p-${isMobile ? '4' : '3'} space-y-${isMobile ? '4' : '3'}`}>
        <h3 className={`font-medium ${isMobile ? 'text-base' : 'text-sm'}`}>
          Ajustes de imagen #{index + 1}
        </h3>
        
        <div className="space-y-2">
          <label className={`${isMobile ? 'text-sm' : 'text-xs'} text-muted-foreground`}>
            Tipo de plano
          </label>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={image.shotType === "close-up" ? "default" : "outline"} 
              size={buttonSize}
              className={`${isMobile ? 'text-sm' : 'text-xs'} ${buttonHeight}`}
              onClick={() => changeShotType(index, "close-up")}
              data-testid="button-shot-closeup"
            >
              Primer plano
            </Button>
            <Button 
              variant={image.shotType === "medium" ? "default" : "outline"} 
              size={buttonSize}
              className={`${isMobile ? 'text-sm' : 'text-xs'} ${buttonHeight}`}
              onClick={() => changeShotType(index, "medium")}
              data-testid="button-shot-medium"
            >
              Medio
            </Button>
            <Button 
              variant={image.shotType === "wide" ? "default" : "outline"} 
              size={buttonSize}
              className={`${isMobile ? 'text-sm' : 'text-xs'} ${buttonHeight}`}
              onClick={() => changeShotType(index, "wide")}
              data-testid="button-shot-wide"
            >
              General
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <label className={`${isMobile ? 'text-sm' : 'text-xs'} text-muted-foreground`}>
            Transición
          </label>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={image.transitionType === "crossfade" ? "default" : "outline"} 
              size={buttonSize}
              className={`${isMobile ? 'text-sm' : 'text-xs'} ${buttonHeight}`}
              onClick={() => changeTransitionType(index, "crossfade")}
              data-testid="button-transition-crossfade"
            >
              <Layers className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} mr-1`} />
              Fundido
            </Button>
            <Button 
              variant={image.transitionType === "slide" ? "default" : "outline"} 
              size={buttonSize}
              className={`${isMobile ? 'text-sm' : 'text-xs'} ${buttonHeight}`}
              onClick={() => changeTransitionType(index, "slide")}
              data-testid="button-transition-slide"
            >
              <MoveHorizontal className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} mr-1`} />
              Deslizar
            </Button>
            <Button 
              variant={image.transitionType === "zoom" ? "default" : "outline"} 
              size={buttonSize}
              className={`${isMobile ? 'text-sm' : 'text-xs'} ${buttonHeight}`}
              onClick={() => changeTransitionType(index, "zoom")}
              data-testid="button-transition-zoom"
            >
              <ZoomIn className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} mr-1`} />
              Zoom
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <label className={`${isMobile ? 'text-sm' : 'text-xs'} text-muted-foreground`}>
            Movimiento de cámara
          </label>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={image.metadata?.movementPattern === "pan-left" ? "default" : "outline"} 
              size={buttonSize}
              className={`${isMobile ? 'text-sm' : 'text-xs'} ${buttonHeight}`}
              onClick={() => applyMovement(index, "pan-left")}
              data-testid="button-movement-pan-left"
            >
              Pan Izq
            </Button>
            <Button 
              variant={image.metadata?.movementPattern === "pan-right" ? "default" : "outline"} 
              size={buttonSize}
              className={`${isMobile ? 'text-sm' : 'text-xs'} ${buttonHeight}`}
              onClick={() => applyMovement(index, "pan-right")}
              data-testid="button-movement-pan-right"
            >
              Pan Der
            </Button>
            <Button 
              variant={image.metadata?.movementPattern === "zoom-in" ? "default" : "outline"} 
              size={buttonSize}
              className={`${isMobile ? 'text-sm' : 'text-xs'} ${buttonHeight}`}
              onClick={() => applyMovement(index, "zoom-in")}
              data-testid="button-movement-zoom-in"
            >
              Zoom In
            </Button>
          </div>
        </div>

        <Separator className="my-3" />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} text-purple-500`} />
            <label className={`${isMobile ? 'text-sm' : 'text-xs'} text-muted-foreground font-semibold`}>
              Efectos Visuales
            </label>
          </div>
          
          <BlurEffect
            value={image.effects?.blur || 0}
            onChange={(value) => updateEffect(index, 'blur', value)}
          />
          
          <BrightnessEffect
            value={image.effects?.brightness || 100}
            onChange={(value) => updateEffect(index, 'brightness', value)}
          />
          
          <OpacityEffect
            value={image.effects?.opacity || 100}
            onChange={(value) => updateEffect(index, 'opacity', value)}
          />
          
          <ShadowEffect
            value={image.effects?.shadow || { x: 0, y: 0, blur: 0, color: '#000000' }}
            onChange={(value) => updateEffect(index, 'shadow', value)}
          />
        </div>
      </div>
    );
  };
  
  // Renderizar la miniatura de una imagen con sus controles
  const renderThumbnail = (image: ImageSequenceItem, index: number) => {
    const isSelected = selectedImageIndex === index;
    
    const handleThumbnailClick = () => {
      if (isMobile) {
        setSelectedImageIndex(index);
        setIsMobileSheetOpen(true);
      } else {
        setSelectedImageIndex(isSelected ? -1 : index);
      }
    };
    
    return (
      <div 
        key={image.id}
        className={`
          relative group border-2 rounded-md overflow-hidden cursor-pointer transition-all flex-shrink-0
          ${isSelected ? 'ring-2 ring-primary scale-105 z-10' : 'hover:scale-105'}
          ${getShotTypeColor(image.shotType)}
        `}
        onClick={handleThumbnailClick}
        data-testid={`thumbnail-${index}`}
      >
        <div className="relative aspect-video w-32 sm:w-40 bg-muted">
          {/* Imagen principal */}
          <img
            src={image.url}
            alt={`Secuencia ${index + 1}`}
            className="w-full h-full object-cover"
          />
          
          {/* Overlay con información */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-1 left-1 right-1 text-white text-xs flex justify-between items-center">
              <span>{image.shotType}</span>
              <span>{image.duration}s</span>
            </div>
          </div>
          
          {/* Índice de la imagen */}
          <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-sm">
            {index + 1}
          </div>
          
          {/* Indicadores de propiedades */}
          <div className="absolute top-1 right-1 flex gap-1">
            {hasEffects(image) && (
              <div className="bg-purple-500 rounded-full p-0.5" title="Efectos visuales aplicados">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            )}
            {image.metadata?.movementApplied && (
              <div className="bg-orange-500 rounded-full p-0.5" title={`Movimiento: ${image.metadata.movementPattern}`}>
                <MoveHorizontal className="w-3 h-3 text-white" />
              </div>
            )}
            {image.transitionType && (
              <div className="bg-pink-500 rounded-full p-0.5" title={`Transición: ${image.transitionType}`}>
                {getTransitionIcon(image.transitionType)}
              </div>
            )}
          </div>
          
          {/* Controles solo visibles cuando está seleccionada o hover */}
          {(isSelected || true) && (
            <div className="absolute -bottom-10 group-hover:bottom-0 left-0 right-0 bg-black/80 p-1 flex justify-center gap-1 transition-all">
              {isMobile && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-white hover:text-cyan-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex(index);
                    setIsMobileSheetOpen(true);
                  }}
                  data-testid={`button-edit-${index}`}
                >
                  <Settings2 className="w-3 h-3" />
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-white hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                data-testid={`button-delete-${index}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon"
                className="h-6 w-6 text-white hover:text-blue-500"
                onClick={(e) => {
                  e.stopPropagation();
                  moveImage(index, index - 1);
                }}
                disabled={index === 0}
                data-testid={`button-move-left-${index}`}
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon"
                className="h-6 w-6 text-white hover:text-blue-500"
                onClick={(e) => {
                  e.stopPropagation();
                  moveImage(index, index + 1);
                }}
                disabled={index === images.length - 1}
                data-testid={`button-move-right-${index}`}
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
        
        {/* Panel de edición lateral en desktop */}
        {!isMobile && isSelected && (
          <div className="absolute left-full top-0 ml-2 w-80 bg-card border rounded-md shadow-lg z-20 max-h-[600px] overflow-y-auto">
            {renderEditPanel(index)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
    <Card className={`border shadow-sm ${className}`}>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center">
            <ImageIcon className="w-5 h-5 mr-2 text-blue-500" />
            Secuencia de Imágenes
            <Badge variant="outline" className="ml-2">
              {images.length} imágenes
            </Badge>
          </div>
          
          {showControls && (
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onGenerateSequence}
                className="h-7 text-xs"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                Generar
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onSyncToBeats}
                className="h-7 text-xs"
                disabled={images.length === 0}
              >
                <Music className="w-3.5 h-3.5 mr-1" />
                Sincronizar con Beats
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <AlertCircle className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm">No hay imágenes en la secuencia.</p>
            <p className="text-xs mt-1">Genera o agrega imágenes para crear una secuencia para tu video musical.</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2 -mx-2 px-2 touch-pan-x">
            <div className="flex gap-3 min-w-min">
              {images.map((image, index) => renderThumbnail(image, index))}
            </div>
          </div>
        )}
      </CardContent>
      
      {showControls && (
        <CardFooter className="flex justify-between py-3 border-t bg-muted/50">
          <div className="text-xs text-muted-foreground">
            {images.length > 0
              ? `Duración total: ${images.reduce((acc, img) => acc + img.duration, 0).toFixed(1)}s`
              : "Agrega imágenes para comenzar"}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGSAPPreview(!showGSAPPreview)}
              disabled={images.length === 0}
              className="h-8 gap-2"
              data-testid="button-gsap-preview"
            >
              <Play className="w-4 h-4" />
              {showGSAPPreview ? 'Ocultar' : 'Preview'} GSAP
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={() => onAddToTimeline?.(images)}
              disabled={images.length === 0}
              className="h-8"
            >
              Agregar a Timeline
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
    
    {/* GSAP Preview Component */}
    {showGSAPPreview && images.length > 0 && (
      <div className="mt-4">
        <GSAPVideoPreview
          scenes={images.map(img => ({
            imageUrl: img.url,
            duration: img.duration,
            transitionType: img.transitionType,
            transitionDuration: img.transitionDuration,
            cameraMovement: img.metadata?.movementPattern as any,
            shotType: img.shotType,
            effects: img.effects
          }))}
          onClose={() => setShowGSAPPreview(false)}
        />
      </div>
    )}

    {/* Sheet móvil para edición de imagen */}
    {isMobile && selectedImageIndex >= 0 && (
      <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Editar Imagen #{selectedImageIndex + 1}
            </SheetTitle>
            <SheetDescription>
              Ajusta el tipo de plano, transiciones, movimientos y efectos visuales
            </SheetDescription>
          </SheetHeader>
          
          {renderEditPanel(selectedImageIndex)}
        </SheetContent>
      </Sheet>
    )}
  </>
  );
}