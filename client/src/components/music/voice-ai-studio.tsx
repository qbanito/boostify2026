/**
 * Voice AI Studio Component
 * 
 * Componente para la sección de Voice AI en el Music Generator.
 * Permite clonar voces, cambiar voces en canciones, y crear música personalizada.
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Upload,
  Play,
  Pause,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Music,
  Wand2,
  RefreshCcw,
  Volume2,
  Trash2,
  Sparkles,
  User,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

import {
  cloneVoice,
  changeVoiceFromUrl,
  textToSpeech,
  createSongWithUserVoice,
  separateAudio,
  enhanceAudio,
  VoiceCloneResult,
  VoiceChangerResult,
} from '../../lib/api/voice-ai-service';

import { useToast } from '../../hooks/use-toast';
import { logger } from '../../lib/logger';

interface VoiceModel {
  id: string;
  name: string;
  audioUrl: string;
  createdAt: Date;
}

interface VoiceAIStudioProps {
  recentGenerations?: { audioUrl: string; title: string; id: string }[];
}

export function VoiceAIStudio({ recentGenerations = [] }: VoiceAIStudioProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Estados principales
  const [activeTab, setActiveTab] = useState<'clone' | 'transform' | 'create'>('clone');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Voice cloning states
  const [voiceSampleFile, setVoiceSampleFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState('Mi Voz');
  const [clonedVoices, setClonedVoices] = useState<VoiceModel[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  
  // Transform states
  const [songToTransform, setSongToTransform] = useState<string>('');
  const [transformedAudioUrl, setTransformedAudioUrl] = useState<string | null>(null);
  
  // TTS states
  const [ttsText, setTtsText] = useState('');
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  
  // Audio player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingUrl, setCurrentPlayingUrl] = useState<string | null>(null);
  
  /**
   * Maneja la selección de archivo de audio
   */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo
      if (!file.type.startsWith('audio/')) {
        toast({
          title: 'Archivo no válido',
          description: 'Por favor selecciona un archivo de audio (MP3, WAV, etc.)',
          variant: 'destructive',
        });
        return;
      }
      
      // Validar tamaño (máximo 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: 'Archivo muy grande',
          description: 'El archivo no debe superar 50MB',
          variant: 'destructive',
        });
        return;
      }
      
      setVoiceSampleFile(file);
      setError(null);
      
      toast({
        title: 'Archivo cargado',
        description: `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      });
    }
  }, [toast]);
  
  /**
   * Clona la voz del usuario
   */
  const handleCloneVoice = useCallback(async () => {
    if (!voiceSampleFile) {
      toast({
        title: 'Selecciona un audio',
        description: 'Sube un audio de tu voz de al menos 30 segundos',
        variant: 'destructive',
      });
      return;
    }
    
    setIsProcessing(true);
    setProgress(10);
    setError(null);
    
    try {
      logger.info('[VoiceAI UI] Clonando voz...');
      
      // Simular progreso
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 1000);
      
      const result = await cloneVoice(voiceSampleFile, voiceName);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      if (result.success && result.voiceId) {
        const newVoice: VoiceModel = {
          id: result.voiceId,
          name: voiceName,
          audioUrl: result.voiceUrl || URL.createObjectURL(voiceSampleFile),
          createdAt: new Date(),
        };
        
        setClonedVoices(prev => [newVoice, ...prev]);
        setSelectedVoiceId(result.voiceId);
        
        toast({
          title: '✅ Voz clonada exitosamente',
          description: `"${voiceName}" está lista para usar`,
        });
        
        // Reset form
        setVoiceSampleFile(null);
        setVoiceName('Mi Voz');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (err: any) {
      logger.error('[VoiceAI UI] Error clonando voz:', err);
      setError(err.message);
      toast({
        title: 'Error clonando voz',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [voiceSampleFile, voiceName, toast]);
  
  /**
   * Transforma una canción con la voz del usuario
   */
  const handleTransformSong = useCallback(async () => {
    if (!selectedVoiceId) {
      toast({
        title: 'Selecciona una voz',
        description: 'Primero clona tu voz o selecciona una existente',
        variant: 'destructive',
      });
      return;
    }
    
    if (!songToTransform) {
      toast({
        title: 'Selecciona una canción',
        description: 'Ingresa la URL de la canción o selecciona una de tus generaciones',
        variant: 'destructive',
      });
      return;
    }
    
    setIsProcessing(true);
    setProgress(10);
    setError(null);
    setTransformedAudioUrl(null);
    
    try {
      logger.info('[VoiceAI UI] Transformando canción...');
      
      // Progreso simulado
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 3, 85));
      }, 2000);
      
      const result = await createSongWithUserVoice(songToTransform, selectedVoiceId);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      if (result.success && result.finalAudioUrl) {
        setTransformedAudioUrl(result.finalAudioUrl);
        
        toast({
          title: '🎵 Canción transformada',
          description: 'Tu canción con tu voz está lista',
        });
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (err: any) {
      logger.error('[VoiceAI UI] Error transformando canción:', err);
      setError(err.message);
      toast({
        title: 'Error transformando canción',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [selectedVoiceId, songToTransform, toast]);
  
  /**
   * Genera TTS con voz clonada
   */
  const handleGenerateTTS = useCallback(async () => {
    if (!selectedVoiceId) {
      toast({
        title: 'Selecciona una voz',
        description: 'Primero clona tu voz o selecciona una existente',
        variant: 'destructive',
      });
      return;
    }
    
    if (!ttsText.trim()) {
      toast({
        title: 'Escribe algo',
        description: 'Ingresa el texto que quieres que tu voz diga',
        variant: 'destructive',
      });
      return;
    }
    
    setIsProcessing(true);
    setProgress(20);
    setError(null);
    setTtsAudioUrl(null);
    
    try {
      logger.info('[VoiceAI UI] Generando TTS...');
      
      setProgress(50);
      const result = await textToSpeech(ttsText, selectedVoiceId);
      setProgress(100);
      
      if (result.success && result.audioUrl) {
        setTtsAudioUrl(result.audioUrl);
        
        toast({
          title: '🎤 Audio generado',
          description: 'Tu voz sintetizada está lista',
        });
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (err: any) {
      logger.error('[VoiceAI UI] Error en TTS:', err);
      setError(err.message);
      toast({
        title: 'Error generando audio',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [selectedVoiceId, ttsText, toast]);
  
  /**
   * Reproduce/pausa audio
   */
  const handlePlayAudio = useCallback((url: string) => {
    if (!audioRef.current) return;
    
    if (currentPlayingUrl === url && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = url;
      audioRef.current.play();
      setCurrentPlayingUrl(url);
      setIsPlaying(true);
    }
  }, [currentPlayingUrl, isPlaying]);
  
  /**
   * Descarga audio
   */
  const handleDownload = useCallback((url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }, []);
  
  return (
    <div className="space-y-6">
      {/* Hidden audio element */}
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false);
          setCurrentPlayingUrl(null);
        }}
      />
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
          <Mic className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Voice AI Studio
          </h2>
          <p className="text-muted-foreground">
            Clona tu voz y crea canciones personalizadas
          </p>
        </div>
      </div>
      
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Progress Bar */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Procesando... {progress}%
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="clone" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Clonar Voz</span>
          </TabsTrigger>
          <TabsTrigger value="transform" className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Transformar</span>
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Crear TTS</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Clone Voice Tab */}
        <TabsContent value="clone" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-purple-500" />
                Clonar Tu Voz
              </CardTitle>
              <CardDescription>
                Sube un audio de tu voz de al menos 30 segundos para crear un modelo de voz personalizado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="voice-file">Audio de tu voz</Label>
                <div 
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    id="voice-file"
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  
                  {voiceSampleFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <div className="text-left">
                        <p className="font-medium">{voiceSampleFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(voiceSampleFile.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVoiceSampleFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Mic className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Haz clic para subir o arrastra un archivo de audio
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        MP3, WAV, M4A (máx. 50MB)
                      </p>
                    </>
                  )}
                </div>
              </div>
              
              {/* Voice Name */}
              <div className="space-y-2">
                <Label htmlFor="voice-name">Nombre de la voz</Label>
                <Input
                  id="voice-name"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="Mi Voz"
                />
              </div>
              
              {/* Clone Button */}
              <Button
                onClick={handleCloneVoice}
                disabled={!voiceSampleFile || isProcessing}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clonando...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Clonar Mi Voz
                  </>
                )}
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                💡 Tip: Habla de forma clara y natural, sin música de fondo
              </p>
            </CardContent>
          </Card>
          
          {/* Cloned Voices List */}
          {clonedVoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tus Voces Clonadas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {clonedVoices.map((voice) => (
                  <div
                    key={voice.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedVoiceId === voice.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedVoiceId(voice.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-purple-500/10">
                        <User className="h-4 w-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-medium">{voice.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {voice.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {selectedVoiceId === voice.id && (
                      <Badge variant="secondary">Seleccionada</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Transform Tab */}
        <TabsContent value="transform" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCcw className="h-5 w-5 text-blue-500" />
                Transformar Canción
              </CardTitle>
              <CardDescription>
                Reemplaza la voz de cualquier canción con tu voz clonada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Voice Selection */}
              <div className="space-y-2">
                <Label>Voz a usar</Label>
                {selectedVoiceId ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      {clonedVoices.find(v => v.id === selectedVoiceId)?.name || 'Voz seleccionada'}
                    </span>
                    <Badge variant="outline" className="ml-auto">Activa</Badge>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Primero clona tu voz en la pestaña "Clonar Voz"
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              
              {/* Song URL Input */}
              <div className="space-y-2">
                <Label htmlFor="song-url">URL de la canción</Label>
                <Input
                  id="song-url"
                  value={songToTransform}
                  onChange={(e) => setSongToTransform(e.target.value)}
                  placeholder="https://... o selecciona abajo"
                />
              </div>
              
              {/* Recent generations to transform */}
              {recentGenerations.length > 0 && (
                <div className="space-y-2">
                  <Label>O selecciona una de tus canciones generadas:</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {recentGenerations.slice(0, 6).map((gen) => (
                      <Button
                        key={gen.id}
                        variant={songToTransform === gen.audioUrl ? 'default' : 'outline'}
                        className="justify-start text-left h-auto py-2"
                        onClick={() => setSongToTransform(gen.audioUrl)}
                      >
                        <Music className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{gen.title}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Transform Button */}
              <Button
                onClick={handleTransformSong}
                disabled={!selectedVoiceId || !songToTransform || isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Transformando...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Transformar con Mi Voz
                  </>
                )}
              </Button>
              
              {/* Result */}
              {transformedAudioUrl && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">¡Transformación completa!</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePlayAudio(transformedAudioUrl)}
                      >
                        {isPlaying && currentPlayingUrl === transformedAudioUrl ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(transformedAudioUrl, 'mi-cancion.mp3')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Create TTS Tab */}
        <TabsContent value="create" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Text-to-Speech
              </CardTitle>
              <CardDescription>
                Genera audio con tu voz clonada diciendo cualquier texto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Voice Selection */}
              <div className="space-y-2">
                <Label>Voz a usar</Label>
                {selectedVoiceId ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      {clonedVoices.find(v => v.id === selectedVoiceId)?.name || 'Voz seleccionada'}
                    </span>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Primero clona tu voz en la pestaña "Clonar Voz"
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              
              {/* Text Input */}
              <div className="space-y-2">
                <Label htmlFor="tts-text">Texto a decir</Label>
                <Textarea
                  id="tts-text"
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder="Escribe el texto que quieres que tu voz diga..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {ttsText.length} caracteres
                </p>
              </div>
              
              {/* Generate Button */}
              <Button
                onClick={handleGenerateTTS}
                disabled={!selectedVoiceId || !ttsText.trim() || isProcessing}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    Generar Audio
                  </>
                )}
              </Button>
              
              {/* TTS Result */}
              {ttsAudioUrl && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-amber-500" />
                      <span className="font-medium">Audio generado</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePlayAudio(ttsAudioUrl)}
                      >
                        {isPlaying && currentPlayingUrl === ttsAudioUrl ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(ttsAudioUrl, 'mi-audio.mp3')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Info Section */}
      <Card className="bg-gradient-to-r from-purple-500/5 to-pink-500/5 border-purple-500/20">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="p-3 rounded-full bg-purple-500/10 w-12 h-12 mx-auto mb-2 flex items-center justify-center">
                <Mic className="h-6 w-6 text-purple-500" />
              </div>
              <h4 className="font-medium">Clonación Zero-Shot</h4>
              <p className="text-sm text-muted-foreground">
                Solo necesitas 30 segundos de audio
              </p>
            </div>
            <div>
              <div className="p-3 rounded-full bg-blue-500/10 w-12 h-12 mx-auto mb-2 flex items-center justify-center">
                <RefreshCcw className="h-6 w-6 text-blue-500" />
              </div>
              <h4 className="font-medium">Voice Changer IA</h4>
              <p className="text-sm text-muted-foreground">
                Cambia la voz en cualquier canción
              </p>
            </div>
            <div>
              <div className="p-3 rounded-full bg-amber-500/10 w-12 h-12 mx-auto mb-2 flex items-center justify-center">
                <Volume2 className="h-6 w-6 text-amber-500" />
              </div>
              <h4 className="font-medium">Calidad Profesional</h4>
              <p className="text-sm text-muted-foreground">
                Audio de alta fidelidad a 48kHz
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default VoiceAIStudio;
