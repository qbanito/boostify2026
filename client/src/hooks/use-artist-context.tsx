// Hook para obtener el contexto del artista seleccionado para los agentes AI
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { logger } from '../lib/logger';

export interface ArtistContext {
  id: number;
  firestoreId?: string;
  artistName: string;
  genre?: string;
  genres?: string[];
  biography?: string;
  profileImage?: string;
  coverImage?: string;
  style?: string;
  songs?: ArtistSong[];
  images?: string[];
}

export interface ArtistSong {
  id: number;
  title: string;
  audioUrl?: string;
  coverArt?: string;
  genre?: string;
  mood?: string;
  lyrics?: string;
}

interface UseArtistContextReturn {
  artists: ArtistContext[];
  selectedArtist: ArtistContext | null;
  setSelectedArtistId: (id: number | null) => void;
  isLoading: boolean;
  error: string | null;
  refreshArtists: () => Promise<void>;
}

export function useArtistContext(): UseArtistContextReturn {
  const { user } = useAuth();
  const [artists, setArtists] = useState<ArtistContext[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArtists = useCallback(async () => {
    if (!user) {
      setArtists([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch artists from the API
      const response = await fetch('/api/artist-generator/my-artists', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch artists');
      }

      const data = await response.json();
      
      // The API returns { success, count, artists } - extract the artists array
      const artistsArray = Array.isArray(data) ? data : (data.artists || []);
      
      // Transform the data to ArtistContext format
      const transformedArtists: ArtistContext[] = artistsArray.map((artist: any) => ({
        id: artist.id,
        firestoreId: artist.firestoreId,
        artistName: artist.artistName || artist.name || 'Unknown Artist',
        genre: artist.genre,
        genres: artist.genres || [],
        biography: artist.biography,
        profileImage: artist.profileImage,
        coverImage: artist.coverImage,
        style: artist.style,
        songs: artist.songs?.map((song: any) => ({
          id: song.id,
          title: song.title,
          audioUrl: song.audioUrl,
          coverArt: song.coverArt,
          genre: song.genre,
          mood: song.mood,
          lyrics: song.lyrics,
        })) || [],
        images: artist.images || [],
      }));

      setArtists(transformedArtists);
      logger.info(`Loaded ${transformedArtists.length} artists for agent context`);

      // Auto-select the first artist if none selected
      if (transformedArtists.length > 0 && !selectedArtistId) {
        setSelectedArtistId(transformedArtists[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error loading artists';
      setError(message);
      logger.error('Error fetching artists for context:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedArtistId]);

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  const selectedArtist = artists.find(a => a.id === selectedArtistId) || null;

  return {
    artists,
    selectedArtist,
    setSelectedArtistId,
    isLoading,
    error,
    refreshArtists: fetchArtists,
  };
}

// Context provider for sharing artist context across components
import { createContext, useContext, ReactNode } from 'react';

const ArtistAgentContext = createContext<UseArtistContextReturn | null>(null);

export function ArtistAgentProvider({ children }: { children: ReactNode }) {
  const artistContext = useArtistContext();
  
  return (
    <ArtistAgentContext.Provider value={artistContext}>
      {children}
    </ArtistAgentContext.Provider>
  );
}

export function useArtistAgentContext(): UseArtistContextReturn {
  const context = useContext(ArtistAgentContext);
  if (!context) {
    throw new Error('useArtistAgentContext must be used within an ArtistAgentProvider');
  }
  return context;
}
