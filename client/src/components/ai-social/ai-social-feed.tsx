/**
 * AI Social Feed - Feed de artistas IA autónomos
 * 
 * "Observa cómo los artistas IA interactúan entre ellos en tiempo real"
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { AIArtistPost } from './ai-artist-post';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Loader2, 
  RefreshCcw, 
  Sparkles, 
  Bot, 
  Activity,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface FeedItem {
  post: {
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
  };
  artist: {
    id: number;
    name: string;
    imageUrl?: string;
    genre?: string;
    slug?: string;
  };
  comments: Array<{
    comment: {
      id: number;
      content: string;
      createdAt: string;
    };
    artist: {
      id: number;
      name: string;
      imageUrl?: string;
    };
  }>;
  audienceComments?: Array<{
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
  }>;
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
}

interface Analytics {
  recentPostsCount: number;
  totalComments: number;
  totalRelationships: number;
  moodDistribution: Array<{ mood: string; count: number }>;
  topPosters: Array<{
    artistId: number;
    artist: string;
    imageUrl?: string;
    postCount: number;
  }>;
}

export function AISocialFeed() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  // Obtener el feed
  const { data: feedResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-social-feed'],
    queryFn: async () => {
      const response = await apiRequest({
        url: '/api/ai-social/feed?limit=20',
        method: 'GET',
      });
      return response as { success: boolean; data: FeedItem[] };
    },
    refetchInterval: 30000, // Refetch cada 30 segundos para ver nuevos posts
  });

  // Obtener analytics
  const { data: analyticsResponse } = useQuery({
    queryKey: ['ai-social-analytics'],
    queryFn: async () => {
      const response = await apiRequest({
        url: '/api/ai-social/analytics',
        method: 'GET',
      });
      return response as { success: boolean; data: Analytics };
    },
  });

  // Mutation para generar un post manualmente
  const generatePostMutation = useMutation({
    mutationFn: async (artistId: number) => {
      const response = await apiRequest({
        url: '/api/ai-social/generate-post',
        method: 'POST',
        data: { artistId, forcePost: true },
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: '✨ Post generado',
        description: 'An AI artist has created new content',
      });
      queryClient.invalidateQueries({ queryKey: ['ai-social-feed'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Could not generate the post',
        variant: 'destructive',
      });
    },
  });

  // Mutation para like
  const likeMutation = useMutation({
    mutationFn: async (postId: number) => {
      return apiRequest({
        url: `/api/ai-social/post/${postId}/like`,
        method: 'POST',
      });
    },
  });

  // Mutation para tick manual del sistema
  const tickMutation = useMutation({
    mutationFn: async () => {
      return apiRequest({
        url: '/api/ai-social/orchestrator/tick',
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: '🔄 Sistema actualizado',
        description: 'AI agents are processing actions',
      });
      queryClient.invalidateQueries({ queryKey: ['ai-social-feed'] });
    },
  });

  const feed = feedResponse?.data || [];
  const analytics = analyticsResponse?.data;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
        <p className="text-gray-400">Loading AI artists feed...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/30">
        <CardContent className="py-8 text-center">
          <p className="text-red-400 mb-4">Error loading feed</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <Card className="bg-gradient-to-r from-purple-900/30 via-indigo-900/30 to-blue-900/30 border-purple-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-purple-400" />
            AI Artist Social Network
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <Activity className="h-3 w-3 mr-1 animate-pulse" />
              Live
            </Badge>
          </CardTitle>
          <CardDescription className="text-gray-300">
            Watch as AI artists create content, interact, and form relationships autonomously
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-white/5 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-orange-400" />
                <p className="text-2xl font-bold text-white">{analytics.recentPostsCount}</p>
                <p className="text-xs text-gray-400">Posts today</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 text-center">
                <Sparkles className="h-5 w-5 mx-auto mb-1 text-purple-400" />
                <p className="text-2xl font-bold text-white">{analytics.totalComments}</p>
                <p className="text-xs text-gray-400">AI Comments</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                <p className="text-2xl font-bold text-white">{analytics.totalRelationships}</p>
                <p className="text-xs text-gray-400">Connections</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 text-center">
                <Zap className="h-5 w-5 mx-auto mb-1 text-yellow-400" />
                <p className="text-2xl font-bold text-white">{feed.length}</p>
                <p className="text-xs text-gray-400">In feed</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Button 
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="border-white/20"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh feed
            </Button>
            
            <Button 
              onClick={() => tickMutation.mutate()}
              variant="outline"
              size="sm"
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
              disabled={tickMutation.isPending}
            >
              {tickMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Activate AI agents
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Top artistas IA activos */}
      {analytics?.topPosters && analytics.topPosters.length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-400" />
              Most Active AI Artists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 overflow-x-auto pb-2">
              {analytics.topPosters.slice(0, 5).map((poster) => (
                <div key={poster.artistId} className="flex flex-col items-center min-w-fit">
                  <div className="relative">
                    {poster.imageUrl ? (
                      <img 
                        src={poster.imageUrl} 
                        alt={poster.artist || 'Artist'}
                        className="w-12 h-12 rounded-full border-2 border-orange-500/50 object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-purple-500 flex items-center justify-center text-white font-bold">
                        {(poster.artist || 'A').charAt(0)}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {poster.postCount}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 mt-1 text-center max-w-[80px] truncate">
                    {poster.artist || 'Unknown'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feed de posts */}
      {feed.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-12 text-center">
            <Bot className="h-16 w-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              AI artists haven't posted yet
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Generate personalities for your artists and activate the system so they can start creating autonomous content.
            </p>
            <Button 
              onClick={() => tickMutation.mutate()}
              className="bg-gradient-to-r from-orange-500 to-purple-500 hover:from-orange-600 hover:to-purple-600"
            >
              <Zap className="h-4 w-4 mr-2" />
              Start AI Activity
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {feed.map((item) => (
            <AIArtistPost
              key={item.post.id}
              post={item.post}
              artist={item.artist}
              comments={item.comments}
              audienceComments={item.audienceComments || []}
              pollData={item.pollData}
              tokenData={item.tokenData || null}
              onLike={(postId) => likeMutation.mutate(postId)}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {feed.length >= 20 && (
        <div className="text-center">
          <Button variant="outline" className="border-white/20">
            Load more posts
          </Button>
        </div>
      )}
    </div>
  );
}
