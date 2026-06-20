/**
import { logger } from "../../lib/logger";
 * Componente SceneEditorPanel
 * Panel principal que integra el editor de escenas con la API de generación de imágenes
 */
import React, { useState, useEffect } from 'react';
import { SceneEditorContainer, TimelineClip } from './SceneEditorContainer';
import { useToast } from "../../../hooks/use-toast";
import axios from 'axios';
import * as fal from "@fal-ai/serverless-client";

// Configurar el cliente de fal.ai si es necesario
if (import.meta.env.VITE_FAL_API_KEY) {
  fal.config({
    credentials: import.meta.env.VITE_FAL_API_KEY
  });
}

interface SceneEditorPanelProps {
  clips?: TimelineClip[];
  selectedClipId?: number;
  onClipUpdate?: (clipId: number, updates: Partial<TimelineClip>) => void;
  onAddClip?: (clip: Omit<TimelineClip, 'id'>) => void;
  onSaveScenes?: () => Promise<void>;
}

export function SceneEditorPanel({
  clips = [],
  selectedClipId,
  onClipUpdate,
  onAddClip,
  onSaveScenes
}: SceneEditorPanelProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Regenera la imagen para un clip específico utilizando su prompt
   */
  const handleRegenerateImage = async (clipId: number) => {
    const clipToUpdate = clips.find(clip => clip.id === clipId);
    if (!clipToUpdate || !clipToUpdate.imagePrompt) {
      toast({
        title: "Error",
        description: "No se encontró el prompt para regenerar la imagen",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Primero intentamos usar la API de fal.ai si está configurada
      if (import.meta.env.VITE_FAL_API_KEY) {
        await generateImageWithFal(clipToUpdate, clipId);
      } else {
        // Como alternativa, usamos la API proxy del servidor
        await generateImageWithServerProxy(clipToUpdate, clipId);
      }
    } catch (error) {
      logger.error("Error al generar imagen:", error);
      toast({
        title: "Error en la generación",
        description: "No se pudo generar la imagen. Verifique la consola para más detalles.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Genera una imagen usando fal.ai directamente
   */
  const generateImageWithFal = async (clip: TimelineClip, clipId: number) => {
    try {
      // Notificar inicio
      toast({
        title: "Generando imagen",
        description: "Conectando con fal.ai para generar la imagen...",
      });

      const prompt = clip.imagePrompt || '';
      logger.info("Generando imagen con fal.ai:", prompt.substring(0, 50) + "...");

      // Usar el modelo stable-diffusion de fal.ai
      const result = await fal.subscribe('fal-ai/stable-diffusion', {
        input: {
          prompt: prompt,
          negative_prompt: "blurry, low quality, distorted face, bad anatomy",
          height: 512,
          width: 768,
          num_inference_steps: 30,
          guidance_scale: 7.5
        },
      });

      // Verificar que tenemos un resultado válido
      if (result.images && result.images.length > 0) {
        const imageUrl = result.images[0]?.url;
        
        if (imageUrl && onClipUpdate) {
          onClipUpdate(clipId, {
            imageUrl: imageUrl
          });
          
          toast({
            title: "Imagen generada",
            description: "La imagen se ha generado correctamente con fal.ai",
          });
        }
      } else {
        throw new Error("No se recibió una imagen válida de fal.ai");
      }
    } catch (error) {
      logger.error("Error con fal.ai:", error);
      throw error;
    }
  };

  /**
   * Genera una imagen usando la API proxy del servidor
   */
  const generateImageWithServerProxy = async (clip: TimelineClip, clipId: number) => {
    try {
      // Notificar inicio
      toast({
        title: "Generando imagen",
        description: "Conectando con servidor para generar la imagen...",
      });

      const prompt = clip.imagePrompt || '';
      logger.info("Generando imagen con API proxy:", prompt.substring(0, 50) + "...");

      // Llamar a nuestra API proxy para generación de imágenes
      const response = await axios.post('/api/proxy/generate-image', {
        prompt: prompt,
        negative_prompt: "blurry, low quality, distorted face, bad anatomy",
        width: 768,
        height: 512,
      });

      // Verificar respuesta
      if (response.data.success && response.data.imageUrl) {
        const imageUrl = response.data.imageUrl;
        
        if (onClipUpdate) {
          onClipUpdate(clipId, {
            imageUrl: imageUrl
          });
          
          toast({
            title: "Imagen generada",
            description: "La imagen se ha generado correctamente con la API del servidor",
          });
        }
      } else {
        throw new Error("No se recibió una imagen válida del servidor");
      }
    } catch (error) {
      logger.error("Error con API proxy:", error);
      throw error;
    }
  };

  /**
   * Maneja el guardado de todas las escenas
   */
  const handleSaveScenes = async () => {
    if (!onSaveScenes) return;
    
    setIsProcessing(true);
    try {
      await onSaveScenes();
      toast({
        title: "Escenas guardadas",
        description: "Todas las escenas han sido guardadas correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error al guardar",
        description: "No se pudieron guardar las escenas. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SceneEditorContainer
      clips={clips}
      selectedClipId={selectedClipId}
      onClipUpdate={onClipUpdate}
      onRegenerateClipImage={handleRegenerateImage}
      onAddClip={onAddClip}
      onSaveScenes={handleSaveScenes}
      isGenerating={isGenerating}
      isProcessing={isProcessing}
    />
  );
}