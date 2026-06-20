import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ImageIcon, Loader2, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface GeneratedImage {
  sceneIndex: number;
  url: string;
  prompt: string;
  timestamp: number;
}

interface ImageGenerationModalProps {
  isOpen: boolean;
  totalScenes: number;
  currentScene: number;
  generatedImages: GeneratedImage[];
  isGenerating: boolean;
  currentPrompt?: string;
  retryMessage?: string;
  onClose: () => void;
}

export const ImageGenerationModal: React.FC<ImageGenerationModalProps> = ({
  isOpen,
  totalScenes,
  currentScene,
  generatedImages,
  isGenerating,
  currentPrompt = '',
  retryMessage = '',
  onClose
}) => {
  const progress = (currentScene / totalScenes) * 100;
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-2xl bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-orange-500/20 border border-orange-500/30">
                  <ImageIcon className="w-5 h-5 text-orange-500" />
                </div>
                AI-Powered Scene Generation
              </DialogTitle>
            </DialogHeader>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6 py-4"
            >
              {/* Main Spinner */}
              <motion.div variants={itemVariants} className="flex justify-center py-4">
                <div className="relative w-24 h-24">
                  <motion.div
                    className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 border-r-orange-400"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                  <motion.div
                    className="absolute inset-2 rounded-full border-4 border-transparent border-b-purple-500 border-l-purple-400"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Zap className="w-8 h-8 text-orange-400" />
                  </div>
                </div>
              </motion.div>

              {/* Status Title */}
              <motion.div variants={itemVariants} className="text-center">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                  Creating Visual Scenes
                </h2>
                <p className="text-slate-400 mt-2">
                  {isGenerating ? 'Generating unique visuals based on your selected style' : 'Processing complete'}
                </p>
              </motion.div>

              {/* Progress Bar */}
              <motion.div variants={itemVariants} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-300">
                    Scene {currentScene} of {totalScenes}
                  </span>
                  <Badge variant="outline" className="border-orange-500/30 text-orange-400">
                    {Math.round(progress)}%
                  </Badge>
                </div>
                <Progress value={progress} className="h-2" />
              </motion.div>

              {/* Status Cards */}
              <motion.div variants={itemVariants} className="grid grid-cols-3 gap-2">
                <Card className="bg-slate-700/50 border-slate-600 p-3 text-center">
                  <div className="text-sm text-slate-400">Generated</div>
                  <div className="text-xl font-bold text-emerald-400">{generatedImages.length}</div>
                </Card>
                <Card className="bg-slate-700/50 border-slate-600 p-3 text-center">
                  <div className="text-sm text-slate-400">Processing</div>
                  <div className="text-xl font-bold text-orange-400">
                    {isGenerating ? currentScene : totalScenes}
                  </div>
                </Card>
                <Card className="bg-slate-700/50 border-slate-600 p-3 text-center">
                  <div className="text-sm text-slate-400">Remaining</div>
                  <div className="text-xl font-bold text-blue-400">
                    {Math.max(0, totalScenes - currentScene)}
                  </div>
                </Card>
              </motion.div>

              {/* Current Prompt */}
              {currentPrompt && (
                <motion.div
                  variants={itemVariants}
                  className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-3 max-h-24 overflow-y-auto"
                >
                  <p className="text-xs text-slate-400 font-semibold mb-1">CURRENT SCENE DESCRIPTION</p>
                  <p className="text-sm text-slate-300 leading-relaxed line-clamp-4">
                    {currentPrompt.substring(0, 300)}...
                  </p>
                </motion.div>
              )}

              {/* Retry Message */}
              {retryMessage && (
                <motion.div
                  variants={itemVariants}
                  className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2"
                >
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-400">Retrying Failed Scene</p>
                    <p className="text-xs text-yellow-300/80">{retryMessage}</p>
                  </div>
                </motion.div>
              )}

              {/* Generated Images Grid */}
              {generatedImages.length > 0 && (
                <motion.div variants={itemVariants}>
                  <p className="text-sm font-semibold text-slate-300 mb-3">GENERATED SCENES ({generatedImages.length})</p>
                  <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto pr-2">
                    {generatedImages.map((img) => (
                      <motion.div
                        key={img.sceneIndex}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative aspect-video rounded-lg overflow-hidden border border-orange-500/30 bg-slate-800"
                      >
                        <img
                          src={img.url}
                          alt={`Scene ${img.sceneIndex}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1 text-xs font-bold text-orange-400">
                          {img.sceneIndex}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Info Messages */}
              <motion.div variants={itemVariants} className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  💡 Pro Tip: Each scene is generated with cinematographic details including camera angles, lighting, and color grading
                </p>
              </motion.div>

              {/* Action Button */}
              {!isGenerating && (
                <motion.div variants={itemVariants}>
                  <Button
                    onClick={onClose}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold"
                  >
                    Continue to Timeline
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default ImageGenerationModal;
