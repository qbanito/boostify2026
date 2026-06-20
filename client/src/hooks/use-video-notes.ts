import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiRequest } from '../lib/queryClient';

// ---- Types -------------------------------------------------------------
export interface VideoNote {
  id: number;
  videoId: string;
  userId: number | null;
  guestName?: string | null;
  ownerUserId: number | null;
  timecodeMs: number;
  endTimecodeMs: number | null;
  text: string;
  color: string | null;
  isPrivate: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: number; name: string | null; avatar: string | null } | null;
  isGuest?: boolean;
  isOwnerNote: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface CreateNoteInput {
  timecodeMs: number;
  endTimecodeMs?: number | null;
  text: string;
  color?: string | null;
  isPrivate?: boolean;
  ownerUserId?: number;
  guestName?: string | null;
}

export interface UpdateNoteInput {
  timecodeMs?: number;
  endTimecodeMs?: number | null;
  text?: string;
  color?: string | null;
  isPrivate?: boolean;
  isPinned?: boolean;
}

// ---- Hook --------------------------------------------------------------
/**
 * Fetch & manage time-coded notes for a video.
 * `videoId` is the string id of the video (either Firestore doc id or
 * Postgres artistMedia id as string). Pass `null` to disable.
 */
export function useVideoNotes(videoId: string | null | undefined, currentTimeMs: number = 0) {
  const queryClient = useQueryClient();
  const key = ['video-notes', videoId];

  const query = useQuery<{ notes: VideoNote[] }>({
    queryKey: key,
    queryFn: async () => {
      if (!videoId) return { notes: [] };
      return await apiRequest(`/api/videos/${encodeURIComponent(videoId)}/notes`, {
        method: 'GET',
      });
    },
    enabled: !!videoId,
    staleTime: 15_000,
  });

  const notes = query.data?.notes ?? [];

  // Nota "activa": la más reciente cuyo timecode ≤ currentTime
  const activeNote = useMemo(() => {
    if (!notes.length) return null;
    let found: VideoNote | null = null;
    for (const n of notes) {
      if (n.timecodeMs <= currentTimeMs) found = n;
      else break;
    }
    return found;
  }, [notes, currentTimeMs]);

  const createMutation = useMutation({
    mutationFn: async (input: CreateNoteInput) => {
      if (!videoId) throw new Error('videoId required');
      return await apiRequest(`/api/videos/${encodeURIComponent(videoId)}/notes`, {
        method: 'POST',
        data: input,
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<{ notes: VideoNote[] }>(key);
      // Optimistic insert
      const optimistic: VideoNote = {
        id: -Date.now(),
        videoId: String(videoId),
        userId: -1,
        ownerUserId: input.ownerUserId ?? null,
        timecodeMs: input.timecodeMs,
        endTimecodeMs: input.endTimecodeMs ?? null,
        text: input.text,
        color: input.color ?? null,
        isPrivate: input.isPrivate ?? false,
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: { id: -1, name: 'You', avatar: null },
        isOwnerNote: false,
        canEdit: true,
        canDelete: true,
      };
      const next = {
        notes: [...(prev?.notes ?? []), optimistic].sort(
          (a, b) => a.timecodeMs - b.timecodeMs,
        ),
      };
      queryClient.setQueryData(key, next);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateNoteInput }) => {
      return await apiRequest(`/api/video-notes/${id}`, {
        method: 'PATCH',
        data: input,
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/video-notes/${id}`, { method: 'DELETE' });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<{ notes: VideoNote[] }>(key);
      if (prev) {
        queryClient.setQueryData(key, {
          notes: prev.notes.filter((n) => n.id !== id),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    notes,
    activeNote,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    createNote: createMutation.mutate,
    createNoteAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateNote: (id: number, input: UpdateNoteInput) => updateMutation.mutate({ id, input }),
    deleteNote: deleteMutation.mutate,
    refetch: query.refetch,
  };
}

// ---- Time helpers ------------------------------------------------------
export function formatTimecode(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function parseTimecode(str: string): number | null {
  // Accepts m:ss, mm:ss, h:mm:ss
  const parts = str.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p) || p < 0)) return null;
  let ms = 0;
  if (parts.length === 1) ms = parts[0] * 1000;
  else if (parts.length === 2) ms = (parts[0] * 60 + parts[1]) * 1000;
  else if (parts.length === 3) ms = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  else return null;
  return ms;
}
