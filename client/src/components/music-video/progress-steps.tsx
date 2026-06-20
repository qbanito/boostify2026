/**
import { logger } from "../../lib/logger";
 * Componente ProgressSteps Mejorado
 * 
 * Este componente muestra un indicador visual de progreso para el flujo de trabajo de 9 pasos
 * utilizado en la creación de videos musicales profesionales, con animaciones modernas
 * y efectos visuales que muestran el proceso avanzando dinámicamente.
 * 
 * Características:
 * - Muestra los 9 pasos del flujo de trabajo con diseño responsivo
 * - Animaciones avanzadas durante transiciones entre pasos
 * - Iconos animados para representar cada tipo de actividad
 * - Efectos visuales de partículas y brillos en pasos activos
 * - Se integra con EditorContext para acceder al estado global del proyecto
 */
import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, Circle, ArrowRight, Music, FileText, 
  Timer, Layout, Palette, Move, Mic, Video, Layers,
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEditor } from '../../lib/context/editor-context';
import { motion, AnimatePresence } from 'framer-motion';

export interface Step {
  id: string;
  name: string;  // Estandarizado, antes era 'title'
  description: string;
  status?: 'pending' | 'in-progress' | 'completed' | 'skipped';  // Agregado para compatibilidad con Project.workflowData.steps
  timestamp?: Date;  // Momento en que se completó el paso
}

export interface ProgressStepsProps {
  steps: Step[];
  currentStep?: string;
  completedSteps?: string[];
  onChange?: (stepId: string) => void;
  onComplete?: (stepId: string) => void;
}

// Iconos específicos para cada paso del proceso de creación de video musical
const StepIcons = {
  'transcription': <Music className="h-5 w-5" />,
  'script': <FileText className="h-5 w-5" />,
  'sync': <Timer className="h-5 w-5" />,
  'scenes': <Layout className="h-5 w-5" />,
  'customization': <Palette className="h-5 w-5" />,
  'movement': <Move className="h-5 w-5" />,
  'lipsync': <Mic className="h-5 w-5" />,
  'generation': <Video className="h-5 w-5" />,
  'rendering': <Layers className="h-5 w-5" />
};

// Variantes para las animaciones de los pasos
const stepVariants = {
  pending: { 
    scale: 1,
    opacity: 0.7
  },
  active: { 
    scale: 1.05,
    opacity: 1,
    transition: { 
      type: "spring",
      stiffness: 300,
      damping: 20
    }
  },
  completed: { 
    scale: 1,
    opacity: 1
  }
};

// Variantes para las animaciones de la descripción
const descriptionVariants = {
  hidden: { 
    opacity: 0,
    y: 5 
  },
  visible: { 
    opacity: 1,
    y: 0,
    transition: { 
      delay: 0.2,
      duration: 0.5 
    }
  }
};

// Componentes mejorados para partículas y efectos visuales

// Partícula de brillo básica
const Particle = ({ delay = 0, color = "orange", size = 1, speed = 1 }: { 
  delay?: number, 
  color?: string, 
  size?: number,
  speed?: number 
}) => {
  // Colores disponibles para las partículas
  const colors: Record<string, string> = {
    orange: "bg-orange-400",
    purple: "bg-purple-400",
    blue: "bg-blue-400",
    teal: "bg-teal-400",
    pink: "bg-pink-400",
    green: "bg-green-400"
  };
  
  // Tamaños para las partículas
  const sizes: Record<number, string> = {
    1: "w-1 h-1",
    2: "w-1.5 h-1.5",
    3: "w-2 h-2"
  };
  
  return (
    <motion.div
      className={`absolute ${sizes[size] || "w-1 h-1"} rounded-full ${colors[color] || "bg-orange-400"}`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: [0, 1.5, 0],
        opacity: [0, 0.8, 0],
        x: [0, Math.random() * 30 - 15],
        y: [0, Math.random() * 30 - 15]
      }}
      transition={{
        duration: 2 / speed,
        delay: delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 2,
        ease: "easeInOut"
      }}
    />
  );
};

