import React, { useState, useEffect } from "react";
import { logger } from "../../lib/logger";
import { motion } from "framer-motion";
import { Button } from "../../components/ui/button";
import { toast } from "../../components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../../components/ui/card";

// Definición de tipos
export interface Step {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped' | 'error';
  detail?: string;
}

export interface EnhancedWorkflowProps {
  steps: Step[];
  currentStepId: string;
  onStepChange?: (stepId: string) => void;
  onComplete?: () => void;
  autoProgress?: boolean;
  showControls?: boolean;
}

// Sistema de particulas 
interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  opacity: number;
}

// Componente para mostrar partículas
const ParticleSystem = ({ 
  count = 30, 
  stage = 'default',
  active = true
}: { 
  count?: number;
  stage?: string;
  active?: boolean;
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  
  // Diferentes configuraciones de colores para cada etapa
  const stageColors: Record<string, string[]> = {
    default: ['#f97316', '#8b5cf6', '#3b82f6'],
    upload: ['#f97316', '#eab308', '#ec4899'],
    process: ['#8b5cf6', '#3b82f6', '#06b6d4'],
    generate: ['#06b6d4', '#10b981', '#eab308'],
    complete: ['#f97316', '#eab308', '#10b981', '#ec4899']
  };
  
  const colors = stageColors[stage] || stageColors.default;
  
  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }
    
    const newParticles = Array.from({ length: count }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 8 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * 0.5 + 0.1,
      opacity: Math.random() * 0.7 + 0.3
    }));
    
    setParticles(newParticles);
    
    const interval = setInterval(() => {
      setParticles(prev => prev.map(p => ({
        ...p,
        y: (p.y - p.speed) % 100,
        x: p.x + (Math.random() - 0.5) * p.speed,
        opacity: Math.max(0.2, Math.min(1, p.opacity + (Math.random() - 0.5) * 0.1))
      })));
    }, 50);
    
    return () => clearInterval(interval);
  }, [count, colors, active, stage]);
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            opacity: p.opacity,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: i * 0.02 }}
        />
      ))}
    </div>
  );
};

