import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ImageIcon, CheckCircle2, Loader2, AlertCircle, RefreshCw, 
  Edit, Trash2, Copy, Star, Grid3x3, List, Search, Filter,
  ChevronDown, ChevronUp, Maximize2, X, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, MoreVertical, Check, Download, Eye, EyeOff,
  Move, ArrowUpDown, Clock, Sparkles, Video as VideoIcon,
  User, Film, Clapperboard, Wand2, Shield, Gauge
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { TimelineItem } from "../timeline/TimelineClipUnified";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Progress } from "../ui/progress";
import { Checkbox } from "../ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useToast } from "../../hooks/use-toast";

type ViewMode = 'grid' | 'list';
type GridSize = 'small' | 'medium' | 'large';
type FilterMode = 'all' | 'completed' | 'pending' | 'error' | 'low-quality';
type SortMode = 'time' | 'title' | 'status' | 'quality';
type GroupMode = 'none' | 'shotType' | 'role' | 'status' | 'category';
type ShotCategory = 'PERFORMANCE' | 'B-ROLL' | 'STORY';

// Shot category visual config
const categoryConfig: Record<ShotCategory, { 
  color: string; 
  bgColor: string; 
  icon: React.ReactNode; 
  label: string;
  borderColor: string;
}> = {
  PERFORMANCE: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/50',
    icon: <User className="w-3 h-3" />,
    label: 'Performance'
  },
  'B-ROLL': {
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/50',
    icon: <Film className="w-3 h-3" />,
    label: 'B-Roll'
  },
  STORY: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/50',
    icon: <Clapperboard className="w-3 h-3" />,
    label: 'Story'
  }
};

// Quality score visualization
const getQualityInfo = (score: number): { color: string; label: string; icon: React.ReactNode } => {
  if (score >= 80) return { color: 'text-green-400', label: 'Excellent', icon: <Shield className="w-3 h-3" /> };
  if (score >= 60) return { color: 'text-blue-400', label: 'Good', icon: <CheckCircle2 className="w-3 h-3" /> };
  if (score >= 40) return { color: 'text-yellow-400', label: 'Fair', icon: <Gauge className="w-3 h-3" /> };
  return { color: 'text-red-400', label: 'Low', icon: <AlertCircle className="w-3 h-3" /> };
};

interface EnhancedScenesGalleryProps {
  scenes: TimelineItem[];
  currentTime?: number;
  onSceneClick?: (scene: TimelineItem, index: number) => void;
  onRegenerateScene?: (sceneId: number | string) => void;
  onEditScene?: (scene: TimelineItem) => void;
  onDeleteScene?: (sceneId: number | string) => void;
  onReorderScenes?: (scenes: TimelineItem[]) => void;
  onUseAsReference?: (scene: TimelineItem) => void; // NEW: Use image as face reference
  generatingScenes?: Set<number | string>;
  qualityScores?: Map<string | number, number>; // NEW: Quality scores from validation
}