// Halo de brillo que pulsa alrededor de un elemento
const GlowHalo = ({ color = "orange" }: { color?: string }) => {
  const colors: Record<string, string> = {
    orange: "bg-orange-500/10 border-orange-500/20",
    purple: "bg-purple-500/10 border-purple-500/20",
    blue: "bg-blue-500/10 border-blue-500/20",
    teal: "bg-teal-500/10 border-teal-500/20"
  };
  
  return (
    <motion.div
      className={`absolute inset-0 rounded-full -z-10 border ${colors[color] || "bg-orange-500/10 border-orange-500/20"}`}
      initial={{ scale: 1, opacity: 0 }}
      animate={{ 
        scale: [1, 1.4, 1],
        opacity: [0.2, 0.4, 0.2]
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );
};

// Partículas giratorias para efectos más dinámicos
const OrbitingParticle = ({ delay = 0, duration = 5, distance = 20, color = "orange" }: { 
  delay?: number, 
  duration?: number,
  distance?: number,
  color?: string
}) => {
  const colors: Record<string, string> = {
    orange: "bg-orange-400",
    purple: "bg-purple-400",
    blue: "bg-blue-400",
    teal: "bg-teal-400",
    pink: "bg-pink-400"
  };
  
  return (
    <motion.div
      className={`absolute w-1.5 h-1.5 rounded-full ${colors[color] || "bg-orange-400"}`}
      initial={{ opacity: 0, rotate: 0 }}
      animate={{ 
        opacity: [0, 0.8, 0],
        // Movimiento circular
        x: Array.from({ length: 20 }).map((_, i) => distance * Math.cos(i / 19 * Math.PI * 2)),
        y: Array.from({ length: 20 }).map((_, i) => distance * Math.sin(i / 19 * Math.PI * 2)),
        scale: [0, 1, 0]
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  );
};

// Rastro que sigue al cursor en hover
const HoverTrail = () => {
  return (
    <motion.div 
      className="absolute w-full h-full overflow-hidden rounded-full pointer-events-none z-10"
      initial={{ opacity: 0 }}
      whileHover={{ opacity: 1 }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-orange-300"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0, 0.8, 0],
            scale: [0, 1.5, 0],
            x: [0, (i % 2 === 0 ? 1 : -1) * Math.random() * 15],
            y: [0, (i < 4 ? 1 : -1) * Math.random() * 15]
          }}
          transition={{
            duration: 1,
            delay: i * 0.05,
            repeat: Infinity,
            repeatDelay: 0.5
          }}
        />
      ))}
    </motion.div>
  );
};

