/**
import { logger } from "../../lib/logger";
 * Music Video Workflow Complete
 * Mantiene el flujo anterior completo + agrega timeline profesional
 * 
 * Flujo:
 * 1-5: Flujo existente (Upload → Director → Transcribe → Script → Images)
 * 6: NUEVO - Timeline Editor Profesional
 * 7: NUEVO - Generar Videos con IA
 * 8: NUEVO - Exportar MP4
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { EnhancedTimeline, type TimelineClip, type TimelineTrack } from '../professional-editor/EnhancedTimeline';
import { MusicVideoWorkflow } from './music-video-workflow';
import { VideoPreviewPlayer } from '../professional-editor/VideoPreviewPlayer';
import { BeatSyncPanel } from '../professional-editor/BeatSyncPanel';
import { StyleTemplatePicker } from '../professional-editor/StyleTemplatePicker';
import { SubtitlePanel } from '../professional-editor/SubtitlePanel';
import { TransitionPanel } from '../professional-editor/TransitionPanel';
import { ColorGradingPanel } from '../professional-editor/ColorGradingPanel';
import { 
  Film, 
  Sparkles, 
  CheckCircle2,
  ChevronRight 
} from 'lucide-react';

export function MusicVideoWorkflowComplete() {
  const { toast } = useToast();
  
  // Estado para capturar cuando el workflow anterior termina
  const [workflowComplete, setWorkflowComplete] = useState(false);
  const [videoResult, setVideoResult] = useState<{
    videoUrl?: string;
    clips?: TimelineClip[];
    duration?: number;
    transcription?: string;
  } | null>(null);

  // Timeline state
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [tracks, setTracks] = useState<TimelineTrack[]>([
    {
      id: 'video-track',
      name: 'Video Principal',
      type: 'video',
      visible: true,
      locked: false
    },
    {
      id: 'audio-track',
      name: 'Audio',
      type: 'audio',
      visible: true,
      locked: false
    }
  ]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Handler para añadir subtítulos al timeline
  const handleSubtitlesGenerated = (subtitleClips: TimelineClip[], subtitleTrack: TimelineTrack) => {
    // Añadir track de subtítulos si no existe
    if (!tracks.find(t => t.id === subtitleTrack.id)) {
      setTracks(prev => [...prev, subtitleTrack]);
    }
    
    // Añadir clips de subtítulos
    setClips(prev => [...prev, ...subtitleClips]);
  };

  // Cuando el workflow anterior complete, convertir clips al formato del EnhancedTimeline
  useEffect(() => {
    if (videoResult?.clips) {
      // Convertir clips del formato antiguo al nuevo
      const convertedClips: TimelineClip[] = videoResult.clips.map((oldClip: any) => {
        const isAudio = oldClip.type === 'audio';
        
        return {
          id: `clip-${oldClip.id}`,
          title: oldClip.title || oldClip.name || 'Clip',
          type: oldClip.type || 'image',
          start: oldClip.start || 0,
          duration: oldClip.duration || 5,
          trackId: isAudio ? 'audio-track' : 'video-track',
          url: oldClip.videoUrl || oldClip.imageUrl || oldClip.audioUrl || '',
          color: getClipColor(oldClip.type),
          locked: false,
          metadata: oldClip.metadata
        };
      });

      setClips(convertedClips);
      
      toast({
        title: "Timeline cargado",
        description: `${convertedClips.length} clips listos para editar`
      });
    }
  }, [videoResult]);

  // Handler cuando el workflow anterior completa
  const handleWorkflowComplete = (result: any) => {
    logger.info('Workflow completado:', result);
    setVideoResult(result);
    setWorkflowComplete(true);
  };

  // Si ya completamos el workflow anterior, mostrar solo el timeline
  if (workflowComplete && clips.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4 md:p-8">
        <div className="max-w-[1800px] mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <h1 className="text-4xl font-bold text-white">
                Imágenes Generadas - Edita tu Timeline
              </h1>
            </div>
            <p className="text-zinc-400">
              Ahora puedes editar, generar videos y exportar tu proyecto
            </p>
          </div>

          {/* Progress */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                {[
                  { label: 'Upload', done: true },
                  { label: 'Director', done: true },
                  { label: 'Transcribe', done: true },
                  { label: 'Script', done: true },
                  { label: 'Imágenes', done: true },
                  { label: 'Timeline', done: false },
                  { label: 'Videos', done: false },
                  { label: 'Export', done: false }
                ].map((step, index, array) => (
                  <div key={step.label} className="flex items-center">
                    <div className={`flex flex-col items-center ${
                      step.done ? 'text-green-500' : 
                      index === 5 ? 'text-orange-500' : 
                      'text-zinc-600'
                    }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                        step.done ? 'border-green-500 bg-green-500/10' :
                        index === 5 ? 'border-orange-500 bg-orange-500/10' :
                        'border-zinc-700 bg-zinc-800'
                      }`}>
                        {step.done ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <span className="text-xs font-bold">{index + 1}</span>
                        )}
                      </div>
                      <span className="text-xs mt-1">{step.label}</span>
                    </div>
                    {index < array.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-zinc-700 mx-1" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main Grid Layout - Sidebar + Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Preview & Tools */}
            <div className="lg:col-span-1 space-y-4">
              {/* Video Preview */}
              <VideoPreviewPlayer
                clips={clips}
                currentTime={currentTime}
                duration={videoResult?.duration || 120}
                isPlaying={isPlaying}
                onSeek={setCurrentTime}
                onPlayPause={() => setIsPlaying(!isPlaying)}
              />

              {/* Tabbed Panels */}
              <Tabs defaultValue="beats" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-zinc-800">
                  <TabsTrigger value="beats" className="text-xs">🎵 Beats</TabsTrigger>
                  <TabsTrigger value="style" className="text-xs">🎨 Estilo</TabsTrigger>
                  <TabsTrigger value="advanced" className="text-xs">⚙️ Avanzado</TabsTrigger>
                </TabsList>

                {/* Beat Sync Tab */}
                <TabsContent value="beats" className="mt-4">
                  <BeatSyncPanel
                    clips={clips}
                    duration={videoResult?.duration || 120}
                    onClipsAligned={setClips}
                  />
                </TabsContent>

                {/* Style Templates Tab */}
                <TabsContent value="style" className="mt-4">
                  <StyleTemplatePicker
                    clips={clips}
                    duration={videoResult?.duration || 120}
                    onTemplateApplied={(styledClips) => setClips(styledClips)}
                  />
                </TabsContent>

                {/* Advanced Tools Tab */}
                <TabsContent value="advanced" className="mt-4 space-y-4">
                  {/* Subtitles */}
                  <SubtitlePanel
                    transcription={videoResult?.transcription}
                    duration={videoResult?.duration || 120}
                    onSubtitlesGenerated={handleSubtitlesGenerated}
                  />

                  {/* Transitions */}
                  <TransitionPanel
                    clips={clips}
                    onClipsUpdated={setClips}
                  />

                  {/* Color Grading */}
                  <ColorGradingPanel
                    clips={clips}
                    onClipsUpdated={setClips}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Timeline Editor - Main Area */}
            <div className="lg:col-span-3">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Film className="h-5 w-5 text-orange-500" />
                        Editor de Timeline Profesional
                      </CardTitle>
                      <p className="text-sm text-zinc-400 mt-1">
                        Edita, genera videos y exporta tu proyecto final
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <EnhancedTimeline
                    clips={clips}
                    tracks={tracks}
                    duration={videoResult?.duration || 120}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                    onClipsChange={setClips}
                    onSeek={setCurrentTime}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Info */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-white">Generar Videos</p>
                    <p className="text-zinc-400">Click en "Generar Videos" para convertir imágenes en videos animados</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Film className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-white">Editar</p>
                    <p className="text-zinc-400">Arrastra, recorta y edita clips en el timeline</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-white">Exportar</p>
                    <p className="text-zinc-400">Click en "Exportar MP4" para descargar tu video</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Mostrar el workflow anterior hasta que complete
  return (
    <div>
      <MusicVideoWorkflow onComplete={handleWorkflowComplete} />
    </div>
  );
}

function getClipColor(type: string): string {
  const colors: Record<string, string> = {
    video: '#3b82f6',
    audio: '#22c55e',
    image: '#8b5cf6',
    text: '#f59e0b'
  };
  return colors[type] || '#6b7280';
}

export default MusicVideoWorkflowComplete;
