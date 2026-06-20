import { motion } from "framer-motion";
import { Clipboard, Clock, CheckCircle2, ChevronRight, Shield, Eye } from "lucide-react";
import { Button } from "./ui/button";

/**
 * Enhanced Under Review Screen Component
 * 
 * Shows a full-screen overlay with information about the review process
 * after a record label has been created and submitted for review
 */
export default function UnderReviewScreen() {
  const steps = [
    {
      id: "create",
      title: "Creation Complete",
      description: "Your Virtual Record Label has been created successfully",
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      status: "completed"
    },
    {
      id: "verify",
      title: "Verification Process",
      description: "Our system verifies your label configuration",
      icon: <Shield className="h-5 w-5 text-orange-500" />,
      status: "completed"
    },
    {
      id: "review",
      title: "Under Review",
      description: "Your configuration is being reviewed by our team",
      icon: <Eye className="h-5 w-5 text-blue-500" />,
      status: "in-progress"
    },
    {
      id: "launch",
      title: "Launch",
      description: "Your label will go live after approval",
      icon: <ChevronRight className="h-5 w-5 text-gray-400" />,
      status: "pending"
    }
  ];

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <motion.div 
        className="max-w-xl w-full bg-card rounded-xl shadow-xl border border-border overflow-hidden"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="p-6 sm:p-8">
          <div className="mb-6 text-center">
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-500 mb-4"
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <Clipboard className="h-8 w-8" />
            </motion.div>
            
            <motion.h2
              className="text-2xl sm:text-3xl font-bold mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              Label Under Review
            </motion.h2>
            
            <motion.p
              className="text-muted-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              Your Virtual Record Label is being reviewed by our team. This process typically takes 24-48 hours.
            </motion.p>
          </div>
          
          <motion.div
            className="border rounded-lg p-4 mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-2 text-sm">
              <div className="font-medium">Estimated Approval Time</div>
              <div className="flex items-center text-muted-foreground">
                <Clock className="h-4 w-4 mr-1" />
                <span>24-48 hours</span>
              </div>
            </div>
            
            <div className="relative h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="absolute top-0 left-0 h-full bg-orange-500"
                initial={{ width: "0%" }}
                animate={{ width: "40%" }}
                transition={{ delay: 0.5, duration: 2 }}
              />
            </div>
          </motion.div>
          
          <div className="space-y-4 mb-8">
            {steps.map((step, i) => (
              <motion.div 
                key={step.id}
                className="flex items-start gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + (i * 0.1), duration: 0.4 }}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
                  step.status === "completed" 
                    ? "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-500" 
                    : step.status === "in-progress"
                      ? "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                }`}>
                  {step.icon}
                </div>
                
                <div className="flex-1">
                  <h3 className={`font-medium ${
                    step.status === "completed" 
                      ? "text-green-600 dark:text-green-500" 
                      : step.status === "in-progress"
                        ? "text-blue-600 dark:text-blue-500"
                        : "text-muted-foreground"
                  }`}>
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                
                {step.status === "in-progress" && (
                  <div className="flex-shrink-0 relative w-5 h-5 mt-1">
                    <motion.div 
                      className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
            >
              Contact Support
            </Button>
            <Button 
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              View Dashboard
            </Button>
          </div>
        </div>
        
        <motion.div
          className="bg-orange-500/5 border-t border-orange-500/10 p-4 text-sm text-center text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          This is a simulation for demo purposes. In a production environment, review usually takes 24-48 hours.
        </motion.div>
      </motion.div>
    </div>
  );
}