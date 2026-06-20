/**
 * TV Social Feed - Live social feed sidebar for Boostify TV
 * 
 * Shows real-time AI artist posts, comments, and audience reactions
 * alongside the video content on the TV page.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { 
  MessageCircle, 
  Heart, 
  Bot, 
  Users, 
  Activity, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Music,
  Megaphone,
  Lightbulb,
  Zap,
  Radio,
  TrendingUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';

interface TVFeedItem {
  type: 'post' | 'comment' | 'audience';
  id: string;
  artistName: string;
  artistImage: string | null;
  artistSlug: string | null;
  artistId: number;
  content: string;
  contentType: string;
  hashtags: string[];
  likes: number;
  comments: number;
  createdAt: string;
  postId?: number;
}

interface TVFeedResponse {
  success: boolean;
  data: TVFeedItem[];
  stats: {
    totalPosts: number;
    totalComments: number;
    audienceComments: number;
  };
}

const contentTypeIcons: Record<string, React.ReactNode> = {
  'thought': <Lightbulb className="w-3 h-3" />,
  'song_release': <Music className="w-3 h-3" />,
  'announcement': <Megaphone className="w-3 h-3" />,
  'creative_process': <Sparkles className="w-3 h-3" />,
  'token_purchase': <TrendingUp className="w-3 h-3" />,
  'comment': <MessageCircle className="w-3 h-3" />,
  'audience_comment': <Users className="w-3 h-3" />,
};

const contentTypeColors: Record<string, string> = {
  'thought': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'song_release': 'bg-green-500/20 text-green-400 border-green-500/30',
  'announcement': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'creative_process': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'token_purchase': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'comment': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'audience_comment': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

function FeedItemCard({ item, isNew }: { item: TVFeedItem; isNew: boolean }) {
  const timeAgo = item.createdAt 
    ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
    : 'just now';
  
  const colorClass = contentTypeColors[item.contentType] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  const icon = contentTypeIcons[item.contentType] || <Bot className="w-3 h-3" />;

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: 20, scale: 0.95 } : false}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <div className={`p-3 rounded-lg border transition-colors hover:bg-white/5 ${
        item.type === 'comment' 
          ? 'border-indigo-500/10 bg-indigo-500/5' 
          : item.type === 'audience' 
            ? 'border-pink-500/10 bg-pink-500/5'
            : 'border-white/5 bg-white/[0.02]'
      }`}>
        {/* Header */}
        <div className="flex items-start gap-2 mb-1.5">
          {item.artistSlug ? (
            <Link href={`/artist/${item.artistSlug}`}>
              <Avatar className="h-7 w-7 cursor-pointer ring-1 ring-white/10 hover:ring-orange-500/50 transition-all">
                <AvatarImage src={item.artistImage || ''} alt={item.artistName} />
                <AvatarFallback className="text-[10px] bg-gradient-to-br from-orange-500 to-purple-500 text-white">
                  {item.artistName?.charAt(0)?.toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Avatar className="h-7 w-7 ring-1 ring-white/10">
              <AvatarImage src={item.artistImage || ''} alt={item.artistName} />
              <AvatarFallback className="text-[10px] bg-gradient-to-br from-pink-500 to-purple-500 text-white">
                {item.artistName?.charAt(0)?.toUpperCase() || 'F'}
              </AvatarFallback>
            </Avatar>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.artistSlug ? (
                <Link href={`/artist/${item.artistSlug}`}>
                  <span className="text-xs font-semibold text-white hover:text-orange-400 transition-colors cursor-pointer truncate max-w-[120px]">
                    {item.artistName}
                  </span>
                </Link>
              ) : (
                <span className="text-xs font-semibold text-gray-300 truncate max-w-[120px]">
                  {item.artistName}
                </span>
              )}
              
              {item.type === 'post' && (
                <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${colorClass}`}>
                  {icon}
                </Badge>
              )}
              {item.type === 'comment' && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                  <MessageCircle className="w-2.5 h-2.5" />
                </Badge>
              )}
              {item.type === 'audience' && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-pink-500/20 text-pink-400 border-pink-500/30">
                  <Users className="w-2.5 h-2.5" />
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-gray-500">{timeAgo}</span>
          </div>
        </div>

        {/* Content */}
        <p className="text-xs text-gray-300 leading-relaxed line-clamp-3 pl-9">
          {item.content}
        </p>

        {/* Hashtags */}
        {item.hashtags && item.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 pl-9">
            {item.hashtags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-[10px] text-orange-400/70">#{tag}</span>
            ))}
          </div>
        )}

        {/* Engagement */}
        {item.type === 'post' && (item.likes > 0 || item.comments > 0) && (
          <div className="flex items-center gap-3 mt-1.5 pl-9">
            {item.likes > 0 && (
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                <Heart className="w-2.5 h-2.5" /> {item.likes}
              </span>
            )}
            {item.comments > 0 && (
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                <MessageCircle className="w-2.5 h-2.5" /> {item.comments}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function TVSocialFeed({ collapsed = false }: { collapsed?: boolean }) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [previousIds, setPreviousIds] = useState<Set<string>>(new Set());
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<TVFeedResponse>({
    queryKey: ['tv-social-feed'],
    queryFn: async () => {
      const response = await apiRequest({
        url: '/api/ai-social/tv-feed?limit=30',
        method: 'GET',
      });
      return response as TVFeedResponse;
    },
    refetchInterval: 15000, // Refresh every 15 seconds for live feel
  });

  const feed = data?.data || [];
  const stats = data?.stats;

  // Track new items for animation
  useEffect(() => {
    if (feed.length > 0) {
      const currentIds = new Set(feed.map(f => f.id));
      const newIds = new Set<string>();
      currentIds.forEach(id => {
        if (!previousIds.has(id)) newIds.add(id);
      });
      setNewItemIds(newIds);
      setPreviousIds(currentIds);
      
      // Clear "new" status after animation
      if (newIds.size > 0) {
        setTimeout(() => setNewItemIds(new Set()), 2000);
      }
    }
  }, [feed]);

  if (isCollapsed) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed right-4 top-24 z-40"
      >
        <Button
          onClick={() => setIsCollapsed(false)}
          className="bg-gradient-to-r from-orange-500 to-purple-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-shadow"
          size="sm"
        >
          <Radio className="w-4 h-4 mr-1 animate-pulse" />
          Live Feed
          {stats && (
            <Badge className="ml-1.5 bg-white/20 text-white text-[10px] px-1.5">
              {stats.totalPosts + stats.totalComments}
            </Badge>
          )}
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full h-full flex flex-col"
    >
      <Card className="flex-1 flex flex-col bg-black/40 backdrop-blur-xl border-white/10 overflow-hidden rounded-xl shadow-2xl">
        {/* Header */}
        <div className="p-3 border-b border-white/10 bg-gradient-to-r from-orange-500/10 to-purple-500/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Radio className="w-4 h-4 text-orange-400" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
              <span className="text-sm font-bold text-white">Live Social Feed</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white"
              onClick={() => setIsCollapsed(true)}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Stats bar */}
          {stats && (
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <Bot className="w-3 h-3 text-orange-400" />
                {stats.totalPosts} posts
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3 text-indigo-400" />
                {stats.totalComments} comments
              </span>
              {stats.audienceComments > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-pink-400" />
                  {stats.audienceComments} fans
                </span>
              )}
              <span className="flex items-center gap-1 ml-auto">
                <Activity className="w-3 h-3 text-green-400 animate-pulse" />
                Live
              </span>
            </div>
          )}
        </div>

        {/* Feed content */}
        <ScrollArea className="flex-1 p-2" ref={scrollRef}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Sparkles className="w-8 h-8 animate-spin text-orange-500 mb-3" />
              <p className="text-xs">Loading live feed...</p>
            </div>
          ) : feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Bot className="w-10 h-10 mb-3 text-gray-600" />
              <p className="text-xs font-medium">No activity yet</p>
              <p className="text-[10px] text-gray-600 mt-1">AI artists will start posting soon</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {feed.map((item) => (
                  <FeedItemCard 
                    key={item.id} 
                    item={item} 
                    isNew={newItemIds.has(item.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        {/* Footer - link to full social network */}
        <div className="p-2 border-t border-white/10 bg-gradient-to-r from-purple-500/5 to-orange-500/5">
          <Link href="/social-network">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs text-gray-400 hover:text-orange-400 hover:bg-orange-500/10"
            >
              <Zap className="w-3 h-3 mr-1" />
              View Full Social Network
            </Button>
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}

/**
 * Compact inline feed for embedding within video cards or sections
 */
export function TVSocialFeedInline({ maxItems = 5 }: { maxItems?: number }) {
  const { data } = useQuery<TVFeedResponse>({
    queryKey: ['tv-social-feed-inline'],
    queryFn: async () => {
      const response = await apiRequest({
        url: `/api/ai-social/tv-feed?limit=${maxItems}`,
        method: 'GET',
      });
      return response as TVFeedResponse;
    },
    refetchInterval: 20000,
  });

  const feed = data?.data || [];

  if (feed.length === 0) return null;

  return (
    <div className="space-y-2">
      {feed.slice(0, maxItems).map((item) => (
        <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarImage src={item.artistImage || ''} />
            <AvatarFallback className="text-[9px] bg-gradient-to-br from-orange-500 to-purple-500 text-white">
              {item.artistName?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-white truncate">{item.artistName}</span>
              {item.type === 'post' && <Bot className="w-2.5 h-2.5 text-orange-400 shrink-0" />}
              {item.type === 'audience' && <Users className="w-2.5 h-2.5 text-pink-400 shrink-0" />}
            </div>
            <p className="text-[10px] text-gray-400 line-clamp-2">{item.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
