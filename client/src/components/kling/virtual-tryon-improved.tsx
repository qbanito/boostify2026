/**
import { logger } from "@/lib/logger";
 * Componente mejorado para Virtual Try-On
 * 
 * Este componente permite a los usuarios probar virtualmente prendas de vestir
 * sobre su imagen de referencia utilizando la API de Kling.
 */

import React, { useState, useEffect } from 'react';
import { useArtistImageWorkflow } from '../../services/artist-image-workflow-service';
import { klingService, TryOnResult } from '../../services/kling/kling-service';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Shirt, Image, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface VirtualTryonImprovedProps {
  onComplete?: () => void;
}

// Prendas predefinidas para el try-on
const predefinedGarments = [
  {
    id: 'jacket1',
    name: 'Chaqueta de Cuero',
    image: 'https://source.unsplash.com/random/300x400/?leather,jacket',
    style: 'Rock/Alternativo'
  },
  {
    id: 'shirt1',
    name: 'Camisa Estampada',
    image: 'https://source.unsplash.com/random/300x400/?printed,shirt',
    style: 'Pop/Indie'
  },
  {
    id: 'jacket2',
    name: 'Blazer Formal',
    image: 'https://source.unsplash.com/random/300x400/?blazer',
    style: 'Clásico/Elegante'
  },
  {
    id: 'shirt2',
    name: 'Camiseta Gráfica',
    image: 'https://source.unsplash.com/random/300x400/?graphic,tshirt',
    style: 'Urbano/Hip-Hop'
  },
  {
    id: 'jacket3',
    name: 'Chaqueta Deportiva',
    image: 'https://source.unsplash.com/random/300x400/?sports,jacket',
    style: 'Deportivo/Casual'
  },
  {
    id: 'shirt3',
    name: 'Hoodie Oversized',
    image: 'https://source.unsplash.com/random/300x400/?hoodie',
    style: 'Urbano/Contemporáneo'
  }
];

