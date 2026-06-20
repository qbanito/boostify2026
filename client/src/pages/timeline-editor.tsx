/**
 * Timeline Editor Page - Professional Timeline Editor
 * Accesible por: /timeline (crear nuevo) o /timeline/:projectId (editar existente)
 * Usa el componente TimelineDemo profesional con funcionalidades completas
 */

import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';
import TimelineDemo from '@/components/timeline/TimelineDemo';
import { apiRequest } from '@/lib/queryClient';

interface Project {
  id: number;
  projectName: string;
  artistName?: string;
  songName?: string;
  status?: string;
  [key: string]: any;
}

export default function TimelineEditorPage() {
  const [, params] = useRoute('/timeline/:projectId');
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const projectId = params?.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    projectName: '',
    artistName: '',
    songName: ''
  });
  const [isCreating, setIsCreating] = useState(false);

  // Cargar proyecto si existe projectId
  const { isLoading, error } = useQuery({
    queryKey: ['/api/music-video-projects/load', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const response = await fetch(`/api/music-video-projects/load/${projectId}`);
      if (!response.ok) throw new Error('No se pudo cargar el proyecto');
      const data = await response.json();
      return data.project;
    },
    enabled: !!projectId,
    onSuccess: (data) => {
      if (data) {
        setProject(data);
        setShowCreateForm(false);
      }
    }
  });

  // Crear nuevo proyecto vacío
  const handleCreateProject = async () => {
    if (!createForm.projectName.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre del proyecto es requerido',
        variant: 'destructive'
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await apiRequest({
        path: '/api/music-video-projects/create-empty',
        method: 'POST',
        body: {
          projectName: createForm.projectName,
          artistName: createForm.artistName || 'Unknown Artist',
          songName: createForm.songName || 'Untitled'
        }
      });

      if (response.success) {
        toast({
          title: '✅ Proyecto creado',
          description: `"${createForm.projectName}" está listo para editar`,
        });
        navigate(`/timeline/${response.projectId}`);
      } else {
        throw new Error(response.error || 'Error creando proyecto');
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error creando proyecto',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Vista de creación de proyecto
  if (showCreateForm || (!projectId && !project)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-purple-900 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-3xl text-white">🎬 Timeline Editor Profesional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-4">Crear nuevo proyecto</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-300 block mb-2">Nombre del proyecto *</label>
                    <Input
                      placeholder="Ej: Music Video 2025"
                      value={createForm.projectName}
                      onChange={(e) => setCreateForm({ ...createForm, projectName: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-300 block mb-2">Nombre del artista</label>
                    <Input
                      placeholder="Ej: Mi Artista"
                      value={createForm.artistName}
                      onChange={(e) => setCreateForm({ ...createForm, artistName: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-300 block mb-2">Nombre de la canción</label>
                    <Input
                      placeholder="Ej: Mi Canción"
                      value={createForm.songName}
                      onChange={(e) => setCreateForm({ ...createForm, songName: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleCreateProject}
                  disabled={isCreating}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 font-bold text-white"
                >
                  <Plus className="mr-2 w-4 h-4" />
                  {isCreating ? 'Creando...' : 'Crear proyecto'}
                </Button>
                <Button
                  onClick={() => navigate('/music-video-flow')}
                  variant="outline"
                  className="border-gray-600 hover:bg-gray-800"
                >
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  Volver
                </Button>
              </div>

              {projectId && (
                <Button
                  onClick={() => setShowCreateForm(false)}
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white"
                >
                  Cargar proyecto {projectId}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-500">Proyecto no encontrado</h1>
          <p className="text-gray-400 mt-3">{error instanceof Error ? error.message : 'El proyecto no existe'}</p>
          <Button
            onClick={() => {
              setShowCreateForm(true);
              setCreateForm({ projectName: '', artistName: '', songName: '' });
            }}
            className="mt-6 bg-gradient-to-r from-purple-600 to-pink-600"
          >
            <Plus className="mr-2 w-4 h-4" />
            Crear nuevo proyecto
          </Button>
        </div>
      </div>
    );
  }

  // Renderizar timeline profesional
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-purple-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-slate-800/95 to-purple-900/95 backdrop-blur-md p-6 border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-black text-white">{project.projectName}</h1>
            <p className="text-purple-300 font-semibold text-sm">{project.artistName || 'Unknown Artist'} - {project.songName || 'Untitled'}</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/music-video-flow')}
              className="border-gray-600 hover:bg-gray-800"
            >
              <ArrowLeft className="mr-2 w-4 h-4" />
              Volver
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline Editor profesional */}
      <div className="p-6">
        <TimelineDemo mode="edit" />
      </div>
    </div>
  );
}