export function EnhancedScenesGallery({
  scenes,
  currentTime = 0,
  onSceneClick,
  onRegenerateScene,
  onEditScene,
  onDeleteScene,
  onReorderScenes,
  onUseAsReference,
  generatingScenes = new Set(),
  qualityScores = new Map()
}: EnhancedScenesGalleryProps) {
  const { toast } = useToast();
  
  // UI States
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  
  // Selection
  const [selectedScenes, setSelectedScenes] = useState<Set<number | string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Lightbox
  const [lightboxScene, setLightboxScene] = useState<{ scene: TimelineItem; index: number } | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  
  // Comparison
  const [compareMode, setCompareMode] = useState(false);
  const [compareScenes, setCompareScenes] = useState<TimelineItem[]>([]);

  // Statistics with category breakdown and quality info
  const stats = useMemo(() => {
    const completed = scenes.filter(s => s.imageUrl || s.thumbnail).length;
    const generating = scenes.filter(s => generatingScenes.has(s.id)).length;
    const pending = scenes.length - completed - generating;
    const progress = scenes.length > 0 ? (completed / scenes.length) * 100 : 0;
    
    // Category breakdown
    const categoryBreakdown = {
      PERFORMANCE: scenes.filter(s => s.metadata?.shotCategory === 'PERFORMANCE').length,
      'B-ROLL': scenes.filter(s => s.metadata?.shotCategory === 'B-ROLL' || !s.metadata?.shotCategory).length,
      STORY: scenes.filter(s => s.metadata?.shotCategory === 'STORY').length
    };

    // Quality stats
    let lowQualityCount = 0;
    let avgQuality = 0;
    let qualitySum = 0;
    let qualityCount = 0;
    
    scenes.forEach(s => {
      const score = qualityScores.get(s.id);
      if (score !== undefined) {
        qualitySum += score;
        qualityCount++;
        if (score < 60) lowQualityCount++;
      }
    });
    
    if (qualityCount > 0) {
      avgQuality = Math.round(qualitySum / qualityCount);
    }
    
    return { 
      completed, 
      generating, 
      pending, 
      progress, 
      total: scenes.length,
      categoryBreakdown,
      lowQualityCount,
      avgQuality
    };
  }, [scenes, generatingScenes, qualityScores]);

  // Filter, Search & Sort
  const filteredAndSortedScenes = useMemo(() => {
    let filtered = [...scenes];
    
    // Filter by status
    if (filterMode === 'completed') {
      filtered = filtered.filter(s => s.imageUrl || s.thumbnail);
    } else if (filterMode === 'pending') {
      filtered = filtered.filter(s => !s.imageUrl && !s.thumbnail && !generatingScenes.has(s.id));
    } else if (filterMode === 'error') {
      filtered = filtered.filter(s => s.metadata?.error);
    } else if (filterMode === 'low-quality') {
      // NEW: Filter by low quality score
      filtered = filtered.filter(s => {
        const score = qualityScores.get(s.id);
        return score !== undefined && score < 60;
      });
    }
    
    // Search
    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.shotType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.metadata?.shotCategory?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      if (sortMode === 'time') {
        return (a.start_time || 0) - (b.start_time || 0);
      } else if (sortMode === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      } else if (sortMode === 'status') {
        const getStatus = (s: TimelineItem) => {
          if (s.imageUrl || s.thumbnail) return 0;
          if (generatingScenes.has(s.id)) return 1;
          return 2;
        };
        return getStatus(a) - getStatus(b);
      } else if (sortMode === 'quality') {
        // NEW: Sort by quality score (lowest first for easy regeneration)
        const scoreA = qualityScores.get(a.id) ?? 50;
        const scoreB = qualityScores.get(b.id) ?? 50;
        return scoreA - scoreB;
      }
      return 0;
    });
    
    return filtered;
  }, [scenes, filterMode, searchQuery, sortMode, generatingScenes, qualityScores]);

  // Helper to get shot category from scene
  const getSceneCategory = useCallback((scene: TimelineItem): ShotCategory => {
    return (scene.metadata?.shotCategory as ShotCategory) || 'B-ROLL';
  }, []);

  // Group scenes
  const groupedScenes = useMemo(() => {
    if (groupMode === 'none') return { 'All Scenes': filteredAndSortedScenes };
    
    const groups: Record<string, TimelineItem[]> = {};
    
    filteredAndSortedScenes.forEach(scene => {
      let key = 'Other';
      if (groupMode === 'shotType') {
        key = scene.shotType || 'No Shot Type';
      } else if (groupMode === 'role') {
        key = scene.metadata?.role || 'No Role';
      } else if (groupMode === 'status') {
        if (scene.imageUrl || scene.thumbnail) key = 'Completed';
        else if (generatingScenes.has(scene.id)) key = 'Generating';
        else key = 'Pending';
      } else if (groupMode === 'category') {
        // NEW: Group by shot category
        key = getSceneCategory(scene);
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(scene);
    });
    
    return groups;
  }, [filteredAndSortedScenes, groupMode, generatingScenes, getSceneCategory]);

  // Grid columns based on size
  const gridCols = {
    small: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
    medium: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
    large: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  };

  // Scene status
  const getSceneStatus = (scene: TimelineItem) => {
    if (scene.metadata?.error) return 'error';
    if (generatingScenes.has(scene.id)) return 'generating';
    if (scene.imageUrl || scene.thumbnail) return 'completed';
    return 'pending';
  };

  // Handlers
  const handleToggleSelection = (sceneId: number | string) => {
    setSelectedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedScenes.size === filteredAndSortedScenes.length) {
      setSelectedScenes(new Set());
    } else {
      setSelectedScenes(new Set(filteredAndSortedScenes.map(s => s.id)));
    }
  };

  const handleBatchRegenerate = () => {
    if (!onRegenerateScene) return;
    selectedScenes.forEach(id => onRegenerateScene(id));
    toast({
      title: "Regenerating scenes",
      description: `${selectedScenes.size} scenes queued for regeneration`,
    });
    setSelectedScenes(new Set());
    setIsSelectionMode(false);
  };

  const handleBatchDelete = () => {
    if (!onDeleteScene) return;
    selectedScenes.forEach(id => onDeleteScene(id));
    toast({
      title: "Scenes deleted",
      description: `${selectedScenes.size} scenes removed`,
    });
    setSelectedScenes(new Set());
    setIsSelectionMode(false);
  };

  const handleCopyPrompt = (scene: TimelineItem) => {
    const prompt = scene.description || scene.imagePrompt || scene.title || '';
    navigator.clipboard.writeText(prompt);
    toast({
      title: "Prompt copied",
      description: "Copied to clipboard",
    });
  };

  const openLightbox = (scene: TimelineItem, index: number) => {
    setLightboxScene({ scene, index });
    setLightboxZoom(1);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!lightboxScene) return;
    const currentIndex = lightboxScene.index;
    const newIndex = direction === 'prev' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(filteredAndSortedScenes.length - 1, currentIndex + 1);
    
    if (newIndex !== currentIndex) {
      setLightboxScene({ scene: filteredAndSortedScenes[newIndex], index: newIndex });
      setLightboxZoom(1);
    }
  };

  const toggleCompare = (scene: TimelineItem) => {
    setCompareScenes(prev => {
      const exists = prev.find(s => s.id === scene.id);
      if (exists) {
        return prev.filter(s => s.id !== scene.id);
      } else if (prev.length < 4) {
        return [...prev, scene];
      }
      return prev;
    });
  };

  return (
    <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Generated Scenes</h3>
            <Badge variant="secondary">
              {stats.completed} / {stats.total}
            </Badge>
            {stats.generating > 0 && (
              <Badge className="bg-blue-500">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {stats.generating} generating
              </Badge>
            )}
            {/* NEW: Category breakdown badges */}
            <div className="hidden md:flex items-center gap-1 ml-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className={cn("text-[10px]", categoryConfig.PERFORMANCE.bgColor, categoryConfig.PERFORMANCE.color)}>
                      {categoryConfig.PERFORMANCE.icon}
                      <span className="ml-1">{stats.categoryBreakdown.PERFORMANCE}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">Performance shots</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className={cn("text-[10px]", categoryConfig['B-ROLL'].bgColor, categoryConfig['B-ROLL'].color)}>
                      {categoryConfig['B-ROLL'].icon}
                      <span className="ml-1">{stats.categoryBreakdown['B-ROLL']}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">B-Roll shots</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className={cn("text-[10px]", categoryConfig.STORY.bgColor, categoryConfig.STORY.color)}>
                      {categoryConfig.STORY.icon}
                      <span className="ml-1">{stats.categoryBreakdown.STORY}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">Story shots</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {/* NEW: Low quality warning */}
            {stats.lowQualityCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {stats.lowQualityCount} low quality
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    {stats.lowQualityCount} images need regeneration
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-black/40 rounded-md p-1">
              <Button
                size="sm"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                className="h-7 w-7 p-0"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                className="h-7 w-7 p-0"
                onClick={() => setViewMode('list')}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Expand/Collapse */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-white/60 mb-1">
            <span>Overall Progress</span>
            <span>{Math.round(stats.progress)}%</span>
          </div>
          <Progress value={stats.progress} className="h-2" />
        </div>

        {isExpanded && (
          <>
            {/* Search & Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
              {/* Search */}
              <div className="relative md:col-span-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                <Input
                  placeholder="Search scenes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-black/40 border-white/10"
                />
              </div>

              {/* Filter */}
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
                <SelectTrigger className="h-8 text-xs bg-black/40 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scenes</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="low-quality">
                    <span className="flex items-center gap-1 text-yellow-400">
                      <AlertCircle className="h-3 w-3" />
                      Low Quality
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger className="h-8 text-xs bg-black/40 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Sort by Time</SelectItem>
                  <SelectItem value="title">Sort by Title</SelectItem>
                  <SelectItem value="status">Sort by Status</SelectItem>
                  <SelectItem value="quality">Sort by Quality ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grid Size & Actions */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {viewMode === 'grid' && (
                  <Select value={gridSize} onValueChange={(v) => setGridSize(v as GridSize)}>
                    <SelectTrigger className="h-7 w-24 text-xs bg-black/40 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Select value={groupMode} onValueChange={(v) => setGroupMode(v as GroupMode)}>
                  <SelectTrigger className="h-7 w-32 text-xs bg-black/40 border-white/10">
                    <SelectValue placeholder="Group by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="category">
                      <span className="flex items-center gap-1">
                        <Film className="h-3 w-3" />
                        By Category
                      </span>
                    </SelectItem>
                    <SelectItem value="shotType">By Shot Type</SelectItem>
                    <SelectItem value="role">By Role</SelectItem>
                    <SelectItem value="status">By Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                {/* Selection Mode */}
                <Button
                  size="sm"
                  variant={isSelectionMode ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    if (isSelectionMode) setSelectedScenes(new Set());
                  }}
                >
                  {isSelectionMode ? (
                    <>
                      <X className="h-3 w-3 mr-1" />
                      Exit
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Select
                    </>
                  )}
                </Button>

                {isSelectionMode && selectedScenes.size > 0 && (
                  <div className="flex items-center gap-1 bg-blue-500/20 border border-blue-500/30 rounded px-2 py-1">
                    <span className="text-xs text-blue-300">{selectedScenes.size} selected</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 text-xs px-2"
                      onClick={handleSelectAll}
                    >
                      All
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 text-xs px-2"
                      onClick={handleBatchRegenerate}
                      disabled={!onRegenerateScene}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Regen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 text-xs px-2 text-red-400"
                      onClick={handleBatchDelete}
                      disabled={!onDeleteScene}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Compare Mode */}
                {compareScenes.length > 0 && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    onClick={() => setCompareMode(true)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Compare ({compareScenes.length})
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Gallery Content */}
      {isExpanded && (
        <ScrollArea className={cn(
          "transition-all",
          viewMode === 'grid' ? 'h-[400px]' : 'h-[500px]'
        )}>
          <div className="p-4">
            {Object.entries(groupedScenes).map(([groupName, groupScenes]) => (
              <div key={groupName} className="mb-6 last:mb-0">
                {groupMode !== 'none' && (
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-xs font-semibold text-white/80">{groupName}</h4>
                    <Badge variant="outline" className="text-[10px]">
                      {groupScenes.length}
                    </Badge>
                  </div>
                )}

                <div className={cn(
                  viewMode === 'grid' ? `grid ${gridCols[gridSize]} gap-3` : 'space-y-2'
                )}>
                  {groupScenes.map((scene, index) => {
                    const status = getSceneStatus(scene);
                    const hasImage = scene.imageUrl || scene.thumbnail;
                    const isSelected = selectedScenes.has(scene.id);
                    const isComparing = compareScenes.find(s => s.id === scene.id);
                    const globalIndex = filteredAndSortedScenes.findIndex(s => s.id === scene.id);
                    
                    // NEW: Get category and quality info
                    const sceneCategory = getSceneCategory(scene);
                    const catConfig = categoryConfig[sceneCategory];
                    const qualityScore = qualityScores.get(scene.id);
                    const qualityInfo = qualityScore !== undefined ? getQualityInfo(qualityScore) : null;

                    return (
                      <motion.div
                        key={scene.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className={cn(
                          "relative group cursor-pointer",
                          isSelected && "ring-2 ring-blue-400",
                          isComparing && "ring-2 ring-green-400"
                        )}
                      >
                        {viewMode === 'grid' ? (
                          // Grid View
                          <div
                            className="relative"
                            onClick={() => {
                              if (isSelectionMode) {
                                handleToggleSelection(scene.id);
                              } else if (hasImage) {
                                openLightbox(scene, globalIndex);
                              }
                            }}
                          >
                            {/* Selection Checkbox */}
                            {isSelectionMode && (
                              <div className="absolute top-2 left-2 z-10">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleSelection(scene.id)}
                                  className="bg-black/60 border-white/40"
                                />
                              </div>
                            )}

                            {/* NEW: Category indicator (top-left) */}
                            {!isSelectionMode && (
                              <div className="absolute top-2 left-2 z-10">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={cn(
                                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                        catConfig.bgColor,
                                        catConfig.color,
                                        "border",
                                        catConfig.borderColor
                                      )}>
                                        {catConfig.icon}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                      {catConfig.label} Shot
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            )}

                            {/* Image */}
                            <div className={cn(
                              "aspect-video rounded-lg overflow-hidden bg-black/60 border transition-all",
                              catConfig.borderColor,
                              hasImage && "group-hover:border-purple-400/50"
                            )}>
                              {hasImage ? (
                                <img
                                  src={scene.imageUrl || scene.thumbnail}
                                  alt={scene.title || `Scene ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {status === 'generating' ? (
                                    <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                                  ) : status === 'error' ? (
                                    <AlertCircle className="h-8 w-8 text-red-400" />
                                  ) : (
                                    <ImageIcon className="h-8 w-8 text-white/20" />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Bottom Info */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-white/80 font-medium truncate flex-1">
                                  {scene.title || `Scene ${index + 1}`}
                                </p>
                                <div className="flex items-center gap-1">
                                  {/* NEW: Quality score badge */}
                                  {qualityInfo && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className={cn(
                                            "flex items-center gap-0.5 text-[8px] px-1 py-0 h-4 rounded",
                                            qualityInfo.color,
                                            qualityScore && qualityScore < 60 ? 'bg-red-500/20' : 'bg-white/10'
                                          )}>
                                            {qualityInfo.icon}
                                            <span>{qualityScore}</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs">
                                          Quality: {qualityInfo.label} ({qualityScore}/100)
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {scene.shotType && (
                                    <Badge className="text-[8px] px-1 py-0 h-4 bg-purple-500/80">
                                      {scene.shotType}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status Badge + Quality Warning */}
                            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                              {status === 'completed' && (
                                <div className="bg-green-500 rounded-full p-0.5">
                                  <CheckCircle2 className="h-3 w-3 text-white" />
                                </div>
                              )}
                              {status === 'generating' && (
                                <div className="bg-blue-500 rounded-full p-0.5">
                                  <Loader2 className="h-3 w-3 text-white animate-spin" />
                                </div>
                              )}
                              {status === 'error' && (
                                <div className="bg-red-500 rounded-full p-0.5">
                                  <AlertCircle className="h-3 w-3 text-white" />
                                </div>
                              )}
                              {/* NEW: Low quality warning */}
                              {qualityScore !== undefined && qualityScore < 60 && status === 'completed' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="bg-yellow-500/80 rounded-full p-0.5 animate-pulse">
                                        <AlertCircle className="h-3 w-3 text-white" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs">
                                      Low quality - Consider regenerating
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>

                            {/* Quick Actions (on hover) */}
                            {!isSelectionMode && hasImage && (
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 w-7 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openLightbox(scene, globalIndex);
                                  }}
                                >
                                  <Maximize2 className="h-3.5 w-3.5" />
                                </Button>
                                {onRegenerateScene && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRegenerateScene(scene.id);
                                    }}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="h-7 w-7 p-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {onEditScene && (
                                      <DropdownMenuItem onClick={() => onEditScene(scene)}>
                                        <Edit className="h-3.5 w-3.5 mr-2" />
                                        Edit Prompt
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => handleCopyPrompt(scene)}>
                                      <Copy className="h-3.5 w-3.5 mr-2" />
                                      Copy Prompt
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toggleCompare(scene)}>
                                      <Eye className="h-3.5 w-3.5 mr-2" />
                                      {isComparing ? 'Remove from Compare' : 'Add to Compare'}
                                    </DropdownMenuItem>
                                    {/* NEW: Use as reference action */}
                                    {onUseAsReference && sceneCategory === 'PERFORMANCE' && (
                                      <DropdownMenuItem 
                                        onClick={() => onUseAsReference(scene)}
                                        className="text-purple-400"
                                      >
                                        <Wand2 className="h-3.5 w-3.5 mr-2" />
                                        Use as Face Reference
                                      </DropdownMenuItem>
                                    )}
                                    {/* NEW: Quick regenerate with enhanced prompt */}
                                    {onRegenerateScene && qualityScore !== undefined && qualityScore < 60 && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                          onClick={() => onRegenerateScene(scene.id)}
                                          className="text-yellow-400"
                                        >
                                          <Sparkles className="h-3.5 w-3.5 mr-2" />
                                          Regenerate (Low Quality)
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    <DropdownMenuSeparator />
                                    {onDeleteScene && (
                                      <DropdownMenuItem 
                                        className="text-red-400"
                                        onClick={() => onDeleteScene(scene.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        ) : (
                          // List View
                          <div className="flex items-center gap-3 p-3 bg-black/40 rounded-lg border border-white/10 hover:border-purple-400/50 transition-all">
                            {isSelectionMode && (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleSelection(scene.id)}
                                className="bg-black/60 border-white/40"
                              />
                            )}
                            
                            <div className="w-24 h-16 rounded overflow-hidden bg-black/60 flex-shrink-0">
                              {hasImage ? (
                                <img
                                  src={scene.imageUrl || scene.thumbnail}
                                  alt={scene.title || ''}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {status === 'generating' ? (
                                    <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                                  ) : (
                                    <ImageIcon className="h-5 w-5 text-white/20" />
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-medium text-white truncate">
                                  {scene.title || `Scene ${index + 1}`}
                                </h4>
                                {scene.shotType && (
                                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/80">
                                    {scene.shotType}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-white/60 line-clamp-1">
                                {scene.description || scene.imagePrompt || 'No description'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                              {status === 'generating' && <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />}
                              {status === 'error' && <AlertCircle className="h-4 w-4 text-red-400" />}
                              
                              {!isSelectionMode && (
                                <div className="flex gap-1">
                                  {hasImage && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => openLightbox(scene, globalIndex)}
                                    >
                                      <Maximize2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {onRegenerateScene && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => onRegenerateScene(scene.id)}
                                    >
                                      <RefreshCw className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredAndSortedScenes.length === 0 && (
              <div className="text-center py-12">
                <ImageIcon className="h-12 w-12 text-white/20 mx-auto mb-3" />
                <p className="text-sm text-white/60">
                  {searchQuery ? 'No scenes match your search' : 'No scenes found'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Lightbox Modal */}
      <Dialog open={!!lightboxScene} onOpenChange={() => setLightboxScene(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0 bg-black/95 border-white/20">
          <DialogTitle className="sr-only">Scene Preview</DialogTitle>
          {lightboxScene && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {lightboxScene.scene.title || `Scene ${lightboxScene.index + 1}`}
                  </h3>
                  <div className="flex items-center gap-2">
                    {lightboxScene.scene.shotType && (
                      <Badge className="text-xs bg-purple-500/80">
                        {lightboxScene.scene.shotType}
                      </Badge>
                    )}
                    {lightboxScene.scene.metadata?.role && (
                      <Badge className="text-xs bg-blue-500/80">
                        {lightboxScene.scene.metadata.role}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLightboxZoom(z => Math.max(0.5, z - 0.25))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-white/60 min-w-12 text-center">
                    {Math.round(lightboxZoom * 100)}%
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLightboxZoom(z => Math.min(3, z + 0.25))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLightboxZoom(1)}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLightboxScene(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Image */}
              <div className="flex-1 relative overflow-auto bg-black/60 flex items-center justify-center p-4">
                <img
                  src={lightboxScene.scene.imageUrl || lightboxScene.scene.thumbnail}
                  alt={lightboxScene.scene.title || ''}
                  className="max-w-full max-h-full object-contain transition-transform"
                  style={{ transform: `scale(${lightboxZoom})` }}
                />

                {/* Navigation Arrows */}
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full"
                  onClick={() => navigateLightbox('prev')}
                  disabled={lightboxScene.index === 0}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full"
                  onClick={() => navigateLightbox('next')}
                  disabled={lightboxScene.index === filteredAndSortedScenes.length - 1}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>

              {/* Footer - Details */}
              <div className="p-4 border-t border-white/10 space-y-3">
                {lightboxScene.scene.description && (
                  <div>
                    <p className="text-xs text-white/60 mb-1">Prompt:</p>
                    <p className="text-sm text-white/90">{lightboxScene.scene.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-white/60">Duration</p>
                    <p className="text-white">{lightboxScene.scene.duration?.toFixed(2)}s</p>
                  </div>
                  <div>
                    <p className="text-white/60">Start Time</p>
                    <p className="text-white">{lightboxScene.scene.start_time?.toFixed(2)}s</p>
                  </div>
                  {lightboxScene.scene.metadata?.model && (
                    <div>
                      <p className="text-white/60">Model</p>
                      <p className="text-white">{lightboxScene.scene.metadata.model}</p>
                    </div>
                  )}
                  {lightboxScene.scene.metadata?.seed && (
                    <div>
                      <p className="text-white/60">Seed</p>
                      <p className="text-white font-mono">{lightboxScene.scene.metadata.seed}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopyPrompt(lightboxScene.scene)}>
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    Copy Prompt
                  </Button>
                  {onRegenerateScene && (
                    <Button size="sm" variant="outline" onClick={() => {
                      onRegenerateScene(lightboxScene.scene.id);
                      setLightboxScene(null);
                    }}>
                      <RefreshCw className="h-3.5 w-3.5 mr-2" />
                      Regenerate
                    </Button>
                  )}
                  {onEditScene && (
                    <Button size="sm" variant="outline" onClick={() => {
                      onEditScene(lightboxScene.scene);
                      setLightboxScene(null);
                    }}>
                      <Edit className="h-3.5 w-3.5 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Compare Mode Modal */}
      <Dialog open={compareMode} onOpenChange={setCompareMode}>
        <DialogContent className="max-w-6xl max-h-[90vh] bg-black/95 border-white/20">
          <DialogTitle className="sr-only">Compare Scenes</DialogTitle>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Compare Scenes</h3>
              <Button size="sm" variant="ghost" onClick={() => {
                setCompareMode(false);
                setCompareScenes([]);
              }}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className={cn(
              "grid gap-4",
              compareScenes.length === 2 && "grid-cols-2",
              compareScenes.length === 3 && "grid-cols-3",
              compareScenes.length === 4 && "grid-cols-2"
            )}>
              {compareScenes.map((scene, idx) => (
                <div key={scene.id} className="space-y-2">
                  <div className="aspect-video rounded-lg overflow-hidden bg-black/60 border border-white/20">
                    <img
                      src={scene.imageUrl || scene.thumbnail}
                      alt={scene.title || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-1">{scene.title}</h4>
                    <p className="text-xs text-white/60 line-clamp-2">
                      {scene.description || scene.imagePrompt}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => toggleCompare(scene)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
