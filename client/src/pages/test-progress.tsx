import { useState, useEffect } from "react";
import { logger } from "../lib/logger";
import { motion } from "framer-motion";
import { useToast } from "../hooks/use-toast";
import { Shield, Calendar, Mail, Zap, Home, Music2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Card } from "../components/ui/card";

export default function TestProgressPage() {
  const { toast } = useToast();
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState(0);
  const [isUnderReview, setIsUnderReview] = useState(false);
  
  // Stages for creation process
  const creationStages = [
    { 
      title: "Iniciando creación", 
      description: "Preparando infraestructura para tu sello discográfico",
      icon: <Shield className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Configurando plataformas", 
      description: "Preparando integración con plataformas de distribución",
      icon: <Calendar className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Generando perfiles de artistas", 
      description: "Creando perfiles basados en tu género musical",
      icon: <Mail className="h-5 w-5 text-orange-500" />
    },
    { 
      title: "Última etapa", 
      description: "Ajustando detalles finales",
      icon: <Zap className="h-5 w-5 text-orange-500" />
    }
  ];

  // Create the record label with progress simulation
  const simulateCreation = async () => {
    setShowProgress(true);
    setProgress(0);
    setProgressStage(0);

    try {
      // Function to update progress with animation
      const updateProgress = (stage: number, progressValue: number) => {
        return new Promise<void>(resolve => {
          setProgressStage(stage);
          
          // Animate progress bar
          const interval = setInterval(() => {
            setProgress(prev => {
              if (prev >= progressValue) {
                clearInterval(interval);
                resolve();
                return prev;
              }
              return prev + 1;
            });
          }, 30);
        });
      };
      
      // Process each stage
      for (let i = 0; i < creationStages.length; i++) {
        // Calculate target progress for this stage
        const targetProgress = Math.round(((i + 1) / creationStages.length) * 100);
        
        // Update UI with current stage and animate progress
        await updateProgress(i, targetProgress);
        
        // Simulate processing time for this stage
        await new Promise(resolve => setTimeout(resolve, 
          i === creationStages.length - 1 ? 2000 : 3000)); // Last stage is shorter
      }
      
      // Show success toast
      toast({
        title: "Process Completed",
        description: "Your virtual record label is now under review!",
      });
      
      // Show "Under Review" screen
      setIsUnderReview(true);
      
    } catch (error) {
      logger.error("Error in simulation:", error);
      toast({
        title: "Error",
        description: "Could not complete the simulation. Please try again.",
        variant: "destructive"
      });
      setShowProgress(false);
    }
  };

  // Show progress overlay over normal content
  const ProgressOverlay = () => (
    <motion.div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-background w-full max-w-md rounded-xl p-8 space-y-6">
        <div className="text-center space-y-2 mb-6">
          <h2 className="text-2xl font-bold">Creating Your Record Label</h2>
          <p className="text-muted-foreground">Please wait while we set up your label.</p>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">Progress</p>
              <p className="text-sm text-muted-foreground">{progress}%</p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="flex items-center gap-4">
              {progressStage < creationStages.length && creationStages[progressStage].icon}
              <div>
                <h3 className="font-semibold">
                  {progressStage < creationStages.length && creationStages[progressStage].title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {progressStage < creationStages.length && creationStages[progressStage].description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
  
  // Under Review Screen
  const UnderReviewScreen = () => (
    <motion.div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-background w-full max-w-2xl rounded-xl p-8">
        <div className="text-center space-y-4 mb-8">
          <div className="w-16 h-16 bg-orange-500/10 rounded-full mx-auto flex items-center justify-center mb-2">
            <Shield className="h-8 w-8 text-orange-500" />
          </div>
          <h2 className="text-3xl font-bold">Your Record Label is Under Review</h2>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Our team is reviewing your submission. You'll receive an email once it's approved.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-4 space-y-2 bg-orange-500/5 border-orange-500/20">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">Review Timeline</h3>
            </div>
            <p className="text-sm text-muted-foreground">Typically within 24-48 hours</p>
          </Card>
          
          <Card className="p-4 space-y-2 bg-orange-500/5 border-orange-500/20">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">Email Notification</h3>
            </div>
            <p className="text-sm text-muted-foreground">You'll be notified once approved</p>
          </Card>
          
          <Card className="p-4 space-y-2 bg-orange-500/5 border-orange-500/20">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">Quick Start</h3>
            </div>
            <p className="text-sm text-muted-foreground">Full access to your dashboard</p>
          </Card>
        </div>
        
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            While you wait, you can explore our library of resources for record label management.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" className="flex gap-2">
              <Music2 className="h-4 w-4" />
              Resources
            </Button>
            <Button onClick={() => setIsUnderReview(false)} className="flex gap-2 bg-orange-500 hover:bg-orange-600">
              <Home className="h-4 w-4" />
              Return Home
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="container py-12">
      <h1 className="text-4xl font-bold mb-8 text-center">Test Progress Simulation</h1>
      
      <div className="flex justify-center mb-16">
        <Button 
          onClick={simulateCreation} 
          size="lg" 
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          Start Simulation
        </Button>
      </div>
      
      {showProgress && <ProgressOverlay />}
      {isUnderReview && <UnderReviewScreen />}
    </div>
  );
}