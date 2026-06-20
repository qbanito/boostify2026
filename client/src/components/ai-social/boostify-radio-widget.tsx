/**
 * Boostify Radio Widget - Live Radio in Social Network
 * 
 * "La radio que nunca duerme - 100% música IA"
 * 
 * Shows current playing track, upcoming queue, and allows interaction
 */

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Slider } from '../ui/slider';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { 
  Radio, 
  Play, 
  Pause, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Music,
  Loader2,
  RefreshCw,
  TrendingUp,
  Waves,
  ListMusic
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useToast } from '../../hooks/use-toast';
import { Link } from 'wouter';

interface RadioTrack {
  songId: number;
  title: string;
  artistId: number;
  artistName: string;
  artistImage?: string | null;
  audioUrl: string;
  coverArt?: string | null;
  genre?: string | null;
  duration?: string | null;
  playedAt?: string;
}

interface RadioStatus {
  isPlaying: boolean;
  currentTrack: RadioTrack | null;
  queueLength: number;
  totalPlays: number;
  recentHistory: RadioTrack[];
}

interface BoostifyRadioWidgetProps {
  /** Callback to expose the internal audio element ref for external consumers (e.g. visualizer) */
  onAudioRef?: (ref: React.RefObject<HTMLAudioElement>) => void;
}

