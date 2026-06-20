import React from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  PlusCircle,
  Loader2,
  ChartBar,
  Video as VideoIcon
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface Video {
  id: string;
  title: string;
  thumbnailUrl?: string;
  url: string;
  userId: string;
  createdAt?: any;
  views?: number;
  likes?: number;
}

export interface VideosSectionProps {
  videos: Video[];
  isLoading: boolean;
}

// Utilidad para extraer el ID de un video de YouTube desde la URL
const getYoutubeVideoId = (url: string): string => {
  if (!url) return '';
  
  // Patrón para URLs de formato: https://www.youtube.com/watch?v=VIDEO_ID
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  
  return (match && match[7].length === 11) ? match[7] : '';
};

export const VideosSection: React.FC<VideosSectionProps> = ({ 
  videos,
  isLoading
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
            <VideoIcon className="w-6 h-6 mr-2 text-orange-500" />
            Latest Videos
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
                  <VideoIcon className="h-4 w-4 text-orange-300" />
                </div>
              </div>
              <p className="ml-3 text-orange-300">Cargando videos...</p>
            </div>
          ) : videos && videos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => {
                const videoId = video.url ? getYoutubeVideoId(video.url) : '';
                return (
                  <motion.div
                    key={video.id}
                    className="rounded-xl overflow-hidden bg-gradient-to-br from-black/50 to-black/30 border border-orange-500/10 hover:border-orange-500/30 transition-all duration-300 group"
                    whileHover={{ 
                      scale: 1.03,
                      boxShadow: "0 10px 30px -15px rgba(249, 115, 22, 0.4)"
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="aspect-video relative">
                      <iframe
                        className="w-full h-full rounded-t-lg"
                        src={`https://www.youtube.com/embed/${videoId}?rel=0&cc_load_policy=0`}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                      
                      {/* Overlay de gradiente en hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    
                    <div className="p-4">
                      <h4 className="font-medium mb-1 line-clamp-1">{video.title}</h4>
                      <div className="flex justify-between items-center text-xs text-white/60">
                        <span>{video.createdAt ? new Date(video.createdAt).toLocaleDateString() : 'No date'}</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center">
                            <Play className="h-3 w-3 mr-1" /> 
                            {video.views?.toLocaleString() || '0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="bg-black/20 rounded-lg p-8 text-center">
              <VideoIcon className="h-12 w-12 text-orange-500/40 mx-auto mb-3" />
              <p className="text-orange-100/70">No hay videos disponibles</p>
              <p className="text-sm text-orange-300/50 mt-2">Los videos que subas aparecerán aquí</p>
              <Button variant="outline" className="mt-4 border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
                <PlusCircle className="h-4 w-4 mr-2" />
                Subir video
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </Card>
  );
};