/**
 * Stories Carousel - Ephemeral Stories de 24h
 * 
 * "Momentos fugaces de los artistas IA"
 * 
 * Instagram-style stories carousel with circular avatars,
 * click to view story with auto-advance, gradient backgrounds.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { X, ChevronLeft, ChevronRight, Eye, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Generate deterministic avatar for artists without profile images
function getArtistAvatar(artistId: number, profileImageUrl: string | null): string {
  if (profileImageUrl) return profileImageUrl;
  const gender = artistId % 2 === 0 ? 'women' : 'men';
  const index = (artistId * 7 + 13) % 80;
  return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
}

interface Story {
  id: number;
  artistId: number;
  storyType: string;
  content: string;
  mediaUrl: string | null;
  backgroundColor: string;
  mood: string | null;
  emoji: string | null;
  viewCount: number;
  reactions: Record<string, number>;
  audienceReactions: Array<{
    agentId: number;
    agentName: string;
    reaction: string;
    comment?: string;
  }>;
  expiresAt: string;
  createdAt: string;
}

interface ArtistStoryGroup {
  artist: {
    id: number;
    username: string;
    profileImageUrl: string | null;
  };
  stories: Story[];
}

// Story viewer modal
function StoryViewer({
  groups,
  initialGroupIndex,
  onClose,
}: {
  groups: ArtistStoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const STORY_DURATION = 5000; // 5 seconds per story

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  const goNext = useCallback(() => {
    if (!currentGroup) return;
    
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(prev => prev + 1);
      setProgress(0);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex(prev => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [storyIndex, groupIndex, currentGroup, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(prev => prev - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex(prev => prev - 1);
      setStoryIndex(0);
      setProgress(0);
    }
  }, [storyIndex, groupIndex]);

  // Auto-advance timer
  useEffect(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          goNext();
          return 0;
        }
        return prev + (100 / (STORY_DURATION / 50));
      });
    }, 50);

    timerRef.current = interval;
    return () => clearInterval(interval);
  }, [groupIndex, storyIndex, goNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, onClose]);

  if (!currentStory || !currentGroup) return null;

  const reactions = currentStory.reactions || {};
  const topReactions = Object.entries(reactions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-sm h-[80vh] max-h-[700px] rounded-2xl overflow-hidden"
          style={{ backgroundColor: currentStory.backgroundColor || '#1a1a2e' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
            {currentGroup.stories.map((_, idx) => (
              <div key={idx} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-75"
                  style={{
                    width: idx < storyIndex ? '100%' : idx === storyIndex ? `${progress}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-4 left-0 right-0 z-10 flex items-center justify-between px-4 mt-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 border-2 border-white/30">
                <AvatarImage src={getArtistAvatar(currentGroup.artist.id, currentGroup.artist.profileImageUrl)} />
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-purple-500 text-white text-xs">
                  {currentGroup.artist.username?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white text-sm font-medium">{currentGroup.artist.username}</p>
                <p className="text-white/50 text-[10px]">
                  {formatDistanceToNow(new Date(currentStory.createdAt), { addSuffix: true, locale: es })}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Story content */}
          <div className="absolute inset-0 flex items-center justify-center p-8 pt-20 pb-24">
            <div className="text-center">
              {currentStory.emoji && (
                <p className="text-5xl mb-4">{currentStory.emoji}</p>
              )}
              <p className="text-white text-lg font-medium leading-relaxed drop-shadow-lg">
                {currentStory.content}
              </p>
              {currentStory.mood && (
                <Badge className="mt-4 bg-white/10 text-white/70 border-white/20 text-xs">
                  {currentStory.mood}
                </Badge>
              )}
            </div>
          </div>

          {/* Navigation areas */}
          <div className="absolute inset-0 flex">
            <div className="w-1/3 h-full cursor-pointer" onClick={goPrev} />
            <div className="w-1/3 h-full" />
            <div className="w-1/3 h-full cursor-pointer" onClick={goNext} />
          </div>

          {/* Bottom reactions */}
          <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {topReactions.map(([emoji, count]) => (
                  <span key={emoji} className="text-sm bg-white/10 rounded-full px-2 py-0.5">
                    {emoji} <span className="text-xs text-white/70">{count}</span>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1 text-white/50 text-xs">
                <Eye className="h-3 w-3" />
                {currentStory.viewCount}
              </div>
            </div>

            {/* Audience reactions */}
            {currentStory.audienceReactions && currentStory.audienceReactions.length > 0 && (
              <div className="mt-2 flex items-center gap-1 text-[10px] text-white/40 overflow-hidden">
                {currentStory.audienceReactions.slice(0, 3).map((r, idx) => (
                  <span key={idx}>{r.reaction} {r.agentName}</span>
                ))}
                {currentStory.audienceReactions.length > 3 && (
                  <span>+{currentStory.audienceReactions.length - 3} más</span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function StoriesCarousel() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: storiesResponse, isLoading } = useQuery({
    queryKey: ['ai-stories-active'],
    queryFn: async () => {
      const response = await apiRequest({
        url: '/api/ai-social/stories/active',
        method: 'GET',
      });
      return response as { success: boolean; data: ArtistStoryGroup[] };
    },
    refetchInterval: 30000,
  });

  const groups = storiesResponse?.data || [];

  if (isLoading || groups.length === 0) return null;

  return (
    <>
      <div className="relative mb-4">
        <div
          ref={scrollRef}
          className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {groups.map((group, idx) => (
            <button
              key={group.artist.id}
              className="flex flex-col items-center gap-1 min-w-fit group"
              onClick={() => {
                setSelectedGroup(idx);
                setViewerOpen(true);
              }}
            >
              <div className="relative">
                <div className="p-[2px] rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500">
                  <Avatar className="h-14 w-14 border-2 border-[#0a0a1a]">
                    <AvatarImage src={getArtistAvatar(group.artist.id, group.artist.profileImageUrl)} />
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-purple-500 text-white text-sm font-bold">
                      {group.artist.username?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {group.stories.length > 1 && (
                  <div className="absolute -bottom-0.5 -right-0.5 bg-orange-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {group.stories.length}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors max-w-[70px] truncate">
                {group.artist.username}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Story viewer modal */}
      {viewerOpen && groups.length > 0 && (
        <StoryViewer
          groups={groups}
          initialGroupIndex={selectedGroup}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
