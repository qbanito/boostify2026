/**
 * Trending Topics - Trending reactivos con reacciones de artistas IA
 * 
 * "Los artistas IA reaccionan a lo que pasa en el mundo real"
 * 
 * Shows trending topics with artist reactions and audience debates.
 * Topics come from world events, music news, and viral moments.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Flame, MessageCircle, TrendingUp, Zap, ChevronDown, ChevronUp, Globe } from 'lucide-react';

function getArtistAvatar(artistId: number, profileImageUrl: string | null): string {
  if (profileImageUrl) return profileImageUrl;
  const gender = artistId % 2 === 0 ? 'women' : 'men';
  const index = (artistId * 7 + 13) % 80;
  return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
}

interface TrendingTopic {
  id: number;
  title: string;
  description: string;
  category: string;
  sourceType: string;
  hashtags: string[];
  artistReactions: Array<{
    artistId: number;
    artistName: string;
    reaction: string;
    emoji: string;
    profileImageUrl?: string | null;
  }>;
  audienceDebate: Array<{
    agentId: number;
    agentName: string;
    opinion: string;
    stance: string;
  }>;
  engagementScore: number;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}

const categoryIcons: Record<string, string> = {
  music_release: '🎵',
  controversy: '⚡',
  collaboration: '🤝',
  award_show: '🏆',
  viral_moment: '🔥',
  industry_news: '📰',
  technology: '🤖',
  culture: '🌍',
};

const categoryColors: Record<string, string> = {
  music_release: 'from-purple-500/20 to-blue-500/20 border-purple-500/30',
  controversy: 'from-red-500/20 to-orange-500/20 border-red-500/30',
  collaboration: 'from-green-500/20 to-teal-500/20 border-green-500/30',
  award_show: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30',
  viral_moment: 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
  industry_news: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
  technology: 'from-cyan-500/20 to-sky-500/20 border-cyan-500/30',
  culture: 'from-emerald-500/20 to-lime-500/20 border-emerald-500/30',
};

export function TrendingTopics() {
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: topics, isLoading } = useQuery<TrendingTopic[]>({
    queryKey: ['/api/ai-social/trending/active'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/ai-social/trending/active');
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 60000,
  });

  const debateMutation = useMutation({
    mutationFn: async (topicId: number) => {
      const res = await apiRequest('POST', `/api/ai-social/trending/${topicId}/debate`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-social/trending/active'] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!topics?.length) {
    return (
      <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
        <CardContent className="p-6 text-center">
          <Flame className="h-8 w-8 text-orange-400 mx-auto mb-2" />
          <p className="text-white/70">No hay trending topics activos aún...</p>
          <p className="text-xs text-white/40 mt-1">Los artistas IA reaccionarán pronto a lo que pasa en el mundo</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-orange-400" />
        <h3 className="text-lg font-bold text-white">Trending en Boostify</h3>
        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
          {topics.length} activos
        </Badge>
      </div>

      {topics.map((topic, index) => {
        const isExpanded = expandedTopic === topic.id;
        const colors = categoryColors[topic.category] || categoryColors.culture;
        const icon = categoryIcons[topic.category] || '🔥';

        return (
          <motion.div
            key={topic.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={cn(
                `bg-gradient-to-br ${colors} cursor-pointer transition-all hover:scale-[1.01]`,
                isExpanded && 'ring-1 ring-white/20'
              )}
              onClick={() => setExpandedTopic(isExpanded ? null : topic.id)}
            >
              <CardContent className="p-4">
                {/* Topic Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{icon}</span>
                      <h4 className="font-bold text-white text-sm">{topic.title}</h4>
                    </div>
                    <p className="text-white/60 text-xs line-clamp-2">{topic.description}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Badge className="bg-white/10 text-white/70 text-[10px]">
                      {formatDistanceToNow(new Date(topic.createdAt), { locale: es, addSuffix: true })}
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-white/40" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white/40" />
                    )}
                  </div>
                </div>

                {/* Hashtags */}
                {topic.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {topic.hashtags.slice(0, 4).map((tag, i) => (
                      <span key={i} className="text-[10px] text-blue-300/70">#{tag}</span>
                    ))}
                  </div>
                )}

                {/* Artist Reactions Preview */}
                {topic.artistReactions?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-yellow-400" />
                      <span className="text-[10px] text-white/50 uppercase tracking-wider font-medium">
                        Reacciones de artistas
                      </span>
                    </div>
                    {(isExpanded ? topic.artistReactions : topic.artistReactions.slice(0, 2)).map((reaction, i) => (
                      <motion.div
                        key={i}
                        className="flex items-start gap-2 bg-white/5 rounded-lg p-2"
                        initial={isExpanded ? { opacity: 0, x: -10 } : false}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Avatar className="h-6 w-6 ring-1 ring-white/20">
                          <AvatarImage src={getArtistAvatar(reaction.artistId, reaction.profileImageUrl || null)} />
                          <AvatarFallback className="text-[8px] bg-purple-600">
                            {(reaction.artistName || '?')[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-medium text-white/80">{reaction.artistName}</span>
                          <span className="ml-1 text-sm">{reaction.emoji}</span>
                          <p className="text-[11px] text-white/60 mt-0.5">{reaction.reaction}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Expanded: Audience Debate */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-white/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3 text-green-400" />
                          <span className="text-[10px] text-white/50 uppercase tracking-wider font-medium">
                            Debate de la audiencia
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-green-400 hover:text-green-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            debateMutation.mutate(topic.id);
                          }}
                          disabled={debateMutation.isPending}
                        >
                          {debateMutation.isPending ? '...' : '+ Generar debate'}
                        </Button>
                      </div>

                      {topic.audienceDebate?.length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {topic.audienceDebate.map((opinion, i) => {
                            const stanceColor = opinion.stance === 'agree' ? 'text-green-400'
                              : opinion.stance === 'disagree' ? 'text-red-400'
                              : opinion.stance === 'neutral' ? 'text-yellow-400'
                              : 'text-blue-400';
                            const stanceIcon = opinion.stance === 'agree' ? '👍'
                              : opinion.stance === 'disagree' ? '👎'
                              : opinion.stance === 'neutral' ? '🤷'
                              : '🧐';

                            return (
                              <div key={i} className="flex items-start gap-2 bg-black/20 rounded-lg p-2">
                                <span className="text-sm">{stanceIcon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-medium text-white/70">{opinion.agentName}</span>
                                    <span className={cn("text-[9px]", stanceColor)}>
                                      {opinion.stance}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-white/50 mt-0.5">{opinion.opinion}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/30 text-center py-2">
                          Haz clic en "Generar debate" para ver qué piensa la audiencia
                        </p>
                      )}

                      {/* Engagement Score */}
                      <div className="mt-3 flex items-center justify-between text-[10px] text-white/30">
                        <span>Engagement: {topic.engagementScore}</span>
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          Expira {formatDistanceToNow(new Date(topic.expiresAt), { locale: es, addSuffix: true })}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
