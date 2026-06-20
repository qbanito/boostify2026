import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "./ui/progress";
import { CloudUpload, Film, Users, Megaphone, BarChart2, Shield, DollarSign, Zap } from "lucide-react";

interface ProgressOverlayProps {
  progress?: number;
  stage?: number;
  onComplete?: () => void;
}

/**
 * Enhanced Progress Overlay Component
 * 
 * Shows a full-screen overlay with animated progress stages during the record label creation process
 */
export default function ProgressOverlay({ 
  progress = 0, 
  stage = 0, 
  onComplete
}: ProgressOverlayProps) {
  const [localProgress, setLocalProgress] = useState(0);
  const [localStage, setLocalStage] = useState(0);
  
  // Stages for creation process with modern icons
  const creationStages = [
    { 
      title: "Setup AI Music Engine", 
      description: "Configuring AI algorithms for music composition and audio mastering",
      icon: <CloudUpload className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Video Generation Framework", 
      description: "Setting up AI-powered video creation for artists through PiAPI",
      icon: <Film className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "AI Artist Generation", 
      description: "Creating virtual artists with GPT-based personalities and backstories",
      icon: <Users className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "CRM Integration", 
      description: "Configuring contact management system for industry professionals",
      icon: <Megaphone className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Analytics Dashboard", 
      description: "Setting up performance tracking and insights for your label",
      icon: <BarChart2 className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Digital Rights Management", 
      description: "Implementing protection systems for your intellectual property",
      icon: <Shield className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Distribution Network", 
      description: "Connecting to global streaming platforms and music marketplaces",
      icon: <DollarSign className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Finalizing Launch", 
      description: "Last touches before your virtual record label goes live",
      icon: <Zap className="h-5 w-5 text-orange-500" />
    }
  ];
  
  // Simulate progress animation for demo
  useEffect(() => {
    if (progress >= 100 && stage >= creationStages.length - 1) {
      // Complete process after a short delay at 100%
      setTimeout(() => {
        onComplete?.();
      }, 500);
      return;
    }
    
    // Setting local values for animated progress changes
    setLocalProgress(progress);
    setLocalStage(stage);
    
  }, [progress, stage, onComplete]);
  
  // Simulation for demo purposes - delete in production
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let currentProgress = 0;
    let currentStage = 0;
    
    const simulateProgress = () => {
      timer = setInterval(() => {
        currentProgress += 5;
        
        if (currentProgress >= 100) {
          clearInterval(timer);
          currentProgress = 0;
          currentStage++;
          
          if (currentStage < creationStages.length) {
            setLocalStage(currentStage);
            simulateProgress();
          } else {
            setTimeout(() => {
              onComplete?.();
            }, 500);
          }
        }
        
        setLocalProgress(currentProgress);
      }, 120);
    };
    
    simulateProgress();
    
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <motion.div 
        className="max-w-xl w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-10">
          <motion.h2 
            className="text-2xl sm:text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-orange-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            Creating Your Virtual Record Label
          </motion.h2>
          <motion.p 
            className="text-muted-foreground max-w-md mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Please wait while we configure your AI-powered label. This may take a few moments.
          </motion.p>
        </div>
        
        <div className="relative mb-8">
          <Progress value={localProgress} className="h-3 bg-gray-200 dark:bg-gray-800" />
          <div 
            className="absolute -top-1 left-0 h-5 w-5 rounded-full bg-orange-500"
            style={{ 
              left: `calc(${localProgress}% - 10px)`,
              display: localProgress > 1 ? 'block' : 'none',
              transition: 'left 0.3s ease-in-out'
            }}
          />
        </div>
        
        <div className="space-y-5">
          {creationStages.map((step, index) => (
            <motion.div 
              key={index}
              className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                index === localStage 
                  ? 'bg-orange-500/10 border border-orange-500/20' 
                  : index < localStage 
                    ? 'bg-gray-100/10 dark:bg-gray-800/10 border border-gray-200/20 dark:border-gray-700/20 opacity-60' 
                    : 'opacity-30'
              }`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: index <= localStage ? 1 : 0.3, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                index === localStage 
                  ? 'bg-orange-500/20 text-orange-500' 
                  : index < localStage 
                    ? 'bg-green-500/20 text-green-500' 
                    : 'bg-gray-200/20 dark:bg-gray-800/20 text-gray-400 dark:text-gray-600'
              }`}>
                {index < localStage ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.icon
                )}
              </div>
              
              <div className="flex-1">
                <h3 className={`font-medium ${
                  index === localStage 
                    ? 'text-orange-500' 
                    : index < localStage 
                      ? 'text-green-500' 
                      : 'text-muted-foreground'
                }`}>
                  {step.title}
                </h3>
                
                <AnimatePresence>
                  {index === localStage && (
                    <motion.p 
                      className="text-sm text-muted-foreground mt-1"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {step.description}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              
              {index === localStage && (
                <div className="flex-shrink-0 relative w-6 h-6">
                  <motion.div 
                    className="absolute inset-0 rounded-full border-2 border-orange-500 border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>
        
        <motion.div 
          className="mt-10 text-center text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          This is a simulation for demo purposes. In a production environment, this process would connect to actual AI services.
        </motion.div>
      </motion.div>
    </div>
  );
}