/**
import { logger } from "@/lib/logger";
 * Flux Style Section
 * 
 * Este componente integra la generación de imágenes de Flux con PiAPI 
 * específicamente para la sección de Style en la página Artist Image Advisor.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Label } from '../../ui/label';
import { useToast } from '../../../hooks/use-toast';
import { 
  Image as ImageIcon, 
  Loader2, 
  Sparkles, 
  Save, 
  RefreshCw, 
  AlertCircle,
  Palette,
  Music2,
  TrendingUp 
} from 'lucide-react';
import {
  FluxModel,
  FluxTaskType,
  FluxTextToImageOptions,
  fluxService,
  canUseFluxDirectly
} from '../../../lib/api/flux/flux-service';
import { ImageResult } from '../../../lib/types/model-types';
import { fluxLocalStorageService } from '../../../lib/api/flux/flux-local-storage-service';
import axios from 'axios';

interface FluxStyleSectionProps {
  onImageGenerated?: (imageUrl: string) => void;
  language?: 'en' | 'es';
}

export function FluxStyleSection({ onImageGenerated, language = 'en' }: FluxStyleSectionProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ImageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [genre, setGenre] = useState('pop');
  const [aesthetic, setAesthetic] = useState('modern');
  const [colorPalette, setColorPalette] = useState('vibrant');
  const { toast } = useToast();
  
  // Para la versión en español
  const translations = {
    en: {
      title: 'Music Style Visualization',
      description: 'Generate artist images aligned with your musical style',
      genreLabel: 'Music Genre',
      aestheticLabel: 'Visual Aesthetic',
      colorLabel: 'Color Palette',
      generateButton: 'Generate Style Image',
      loadingText: 'Generating style...',
      errorGeneric: 'An error occurred while generating the image',
      successGeneration: 'Style image generated successfully',
      promptLabel: 'Customize Style Prompt (Optional)',
      promptHelp: 'Leave empty to automatically generate based on selections above',
      saveButton: 'Save Result',
      recommendationTitle: 'Visual Style Recommendations',
      colorPaletteTitle: 'Recommended Color Palettes',
      brandingTitle: 'Branding Tips'
    },
    es: {
      title: 'Visualización de Estilo Musical',
      description: 'Genera imágenes de artista alineadas con tu estilo musical',
      genreLabel: 'Género Musical',
      aestheticLabel: 'Estética Visual',
      colorLabel: 'Paleta de Colores',
      generateButton: 'Generar Imagen de Estilo',
      loadingText: 'Generando estilo...',
      errorGeneric: 'Ocurrió un error al generar la imagen',
      successGeneration: 'Imagen de estilo generada exitosamente',
      promptLabel: 'Personalizar Prompt de Estilo (Opcional)',
      promptHelp: 'Deja vacío para generar automáticamente basado en las selecciones anteriores',
      saveButton: 'Guardar Resultado',
      recommendationTitle: 'Recomendaciones de Estilo Visual',
      colorPaletteTitle: 'Paletas de Colores Recomendadas',
      brandingTitle: 'Consejos de Marca'
    }
  };
  
  const t = translations[language];
  
  // Opciones para los selectores
  const genreOptions = [
    { value: 'pop', label: language === 'en' ? 'Pop' : 'Pop' },
    { value: 'rock', label: language === 'en' ? 'Rock' : 'Rock' },
    { value: 'electronic', label: language === 'en' ? 'Electronic' : 'Electrónica' },
    { value: 'hip-hop', label: language === 'en' ? 'Hip-Hop' : 'Hip-Hop' },
    { value: 'r&b', label: language === 'en' ? 'R&B' : 'R&B' },
    { value: 'latin', label: language === 'en' ? 'Latin' : 'Latino' },
    { value: 'indie', label: language === 'en' ? 'Indie' : 'Indie' },
    { value: 'classical', label: language === 'en' ? 'Classical' : 'Clásica' }
  ];
  
  const aestheticOptions = [
    { value: 'modern', label: language === 'en' ? 'Modern' : 'Moderno' },
    { value: 'retro', label: language === 'en' ? 'Retro' : 'Retro' },
    { value: 'minimalist', label: language === 'en' ? 'Minimalist' : 'Minimalista' },
    { value: 'futuristic', label: language === 'en' ? 'Futuristic' : 'Futurista' },
    { value: 'vintage', label: language === 'en' ? 'Vintage' : 'Vintage' },
    { value: 'urban', label: language === 'en' ? 'Urban' : 'Urbano' },
    { value: 'whimsical', label: language === 'en' ? 'Whimsical' : 'Fantasioso' },
    { value: 'experimental', label: language === 'en' ? 'Experimental' : 'Experimental' }
  ];
  
  const colorOptions = [
    { value: 'vibrant', label: language === 'en' ? 'Vibrant' : 'Vibrante' },
    { value: 'monochrome', label: language === 'en' ? 'Monochrome' : 'Monocromático' },
    { value: 'pastel', label: language === 'en' ? 'Pastel' : 'Pastel' },
    { value: 'dark', label: language === 'en' ? 'Dark' : 'Oscuro' },
    { value: 'neon', label: language === 'en' ? 'Neon' : 'Neón' },
    { value: 'warm', label: language === 'en' ? 'Warm' : 'Cálido' },
    { value: 'cool', label: language === 'en' ? 'Cool' : 'Frío' },
    { value: 'gradient', label: language === 'en' ? 'Gradient' : 'Gradiente' }
  ];
  
  // Genera un prompt basado en las selecciones
  const generatePrompt = () => {
    if (prompt.trim()) return prompt;
    
    const genreTexts = {
      pop: language === 'en' ? 'modern pop artist' : 'artista de pop moderno',
      rock: language === 'en' ? 'rock band performer' : 'artista de banda de rock',
      electronic: language === 'en' ? 'electronic music producer' : 'productor de música electrónica',
      'hip-hop': language === 'en' ? 'hip-hop artist' : 'artista de hip-hop',
      'r&b': language === 'en' ? 'R&B soul singer' : 'cantante de R&B y soul',
      latin: language === 'en' ? 'latin music performer' : 'artista de música latina',
      indie: language === 'en' ? 'indie musician' : 'músico indie',
      classical: language === 'en' ? 'classical composer' : 'compositor clásico'
    };
    
    const aestheticTexts = {
      modern: language === 'en' ? 'with modern sleek style' : 'con estilo moderno y elegante',
      retro: language === 'en' ? 'with retro vintage aesthetic' : 'con estética retro vintage',
      minimalist: language === 'en' ? 'with minimalist clean aesthetic' : 'con estética minimalista limpia',
      futuristic: language === 'en' ? 'with futuristic cyberpunk elements' : 'con elementos futuristas de cyberpunk',
      vintage: language === 'en' ? 'with vintage aesthetic from past decades' : 'con estética vintage de décadas pasadas',
      urban: language === 'en' ? 'with urban street style' : 'con estilo urbano callejero',
      whimsical: language === 'en' ? 'with whimsical fantasy elements' : 'con elementos fantásticos caprichosos',
      experimental: language === 'en' ? 'with experimental avant-garde style' : 'con estilo experimental de vanguardia'
    };
    
    const colorTexts = {
      vibrant: language === 'en' ? 'using vibrant colorful palette' : 'usando paleta de colores vibrantes',
      monochrome: language === 'en' ? 'in monochrome black and white' : 'en monocromo blanco y negro',
      pastel: language === 'en' ? 'with soft pastel colors' : 'con colores pastel suaves',
      dark: language === 'en' ? 'with dark moody atmosphere' : 'con atmósfera oscura y melancólica',
      neon: language === 'en' ? 'with bright neon colors' : 'con colores neón brillantes',
      warm: language === 'en' ? 'in warm orange and red tones' : 'en tonos cálidos de naranja y rojo',
      cool: language === 'en' ? 'in cool blue and purple tones' : 'en tonos fríos de azul y púrpura',
      gradient: language === 'en' ? 'with colorful gradient effects' : 'con efectos de gradiente coloridos'
    };
    
    // Ensamblar el prompt completo
    const selectedGenre = genreTexts[genre as keyof typeof genreTexts] || genreTexts.pop;
    const selectedAesthetic = aestheticTexts[aesthetic as keyof typeof aestheticTexts] || aestheticTexts.modern;
    const selectedColor = colorTexts[colorPalette as keyof typeof colorTexts] || colorTexts.vibrant;
    
    const artistTypeText = language === 'en' ? 'professional portrait of a' : 'retrato profesional de un';
    const qualityText = language === 'en' ? ', high quality, detailed studio photograph' : ', alta calidad, fotografía de estudio detallada';
    
    return `${artistTypeText} ${selectedGenre} ${selectedAesthetic} ${selectedColor}${qualityText}`;
  };
  
  // Maneja la generación de imagen usando Flux API
  const handleGenerateImage = async () => {
    const finalPrompt = generatePrompt();
    setIsGenerating(true);
    setError(null);
    
    try {
      // Opciones para generar la imagen
      const options: FluxTextToImageOptions = {
        prompt: finalPrompt,
        negative_prompt: language === 'en' 
          ? 'deformed, bad anatomy, disfigured, poorly drawn face, mutation, mutated, extra limb, missing limb, bad lighting'
          : 'deformado, mala anatomía, desfigurado, cara mal dibujada, mutación, mutado, extremidad extra, extremidad faltante, mala iluminación',
        steps: 28,
        guidance_scale: 2.5,
        width: 512,
        height: 512
      };
      
      let response;
      
      // Verificar si podemos usar el servicio de Flux directamente o necesitamos usar el proxy
      if (canUseFluxDirectly()) {
        response = await fluxService.generateTextToImage(
          options,
          FluxModel.FLUX1_DEV,
          FluxTaskType.TXT2IMG
        );
      } else {
        // Usar el endpoint proxy del servidor (endpoint correcto verificado en server/routes.ts)
        response = await axios.post('/api/flux/generate-image', {
          prompt: finalPrompt,
          negativePrompt: language === 'en' 
            ? 'deformed, bad anatomy, disfigured, poorly drawn face, mutation, mutated, extra limb, missing limb, bad lighting'
            : 'deformado, mala anatomía, desfigurado, cara mal dibujada, mutación, mutado, extremidad extra, extremidad faltante, mala iluminación',
          steps: 28,
          guidance_scale: 2.5,
          width: 512,
          height: 512,
          model: FluxModel.FLUX1_DEV,
          taskType: FluxTaskType.TXT2IMG
        });
        
        // Estructurar la respuesta para que sea compatible con la API de Flux
        response = response.data;
      }
      
      // Verificar el estado de la tarea
      if (response && response.task_id) {
        await checkTaskStatus(response.task_id, finalPrompt);
      } else {
        throw new Error('No task ID returned from Flux API');
      }
    } catch (err: any) {
      logger.error('Error generating image:', err);
      setError(err.message || t.errorGeneric);
      toast({
        title: "Error",
        description: err.message || t.errorGeneric,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Verifica el estado de la generación
  const checkTaskStatus = async (taskId: string, promptText: string) => {
    try {
      // Llamar al endpoint de status - ruta correcta verificada en server/routes.ts
      const response = await axios.get(`/api/flux/status?taskId=${taskId}`);
      
      if (response.data && response.data.data && 
          response.data.data.status === 'completed' && 
          response.data.data.output && 
          response.data.data.output.images && 
          response.data.data.output.images.length > 0) {
        
        // Obtener la imagen generada
        const imageUrl = response.data.data.output.images[0];
        
        // Crear el objeto de resultado
        const result: ImageResult = {
          id: taskId,
          url: imageUrl,
          prompt: promptText,
          createdAt: new Date(),
          model: 'flux'
        };
        
        // Guardar en localStorage
        fluxLocalStorageService.saveResult(result);
        
        // Actualizar estado
        setResult(result);
        
        // Notificar éxito
        toast({
          title: "Success",
          description: t.successGeneration,
        });
        
        // Llamar al callback si existe
        if (onImageGenerated) {
          onImageGenerated(imageUrl);
        }
      } else if (response.data && response.data.data && response.data.data.status === 'failed') {
        throw new Error(response.data.data.error?.message || 'Generation failed');
      } else if (response.data && response.data.data && response.data.data.status === 'processing') {
        // Si aún está procesando, volvemos a verificar después de un tiempo
        setTimeout(() => checkTaskStatus(taskId, promptText), 5000);
      }
    } catch (err: any) {
      logger.error('Error checking task status:', err);
      setError(err.message || t.errorGeneric);
      toast({
        title: "Error",
        description: err.message || t.errorGeneric,
        variant: "destructive"
      });
    }
  };
  
  // Genera recomendaciones basadas en las selecciones
  const getRecommendations = () => {
    const recommendations = {
      pop: [
        language === 'en' ? 'Bright, high-contrast photography with clean backgrounds' : 'Fotografía brillante y de alto contraste con fondos limpios',
        language === 'en' ? 'Utilize fresh, contemporary compositions with smooth textures' : 'Utiliza composiciones frescas y contemporáneas con texturas suaves',
        language === 'en' ? 'Incorporate trending visual elements that connect with youth culture' : 'Incorpora elementos visuales de tendencia que conecten con la cultura juvenil'
      ],
      rock: [
        language === 'en' ? 'Dramatic lighting with strong shadows for edgy contrast' : 'Iluminación dramática con sombras fuertes para un contraste audaz',
        language === 'en' ? 'Utilize textured, gritty backgrounds with raw aesthetics' : 'Utiliza fondos texturizados y ásperos con estética cruda',
        language === 'en' ? 'Consider black leather, denim, and metal accessories as styling elements' : 'Considera cuero negro, mezclilla y accesorios metálicos como elementos de estilo'
      ],
      electronic: [
        language === 'en' ? 'Abstract digital elements and futuristic visual concepts' : 'Elementos digitales abstractos y conceptos visuales futuristas',
        language === 'en' ? 'Incorporate neon lighting and geometric patterns' : 'Incorpora iluminación neón y patrones geométricos',
        language === 'en' ? 'Experiment with distorted visual effects and digital glitches' : 'Experimenta con efectos visuales distorsionados y fallas digitales'
      ]
    };
    
    return recommendations[genre as keyof typeof recommendations] || recommendations.pop;
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">{t.title}</h2>
        <p className="text-muted-foreground">
          {t.description}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 backdrop-blur-sm border-orange-500/20">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Music2 className="h-5 w-5 text-orange-500" />
              {t.recommendationTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="genre-select">{t.genreLabel}</Label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger id="genre-select">
                      <SelectValue placeholder={t.genreLabel} />
                    </SelectTrigger>
                    <SelectContent>
                      {genreOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="aesthetic-select">{t.aestheticLabel}</Label>
                  <Select value={aesthetic} onValueChange={setAesthetic}>
                    <SelectTrigger id="aesthetic-select">
                      <SelectValue placeholder={t.aestheticLabel} />
                    </SelectTrigger>
                    <SelectContent>
                      {aestheticOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="color-select">{t.colorLabel}</Label>
                  <Select value={colorPalette} onValueChange={setColorPalette}>
                    <SelectTrigger id="color-select">
                      <SelectValue placeholder={t.colorLabel} />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="custom-prompt">{t.promptLabel}</Label>
                  <Textarea 
                    id="custom-prompt"
                    placeholder={generatePrompt()}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">{t.promptHelp}</p>
                </div>
                
                <Button 
                  onClick={handleGenerateImage} 
                  disabled={isGenerating}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.loadingText}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t.generateButton}
                    </>
                  )}
                </Button>
              </div>
              
              {error && (
                <div className="bg-destructive/20 p-4 rounded-md flex items-start gap-3 mt-4">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="p-6 backdrop-blur-sm border-orange-500/20">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Palette className="h-5 w-5 text-orange-500" />
              {t.brandingTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {result ? (
              <div className="space-y-4">
                <div className="rounded-md overflow-hidden shadow-md">
                  <img 
                    src={result.url} 
                    alt="Generated style" 
                    className="w-full h-auto object-cover"
                  />
                </div>
                <div className="flex justify-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      toast({
                        title: "Success",
                        description: language === 'en' ? "Image saved successfully" : "Imagen guardada exitosamente",
                      });
                    }}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {t.saveButton}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleGenerateImage}
                    disabled={isGenerating}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t.generateButton}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-[300px] rounded-md bg-black/20 flex items-center justify-center">
                  <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">{t.colorPaletteTitle}</h3>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="h-8 rounded-md bg-gradient-to-r from-purple-500 to-blue-600"></div>
                    <div className="h-8 rounded-md bg-gradient-to-r from-amber-500 to-pink-600"></div>
                    <div className="h-8 rounded-md bg-gradient-to-r from-emerald-500 to-cyan-600"></div>
                    <div className="h-8 rounded-md bg-gradient-to-r from-stone-600 to-neutral-900"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">{language === 'en' ? 'Visual Recommendations' : 'Recomendaciones Visuales'}</h3>
                  <ul className="space-y-2">
                    {getRecommendations().map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="h-5 w-5 rounded-full bg-orange-500/20 flex-shrink-0 mt-0.5 flex items-center justify-center">
                          <span className="text-orange-500 text-xs">{index + 1}</span>
                        </div>
                        <p className="text-sm">{rec}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}