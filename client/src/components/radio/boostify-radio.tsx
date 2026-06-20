import { useState, useEffect, useRef } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { Volume2, Mic, Play, Pause, Radio, X, SkipForward, RefreshCw, Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { StreamingService, StreamingTrack } from "../../lib/streaming/streaming-service";
import { SpotifyStreamingService } from "../../lib/streaming/spotify-service";
import { useToast } from "../../hooks/use-toast";

type MusicSource = 'spotify' | 'boostify';

interface BoostifyRadioProps {
  className?: string;
  onClose?: () => void;
}

interface Song {
  id: string;
  name: string;
  audioUrl: string;
  userId: string;
  createdAt: Date;
}

export function BoostifyRadio({ className, onClose }: BoostifyRadioProps) {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([50]);
  const [isRecording, setIsRecording] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [streamingServices, setStreamingServices] = useState<StreamingService[]>([]);
  const [currentStreamingTrack, setCurrentStreamingTrack] = useState<StreamingTrack | null>(null);
  const [isInitializingServices, setIsInitializingServices] = useState(false);
  const [selectedSource, setSelectedSource] = useState<MusicSource>('boostify');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StreamingTrack[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    loadSongs();
    initializeStreamingServices();
  }, []);

  const initializeStreamingServices = async () => {
    setIsInitializingServices(true);
    try {
      const spotifyService = new SpotifyStreamingService();
      const connected = await spotifyService.connect();

      if (connected) {
        toast({
          title: "Spotify conectado",
          description: "Servicio de streaming inicializado correctamente"
        });
        setStreamingServices([spotifyService]);
      }
    } catch (error) {
      console.error('Error initializing streaming services:', error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con los servicios de streaming",
        variant: "destructive"
      });
    } finally {
      setIsInitializingServices(false);
    }
  };

  const loadSongs = async () => {
    try {
      const songsQuery = query(
        collection(db, "songs"),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      const querySnapshot = await getDocs(songsQuery);
      const songs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      })) as Song[];

      setPlaylist(songs);
      if (songs.length > 0 && !currentSong) {
        setCurrentSong(songs[0]);
      }
    } catch (error) {
      console.error("Error loading songs:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las canciones",
        variant: "destructive"
      });
    }
  };

  const togglePlay = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          try {
            await playPromise;
          } catch (error) {
            console.error('Error playing audio:', error);
            if (selectedSource === 'spotify' && currentStreamingTrack) {
              toast({
                title: "Preview no disponible",
                description: "Esta canción no tiene una previsualización disponible. Por favor, intenta con otra canción.",
                variant: "destructive"
              });
              skipToNextSong();
            } else {
              toast({
                title: "Error",
                description: "Error al reproducir la música",
                variant: "destructive"
              });
            }
            return;
          }
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume[0] / 100;
    }
  };

  const skipToNextSong = () => {
    if (selectedSource === 'spotify' && searchResults.length > 0) {
      const currentIndex = searchResults.findIndex(track => track.id === currentStreamingTrack?.id);
      let nextIndex = (currentIndex + 1) % searchResults.length;
      let nextTrack = searchResults[nextIndex];

      // Buscar la siguiente canción con preview disponible
      while (!nextTrack.streamUrl && nextIndex !== currentIndex) {
        nextIndex = (nextIndex + 1) % searchResults.length;
        nextTrack = searchResults[nextIndex];
      }

      setCurrentStreamingTrack(nextTrack);
      if (isPlaying && audioRef.current && nextTrack.streamUrl) {
        audioRef.current.play().catch(() => {
          toast({
            title: "Error",
            description: "No se pudo reproducir la siguiente canción",
            variant: "destructive"
          });
        });
      }
    } else if (selectedSource === 'boostify') {
      if (!currentSong || playlist.length === 0) return;
      const currentIndex = playlist.findIndex(song => song.id === currentSong.id);
      const nextIndex = (currentIndex + 1) % playlist.length;
      setCurrentSong(playlist[nextIndex]);
      if (isPlaying && audioRef.current) {
        audioRef.current.play();
      }
    }
  };

  const handleSourceChange = (source: MusicSource) => {
    setSelectedSource(source);
    setIsPlaying(false);
    setCurrentStreamingTrack(null);
    setSearchResults([]);
    setSearchQuery('');

    if (source === 'boostify') {
      loadSongs();
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || selectedSource !== 'spotify') return;

    const spotifyService = streamingServices.find(s => s.name === 'Spotify');
    if (!spotifyService) return;

    try {
      const results = await spotifyService.search(searchQuery);
      setSearchResults(results);

      if (results.length > 0) {
        setCurrentStreamingTrack(results[0]);
        if (!results.some(track => track.streamUrl)) {
          toast({
            title: "Previsualizaciones no disponibles",
            description: "Las previsualizaciones de Spotify no están disponibles en este momento. Puedes ver la información de las canciones pero no reproducirlas.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Sin resultados",
          description: "No se encontraron canciones que coincidan con tu búsqueda.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error searching tracks:', error);
      toast({
        title: "Error",
        description: "Error al buscar canciones",
        variant: "destructive"
      });
    }
  };

  const toggleMicrophone = async () => {
    try {
      if (!isRecording) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.start();
        setIsRecording(true);

        mediaRecorderRef.current.ondataavailable = (event) => {
          console.log("Audio data available", event.data);
        };

        toast({
          title: "Micrófono activado",
          description: "Grabación en curso"
        });
      } else {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        toast({
          title: "Micrófono desactivado",
          description: "Grabación finalizada"
        });
      }
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Error",
        description: "No se pudo acceder al micrófono",
        variant: "destructive"
      });
    }
  };

  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: window.innerWidth - 300, top: 0, bottom: window.innerHeight - 200 }}
      onDragEnd={(_, info) => {
        setPosition({
          x: position.x + info.offset.x,
          y: position.y + info.offset.y
        });
      }}
      className={cn(
        "fixed bottom-4 right-4 z-50 w-[300px]",
        className
      )}
      animate={{ x: position.x, y: position.y }}
    >
      <Card className="bg-black/80 backdrop-blur-lg border-none text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-orange-500" />
            <span className="font-semibold">Boostify Radio</span>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white/60 hover:text-white"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <Button
            variant={selectedSource === 'boostify' ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              "text-sm",
              selectedSource === 'boostify' && "bg-orange-500 hover:bg-orange-600"
            )}
            onClick={() => handleSourceChange('boostify')}
          >
            Boostify
          </Button>
          <Button
            variant={selectedSource === 'spotify' ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              "text-sm",
              selectedSource === 'spotify' && "bg-green-500 hover:bg-green-600"
            )}
            onClick={() => handleSourceChange('spotify')}
            disabled={isInitializingServices}
          >
            Spotify
          </Button>
        </div>

        {selectedSource === 'spotify' && (
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Buscar en Spotify..."
                className="flex-1 px-3 py-1 rounded bg-white/10 text-white placeholder-white/50 border-none focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSearch}
                className="text-white/60 hover:text-white"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {searchResults.length > 0 && !searchResults.some(track => track.streamUrl) && (
              <p className="text-xs text-orange-500">
                Las previsualizaciones no están disponibles. Puedes ver la información de las canciones pero no reproducirlas.
              </p>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "text-white/60 hover:text-white",
                isPlaying && "text-orange-500"
              )}
              onClick={togglePlay}
              disabled={(!currentSong && !currentStreamingTrack) || isInitializingServices}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6" />
              )}
            </Button>

            <div className="flex items-center gap-2 flex-1">
              <Volume2 className="h-4 w-4 text-white/60" />
              <Slider
                value={volume}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="flex-1"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "text-white/60 hover:text-white",
                isRecording && "text-red-500 animate-pulse"
              )}
              onClick={toggleMicrophone}
            >
              <Mic className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-white/60 hover:text-white"
              onClick={skipToNextSong}
              disabled={(!currentSong && !currentStreamingTrack) || isInitializingServices}
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          <div className="text-sm text-white/60">
            {isInitializingServices ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Conectando servicios de streaming...</span>
              </div>
            ) : currentStreamingTrack ? (
              <div className="space-y-1">
                <p className="truncate font-medium">{currentStreamingTrack.title}</p>
                <p className="truncate text-xs">{currentStreamingTrack.artist}</p>
                {!currentStreamingTrack.streamUrl && (
                  <p className="text-xs text-orange-500">Preview no disponible</p>
                )}
                <a 
                  href={currentStreamingTrack.externalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-green-500 hover:underline"
                >
                  Abrir en Spotify
                </a>
              </div>
            ) : currentSong ? (
              <p className="truncate">{currentSong.name}</p>
            ) : (
              "No hay canciones disponibles"
            )}
          </div>
        </div>

        <audio
          ref={audioRef}
          src={selectedSource === 'spotify' ? currentStreamingTrack?.streamUrl : currentSong?.audioUrl}
          onEnded={skipToNextSong}
          onError={() => {
            console.error("Error loading audio");
            skipToNextSong();
            toast({
              title: "Error",
              description: "Error al cargar el audio",
              variant: "destructive"
            });
          }}
        />
      </Card>
    </motion.div>
  );
}