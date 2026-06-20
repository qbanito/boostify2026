/**
import { logger } from "@/lib/logger";
 * Componente para la galería de resultados finales
 * 
 * Este componente muestra todas las imágenes generadas y permite
 * al usuario descargarlas y compartirlas.
 */

import React, { useState } from 'react';
import { useArtistImageWorkflow } from '../../../services/artist-image-workflow-service';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog';
import { 
  Download, 
  Share2, 
  Instagram, 
  Twitter, 
  Facebook, 
  Copy,
  CheckCircle2,
  ImageIcon
} from 'lucide-react';

export function ResultsGallery() {
  const { generatedImages, artistStyle, referenceImage, tryOnResults } = useArtistImageWorkflow();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Función para descargar una imagen
  const handleDownload = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `artist-image-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Función para copiar la URL de la imagen
  const handleCopyUrl = (imageUrl: string) => {
    navigator.clipboard.writeText(imageUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        logger.error('No se pudo copiar la URL:', err);
      });
  };

  // Obtener un resumen del estilo seleccionado
  const getStyleSummary = (): string => {
    const { genre, vibe, aesthetic, colorPalette } = artistStyle;
    
    const genreText = genre ? {
      'pop': 'Pop',
      'rock': 'Rock',
      'electronic': 'Electrónica',
      'hip-hop': 'Hip Hop',
      'r&b': 'R&B',
      'classical': 'Clásica',
      'jazz': 'Jazz',
      'indie': 'Indie',
      'folk': 'Folk',
      'metal': 'Metal'
    }[genre] || genre : '';
    
    const vibeText = vibe ? {
      'energetic': 'Energético',
      'chill': 'Relajado',
      'melancholic': 'Melancólico',
      'playful': 'Juguetón',
      'intense': 'Intenso',
      'elegant': 'Elegante',
      'dreamy': 'Soñador',
      'rebellious': 'Rebelde'
    }[vibe] || vibe : '';
    
    return [genreText, vibeText].filter(Boolean).join(' • ');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Resultados finales</h2>
        <p className="text-muted-foreground mb-4">
          Aquí puedes ver, descargar y compartir tus imágenes artísticas generadas.
        </p>
      </div>

      {/* Resumen del proceso */}
      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <h3 className="font-bold text-lg mb-4">Resumen de tu imagen artística</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                <span>Estilo seleccionado</span>
              </div>
              <p className="text-sm">{getStyleSummary() || 'No definido'}</p>
            </div>
            <div className="space-y-2">
              <div className="font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                <span>Imágenes generadas</span>
              </div>
              <p className="text-sm">{generatedImages.length} imagen(es)</p>
            </div>
            <div className="space-y-2">
              <div className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Proceso completado</span>
              </div>
              <p className="text-sm">Todas las etapas finalizadas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Galería de imágenes */}
      <div>
        <h3 className="font-bold text-lg mb-4">Galería de imágenes</h3>
        
        {generatedImages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {generatedImages.map((image, index) => (
              <Card key={index} className="overflow-hidden group">
                <div className="relative">
                  <img 
                    src={image} 
                    alt={`Imagen generada ${index + 1}`}
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => handleDownload(image)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Descargar
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => setSelectedImage(image)}
                        >
                          <Share2 className="h-4 w-4 mr-1" />
                          Compartir
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  </div>
                </div>
                <CardContent className="p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Imagen artística {index + 1}</span>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleDownload(image)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setSelectedImage(image)}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-muted/30 rounded-lg p-6 text-center">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No hay imágenes generadas todavía.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Completa los pasos anteriores para generar tus imágenes artísticas.
            </p>
          </div>
        )}
      </div>

      {/* Proceso completo */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-bold text-lg mb-4">Proceso completo</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="font-medium mb-2">Imagen de referencia</div>
              {referenceImage ? (
                <div className="rounded-lg overflow-hidden border h-40">
                  <img 
                    src={referenceImage}
                    alt="Referencia"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="bg-muted rounded-lg h-40 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No disponible</p>
                </div>
              )}
            </div>
            
            <div>
              <div className="font-medium mb-2">Resultado try-on</div>
              {tryOnResults.resultImage ? (
                <div className="rounded-lg overflow-hidden border h-40">
                  <img 
                    src={tryOnResults.resultImage}
                    alt="Try-on resultado"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="bg-muted rounded-lg h-40 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No disponible</p>
                </div>
              )}
            </div>
            
            <div>
              <div className="font-medium mb-2">Imagen final</div>
              {generatedImages.length > 0 ? (
                <div className="rounded-lg overflow-hidden border h-40">
                  <img 
                    src={generatedImages[0]}
                    alt="Imagen final"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="bg-muted rounded-lg h-40 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No disponible</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo para compartir */}
      <Dialog>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartir imagen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedImage && (
              <div className="flex justify-center mb-4">
                <img 
                  src={selectedImage} 
                  alt="Imagen para compartir" 
                  className="max-h-60 rounded-lg"
                />
              </div>
            )}
            
            <div className="flex flex-col gap-3">
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="icon" className="h-10 w-10">
                  <Instagram className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="icon" className="h-10 w-10">
                  <Twitter className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="icon" className="h-10 w-10">
                  <Facebook className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="grid flex-1 gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <div>URL de la imagen</div>
                    {copied && <span className="text-green-500 text-xs">¡Copiado!</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      defaultValue={selectedImage || ''}
                      readOnly
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => selectedImage && handleCopyUrl(selectedImage)}
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}