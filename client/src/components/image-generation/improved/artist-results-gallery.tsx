/**
import { logger } from "@/lib/logger";
 * Artist Results Gallery Component
 * 
 * Este componente muestra todos los resultados guardados del proceso de creación
 * de imagen de artista y ofrece opciones para su descarga y uso.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { 
  Download, 
  Image as ImageIcon, 
  Share2, 
  Star,
  Trash2,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../../hooks/use-toast';
import { useArtistImageWorkflow } from '../../../services/artist-image-workflow-service';

interface ArtistResultsGalleryProps {
  language?: 'en' | 'es';
  onRestart?: () => void;
}

export function ArtistResultsGallery({ language = 'en', onRestart }: ArtistResultsGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Obtener estado global del workflow
  const { 
    referenceImage,
    styleImages,
    tryOnResults,
    generatedImages,
    resetWorkflow,
    setCurrentStep
  } = useArtistImageWorkflow();
  
  // Para la versión en español
  const translations = {
    en: {
      title: 'Your Artist Image Results',
      description: 'All the images created during your artist image design process',
      referenceSectionTitle: 'Reference Images',
      styleSectionTitle: 'Style Visualizations',
      tryOnSectionTitle: 'Virtual Try-On Results',
      finalSectionTitle: 'Final Artist Images',
      downloadButton: 'Download',
      shareButton: 'Share',
      deleteButton: 'Delete',
      restartButton: 'Start New Process',
      backButton: 'Back to Home',
      noImagesText: 'No images available in this category',
      downloadSuccess: 'Image downloaded successfully',
      shareSuccess: 'Image shared to clipboard',
      deleteSuccess: 'Image deleted successfully',
    },
    es: {
      title: 'Resultados de tu Imagen de Artista',
      description: 'Todas las imágenes creadas durante tu proceso de diseño de imagen de artista',
      referenceSectionTitle: 'Imágenes de Referencia',
      styleSectionTitle: 'Visualizaciones de Estilo',
      tryOnSectionTitle: 'Resultados de Prueba Virtual',
      finalSectionTitle: 'Imágenes Finales de Artista',
      downloadButton: 'Descargar',
      shareButton: 'Compartir',
      deleteButton: 'Eliminar',
      restartButton: 'Iniciar Nuevo Proceso',
      backButton: 'Volver al Inicio',
      noImagesText: 'No hay imágenes disponibles en esta categoría',
      downloadSuccess: 'Imagen descargada exitosamente',
      shareSuccess: 'Imagen compartida al portapapeles',
      deleteSuccess: 'Imagen eliminada exitosamente',
    }
  };
  
  const t = translations[language];
  
  // Descargar una imagen
  const handleDownloadImage = (imageUrl: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `artist-image-${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Success",
      description: t.downloadSuccess,
    });
  };
  
  // Compartir una imagen (copiar al portapapeles)
  const handleShareImage = (imageUrl: string) => {
    // En un entorno real, esto podría ser más sofisticado
    navigator.clipboard.writeText(imageUrl).then(() => {
      toast({
        title: "Success",
        description: t.shareSuccess,
      });
    }).catch((err) => {
      logger.error('Error sharing image URL:', err);
      toast({
        title: "Error",
        description: "Could not copy image URL to clipboard",
        variant: "destructive",
      });
    });
  };
  
  // Reiniciar todo el proceso
  const handleRestartProcess = () => {
    resetWorkflow();
    setCurrentStep('upload');
    if (onRestart) {
      onRestart();
    }
  };
  
  // Volver al inicio (simulado para demostración)
  const handleBackToHome = () => {
    // En la implementación real, esto redirigiría a la página de inicio
    // window.location.href = '/';
    // Para esta demostración, solo mostramos un toast
    toast({
      title: "Info",
      description: language === 'en' ? "Navigate back to home page" : "Navegando de vuelta a la página de inicio",
    });
  };
  
  // Verificar si hay imágenes en cada categoría
  const hasReferenceImages = !!referenceImage;
  const hasStyleImages = styleImages.length > 0;
  const hasTryOnResults = !!tryOnResults.resultImage;
  const hasFinalImages = generatedImages.length > 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-orange-500/20 bg-black/40 backdrop-blur-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-orange-500" />
            {t.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* Sección de imágenes de referencia */}
            {hasReferenceImages && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">{t.referenceSectionTitle}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {referenceImage && (
                    <GalleryItem 
                      imageUrl={referenceImage}
                      onSelect={() => setSelectedImage(referenceImage)}
                      onDownload={() => handleDownloadImage(referenceImage)}
                      onShare={() => handleShareImage(referenceImage)}
                      language={language}
                    />
                  )}
                </div>
              </div>
            )}
            
            {/* Sección de imágenes de estilo */}
            {hasStyleImages && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">{t.styleSectionTitle}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {styleImages.map((imageUrl, index) => (
                    <GalleryItem 
                      key={`style-${index}`}
                      imageUrl={imageUrl}
                      onSelect={() => setSelectedImage(imageUrl)}
                      onDownload={() => handleDownloadImage(imageUrl)}
                      onShare={() => handleShareImage(imageUrl)}
                      language={language}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Sección de resultados de Try-On */}
            {hasTryOnResults && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">{t.tryOnSectionTitle}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {tryOnResults.resultImage && (
                    <GalleryItem 
                      imageUrl={tryOnResults.resultImage}
                      onSelect={() => setSelectedImage(tryOnResults.resultImage!)}
                      onDownload={() => handleDownloadImage(tryOnResults.resultImage!)}
                      onShare={() => handleShareImage(tryOnResults.resultImage!)}
                      language={language}
                    />
                  )}
                </div>
              </div>
            )}
            
            {/* Sección de imágenes finales */}
            {hasFinalImages && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">{t.finalSectionTitle}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {generatedImages.map((imageUrl, index) => (
                    <GalleryItem 
                      key={`final-${index}`}
                      imageUrl={imageUrl}
                      onSelect={() => setSelectedImage(imageUrl)}
                      onDownload={() => handleDownloadImage(imageUrl)}
                      onShare={() => handleShareImage(imageUrl)}
                      language={language}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Botones de acción global */}
            <div className="flex flex-wrap gap-4 justify-center mt-8 pt-4 border-t border-primary/10">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={handleRestartProcess}
              >
                <RefreshCw className="h-4 w-4" />
                {t.restartButton}
              </Button>
              
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={handleBackToHome}
              >
                <ArrowLeft className="h-4 w-4" />
                {t.backButton}
              </Button>
            </div>
          </div>
          
          {/* Vista ampliada de imagen seleccionada */}
          <AnimatePresence>
            {selectedImage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                onClick={() => setSelectedImage(null)}
              >
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.8 }}
                  className="max-w-3xl max-h-[90vh] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img 
                    src={selectedImage} 
                    alt="Selected Preview" 
                    className="w-full h-auto rounded-lg"
                  />
                  <div className="flex justify-center gap-3 mt-4">
                    <Button 
                      onClick={() => handleDownloadImage(selectedImage)}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      {t.downloadButton}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleShareImage(selectedImage)}
                      className="gap-2"
                    >
                      <Share2 className="h-4 w-4" />
                      {t.shareButton}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedImage(null)}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t.deleteButton}
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Componente de elemento de galería individual
interface GalleryItemProps {
  imageUrl: string;
  onSelect: () => void;
  onDownload: () => void;
  onShare: () => void;
  language: 'en' | 'es';
}

function GalleryItem({ imageUrl, onSelect, onDownload, onShare, language }: GalleryItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const t = {
    en: {
      view: 'View',
      download: 'Download',
      share: 'Share',
    },
    es: {
      view: 'Ver',
      download: 'Descargar',
      share: 'Compartir',
    }
  };
  
  return (
    <div 
      className="relative rounded-md overflow-hidden border border-primary/20 aspect-square cursor-pointer group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img 
        src={imageUrl} 
        alt="Artist Image" 
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
      
      {/* Overlay con acciones */}
      <div 
        className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Button 
          variant="secondary" 
          size="sm" 
          className="w-3/4"
          onClick={onSelect}
        >
          <ImageIcon className="h-4 w-4 mr-2" />
          {t[language].view}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-3/4"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          {t[language].download}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-3/4"
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
        >
          <Share2 className="h-4 w-4 mr-2" />
          {t[language].share}
        </Button>
      </div>
    </div>
  );
}

export default ArtistResultsGallery;