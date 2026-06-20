import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

export type CommandStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ModuleResult {
  type: 'text' | 'image' | 'json';
  title: string;
  content?: string;
  imageUrl?: string;
  data?: any;
  provider?: string;
}

export interface CommandTask {
  id: string;
  commandId: string;
  artistId: string;
  moduleKey: string;
  label: string;
  icon: string;
  order: number;
  status: TaskStatus;
  output: ModuleResult | null;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface CommandDoc {
  id: string;
  artistId: string;
  artistName: string;
  rawCommand: string;
  source: 'text' | 'voice';
  intent: string;
  params: any;
  confidence: number;
  modulePlan: string[];
  results: Record<string, ModuleResult>;
  status: CommandStatus;
  progress: number;
  currentModule?: string;
  createdAt: number;
  updatedAt: number;
}

interface SubmitArgs {
  command: string;
  source?: 'text' | 'voice';
}

interface UseArtistCommandArgs {
  artistId: string;
  artistName: string;
  artistImageUrl?: string | null;
  genre?: string;
}

const isTerminal = (s?: string) => s === 'completed' || s === 'failed';

/**
 * Drives one Artist Command lifecycle: submit → poll → terminal.
 * Polling stops automatically once the command completes or fails.
 */
export function useArtistCommand({ artistId, artistName, artistImageUrl, genre }: UseArtistCommandArgs) {
  const queryClient = useQueryClient();
  const [commandId, setCommandId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lastCommandText = useRef<string>('');

  const submit = useMutation({
    mutationFn: async ({ command, source = 'text' }: SubmitArgs) => {
      lastCommandText.current = command;
      const res = await apiRequest({
        url: '/api/artist-command',
        method: 'POST',
        data: { command, source, artistId, artistName, artistImageUrl, genre },
      });
      return res as { success: boolean; commandId: string; intent: string; modulePlan: any[] };
    },
    onSuccess: (res) => {
      setSubmitError(null);
      if (res?.commandId) setCommandId(res.commandId);
    },
    onError: (err: any) => {
      setSubmitError(err?.message || 'No se pudo iniciar el comando');
    },
  });

  const statusQuery = useQuery({
    queryKey: ['artist-command', commandId],
    enabled: !!commandId,
    refetchInterval: (query) => {
      const data = query.state.data as { command?: CommandDoc } | undefined;
      if (data?.command && isTerminal(data.command.status)) return false;
      return 2500;
    },
    queryFn: async () => {
      const res = await apiRequest({ url: `/api/artist-command/${commandId}`, method: 'GET' });
      return res as { success: boolean; command: CommandDoc; tasks: CommandTask[] };
    },
  });

  const reset = useCallback(() => {
    setCommandId(null);
    setSubmitError(null);
    submit.reset();
    if (artistId) {
      queryClient.invalidateQueries({ queryKey: ['artist-command-history', artistId] });
    }
  }, [artistId, queryClient, submit]);

  const command = statusQuery.data?.command || null;
  const tasks = statusQuery.data?.tasks || [];
  const status: CommandStatus = command?.status
    || (submit.isPending ? 'pending' : commandId ? 'running' : 'idle');

  return {
    submit: (args: SubmitArgs) => submit.mutate(args),
    isSubmitting: submit.isPending,
    submitError,
    commandId,
    command,
    tasks,
    status,
    progress: command?.progress ?? 0,
    isActive: !!commandId && !isTerminal(command?.status),
    reset,
    lastCommandText: lastCommandText.current,
  };
}
