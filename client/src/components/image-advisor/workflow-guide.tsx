/**
 * Componente de guía visual del flujo de trabajo
 * Muestra el progreso del usuario a través de los diferentes pasos del proceso
 */

import React from 'react';
import { useArtistImageWorkflow, WorkflowStep } from '../../services/artist-image-workflow-service';
import { cn } from '../../lib/utils';
import { Upload, Brush, Shirt, Wand2, Images } from 'lucide-react';

export function WorkflowGuide() {
  const { currentStep } = useArtistImageWorkflow();

  // Configuración de los pasos
  const steps: {
    id: WorkflowStep;
    label: string;
    icon: React.ReactNode;
    description: string;
  }[] = [
    {
      id: 'upload',
      label: 'Subir imagen',
      icon: <Upload className="h-5 w-5" />,
      description: 'Sube una foto tuya para comenzar'
    },
    {
      id: 'style',
      label: 'Definir estilo',
      icon: <Brush className="h-5 w-5" />,
      description: 'Selecciona el estilo artístico'
    },
    {
      id: 'virtual-tryon',
      label: 'Vestuario',
      icon: <Shirt className="h-5 w-5" />,
      description: 'Prueba vestuario virtual'
    },
    {
      id: 'generate',
      label: 'Generar',
      icon: <Wand2 className="h-5 w-5" />,
      description: 'Crea imágenes finales'
    },
    {
      id: 'results',
      label: 'Resultados',
      icon: <Images className="h-5 w-5" />,
      description: 'Visualiza y descarga'
    }
  ];

  // Función para determinar el estado de un paso
  const getStepStatus = (step: WorkflowStep) => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    const stepIndex = steps.findIndex(s => s.id === step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="py-4">
      <div className="relative flex justify-between">
        {/* Línea de progreso */}
        <div className="absolute top-1/2 left-0 w-full h-1 -translate-y-1/2 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${Math.max(0, steps.findIndex(s => s.id === currentStep) / (steps.length - 1) * 100)}%`
            }}
          ></div>
        </div>
        
        {/* Pasos */}
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              {/* Círculo de estado */}
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 border-primary transition-all duration-300",
                  {
                    "bg-primary text-primary-foreground": status === 'completed' || status === 'current',
                    "bg-background text-muted-foreground": status === 'pending',
                    "ring-4 ring-primary/20": status === 'current'
                  }
                )}
              >
                {status === 'completed' ? (
                  <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.icon
                )}
              </div>
              
              {/* Etiqueta y descripción */}
              <div className="mt-2 text-center">
                <span 
                  className={cn(
                    "text-sm font-medium block",
                    status === 'current' ? "text-primary" : "text-foreground"
                  )}
                >
                  {step.label}
                </span>
                <span 
                  className={cn(
                    "text-xs block max-w-[100px] mt-1",
                    status === 'current' ? "text-muted-foreground" : "text-muted-foreground/70"
                  )}
                >
                  {step.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}