export function BoostifyRadioWidget({ onAudioRef }: BoostifyRadioWidgetProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Expose audioRef to parent for visualizer sync
  useEffect(() => {
    if (onAudioRef) {
      onAudioRef(audioRef);
    }
  }, [onAudioRef]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [autoPlayTriggered, setAutoPlayTriggered] = useState(false);
  const [audioError, setAudioError] = useState(false);

  // Get radio status
  const { data: statusData, isLoading } = useQuery({
    queryKey: ['radio-status'],
    queryFn: async () => {
      const response = await apiRequest({
        url: '/api/ai-social/radio/status',
        method: 'GET',
      });
      return response as { success: boolean; data: RadioStatus };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get upcoming queue
  const { data: queueData } = useQuery({
    queryKey: ['radio-queue'],
    queryFn: async () => {
      const response = await apiRequest({
        url: '/api/ai-social/radio/queue?limit=5',
        method: 'GET',
      });
      return response as { success: boolean; data: RadioTrack[] };
    },
    refetchInterval: 60000,
  });

  // Skip track mutation
  const skipMutation = useMutation({
    mutationFn: async () => {
      return apiRequest({
        url: '/api/ai-social/radio/skip',
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radio-status'] });
      queryClient.invalidateQueries({ queryKey: ['radio-queue'] });
      toast({
        title: '⏭️ Siguiente canción',
        description: 'Cargando siguiente track...',
      });
    },
  });

  // Trigger radio tick (loads next song if empty)
  const tickMutation = useMutation({
    mutationFn: async () => {
      return apiRequest({
        url: '/api/ai-social/radio/tick',
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radio-status'] });
      queryClient.invalidateQueries({ queryKey: ['radio-queue'] });
      queryClient.invalidateQueries({ queryKey: ['ai-social-feed'] });
      toast({
        title: '📻 Radio actualizada',
        description: 'Nueva canción en el aire!',
      });
    },
  });

  const status = statusData?.data;
  const queue = queueData?.data || [];
  const currentTrack = status?.currentTrack;

  // Auto-play on mount: trigger radio tick if no track is playing
  useEffect(() => {
    if (!autoPlayTriggered && !isLoading && !currentTrack && !tickMutation.isPending) {
      setAutoPlayTriggered(true);
      console.log('[BoostifyRadio] Auto-triggering radio on page load...');
      tickMutation.mutate();
    }
  }, [isLoading, currentTrack, autoPlayTriggered]);

  // Auto-play audio when track becomes available
  useEffect(() => {
    if (currentTrack?.audioUrl && audioRef.current && !isPlaying && autoPlayTriggered) {
      setAudioError(false);
      // Small delay to ensure audio element is ready
      const timer = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.volume = volume / 100;
          audioRef.current.play()
            .then(() => setIsPlaying(true))
            .catch((err) => {
              console.log('[BoostifyRadio] Auto-play blocked by browser, waiting for interaction');
              // Browser blocked auto-play, user needs to click
            });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentTrack?.audioUrl]);

  // Handle audio errors - skip to next track if current one fails
  const handleAudioError = () => {
    console.log('[BoostifyRadio] Audio error, skipping to next available track...');
    setAudioError(true);
    setIsPlaying(false);
    // Auto-skip to next track after error
    setTimeout(() => {
      skipMutation.mutate();
    }, 1000);
  };

  // Handle play/pause
  const togglePlay = () => {
    if (audioRef.current && currentTrack?.audioUrl) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {
          toast({
            title: 'Error',
            description: 'No se pudo reproducir el audio',
            variant: 'destructive',
          });
        });
      }
      setIsPlaying(!isPlaying);
    } else if (!currentTrack) {
      // Trigger a tick to load a track
      tickMutation.mutate();
    }
  };

  // Handle volume
  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0];
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol / 100;
    }
    if (vol === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume / 100;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  // Update volume when mounted
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, []);

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border-orange-500/30">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-orange-950/20 to-slate-900 border-orange-500/30 overflow-hidden relative">
      {/* Animated background waves */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-20 -right-20 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        {isPlaying && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500"
            animate={{
              scaleX: [0, 1, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        )}
      </div>

      <CardHeader className="pb-2 relative">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-orange-400" />
            <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent font-bold">
              Boostify Radio
            </span>
            {isPlaying && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                <Waves className="h-3 w-3 mr-1 animate-pulse" />
                LIVE
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <TrendingUp className="h-3 w-3" />
            {status?.totalPlays || 0} plays
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 relative">
        {/* Now Playing */}
        <div className="flex items-center gap-4">
          {/* Album Art */}
          <div className="relative flex-shrink-0">
            <motion.div
              className={cn(
                "w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center",
                isPlaying && "shadow-lg shadow-orange-500/30"
              )}
              animate={isPlaying ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {currentTrack?.coverArt ? (
                <img 
                  src={currentTrack.coverArt} 
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music className="h-8 w-8 text-white/80" />
              )}
            </motion.div>
            {isPlaying && (
              <motion.div
                className="absolute -bottom-1 -right-1 bg-orange-500 rounded-full p-1"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <Waves className="h-3 w-3 text-white" />
              </motion.div>
            )}
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            {currentTrack ? (
              <>
                <motion.p 
                  className="font-semibold text-white truncate"
                  key={currentTrack.songId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {currentTrack.title}
                </motion.p>
                <Link href={`/artist/${currentTrack.artistId}`}>
                  <motion.p 
                    className="text-sm text-orange-400 hover:text-orange-300 truncate cursor-pointer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {currentTrack.artistName}
                  </motion.p>
                </Link>
                {currentTrack.genre && (
                  <Badge variant="outline" className="mt-1 text-xs border-white/20 text-gray-400">
                    {currentTrack.genre}
                  </Badge>
                )}
              </>
            ) : (
              <div>
                <p className="text-gray-400">No hay música en cola</p>
                <p className="text-xs text-gray-500">Haz clic en play para cargar</p>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              disabled={tickMutation.isPending}
              className={cn(
                "h-10 w-10 rounded-full",
                isPlaying 
                  ? "bg-orange-500 hover:bg-orange-600 text-white" 
                  : "bg-white/10 hover:bg-white/20 text-white"
              )}
            >
              {tickMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            {/* Skip */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skipMutation.mutate()}
              disabled={skipMutation.isPending || !currentTrack}
              className="h-8 w-8 text-gray-400 hover:text-white"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 flex-1 max-w-[150px]">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="h-8 w-8 text-gray-400 hover:text-white"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
            />
          </div>

          {/* Queue Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowQueue(!showQueue)}
            className={cn(
              "h-8 w-8",
              showQueue ? "text-orange-400" : "text-gray-400 hover:text-white"
            )}
          >
            <ListMusic className="h-4 w-4" />
          </Button>
        </div>

        {/* Queue Preview */}
        <AnimatePresence>
          {showQueue && queue.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 border-t border-white/10 space-y-2">
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <ListMusic className="h-3 w-3" />
                  Próximas canciones
                </p>
                {queue.slice(0, 3).map((track, index) => (
                  <div 
                    key={track.songId} 
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="text-gray-500 w-4">{index + 1}</span>
                    <Avatar className="h-6 w-6">
                      {track.coverArt ? (
                        <AvatarImage src={track.coverArt} />
                      ) : (
                        <AvatarFallback className="bg-orange-500/20 text-orange-400 text-xs">
                          {track.title.charAt(0)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 truncate text-xs">{track.title}</p>
                      <p className="text-gray-500 truncate text-xs">{track.artistName}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden Audio Element */}
        {currentTrack?.audioUrl && (
          <audio
            ref={audioRef}
            src={currentTrack.audioUrl}
            onEnded={() => {
              setIsPlaying(false);
              skipMutation.mutate();
            }}
            onError={handleAudioError}
          />
        )}
      </CardContent>
    </Card>
  );
}
