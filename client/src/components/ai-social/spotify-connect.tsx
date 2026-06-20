/**
 * Spotify Connect - Integración con Spotify
 * 
 * "Conecta tu Spotify y descubre qué artistas IA encajan con tu gusto"
 * 
 * Shows Spotify connection status, taste analysis, and AI artist suggestions.
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
import { Music, Headphones, Sparkles, Link, Unlink, Zap, RefreshCw } from 'lucide-react';

function getArtistAvatar(artistId: number, profileImageUrl: string | null): string {
  if (profileImageUrl) return profileImageUrl;
  const gender = artistId % 2 === 0 ? 'women' : 'men';
  const index = (artistId * 7 + 13) % 80;
  return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
}

interface SpotifyConnection {
  id: number;
  userId: number;
  spotifyUserId: string | null;
  displayName: string | null;
  topArtists: string[];
  topGenres: string[];
  topTracks: string[];
  aiArtistSuggestions: Array<{
    artistId: number;
    artistName: string;
    matchScore: number;
    reason: string;
    profileImageUrl?: string | null;
  }>;
  lastSyncAt: string;
}

interface SpotifyConnectProps {
  userId?: number;
}

export function SpotifyConnect({ userId }: SpotifyConnectProps) {
  const queryClient = useQueryClient();
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: connection, isLoading } = useQuery<SpotifyConnection | null>({
    queryKey: ['/api/ai-social/spotify/connection', userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await apiRequest('GET', `/api/ai-social/spotify/connection/${userId}`);
      const json = await res.json();
      return json.data || null;
    },
    enabled: !!userId,
    refetchInterval: 120000,
  });

  const connectDemoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/ai-social/spotify/demo', { userId });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-social/spotify/connection'] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/ai-social/spotify/sync', { userId });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-social/spotify/connection'] });
    },
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const res = await apiRequest('GET', `/api/ai-social/spotify/suggestions/${userId}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-social/spotify/connection'] });
      setShowSuggestions(true);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const res = await apiRequest('DELETE', `/api/ai-social/spotify/disconnect/${userId}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-social/spotify/connection'] });
    },
  });

  if (!userId) return null;

  if (isLoading) {
    return <div className="h-32 bg-white/5 rounded-xl animate-pulse" />;
  }

  // Not connected
  if (!connection) {
    return (
      <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-full bg-green-500/20">
              <Music className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Conecta Spotify</h4>
              <p className="text-[11px] text-white/50">Descubre qué artistas IA encajan con tu gusto</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white text-xs flex-1"
              onClick={() => connectDemoMutation.mutate()}
              disabled={connectDemoMutation.isPending}
            >
              <Headphones className="h-3 w-3 mr-1" />
              {connectDemoMutation.isPending ? 'Conectando...' : 'Demo Connect'}
            </Button>
          </div>
          <p className="text-[9px] text-white/30 mt-2 text-center">
            Demo mode: simula una conexión con gustos musicales populares
          </p>
        </CardContent>
      </Card>
    );
  }

  // Connected
  return (
    <Card className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-500/20">
      <CardContent className="p-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-green-500/30">
              <Music className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-white">Spotify Conectado</span>
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              </div>
              <p className="text-[10px] text-white/40">
                {connection.displayName || 'User'}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] text-red-400 hover:text-red-300"
            onClick={() => disconnectMutation.mutate()}
          >
            <Unlink className="h-3 w-3" />
          </Button>
        </div>

        {/* Taste Analysis */}
        {connection.topGenres?.length > 0 && (
          <div className="mb-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Tus géneros</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {connection.topGenres.slice(0, 6).map((genre, i) => (
                <Badge key={i} className="bg-green-500/15 text-green-300 border-green-500/20 text-[10px]">
                  {genre}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {connection.topArtists?.length > 0 && (
          <div className="mb-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Tus artistas</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {connection.topArtists.slice(0, 6).map((artist, i) => (
                <Badge key={i} className="bg-purple-500/15 text-purple-300 border-purple-500/20 text-[10px]">
                  {artist}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] flex-1 border-green-500/30 text-green-300 hover:bg-green-500/10"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", syncMutation.isPending && "animate-spin")} />
            Sync
          </Button>
          <Button
            size="sm"
            className="h-7 text-[10px] flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => suggestMutation.mutate()}
            disabled={suggestMutation.isPending}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {suggestMutation.isPending ? '...' : 'AI Matches'}
          </Button>
        </div>

        {/* AI Artist Suggestions */}
        <AnimatePresence>
          {(showSuggestions || connection.aiArtistSuggestions?.length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center gap-1 mb-2">
                  <Sparkles className="h-3 w-3 text-purple-400" />
                  <span className="text-[10px] text-white/50 uppercase tracking-wider font-medium">
                    Artistas IA para ti
                  </span>
                </div>
                <div className="space-y-2">
                  {(connection.aiArtistSuggestions || []).map((suggestion, i) => (
                    <motion.div
                      key={i}
                      className="flex items-center gap-2 bg-white/5 rounded-lg p-2"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Avatar className="h-8 w-8 ring-1 ring-purple-500/30">
                        <AvatarImage src={getArtistAvatar(suggestion.artistId, suggestion.profileImageUrl || null)} />
                        <AvatarFallback className="text-[10px] bg-purple-600">
                          {(suggestion.artistName || '?')[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-white">{suggestion.artistName}</span>
                          <Badge className="bg-purple-500/20 text-purple-300 text-[9px]">
                            {suggestion.matchScore}% match
                          </Badge>
                        </div>
                        <p className="text-[10px] text-white/40 truncate">{suggestion.reason}</p>
                      </div>
                      <Zap className="h-4 w-4 text-yellow-400 shrink-0" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
