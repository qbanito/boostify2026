/**
 * 🎬 Pre-Generation Review Panel
 * Permite revisar y editar escenas antes de generar imágenes
 * - Lista de escenas con prompts editables
 * - Toggle para incluir/excluir escenas
 * - Estimación de costo y tiempo
 * - Selector de calidad (draft/normal/premium)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, EyeOff, Edit2, Check, X, Clock, DollarSign, Zap,
  Camera, Film, Clapperboard, User, ChevronDown, ChevronUp,
  Settings2, Play, AlertCircle, Sparkles, RefreshCw, Save,
  Filter, Search, Grid3x3, List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type ShotCategory = 'PERFORMANCE' | 'B-ROLL' | 'STORY';
type QualityLevel = 'draft' | 'normal' | 'premium';

interface SceneToGenerate {
  id: string;
  sceneNumber: number;
  prompt: string;
  shotCategory: ShotCategory;
  shotType: string;
  emotion: string;
  usesFaceReference: boolean;
  enabled: boolean;
  lyrics?: string;
  location?: string;
  duration: number;
}

interface PreGenerationPanelProps {
  isOpen: boolean;
  scenes: SceneToGenerate[];
  directorName: string;
  totalDuration: number;
  onClose: () => void;
  onStartGeneration: (scenes: SceneToGenerate[], settings: GenerationSettings) => void;
  onUpdateScene: (sceneId: string, updates: Partial<SceneToGenerate>) => void;
}

interface GenerationSettings {
  qualityLevel: QualityLevel;
  batchSize: number;
  enableQualityCheck: boolean;
  autoRegenerate: boolean;
  prioritizePerformance: boolean;
}

// Category configs
const categoryConfig: Record<ShotCategory, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  PERFORMANCE: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    icon: <User className="w-4 h-4" />,
    label: 'Performance'
  },
  'B-ROLL': {
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    icon: <Film className="w-4 h-4" />,
    label: 'B-Roll'
  },
  STORY: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    icon: <Clapperboard className="w-4 h-4" />,
    label: 'Story'
  }
};

// Quality level configs
const qualityConfig: Record<QualityLevel, { 
  label: string; 
  description: string; 
  timeMultiplier: number; 
  costMultiplier: number;
  resolution: string;
}> = {
  draft: {
    label: 'Draft',
    description: 'Fast preview quality',
    timeMultiplier: 0.5,
    costMultiplier: 0.5,
    resolution: '512x288'
  },
  normal: {
    label: 'Normal',
    description: 'Standard quality',
    timeMultiplier: 1,
    costMultiplier: 1,
    resolution: '1024x576'
  },
  premium: {
    label: 'Premium',
    description: 'Highest quality',
    timeMultiplier: 2,
    costMultiplier: 1.5,
    resolution: '1920x1080'
  }
};

// Estimation constants
const BASE_TIME_PER_IMAGE = 8; // seconds
const BASE_COST_PER_IMAGE = 0.02; // dollars

export function PreGenerationPanel({
  isOpen,
  scenes,
  directorName,
  totalDuration,
  onClose,
  onStartGeneration,
  onUpdateScene
}: PreGenerationPanelProps) {
  // Local state
  const [localScenes, setLocalScenes] = useState<SceneToGenerate[]>(scenes);
  const [settings, setSettings] = useState<GenerationSettings>({
    qualityLevel: 'normal',
    batchSize: 3,
    enableQualityCheck: true,
    autoRegenerate: true,
    prioritizePerformance: true
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | ShotCategory>('all');
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'compact'>('list');
  const [showSettings, setShowSettings] = useState(false);

  // Update local scenes when props change
  React.useEffect(() => {
    setLocalScenes(scenes);
  }, [scenes]);

  // Filter scenes
  const filteredScenes = useMemo(() => {
    return localScenes.filter(scene => {
      const matchesSearch = searchQuery === '' || 
        scene.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scene.lyrics?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = filterCategory === 'all' || scene.shotCategory === filterCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [localScenes, searchQuery, filterCategory]);

  // Calculate statistics
  const stats = useMemo(() => {
    const enabledScenes = localScenes.filter(s => s.enabled);
    const qualityMultiplier = qualityConfig[settings.qualityLevel];
    
    const categoryBreakdown = {
      PERFORMANCE: enabledScenes.filter(s => s.shotCategory === 'PERFORMANCE').length,
      'B-ROLL': enabledScenes.filter(s => s.shotCategory === 'B-ROLL').length,
      STORY: enabledScenes.filter(s => s.shotCategory === 'STORY').length
    };

    const withFaceRef = enabledScenes.filter(s => s.usesFaceReference).length;
    
    const estimatedTime = Math.ceil(
      enabledScenes.length * BASE_TIME_PER_IMAGE * qualityMultiplier.timeMultiplier / settings.batchSize
    );
    
    const estimatedCost = (
      enabledScenes.length * BASE_COST_PER_IMAGE * qualityMultiplier.costMultiplier
    ).toFixed(2);

    return {
      total: localScenes.length,
      enabled: enabledScenes.length,
      disabled: localScenes.length - enabledScenes.length,
      categoryBreakdown,
      withFaceRef,
      estimatedTime,
      estimatedCost
    };
  }, [localScenes, settings]);

  // Toggle scene enabled
  const toggleScene = useCallback((sceneId: string) => {
    setLocalScenes(prev => prev.map(s => 
      s.id === sceneId ? { ...s, enabled: !s.enabled } : s
    ));
  }, []);

  // Toggle all scenes
  const toggleAll = useCallback((enabled: boolean) => {
    setLocalScenes(prev => prev.map(s => ({ ...s, enabled })));
  }, []);

  // Toggle by category
  const toggleCategory = useCallback((category: ShotCategory, enabled: boolean) => {
    setLocalScenes(prev => prev.map(s => 
      s.shotCategory === category ? { ...s, enabled } : s
    ));
  }, []);

  // Update scene prompt
  const updateScenePrompt = useCallback((sceneId: string, prompt: string) => {
    setLocalScenes(prev => prev.map(s => 
      s.id === sceneId ? { ...s, prompt } : s
    ));
    onUpdateScene(sceneId, { prompt });
  }, [onUpdateScene]);

  // Handle start generation
  const handleStart = useCallback(() => {
    const enabledScenes = localScenes.filter(s => s.enabled);
    
    // Sort by priority if enabled
    if (settings.prioritizePerformance) {
      enabledScenes.sort((a, b) => {
        const priority: Record<ShotCategory, number> = {
          PERFORMANCE: 0,
          STORY: 1,
          'B-ROLL': 2
        };
        return priority[a.shotCategory] - priority[b.shotCategory];
      });
    }

    onStartGeneration(enabledScenes, settings);
    onClose();
  }, [localScenes, settings, onStartGeneration, onClose]);

  // Format time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20 border border-orange-500/30">
                <Eye className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Pre-Generation Review</DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Review and customize scenes before generating • Directed by {directorName}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings2 className="w-4 h-4 mr-1" />
                Settings
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row h-[calc(90vh-180px)]">
          {/* Main content - Scene list */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="p-3 border-b border-slate-700/50 space-y-2">
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search scenes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 bg-slate-800 border-slate-600"
                  />
                </div>

                {/* Category filter */}
                <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)}>
                  <SelectTrigger className="w-36 h-8 bg-slate-800 border-slate-600">
                    <Filter className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="PERFORMANCE">Performance</SelectItem>
                    <SelectItem value="B-ROLL">B-Roll</SelectItem>
                    <SelectItem value="STORY">Story</SelectItem>
                  </SelectContent>
                </Select>

                {/* View mode */}
                <div className="flex items-center gap-1 bg-slate-800 rounded p-1">
                  <Button
                    size="sm"
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    className="h-6 w-6 p-0"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'compact' ? 'default' : 'ghost'}
                    className="h-6 w-6 p-0"
                    onClick={() => setViewMode('compact')}
                  >
                    <Grid3x3 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Quick:</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => toggleAll(true)}>
                  Select All
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => toggleAll(false)}>
                  Deselect All
                </Button>
                <div className="h-4 w-px bg-slate-600" />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 text-xs text-purple-400"
                  onClick={() => toggleCategory('PERFORMANCE', true)}
                >
                  All Performance
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 text-xs text-cyan-400"
                  onClick={() => toggleCategory('B-ROLL', true)}
                >
                  All B-Roll
                </Button>
              </div>
            </div>

            {/* Scene list */}
            <ScrollArea className="flex-1">
              <div className={cn(
                "p-3 space-y-2",
                viewMode === 'compact' && "grid grid-cols-2 gap-2 space-y-0"
              )}>
                {filteredScenes.map((scene) => {
                  const config = categoryConfig[scene.shotCategory];
                  const isEditing = editingSceneId === scene.id;

                  return (
                    <motion.div
                      key={scene.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "rounded-lg border transition-all",
                        scene.enabled 
                          ? "bg-slate-800/50 border-slate-600" 
                          : "bg-slate-900/50 border-slate-700/50 opacity-60"
                      )}
                    >
                      <div className="p-3">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox
                            checked={scene.enabled}
                            onCheckedChange={() => toggleScene(scene.id)}
                          />
                          
                          <Badge className={cn("text-xs", config.bgColor, config.color)}>
                            {config.icon}
                            <span className="ml-1">{config.label}</span>
                          </Badge>
                          
                          <span className="text-xs text-slate-400">
                            Scene #{scene.sceneNumber}
                          </span>
                          
                          <span className="text-xs text-slate-500">
                            {scene.duration}s
                          </span>

                          {scene.usesFaceReference && (
                            <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                              <User className="w-3 h-3 mr-1" />
                              Face
                            </Badge>
                          )}

                          <div className="flex-1" />

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => setEditingSceneId(isEditing ? null : scene.id)}
                          >
                            {isEditing ? <Check className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
                          </Button>
                        </div>

                        {/* Content */}
                        {viewMode === 'list' && (
                          <>
                            {isEditing ? (
                              <Textarea
                                value={scene.prompt}
                                onChange={(e) => updateScenePrompt(scene.id, e.target.value)}
                                className="text-xs bg-slate-700 border-slate-600 min-h-[80px]"
                                autoFocus
                              />
                            ) : (
                              <p className="text-xs text-slate-300 line-clamp-2">
                                {scene.prompt}
                              </p>
                            )}

                            {scene.lyrics && (
                              <p className="text-xs text-slate-500 mt-1 italic line-clamp-1">
                                🎵 "{scene.lyrics}"
                              </p>
                            )}
                          </>
                        )}

                        {viewMode === 'compact' && (
                          <p className="text-xs text-slate-400 line-clamp-1">
                            {scene.prompt.substring(0, 50)}...
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Sidebar - Stats & Settings */}
          <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-700/50 bg-slate-900/50 p-4 space-y-4 overflow-y-auto">
            {/* Summary Stats */}
            <Card className="bg-slate-800/50 border-slate-700 p-3">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Generation Summary</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Selected Scenes</span>
                  <span className="font-bold text-white">{stats.enabled} / {stats.total}</span>
                </div>
                
                <div className="h-px bg-slate-700" />
                
                {/* Category breakdown */}
                {(Object.keys(categoryConfig) as ShotCategory[]).map(cat => {
                  const config = categoryConfig[cat];
                  return (
                    <div key={cat} className="flex items-center justify-between text-xs">
                      <span className={cn("flex items-center gap-1", config.color)}>
                        {config.icon}
                        {config.label}
                      </span>
                      <span className="text-slate-300">{stats.categoryBreakdown[cat]}</span>
                    </div>
                  );
                })}

                <div className="h-px bg-slate-700" />

                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-400 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    With Face Reference
                  </span>
                  <span className="text-slate-300">{stats.withFaceRef}</span>
                </div>
              </div>
            </Card>

            {/* Estimations */}
            <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/30 p-3">
              <h3 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Estimation
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Estimated Time
                  </span>
                  <span className="text-sm font-bold text-white">~{formatTime(stats.estimatedTime)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Estimated Cost
                  </span>
                  <span className="text-sm font-bold text-green-400">${stats.estimatedCost}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Quality Level
                  </span>
                  <Badge className="text-xs">{qualityConfig[settings.qualityLevel].label}</Badge>
                </div>
              </div>
            </Card>

            {/* Settings Panel */}
            <Collapsible open={showSettings} onOpenChange={setShowSettings}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-8 text-xs">
                  <span className="flex items-center gap-1">
                    <Settings2 className="w-3 h-3" />
                    Generation Settings
                  </span>
                  {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                {/* Quality Level */}
                <div className="space-y-2">
                  <Label className="text-xs">Quality Level</Label>
                  <Select 
                    value={settings.qualityLevel} 
                    onValueChange={(v) => setSettings(s => ({ ...s, qualityLevel: v as QualityLevel }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(qualityConfig) as QualityLevel[]).map(level => (
                        <SelectItem key={level} value={level}>
                          <span className="flex flex-col">
                            <span>{qualityConfig[level].label}</span>
                            <span className="text-[10px] text-slate-400">{qualityConfig[level].description}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Batch Size */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Parallel Generation</Label>
                    <span className="text-xs text-slate-400">{settings.batchSize} at once</span>
                  </div>
                  <Slider
                    value={[settings.batchSize]}
                    onValueChange={([v]) => setSettings(s => ({ ...s, batchSize: v }))}
                    min={1}
                    max={5}
                    step={1}
                    className="py-2"
                  />
                </div>

                {/* Toggles */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Quality Check</Label>
                    <Switch
                      checked={settings.enableQualityCheck}
                      onCheckedChange={(v) => setSettings(s => ({ ...s, enableQualityCheck: v }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Auto-Regenerate</Label>
                    <Switch
                      checked={settings.autoRegenerate}
                      onCheckedChange={(v) => setSettings(s => ({ ...s, autoRegenerate: v }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Priority: Performance</Label>
                    <Switch
                      checked={settings.prioritizePerformance}
                      onCheckedChange={(v) => setSettings(s => ({ ...s, prioritizePerformance: v }))}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
              <p className="text-[10px] text-blue-300">
                💡 Tip: Disable scenes you want to skip. You can always generate them later from the timeline.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {stats.enabled} scenes selected • ~{formatTime(stats.estimatedTime)} • ${stats.estimatedCost}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="border-slate-600">
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                disabled={stats.enabled === 0}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                <Play className="w-4 h-4 mr-2" />
                Generate {stats.enabled} Scenes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PreGenerationPanel;
