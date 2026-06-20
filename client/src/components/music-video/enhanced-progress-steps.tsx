/**
import { logger } from "../../lib/logger";
 * Componente EnhancedProgressSteps
 * 
 * Este componente es una versión mejorada del ProgressSteps original que ofrece:
 * - Visualización progresiva - solo muestra el paso actual y los siguientes de forma más sutil
 * - Mensajes descriptivos animados que indican qué está haciendo la IA en cada etapa
 * - Animaciones fluidas entre pasos con Framer Motion
 * - Iconos dinámicos y atractivos
 * 
 * Se adapta a la paleta de colores de la aplicación y proporciona feedback visual elegante.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

import { 
  AnimatedMessage, 
  StepIcon, 
  ParticleSystem, 
  GlowEffect,
  STEP_MESSAGES
} from './animation-effects';

export interface Step {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
}

interface EnhancedProgressStepsProps {
  steps: Step[];
  currentStep: string;
  showDescriptions?: boolean;
}

export function EnhancedProgressSteps({ 
  steps, 
  currentStep,
  showDescriptions = true
}: EnhancedProgressStepsProps) {
  // Estado para el mensaje actual
  const [messageIndex, setMessageIndex] = useState(0);
  
  // Identificar el paso actual y su índice
  const currentStepObj = steps.find(s => s.id === currentStep) || steps[0];
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  
  // Determinar qué pasos están completados
  const completedSteps = steps.filter(s => s.status === 'completed');
  const completedStepIds = completedSteps.map(s => s.id);
  
  // Cambiar el mensaje descriptivo cada cierto tiempo
  useEffect(() => {
    // Reiniciar índice cuando el paso cambia
    setMessageIndex(0);
    
    // Solo configurar el intervalo si el paso actual está en progreso
    if (currentStepObj.status === 'in-progress') {
      const interval = setInterval(() => {
        // Solo hay 3 mensajes por paso, así que rotamos entre ellos
        setMessageIndex(prev => (prev + 1) % 3);
      }, 4000); // Cambiar mensaje cada 4 segundos
      
      return () => clearInterval(interval);
    }
  }, [currentStep, currentStepObj.status]);

  // Determinar el mensaje actual
  const currentMessages = STEP_MESSAGES[currentStepObj.id as keyof typeof STEP_MESSAGES] || [];
  const currentMessage = currentMessages[messageIndex] || "Procesando...";
  
  return (
    <div className="w-full space-y-6">
      {/* Solo mostrar el encabezado cuando hay un paso en progreso */}
      {currentStepObj.status === 'in-progress' && (
        <motion.div
          className="relative flex justify-center py-2 overflow-hidden"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <AnimatedMessage 
            message={currentMessage}
            icon={<StepIcon stepId={currentStepObj.id} active />}
          />
        </motion.div>
      )}
      
      <div className="relative space-y-4 bg-background/80 backdrop-blur-sm p-4 rounded-xl border">
        {/* Efectos de fondo según el paso actual */}
        <ParticleSystem 
          currentStep={currentStepIndex + 1} 
          active={currentStepObj.status === 'in-progress'} 
        />
        <GlowEffect 
          active={currentStepIndex > 6} 
          color={currentStepIndex > 6 ? "blue" : "orange"} 
        />
        
        {/* Pasos completados - vista compacta */}
        {completedSteps.length > 0 && (
          <motion.div 
            className="grid grid-cols-3 sm:grid-cols-5 gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {completedSteps.map((step) => (
              <motion.div
                key={step.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring" }}
              >
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-xs font-medium truncate">{step.name}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
        
        {/* Paso actual - mostrar prominentemente */}
        {currentStepObj.status === 'in-progress' && (
          <motion.div
            className="relative rounded-lg border bg-card p-4 shadow-lg"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full flex items-center justify-center border-2 border-orange-500/50 bg-orange-500/10">
                <StepIcon stepId={currentStepObj.id} active />
              </div>
              
              <div>
                <h3 className="font-semibold text-lg text-foreground">
                  {currentStepObj.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {currentStepObj.description}
                </p>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Próximos pasos - mostrar de forma más sutil */}
        <AnimatePresence>
          {steps
            .filter(step => step.status === 'pending')
            .filter((_, index) => index < 3) // Mostrar solo los próximos 3 pasos pendientes
            .map((step, index) => (
              <motion.div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg",
                  "transition-all duration-300",
                  index === 0 ? "bg-muted/80" : "bg-muted/40"
                )}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: index === 0 ? 0.95 : 0.7 - index * 0.2 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <div className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/50">
                  <StepIcon stepId={step.id} />
                </div>
                <div>
                  <p className={cn(
                    "font-medium",
                    index === 0 ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.name}
                  </p>
                  {index === 0 && showDescriptions && (
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  )}
                </div>
              </motion.div>
            ))
          }
        </AnimatePresence>
        
        {/* Indicador de pasos restantes */}
        {steps.filter(step => step.status === 'pending').length > 3 && (
          <div className="text-center text-xs text-muted-foreground py-1">
            Y {steps.filter(step => step.status === 'pending').length - 3} pasos más...
          </div>
        )}
      </div>
    </div>
  );
}