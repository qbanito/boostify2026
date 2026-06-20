/**
import { logger } from "@/lib/logger";
 * Flux Upload Section
 * 
 * Este componente integra la generación de imágenes de Flux con PiAPI 
 * específicamente para la sección de Upload en la página Artist Image Advisor.
 */

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { useToast } from '../../../hooks/use-toast';
import { 
  Image as ImageIcon, 
  Upload, 
  Camera, 
  Loader2, 
  Sparkles, 
  Save, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import { 
  fluxService, 
  FluxGenerationParams, 
  FluxTaskResult 
} from '../../../lib/api/flux/flux-service';
import { ImageResult } from '../../../lib/types/model-types';
import axios from 'axios';

interface FluxUploadSectionProps {
  onImageGenerated?: (imageUrl: string) => void;
  language?: 'en' | 'es';
}

export function FluxUploadSection({ onImageGenerated, language = 'en' }: FluxUploadSectionProps) {
  const [activeTab, setActiveTab] = useState('upload');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ImageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Para la versión en español
  const translations = {
    en: {
      title: 'Upload & Generate Image',
      description: 'Upload your reference image or generate a new one with AI',
      uploadTab: 'Upload',
      generateTab: 'Generate',
      historyTab: 'History',
      promptPlaceholder: 'Describe the image you want to generate...',
      negPromptPlaceholder: 'Elements to avoid in the image...',
      generateButton: 'Generate Image',
      uploadButton: 'Upload Image',
      cancelButton: 'Cancel',
      saveButton: 'Save Result',
      loadingText: 'Generating image...',
      dropzoneText: 'Drag & drop your image here or click to browse',
      errorGeneric: 'An error occurred while generating the image',
      successGeneration: 'Image generated successfully',
      successSave: 'Image saved successfully',
    },
    es: {
      title: 'Subir y Generar Imagen',
      description: 'Sube tu imagen de referencia o genera una nueva con IA',
      uploadTab: 'Subir',
      generateTab: 'Generar',
      historyTab: 'Historial',
      promptPlaceholder: 'Describe la imagen que quieres generar...',
      negPromptPlaceholder: 'Elementos a evitar en la imagen...',
      generateButton: 'Generar Imagen',
      uploadButton: 'Subir Imagen',
      cancelButton: 'Cancelar',
      saveButton: 'Guardar Resultado',
      loadingText: 'Generando imagen...',
      dropzoneText: 'Arrastra y suelta tu imagen aquí o haz clic para explorar',
      errorGeneric: 'Ocurrió un error al generar la imagen',
      successGeneration: 'Imagen generada exitosamente',
      successSave: 'Imagen guardada exitosamente',
    }
  };
  
  const t = translations[language];
  
  // Maneja la generación de imagen usando Flux API
  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: language === 'en' ? "Please enter a prompt" : "Por favor ingresa un prompt",
        variant: "destructive"
      });
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Parámetros para generar la imagen
      const params: FluxGenerationParams = {
        prompt: prompt,
        negativePrompt: negativePrompt,
        steps: 28,
        guidance_scale: 2.5,
        width: 512,
        height: 512,
        model: 'Qubico/flux1-dev',
        taskType: 'txt2img'
      };
      
      logger.info('Iniciando generación de imagen con Flux:', params);
      
      // Usar el servicio de Flux que se comunicará con nuestro proxy
      const response = await fluxService.generateImage(params);
      
      logger.info('Respuesta de generación Flux:', response);
      
      // Verificar si la generación fue exitosa
      if (response.success && response.taskId) {
        // Iniciar el proceso de verificación de estado
        await checkTaskStatus(response.taskId);
      } else {
        throw new Error(response.error || 'No task ID returned from Flux API');
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
  const checkTaskStatus = async (taskId: string) => {
    try {
      logger.info('Verificando estado de tarea Flux:', taskId);
      
      // Usar el servicio de Flux para verificar el estado
      const response = await fluxService.checkTaskStatus(taskId);
      
      logger.info('Respuesta de verificación de estado:', response);
      
      if (response.success && response.status === 'completed' && response.images && response.images.length > 0) {
        // Obtener la imagen generada
        const imageUrl = response.images[0];
        
        // Crear el objeto de resultado
        const result: ImageResult = {
          id: taskId,
          url: imageUrl,
          prompt: prompt,
          createdAt: new Date(),
          model: 'flux'
        };
        
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
      } else if (response.status === 'failed') {
        throw new Error(response.error || 'Generation failed');
      } else if (response.status === 'pending' || response.status === 'processing') {
        // Si aún está procesando, volvemos a verificar después de un tiempo
        setTimeout(() => checkTaskStatus(taskId), 5000);
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
  
  // Maneja la subida de imagen
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const imageUrl = event.target.result as string;
        setUploadedImageUrl(imageUrl);
        
        // Notificar éxito
        toast({
          title: "Success",
          description: language === 'en' ? "Image uploaded successfully" : "Imagen subida exitosamente",
        });
        
        // Llamar al callback si existe
        if (onImageGenerated) {
          onImageGenerated(imageUrl);
        }
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Inicia la acción de seleccionar archivo
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  return (
    <Card className="border-orange-500/20 bg-black/40 backdrop-blur-sm overflow-hidden">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-orange-500" />
          {t.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> {t.uploadTab}
            </TabsTrigger>
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> {t.generateTab}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-4">
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={triggerFileInput}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*" 
                onChange={handleUploadImage}
              />
              <Camera className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t.dropzoneText}</p>
            </div>
            
            {uploadedImageUrl && (
              <div className="mt-4 text-center">
                <img 
                  src={uploadedImageUrl} 
                  alt="Uploaded" 
                  className="mx-auto max-h-80 rounded-md shadow-md"
                />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="generate" className="space-y-4">
            <div className="space-y-4">
              <Textarea 
                placeholder={t.promptPlaceholder}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px]"
              />
              
              <Textarea 
                placeholder={t.negPromptPlaceholder}
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                className="min-h-[60px]"
              />
              
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
            
            {result && (
              <div className="mt-4 text-center">
                <img 
                  src={result.url} 
                  alt="Generated" 
                  className="mx-auto max-h-80 rounded-md shadow-md"
                />
                <div className="mt-4 flex justify-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      toast({
                        title: "Success",
                        description: t.successSave,
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
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}