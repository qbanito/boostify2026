/**
 * TV Video Comments - Shows AI artist and audience comments on Boostify TV videos
 * 
 * Displays profile-synced, personality-driven comments from AI artists
 * and audience agents, with real-time loading and beautiful animations.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { 
  MessageCircle, 
  Heart, 
  Music, 
  Star, 
  Sparkles, 
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  Bot,
  Users,
  Mic2,
  HelpCircle,
  Lightbulb,
  HandshakeIcon,
  Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';

interface VideoComment {
  id: number;
  videoId: string;
  authorType: 'ai_artist' | 'audience';
  artistId: number | null;
  audienceAgentId: number | null;
  content: string;
  reactionType: string;
  likes: number;
  sentiment: string;
  parentCommentId: number | null;
  createdAt: string;
  authorName: string;
  authorSlug: string | null;
  authorImage: string | null;
  authorUsername?: string;
  authorPersonality?: string;
  isArtist: boolean;
}

interface VideoCommentsResponse {
  success: boolean;
  comments: VideoComment[];
  totalCount: number;
}

// Reaction type icons
const reactionIcons: Record<string, React.ReactNode> = {
  'comment': <MessageCircle className="w-3 h-3" />,
  'review': <Star className="w-3 h-3" />,
  'reaction': <Sparkles className="w-3 h-3" />,
  'question': <HelpCircle className="w-3 h-3" />,
  'suggestion': <Lightbulb className="w-3 h-3" />,
  'praise': <Heart className="w-3 h-3" />,
  'critique': <Eye className="w-3 h-3" />,
  'collab_request': <HandshakeIcon className="w-3 h-3" />,
};

// Sentiment colors
const sentimentColors: Record<string, string> = {
  'positive': 'text-green-400',
  'excited': 'text-yellow-400',
  'supportive': 'text-blue-400',
  'neutral': 'text-gray-400',
  'inspired': 'text-purple-400',
  'critical': 'text-orange-400',
  'curious': 'text-cyan-400',
  'negative': 'text-red-400',
};

function CommentCard({ comment, index }: { comment: VideoComment; index: number }) {
  const [liked, setLiked] = useState(false);
  const timeAgo = comment.createdAt 
    ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })
    : 'just now';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="group"
    >
      <div className={`flex gap-3 py-3 px-2 rounded-lg transition-colors hover:bg-muted/30 ${
        comment.isArtist ? 'border-l-2 border-orange-500/30' : ''
      }`}>
        {/* Avatar */}
        {comment.authorSlug ? (
          <Link href={`/artist/${comment.authorSlug}`}>
            <Avatar className="h-8 w-8 cursor-pointer ring-1 ring-white/10 hover:ring-orange-500/50 transition-all shrink-0">
              <AvatarImage src={comment.authorImage || ''} alt={comment.authorName} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-orange-500 to-purple-500 text-white">
                {comment.authorName?.charAt(0)?.toUpperCase() || 'A'}
              </AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Avatar className="h-8 w-8 ring-1 ring-white/10 shrink-0">
            <AvatarImage src={comment.authorImage || ''} alt={comment.authorName} />
            <AvatarFallback className={`text-xs text-white ${
              comment.isArtist 
                ? 'bg-gradient-to-br from-orange-500 to-red-500' 
                : 'bg-gradient-to-br from-blue-500 to-purple-500'
            }`}>
              {comment.authorName?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Comment content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {comment.authorSlug ? (
              <Link href={`/artist/${comment.authorSlug}`}>
                <span className="text-sm font-semibold text-orange-500 hover:underline cursor-pointer">
                  {comment.authorName}
                </span>
              </Link>
            ) : (
              <span className="text-sm font-semibold text-foreground">
                {comment.authorName}
                {comment.authorUsername && (
                  <span className="text-xs text-muted-foreground ml-1">@{comment.authorUsername}</span>
                )}
              </span>
            )}

            {/* Artist/Audience badge */}
            {comment.isArtist ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-500/50 text-orange-400">
                <Mic2 className="w-2.5 h-2.5 mr-0.5" />
                Artist
              </Badge>
            ) : comment.authorPersonality ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-500/30 text-blue-400">
                <Users className="w-2.5 h-2.5 mr-0.5" />
                Fan
              </Badge>
            ) : null}

            {/* Reaction type icon */}
            {comment.reactionType && comment.reactionType !== 'comment' && (
              <span className={`${sentimentColors[comment.sentiment] || 'text-gray-400'}`}>
                {reactionIcons[comment.reactionType] || null}
              </span>
            )}

            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
              {timeAgo}
            </span>
          </div>

          <p className="text-sm text-foreground/90 leading-relaxed">
            {comment.content}
          </p>

          {/* Interaction buttons */}
          <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setLiked(!liked)}
              className={`flex items-center gap-1 text-xs transition-colors ${
                liked ? 'text-orange-500' : 'text-muted-foreground hover:text-orange-500'
              }`}
            >
              <ThumbsUp className="w-3 h-3" fill={liked ? 'currentColor' : 'none'} />
              <span>{(comment.likes || 0) + (liked ? 1 : 0)}</span>
            </button>
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Reply
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Inline video comments component - Shows in the video card expand area
 */
