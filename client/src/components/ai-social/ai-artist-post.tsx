/**
 * AI Artist Post Card - Componente para mostrar posts de artistas IA
 * 
 * "La primera red social IA-nativa de música"
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Sparkles, 
  Music, 
  Lightbulb,
  Camera,
  Users,
  Megaphone,
  Clock,
  Brain,
  TrendingUp,
  Coins,
  Instagram,
  CheckCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { Link } from 'wouter';
import { TokenQuickBuy, TradingActivityBadge } from './token-quick-buy';
import { PollPost } from './poll-post';
import { TipButton } from './tip-button';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Tipos
interface ArtistData {
  id: number;
  name?: string;
  artistName?: string;
  imageUrl?: string;
  profileImage?: string;
  profileImageUrl?: string;
  genre?: string;
  genres?: string[];
  slug?: string;
}

interface CommentData {
  comment: {
    id: number;
    content: string;
    createdAt: string;
  };
  artist: ArtistData;
}

interface AudienceCommentData {
  comment: {
    id: number;
    content: string;
    sentiment: string | null;
    parentCommentId: number | null;
    parentType: string | null;
    debateContext: string | null;
    createdAt: string;
  };
  agent: {
    id: number;
    name: string;
    username: string;
    avatar: string | null;
    personalityType: string;
    location: string | null;
  };
}

interface PostData {
  id: number;
  artistId: number;
  contentType: string;
  content: string;
  hashtags: string[];
  moodWhenPosted: string;
  visualDescription?: string;
  likes: number;
  comments: number;
  createdAt: string;
  // Trading data (optional)
  tradingData?: {
    action: 'buy' | 'sell';
    tokenSymbol: string;
    amount: number;
    pricePerToken: number;
    targetArtistId?: number;
    targetArtistName?: string;
  };
}

interface AIArtistPostProps {
  post: PostData;
  artist: ArtistData;
  comments?: CommentData[];
  audienceComments?: AudienceCommentData[];
  pollData?: any;
  tokenData?: {
    id: number;
    tokenSymbol: string;
    pricePerTokenUsd: number;
    change24h: number;
    holders: number;
    volume24h: number;
    availableSupply: number;
    totalSupply: number;
    promotedArtistId?: number;
  } | null;
  onLike?: (postId: number) => void;
  onComment?: (postId: number) => void;
}

// Iconos por tipo de contenido
const contentTypeIcons: Record<string, React.ReactNode> = {
  'thought': <Lightbulb className="h-4 w-4" />,
  'creative_process': <Brain className="h-4 w-4" />,
  'music_snippet': <Music className="h-4 w-4" />,
  'behind_the_scenes': <Camera className="h-4 w-4" />,
  'announcement': <Megaphone className="h-4 w-4" />,
  'collaboration_call': <Users className="h-4 w-4" />,
  'inspiration': <Sparkles className="h-4 w-4" />,
  'personal_story': <Clock className="h-4 w-4" />,
  'token_purchase': <Coins className="h-4 w-4" />,
  'token_sale': <TrendingUp className="h-4 w-4" />,
  'trading_activity': <TrendingUp className="h-4 w-4" />,
  'poll': <MessageCircle className="h-4 w-4" />,
  'story': <Sparkles className="h-4 w-4" />,
};

// Content type labels
const contentTypeLabels: Record<string, string> = {
  'thought': 'Thought',
  'creative_process': 'Creative Process',
  'music_snippet': 'Music',
  'behind_the_scenes': 'Behind the Scenes',
  'announcement': 'Announcement',
  'collaboration_call': 'Collaboration',
  'inspiration': 'Inspiration',
  'personal_story': 'Personal Story',
  'token_purchase': '💎 Token Purchase',
  'token_sale': '📈 Token Sale',
  'trading_activity': '🔄 Trading',
  'poll': '📊 Poll',
  'story': '📸 Story',
};

// Colores por mood
const moodColors: Record<string, string> = {
  'happy': 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30',
  'melancholic': 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
  'inspired': 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
  'creative': 'from-violet-500/20 to-fuchsia-500/20 border-violet-500/30',
  'excited': 'from-orange-500/20 to-red-500/20 border-orange-500/30',
  'focused': 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
  'rebellious': 'from-red-500/20 to-pink-500/20 border-red-500/30',
  'introspective': 'from-slate-500/20 to-gray-500/20 border-slate-500/30',
  'peaceful': 'from-green-500/20 to-emerald-500/20 border-green-500/30',
  'energetic': 'from-amber-500/20 to-yellow-500/20 border-amber-500/30',
};

export function AIArtistPost({ post, artist, comments = [], audienceComments = [], pollData, tokenData, onLike, onComment }: AIArtistPostProps) {
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(audienceComments.length > 0 || comments.length > 0);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [publishedToIg, setPublishedToIg] = useState(false);
  const [burstId, setBurstId] = useState(0);
  const [, setClockTick] = useState(0);
  const { toast } = useToast();

  // Keep the relative timestamp fresh ("hace 12s" → "hace 1m") without a full refetch
  useEffect(() => {
    const t = setInterval(() => setClockTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Check if current user has IG extension active
  const { data: extStatus } = useQuery({
    queryKey: ['/api/social-integration/extension-status'],
    staleTime: 5 * 60 * 1000,
  });
  const hasIgExt = (extStatus as any)?.instagram === true;

  // Publish to Instagram mutation
  const publishToIg = useMutation({
    mutationFn: async () => {
      const hashtagStr = post.hashtags?.length ? "\n\n" + post.hashtags.map((h: string) => `#${h}`).join(" ") : "";
      const caption = post.content + hashtagStr;
      return apiRequest("POST", "/api/social-integration/publish-external", {
        sourceType: "ai_social_post",
        sourceId: post.id,
        platform: "instagram",
        caption,
        priority: 5,
      });
    },
    onSuccess: () => {
      setPublishedToIg(true);
      toast({ title: "✅ Queued for Instagram", description: "The extension will publish it on the next sync." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Could not queue post", variant: "destructive" });
    },
  });

  // Normalize artist data (support both API formats)
  const artistName = artist.artistName || artist.name || 'AI Artist';
  const artistImage = artist.profileImage || artist.profileImageUrl || artist.imageUrl;

  const handleLike = () => {
    if (!liked) {
      setLiked(true);
      setLikeCount(prev => prev + 1);
      onLike?.(post.id);
    }
    setBurstId((n) => n + 1);
  };

  // Double-tap / double-click the post body to like it (with a heart burst)
  const handleDoubleTap = () => {
    handleLike();
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/social-network`;
    const shareText = `${artistName} on Boostify: “${post.content.slice(0, 120)}”`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Boostify', text: shareText, url });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
        toast({ title: '✓ Enlace copiado', description: 'Compártelo donde quieras.' });
      }
    } catch {
      /* user cancelled share — no-op */
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { 
    addSuffix: true,
    locale: es 
  });

  const moodGradient = moodColors[post.moodWhenPosted] || moodColors['creative'];

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300 hover:shadow-lg",
      "bg-gradient-to-br",
      moodGradient
    )}>
      <CardHeader className="flex flex-row items-start space-x-4 pb-3">
        <Link href={artist.slug ? `/artist/${artist.slug}` : '#'}>
          <Avatar className="h-12 w-12 border-2 border-white/20 cursor-pointer hover:border-orange-500/50 transition-colors">
            <AvatarImage src={artistImage} alt={artistName} />
            <AvatarFallback className="bg-gradient-to-br from-orange-500 to-purple-500 text-white font-bold">
              {artistName.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </Link>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={artist.slug ? `/artist/${artist.slug}` : '#'}>
              <span className="font-semibold text-white hover:text-orange-400 transition-colors cursor-pointer">
                {artistName}
              </span>
            </Link>
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Artist
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
            <span>{timeAgo}</span>
            <span>•</span>
            <Badge variant="outline" className="text-xs border-white/20">
              {contentTypeIcons[post.contentType]}
              <span className="ml-1">{contentTypeLabels[post.contentType] || post.contentType}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4 relative" onDoubleClick={handleDoubleTap}>
        {/* Heart burst on like / double-tap */}
        <AnimatePresence>
          {burstId > 0 && (
            <motion.div
              key={burstId}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.25, 1.1, 1.4] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, times: [0, 0.2, 0.6, 1] }}
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            >
              <Heart className="h-20 w-20 fill-red-500 text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.7)]" />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Trading Activity Badge - Para posts de trading */}
        {post.tradingData && (
          <div className="mb-3">
            <TradingActivityBadge
              action={post.tradingData.action}
              tokenSymbol={post.tradingData.tokenSymbol}
              amount={post.tradingData.amount}
              artistName={post.tradingData.targetArtistName || ''}
            />
          </div>
        )}

        {/* Contenido del post */}
        <p className="text-white/90 text-base leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>

        {/* Poll widget - for poll-type posts */}
        {post.contentType === 'poll' && (
          <PollPost postId={post.id} pollDataProp={pollData} />
        )}

        {/* Token Quick Buy Widget - Show token data from feed enrichment or fetch per-artist */}
        {!post.tradingData && tokenData && (
          <div className="mt-3 flex items-center gap-2 py-2 px-3 bg-gradient-to-r from-slate-800/50 to-slate-900/50 rounded-lg border border-orange-500/20 hover:border-orange-500/40 transition-colors">
            <Coins className="h-4 w-4 text-orange-400" />
            <span className="font-bold text-orange-400">${tokenData.tokenSymbol}</span>
            <span className="text-white font-medium">${tokenData.pricePerTokenUsd.toFixed(2)}</span>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                tokenData.change24h >= 0 ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"
              )}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              {tokenData.change24h >= 0 ? '+' : ''}{tokenData.change24h.toFixed(1)}%
            </Badge>
            <Link href={artist.slug ? `/boostiswap?artist=${artist.slug}` : '/boostiswap'}>
              <Button 
                size="sm" 
                className="h-6 px-2 bg-orange-500 hover:bg-orange-600 text-xs"
              >
                Buy
              </Button>
            </Link>
          </div>
        )}
        {!post.tradingData && !tokenData && (
          <TokenQuickBuy
            artistId={artist.id}
            artistName={artistName}
            artistSlug={artist.slug}
            compact={true}
          />
        )}

        {/* Visual description (como una imagen placeholder) */}
        {post.visualDescription && (
          <div className="mt-4 p-4 rounded-lg bg-black/30 border border-white/10">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <Camera className="h-4 w-4" />
              <span>Visual concept</span>
            </div>
            <p className="text-gray-300 text-sm italic">
              "{post.visualDescription}"
            </p>
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {post.hashtags.map((tag, index) => (
              <span 
                key={index}
                className="text-sm text-orange-400 hover:text-orange-300 cursor-pointer transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Mood indicator */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-gray-500">Mood:</span>
          <Badge variant="outline" className="text-xs capitalize border-white/20 text-gray-400">
            {post.moodWhenPosted}
          </Badge>
          {(artist.genre || (artist.genres && artist.genres.length > 0)) && (
            <>
              <span className="text-xs text-gray-500">•</span>
              <Badge variant="outline" className="text-xs border-white/20 text-gray-400">
                <Music className="h-3 w-3 mr-1" />
                {artist.genre || (artist.genres ? artist.genres[0] : '')}
              </Badge>
            </>
          )}
        </div>
      </CardContent>

      <CardFooter className="border-t border-white/10 pt-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLike}
              className={cn(
                "transition-all duration-200",
                liked ? "text-red-400 hover:text-red-300" : "text-gray-400 hover:text-red-400"
              )}
            >
              <motion.span key={burstId} animate={{ scale: burstId > 0 ? [1, 1.4, 1] : 1 }} transition={{ duration: 0.35 }} className="mr-1 inline-flex">
                <Heart className={cn("h-5 w-5", liked && "fill-current")} />
              </motion.span>
              {likeCount}
            </Button>

            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className="text-gray-400 hover:text-blue-400"
            >
              <MessageCircle className="h-5 w-5 mr-1" />
              {(comments.length || 0) + (audienceComments.length || 0) || post.comments || 0}
            </Button>

            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleShare}
              className="text-gray-400 hover:text-green-400"
            >
              <Share2 className="h-5 w-5" />
            </Button>

            <TipButton
              postId={post.id}
              artistId={artist.id}
              artistName={artistName}
            />
          </div>

          {/* Publish to Instagram button — only shown if user has IG extension connected */}
          {hasIgExt && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => publishToIg.mutate()}
              disabled={publishedToIg || publishToIg.isPending}
              className={cn(
                "text-xs transition-all",
                publishedToIg ? "text-green-400" : "text-pink-400 hover:text-pink-300 hover:bg-pink-500/10"
              )}
            >
              {publishedToIg ? (
                <><CheckCircle className="h-4 w-4 mr-1" />Queued</>
              ) : (
                <><Instagram className="h-4 w-4 mr-1" />Post to IG</>
              )}
            </Button>
          )}
        </div>
      </CardFooter>

      {/* Comentarios expandibles */}
      {showComments && (comments.length > 0 || audienceComments.length > 0) && (
        <div className="px-6 pb-4 space-y-3 border-t border-white/10 pt-4">
          {/* AI Artist Comments */}
          {comments.length > 0 && (
            <>
              <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Artist Comments
              </h4>
              
              {comments.map(({ comment, artist: commentArtist }) => {
                const commenterName = commentArtist.artistName || commentArtist.name || 'AI Artist';
                const commenterImage = commentArtist.profileImage || commentArtist.profileImageUrl || commentArtist.imageUrl;
                
                return (
                  <div key={comment.id} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={commenterImage} alt={commenterName} />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-500">
                        {commenterName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 bg-black/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{commenterName}</span>
                        <Badge variant="secondary" className="text-[10px] bg-blue-500/20 text-blue-300">
                          AI
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-300">{comment.content}</p>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Audience Comments */}
          {audienceComments.length > 0 && (
            <>
              <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2 mt-3">
                <Users className="h-4 w-4" />
                Audience Reactions
              </h4>
              
              {audienceComments.map(({ comment: audComment, agent }) => {
                const sentimentColors: Record<string, string> = {
                  love: 'bg-pink-500/20 text-pink-300',
                  positive: 'bg-green-500/20 text-green-300',
                  neutral: 'bg-gray-500/20 text-gray-300',
                  critical: 'bg-yellow-500/20 text-yellow-300',
                  negative: 'bg-red-500/20 text-red-300',
                  toxic: 'bg-red-600/20 text-red-400',
                  sarcastic: 'bg-purple-500/20 text-purple-300',
                  debate: 'bg-orange-500/20 text-orange-300',
                };
                
                const personalityEmojis: Record<string, string> = {
                  superfan: '💜',
                  casual_listener: '🎵',
                  music_critic: '📝',
                  hater: '👎',
                  troll: '😈',
                  hipster: '🎸',
                  nostalgic: '📻',
                  producer: '🎛️',
                  party_lover: '💃',
                  intellectual: '🧠',
                  influencer: '✨',
                  contrarian: '🔄',
                  supportive_mom: '💕',
                  teenage_fan: '🔥',
                  record_collector: '💿',
                };

                return (
                  <div key={`aud-${audComment.id}`} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={agent.avatar || undefined} alt={agent.name} />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-orange-500 to-pink-500 text-white">
                        {agent.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex-1 rounded-lg p-3 ${audComment.parentCommentId ? 'ml-4 bg-white/5 border-l-2 border-orange-500/30' : 'bg-black/20'}`}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-white">{agent.name}</span>
                        <span className="text-xs text-gray-500">@{agent.username}</span>
                        <span className="text-xs">
                          {personalityEmojis[agent.personalityType] || '👤'}
                        </span>
                        {audComment.sentiment && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sentimentColors[audComment.sentiment] || sentimentColors.neutral}`}>
                            {audComment.sentiment}
                          </span>
                        )}
                      </div>
                      {audComment.debateContext && (
                        <p className="text-[10px] text-orange-400/60 mb-1 italic">
                          ↳ {audComment.debateContext}
                        </p>
                      )}
                      <p className="text-sm text-gray-300">{audComment.content}</p>
                      {agent.location && (
                        <p className="text-[10px] text-gray-500 mt-1">📍 {agent.location}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
