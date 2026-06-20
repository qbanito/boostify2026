/**
 * Asesor de imagen para artistas - Versión mejorada
 * 
 * Implementa un flujo de trabajo guiado para la creación y personalización
 * de la imagen artística con integración de IA.
 */

import React, { useEffect } from 'react';
import { 
  useArtistImageWorkflow, 
  WorkflowStep 
} from '../services/artist-image-workflow-service';
import { WorkflowGuide } from '../components/image-advisor/workflow-guide';
import { Button } from '../components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw 
} from 'lucide-react';

import { FluxUploadImproved } from '../components/image-generation/improved/flux-upload-improved';
import { FluxStyleImproved } from '../components/image-generation/improved/flux-style-improved';
import { VirtualTryonImproved } from '../components/kling/virtual-tryon-improved';
import { FinalImageGeneration } from '../components/image-generation/improved/final-image-generation';
import { ResultsGallery } from '../components/image-generation/improved/results-gallery';

export default function ArtistImageAdvisorImproved() {
  const { 
    currentStep, 
    setCurrentStep,
    resetWorkflow,
  } = useArtistImageWorkflow();

  // Manejo de la navegación entre pasos
  const handleNext = () => {
    const steps: WorkflowStep[] = ['upload', 'style', 'virtual-tryon', 'generate', 'results'];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: WorkflowStep[] = ['upload', 'style', 'virtual-tryon', 'generate', 'results'];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  // Renderizar el componente correspondiente al paso actual
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'upload':
        return <FluxUploadImproved onComplete={handleNext} />;
      case 'style':
        return <FluxStyleImproved onComplete={handleNext} />;
      case 'virtual-tryon':
        return <VirtualTryonImproved onComplete={handleNext} />;
      case 'generate':
        return <FinalImageGeneration onComplete={handleNext} />;
      case 'results':
        return <ResultsGallery />;
      default:
        return <div>Paso no reconocido</div>;
    }
  };

  // Verificar si se puede avanzar o retroceder
  const canGoBack = currentStep !== 'upload';
  const canGoNext = currentStep !== 'results';
  const isFirstStep = currentStep === 'upload';
  const isLastStep = currentStep === 'results';

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2 text-center">
        Asesor de Imagen para Artistas
      </h1>
      <p className="text-muted-foreground mb-6 text-center">
        Crea tu imagen artística personalizada con ayuda de inteligencia artificial
      </p>
      
      {/* Guía visual del workflow */}
      <div className="mb-8">
        <WorkflowGuide />
      </div>
      
      {/* Contenido principal según el paso actual */}
      <div className="bg-card rounded-lg border shadow-sm p-6 mb-6">
        {renderCurrentStep()}
      </div>
      
      {/* Controles de navegación */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={!canGoBack}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        
        <Button
          variant="outline"
          onClick={resetWorkflow}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reiniciar
        </Button>
        
        <Button
          onClick={handleNext}
          disabled={!canGoNext}
          className="gap-2"
        >
          {isLastStep ? 'Finalizar' : 'Siguiente'}
          {!isLastStep && <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}