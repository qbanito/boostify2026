import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, Download, Sparkles, Facebook, Instagram, Camera, Film, Video, Image as ImageIcon, Music, Star, Clapperboard, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';

interface SocialPost {
  platform: 'facebook' | 'instagram' | 'tiktok';
  caption: string;
  hashtags: string[];
  cta: string;
  viralScore?: number;
}

type SceneType = 'studio_session' | 'daily_life' | 'live_event' | 'photo_shoot' | 'music_video_bts';

interface GeneratedPhoto {
  url: string;
  sceneType: SceneType;
  sceneLabel: string;
  angle: string;
  mood: string;
  prompt: string;
  model: string;
}

interface VideoJob {
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

const SCENE_OPTIONS: { value: SceneType; label: string; icon: any; description: string }[] = [
  { value: 'studio_session',    label: 'Sesión de Grabación',  icon: Music,        description: 'En el estudio grabando con micrófonos y consola' },
  { value: 'daily_life',        label: 'Vida Cotidiana',       icon: Camera,       description: 'Momentos naturales del día a día del artista' },
  { value: 'live_event',        label: 'Evento en Vivo',       icon: Star,         description: 'Concierto o evento con luces y público' },
  { value: 'photo_shoot',       label: 'Sesión de Fotos',      icon: ImageIcon,    description: 'Estudio fotográfico profesional con fondo y reflectores' },
  { value: 'music_video_bts',   label: 'Making-of Videoclip',  icon: Clapperboard, description: 'Detrás de cámara de la filmación del video musical' },
];

export default function SocialMediaGeneratorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'posts' | 'photos'>('posts');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [artistData, setArtistData] = useState<any>(null);

