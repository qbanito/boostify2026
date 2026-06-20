import { Briefcase, Brain, Sparkles, Target, Trophy, TrendingUp } from "lucide-react";
import { logger } from "@/lib/logger";
import { BaseAgent, type AgentAction, type AgentTheme } from "./base-agent";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProgressIndicator } from "./progress-indicator";
import { MusicLoadingSpinner } from "../ui/music-loading-spinner";

const containerVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20, y: 10 },
  visible: { 
    opacity: 1, 
    x: 0,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 10
    }
  }
};

interface Step {
  message: string;
  timestamp: Date;
}

export function CareerDevelopmentAgent() {
  const [isThinking, setIsThinking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);

  const theme: AgentTheme = {
    gradient: "from-purple-500 via-indigo-500 to-blue-500",
    iconColor: "text-white",
    accentColor: "#8B5CF6",
    personality: "🚀 Career Strategist"
  };

  const simulateThinking = async () => {
    setIsThinking(true);
    setProgress(0);
    setSteps([]);

    const simulatedSteps = [
      "Initializing neural pathways...",
      "Analyzing career trajectory data...",
      "Processing industry trends...",
      "Evaluating market opportunities...",
      "Generating personalized insights...",
      "Optimizing career recommendations...",
      "Finalizing development strategy..."
    ];

    for (let i = 0; i < simulatedSteps.length; i++) {
      setSteps(prev => [...prev, {
        message: simulatedSteps[i],
        timestamp: new Date()
      }]);
      setProgress(Math.round((i + 1) * (100 / simulatedSteps.length)));
      await new Promise(resolve => setTimeout(resolve, 1800));
    }

    setIsThinking(false);
  };

  const actions: AgentAction[] = [
    {
      name: "Career path analysis",
      description: "Analyze and optimize your career trajectory",
      parameters: [
        {
          name: "focus",
          type: "select",
          label: "Career Focus",
          description: "Select your primary career focus area",
          options: [
            { value: "artist", label: "Recording Artist" },
            { value: "producer", label: "Music Producer" },
            { value: "songwriter", label: "Songwriter" },
            { value: "manager", label: "Artist Manager" },
          ],
          defaultValue: "artist"
        },
        {
          name: "experience",
          type: "select",
          label: "Experience Level",
          description: "Your current level of experience",
          options: [
            { value: "beginner", label: "Beginner (0-2 years)" },
            { value: "intermediate", label: "Intermediate (2-5 years)" },
            { value: "advanced", label: "Advanced (5+ years)" },
          ],
          defaultValue: "intermediate"
        }
      ],
      action: async (params) => {
        await simulateThinking();
        logger.info("Analyzing career path:", params);
      }
    },
    {
      name: "Skill development plan",
      description: "Create a personalized skill development roadmap",
      parameters: [
        {
          name: "skillArea",
          type: "select",
          label: "Skill Area",
          description: "Choose the area for skill development",
          options: [
            { value: "technical", label: "Technical Skills" },
            { value: "business", label: "Business Skills" },
            { value: "creative", label: "Creative Skills" },
            { value: "leadership", label: "Leadership Skills" },
          ],
          defaultValue: "technical"
        }
      ],
      action: async (params) => {
        await simulateThinking();
        logger.info("Creating skill development plan:", params);
      }
    }
  ];

  return (
    <div className="relative">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative"
      >
        <AnimatePresence>
          {isThinking && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.02, 1]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                exit={{ opacity: 0 }}
                className="absolute -inset-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 rounded-xl opacity-75 blur-xl"
                style={{ zIndex: -1 }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
              >
                <MusicLoadingSpinner size="lg" variant="subtle" />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <BaseAgent
          name="Career Development AI"
          description="Your personal career strategist and development advisor"
          icon={Brain}
          actions={actions}
          theme={theme}
          helpText="I'm your Career Strategist AI, dedicated to helping you navigate and accelerate your music industry career. Using advanced analytics and industry insights, I'll help you make strategic decisions and develop the skills needed for success. Let's build your path to stardom! 🌟"
        >
          <AnimatePresence mode="wait">
            {(isThinking || steps.length > 0) && (
              <motion.div
                key="progress"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                <ProgressIndicator
                  steps={steps}
                  progress={progress}
                  isThinking={isThinking}
                  isComplete={progress === 100}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </BaseAgent>
      </motion.div>
    </div>
  );
}