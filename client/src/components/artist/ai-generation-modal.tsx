import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import {
  Sparkles,
  Music,
  Image,
  ShoppingBag,
  User,
  Zap,
  Wand2,
  CheckCircle2,
  Loader2,
  Brain,
  Palette,
  Mic2,
  Package,
  Coins
} from 'lucide-react';

interface GenerationStep {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'pending' | 'active' | 'completed';
}

interface AIGenerationModalProps {
  isOpen: boolean;
  isGenerating: boolean; // Estado real de la mutación
  onClose?: () => void;
  artistName?: string;
}

const initialSteps: GenerationStep[] = [
  {
    id: 'profile',
    title: 'Creating Identity',
    subtitle: 'Generating unique artist profile...',
    icon: User,
    status: 'pending'
  },
  {
    id: 'bio',
    title: 'Writing Biography',
    subtitle: 'AI-powered narrative creation...',
    icon: Brain,
    status: 'pending'
  },
  {
    id: 'images',
    title: 'Designing Images',
    subtitle: 'Creating professional visuals...',
    icon: Image,
    status: 'pending'
  },
  {
    id: 'style',
    title: 'Defining Style',
    subtitle: 'Color palette and aesthetics...',
    icon: Palette,
    status: 'pending'
  },
  {
    id: 'music',
    title: 'Composing Music',
    subtitle: 'Generating 3 songs with vocals...',
    icon: Mic2,
    status: 'pending'
  },
  {
    id: 'merchandise',
    title: 'Creating Merchandise',
    subtitle: '6 exclusive products...',
    icon: Package,
    status: 'pending'
  },
  {
    id: 'blockchain',
    title: 'Tokenizing on Blockchain',
    subtitle: 'Registering on BoostiSwap...',
    icon: Coins,
    status: 'pending'
  }
];

// Dynamic texts that change during generation
const dynamicTexts = [
  "Analyzing music trends...",
  "Calibrating AI algorithms...",
  "Synthesizing artificial creativity...",
  "Optimizing sound frequencies...",
  "Processing visual styles...",
  "Generating unique identity...",
  "Building artistic universe...",
  "Merging creative data...",
  "Rendering future visions...",
  "Compiling artistic DNA..."
];

