/**
 * Discover Feed - TikTok-style vertical scroll feed
 * 
 * "Descubre nueva música con scroll infinito tipo TikTok"
 * 
 * Full-screen vertical clips with visual effects, 
 * like/skip interactions, and algorithm-based personalization.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  Heart, Share2, MessageCircle, Music, Play, SkipForward, 
  ChevronUp, ChevronDown, Eye, Repeat, Volume2, VolumeX 
} from 'lucide-react';

function getArtistAvatar(artistId: number, profileImageUrl: string | null): string {
  if (profileImageUrl) return profileImageUrl;
  const gender = artistId % 2 === 0 ? 'women' : 'men';
  const index = (artistId * 7 + 13) % 80;
  return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
}

interface DiscoverClip {
  id: number;
  songId: number | null;
  postId: number | null;
  artistId: number;
  artistName: string | null;
  clipTitle: string;
  clipDescription: string | null;
  audioPreviewUrl: string | null;
  visualEffect: string;
  colorTheme: string;
  duration: number;
  likes: number;
  views: number;
  shares: number;
  algorithmScore: number;
  createdAt: string;
  profileImageUrl?: string | null;
}

const visualEffectStyles: Record<string, string> = {
  waveform: 'from-indigo-900 via-purple-900 to-blue-900',
  particles: 'from-pink-900 via-rose-900 to-red-900',
  gradient: 'from-teal-900 via-emerald-900 to-green-900',
  album_art: 'from-amber-900 via-orange-900 to-yellow-900',
  lyrics: 'from-slate-900 via-gray-900 to-zinc-900',
  visualizer: 'from-cyan-900 via-sky-900 to-blue-900',
};

const visualEffectAnimations: Record<string, React.ReactNode> = {
  waveform: (
    <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-30">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-purple-400 rounded-full"
          animate={{ height: [10, Math.random() * 60 + 20, 10] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </div>
  ),
  particles: (
    <div className="absolute inset-0 overflow-hidden opacity-30">
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-pink-400"
          initial={{ x: `${Math.random() * 100}%`, y: '100%' }}
          animate={{ y: '-10%', opacity: [0, 1, 0] }}
          transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
    </div>
  ),
  visualizer: (
    <div className="absolute inset-0 flex items-end justify-center gap-0.5 px-8 pb-40 opacity-20">
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          className="w-2 bg-cyan-400 rounded-t"
          animate={{ height: [5, Math.random() * 100 + 20, 5] }}
          transition={{ duration: 0.5 + Math.random(), repeat: Infinity, delay: i * 0.05 }}
        />
      ))}
    </div>
  ),
};

interface DiscoverFeedProps {
  userId?: number;
}

export function DiscoverFeed({ userId }: DiscoverFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLiked, setIsLiked] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  const { data: clips, isLoading } = useQuery<DiscoverClip[]>({
    queryKey: ['/api/ai-social/discover/feed', userId],
    queryFn: async () => {
      const url = userId 
        ? `/api/ai-social/discover/feed?userId=${userId}&limit=30` 
        : '/api/ai-social/discover/feed?limit=30';
      const res = await apiRequest('GET', url);
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 120000,
  });

  const interactMutation = useMutation({
    mutationFn: async ({ clipId, type, watchTime }: { clipId: number; type: string; watchTime?: number }) => {
      await apiRequest('POST', '/api/ai-social/discover/interact', {
        userId, clipId, type, watchTime,
      });
    },
  });

  const currentClip = clips?.[currentIndex];

  // Record view when clip changes
  useEffect(() => {
    if (currentClip && userId) {
      startTimeRef.current = Date.now();
      interactMutation.mutate({ clipId: currentClip.id, type: 'view' });
    }
  }, [currentIndex, currentClip?.id]);

  const goNext = useCallback(() => {
    if (!clips) return;
    if (currentClip && userId) {
      const watchTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (watchTime < 3) {
        interactMutation.mutate({ clipId: currentClip.id, type: 'skip', watchTime });
      }
    }
    setCurrentIndex(prev => Math.min(prev + 1, clips.length - 1));
  }, [clips, currentClip, userId]);

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const toggleLike = useCallback(() => {
    if (!currentClip || !userId) return;
    const newLiked = new Set(isLiked);
    if (newLiked.has(currentClip.id)) {
      newLiked.delete(currentClip.id);
    } else {
      newLiked.add(currentClip.id);
      interactMutation.mutate({ clipId: currentClip.id, type: 'like' });
    }
    setIsLiked(newLiked);
  }, [currentClip, userId, isLiked]);

  const handleShare = useCallback(() => {
    if (!currentClip || !userId) return;
    interactMutation.mutate({ clipId: currentClip.id, type: 'share' });
  }, [currentClip, userId]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') goNext();
      if (e.key === 'ArrowUp' || e.key === 'k') goPrev();
      if (e.key === 'l' || e.key === 'Enter') toggleLike();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, toggleLike]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-black/50 rounded-xl">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Music className="h-8 w-8 text-purple-400" />
        </motion.div>
      </div>
    );
  }

  if (!clips?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-gradient-to-b from-purple-900/20 to-black/40 rounded-xl">
        <Music className="h-10 w-10 text-purple-400 mb-3" />
        <p className="text-white/70 text-sm">No clips to discover yet</p>
        <p className="text-[11px] text-white/40 mt-1">AI artists will generate clips soon</p>
      </div>
    );
  }

  if (!currentClip) return null;

  const liked = isLiked.has(currentClip.id);
  const effect = currentClip.visualEffect || 'gradient';
  const bgStyle = visualEffectStyles[effect] || visualEffectStyles.gradient;

  return (
    <div 
      ref={containerRef}
      className="relative h-[500px] rounded-xl overflow-hidden select-none"
    >
      {/* Background */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentClip.id}
          className={cn("absolute inset-0 bg-gradient-to-b", bgStyle)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Visual Effect Animation */}
          {visualEffectAnimations[effect]}
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentClip.id}
          className="absolute inset-0 flex flex-col justify-end p-4 z-10"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3 }}
        >
          {/* Artist Info */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10 ring-2 ring-white/30">
              <AvatarImage src={getArtistAvatar(currentClip.artistId, currentClip.profileImageUrl || null)} />
              <AvatarFallback className="text-xs bg-purple-600">
                {(currentClip.artistName || '?')[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white font-bold text-sm">{currentClip.artistName || 'Artist'}</p>
              <p className="text-white/50 text-[10px]">Clip #{currentIndex + 1} of {clips.length}</p>
            </div>
          </div>

          {/* Clip Info */}
          <h4 className="text-white font-bold text-lg mb-1">{currentClip.clipTitle}</h4>
          {currentClip.clipDescription && (
            <p className="text-white/60 text-xs mb-3 line-clamp-2">{currentClip.clipDescription}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 text-[10px] text-white/40">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" /> {currentClip.views}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" /> {currentClip.likes + (liked ? 1 : 0)}
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="h-3 w-3" /> {currentClip.shares}
            </span>
            <Badge className="bg-white/10 text-white/40 text-[9px]">
              {currentClip.duration}s
            </Badge>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Side Actions */}
      <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4">
        <button
          className={cn(
            "flex flex-col items-center transition-all",
            liked ? "text-red-400 scale-110" : "text-white/70 hover:text-white"
          )}
          onClick={toggleLike}
        >
          <motion.div
            animate={liked ? { scale: [1, 1.4, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <Heart className={cn("h-7 w-7", liked && "fill-current")} />
          </motion.div>
          <span className="text-[10px] mt-0.5">{currentClip.likes + (liked ? 1 : 0)}</span>
        </button>

        <button className="flex flex-col items-center text-white/70 hover:text-white transition-all" onClick={handleShare}>
          <Share2 className="h-6 w-6" />
          <span className="text-[10px] mt-0.5">{currentClip.shares}</span>
        </button>

        <motion.div
          className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <Music className="h-5 w-5 text-white/50" />
        </motion.div>
      </div>

      {/* Navigation */}
      <div className="absolute left-1/2 -translate-x-1/2 top-3 z-20 flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <span className="text-[10px] text-white/40 bg-black/30 px-2 py-0.5 rounded-full">
          {currentIndex + 1}/{clips.length}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full"
          onClick={goNext}
          disabled={currentIndex === clips.length - 1}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Swipe hint */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
        <motion.p
          className="text-[9px] text-white/20"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ↑↓ or arrows to navigate • L to like
        </motion.p>
      </div>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 z-20 h-0.5 bg-white/10">
        <motion.div
          className="h-full bg-purple-400"
          initial={{ width: '0%' }}
          animate={{ width: `${((currentIndex + 1) / clips.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}
