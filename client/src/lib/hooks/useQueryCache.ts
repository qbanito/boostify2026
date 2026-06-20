/**
 * Custom hook para manejo avanzado de caché con React Query
 * Optimiza el rendimiento y reduce llamadas redundantes a la API
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export function useQueryCache() {
  const queryClient = useQueryClient();
  
  /**
   * Invalida múltiples query keys de forma eficiente
   */
  const invalidateQueries = useCallback((keys: string[][]) => {
    return Promise.all(
      keys.map(key => queryClient.invalidateQueries({ queryKey: key }))
    );
  }, [queryClient]);
  
  /**
   * Prefetch de datos para mejorar UX
   */
  const prefetchQuery = useCallback(async (key: string[], fetcher: () => Promise<any>) => {
    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: fetcher,
      staleTime: 1000 * 60 * 5, // 5 minutos
    });
  }, [queryClient]);
  
  /**
   * Actualiza caché optimísticamente
   */
  const setQueryData = useCallback(<T,>(key: string[], updater: T | ((old: T | undefined) => T)) => {
    queryClient.setQueryData(key, updater);
  }, [queryClient]);
  
  /**
   * Obtiene datos del caché sin hacer fetch
   */
  const getQueryData = useCallback(<T,>(key: string[]): T | undefined => {
    return queryClient.getQueryData<T>(key);
  }, [queryClient]);
  
  /**
   * Limpia caché completo (usar con cuidado)
   */
  const clearCache = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);
  
  /**
   * Revalida datos específicos
   */
  const refetchQueries = useCallback((keys: string[][]) => {
    return Promise.all(
      keys.map(key => queryClient.refetchQueries({ queryKey: key }))
    );
  }, [queryClient]);
  
  return {
    invalidateQueries,
    prefetchQuery,
    setQueryData,
    getQueryData,
    clearCache,
    refetchQueries,
  };
}

/**
 * Query keys organizados para mejor manejo de caché
 */
export const QUERY_KEYS = {
  projects: (userId?: string) => ['projects', userId].filter(Boolean),
  project: (projectId: string) => ['project', projectId],
  performanceSegments: (projectId: string) => ['performance-segments', projectId],
  performanceSegment: (segmentId: string) => ['performance-segment', segmentId],
  scenes: (projectId: string) => ['scenes', projectId],
  timeline: (projectId: string) => ['timeline', projectId],
  artists: () => ['artists'],
  artist: (artistId: string) => ['artist', artistId],
  transcription: (audioUrl: string) => ['transcription', audioUrl],
  videoGeneration: (sceneId: string) => ['video-generation', sceneId],
} as const;