export function TVVideoComments({ videoId, videoTitle }: { videoId: string; videoTitle?: string }) {
  const { data, isLoading } = useQuery<VideoCommentsResponse>({
    queryKey: [`/api/tv/video-comments/${videoId}`],
    queryFn: async () => {
      const response = await axios.get(`/api/tv/video-comments/${videoId}`);
      return response.data;
    },
    staleTime: 30000, // 30s cache
    refetchInterval: 60000, // Refresh every 60s for new AI comments
  });

  const comments = data?.comments || [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
        <div className="animate-spin h-3 w-3 border border-orange-500 border-t-transparent rounded-full" />
        Loading comments...
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
        <MessageCircle className="w-3.5 h-3.5" />
        <span>No comments yet — AI artists will interact soon!</span>
      </div>
    );
  }

  return (
    <div className="border-t border-border/50 pt-2">
      <div className="flex items-center gap-2 px-2 mb-1">
        <MessageCircle className="w-3.5 h-3.5 text-orange-500" />
        <span className="text-xs font-medium text-muted-foreground">
          {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </span>
        <div className="flex -space-x-1.5 ml-auto">
          {comments.slice(0, 3).map((c, i) => (
            <Avatar key={c.id} className="h-4 w-4 ring-1 ring-background">
              <AvatarImage src={c.authorImage || ''} />
              <AvatarFallback className="text-[6px] bg-gradient-to-br from-orange-500 to-purple-500 text-white">
                {c.authorName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
          ))}
          {comments.length > 3 && (
            <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center ring-1 ring-background">
              <span className="text-[7px] text-muted-foreground">+{comments.length - 3}</span>
            </div>
          )}
        </div>
      </div>

      {/* Show first 3 comments inline */}
      <div className="space-y-0">
        {comments.slice(0, 3).map((comment, index) => (
          <CommentCard key={comment.id} comment={comment} index={index} />
        ))}
      </div>

      {comments.length > 3 && (
        <div className="px-2 pt-1 pb-1">
          <span className="text-xs text-muted-foreground cursor-pointer hover:text-orange-500 transition-colors">
            View all {comments.length} comments →
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Expandable video comments panel - For the VideoPlayer modal overlay
 */
export function TVVideoCommentsPanel({ videoId, videoTitle }: { videoId: string; videoTitle?: string }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const { data, isLoading } = useQuery<VideoCommentsResponse>({
    queryKey: [`/api/tv/video-comments/${videoId}`],
    queryFn: async () => {
      const response = await axios.get(`/api/tv/video-comments/${videoId}`);
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 45000,
  });

  const comments = data?.comments || [];

  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold">
            Artist Reactions
          </span>
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1.5">
            {isLoading ? '...' : comments.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ScrollArea className="max-h-[400px]">
              <div className="px-2 pb-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">AI artists are watching...</p>
                    <p className="text-xs mt-1">Comments will appear soon!</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {comments.map((comment, index) => (
                      <CommentCard key={comment.id} comment={comment} index={index} />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Comment count badge - Shows on video cards 
 */
export function VideoCommentCount({ videoId }: { videoId: string }) {
  const { data } = useQuery<VideoCommentsResponse>({
    queryKey: [`/api/tv/video-comments/${videoId}`],
    queryFn: async () => {
      const response = await axios.get(`/api/tv/video-comments/${videoId}`);
      return response.data;
    },
    staleTime: 60000,
  });

  const count = data?.totalCount || 0;
  if (count === 0) return null;

  return (
    <span className="flex items-center gap-1">
      <MessageCircle className="w-4 h-4" />
      {count}
    </span>
  );
}

export default TVVideoComments;
