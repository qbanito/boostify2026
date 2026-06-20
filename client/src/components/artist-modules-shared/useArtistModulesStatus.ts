/**
 * useArtistModulesStatus — React Query hook that polls the unified
 * status endpoint for all 6 artist modules.
 */
import { useQuery } from '@tanstack/react-query';
import type { ModuleId } from './tokens';

export interface ModuleStatus {
  healthy: boolean;
  counts: Record<string, number>;
  lastActivity: string | null;
  error?: string;
}

export interface ArtistModulesStatusResponse {
  success: boolean;
  artistId: number;
  modules: Record<ModuleId, ModuleStatus>;
  summary: { totalModules: number; healthy: number; unhealthy: number };
}

export function useArtistModulesStatus(artistId: number | null, opts?: { pollMs?: number }) {
  return useQuery<ArtistModulesStatusResponse>({
    queryKey: ['artist-modules-status', artistId],
    enabled: Boolean(artistId && artistId > 0),
    refetchInterval: opts?.pollMs ?? 60_000,
    queryFn: async () => {
      const resp = await fetch(`/api/artist-modules/status/${artistId}`, { credentials: 'include' });
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      return resp.json();
    },
  });
}
