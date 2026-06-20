import React from 'react';
import { MusicVideoWorkflow } from '../components/music-video/music-video-workflow';
import { toast } from '../hooks/use-toast';

/**
 * Página para la creación de videos musicales
 * 
 * Esta página implementa un flujo de trabajo completo para la creación
 * de videos musicales sincronizados con ritmo y letra usando el componente
 * MusicVideoWorkflow.
 */
export default function MusicVideoWorkflowPage() {
  const handleVideoComplete = (result: {
    videoUrl?: string;
    clips?: any[];
    duration?: number;
  }) => {
    toast({
      title: "Video musical completado",
      description: `Se ha generado un video de ${Math.floor((result.duration || 0) / 60)}:${((result.duration || 0) % 60).toString().padStart(2, '0')} minutos`,
    });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Creador de Videos Musicales</h1>
        <p className="text-gray-500">
          Crea videos musicales con sincronización profesional de ritmo y letra
        </p>
      </div>
      
      <MusicVideoWorkflow onComplete={handleVideoComplete} />
    </div>
  );
}