export function ProgressSteps({
  steps,
  currentStep: propCurrentStep,
  completedSteps: propCompletedSteps,
  onChange,
  onComplete
}: ProgressStepsProps) {
  // Integración con el contexto del editor
  const { state, setCurrentStep, markStepAsCompleted, updateWorkflowData } = useEditor();
  const { project } = state;
  
  // Estado para la animación pulsante del paso activo
  const [pulseActive, setPulseActive] = useState(false);
  
  // Efecto para la animación pulsante
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setPulseActive(prev => !prev);
    }, 1500);
    
    return () => clearInterval(pulseInterval);
  }, []);
  
  // Utilizamos la nueva estructura workflowData si está disponible
  // Si no, utilizamos los campos clásicos para retrocompatibilidad
  
  let currentStepId: string = '';
  let completedStepIds: string[] = [];
  
  // Primero intentamos obtener los datos del nuevo flujo de trabajo
  if (project?.workflowData?.steps) {
    const workflowSteps = project.workflowData.steps;
    
    // El paso activo es el que tiene status 'in-progress'
    const activeStep = workflowSteps.find(s => s.status === 'in-progress');
    if (activeStep) {
      currentStepId = activeStep.id;
    }
    
    // Los pasos completados son los que tienen status 'completed'
    completedStepIds = workflowSteps
      .filter(s => s.status === 'completed')
      .map(s => s.id);
  } 
  // Como fallback, utilizamos la estructura antigua
  else {
    currentStepId = propCurrentStep || 
      (project && project.currentStep !== undefined && steps[project.currentStep] 
        ? steps[project.currentStep].id 
        : steps.length > 0 ? steps[0].id : '');
      
    completedStepIds = propCompletedSteps || 
      (project && project.completedSteps 
        ? project.completedSteps
            .map(index => steps[index]?.id)
            .filter((id): id is string => Boolean(id)) 
        : []);
  }
  
  // Manejador de clic en un paso
  const handleStepClick = (stepId: string) => {
    // Encontramos el índice del paso
    const stepIndex = steps.findIndex(step => step.id === stepId);
    if (stepIndex !== -1) {
      // Si tenemos la nueva estructura de datos, actualizamos workflowData
      if (project?.workflowData) {
        // Creamos un array de pasos actualizado para el workflowData
        const updatedSteps = steps.map(step => {
          const isTarget = step.id === stepId;
          const isCompleted = completedStepIds.includes(step.id);
          
          // Si el paso ya estaba completado, mantener 'completed'
          // Si es el paso seleccionado, marcar como 'in-progress'
          // Sino, mantener como 'pending'
          let status: 'pending' | 'in-progress' | 'completed' | 'skipped';
          
          if (isCompleted) {
            status = 'completed';
          } else if (isTarget) {
            status = 'in-progress';
          } else {
            status = 'pending';
          }
          
          return {
            id: step.id,
            status,
            timestamp: isCompleted ? new Date() : undefined
          };
        });
        
        // Actualizar workflowData con los nuevos pasos
        updateWorkflowData({ steps: updatedSteps });
      } 
      // Como fallback, usar el método clásico
      else {
        setCurrentStep(stepIndex);
      }
      
      // Llamamos al callback si existe
      if (onChange) {
        onChange(stepId);
      }
    }
  };

  // Determinar el ícono para un paso según su ID
  const getIconForStep = (stepId: string) => {
    return StepIcons[stepId as keyof typeof StepIcons] || <Circle className="h-5 w-5" />;
  };

  return (
    <div className="w-full relative">
      {/* Fondo con efecto de brillo sutil */}
      <motion.div 
        className="absolute inset-0 -z-10 bg-gradient-to-r from-orange-500/5 via-purple-500/5 to-blue-500/5 rounded-lg"
        animate={{
          background: [
            "linear-gradient(90deg, rgba(249,115,22,0.05) 0%, rgba(168,85,247,0.05) 50%, rgba(59,130,246,0.05) 100%)",
            "linear-gradient(90deg, rgba(59,130,246,0.05) 0%, rgba(249,115,22,0.05) 50%, rgba(168,85,247,0.05) 100%)",
            "linear-gradient(90deg, rgba(168,85,247,0.05) 0%, rgba(59,130,246,0.05) 50%, rgba(249,115,22,0.05) 100%)"
          ]
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      
      <div className="space-y-6 md:space-y-0 md:flex md:items-start md:gap-2 px-2 py-4 relative z-10">
        {steps.map((step, index) => {
          const isActive = step.id === currentStepId;
          const isCompleted = completedStepIds.includes(step.id);
          const isPending = !isActive && !isCompleted;
          
          // Determinar el estado de animación
          const animationState = isActive ? "active" : isCompleted ? "completed" : "pending";
          
          return (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <motion.div 
                  className="hidden md:flex md:items-center md:self-stretch"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <motion.div 
                    className={cn(
                      "h-0.5 w-8 mx-1",
                      isCompleted && index === steps.findIndex(s => s.id === currentStepId) - 1
                        ? "bg-gradient-to-r from-orange-500 to-primary"
                        : isCompleted 
                          ? "bg-primary" 
                          : "bg-muted-foreground/30"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: isCompleted ? 32 : 20 }}
                    transition={{ 
                      duration: 0.5, 
                      delay: isCompleted ? index * 0.1 : 0 
                    }}
                  />
                </motion.div>
              )}
              
              <motion.div 
                className={cn(
                  "relative flex items-start group cursor-pointer",
                  "md:flex-col md:items-center md:flex-1"
                )}
                onClick={() => handleStepClick(step.id)}
                initial="pending"
                animate={animationState}
                variants={stepVariants}
                whileHover={{ scale: 1.03 }}
              >
                {/* Contenedor del círculo y los indicadores */}
                <div className="relative">
                  <motion.div 
                    className={cn(
                      "flex h-10 w-10 mr-3 flex-shrink-0 items-center justify-center rounded-full border-2",
                      "md:mb-2 md:mr-0",
                      isActive && "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20",
                      isCompleted && "border-primary bg-primary text-primary-foreground",
                      !isActive && !isCompleted && "border-muted-foreground/50 dark:border-muted-foreground/30"
                    )}
                    animate={isActive ? {
                      boxShadow: pulseActive 
                        ? "0 0 0 3px rgba(249, 115, 22, 0.3)" 
                        : "0 0 0 0px rgba(249, 115, 22, 0)"
                    } : {}}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                  >
                    {isCompleted ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", duration: 0.5 }}
                      >
                        <CheckCircle className="h-6 w-6" />
                      </motion.div>
                    ) : (
                      <motion.div
                        animate={isActive ? {
                          scale: pulseActive ? 1.1 : 1,
                          opacity: pulseActive ? 1 : 0.8
                        } : {
                          scale: 1,
                          opacity: 0.7
                        }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        className="text-orange-500"
                      >
                        {getIconForStep(step.id)}
                      </motion.div>
                    )}
                  </motion.div>
                  
                  {/* Efectos visuales para los pasos según su estado */}
                  {isActive && (
                    <>
                      {/* Halo de brillo pulsante detrás del icono para el paso activo */}
                      <GlowHalo color="orange" />
                      
                      {/* Partículas con colores dinámicos según el tipo de paso */}
                      {step.id === 'transcription' && (
                        <>
                          <Particle delay={0} color="orange" size={2} speed={1.5} />
                          <Particle delay={0.3} color="purple" size={1} speed={1.2} />
                          <Particle delay={0.7} color="blue" size={1} speed={1} />
                          <Particle delay={1.1} color="orange" size={2} speed={0.8} />
                          <OrbitingParticle delay={0} duration={3} distance={18} color="orange" />
                        </>
                      )}
                      
                      {step.id === 'script' && (
                        <>
                          <Particle delay={0} color="blue" size={1} speed={1.2} />
                          <Particle delay={0.4} color="teal" size={2} speed={1} />
                          <Particle delay={0.8} color="purple" size={1} speed={1.5} />
                          <Particle delay={1.2} color="blue" size={1} speed={0.8} />
                          <OrbitingParticle delay={0.5} duration={4} distance={15} color="blue" />
                        </>
                      )}
                      
                      {step.id === 'sync' && (
                        <>
                          <Particle delay={0} color="teal" size={1} speed={1.8} />
                          <Particle delay={0.2} color="teal" size={2} speed={1.2} />
                          <Particle delay={0.6} color="blue" size={1} speed={1.5} />
                          <Particle delay={1} color="teal" size={1} speed={1} />
                          <OrbitingParticle delay={0} duration={2.5} distance={20} color="teal" />
                          <OrbitingParticle delay={1.2} duration={3} distance={15} color="blue" />
                        </>
                      )}
                      
                      {step.id === 'scenes' && (
                        <>
                          <Particle delay={0} color="purple" size={2} speed={1.2} />
                          <Particle delay={0.3} color="pink" size={1} speed={1.5} />
                          <Particle delay={0.7} color="purple" size={1} speed={1} />
                          <Particle delay={1.1} color="blue" size={2} speed={0.8} />
                          <OrbitingParticle delay={0.5} duration={3.5} distance={18} color="purple" />
                        </>
                      )}
                      
                      {step.id === 'customization' && (
                        <>
                          <Particle delay={0} color="pink" size={1} speed={1.5} />
                          <Particle delay={0.3} color="purple" size={2} speed={1.2} />
                          <Particle delay={0.6} color="pink" size={1} speed={1} />
                          <Particle delay={0.9} color="orange" size={1} speed={1.8} />
                          <Particle delay={1.2} color="pink" size={2} speed={0.8} />
                          <OrbitingParticle delay={0} duration={4} distance={15} color="pink" />
                        </>
                      )}
                      
                      {step.id === 'movement' && (
                        <>
                          <Particle delay={0} color="orange" size={1} speed={1.8} />
                          <Particle delay={0.2} color="pink" size={2} speed={1.5} />
                          <Particle delay={0.5} color="orange" size={1} speed={1.2} />
                          <Particle delay={0.8} color="pink" size={1} speed={1} />
                          <OrbitingParticle delay={0} duration={2} distance={18} color="orange" />
                          <OrbitingParticle delay={1} duration={3} distance={22} color="pink" />
                        </>
                      )}
                      
                      {step.id === 'lipsync' && (
                        <>
                          <Particle delay={0} color="blue" size={2} speed={1.2} />
                          <Particle delay={0.3} color="teal" size={1} speed={1.5} />
                          <Particle delay={0.7} color="blue" size={1} speed={1} />
                          <Particle delay={1} color="teal" size={1} speed={0.8} />
                          <OrbitingParticle delay={0} duration={3} distance={16} color="blue" />
                          <OrbitingParticle delay={1.5} duration={4} distance={20} color="teal" />
                        </>
                      )}
                      
                      {step.id === 'generation' && (
                        <>
                          <Particle delay={0} color="green" size={2} speed={1.5} />
                          <Particle delay={0.2} color="teal" size={1} speed={1.8} />
                          <Particle delay={0.5} color="blue" size={2} speed={1.2} />
                          <Particle delay={0.8} color="green" size={1} speed={1} />
                          <Particle delay={1.1} color="teal" size={1} speed={0.8} />
                          <OrbitingParticle delay={0} duration={2.5} distance={18} color="green" />
                          <OrbitingParticle delay={1.2} duration={3.5} distance={22} color="teal" />
                        </>
                      )}
                      
                      {step.id === 'rendering' && (
                        <>
                          <Particle delay={0} color="purple" size={1} speed={1.8} />
                          <Particle delay={0.2} color="pink" size={2} speed={1.5} />
                          <Particle delay={0.4} color="orange" size={1} speed={1.2} />
                          <Particle delay={0.6} color="blue" size={1} speed={1} />
                          <Particle delay={0.8} color="green" size={1} speed={0.8} />
                          <Particle delay={1} color="teal" size={2} speed={1.5} />
                          <OrbitingParticle delay={0} duration={2} distance={16} color="purple" />
                          <OrbitingParticle delay={1} duration={3} distance={20} color="orange" />
                          <OrbitingParticle delay={2} duration={4} distance={24} color="blue" />
                        </>
                      )}
                    </>
                  )}
                  
                  {/* Efecto especial para pasos completados */}
                  {isCompleted && (
                    <motion.div
                      className="absolute inset-0 z-10 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Particle delay={1} color="green" size={1} speed={0.5} />
                      <Particle delay={2} color="green" size={1} speed={0.7} />
                    </motion.div>
                  )}
                </div>
                
                <div className="md:text-center">
                  <motion.div 
                    className={cn(
                      "text-sm font-semibold",
                      isActive && "text-orange-500",
                      isCompleted && "text-primary",
                      isPending && "text-muted-foreground"
                    )}
                    animate={{ 
                      opacity: isActive ? 1 : isCompleted ? 0.9 : 0.7
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {step.name}
                  </motion.div>
                  
                  <AnimatePresence mode="wait">
                    <motion.p 
                      key={`desc-${step.id}`}
                      className={cn(
                        "text-xs md:hidden",
                        isActive && "text-orange-500/80",
                        isCompleted && "text-primary/80",
                        isPending && "text-muted-foreground"
                      )}
                      variants={descriptionVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                    >
                      {step.description}
                    </motion.p>
                  </AnimatePresence>
                </div>
                
                {/* Indicador de paso activo */}
                {isActive && (
                  <motion.div
                    className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 hidden md:block"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Sparkles className="h-4 w-4 text-orange-500" />
                  </motion.div>
                )}
              </motion.div>
            </React.Fragment>
          );
        })}
      </div>
      
      {/* Descripción del paso actual (visible en pantallas medianas y grandes) */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={`step-desc-${currentStepId}`}
          className="hidden md:block mt-3 text-center text-sm text-muted-foreground bg-orange-500/5 dark:bg-orange-500/10 py-2 px-4 rounded-md border border-orange-500/10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3 }}
        >
          <motion.span 
            className="text-orange-500 font-medium"
            animate={{ 
              opacity: [0.8, 1, 0.8],
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
          >
            {steps.find(step => step.id === currentStepId)?.description || ''}
          </motion.span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Definición de los pasos del flujo de trabajo para creación de videos musicales
// Nota: Definido como constante (no export) para evitar problemas de Fast Refresh de React
// Re-exportamos para uso en MusicVideoWorkflow
export const musicVideoWorkflowSteps: Step[] = [
  {
    id: 'transcription',
    name: 'Transcripción de Audio',
    description: 'Analizando y transcribiendo la letra de tu canción',
    status: 'pending'
  },
  {
    id: 'script',
    name: 'Generación de Guion',
    description: 'Creando un guion visual basado en tu música',
    status: 'pending'
  },
  {
    id: 'sync',
    name: 'Sincronización',
    description: 'Sincronizando el video con el ritmo de la música',
    status: 'pending'
  },
  {
    id: 'scenes',
    name: 'Generación de Escenas',
    description: 'Creando las escenas del video musical',
    status: 'pending'
  },
  {
    id: 'customization',
    name: 'Personalización',
    description: 'Ajustando el estilo visual a tus preferencias',
    status: 'pending'
  },
  {
    id: 'movement',
    name: 'Integración de Movimiento',
    description: 'Añadiendo coreografías y dinámicas visuales',
    status: 'pending'
  },
  {
    id: 'lipsync',
    name: 'Sincronización de Labios',
    description: 'Sincronizando labios con la letra de la canción',
    status: 'pending'
  },
  {
    id: 'generation',
    name: 'Generación de Video',
    description: 'Creando videos con IA a partir de tus escenas',
    status: 'pending'
  },
  {
    id: 'rendering',
    name: 'Renderizado Final',
    description: 'Combinando todo en tu video musical',
    status: 'pending'
  }
];