export function AIGenerationModal({ isOpen, isGenerating, onClose, artistName }: AIGenerationModalProps) {
  const [steps, setSteps] = useState<GenerationStep[]>(initialSteps);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dynamicText, setDynamicText] = useState(dynamicTexts[0]);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const startTimeRef = useRef<number>(0);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  // Reset cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      // Generar partículas
      const newParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 2
      }));
      setParticles(newParticles);
      
      // Reset estado
      setSteps(initialSteps.map((step, i) => ({
        ...step,
        status: i === 0 ? 'active' : 'pending'
      })));
      setCurrentStepIndex(0);
      setProgress(0);
      setIsComplete(false);
      startTimeRef.current = Date.now();
    }
  }, [isOpen]);

  // Sincronizar con el estado real de la mutación
  useEffect(() => {
    if (!isOpen) return;

    // Cuando isGenerating cambia a false, significa que terminó (éxito o error)
    if (!isGenerating && startTimeRef.current > 0) {
      // Marcar como completado
      setIsComplete(true);
      setProgress(100);
      setSteps(prev => prev.map(step => ({ ...step, status: 'completed' })));
      
      // Cerrar modal después de mostrar animación de éxito
      const closeTimeout = setTimeout(() => {
        if (onClose) onClose();
      }, 2000);

      return () => clearTimeout(closeTimeout);
    }
  }, [isGenerating, isOpen, onClose]);

  // Animate steps while generating
  useEffect(() => {
    if (!isOpen || !isGenerating) return;

    // Approximate times based on real server process:
    // Total estimated: ~60 seconds (including blockchain registration)
    // These times are visual estimates, actual close depends on isGenerating
    const stepDurations = [3000, 4000, 10000, 2000, 18000, 12000, 8000];
    const timeouts: NodeJS.Timeout[] = [];
    let accumulatedTime = 0;

    stepDurations.forEach((duration, index) => {
      if (index === 0) {
        // First step is already active
        accumulatedTime = duration;
        return;
      }

      timeouts.push(setTimeout(() => {
        if (!isComplete) {
          setCurrentStepIndex(index);
          setSteps(prev => prev.map((step, i) => ({
            ...step,
            status: i < index ? 'completed' : i === index ? 'active' : 'pending'
          })));
        }
      }, accumulatedTime));

      accumulatedTime += duration;
    });

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [isOpen, isGenerating, isComplete]);

  // Update progress bar continuously while generating
  useEffect(() => {
    if (!isOpen || !isGenerating || isComplete) return;
    
    // Estimated total time: ~60 seconds
    const estimatedTotalTime = 60000;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      // Max progress 95% until actually complete
      const calculatedProgress = Math.min((elapsed / estimatedTotalTime) * 100, 95);
      setProgress(calculatedProgress);
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen, isGenerating, isComplete]);

  // Change dynamic text while generating
  useEffect(() => {
    if (!isOpen || !isGenerating) return;

    const interval = setInterval(() => {
      setDynamicText(dynamicTexts[Math.floor(Math.random() * dynamicTexts.length)]);
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen, isGenerating]);

  const currentStep = steps[currentStepIndex];
  const completedSteps = steps.filter(s => s.status === 'completed').length;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-2xl bg-black/95 border-orange-500/30 overflow-hidden p-0" aria-describedby="ai-generation-description">
        {/* Accessibility - hidden but present for screen readers */}
        <DialogTitle className="sr-only">Generating AI Artist</DialogTitle>
        <DialogDescription id="ai-generation-description" className="sr-only">
          AI artist generation process in progress
        </DialogDescription>
        {/* Fondo con partículas */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Grid futurista */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(249,115,22,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.03)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
          
          {/* Partículas flotantes */}
          {particles.map(particle => (
            <motion.div
              key={particle.id}
              className="absolute w-1 h-1 bg-orange-500/60 rounded-full"
              initial={{ 
                left: `${particle.x}%`, 
                top: `${particle.y}%`,
                opacity: 0 
              }}
              animate={{ 
                y: [-20, 20, -20],
                opacity: [0.3, 0.8, 0.3],
                scale: [1, 1.5, 1]
              }}
              transition={{ 
                duration: 3 + particle.delay,
                repeat: Infinity,
                ease: "easeInOut",
                delay: particle.delay
              }}
            />
          ))}

          {/* Orbes de luz */}
          <motion.div
            className="absolute -top-20 -right-20 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl"
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-20 -left-20 w-64 h-64 bg-orange-600/15 rounded-full blur-3xl"
            animate={{ 
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 5, repeat: Infinity }}
          />
        </div>

        <div className="relative z-10 p-8">
          {/* Header */}
          <motion.div 
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              {isComplete ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </motion.div>
              ) : (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-8 h-8 text-orange-500" />
                  </motion.div>
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <Wand2 className="w-8 h-8 text-orange-500" />
                  </motion.div>
                </>
              )}
            </div>
            <h2 className={`text-2xl font-bold bg-clip-text text-transparent ${
              isComplete 
                ? 'bg-gradient-to-r from-green-400 via-green-500 to-emerald-500'
                : 'bg-gradient-to-r from-orange-400 via-orange-500 to-red-500'
            }`}>
              {isComplete ? 'Artist Created Successfully!' : 'Creating Your AI Artist'}
            </h2>
            
            {/* Dynamic text */}
            <AnimatePresence mode="wait">
              <motion.p
                key={isComplete ? 'complete' : dynamicText}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`text-sm font-mono mt-2 ${isComplete ? 'text-green-400' : 'text-gray-400'}`}
              >
                {isComplete 
                  ? `${artistName || 'Your artist'} is ready to conquer the world`
                  : dynamicText}
              </motion.p>
            </AnimatePresence>
          </motion.div>

          {/* Icono central animado */}
          <div className="flex justify-center mb-8">
            <motion.div
              className="relative"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {/* Anillos orbitales */}
              <motion.div
                className="absolute inset-0 w-32 h-32 border-2 border-orange-500/30 rounded-full"
                style={{ margin: '-10px' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-0 w-36 h-36 border border-orange-500/20 rounded-full"
                style={{ margin: '-20px' }}
                animate={{ rotate: -360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />
              
              {/* Icono del paso actual */}
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/40 flex items-center justify-center backdrop-blur-sm">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep?.id}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    {currentStep && (
                      <currentStep.icon className="w-14 h-14 text-orange-500" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* Paso actual destacado */}
          <motion.div
            className="text-center mb-8"
            key={currentStep?.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <h3 className="text-xl font-semibold text-white mb-1">
              {currentStep?.title}
            </h3>
            <p className="text-orange-400/80 text-sm">
              {currentStep?.subtitle}
            </p>
          </motion.div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 via-orange-400 to-red-500"
                style={{ width: `${progress}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Lista de pasos */}
          <div className="grid grid-cols-2 gap-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border transition-all duration-300
                  ${step.status === 'completed' 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : step.status === 'active'
                    ? 'bg-orange-500/10 border-orange-500/50 shadow-lg shadow-orange-500/10'
                    : 'bg-gray-900/50 border-gray-800'}
                `}
              >
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  ${step.status === 'completed' 
                    ? 'bg-green-500/20' 
                    : step.status === 'active'
                    ? 'bg-orange-500/20'
                    : 'bg-gray-800'}
                `}>
                  {step.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : step.status === 'active' ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="w-4 h-4 text-orange-400" />
                    </motion.div>
                  ) : (
                    <step.icon className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    step.status === 'completed' 
                      ? 'text-green-400' 
                      : step.status === 'active'
                      ? 'text-orange-400'
                      : 'text-gray-500'
                  }`}>
                    {step.title}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <motion.div
            className="mt-6 pt-4 border-t border-gray-800 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-xs text-gray-500">
              <Zap className="w-3 h-3 inline mr-1 text-orange-500" />
              Powered by <span className="text-orange-400">Boostify AI Engine</span> • FAL + OpenAI
            </p>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AIGenerationModal;
