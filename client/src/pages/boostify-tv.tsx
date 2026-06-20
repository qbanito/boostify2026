import React, { useState, useMemo, useEffect, useRef } from "react";
import { logger } from "../lib/logger";
import axios from "axios";
import { Header } from "../components/layout/header";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { TabsList, TabsTrigger, Tabs, TabsContent } from "../components/ui/tabs";
import { 
  Play, Tv, Film, Music2, Star, Clock, TrendingUp, Search, 
  Share2, Facebook, Twitter, Copy, Instagram, Linkedin, Loader2,
  PlusCircle, Bookmark, ThumbsUp, MessageCircle, Info,
  Mic, Video, Radio, Users, Zap, Sparkles, Calendar, CheckCircle2,
  Pause, Volume2, VolumeX, X, SkipForward, SkipBack, DollarSign,
  Newspaper, Clapperboard, GraduationCap, Flame, Wand2, RefreshCw,
  ChevronRight, ChevronLeft, Eye, LayoutGrid
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../hooks/use-toast";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "../components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { VideoUpload } from "../components/affiliates/video-upload";
import { useAuth } from "../hooks/use-auth";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Link } from "wouter";
import { TVSocialFeed, TVSocialFeedInline } from "../components/tv/tv-social-feed";
import { TVVideoComments, TVVideoCommentsPanel, VideoCommentCount } from "../components/tv/tv-video-comments";
import { VideoTipButton, TvRevenuePanel } from "../components/tv/tv-monetization";

interface VideoContent {
  id: string;
  title: string;
  description: string;
  filePath: string;
  thumbnailPath?: string | null;
  duration: string;
  views: number;
  category: "featured" | "live" | "videos" | "music" | "news" | "entertainment" | "podcast" | "trending" | "documentary" | "tutorial";
  // Artist info for synced videos
  artistId?: number | string;
  artistName?: string;
  artistSlug?: string;
  artistImage?: string;
  genres?: string[];
  isYouTube?: boolean;
  videoId?: string;
  // AI-generated content fields
  isAIGenerated?: boolean;
  contentType?: string;
  aiProvider?: string;
  source?: string;
  isBreaking?: boolean;
  tags?: string[];
}

interface VideoResponse {
  success: boolean;
  videos: VideoContent[];
  message?: string;
  error?: string;
  totalCount?: number;
}