// Componente de efecto de brillo
const GlowEffect = ({ 
  color = '#f97316', 
  intensity = 20, 
  pulse = true,
  size = 250
}: {
  color?: string;
  intensity?: number;
  pulse?: boolean;
  size?: number;
}) => {
  return (
    <motion.div 
      className="absolute rounded-full pointer-events-none z-0"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 ${intensity}px ${intensity/2}px ${color}`,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
      animate={pulse ? {
        boxShadow: [
          `0 0 ${intensity}px ${intensity/2}px ${color}`,
          `0 0 ${intensity*1.5}px ${intensity}px ${color}`,
          `0 0 ${intensity}px ${intensity/2}px ${color}`
        ]
      } : undefined}
      transition={pulse ? {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      } : undefined}
    />
  );
};

// Componente principal de flujo de trabajo mejorado
export const EnhancedWorkflow = ({
  steps,
  currentStepId,
  onStepChange,
  onComplete,
  autoProgress = false,
  showControls = true
}: EnhancedWorkflowProps) => {
  const [activeStep, setActiveStep] = useState<Step | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('default');
  
  // Encontrar el índice del paso actual
  const currentIndex = steps.findIndex(step => step.id === currentStepId);
  const currentStep = steps[currentIndex];
  
  // Configurar el paso activo cuando cambia currentStepId
  useEffect(() => {
    const step = steps.find(s => s.id === currentStepId);
    if (step) {
      setActiveStep(step);
      
      // Determinar la etapa para efectos visuales
      if (step.id.includes('upload')) {
        setStage('upload');
      } else if (step.id.includes('process')) {
        setStage('process');
      } else if (step.id.includes('generate')) {
        setStage('generate');
      } else if (step.id.includes('complete')) {
        setStage('complete');
      } else {
        setStage('default');
      }
    }
  }, [currentStepId, steps]);
  
  // Simular progreso automático si está habilitado
  useEffect(() => {
    if (!autoProgress || !activeStep) return;
    
    let interval: NodeJS.Timeout;
    
    if (activeStep.status === 'in-progress') {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + Math.random() * 5;
          if (newProgress >= 100) {
            clearInterval(interval);
            
            // Pasar al siguiente paso después de completarse
            const nextIndex = currentIndex + 1;
            if (nextIndex < steps.length) {
              setTimeout(() => {
                onStepChange?.(steps[nextIndex].id);
              }, 500);
            } else {
              onComplete?.();
            }
            
            return 100;
          }
          return newProgress;
        });
      }, 300);
    }
    
    return () => clearInterval(interval);
  }, [activeStep, autoProgress, currentIndex, steps, onStepChange, onComplete]);
  
  // Avanzar al siguiente paso
  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      onStepChange?.(steps[nextIndex].id);
    } else {
      onComplete?.();
    }
  };
  
  // Retroceder al paso anterior
  const handlePrevious = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      onStepChange?.(steps[prevIndex].id);
    }
  };
  
  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl relative overflow-hidden">
      {/* Efectos visuales de fondo */}
      <div className="absolute inset-0 bg-gradient-to-br from-background to-background/70 z-0"></div>
      <div className="absolute inset-0 opacity-30">
        <ParticleSystem count={40} stage={stage} active={true} />
      </div>
      <GlowEffect 
        color={
          stage === 'upload' ? '#f97316' : 
          stage === 'process' ? '#8b5cf6' : 
          stage === 'generate' ? '#06b6d4' : 
          stage === 'complete' ? '#10b981' : 
          '#f97316'
        } 
        intensity={30}
        size={300}
      />
      
      {/* Contenido principal */}
      <CardHeader className="relative z-10">
        <CardTitle className="text-2xl font-bold tracking-tight text-center">
          <motion.div
            key={currentStepId}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {activeStep?.name || 'Flujo de trabajo animado'}
          </motion.div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="relative z-10">
        {/* Descripción del paso actual */}
        <motion.div
          key={`desc-${currentStepId}`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-muted-foreground text-center mb-8"
        >
          {activeStep?.description}
        </motion.div>
        
        {/* Indicador de pasos */}
        <div className="flex justify-center mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <motion.div 
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm
                  ${index < currentIndex ? 'bg-primary text-primary-foreground' : 
                    index === currentIndex ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' : 
                    'bg-muted text-muted-foreground'}`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onStepChange?.(step.id)}
              >
                {index < currentIndex ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                ) : (index + 1)}
              </motion.div>
              
              {index < steps.length - 1 && (
                <div 
                  className={`h-1 w-12 ${
                    index < currentIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                ></div>
              )}
            </div>
          ))}
        </div>
        
        {/* Barra de progreso para el paso actual */}
        {activeStep?.status === 'in-progress' && (
          <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden mb-6">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            ></motion.div>
          </div>
        )}
        
        {/* Detalles adicionales */}
        {activeStep?.detail && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card p-4 border rounded-lg mt-4 text-sm"
          >
            {activeStep.detail}
          </motion.div>
        )}
      </CardContent>
      
      {/* Controles */}
      {showControls && (
        <CardFooter className="relative z-10 flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            Anterior
          </Button>
          
          <Button
            onClick={handleNext}
            disabled={currentIndex === steps.length - 1 && !onComplete}
          >
            {currentIndex === steps.length - 1 ? 'Finalizar' : 'Siguiente'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

// Componente de demostración que gestiona su propio estado
export const DemoEnhancedWorkflow = () => {
  const [steps] = useState<Step[]>([
    { 
      id: 'upload', 
      name: 'Subir contenido', 
      description: 'Selecciona o sube el contenido audiovisual para tu video', 
      status: 'completed',
      detail: 'Imágenes y videos procesados correctamente'
    },
    { 
      id: 'process', 
      name: 'Procesar medios', 
      description: 'Optimizando y preparando tus archivos multimedia', 
      status: 'completed',
      detail: '5 archivos procesados exitosamente'
    },
    { 
      id: 'generate', 
      name: 'Generar video', 
      description: 'Creando tu video con efectos visuales y transiciones', 
      status: 'in-progress' 
    },
    { 
      id: 'enhance', 
      name: 'Mejorar calidad', 
      description: 'Aplicando mejoras de calidad y estabilización', 
      status: 'pending' 
    },
    { 
      id: 'complete', 
      name: 'Finalizar', 
      description: 'Tu video está listo para descargar o compartir', 
      status: 'pending' 
    }
  ]);
  
  const [currentStepId, setCurrentStepId] = useState('generate');
  
  const handleComplete = () => {
    toast({
      title: "¡Flujo de trabajo completado!",
      description: "Todos los pasos se han completado exitosamente.",
    });
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center">Flujo de Trabajo Animado</h1>
      
      <EnhancedWorkflow
        steps={steps}
        currentStepId={currentStepId}
        onStepChange={(stepId) => {
          setCurrentStepId(stepId);
        }}
        onComplete={handleComplete}
        autoProgress={false}
        showControls={true}
      />
      
      <div className="mt-8 p-4 bg-card rounded-lg border">
        <h2 className="text-lg font-semibold mb-2">Información del componente</h2>
        <p className="text-muted-foreground mb-2">
          Este es un componente de demostración que muestra un flujo de trabajo con efectos visuales mejorados.
          Incluye sistema de partículas, efectos de brillo y animaciones fluidas entre pasos.
        </p>
        <p className="text-muted-foreground">
          El componente puede ser configurado para avanzar automáticamente o permitir control manual,
          y se adapta visualmente a cada etapa del proceso.
        </p>
      </div>
    </div>
  );
};

export default DemoEnhancedWorkflow;