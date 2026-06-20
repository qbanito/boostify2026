import React from "react";
import { DemoEnhancedWorkflow } from "../components/music-video/demo-enhanced-workflow";
import { Button } from "../components/ui/button";
import { Link } from "wouter";

const AnimatedWorkflowPage = () => {
  return (
    <div className="container mx-auto py-12">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Flujo de Trabajo Animado
        </h1>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Experiencia visual mejorada para el proceso de creación de videos con IA.
          Este demo incluye sistema de partículas, efectos de brillo y animaciones
          que responden al progreso del flujo de trabajo.
        </p>
      </div>
      
      <div className="flex flex-col items-center">
        <DemoEnhancedWorkflow />
        
        <div className="mt-16 flex flex-col items-center gap-4">
          <h2 className="text-2xl font-bold">Más Ejemplos</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild variant="outline" className="flex items-center gap-2">
              <Link href="/music-video-workflow">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-video">
                  <path d="M22 8.5a2.5 2.5 0 0 0-3.5-2.3L18 6.5"/>
                  <path d="M18 6.5 6 2.5a2.5 2.5 0 0 0-3.5 2.3v14.4a2.5 2.5 0 0 0 3.5 2.3l12-4a2.5 2.5 0 0 0 0-4.7"/>
                  <path d="M22 15.5a2.5 2.5 0 0 1-3.5 2.3L18 17.5"/>
                </svg>
                Creador de Videos
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex items-center gap-2">
              <Link href="/test-progress">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-loader">
                  <line x1="12" x2="12" y1="2" y2="6"/>
                  <line x1="12" x2="12" y1="18" y2="22"/>
                  <line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/>
                  <line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/>
                  <line x1="2" x2="6" y1="12" y2="12"/>
                  <line x1="18" x2="22" y1="12" y2="12"/>
                  <line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/>
                  <line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/>
                </svg>
                Indicadores de Progreso
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex items-center gap-2">
              <Link href="/layer-filter-demo">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layers">
                  <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
                  <path d="m22 12.18-8.58 3.91a2 2 0 0 1-1.66 0L2.5 12.18"/>
                  <path d="m22 17.18-8.58 3.91a2 2 0 0 1-1.66 0L2.5 17.18"/>
                </svg>
                Filtros y Capas
              </Link>
            </Button>
          </div>
        </div>
      </div>
      
      <div className="mt-16 max-w-3xl mx-auto p-6 bg-card rounded-lg border">
        <h2 className="text-xl font-bold mb-4">Información sobre los efectos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Sistema de partículas</h3>
            <p className="text-muted-foreground text-sm">
              Las partículas cambian de color y comportamiento basándose en la etapa actual.
              Representan visualmente el tipo de procesamiento que está ocurriendo.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2">Efectos de brillo</h3>
            <p className="text-muted-foreground text-sm">
              Los efectos de brillo pulsante proporcionan retroalimentación visual sobre
              la actividad y el estado del proceso de generación.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2">Transiciones</h3>
            <p className="text-muted-foreground text-sm">
              Las animaciones suaves entre pasos mejoran la experiencia de usuario
              y comunican claramente el progreso a través del flujo de trabajo.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2">Indicadores de progreso</h3>
            <p className="text-muted-foreground text-sm">
              Las barras de progreso animadas y los indicadores de pasos proporcionan
              retroalimentación constante sobre el estado de cada tarea.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedWorkflowPage;