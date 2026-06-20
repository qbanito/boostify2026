/**
 * Manage Artist - "Manage Your Artist" Mode
 * 
 * "Adopta un artista IA y toma decisiones estratégicas"
 * 
 * Dashboard showing managed artists, pending decisions
 * with options + AI recommendation, and decision history.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Target, Users, ChevronRight, Clock, Zap, Brain, 
  CheckCircle2, XCircle, AlertTriangle, Shield, PlusCircle 
} from 'lucide-react';

function getArtistAvatar(artistId: number, profileImageUrl: string | null): string {
  if (profileImageUrl) return profileImageUrl;
  const gender = artistId % 2 === 0 ? 'women' : 'men';
  const index = (artistId * 7 + 13) % 80;
  return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
}

interface ManagedArtist {
  management: {
    id: number;
    managerId: number;
    artistId: number;
    autonomyLevel: number;
    totalDecisions: number;
    successfulDecisions: number;
    isActive: boolean;
  };
  artist: {
    id: number;
    username: string;
    artistName: string | null;
    genre: string | null;
    profileImageUrl: string | null;
  };
  pendingDecisions: number;
}

interface DecisionOption {
  id: string;
  label: string;
  description: string;
  predictedOutcome: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface ManagementDecision {
  id: number;
  managementId: number;
  managerId: number;
  artistId: number;
  decisionType: string;
  title: string;
  description: string;
  options: DecisionOption[];
  aiRecommendation: string;
  selectedOption: string | null;
  status: string;
  outcome: string | null;
  xpEarned: number | null;
  expiresAt: string;
  createdAt: string;
}

interface AvailableArtist {
  id: number;
  artistName: string | null;
  genre: string | null;
  profileImageUrl: string | null;
  isManaged: boolean;
}

const riskColors = {
  low: 'text-green-400 bg-green-500/10 border-green-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const riskIcons = {
  low: <Shield className="h-3 w-3" />,
  medium: <AlertTriangle className="h-3 w-3" />,
  high: <Zap className="h-3 w-3" />,
};

interface ManageArtistProps {
  userId?: number;
}

export function ManageArtist({ userId }: ManageArtistProps) {
  const queryClient = useQueryClient();
  const [showAvailable, setShowAvailable] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const { data: managedArtists, isLoading } = useQuery<ManagedArtist[]>({
    queryKey: ['/api/ai-social/manage/my-artists', userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await apiRequest('GET', `/api/ai-social/manage/my-artists/${userId}`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const { data: decisions } = useQuery<ManagementDecision[]>({
    queryKey: ['/api/ai-social/manage/decisions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await apiRequest('GET', `/api/ai-social/manage/decisions/${userId}`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!userId,
    refetchInterval: 15000,
  });

  const { data: availableArtists } = useQuery<AvailableArtist[]>({
    queryKey: ['/api/ai-social/manage/available'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/ai-social/manage/available');
      const json = await res.json();
      return json.data || [];
    },
    enabled: showAvailable,
  });

  const adoptMutation = useMutation({
    mutationFn: async (artistId: number) => {
      const res = await apiRequest('POST', '/api/ai-social/manage/adopt', {
        managerId: userId, artistId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-social/manage'] });
      setShowAvailable(false);
    },
  });

  const decideMutation = useMutation({
    mutationFn: async ({ decisionId, option }: { decisionId: number; option: string }) => {
      const res = await apiRequest('POST', '/api/ai-social/manage/decide', {
        decisionId,
        managerId: userId,
        selectedOption: option,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-social/manage'] });
      setSelectedDecision(null);
      setSelectedOption(null);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (artistId: number) => {
      const res = await apiRequest('POST', '/api/ai-social/manage/release', {
        managerId: userId, artistId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-social/manage'] });
    },
  });

  if (!userId) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Manager Mode</h3>
          {(decisions?.length || 0) > 0 && (
            <Badge className="bg-red-500/20 text-red-300 text-[10px] border-red-500/30 animate-pulse">
              {decisions?.length} pendientes
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[10px] border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
          onClick={() => setShowAvailable(!showAvailable)}
          disabled={(managedArtists?.length || 0) >= 2}
        >
          <PlusCircle className="h-3 w-3 mr-1" />
          Adoptar
        </Button>
      </div>

      {/* Managed Artists */}
      {managedArtists && managedArtists.length > 0 && (
        <div className="space-y-2">
          {managedArtists.map(({ management, artist, pendingDecisions }) => (
            <Card key={management.id} className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-cyan-500/40">
                    <AvatarImage src={getArtistAvatar(artist.id, artist.profileImageUrl)} />
                    <AvatarFallback className="text-xs bg-cyan-600">
                      {(artist.artistName || '?')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{artist.artistName || artist.username}</span>
                      {pendingDecisions > 0 && (
                        <Badge className="bg-red-500/20 text-red-300 text-[9px] animate-pulse">
                          {pendingDecisions} decisiones
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <span>{artist.genre}</span>
                      <span>•</span>
                      <span>{management.totalDecisions} decisiones tomadas</span>
                      {management.totalDecisions > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-green-400">
                            {Math.round((management.successfulDecisions / management.totalDecisions) * 100)}% éxito
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[9px] text-red-400/50 hover:text-red-400"
                    onClick={() => releaseMutation.mutate(artist.id)}
                  >
                    Release
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {(!managedArtists || managedArtists.length === 0) && !isLoading && !showAvailable && (
        <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
          <CardContent className="p-6 text-center">
            <Target className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
            <p className="text-white/70 text-sm">¡Conviértete en manager!</p>
            <p className="text-[11px] text-white/40 mt-1">Adopta un artista IA y toma decisiones que afectan su carrera</p>
            <Button
              size="sm"
              className="mt-3 bg-cyan-600 hover:bg-cyan-700"
              onClick={() => setShowAvailable(true)}
            >
              <Users className="h-3 w-3 mr-1" />
              Ver artistas disponibles
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Available Artists Picker */}
      <AnimatePresence>
        {showAvailable && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-3">
                <h4 className="text-xs font-bold text-white mb-2">Artistas disponibles</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {availableArtists?.filter(a => !a.isManaged).map(artist => (
                    <div key={artist.id} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={getArtistAvatar(artist.id, artist.profileImageUrl)} />
                        <AvatarFallback className="text-[9px] bg-cyan-600">
                          {(artist.artistName || '?')[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <span className="text-xs text-white">{artist.artistName}</span>
                        <span className="text-[9px] text-white/30 ml-1">{artist.genre}</span>
                      </div>
                      <Button
                        size="sm"
                        className="h-6 text-[9px] bg-cyan-600 hover:bg-cyan-700"
                        onClick={() => adoptMutation.mutate(artist.id)}
                        disabled={adoptMutation.isPending}
                      >
                        Adoptar
                      </Button>
                    </div>
                  ))}
                  {(!availableArtists || availableArtists.filter(a => !a.isManaged).length === 0) && (
                    <p className="text-[10px] text-white/30 text-center py-2">No hay artistas disponibles</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Decisions */}
      {decisions && decisions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Brain className="h-3.5 w-3.5 text-yellow-400" />
            <span className="text-xs font-bold text-white">Decisiones pendientes</span>
          </div>

          {decisions.map((decision) => {
            const isExpanded = selectedDecision === decision.id;
            const options = (decision.options || []) as DecisionOption[];

            return (
              <Card 
                key={decision.id} 
                className="bg-gradient-to-r from-yellow-500/5 to-orange-500/5 border-yellow-500/20"
              >
                <CardContent className="p-3">
                  {/* Decision Header */}
                  <div 
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => setSelectedDecision(isExpanded ? null : decision.id)}
                  >
                    <div className="flex-1">
                      <h5 className="text-xs font-bold text-white">{decision.title}</h5>
                      <p className="text-[10px] text-white/50 mt-0.5">{decision.description}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Badge className="bg-white/10 text-white/40 text-[9px]">
                        <Clock className="h-2.5 w-2.5 mr-0.5" />
                        {formatDistanceToNow(new Date(decision.expiresAt), { locale: es, addSuffix: true })}
                      </Badge>
                      <ChevronRight className={cn(
                        "h-3.5 w-3.5 text-white/30 transition-transform",
                        isExpanded && "rotate-90"
                      )} />
                    </div>
                  </div>

                  {/* Expanded Options */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-2"
                      >
                        {/* AI Recommendation */}
                        {decision.aiRecommendation && (
                          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2">
                            <div className="flex items-center gap-1 mb-1">
                              <Brain className="h-3 w-3 text-purple-400" />
                              <span className="text-[9px] text-purple-300 font-medium uppercase tracking-wider">
                                Recomendación IA
                              </span>
                            </div>
                            <p className="text-[10px] text-purple-200/70">{decision.aiRecommendation}</p>
                          </div>
                        )}

                        {/* Options */}
                        <div className="space-y-1.5">
                          {options.map((option) => {
                            const risk = riskColors[option.riskLevel] || riskColors.medium;
                            const isSelected = selectedOption === option.id && selectedDecision === decision.id;

                            return (
                              <button
                                key={option.id}
                                className={cn(
                                  "w-full text-left rounded-lg p-2 transition-all border",
                                  isSelected
                                    ? "bg-cyan-500/15 border-cyan-500/30 ring-1 ring-cyan-400/30"
                                    : "bg-white/5 border-white/10 hover:bg-white/10"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOption(option.id);
                                }}
                              >
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[11px] font-bold text-white">{option.label}</span>
                                  <Badge className={cn("text-[8px] border", risk)}>
                                    {riskIcons[option.riskLevel]} {option.riskLevel}
                                  </Badge>
                                </div>
                                <p className="text-[9px] text-white/40">{option.description}</p>
                                <p className="text-[9px] text-cyan-300/50 mt-0.5 italic">
                                  → {option.predictedOutcome}
                                </p>
                              </button>
                            );
                          })}
                        </div>

                        {/* Confirm Button */}
                        <Button
                          size="sm"
                          className="w-full bg-cyan-600 hover:bg-cyan-700 text-xs"
                          disabled={!selectedOption || decideMutation.isPending}
                          onClick={() => {
                            if (selectedOption) {
                              decideMutation.mutate({ decisionId: decision.id, option: selectedOption });
                            }
                          }}
                        >
                          {decideMutation.isPending ? 'Ejecutando...' : (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Confirmar decisión
                            </>
                          )}
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
