import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  ImageIcon, Loader2, CheckCircle2, AlertCircle, Zap, Pause, Play, 
  X, Clock, Camera, Film, Clapperboard, User, Sparkles, Eye,
  ChevronDown, ChevronUp, RefreshCw, Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// 🎬 Shot category types
type ShotCategory = 'PERFORMANCE' | 'B-ROLL' | 'STORY';

interface GeneratedImage {
  sceneIndex: number;
  url: string;
  prompt: string;
  timestamp: number;
  shotCategory?: ShotCategory;
  usesFaceReference?: boolean;
  qualityScore?: number;
}

interface SceneStats {
  performance: { total: number; completed: number };
  broll: { total: number; completed: number };
  story: { total: number; completed: number };
}

interface ImageGenerationModalEnhancedProps {
  isOpen: boolean;
  totalScenes: number;
  currentScene: number;
  generatedImages: GeneratedImage[];
  isGenerating: boolean;
  isPaused?: boolean;
  currentPrompt?: string;
  currentShotCategory?: ShotCategory;
  currentUsesFaceRef?: boolean;
  retryMessage?: string;
  directorName?: string;
  sceneStats?: SceneStats;
  estimatedTimePerScene?: number; // in seconds
  onClose: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRegenerateScene?: (sceneIndex: number) => void;
}

// 🎨 Category colors and icons
const categoryConfig: Record<ShotCategory, { color: string; bgColor: string; borderColor: string; icon: React.ReactNode; label: string }> = {
  PERFORMANCE: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    icon: <User className="w-4 h-4" />,
    label: 'Performance'
  },
  'B-ROLL': {
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    icon: <Film className="w-4 h-4" />,
    label: 'B-Roll'
  },
  STORY: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    icon: <Clapperboard className="w-4 h-4" />,
    label: 'Story'
  }
};

