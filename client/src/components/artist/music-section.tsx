import React from 'react';
import { motion } from 'framer-motion';
import { 
  Music2, 
  Pause, 
  Play, 
  PlusCircle,
  Loader2,
  ChartBar,
  Sparkles 
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface Song {
  id: string;
  name: string;
  title?: string;
  duration?: string;
  audioUrl: string;
  userId: string;
  createdAt?: any;
  storageRef?: string;
  coverArt?: string;
}

export interface MusicSectionProps {
  songs: Song[];
  isLoading: boolean;
  currentTrack: number;
  isPlaying: boolean;
  togglePlay: (song: Song, index: number) => void;
  onGenerateSong?: () => void;
}

export const MusicSection: React.FC<MusicSectionProps> = ({
  songs,
  isLoading,
  currentTrack,
  isPlaying,
  togglePlay,
  onGenerateSong
}) => {
  const sectionItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <Card className="p-6 bg-black/40 backdrop-blur-sm border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 overflow-hidden">
      <motion.div variants={sectionItemVariants}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold flex items-center bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500">
            <Music2 className="w-6 h-6 mr-2 text-orange-500" />
            Latest Tracks
          </h3>
          <Button variant="ghost" size="sm" className="text-orange-500 hover:text-orange-400">
            <span>View All</span>
            <ChartBar className="ml-2 h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Music2 className="h-4 w-4 text-orange-300" />
                </div>
              </div>
              <p className="ml-3 text-orange-300">Cargando pistas...</p>
            </div>
          ) : songs && songs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {songs.map((song, index) => (
                <motion.div
                  key={song.id}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center p-4 rounded-lg transition-all duration-300 backdrop-blur-sm ${
                    currentTrack === index
                      ? "bg-gradient-to-r from-orange-500/30 to-pink-500/20 border border-orange-500/50"
                      : "bg-black/30 border border-orange-500/10 hover:border-orange-500/30"
                  }`}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="relative shrink-0">
                      <div className={`w-12 h-12 rounded-md overflow-hidden bg-orange-500/20 ${
                        currentTrack === index && isPlaying ? 'ring-2 ring-orange-500 ring-offset-1 ring-offset-black' : ''
                      }`}>
                        <img 
                          src={song.coverArt || '/assets/freepik__boostify_music_organe_abstract_icon.png'} 
                          alt={song.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/assets/freepik__boostify_music_organe_abstract_icon.png';
                          }}  
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => togglePlay(song, index)}
                        className={`absolute -bottom-2 -right-2 w-7 h-7 rounded-full transition-transform duration-300 ${
                          currentTrack === index && isPlaying
                            ? "bg-orange-500 text-white hover:bg-orange-600 scale-110"
                            : "bg-black/70 text-white hover:bg-orange-500/80"
                        }`}
                      >
                        {currentTrack === index && isPlaying ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="font-medium truncate">{song.name || song.title}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {song.duration || "3:45"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground block truncate">
                        {song.createdAt ? new Date(song.createdAt).toLocaleDateString() : 'No date'} 
                        {currentTrack === index && isPlaying && <span className="ml-2 text-orange-500">• Reproduciendo</span>}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-black/20 rounded-lg p-8 text-center">
              <Music2 className="h-12 w-12 text-orange-500/40 mx-auto mb-3" />
              <p className="text-orange-100/70">No hay pistas disponibles</p>
              <p className="text-sm text-orange-300/50 mt-2">Las canciones que subas aparecerán aquí</p>
              <div className="flex flex-col gap-3 mt-6">
                <Button variant="outline" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10" data-testid="button-upload-music">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Subir música
                </Button>
                <Button variant="outline" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10" data-testid="button-generate-song" onClick={onGenerateSong}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generar Canción
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </Card>
  );
};