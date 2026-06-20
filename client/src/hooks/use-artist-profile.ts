/**
 * Hook para obtener y sincronizar datos del perfil del artista
 * Usado en páginas de promoción (youtube-views, spotify, instagram-boost)
 * Usa Zustand para estado global compartido
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { useMemo, useEffect } from "react";
import { create } from "zustand";

// Estructura del artista para promociones
export interface ArtistProfile {
  id: number;
  artistName: string | null;
  youtubeChannel: string | null;
  topYoutubeVideos: Array<{
    title: string;
    url: string;
    thumbnailUrl: string;
    type: string;
  }> | null;
  spotifyUrl: string | null;
  genres: string[] | null;
  genre: string | null;
  instagramHandle: string | null;
  twitterHandle: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  biography: string | null;
  profileImage: string | null;
  coverImage: string | null;
  location: string | null;
  country: string | null;
  isAIGenerated: boolean;
}

interface MyArtistsResponse {
  success: boolean;
  artists: ArtistProfile[];
  currentArtist: ArtistProfile | null;
}

// Store global con Zustand para el artista seleccionado
interface ArtistProfileStore {
  selectedArtistId: number | null;
  setSelectedArtistId: (id: number | null) => void;
}

const useArtistProfileStore = create<ArtistProfileStore>((set) => ({
  selectedArtistId: null,
  setSelectedArtistId: (id) => set({ selectedArtistId: id }),
}));

export function useArtistProfile() {
  const { user, isAuthenticated } = useAuth();
  const { selectedArtistId, setSelectedArtistId } = useArtistProfileStore();

  // Obtener artistas del usuario (perfil propio + artistas generados)
  const { data, isLoading, error, refetch } = useQuery<MyArtistsResponse>({
    queryKey: ["/api/artist/my-artists"],
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Artista actual (el usuario logueado)
  const currentArtist = useMemo(() => {
    return data?.currentArtist || null;
  }, [data]);

  // Lista de "My Artists" (artistas generados por AI)
  const myArtists = useMemo(() => {
    return data?.artists || [];
  }, [data]);

  // Todos los artistas disponibles (yo + mis artistas)
  const allArtists = useMemo(() => {
    const artists: ArtistProfile[] = [];
    if (currentArtist) {
      artists.push(currentArtist);
    }
    artists.push(...myArtists);
    return artists;
  }, [currentArtist, myArtists]);

  // Artista seleccionado actualmente
  const selectedArtist = useMemo(() => {
    if (selectedArtistId === null) {
      return currentArtist;
    }
    return allArtists.find(a => a.id === selectedArtistId) || currentArtist;
  }, [selectedArtistId, allArtists, currentArtist]);

  // Función para seleccionar un artista (actualiza el store global)
  const selectArtist = (artistId: number | null) => {
    setSelectedArtistId(artistId);
  };

  // Helpers para obtener datos específicos
  const getYouTubeData = () => {
    if (!selectedArtist) return null;
    return {
      channelUrl: selectedArtist.youtubeChannel,
      videos: selectedArtist.topYoutubeVideos || [],
      artistName: selectedArtist.artistName,
      genres: selectedArtist.genres || (selectedArtist.genre ? [selectedArtist.genre] : []),
    };
  };

  const getSpotifyData = () => {
    if (!selectedArtist) return null;
    return {
      spotifyUrl: selectedArtist.spotifyUrl,
      artistName: selectedArtist.artistName,
      genres: selectedArtist.genres || (selectedArtist.genre ? [selectedArtist.genre] : []),
      biography: selectedArtist.biography,
    };
  };

  const getInstagramData = () => {
    if (!selectedArtist) return null;
    return {
      instagramHandle: selectedArtist.instagramHandle,
      artistName: selectedArtist.artistName,
      genres: selectedArtist.genres || (selectedArtist.genre ? [selectedArtist.genre] : []),
      biography: selectedArtist.biography,
      location: selectedArtist.location || selectedArtist.country,
    };
  };

  return {
    // Estado
    isLoading,
    error,
    isAuthenticated,
    
    // Artistas
    currentArtist,
    myArtists,
    allArtists,
    selectedArtist,
    
    // Acciones
    selectArtist,
    refetch,
    
    // Helpers para datos específicos
    getYouTubeData,
    getSpotifyData,
    getInstagramData,
  };
}
