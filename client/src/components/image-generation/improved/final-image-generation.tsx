/**
import { logger } from "@/lib/logger";
 * Componente para la generación final de imágenes artísticas
 * 
 * Este componente utiliza toda la información recopilada en los pasos anteriores
 * para generar las imágenes finales del artista con su estilo personalizado.
 */

import React, { useState, useEffect } from 'react';
import { useArtistImageWorkflow } from '../../../services/artist-image-workflow-service';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Progress } from '../../ui/progress';
import { Card, CardContent } from '../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import axios from 'axios';
import { Wand2, Loader2, RefreshCw, AlertCircle, Check } from 'lucide-react';

interface FinalImageGenerationProps {
  onComplete?: () => void;
}

export function FinalImageGeneration({ onComplete }: FinalImageGenerationProps) {
  const { 
    referenceImage, 
    artistStyle, 
    tryOnResults,
    addGeneratedImage,
    clearGeneratedImages
  } = useArtistImageWorkflow();
  
  // Estados locales
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<{
    taskId: string;
    progress: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  } | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('automatic');

  // Construir un prompt basado en el estilo seleccionado por el usuario
  const buildStylePrompt = (): string => {
    const { genre, vibe, aesthetic, colorPalette } = artistStyle;
    
    let basePrompt = 'professional portrait of a';
    
    // Añadir género musical
    if (genre) {
      const genreMap: Record<string, string> = {
        'pop': 'pop music',
        'rock': 'rock',
        'electronic': 'electronic music',
        'hip-hop': 'hip hop',
        'r&b': 'R&B',
        'classical': 'classical music',
        'jazz': 'jazz',
        'indie': 'indie music',
        'folk': 'folk music',
        'metal': 'metal music'
      };
      basePrompt += ` ${genreMap[genre] || genre} artist`;
    } else {
      basePrompt += ' musician';
    }
    
    // Añadir vibra/sentimiento
    if (vibe) {
      const vibeMap: Record<string, string> = {
        'energetic': 'with energetic expression',
        'chill': 'with relaxed demeanor',
        'melancholic': 'with thoughtful melancholic expression',
        'playful': 'with playful attitude',
        'intense': 'with intense expression',
        'elegant': 'with elegant pose',
        'dreamy': 'with dreamy gaze',
        'rebellious': 'with rebellious attitude'
      };
      basePrompt += ` ${vibeMap[vibe] || vibe}`;
    }
    
    // Añadir estética
    if (aesthetic) {
      const aestheticMap: Record<string, string> = {
        'minimalist': 'in minimalist style',
        'retro': 'with retro aesthetic',
        'futuristic': 'with futuristic elements',
        'vintage': 'with vintage look',
        'edgy': 'with edgy avant-garde style',
        'bohemian': 'with bohemian aesthetic',
        'artistic': 'with artistic composition',
        'professional': 'with professional studio look'
      };
      basePrompt += ` ${aestheticMap[aesthetic] || aesthetic}`;
    }
    
    // Añadir paleta de colores
    if (colorPalette) {
      const colorMap: Record<string, string> = {
        'vibrant': 'using vibrant colorful palette',
        'moody': 'with moody dark color tones',
        'warm': 'with warm color palette',
        'cool': 'with cool blue tones',
        'neutral': 'using neutral color palette',
        'pastel': 'with soft pastel colors'
      };
      basePrompt += ` ${colorMap[colorPalette] || colorPalette}`;
    }
    
    // Añadir calidad general
    basePrompt += ', high quality, detailed studio photograph';
    
    return basePrompt;
  };

  // Generar un prompt negativo para mejorar la calidad
  const getNegativePrompt = (): string => {
    return 'deformed, bad anatomy, disfigured, poorly drawn face, mutation, mutated, extra limb, missing limb, bad lighting';
  };

  // Iniciar la generación de imagen
  const startImageGeneration = async () => {
    setIsGenerating(true);
    setError(null);
    setResultImage(null);
    
    try {
      // Construir el prompt basado en el estilo o usar el personalizado
      const prompt = activeTab === 'automatic' 
        ? buildStylePrompt() 
        : customPrompt || buildStylePrompt();
      
      const negativePrompt = getNegativePrompt();
      
      // Llamar a la API para generar la imagen (usando Flux)
      const response = await axios.post('/api/flux/generate-image', {
        prompt,
        negativePrompt,
        steps: 28,
        guidance_scale: 2.5,
        width: 512,
        height: 512,
        model: "Qubico/flux1-dev",
        taskType: "txt2img"
      });
      
      if (response.data.success && response.data.taskId) {
        // Iniciar polling para verificar el estado
        setGenerationStatus({
          taskId: response.data.taskId,
          progress: 0,
          status: 'pending'
        });
        
        // Iniciar verificación de estado
        checkGenerationStatus(response.data.taskId);
      } else {
        setIsGenerating(false);
        setError('No se pudo iniciar la generación');
      }
    } catch (err: any) {
      logger.error('Error al generar imagen:', err);
      setIsGenerating(false);
      setError(err.message || 'Error al generar la imagen');
    }
  };

  // Verificar el estado de la generación
  const checkGenerationStatus = async (taskId: string) => {
    try {
      const response = await axios.get('/api/flux/status', {
        params: { taskId }
      });
      
      if (response.data && response.data.task_id) {
        const status = response.data.status;
        const progress = response.data.progress || 0;
        
        setGenerationStatus({
          taskId,
          progress,
          status: status as any
        });
        
        if (status === 'completed') {
          setIsGenerating(false);
          if (response.data.output && response.data.output.images && response.data.output.images.length > 0) {
            const imageUrl = response.data.output.images[0];
            setResultImage(imageUrl);
            addGeneratedImage(imageUrl);
          }
        } else if (status === 'failed') {
          setIsGenerating(false);
          setError('La generación de la imagen falló');
        } else {
          // Continuar verificando
          setTimeout(() => checkGenerationStatus(taskId), 2000);
        }
      }
    } catch (err) {
      logger.error('Error al verificar estado:', err);
      setIsGenerating(false);
      setError('Error al verificar el estado de la generación');
    }
  };

  // Manejar el botón continuar
  const handleContinue = () => {
    if (onComplete) {
      onComplete();
    }
  };

  // Componente para mostrar estado de generación
  const renderGenerationStatus = () => {
    if (!isGenerating && !generationStatus) return null;
    
    const progress = generationStatus?.progress || 0;
    
    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {isGenerating ? 'Generando imagen...' : 'Generación completada'}
          </span>
          <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Generación de imagen final</h2>
        <p className="text-muted-foreground mb-4">
          Genera tu imagen artística final basada en todos los elementos seleccionados hasta ahora.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Columna izquierda: Configuración y control */}
        <div className="space-y-6">
          {/* Opciones de generación */}
          <Tabs defaultValue="automatic" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="automatic">Generación automática</TabsTrigger>
              <TabsTrigger value="custom">Prompt personalizado</TabsTrigger>
            </TabsList>
            
            <TabsContent value="automatic" className="mt-4 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-bold mb-2">Prompt generado automáticamente</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Basado en las elecciones de estilo que has hecho, generamos el siguiente prompt:
                  </p>
                  <div className="bg-muted p-3 rounded-md text-sm font-mono">
                    {buildStylePrompt()}
                  </div>
                </CardContent>
              </Card>
              
              <div className="space-y-2">
                <Label>Configuración de generación</Label>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center justify-between">
                    <span>Modelo:</span>
                    <span className="font-medium">Flux AI (Qubico/flux1-dev)</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Pasos:</span>
                    <span className="font-medium">28</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Guidance Scale:</span>
                    <span className="font-medium">2.5</span>
                  </li>
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="custom" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-prompt">Escribe tu prompt personalizado</Label>
                <Textarea
                  id="custom-prompt"
                  placeholder="Describe la imagen que deseas generar en detalle..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="h-32"
                />
                <p className="text-xs text-muted-foreground">
                  Tip: Incluye detalles sobre estilo artístico, pose, iluminación y ambiente para mejores resultados.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Configuración de generación</Label>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center justify-between">
                    <span>Modelo:</span>
                    <span className="font-medium">Flux AI (Qubico/flux1-dev)</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Pasos:</span>
                    <span className="font-medium">28</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Guidance Scale:</span>
                    <span className="font-medium">2.5</span>
                  </li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Error message */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span>{error}</span>
            </div>
          )}
          
          {/* Botón de generación */}
          <Button
            onClick={startImageGeneration}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generar imagen
              </>
            )}
          </Button>
          
          {renderGenerationStatus()}
        </div>
        
        {/* Columna derecha: Imágenes y resultados */}
        <div className="space-y-6">
          {/* Imágenes de referencia */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Imagen de referencia</Label>
              {referenceImage ? (
                <div className="rounded-lg overflow-hidden border">
                  <img 
                    src={referenceImage} 
                    alt="Referencia" 
                    className="w-full h-auto object-cover"
                  />
                </div>
              ) : (
                <div className="bg-muted rounded-lg p-4 h-40 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No hay imagen de referencia</p>
                </div>
              )}
            </div>
            
            <div>
              <Label className="mb-2 block">Try-on resultado</Label>
              {tryOnResults.resultImage ? (
                <div className="rounded-lg overflow-hidden border">
                  <img 
                    src={tryOnResults.resultImage} 
                    alt="Try-on resultado" 
                    className="w-full h-auto object-cover"
                  />
                </div>
              ) : (
                <div className="bg-muted rounded-lg p-4 h-40 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No hay resultado de try-on</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Imagen generada */}
          <div>
            <Label className="mb-2 block">Imagen generada</Label>
            {resultImage ? (
              <div className="rounded-lg overflow-hidden border">
                <img 
                  src={resultImage} 
                  alt="Imagen generada" 
                  className="w-full h-auto object-cover"
                />
                <div className="p-3 flex justify-between items-center bg-muted/50">
                  <div className="flex items-center gap-1 text-sm text-primary">
                    <Check className="h-4 w-4" />
                    <span>Generación exitosa</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={startImageGeneration}
                    disabled={isGenerating}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Regenerar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-muted rounded-lg p-4 h-64 flex items-center justify-center">
                <div className="text-center">
                  <Wand2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Haz clic en "Generar imagen" para crear tu imagen artística
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Consejos */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold mb-2">Consejos para la generación</h3>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 flex-shrink-0 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                    <Wand2 className="h-3 w-3 text-primary" />
                  </div>
                  <span>Puedes regenerar varias veces hasta obtener un resultado que te guste.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 flex-shrink-0 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                    <Wand2 className="h-3 w-3 text-primary" />
                  </div>
                  <span>Si usas prompt personalizado, sé específico con el estilo y detalles.</span>
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
          disabled={!resultImage}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}