  // Photo tab state
  const [selectedScene, setSelectedScene] = useState<SceneType>('studio_session');
  const [generatedPhotos, setGeneratedPhotos] = useState<GeneratedPhoto[]>([]);
  const [videoJobs, setVideoJobs] = useState<Map<number, VideoJob>>(new Map());
  const pollingRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRefs.current.forEach(t => clearInterval(t));
    };
  }, []);

  // Fetch artist data
  useQuery({
    queryKey: ['/api/artist/profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await fetch(`/api/artist/profile/${user?.id}`);
      if (!response.ok) throw new Error('Failed to fetch artist data');
      const data = await response.json();
      setArtistData(data.artist || data);
      return data;
    }
  });

  // Generate text posts mutation
  const { mutate: generateContent, isPending } = useMutation({
    mutationFn: async () => {
      if (!artistData) throw new Error('Artist data not loaded');
      
      const response = await fetch('/api/social-media/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: artistData.artistName || artistData.displayName,
          biography: artistData.biography || 'Artista apasionado por la música',
          profileUrl: `${window.location.origin}/artist/${artistData.slug}`
        })
      });

      if (!response.ok) throw new Error('Failed to generate content');
      const data = await response.json();
      return data.posts || [];
    },
    onSuccess: (newPosts) => {
      setPosts(newPosts);
      toast({ title: '✅ Contenido generado', description: 'Se crearon 3 posts virales para tus redes' });
    },
    onError: (error: any) => {
      toast({ title: '❌ Error', description: error.message || 'No se pudo generar el contenido', variant: 'destructive' });
    }
  });

  // Generate AI photos mutation
  const { mutate: generatePhotos, isPending: isGeneratingPhotos } = useMutation({
    mutationFn: async () => {
      if (!artistData?.id && !artistData?.postgresId) throw new Error('Artist ID not available');
      const artistId = artistData.id || artistData.postgresId;

      const response = await fetch('/api/social-media/generate-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId: Number(artistId), sceneType: selectedScene })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to generate photos');
      }
      const data = await response.json();
      return data;
    },
    onSuccess: (data: any) => {
      setGeneratedPhotos(data.images || []);
      setVideoJobs(new Map());
      const refNote = data.usedGalleryReferences
        ? ` · ${data.referenceCount} referencias del perfil + galería`
        : data.usedReference
        ? ' · referencia del perfil'
        : '';
      toast({
        title: '✅ Fotos generadas',
        description: `${data.images?.length || 0} imágenes de "${data.sceneLabel}" listas${refNote}`
      });
    },
    onError: (error: any) => {
      toast({ title: '❌ Error al generar fotos', description: error.message, variant: 'destructive' });
    }
  });

  // Convert photo to Kling video
  const startKlingConversion = async (photoIndex: number, photoUrl: string, sceneLabel: string) => {
    try {
      setVideoJobs(prev => {
        const next = new Map(prev);
        next.set(photoIndex, { requestId: '', status: 'pending' });
        return next;
      });

      const prompt = `${sceneLabel}, cinematic camera movement, professional music video quality, dynamic motion, 8K`;

      const response = await fetch('/api/fal/kling-video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          imageUrl: photoUrl,
          duration: '5',
          aspectRatio: '9:16',
          model: 'v2.1-pro-i2v'
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to start video generation');
      }

      const data = await response.json();
      const requestId = data.requestId || data.request_id;

      if (!requestId) throw new Error('No request ID returned from Kling');

      setVideoJobs(prev => {
        const next = new Map(prev);
        next.set(photoIndex, { requestId, status: 'processing' });
        return next;
      });

      // Start polling
      const interval = setInterval(async () => {
        try {
          const poll = await fetch(`/api/fal/kling-video/${requestId}?model=v2.1-pro-i2v`);
          if (!poll.ok) return;
          const pollData = await poll.json();
          const status = pollData.status;

          if (status === 'COMPLETED' || pollData.videoUrl) {
            clearInterval(interval);
            pollingRefs.current.delete(photoIndex);
            setVideoJobs(prev => {
              const next = new Map(prev);
              next.set(photoIndex, { requestId, status: 'completed', videoUrl: pollData.videoUrl || pollData.video?.url });
              return next;
            });
            toast({ title: '🎬 Video listo', description: `Video del foto ${photoIndex + 1} generado` });
          } else if (status === 'FAILED' || status === 'ERROR') {
            clearInterval(interval);
            pollingRefs.current.delete(photoIndex);
            setVideoJobs(prev => {
              const next = new Map(prev);
              next.set(photoIndex, { requestId, status: 'failed', error: 'Video generation failed' });
              return next;
            });
          }
        } catch (_) {}
      }, 4000);

      pollingRefs.current.set(photoIndex, interval);

    } catch (e: any) {
      toast({ title: '❌ Error Kling', description: e.message, variant: 'destructive' });
      setVideoJobs(prev => {
        const next = new Map(prev);
        next.set(photoIndex, { requestId: '', status: 'failed', error: e.message });
        return next;
      });
    }
  };

  // Download all photos as HTML gallery
  const downloadHtmlGallery = () => {
    if (generatedPhotos.length === 0) return;
    const artistName = artistData?.artistName || artistData?.displayName || 'Artist';
    const sceneLabel = SCENE_OPTIONS.find(s => s.value === selectedScene)?.label || '';

    const cards = generatedPhotos.map((photo, i) => `
      <div class="card">
        <img src="${photo.url}" alt="Photo ${i + 1}" loading="lazy" />
        <div class="card-body">
          <div class="scene-badge">${photo.sceneLabel}</div>
          <p class="angle">${photo.angle}</p>
          <a class="btn-dl" href="${photo.url}" download="boostify-photo-${i + 1}.jpg" target="_blank">⬇ Descargar Foto</a>
        </div>
      </div>`).join('\n');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${artistName} — ${sceneLabel} | Boostify AI Photos</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0a0a0a; color: #f5f5f5; padding: 2rem; }
    h1 { font-size: 2rem; font-weight: 800; color: #f97316; margin-bottom: 0.5rem; }
    .sub { color: #9ca3af; margin-bottom: 2rem; font-size: 0.9rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
    .card { background: #1a1a1a; border-radius: 16px; overflow: hidden; border: 1px solid #2a2a2a; }
    .card img { width: 100%; aspect-ratio: 4/5; object-fit: cover; display: block; }
    .card-body { padding: 1rem; }
    .scene-badge { display: inline-block; background: #f97316; color: white; font-size: 0.7rem; font-weight: 700; border-radius: 6px; padding: 3px 8px; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .angle { color: #9ca3af; font-size: 0.8rem; margin-bottom: 0.75rem; }
    .btn-dl { display: block; background: linear-gradient(135deg, #f97316, #ef4444); color: white; text-align: center; padding: 0.6rem 1rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
    .btn-dl:hover { opacity: 0.85; }
    footer { margin-top: 3rem; text-align: center; color: #4b5563; font-size: 0.75rem; }
  </style>
</head>
<body>
  <h1>${artistName}</h1>
  <p class="sub">Galería de Fotos IA · ${sceneLabel} · Generado con Boostify AI</p>
  <div class="grid">
    ${cards}
  </div>
  <footer>Generado con Boostify Music Platform · ${new Date().toLocaleDateString('es-ES')}</footer>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artistName.replace(/\s+/g, '-').toLowerCase()}-photos-${selectedScene}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: '✅ Galería descargada', description: 'Archivo HTML guardado en tu dispositivo' });
  };

  if (!user) return <Redirect to="/auth" />;

  const platformIcons: Record<string, any> = {
    instagram: Instagram,
    facebook: Facebook,
    tiktok: () => <span className="text-lg font-bold">🎵</span>
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado al portapapeles' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-orange-500" />
            Generador de Contenido Social
          </h1>
          <p className="text-gray-400">Crea posts virales y fotos IA fotorrealistas para tus redes sociales</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6 bg-black/40 p-1 rounded-xl border border-orange-500/20 w-fit">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'posts'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Posts de Texto
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'photos'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Camera className="w-4 h-4" />
            Fotos IA
            <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-bold">NUEVO</span>
          </button>
        </div>

        {/* ─── TAB: POSTS DE TEXTO ─── */}
        {activeTab === 'posts' && (
          <div className="space-y-6">
            <Card className="bg-black/50 border-orange-500/30 p-6">
              <Button 
                onClick={() => generateContent()}
                disabled={isPending || !artistData}
                size="lg"
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                data-testid="button-generate-posts"
              >
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generando contenido...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />Generar Posts Virales</>
                )}
              </Button>
            </Card>

            {posts.length > 0 && (
              <div className="space-y-6">
                {posts.map((post, idx) => (
                  <Card key={idx} className="bg-black/50 border-orange-500/20 p-6 hover:border-orange-500/50 transition-all" data-testid={`card-post-${post.platform}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl capitalize font-bold text-orange-500">{post.platform}</div>
                        <Badge variant="outline" className="border-orange-500/50">
                          {post.viralScore && `Viral Score: ${post.viralScore}`}
                        </Badge>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 mb-4">
                      <p className="text-white text-sm leading-relaxed">{post.caption}</p>
                      <p className="text-orange-400 text-xs mt-3 font-semibold">{post.cta}</p>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {post.hashtags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">#{tag}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(`${post.caption}\n\n${post.hashtags.map(t => `#${t}`).join(' ')}\n\n${post.cta}`)} data-testid={`button-copy-${post.platform}`}>
                        <Copy className="w-4 h-4 mr-1" />Copiar
                      </Button>
                    </div>
                  </Card>
                ))}
                <Button onClick={() => generateContent()} disabled={isPending} variant="outline" className="w-full border-orange-500/50 text-orange-400 hover:bg-orange-500/10" data-testid="button-regenerate">
                  <Sparkles className="w-4 h-4 mr-2" />Regenerar Contenido Diferente
                </Button>
              </div>
            )}

            {posts.length === 0 && !isPending && (
              <Card className="bg-black/50 border-orange-500/20 p-12 text-center">
                <Sparkles className="w-16 h-16 text-orange-500/40 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Crea tu primer post viral</h3>
                <p className="text-gray-400">Haz clic en el botón superior para generar contenido optimizado para redes sociales</p>
              </Card>
            )}
          </div>
        )}

        {/* ─── TAB: FOTOS IA ─── */}
        {activeTab === 'photos' && (
          <div className="space-y-6">

            {/* Scene selector */}
            <Card className="bg-black/50 border-orange-500/30 p-6">
              <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-orange-500" />
                Elige el tipo de escena
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {SCENE_OPTIONS.map(scene => {
                  const Icon = scene.icon;
                  const isSelected = selectedScene === scene.value;
                  return (
                    <button
                      key={scene.value}
                      onClick={() => setSelectedScene(scene.value)}
                      className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/50'
                          : 'border-white/10 bg-white/5 hover:border-orange-500/40 hover:bg-white/8'
                      }`}
                    >
                      <div className={`p-2 rounded-lg mt-0.5 ${isSelected ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className={`font-semibold text-sm ${isSelected ? 'text-orange-400' : 'text-white'}`}>{scene.label}</div>
                        <div className="text-gray-500 text-xs mt-0.5 leading-tight">{scene.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={() => generatePhotos()}
                disabled={isGeneratingPhotos || !artistData}
                size="lg"
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold"
              >
                {isGeneratingPhotos ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Generando 3 fotos fotorrealistas...</>
                ) : (
                  <><Zap className="mr-2 h-5 w-5" />Generar 3 Fotos con IA</>
                )}
              </Button>

              {isGeneratingPhotos && (
                <div className="mt-4 flex items-center gap-3 text-sm text-gray-400 bg-white/5 rounded-lg p-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  Conectando al Superstar Blueprint y generando con FAL AI... esto puede tardar 30–60 segundos
                </div>
              )}
            </Card>

            {/* Photo gallery */}
            {generatedPhotos.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-bold text-xl flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-orange-500" />
                    {generatedPhotos[0].sceneLabel}
                    <span className="text-sm font-normal text-gray-400 ml-1">— {generatedPhotos.length} fotos generadas</span>
                  </h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadHtmlGallery}
                    className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Descargar galería HTML
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {generatedPhotos.map((photo, i) => {
                    const job = videoJobs.get(i);
                    return (
                      <Card key={i} className="bg-black/60 border-orange-500/20 overflow-hidden hover:border-orange-500/50 transition-all group">
                        {/* Image */}
                        <div className="relative overflow-hidden bg-gray-900 aspect-[4/5]">
                          <img
                            src={photo.url}
                            alt={`${photo.sceneLabel} ${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute top-2 left-2">
                            <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Foto {i + 1}
                            </span>
                          </div>
                          <div className="absolute top-2 right-2">
                            <span className="bg-black/70 text-gray-300 text-[10px] px-2 py-0.5 rounded-full">
                              {photo.model.includes('edit') ? 'Face-anchored' : 'T2I Pro'}
                            </span>
                          </div>
                        </div>

                        {/* Card body */}
                        <div className="p-4 space-y-3">
                          <div>
                            <p className="text-white font-semibold text-sm capitalize">{photo.angle}</p>
                            <p className="text-gray-400 text-xs mt-0.5">{photo.mood}</p>
                          </div>

                          {/* Download button */}
                          <a
                            href={photo.url}
                            download={`boostify-${photo.sceneType}-photo-${i + 1}.jpg`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/40 text-white text-sm font-semibold py-2 px-3 rounded-lg transition-all"
                          >
                            <Download className="w-4 h-4 text-orange-400" />
                            Descargar Foto
                          </a>

                          {/* Kling video conversion */}
                          {!job && (
                            <Button
                              size="sm"
                              onClick={() => startKlingConversion(i, photo.url, photo.sceneLabel)}
                              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white gap-2"
                            >
                              <Film className="w-4 h-4" />
                              Convertir a Video (Kling)
                            </Button>
                          )}

                          {job?.status === 'pending' && (
                            <div className="w-full flex items-center justify-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-lg py-2 text-sm text-violet-400">
                              <Loader2 className="w-4 h-4 animate-spin" />Iniciando Kling...
                            </div>
                          )}

                          {job?.status === 'processing' && (
                            <div className="w-full flex items-center justify-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-lg py-2 text-sm text-violet-400">
                              <Loader2 className="w-4 h-4 animate-spin" />Generando video...
                            </div>
                          )}

                          {job?.status === 'completed' && job.videoUrl && (
                            <div className="space-y-2">
                              <video
                                src={job.videoUrl}
                                controls
                                className="w-full rounded-lg aspect-[9/16] object-cover bg-black"
                              />
                              <a
                                href={job.videoUrl}
                                download={`boostify-${photo.sceneType}-video-${i + 1}.mp4`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-300 text-sm font-semibold py-2 px-3 rounded-lg transition-all"
                              >
                                <Video className="w-4 h-4" />
                                Descargar Video
                              </a>
                            </div>
                          )}

                          {job?.status === 'failed' && (
                            <div className="text-center text-xs text-red-400 bg-red-500/10 rounded-lg py-2 px-3">
                              ❌ Error en video. <button onClick={() => startKlingConversion(i, photo.url, photo.sceneLabel)} className="underline hover:text-red-300">Reintentar</button>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state for photos */}
            {generatedPhotos.length === 0 && !isGeneratingPhotos && (
              <Card className="bg-black/50 border-orange-500/20 p-12 text-center">
                <Camera className="w-16 h-16 text-orange-500/40 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Genera fotos fotorrealistas con IA</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                  Elige una escena y genera 3 imágenes únicas del artista con calidad cinematográfica. Usa tu foto de perfil y las imágenes de tu galería como referencia para mantener tu rostro y estilo reales. Conectado al Superstar Blueprint para máximo contexto.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {SCENE_OPTIONS.map(s => {
                    const Icon = s.icon;
                    return (
                      <span key={s.value} className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-gray-400 text-xs px-3 py-1.5 rounded-full">
                        <Icon className="w-3 h-3" />{s.label}
                      </span>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