export const ImageGenerationModalEnhanced: React.FC<ImageGenerationModalEnhancedProps> = ({
  isOpen,
  totalScenes,
  currentScene,
  generatedImages,
  isGenerating,
  isPaused = false,
  currentPrompt = '',
  currentShotCategory = 'STORY',
  currentUsesFaceRef = false,
  retryMessage = '',
  directorName = 'Director',
  sceneStats,
  estimatedTimePerScene = 8,
  onClose,
  onPause,
  onResume,
  onCancel,
  onRegenerateScene
}) => {
  const [showAllImages, setShowAllImages] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | ShotCategory>('all');
  const [startTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time
  useEffect(() => {
    if (!isGenerating || isPaused) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isGenerating, isPaused, startTime]);

  // Calculate stats
  const stats = useMemo(() => {
    const completed = generatedImages.length;
    const remaining = Math.max(0, totalScenes - currentScene);
    const progress = totalScenes > 0 ? (currentScene / totalScenes) * 100 : 0;
    
    // ETA calculation
    const avgTimePerScene = completed > 0 
      ? elapsedTime / completed 
      : estimatedTimePerScene;
    const etaSeconds = Math.ceil(remaining * avgTimePerScene);
    
    // Category breakdown
    const categoryBreakdown = {
      PERFORMANCE: generatedImages.filter(img => img.shotCategory === 'PERFORMANCE').length,
      'B-ROLL': generatedImages.filter(img => img.shotCategory === 'B-ROLL').length,
      STORY: generatedImages.filter(img => img.shotCategory === 'STORY' || !img.shotCategory).length
    };

    // Face reference stats
    const withFaceRef = generatedImages.filter(img => img.usesFaceReference).length;

    return { 
      completed, 
      remaining, 
      progress, 
      etaSeconds, 
      avgTimePerScene,
      categoryBreakdown,
      withFaceRef
    };
  }, [generatedImages, totalScenes, currentScene, elapsedTime, estimatedTimePerScene]);

  // Format time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Filter images by category
  const filteredImages = useMemo(() => {
    if (selectedTab === 'all') return generatedImages;
    return generatedImages.filter(img => img.shotCategory === selectedTab);
  }, [generatedImages, selectedTab]);

  // Latest image for preview
  const latestImage = generatedImages[generatedImages.length - 1];

  const categoryInfo = categoryConfig[currentShotCategory];

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={() => {}}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white p-0">
            {/* Header */}
            <div className="p-4 border-b border-slate-700/50 bg-slate-900/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/20 border border-orange-500/30">
                    <ImageIcon className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">AI Scene Generation</h2>
                    <p className="text-xs text-slate-400">Directed by {directorName}</p>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center gap-2">
                  {isGenerating && onPause && onResume && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(
                              "h-8 w-8 p-0",
                              isPaused ? "border-green-500 text-green-400" : "border-yellow-500 text-yellow-400"
                            )}
                            onClick={isPaused ? onResume : onPause}
                          >
                            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isPaused ? 'Resume Generation' : 'Pause Generation'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {isGenerating && onCancel && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 border-red-500 text-red-400 hover:bg-red-500/20"
                            onClick={onCancel}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Cancel Generation</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Main Progress Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Current Generation Preview */}
                <div className="space-y-3">
                  {/* Live Preview */}
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-800 border-2 border-orange-500/30">
                    {latestImage ? (
                      <motion.img
                        key={latestImage.sceneIndex}
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        src={latestImage.url}
                        alt="Latest scene"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          >
                            <Sparkles className="w-12 h-12 text-orange-400 mx-auto mb-2" />
                          </motion.div>
                          <p className="text-slate-400 text-sm">Preparing first scene...</p>
                        </div>
                      </div>
                    )}

                    {/* Overlay with scene info */}
                    {latestImage && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30">
                        <div className="absolute top-2 left-2 flex gap-2">
                          <Badge className={cn("text-xs", categoryInfo.bgColor, categoryInfo.color)}>
                            {categoryInfo.icon}
                            <span className="ml-1">{categoryInfo.label}</span>
                          </Badge>
                          {currentUsesFaceRef && (
                            <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                              <User className="w-3 h-3 mr-1" />
                              Face Ref
                            </Badge>
                          )}
                        </div>
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-black/60 text-white font-bold">
                            #{currentScene}/{totalScenes}
                          </Badge>
                        </div>
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-xs text-white/80 line-clamp-2">
                            {currentPrompt.substring(0, 150)}...
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Generating indicator */}
                    {isGenerating && !isPaused && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <motion.div
                          className="w-16 h-16 rounded-full border-4 border-orange-500/30 border-t-orange-500"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                      </div>
                    )}

                    {/* Paused overlay */}
                    {isPaused && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center">
                          <Pause className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                          <p className="text-yellow-400 font-semibold">Paused</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Current prompt display */}
                  {currentPrompt && (
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                      <div className="flex items-center gap-2 mb-1">
                        <Camera className="w-4 h-4 text-orange-400" />
                        <span className="text-xs font-semibold text-slate-300">GENERATING SCENE</span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-3">{currentPrompt}</p>
                    </div>
                  )}
                </div>

                {/* Right: Stats and Progress */}
                <div className="space-y-3">
                  {/* Overall Progress */}
                  <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-300">Overall Progress</span>
                      <span className="text-lg font-bold text-orange-400">{Math.round(stats.progress)}%</span>
                    </div>
                    <Progress value={stats.progress} className="h-3 mb-3" />
                    
                    {/* Time Stats */}
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-slate-900/50 rounded-lg p-2">
                        <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                        <p className="text-xs text-slate-400">Elapsed</p>
                        <p className="text-sm font-bold text-blue-400">{formatTime(elapsedTime)}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-2">
                        <Clock className="w-4 h-4 text-green-400 mx-auto mb-1" />
                        <p className="text-xs text-slate-400">ETA</p>
                        <p className="text-sm font-bold text-green-400">~{formatTime(stats.etaSeconds)}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Category Breakdown */}
                  <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Shot Categories</h3>
                    <div className="space-y-2">
                      {(Object.keys(categoryConfig) as ShotCategory[]).map(category => {
                        const config = categoryConfig[category];
                        const count = stats.categoryBreakdown[category];
                        const targetCount = sceneStats 
                          ? (category === 'PERFORMANCE' ? sceneStats.performance.total 
                            : category === 'B-ROLL' ? sceneStats.broll.total 
                            : sceneStats.story.total)
                          : Math.ceil(totalScenes / 3);
                        const categoryProgress = targetCount > 0 ? (count / targetCount) * 100 : 0;

                        return (
                          <div key={category} className="flex items-center gap-3">
                            <div className={cn("p-1.5 rounded", config.bgColor)}>
                              {config.icon}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-1">
                                <span className={config.color}>{config.label}</span>
                                <span className="text-slate-400">{count}/{targetCount}</span>
                              </div>
                              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <motion.div
                                  className={cn("h-full rounded-full", config.bgColor.replace('/20', ''))}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, categoryProgress)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <Card className="bg-emerald-500/10 border-emerald-500/30 p-2 text-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-emerald-400">{stats.completed}</p>
                      <p className="text-[10px] text-emerald-300/70">Completed</p>
                    </Card>
                    <Card className="bg-orange-500/10 border-orange-500/30 p-2 text-center">
                      <Loader2 className="w-4 h-4 text-orange-400 mx-auto mb-1 animate-spin" />
                      <p className="text-lg font-bold text-orange-400">{isGenerating ? 1 : 0}</p>
                      <p className="text-[10px] text-orange-300/70">Processing</p>
                    </Card>
                    <Card className="bg-blue-500/10 border-blue-500/30 p-2 text-center">
                      <Eye className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-blue-400">{stats.remaining}</p>
                      <p className="text-[10px] text-blue-300/70">Remaining</p>
                    </Card>
                  </div>
                </div>
              </div>

              {/* Retry Message */}
              {retryMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2"
                >
                  <RefreshCw className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5 animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-yellow-400">Retrying Scene</p>
                    <p className="text-xs text-yellow-300/80">{retryMessage}</p>
                  </div>
                </motion.div>
              )}

              {/* Generated Images Gallery */}
              {generatedImages.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-300">
                      Generated Scenes ({generatedImages.length})
                    </h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setShowAllImages(!showAllImages)}
                    >
                      {showAllImages ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                      {showAllImages ? 'Show Less' : 'Show All'}
                    </Button>
                  </div>

                  {/* Category Tabs */}
                  <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
                    <TabsList className="bg-slate-800/50 h-8">
                      <TabsTrigger value="all" className="text-xs h-6">All</TabsTrigger>
                      <TabsTrigger value="PERFORMANCE" className="text-xs h-6">
                        <User className="w-3 h-3 mr-1" />
                        Performance
                      </TabsTrigger>
                      <TabsTrigger value="B-ROLL" className="text-xs h-6">
                        <Film className="w-3 h-3 mr-1" />
                        B-Roll
                      </TabsTrigger>
                      <TabsTrigger value="STORY" className="text-xs h-6">
                        <Clapperboard className="w-3 h-3 mr-1" />
                        Story
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Image Grid */}
                  <ScrollArea className={cn("pr-2", showAllImages ? "h-64" : "h-28")}>
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                      {filteredImages.map((img) => {
                        const imgCategory = img.shotCategory || 'STORY';
                        const imgConfig = categoryConfig[imgCategory];
                        
                        return (
                          <motion.div
                            key={img.sceneIndex}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative aspect-video rounded-lg overflow-hidden border border-slate-600 bg-slate-800 group cursor-pointer hover:border-orange-500/50 transition-all"
                          >
                            <img
                              src={img.url}
                              alt={`Scene ${img.sceneIndex}`}
                              className="w-full h-full object-cover"
                            />
                            
                            {/* Category indicator */}
                            <div className={cn(
                              "absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center",
                              imgConfig.bgColor
                            )}>
                              {React.cloneElement(imgConfig.icon as React.ReactElement, { className: 'w-2.5 h-2.5' })}
                            </div>

                            {/* Scene number */}
                            <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1 text-[10px] font-bold text-white">
                              {img.sceneIndex}
                            </div>

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              {onRegenerateScene && (
                                <button
                                  className="p-1 rounded bg-orange-500/20 hover:bg-orange-500/40"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRegenerateScene(img.sceneIndex);
                                  }}
                                >
                                  <RefreshCw className="w-3 h-3 text-orange-400" />
                                </button>
                              )}
                            </div>

                            {/* Face ref indicator */}
                            {img.usesFaceReference && (
                              <div className="absolute top-1 right-1 w-4 h-4 rounded bg-purple-500/30 flex items-center justify-center">
                                <User className="w-2.5 h-2.5 text-purple-400" />
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Pro Tips */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  💡 <strong>Pro Tip:</strong> Each scene uses {directorName}'s signature style with cinematographic 
                  details including camera angles, lighting, and color grading. Face references are automatically 
                  applied to Performance and Story shots for consistency.
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-700/50 bg-slate-900/80">
              {!isGenerating ? (
                <Button
                  onClick={onClose}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold"
                >
                  Continue to Timeline
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-slate-600"
                    onClick={onClose}
                  >
                    Run in Background
                  </Button>
                  {isPaused && (
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={onResume}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Resume
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default ImageGenerationModalEnhanced;