interface VideoPlayerProps {
  video: VideoContent;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VideoGrid â€” renders video cards for a tab
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface VideoGridProps {
  videos: VideoContent[];
  tabId: string;
  searchTerm: string;
  onPlay: (v: VideoContent) => void;
  onUpload: () => void;
  onGenerate: (cat: string) => void;
  isGenerating: boolean;
  likedVideos: string[];
  savedVideos: string[];
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onShare: (v: VideoContent, platform: string) => void;
  user: any;
  viewMode: 'grid' | 'list';
}

function VideoGrid({ videos, tabId, searchTerm, onPlay, onUpload, onGenerate, isGenerating, likedVideos, savedVideos, onLike, onSave, onShare, user, viewMode }: VideoGridProps) {
  const isGeneratable = ['news', 'entertainment', 'podcast', 'documentary', 'tutorial', 'trending'].includes(tabId);

  if (videos.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed rounded-lg">
        <Film className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium mb-2">No content in this category</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {searchTerm ? `No results for "${searchTerm}"` : 'No videos yet in this category.'}
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          {user && (
            <Button onClick={onUpload} variant="outline">
              <PlusCircle className="w-4 h-4 mr-2" />
              Upload Video
            </Button>
          )}
          {isGeneratable && (
            <Button onClick={() => onGenerate(tabId)} disabled={isGenerating} className="bg-purple-600 hover:bg-purple-700 text-white">
              {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Generate AI Content
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
      {videos.map((video: VideoContent) => (
        <VideoCard
          key={video.id}
          video={video}
          onPlay={onPlay}
          onLike={onLike}
          onSave={onSave}
          onShare={onShare}
          isLiked={likedVideos.includes(video.id)}
          isSaved={savedVideos.includes(video.id)}
          viewMode={viewMode}
        />
      ))}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VideoCard â€” individual video card
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface VideoCardProps {
  video: VideoContent;
  onPlay: (v: VideoContent) => void;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onShare: (v: VideoContent, platform: string) => void;
  isLiked: boolean;
  isSaved: boolean;
  viewMode: 'grid' | 'list';
}

function VideoCard({ video, onPlay, onLike, onSave, onShare, isLiked, isSaved, viewMode }: VideoCardProps) {
  const isYT = video.isYouTube || video.filePath?.includes('youtube.com') || video.filePath?.includes('youtu.be');
  const thumb = video.thumbnailPath || (isYT && video.videoId ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg` : null);

  const categoryColors: Record<string, string> = {
    news: 'bg-blue-600',
    entertainment: 'bg-pink-600',
    podcast: 'bg-purple-600',
    music: 'bg-orange-500',
    live: 'bg-red-600',
    featured: 'bg-yellow-500',
    trending: 'bg-orange-500',
    documentary: 'bg-emerald-600',
    tutorial: 'bg-cyan-600',
    videos: 'bg-gray-600',
  };

  const catColor = categoryColors[video.category] || 'bg-gray-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: viewMode === 'grid' ? -6 : 0 }}
    >
      <Card
        className={`overflow-hidden group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-orange-500/40 bg-card/50 backdrop-blur-sm ${viewMode === 'list' ? 'flex flex-row' : ''}`}
        id={`video-${video.id}`}
        data-testid={`video-card-${video.id}`}
      >
        <div className={`relative overflow-hidden bg-gradient-to-br from-orange-500/10 to-purple-500/10 ${viewMode === 'list' ? 'w-48 h-28 shrink-0' : 'aspect-video'}`}>
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-20">
            <Button
              size={viewMode === 'grid' ? 'lg' : 'sm'}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg"
              onClick={() => onPlay(video)}
              data-testid={`button-play-${video.id}`}
            >
              <Play className={viewMode === 'grid' ? "w-7 h-7 ml-0.5" : "w-4 h-4 ml-0.5"} />
            </Button>
          </div>

          {/* Breaking news badge */}
          {video.isBreaking && (
            <Badge className="absolute top-2 left-2 z-30 bg-red-600 text-white text-xs animate-pulse shadow">
              ðŸ”´ BREAKING
            </Badge>
          )}
          {!video.isBreaking && (
            <Badge className={`absolute top-2 left-2 z-30 ${catColor} text-white text-xs shadow capitalize`}>
              {video.category}
            </Badge>
          )}
          {video.isAIGenerated && (
            <Badge className="absolute top-2 right-8 z-30 bg-purple-600/80 text-white text-[10px] px-1.5 py-0">
              <Sparkles className="w-2.5 h-2.5 mr-0.5" />AI
            </Badge>
          )}
          <Badge className="absolute bottom-2 right-2 z-30 bg-black/80 text-white text-xs">
            <Clock className="w-2.5 h-2.5 mr-1" />
            {video.duration || "0:00"}
          </Badge>

          {/* Thumbnail */}
          {thumb ? (
            <img
              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
              src={thumb}
              alt={video.title}
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
            />
          ) : (
            <video
              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300"
              src={`${video.filePath}#t=0.5`}
              preload="metadata"
              onError={(e) => { (e.target as HTMLVideoElement).style.opacity = '0.3'; }}
            />
          )}
        </div>

        <div className={`p-4 bg-gradient-to-b from-card to-card/50 ${viewMode === 'list' ? 'flex-1 flex flex-col justify-between' : ''}`}>
          <div>
            <div className="flex justify-between items-start mb-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h3 className="font-semibold text-base line-clamp-2 cursor-help flex-1 pr-2">{video.title}</h3>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs"><p>{video.title}</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" data-testid={`button-share-${video.id}`}>
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onShare(video, 'facebook')}><Facebook className="mr-2 h-4 w-4" /> Facebook</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onShare(video, 'twitter')}><Twitter className="mr-2 h-4 w-4" /> Twitter</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onShare(video, 'copy')}><Copy className="mr-2 h-4 w-4" /> Copy link</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {video.artistName && (
              <Link href={video.artistSlug ? `/artist/${video.artistSlug}` : '#'}>
                <div className="flex items-center gap-1.5 mb-2 hover:opacity-80 transition-opacity cursor-pointer">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={video.artistImage || ''} alt={video.artistName} />
                    <AvatarFallback className="text-[10px] bg-orange-500 text-white">{video.artistName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-orange-500">{video.artistName}</span>
                  {isYT && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-red-500 text-red-500">YT</Badge>}
                </div>
              </Link>
            )}

            {viewMode === 'grid' && (
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{video.description}</p>
            )}
          </div>

          <div className="flex justify-between items-center pt-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{(video.views || 0).toLocaleString()}</span>
              <VideoCommentCount videoId={video.id} />
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className={`h-7 w-7 ${isLiked ? 'text-orange-500' : ''}`} onClick={() => onLike(video.id)} data-testid={`button-like-${video.id}`}>
                <ThumbsUp className="h-3.5 w-3.5" fill={isLiked ? "currentColor" : "none"} />
              </Button>
              <Button variant="ghost" size="icon" className={`h-7 w-7 ${isSaved ? 'text-orange-500' : ''}`} onClick={() => onSave(video.id)} data-testid={`button-save-${video.id}`}>
                <Bookmark className="h-3.5 w-3.5" fill={isSaved ? "currentColor" : "none"} />
              </Button>
              {video.artistId && (
                <VideoTipButton videoId={video.id} videoTitle={video.title} artistId={video.artistId} artistName={video.artistName} variant="card" />
              )}
            </div>
          </div>
          <TVVideoComments videoId={video.id} videoTitle={video.title} />
        </div>
      </Card>
    </motion.div>
  );
}

function VideoPlayer({ video, isOpen, onClose, onNext, onPrevious }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Check if it's a YouTube video
  const isYouTubeVideo = video.isYouTube || 
    video.filePath.includes('youtube.com') || 
    video.filePath.includes('youtu.be');
  
  // Get YouTube embed URL
  const getYouTubeEmbedUrl = (url: string) => {
    if (url.includes('/embed/')) return url;
    
    let videoId = video.videoId;
    if (!videoId) {
      // Extract from URL
      const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      videoId = match ? match[1] : null;
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : url;
  };
  
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
    }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };
  
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-full p-0 bg-black border-0">
        <DialogTitle className="sr-only">{video.title}</DialogTitle>
        <div 
          className="relative w-full h-[90vh] bg-black group"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
            onClick={onClose}
            data-testid="button-close-video"
          >
            <X className="w-6 h-6" />
          </Button>
          
          {isYouTubeVideo ? (
            // YouTube embed player
            <iframe
              className="w-full h-full"
              src={getYouTubeEmbedUrl(video.filePath)}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              data-testid="youtube-player"
            />
          ) : (
            // Regular video player
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              src={video.filePath}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleTimeUpdate}
              onClick={togglePlay}
              data-testid="video-player"
            />
          )}
          
          <AnimatePresence>
            {showControls && !isYouTubeVideo && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6"
              >
                <div className="mb-4">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, hsl(24, 95%, 53%) 0%, hsl(24, 95%, 53%) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) 100%)`
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={togglePlay}
                      className="text-white hover:bg-white/20"
                      data-testid="button-play-pause"
                    >
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                    </Button>
                    
                    {onPrevious && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onPrevious}
                        className="text-white hover:bg-white/20"
                        data-testid="button-previous"
                      >
                        <SkipBack className="w-5 h-5" />
                      </Button>
                    )}
                    
                    {onNext && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onNext}
                        className="text-white hover:bg-white/20"
                        data-testid="button-next"
                      >
                        <SkipForward className="w-5 h-5" />
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleMute}
                      className="text-white hover:bg-white/20"
                      data-testid="button-mute"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    
                    <span className="text-sm">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg">{video.title}</h3>
                    <p className="text-sm text-gray-300">{video.views.toLocaleString()} views</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {!isPlaying && !isYouTubeVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                size="lg"
                onClick={togglePlay}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-full w-20 h-20"
                data-testid="button-play-overlay"
              >
                <Play className="w-10 h-10 ml-1" />
              </Button>
            </div>
          )}

          {/* AI Artist Reactions Panel - Bottom right overlay */}
          <div className="absolute bottom-20 right-4 w-80 z-40 hidden md:block">
            <TVVideoCommentsPanel videoId={video.id} videoTitle={video.title} />
          </div>

          {/* Tip button â€” top-left corner of player */}
          {video.artistId && (
            <div className="absolute top-4 left-4 z-50">
              <VideoTipButton
                videoId={video.id}
                videoTitle={video.title}
                artistId={video.artistId}
                artistName={video.artistName}
                variant="player"
              />
            </div>
          )}
        </div>

        {/* Mobile comments panel below video */}
        <div className="md:hidden bg-background p-4 max-h-[30vh] overflow-y-auto">
          <TVVideoCommentsPanel videoId={video.id} videoTitle={video.title} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BoostifyTvPage() {
  const [selectedTab, setSelectedTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoContent | null>(null);
  const [showSocialFeed, setShowSocialFeed] = useState(true);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [generatingCategory, setGeneratingCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { toast } = useToast();
  const { user } = useAuth();

  // Primary content source: new unified TV content endpoint
  const { data: tvContentData, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['/api/tv/content'],
    queryFn: async () => {
      const response = await axios.get('/api/tv/content');
      return response.data;
    },
    staleTime: 2 * 60 * 1000 // 2 minutes
  });

  // Legacy fallback: artist videos
  const { data: artistVideosData } = useQuery<VideoResponse>({
    queryKey: ['/api/tv/artist-videos'],
    queryFn: async () => {
      const response = await axios.get('/api/tv/artist-videos');
      return response.data;
    },
    staleTime: 5 * 60 * 1000
  });

  // TV schedule
  const { data: scheduleData } = useQuery<any>({
    queryKey: ['/api/tv/content/schedule'],
    queryFn: async () => {
      const response = await axios.get('/api/tv/content/schedule');
      return response.data;
    },
    staleTime: 30 * 60 * 1000 // 30 min schedule cache
  });

  const processedVideos = useMemo(() => {
    // Primary source: new unified TV content API
    const tvVideos: VideoContent[] = (tvContentData?.videos || []).filter((v: any) => v.filePath && v.filePath.trim() !== '');
    // Secondary: legacy artist-videos fallback (deduplication handles overlap)
    const legacyVideos: VideoContent[] = (artistVideosData?.videos || []).filter((v: any) => v.filePath && v.filePath.trim() !== '');

    const allVideos = [...tvVideos];
    const seenPaths = new Set(tvVideos.map(v => v.filePath));
    legacyVideos.forEach(v => {
      if (!seenPaths.has(v.filePath)) {
        allVideos.push(v);
        seenPaths.add(v.filePath);
      }
    });

    console.log('[BOOSTIFY-TV] Total unique videos:', allVideos.length, '| Categories:', 
      [...new Set(allVideos.map(v => v.category))].join(', '));

    return allVideos;
  }, [tvContentData?.videos, artistVideosData?.videos]);
  
  const filteredVideos = useMemo(() => {
    if (!processedVideos.length) return [];
    return processedVideos.filter((video: VideoContent) => 
      video.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (video.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (video.artistName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [processedVideos, searchTerm]);

  const getVideosForTab = (tab: string): VideoContent[] => {
    const pool = searchTerm ? filteredVideos : processedVideos;
    if (tab === 'all') return pool;
    if (tab === 'artists') return pool.filter(v => v.artistName && v.artistName !== 'Unknown Artist' && v.artistName !== 'Boostify TV');
    if (tab === 'trending') return [...pool].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 30);
    return pool.filter(v => v.category === tab);
  };

  const handleGenerateContent = async (category: string, topic?: string) => {
    setIsGeneratingContent(true);
    setGeneratingCategory(category);
    try {
      const resp = await axios.post('/api/tv/content/generate', { category, topic, count: 4 });
      if (resp.data.success) {
        toast({ title: `âœ¨ ${resp.data.count} ${category} segments generated!`, description: 'Refreshing channel...' });
        refetch();
        setSelectedTab(category);
      }
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingContent(false);
      setGeneratingCategory(null);
    }
  };

  const shareVideo = (video: VideoContent, platform: string) => {
    const videoUrl = window.location.origin + video.filePath;
    const text = `Check out this video: ${video.title}`;
    
    switch(platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(videoUrl)}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(videoUrl)}`, '_blank');
        break;
      case 'instagram':
        toast({
          title: "Instagram sharing",
          description: "Copy the link to share on Instagram",
        });
        navigator.clipboard.writeText(videoUrl);
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(videoUrl)}`, '_blank');
        break;
      case 'copy':
        navigator.clipboard.writeText(videoUrl);
        toast({
          title: "Link copied!",
          description: "Video link copied to clipboard",
        });
        break;
    }
  };

  const [featuredVideo, setFeaturedVideo] = useState<VideoContent | null>(null);
  const [savedVideos, setSavedVideos] = useState<string[]>([]);
  const [likedVideos, setLikedVideos] = useState<string[]>([]);
  
  useEffect(() => {
    if (processedVideos.length > 0) {
      const featured = processedVideos.filter(v => v.category === "featured");
      if (featured.length > 0) {
        const randomIndex = Math.floor(Math.random() * featured.length);
        setFeaturedVideo(featured[randomIndex]);
      } else {
        setFeaturedVideo(processedVideos[0]);
      }
    }
  }, [processedVideos]);
  
  const toggleSaveVideo = (videoId: string) => {
    if (savedVideos.includes(videoId)) {
      setSavedVideos(savedVideos.filter(id => id !== videoId));
      toast({
        title: "Video removed",
        description: "Video removed from your saved list",
      });
    } else {
      setSavedVideos([...savedVideos, videoId]);
      toast({
        title: "Video saved",
        description: "Video added to your saved list",
      });
    }
  };
  
  const toggleLikeVideo = (videoId: string) => {
    if (likedVideos.includes(videoId)) {
      setLikedVideos(likedVideos.filter(id => id !== videoId));
    } else {
      setLikedVideos([...likedVideos, videoId]);
      toast({
        title: "Liked!",
        description: "We've recorded your like for this video",
      });
    }
  };
  
  const openVideoPlayer = (video: VideoContent) => {
    setSelectedVideo(video);
  };
  
  const currentVideoIndex = selectedVideo ? processedVideos.findIndex(v => v.id === selectedVideo.id) : -1;
  
  const handleNext = () => {
    if (currentVideoIndex < processedVideos.length - 1) {
      setSelectedVideo(processedVideos[currentVideoIndex + 1]);
    }
  };
  
  const handlePrevious = () => {
    if (currentVideoIndex > 0) {
      setSelectedVideo(processedVideos[currentVideoIndex - 1]);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 space-y-8 p-3 sm:p-4 md:p-8 pb-20 sm:pb-8 overflow-x-hidden">
        {/* Hero Section - Ultra Atractivo */}
        <div className="relative w-full h-[40vh] sm:h-[50vh] md:h-[75vh] overflow-hidden rounded-2xl mb-8 shadow-2xl">
          {/* Video de fondo con overlay mejorado */}
          <div className="absolute inset-0">
            {featuredVideo && (
              <video
                className="absolute inset-0 w-full h-full object-cover scale-105"
                src={featuredVideo.filePath}
                autoPlay
                muted
                loop
                playsInline
                onError={(e) => {
                  logger.error('Error loading featured video:', featuredVideo.filePath);
                }}
              />
            )}
            
            {/* Overlay gradiente dramÃ¡tico */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
            
            {/* Efecto de brillo animado */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />
          </div>
          
          {/* Contenido */}
          <div className="relative h-full flex items-center px-4 md:px-16">
            <div className="max-w-3xl z-10">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
              >
                {/* Badge superior */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="mb-4"
                >
                  <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 text-sm font-semibold shadow-lg">
                    <Sparkles className="w-4 h-4 mr-2 inline" />
                    NOW STREAMING
                  </Badge>
                </motion.div>
                
                {/* TÃ­tulo principal */}
                <h1 className="text-4xl md:text-7xl font-bold text-white mb-6 leading-tight">
                  Welcome to{" "}
                  <span className="relative inline-block">
                    <span className="bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                      Boostify TV
                    </span>
                    <motion.div
                      className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-yellow-400 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                    />
                  </span>
                </h1>
                
                {/* SubtÃ­tulo */}
                <p className="text-lg md:text-2xl text-gray-200 mb-8 font-light">
                  Stream exclusive music content, live performances, and behind-the-scenes footage from the world's best artists
                </p>
                
                {/* EstadÃ­sticas rÃ¡pidas */}
                <div className="flex flex-wrap gap-6 mb-8">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center gap-2 text-white/90"
                  >
                    <div className="w-12 h-12 bg-orange-500/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Film className="w-6 h-6 text-orange-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{processedVideos.length}+</div>
                      <div className="text-sm text-gray-300">Videos</div>
                    </div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center gap-2 text-white/90"
                  >
                    <div className="w-12 h-12 bg-purple-500/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">10K+</div>
                      <div className="text-sm text-gray-300">Artists</div>
                    </div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center gap-2 text-white/90"
                  >
                    <div className="w-12 h-12 bg-pink-500/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-pink-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">1M+</div>
                      <div className="text-sm text-gray-300">Views</div>
                    </div>
                  </motion.div>
                </div>
                
                {/* Video destacado */}
                {featuredVideo && (
                  <motion.div 
                    className="bg-black/60 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.7 }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Thumbnail del video */}
                      <div className="relative w-32 h-20 rounded-lg overflow-hidden shrink-0 hidden md:block">
                        <video
                          className="w-full h-full object-cover"
                          src={featuredVideo.filePath}
                          muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                            <Play className="w-5 h-5 text-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Info del video */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            FEATURED NOW
                          </Badge>
                          <Badge variant="outline" className="border-white/20 text-white text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {featuredVideo.duration}
                          </Badge>
                        </div>
                        <h3 className="text-white font-semibold text-lg mb-1 line-clamp-1">{featuredVideo.title}</h3>
                        <p className="text-gray-300 text-sm mb-3 line-clamp-2">{featuredVideo.description}</p>
                        
                        {/* Botones de acciÃ³n */}
                        <div className="flex gap-3">
                          <Button 
                            size="lg" 
                            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30"
                            onClick={() => openVideoPlayer(featuredVideo)}
                            data-testid="button-watch-featured"
                          >
                            <Play className="w-5 h-5 mr-2" /> Watch Now
                          </Button>
                          <Button 
                            size="lg" 
                            variant="outline" 
                            className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
                          >
                            <Info className="w-5 h-5 mr-2" /> More Info
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>
          
          {/* Indicador de scroll */}
          <motion.div
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
              <motion.div
                className="w-1.5 h-1.5 bg-white rounded-full"
                animate={{ y: [0, 16, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </div>

        {/* Search + Controls Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Tv className="w-7 h-7 text-orange-500" />
            Boostify TV
          </h2>
          
          <div className="flex gap-3 items-center w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Input
                placeholder="Search videos, artists, news..."
                className="pr-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-videos"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
            
            <Button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              variant="outline"
              size="icon"
              title="Toggle view"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>

            <Link href="/live-podcast-studio">
              <Button size="sm" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shrink-0 shadow-lg shadow-purple-500/25" data-testid="button-podcast-studio">
                <Radio className="w-4 h-4 md:mr-2 animate-pulse" />
                <span className="hidden md:inline">Podcast Studio</span>
              </Button>
            </Link>

            <Button onClick={() => setShowSocialFeed(!showSocialFeed)} variant={showSocialFeed ? "default" : "outline"} size="sm" className={showSocialFeed ? "bg-orange-500 hover:bg-orange-600 text-white shrink-0" : "shrink-0"} data-testid="button-toggle-social">
              <MessageCircle className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Live Chat</span>
            </Button>
            
            {user && (
              <Button onClick={() => setIsUploadDialogOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white shrink-0" size="sm" data-testid="button-upload-video">
                <PlusCircle className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Upload</span>
              </Button>
            )}
          </div>
        </div>

        {/* Main layout with sidebar */}
        <div className={`flex gap-6`}>
          <div className={`flex-1 min-w-0`}>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Videos', value: processedVideos.length, icon: <Film className="w-5 h-5" />, color: 'orange' },
            { label: 'Views', value: processedVideos.reduce((s, v) => s + (v.views || 0), 0).toLocaleString(), icon: <Eye className="w-5 h-5" />, color: 'purple' },
            { label: 'Live Now', value: processedVideos.filter(v => v.category === 'live').length, icon: <Radio className="w-5 h-5 animate-pulse" />, color: 'red' },
            { label: 'AI Content', value: processedVideos.filter((v: any) => v.isAIGenerated).length, icon: <Sparkles className="w-5 h-5" />, color: 'pink' }
          ].map((stat, i) => (
            <motion.div key={i} whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
              <Card className="p-4 border-orange-500/20 bg-card/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-0.5">{isLoading ? 'â€”' : stat.value}</p>
                  </div>
                  <div className="text-orange-500 opacity-70">{stat.icon}</div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* AI Content Generation Panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Card className="border-purple-500/30 bg-gradient-to-r from-purple-950/50 via-black/50 to-orange-950/50 backdrop-blur-xl overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-white">AI Content Generator</h3>
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">GPT-4o + FAL</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-gray-400 hover:text-white">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
              </div>
              <p className="text-sm text-gray-400 mb-4">Auto-generate professional TV content â€” news segments, entertainment clips, tutorials and more.</p>
              <div className="flex flex-wrap gap-2">
                {['news', 'entertainment', 'podcast', 'documentary', 'tutorial', 'trending'].map(cat => (
                  <motion.div key={cat} whileTap={{ scale: 0.95 }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateContent(cat)}
                      disabled={isGeneratingContent}
                      className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:text-white capitalize"
                    >
                      {isGeneratingContent && generatingCategory === cat ? (
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3 mr-1.5" />
                      )}
                      {cat}
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Podcast Studio Banner */}
        <Link href="/live-podcast-studio">
          <motion.div whileHover={{ scale: 1.01 }} className="relative overflow-hidden rounded-2xl mb-8 cursor-pointer group">
            <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-pink-900 p-5 md:p-7 border border-purple-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-500/30 rounded-2xl flex items-center justify-center"><Radio className="w-6 h-6 text-purple-300" /></div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg md:text-xl font-bold text-white">Live Podcast Studio</h3>
                      <Badge className="bg-red-600 text-white text-xs animate-pulse">LIVE</Badge>
                    </div>
                    <p className="text-purple-200 text-sm">Go live with guests â€” podcasts, interviews, panels & music sessions with real-time chat</p>
                  </div>
                </div>
                <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 hidden md:flex">
                  <Mic className="w-4 h-4 mr-2" />Launch Studio
                </Button>
              </div>
              <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/10 to-transparent pointer-events-none" animate={{ x: ['-100%', '200%'] }} transition={{ duration: 4, repeat: Infinity, repeatDelay: 3 }} />
            </div>
          </motion.div>
        </Link>

        {/* Loading state */}
        {isLoading ? (
          <div className="space-y-6">
            <div className="flex gap-2">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-10 w-28" />)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => (
                <Card key={i} className="overflow-hidden"><Skeleton className="aspect-video w-full" /><div className="p-4 space-y-2"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /></div></Card>
              ))}
            </div>
          </div>
        ) : isError ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <Film className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-xl font-semibold mb-2">Error loading videos</p>
              <p className="text-muted-foreground mb-4">Please try again later</p>
              <Button onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Category tabs + content */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              {/* Scrollable category tab bar */}
              <div className="relative mb-6">
                <div className="overflow-x-auto pb-1 scrollbar-hide">
                  <TabsList className="inline-flex gap-1 bg-black/20 border border-white/10 p-1 rounded-xl w-max min-w-full">
                    {[
                      { id: 'all', label: 'All', icon: <Tv className="w-3.5 h-3.5" /> },
                      { id: 'featured', label: 'Featured', icon: <Star className="w-3.5 h-3.5" /> },
                      { id: 'news', label: 'Music News', icon: <Newspaper className="w-3.5 h-3.5" /> },
                      { id: 'entertainment', label: 'Entertainment', icon: <Film className="w-3.5 h-3.5" /> },
                      { id: 'podcast', label: 'Podcast', icon: <Mic className="w-3.5 h-3.5" /> },
                      { id: 'music', label: 'Music Videos', icon: <Music2 className="w-3.5 h-3.5" /> },
                      { id: 'live', label: 'Live', icon: <Radio className="w-3.5 h-3.5" /> },
                      { id: 'trending', label: 'Trending', icon: <Flame className="w-3.5 h-3.5" /> },
                      { id: 'documentary', label: 'Documentary', icon: <Clapperboard className="w-3.5 h-3.5" /> },
                      { id: 'tutorial', label: 'Tutorials', icon: <GraduationCap className="w-3.5 h-3.5" /> },
                      { id: 'videos', label: 'Artist Videos', icon: <Video className="w-3.5 h-3.5" /> },
                      { id: 'artists', label: 'Artists', icon: <Users className="w-3.5 h-3.5" /> },
                      ...(user ? [{ id: 'monetize', label: 'Revenue', icon: <DollarSign className="w-3.5 h-3.5" /> }] : [])
                    ].map(tab => {
                      const count = tab.id === 'all' ? processedVideos.length : tab.id === 'monetize' ? null : getVideosForTab(tab.id).length;
                      return (
                        <TabsTrigger
                          key={tab.id}
                          value={tab.id}
                          className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md"
                          data-testid={`tab-${tab.id}`}
                        >
                          {tab.icon}
                          {tab.label}
                          {count !== null && count > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-white/15">{count}</span>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>
              </div>

              {/* Tab content panels */}
              {['all', 'featured', 'news', 'entertainment', 'podcast', 'music', 'live', 'trending', 'documentary', 'tutorial', 'videos', 'artists'].map(tab => (
                <TabsContent key={tab} value={tab}>
                  <VideoGrid
                    videos={getVideosForTab(tab)}
                    tabId={tab}
                    searchTerm={searchTerm}
                    onPlay={openVideoPlayer}
                    onUpload={() => setIsUploadDialogOpen(true)}
                    onGenerate={handleGenerateContent}
                    isGenerating={isGeneratingContent && generatingCategory === tab}
                    likedVideos={likedVideos}
                    savedVideos={savedVideos}
                    onLike={toggleLikeVideo}
                    onSave={toggleSaveVideo}
                    onShare={shareVideo}
                    user={user}
                    viewMode={viewMode}
                  />
                </TabsContent>
              ))}

              {/* Revenue tab */}
              {user && (
                <TabsContent value="monetize">
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pt-2">
                    <TvRevenuePanel />
                  </motion.div>
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
        </div>

          {/* Social Feed Sidebar */}
          {showSocialFeed && (
            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="hidden lg:block w-80 shrink-0 sticky top-24 self-start h-[calc(100vh-120px)]">
              <TVSocialFeed />
            </motion.div>
          )}
        </div>
        
        {/* Mobile Social Feed */}
        {showSocialFeed && (
          <div className="lg:hidden mt-8">
            <Card className="bg-black/40 backdrop-blur-xl border-white/10 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Radio className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold text-white">AI Artists Live Feed</span>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block mr-1 animate-pulse" />Live
                </Badge>
              </div>
              <TVSocialFeedInline maxItems={8} />
              <Link href="/social-network">
                <Button variant="ghost" size="sm" className="w-full mt-3 text-xs text-gray-400 hover:text-orange-400">
                  <Zap className="w-3 h-3 mr-1" /> View Full Social Network
                </Button>
              </Link>
            </Card>
          </div>
        )}
        
        {/* Channel Schedule */}
        {scheduleData?.schedule?.length > 0 && (
          <motion.div className="mt-12 mb-8" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-3 mb-5">
              <Calendar className="w-6 h-6 text-orange-500" />
              <h2 className="text-2xl font-bold">Today's Schedule</h2>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">24h Channel</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scheduleData.schedule.slice(0, 9).map((slot: any, i: number) => (
                <motion.div key={i} whileHover={{ scale: 1.01 }}>
                  <Card className={`p-4 border transition-all ${slot.isCurrent ? 'border-orange-500 bg-orange-500/10 shadow-orange-500/20 shadow-md' : 'border-white/10 bg-card/50'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`text-lg font-bold ${slot.isCurrent ? 'text-orange-400' : 'text-muted-foreground'} shrink-0 w-14`}>{slot.time}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{slot.icon || 'ðŸ“º'}</span>
                          <span className="font-semibold text-sm line-clamp-1">{slot.title}</span>
                          {slot.isCurrent && <Badge className="bg-red-600 text-white text-[9px] animate-pulse px-1.5 py-0">LIVE</Badge>}
                          {slot.highlight && !slot.isCurrent && <Badge className="bg-orange-500/20 text-orange-400 text-[9px] px-1.5 py-0">PRIME</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{slot.description}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
        
        {/* Live Podcast Studio CTA */}
        <motion.div 
          className="mt-16 mb-16"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900 via-orange-900 to-black border border-purple-500/30">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>
            
            <div className="relative p-8 md:p-12">
              <div className="flex items-center gap-2 mb-6">
                <Badge className="bg-green-600 text-white px-4 py-1.5 text-sm font-semibold">
                  <Sparkles className="w-4 h-4 mr-2 inline" />
                  AVAILABLE NOW
                </Badge>
                <Badge className="bg-red-600 text-white px-3 py-1 text-xs font-semibold animate-pulse">
                  <Radio className="w-3 h-3 mr-1 inline" />
                  LIVE
                </Badge>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                    Live Podcast Studio
                  </h2>
                  <p className="text-lg text-orange-100 mb-6">
                    Connect, create, and broadcast professional live podcasts with multiple participants.
                    Edit in real-time with our professional switcher and stream simultaneously
                    to all your social networks. Now fully integrated into Boostify TV.
                  </p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <Users className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white mb-1">Up to 3 Live Participants</h4>
                        <p className="text-sm text-orange-200">Connect with co-hosts and guests from anywhere in the world</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Video className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white mb-1">Professional Real-Time Switcher</h4>
                        <p className="text-sm text-orange-200">Control your live output like a pro with our integrated switcher</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <Radio className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white mb-1">Multi-Streaming to Social Media</h4>
                        <p className="text-sm text-orange-200">Stream simultaneously to YouTube, Facebook, Instagram, Twitch and more</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Mic className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white mb-1">Professional HD Audio & Video</h4>
                        <p className="text-sm text-orange-200">Studio quality with noise reduction and automatic enhancement</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    <Link href="/live-podcast-studio">
                      <Button 
                        size="lg" 
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/30"
                      >
                        <Mic className="w-5 h-5 mr-2" />
                        Launch Studio
                      </Button>
                    </Link>
                    <Link href="/live-podcast-studio">
                      <Button 
                        size="lg" 
                        variant="outline" 
                        className="border-purple-500/50 text-white hover:bg-purple-500/10"
                      >
                        <Info className="w-5 h-5 mr-2" />
                        Learn More
                      </Button>
                    </Link>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-gray-900 to-black border border-orange-500/30 shadow-2xl">
                    <div className="absolute inset-0 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-white font-semibold">LIVE</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="px-3 py-1 bg-white/10 rounded text-xs text-white">1.2K viewers</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="aspect-video bg-gradient-to-br from-orange-500/20 to-purple-500/20 rounded-lg border border-white/10 relative">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Users className="w-8 h-8 text-white/40" />
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                              Host {i}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex items-center justify-center gap-3">
                        <div className="p-2 bg-orange-500/80 rounded-full">
                          <Mic className="w-4 h-4 text-white" />
                        </div>
                        <div className="p-2 bg-orange-500/80 rounded-full">
                          <Video className="w-4 h-4 text-white" />
                        </div>
                        <div className="p-2 bg-purple-500/80 rounded-full">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                        <div className="p-2 bg-red-500/80 rounded-full">
                          <Radio className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <motion.div 
                    className="absolute -top-4 -right-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-full shadow-lg"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <CheckCircle2 className="w-4 h-4 inline mr-2" />
                    <span className="text-sm font-semibold">Now Live!</span>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* CTA for non-registered users */}
        {!user && !isLoading && !isError && (
          <motion.div 
            className="mt-12 mb-8 bg-gradient-to-r from-orange-600 to-orange-500 rounded-lg p-8 text-white"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="mb-6 md:mb-0">
                <h2 className="text-2xl font-bold mb-2">Want to upload your own videos?</h2>
                <p className="text-orange-100 max-w-md">
                  Join the Boostify TV community and share your creations with musicians from around the world.
                </p>
              </div>
              <div className="flex gap-4">
                <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/20">
                  Log in
                </Button>
                <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50">
                  Sign up free
                </Button>
              </div>
            </div>
          </motion.div>
        )}
        
        {isUploadDialogOpen && (
          <VideoUpload
            isOpen={isUploadDialogOpen}
            onClose={() => setIsUploadDialogOpen(false)}
          />
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-gradient-to-br from-orange-950 to-black text-orange-100 py-12 px-4 md:px-8 border-t border-orange-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-xl mb-4 text-orange-400">Boostify TV</h3>
            <p className="text-sm text-orange-300">
              The streaming platform designed specifically for musicians and music lovers.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Explore</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-orange-300 transition-colors">Featured Videos</a></li>
              <li><a href="#" className="hover:text-orange-300 transition-colors">Live</a></li>
              <li><a href="#" className="hover:text-orange-300 transition-colors">Tutorials</a></li>
              <li><a href="#" className="hover:text-orange-300 transition-colors">Music</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-orange-300 transition-colors">Terms and Conditions</a></li>
              <li><a href="#" className="hover:text-orange-300 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-orange-300 transition-colors">Copyright</a></li>
              <li><a href="#" className="hover:text-orange-300 transition-colors">Cookies</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <a href="#" className="hover:text-orange-300 transition-colors">Support</a>
              </li>
              <li className="flex items-center">
                <a href="#" className="hover:text-orange-300 transition-colors">Partnerships</a>
              </li>
              <li className="flex items-center">
                <a href="#" className="hover:text-orange-300 transition-colors">Help</a>
              </li>
            </ul>
            <div className="mt-4 flex gap-4">
              <a href="#" className="text-orange-300 hover:text-white transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-orange-300 hover:text-white transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-orange-300 hover:text-white transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-orange-800 mt-8 pt-8 text-sm text-orange-400 text-center">
          Â© {new Date().getFullYear()} Boostify TV. All rights reserved.
        </div>
      </footer>
      
      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onNext={currentVideoIndex < processedVideos.length - 1 ? handleNext : undefined}
          onPrevious={currentVideoIndex > 0 ? handlePrevious : undefined}
        />
      )}
    </div>
  );
}
