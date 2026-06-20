/**
 * AI Agent Control Panel - Panel de administración del sistema de agentes
 * 
 * Permite iniciar/detener el orquestador y generar personalidades
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Play, 
  Pause, 
  Sparkles, 
  Bot, 
  Activity,
  Loader2,
  Zap,
  Brain,
  RefreshCcw,
  Check,
  X,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { cn } from '../../lib/utils';

interface OrchestratorStatus {
  isRunning: boolean;
  tickCount: number;
  lastTickAt: string | null;
  activeArtists: number;
  pendingActions: number;
  recentActions: Array<{
    id: number;
    artistId: number;
    actionType: string;
    status: string;
    priority: number;
  }>;
}

export function AIAgentControlPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatingAll, setGeneratingAll] = useState(false);

  // Estado del orquestador
  const { data: statusResponse, isLoading, refetch } = useQuery({
    queryKey: ['orchestrator-status'],
    queryFn: async () => {
      const response = await apiRequest({
        url: '/api/ai-social/orchestrator/status',
        method: 'GET',
      });
      return response as { success: boolean; data: OrchestratorStatus };
    },
    refetchInterval: 5000, // Actualizar cada 5 segundos
  });

  // Iniciar orquestador
  const startMutation = useMutation({
    mutationFn: async (intervalMs: number) => {
      return apiRequest({
        url: '/api/ai-social/orchestrator/start',
        method: 'POST',
        data: { intervalMs },
      });
    },
    onSuccess: () => {
      toast({
        title: '🚀 Orquestador iniciado',
        description: 'AI agents are active',
      });
      queryClient.invalidateQueries({ queryKey: ['orchestrator-status'] });
    },
  });

  // Detener orquestador
  const stopMutation = useMutation({
    mutationFn: async () => {
      return apiRequest({
        url: '/api/ai-social/orchestrator/stop',
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: '⏹️ Orquestador detenido',
        description: 'AI agents are paused',
      });
      queryClient.invalidateQueries({ queryKey: ['orchestrator-status'] });
    },
  });

  // Generar todas las personalidades
  const generateAllMutation = useMutation({
    mutationFn: async () => {
      setGeneratingAll(true);
      return apiRequest({
        url: '/api/ai-social/generate-all-personalities',
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      setGeneratingAll(false);
      toast({
        title: '✨ Personalities generated',
        description: `${data.data?.generated || 0} artists now have AI personalities`,
      });
      queryClient.invalidateQueries({ queryKey: ['orchestrator-status'] });
    },
    onError: () => {
      setGeneratingAll(false);
      toast({
        title: 'Error',
        description: 'Could not generate personalities',
        variant: 'destructive',
      });
    },
  });

  // Tick manual
  const tickMutation = useMutation({
    mutationFn: async () => {
      return apiRequest({
        url: '/api/ai-social/orchestrator/tick',
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({ title: '⚡ Tick ejecutado' });
      queryClient.invalidateQueries({ queryKey: ['ai-social-feed'] });
    },
  });

  const status = statusResponse?.data;
  const isRunning = status?.isRunning || false;

  return (
    <div className="space-y-4">
      {/* Panel de control principal */}
      <Card className={cn(
        "transition-all duration-300",
        isRunning 
          ? "bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-500/30" 
          : "bg-gradient-to-r from-slate-900/30 to-gray-900/30 border-slate-500/30"
      )}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className={cn(
                "h-6 w-6",
                isRunning ? "text-green-400 animate-pulse" : "text-gray-400"
              )} />
              <span>Agent Orchestrator</span>
            </div>
            <Badge className={cn(
              "text-sm",
              isRunning 
                ? "bg-green-500/20 text-green-400 border-green-500/30" 
                : "bg-gray-500/20 text-gray-400 border-gray-500/30"
            )}>
              {isRunning ? (
                <>
                  <Activity className="h-3 w-3 mr-1 animate-pulse" />
                  Active
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3 mr-1" />
                  Stopped
                </>
              )}
            </Badge>
          </CardTitle>
          <CardDescription className="text-gray-300">
            The central brain that coordinates all AI artists
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Estadísticas */}
          {status && (
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-white/5 text-center">
                <Brain className="h-5 w-5 mx-auto mb-1 text-purple-400" />
                <p className="text-xl font-bold text-white">{status.activeArtists}</p>
                <p className="text-xs text-gray-400">AI Artists</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 text-center">
                <Zap className="h-5 w-5 mx-auto mb-1 text-yellow-400" />
                <p className="text-xl font-bold text-white">{status.tickCount}</p>
                <p className="text-xs text-gray-400">Ticks</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 text-center">
                <Clock className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                <p className="text-xl font-bold text-white">{status.pendingActions}</p>
                <p className="text-xs text-gray-400">Pending</p>
              </div>
            </div>
          )}

          {/* Controles */}
          <div className="flex flex-wrap gap-3">
            {isRunning ? (
              <Button 
                onClick={() => stopMutation.mutate()}
                variant="destructive"
                disabled={stopMutation.isPending}
                className="flex-1"
              >
                {stopMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4 mr-2" />
                )}
                Stop System
              </Button>
            ) : (
              <Button 
                onClick={() => startMutation.mutate(60000)}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start System
              </Button>
            )}

            <Button 
              onClick={() => tickMutation.mutate()}
              variant="outline"
              className="border-purple-500/30"
              disabled={tickMutation.isPending}
            >
              {tickMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
            </Button>

            <Button 
              onClick={() => refetch()}
              variant="outline"
              className="border-white/20"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>

        {/* Acciones pendientes */}
        {status?.recentActions && status.recentActions.length > 0 && (
          <CardFooter className="border-t border-white/10 pt-4 flex-col items-start">
            <h4 className="text-sm font-medium text-gray-400 mb-2">
              Pending actions
            </h4>
            <div className="w-full space-y-2">
              {status.recentActions.slice(0, 3).map((action) => (
                <div 
                  key={action.id}
                  className="flex items-center justify-between p-2 rounded bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {action.actionType.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      Artist #{action.artistId}
                    </span>
                  </div>
                  <Badge className={cn(
                    "text-[10px]",
                    action.status === 'pending' && "bg-yellow-500/20 text-yellow-400",
                    action.status === 'processing' && "bg-blue-500/20 text-blue-400",
                    action.status === 'completed' && "bg-green-500/20 text-green-400",
                  )}>
                    {action.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Generador de personalidades */}
      <Card className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-purple-400" />
            Personality Generator
          </CardTitle>
          <CardDescription className="text-gray-300">
            Uses GPT-4o-mini to create unique personalities for each artist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => generateAllMutation.mutate()}
            disabled={generatingAll}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {generatingAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating AI personalities...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate personalities for all artists
              </>
            )}
          </Button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            This will generate personality, values, artistic vision and unique traits for each artist
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
