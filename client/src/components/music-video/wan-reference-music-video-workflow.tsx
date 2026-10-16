import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Film,
  Image as ImageIcon,
  Loader2,
  Music2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Wand2,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Textarea } from '../ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';

const WAN_MODEL = 'alibaba/wan-3.0/reference-to-video';
const WAN_COST_PER_SECOND = 0.05;
const EMPTY_REFERENCE_IMAGES: string[] = [];

type SceneStatus = 'draft' | 'image-generating' | 'image-ready' | 'video-generating' | 'video-ready' | 'error';

interface Scene {
  id: number;
  title: string;
  prompt: string;
  duration: number;
  imageUrl?: string;
  videoUrl?: string;
  requestId?: string;
  status: SceneStatus;
  error?: string;
}
interface WanReferenceMusicVideoWorkflowProps {
  preFilledArtistName?: string;
  preFilledSongName?: string;
  preFilledAudioUrl?: string;
  preFilledCoverArt?: string;
  preFilledImages?: string[];
  selectedDirectorName?: string;
}

function scenePrompt(artist: string, director: string, title: string, index: number) {
  return `Cinematic music video scene ${index + 1} for ${artist || 'the artist'}${title ? `, song "${title}"` : ''}. ${director ? `Visual direction inspired by ${director}. ` : ''}Keep the same artist identity, face, hairstyle, wardrobe language, color palette and film grain across every scene. Show a strong visual moment with clear subject motion, expressive performance and a deliberate camera move. Professional music-video cinematography, no text, no logos.`;
}