export function VirtualTryonImproved({ onComplete }: VirtualTryonImprovedProps) {
  const { referenceImage, tryOnResults, updateTryOnData } = useArtistImageWorkflow();
  
  // Estados locales
  const [selectedGarment, setSelectedGarment] = useState<string | null>(null);
  const [garmentImage, setGarmentImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [tryOnStatus, setTryOnStatus] = useState<TryOnResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('predefined');
  
  // Efecto para polling cuando hay un proceso activo
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (currentTaskId && isProcessing) {
      intervalId = setInterval(async () => {
        try {
          const result = await klingService.checkTryOnStatus(currentTaskId);
          setTryOnStatus(result);
          
          if (result.status === 'completed') {
            setIsProcessing(false);
            if (result.resultImage) {
              updateTryOnData({
                resultImage: result.resultImage
              });
            }
          } else if (result.status === 'failed') {
            setIsProcessing(false);
            setError(result.errorMessage || 'Ocurrió un error al procesar la imagen');
          }
        } catch (err) {
          logger.error('Error verificando el estado del try-on:', err);
          setIsProcessing(false);
          setError('Error al verificar el estado del proceso');
        }
      }, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentTaskId, isProcessing]);

  // Iniciar el proceso de try-on
  const startTryOn = async () => {
    if (!referenceImage || !garmentImage) {
      setError('Se necesitan ambas imágenes para continuar');
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      // Iniciar el proceso
      const result = await klingService.startTryOn(referenceImage, garmentImage);
      
      if (result.success && result.taskId) {
        setCurrentTaskId(result.taskId);
        setTryOnStatus(result);
        updateTryOnData({
          modelImage: referenceImage,
          clothingImage: garmentImage,
          taskId: result.taskId
        });
      } else {
        setIsProcessing(false);
        setError(result.errorMessage || 'No se pudo iniciar el proceso');
      }
    } catch (err: any) {
      logger.error('Error en el try-on:', err);
      setIsProcessing(false);
      setError(err.message || 'Error al procesar las imágenes');
    }
  };

  // Seleccionar una prenda predefinida
  const handleSelectGarment = (garment: any) => {
    setSelectedGarment(garment.id);
    setGarmentImage(garment.image);
  };

  // Subir una imagen de prenda personalizada
  const handleCustomGarmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Validar que sea una imagen
      if (!file.type.match('image.*')) {
        setError('Por favor, sube un archivo de imagen válido');
        return;
      }
      
      // Leer como Data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setSelectedGarment('custom');
          setGarmentImage(result);
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Manejar el botón continuar
  const handleContinue = () => {
    if (onComplete) {
      onComplete();
    }
  };

  // Reiniciar el proceso
  const handleReset = () => {
    setSelectedGarment(null);
    setGarmentImage(null);
    setIsProcessing(false);
    setCurrentTaskId(null);
    setTryOnStatus(null);
    setError(null);
    updateTryOnData({
      modelImage: null,
      clothingImage: null,
      taskId: null,
      resultImage: null
    });
  };

  // Renderizar el estado del proceso
  const renderProcessingStatus = () => {
    if (!isProcessing && !tryOnStatus) return null;
    
    const progress = tryOnStatus?.progress || 0;
    const status = tryOnStatus?.status || 'pending';
    
    let statusMessage = 'Procesando...';
    if (status === 'processing') statusMessage = 'Generando imagen...';
    if (status === 'completed') statusMessage = '¡Proceso completado!';
    if (status === 'failed') statusMessage = 'Error en el proceso';
    
    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{statusMessage}</span>
          <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Prueba virtual de vestuario</h2>
        <p className="text-muted-foreground mb-4">
          Selecciona o sube prendas para ver cómo lucirían con tu estilo artístico.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Columna izquierda: Selección de prendas */}
        <div>
          <Tabs defaultValue="predefined" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="predefined">Prendas predefinidas</TabsTrigger>
              <TabsTrigger value="custom">Subir prenda</TabsTrigger>
            </TabsList>
            
            <TabsContent value="predefined" className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                {predefinedGarments.map((garment) => (
                  <Card 
                    key={garment.id}
                    className={`overflow-hidden cursor-pointer transition-all hover:shadow ${
                      selectedGarment === garment.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleSelectGarment(garment)}
                  >
                    <div className="relative h-40">
                      <img 
                        src={garment.image} 
                        alt={garment.name}
                        className="w-full h-full object-cover"
                      />
                      {selectedGarment === garment.id && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h4 className="font-medium text-sm">{garment.name}</h4>
                      <p className="text-xs text-muted-foreground">{garment.style}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="custom" className="mt-4">
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50"
                onClick={() => document.getElementById('custom-garment-upload')?.click()}
              >
                <input
                  type="file"
                  id="custom-garment-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleCustomGarmentUpload}
                />
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 flex items-center justify-center rounded-full bg-muted mb-4">
                    <Shirt className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium mb-1">
                    Haz clic para subir una prenda
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    JPG, PNG o GIF (máx. 10MB)
                  </p>
                </div>
              </div>
              
              {garmentImage && activeTab === 'custom' && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Prenda seleccionada</h4>
                  <div className="rounded-lg overflow-hidden border w-full max-w-[300px]">
                    <img 
                      src={garmentImage} 
                      alt="Prenda personalizada" 
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="mt-6">
            <Button
              disabled={!garmentImage || isProcessing}
              onClick={startTryOn}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>Probar prenda</>
              )}
            </Button>
          </div>
          
          {renderProcessingStatus()}
        </div>
        
        {/* Columna derecha: Vista previa y resultados */}
        <div className="space-y-6">
          {/* Imagen de referencia */}
          {referenceImage && (
            <div>
              <Label className="mb-2 block">Tu foto de referencia</Label>
              <div className="rounded-lg overflow-hidden border w-full max-w-[300px]">
                <img 
                  src={referenceImage} 
                  alt="Referencia" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          )}
          
          {/* Resultado del try-on */}
          {(tryOnResults.resultImage || tryOnStatus?.resultImage) && (
            <div>
              <Label className="mb-2 block">Resultado del try-on</Label>
              <div className="rounded-lg overflow-hidden border w-full max-w-[300px]">
                <img 
                  src={tryOnResults.resultImage || tryOnStatus?.resultImage} 
                  alt="Resultado try-on" 
                  className="w-full h-auto object-cover"
                />
              </div>
              
              <div className="mt-4 flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleReset}
                >
                  Probar otra prenda
                </Button>
                <Button 
                  size="sm"
                  onClick={handleContinue}
                >
                  Usar esta imagen
                </Button>
              </div>
            </div>
          )}
          
          {/* Consejos */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold mb-2">Consejos para Virtual Try-On</h3>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 flex-shrink-0 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                    <Image className="h-3 w-3 text-primary" />
                  </div>
                  <span>Usa imágenes de prendas con fondo plano o transparente para mejores resultados.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 flex-shrink-0 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                    <Image className="h-3 w-3 text-primary" />
                  </div>
                  <span>Las prendas que coinciden con tu estilo artístico darán resultados más coherentes.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 flex-shrink-0 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                    <Image className="h-3 w-3 text-primary" />
                  </div>
                  <span>Puedes probar varias prendas hasta encontrar la que mejor se adapte a tu estilo.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Botones de navegación */}
      <div className="flex justify-end mt-6">
        <Button
          onClick={handleContinue}
          disabled={!tryOnResults.resultImage && !tryOnStatus?.resultImage}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}