export function WanReferenceMusicVideoWorkflow({
  preFilledArtistName = '',
  preFilledSongName = '',
  preFilledAudioUrl,
  preFilledCoverArt,
  preFilledImages = EMPTY_REFERENCE_IMAGES,
  selectedDirectorName,
}: WanReferenceMusicVideoWorkflowProps) {
  const { toast } = useToast();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [artistName, setArtistName] = useState(preFilledArtistName);
  const [songName, setSongName] = useState(preFilledSongName);
  const [audioUrl, setAudioUrl] = useState(preFilledAudioUrl || '');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [audioName, setAudioName] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('1080p');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);
  const [isRenderingFinal, setIsRenderingFinal] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setArtistName(preFilledArtistName);
    setSongName(preFilledSongName);
    setAudioUrl(preFilledAudioUrl || '');
    const refs = [...(preFilledImages || []), ...(preFilledCoverArt ? [preFilledCoverArt] : [])]
      .filter(Boolean)
      .slice(0, 4);
    setReferenceImages(refs);
  }, [preFilledArtistName, preFilledSongName, preFilledAudioUrl, preFilledCoverArt, preFilledImages]);

  useEffect(() => {
    if (scenes.length > 0) return;
    setScenes([
      { id: 1, title: 'Opening', duration: 6, prompt: scenePrompt(preFilledArtistName, selectedDirectorName || '', preFilledSongName, 0), imageUrl: preFilledImages[0] || preFilledCoverArt, status: preFilledImages.length || preFilledCoverArt ? 'image-ready' : 'draft' },
      { id: 2, title: 'Verse / Story', duration: 8, prompt: scenePrompt(preFilledArtistName, selectedDirectorName || '', preFilledSongName, 1), status: 'draft' },
      { id: 3, title: 'Chorus / Performance', duration: 8, prompt: `${scenePrompt(preFilledArtistName, selectedDirectorName || '', preFilledSongName, 2)} High-energy chorus performance, dynamic tracking shot, rhythmic movement.`, status: 'draft' },
    ]);
  }, [scenes.length, preFilledArtistName, preFilledSongName, preFilledImages.length, preFilledCoverArt, selectedDirectorName]);

  const totalDuration = useMemo(() => scenes.reduce((sum, scene) => sum + scene.duration, 0), [scenes]);
  const estimatedCost = totalDuration * WAN_COST_PER_SECOND;
  const readyImages = scenes.filter(scene => scene.imageUrl).length;
  const readyVideos = scenes.filter(scene => scene.videoUrl).length;

  const updateScene = (id: number, updates: Partial<Scene>) => {
    setScenes(current => current.map(scene => scene.id === id ? { ...scene, ...updates } : scene));
  };

  const readDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });

  const uploadReferenceFile = async (file: File) => {
    try {
      const dataUrl = await readDataUrl(file);
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: dataUrl, fileName: file.name, folder: 'music-video-references' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.imageUrl) throw new Error(data.error || 'No se pudo subir la referencia');
      setReferenceImages(current => [...current, data.imageUrl].slice(0, 4));
      toast({ title: 'Referencia agregada', description: 'Se usará para mantener la identidad visual.' });
    } catch (error) {
      toast({ title: 'Error subiendo referencia', description: error instanceof Error ? error.message : 'Intenta de nuevo', variant: 'destructive' });
    }
  };

  const handleReferenceFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 4 - referenceImages.length);
    files.forEach(file => void uploadReferenceFile(file));
    event.target.value = '';
  };

  const handleAudio = async (file?: File) => {
    if (!file) return;
    setAudioUrl(URL.createObjectURL(file));
    setAudioName(file.name);
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const uploaded = await apiRequest({ url: '/api/upload/temp-audio', method: 'POST', data: form });
      if (!uploaded.success || !uploaded.url) throw new Error(uploaded.error || 'No se pudo subir la canción');
      setAudioUrl(uploaded.url);
    } catch (error) {
      toast({ title: 'Canción no subida', description: error instanceof Error ? error.message : 'El archivo local no podrá incluirse en el render.', variant: 'destructive' });
    }
  };

  const generateImages = async () => {
    setIsGeneratingImages(true);
    setProgress(0);
    let continuityAnchor = referenceImages[0];
    try {
      for (let index = 0; index < scenes.length; index += 1) {
        const scene = scenes[index];
        updateScene(scene.id, { status: 'image-generating', error: undefined });
        const refs = [continuityAnchor, ...referenceImages].filter(Boolean).filter((value, position, all) => all.indexOf(value) === position).slice(0, 4);
        const data = await apiRequest({ url: '/api/fal/wan-music-video/openai-image', method: 'POST', data: {
            prompt: `${scene.prompt} Scene title: ${scene.title}. Preserve the exact same main artist identity from the reference images.`,
            referenceImages: refs,
            aspectRatio,
            quality: 'high',
            numImages: 1,
          } });
        if (!data.success || !data.imageUrl) throw new Error(data.error || `OpenAI falló en la escena ${index + 1}`);
        continuityAnchor = continuityAnchor || data.imageUrl;
        updateScene(scene.id, { imageUrl: data.imageUrl, status: 'image-ready' });
        setProgress(Math.round(((index + 1) / scenes.length) * 100));
      }
      toast({ title: 'Imágenes consistentes listas', description: `${scenes.length} escenas preparadas para Wan 3.0.` });
    } catch (error) {
      toast({ title: 'No se pudieron generar las imágenes', description: error instanceof Error ? error.message : 'Intenta de nuevo', variant: 'destructive' });
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const waitForWanVideo = async (requestId: string) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const data = await apiRequest(`/api/fal/wan-music-video/${encodeURIComponent(requestId)}`);
      if (data.status === 'FAILED') throw new Error(data.error || 'Wan 3.0 no pudo completar el clip');
      if (data.status === 'COMPLETED' && data.videoUrl) return data.videoUrl as string;
    }
    throw new Error('La generación de Wan 3.0 excedió el tiempo de espera');
  };

  const generateVideos = async () => {
    const scenesWithImages = scenes.filter(scene => scene.imageUrl);
    if (scenesWithImages.length === 0) {
      toast({ title: 'Primero genera las imágenes', description: 'Wan 3.0 necesita referencias visuales para cada tramo.', variant: 'destructive' });
      return;
    }
    setIsGeneratingVideos(true);
    setProgress(0);
    try {
      for (let index = 0; index < scenesWithImages.length; index += 1) {
        const scene = scenesWithImages[index];
        updateScene(scene.id, { status: 'video-generating', error: undefined });
        const referenceUrls = [scene.imageUrl, ...referenceImages].filter(Boolean).slice(0, 10);
        const submitData = await apiRequest({ url: '/api/fal/wan-music-video/generate', method: 'POST', data: {
            prompt: `${scene.prompt} Animate the reference image into a complete cinematic music-video shot. Keep identity and wardrobe stable.`,
            referenceImages: referenceUrls,
            duration: scene.duration,
            resolution,
            aspectRatio,
          } });
        if (!submitData.success || !submitData.requestId) throw new Error(submitData.error || 'No se pudo iniciar Wan 3.0');
        updateScene(scene.id, { requestId: submitData.requestId });
        const videoUrl = await waitForWanVideo(submitData.requestId);
        updateScene(scene.id, { videoUrl, status: 'video-ready' });
        setProgress(Math.round(((index + 1) / scenesWithImages.length) * 100));
      }
      toast({ title: 'Clips Wan 3.0 listos', description: 'Revisa el timeline y descarga los clips generados.' });
    } catch (error) {
      toast({ title: 'Wan 3.0 no pudo generar el video', description: error instanceof Error ? error.message : 'Intenta de nuevo', variant: 'destructive' });
      setScenes(current => current.map(scene => scene.status === 'video-generating' ? { ...scene, status: 'error' } : scene));
    } finally {
      setIsGeneratingVideos(false);
    }
  };

  const renderFinalVideo = async () => {
    const readyScenes = scenes.filter(scene => scene.videoUrl);
    if (readyScenes.length === 0) {
      toast({ title: 'No hay clips para exportar', description: 'Genera al menos un clip Wan 3.0 primero.', variant: 'destructive' });
      return;
    }
    if (readyScenes.length !== scenes.length) {
      const missingCount = scenes.length - readyScenes.length;
      toast({ title: 'Faltan clips por generar', description: `${missingCount} escena(s) todavía no tienen video. Completa el timeline para evitar que el render omita partes.`, variant: 'destructive' });
      return;
    }
    if (!/^https:\/\//.test(audioUrl)) {
      toast({ title: 'Falta subir la canción', description: 'Sube la pista a una URL pública antes de exportar para que el render incluya el audio.', variant: 'destructive' });
      return;
    }

    setIsRenderingFinal(true);
    try {
      let start = 0;
      const clips = readyScenes.map(scene => {
        const clip = { id: `wan-${scene.id}`, videoUrl: scene.videoUrl, start, duration: scene.duration, transition: 'none' as const };
        start += scene.duration;
        return clip;
      });
      const data = await apiRequest({ url: '/api/video-rendering/start', method: 'POST', data: { clips, audioUrl, audioDuration: totalDuration, resolution, aspectRatio, quality: 'high', fps: 30 } });
      if (!data.renderId) throw new Error(data.error || 'No se pudo iniciar el render final');

      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const statusData = await apiRequest(`/api/video-rendering/status/${encodeURIComponent(data.renderId)}`);
        if (statusData.status === 'failed') throw new Error(statusData.error || 'El render final falló');
        if (statusData.status === 'done' && statusData.url) {
          setFinalVideoUrl(statusData.url);
          toast({ title: 'Video final listo', description: 'La secuencia fue renderizada desde el timeline.' });
          return;
        }
      }
      throw new Error('El render final excedió el tiempo de espera');
    } catch (error) {
      toast({ title: 'No se pudo exportar el video final', description: error instanceof Error ? error.message : 'Intenta de nuevo', variant: 'destructive' });
    } finally {
      setIsRenderingFinal(false);
    }
  };

  const addScene = () => {
    const id = Math.max(0, ...scenes.map(scene => scene.id)) + 1;
    setScenes(current => [...current, {
      id,
      title: `Scene ${id}`,
      duration: 6,
      prompt: scenePrompt(artistName, selectedDirectorName || '', songName, id - 1),
      status: 'draft',
    }]);
  };

  const moveScene = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= scenes.length) return;
    setScenes(current => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const statusLabel: Record<SceneStatus, string> = {
    draft: 'Pendiente',
    'image-generating': 'Creando imagen',
    'image-ready': 'Imagen lista',
    'video-generating': 'Creando video',
    'video-ready': 'Video listo',
    error: 'Error',
  };

  return (
    <div className="space-y-5">
      <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-background to-cyan-500/5">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-400" />
                <CardTitle>Wan 3.0 Music Video Workflow</CardTitle>
                <Badge variant="outline" className="border-orange-500/40 text-orange-300">OpenAI + fal</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Una identidad visual, una secuencia de clips y un timeline sencillo.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-white">{WAN_MODEL}</span><br />
              Hasta 30 s por clip · $0.05/s de video Wan · audio Wan desactivado
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div><Label>Artista</Label><Input value={artistName} onChange={event => setArtistName(event.target.value)} placeholder="Nombre del artista" /></div>
          <div><Label>Canción</Label><Input value={songName} onChange={event => setSongName(event.target.value)} placeholder="Título de la canción" /></div>
          <div><Label>Formato</Label><select value={aspectRatio} onChange={event => setAspectRatio(event.target.value as typeof aspectRatio)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="16:9">16:9 YouTube</option><option value="9:16">9:16 Shorts/Reels</option><option value="1:1">1:1 Square</option></select></div>
          <div><Label>Resolución Wan</Label><select value={resolution} onChange={event => setResolution(event.target.value as typeof resolution)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="1080p">1080p</option><option value="720p">720p</option><option value="480p">480p preview</option></select></div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ImageIcon className="h-4 w-4 text-cyan-400" />Identity references</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">OpenAI usa estas imágenes para crear un anchor y conservar rostro, vestuario y estilo entre escenas.</p>
            <div className="grid grid-cols-4 gap-2">
              {referenceImages.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`Reference ${index + 1}`} className="aspect-square w-full rounded-md border border-white/10 object-cover" />)}
              {referenceImages.length < 4 && <button type="button" onClick={() => imageInputRef.current?.click()} className="flex aspect-square items-center justify-center rounded-md border border-dashed border-white/20 text-muted-foreground hover:border-cyan-400 hover:text-cyan-300"><Upload className="h-4 w-4" /></button>}
            </div>
            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleReferenceFiles} />
            <Button variant="outline" size="sm" className="w-full" onClick={() => imageInputRef.current?.click()} disabled={referenceImages.length >= 4}><Upload className="mr-2 h-4 w-4" />Agregar referencias ({referenceImages.length}/4)</Button>
            <div className="rounded-md border border-white/10 bg-black/10 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Music2 className="h-4 w-4 text-pink-400" />Pista maestra</div>
              <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={event => handleAudio(event.target.files?.[0])} />
              <Button variant="outline" size="sm" onClick={() => audioInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />{audioName || (audioUrl ? 'Cambiar canción' : 'Cargar canción')}</Button>
              {audioUrl && <audio controls src={audioUrl} className="mt-3 w-full" />}
              <p className="mt-2 text-[11px] text-muted-foreground">La canción se conserva en el timeline. Wan genera solo imagen/movimiento, sin audio adicional.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Wand2 className="h-4 w-4 text-orange-400" />Generation pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-white/10 p-3"><span className="text-[11px] text-muted-foreground">1 · Consistencia</span><p className="mt-1 text-sm font-medium">OpenAI GPT Image</p><p className="text-[11px] text-muted-foreground">{readyImages}/{scenes.length} imágenes</p></div>
              <div className="rounded-md border border-white/10 p-3"><span className="text-[11px] text-muted-foreground">2 · Movimiento</span><p className="mt-1 text-sm font-medium">Wan 3.0 R2V</p><p className="text-[11px] text-muted-foreground">{readyVideos}/{scenes.length} clips</p></div>
              <div className="rounded-md border border-white/10 p-3"><span className="text-[11px] text-muted-foreground">3 · Timeline</span><p className="mt-1 text-sm font-medium">{totalDuration}s total</p><p className="text-[11px] text-muted-foreground">Wan (solo video): ${estimatedCost.toFixed(2)}. No incluye imágenes OpenAI, almacenamiento ni render.</p></div>
            </div>
            {(isGeneratingImages || isGeneratingVideos) && <Progress value={progress} className="h-2" />}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={generateImages} disabled={isGeneratingImages || isGeneratingVideos} className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500"><ImageIcon className="mr-2 h-4 w-4" />{isGeneratingImages ? 'Creando imágenes…' : '1. Generar imágenes consistentes'}</Button>
              <Button onClick={generateVideos} disabled={isGeneratingImages || isGeneratingVideos || isRenderingFinal || readyImages === 0} variant="secondary" className="flex-1"><Video className="mr-2 h-4 w-4" />{isGeneratingVideos ? 'Generando Wan…' : '2. Generar clips Wan 3.0'}</Button>
            </div>
            <p className="text-xs text-muted-foreground">Cada tramo usa la imagen de su escena más las referencias globales. Esto reemplaza la generación de modelos distintos por clip.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3"><CardTitle className="flex items-center gap-2 text-base"><Film className="h-4 w-4 text-violet-400" />Timeline de escenas</CardTitle><Button variant="outline" size="sm" onClick={addScene}><Plus className="mr-1 h-4 w-4" />Agregar escena</Button></CardHeader>
        <CardContent className="space-y-3">
          {scenes.map((scene, index) => (
            <div key={scene.id} className="rounded-lg border border-white/10 bg-black/10 p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
                <div className="flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/30">
                  {scene.videoUrl ? <video src={scene.videoUrl} controls className="h-full w-full object-cover" /> : scene.imageUrl ? <img src={scene.imageUrl} alt={scene.title} className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row"><Input value={scene.title} onChange={event => updateScene(scene.id, { title: event.target.value })} className="sm:max-w-xs" /><div className="flex items-center gap-2"><Label className="whitespace-nowrap">Duración</Label><Input type="number" min={2} max={30} value={scene.duration} onChange={event => updateScene(scene.id, { duration: Math.min(30, Math.max(2, Number(event.target.value) || 2)) })} className="w-20" /><span className="text-xs text-muted-foreground">s</span></div></div>
                  <Textarea value={scene.prompt} onChange={event => updateScene(scene.id, { prompt: event.target.value, status: scene.imageUrl ? 'image-ready' : 'draft' })} rows={3} className="text-xs" />
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={scene.status === 'video-ready' ? 'border-emerald-500/40 text-emerald-300' : scene.status === 'error' ? 'border-red-500/40 text-red-300' : 'border-white/15'}>{scene.status === 'video-ready' || scene.status === 'image-ready' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}{statusLabel[scene.status]}</Badge>{scene.videoUrl && <a href={scene.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 hover:underline">Abrir clip</a>}<Button variant="ghost" size="sm" onClick={() => updateScene(scene.id, { imageUrl: undefined, videoUrl: undefined, requestId: undefined, status: 'draft' })}><RefreshCw className="mr-1 h-3 w-3" />Regenerar</Button><Button variant="ghost" size="icon" onClick={() => moveScene(index, -1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => moveScene(index, 1)} disabled={index === scenes.length - 1}><ArrowDown className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setScenes(current => current.filter(item => item.id !== scene.id))} disabled={scenes.length <= 1}><Trash2 className="h-4 w-4 text-red-400" /></Button></div>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-muted-foreground"><span>{scenes.length} escenas · {totalDuration}s · pista {audioUrl ? 'cargada' : 'pendiente'}</span><span>Consistencia: {referenceImages.length > 0 ? 'referencias activas' : 'anchor OpenAI'}</span></div>
          <div className="flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">El render usa los clips en este orden y añade la pista maestra si es una URL pública.</p>
            <div className="flex items-center gap-2">
              {finalVideoUrl && <a href={finalVideoUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 hover:underline">Abrir video final</a>}
              <Button onClick={renderFinalVideo} disabled={isGeneratingImages || isGeneratingVideos || isRenderingFinal || readyVideos === 0} size="sm"><Video className="mr-2 h-4 w-4" />{isRenderingFinal ? 'Renderizando…' : 'Exportar video final'}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100/70"><Loader2 className="mr-2 inline h-3 w-3" />Wan 3.0 permite clips de 2–30 s. Para canciones largas, el timeline conserva la pista completa y encadena varios clips con las mismas referencias para mantener continuidad.</div>
    </div>
  );
}
