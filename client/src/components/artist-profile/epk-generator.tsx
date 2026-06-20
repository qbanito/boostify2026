import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Button } from '../ui/button';
import { useToast } from '../../hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import {
  FileText, Download, Sparkles, Loader2, Image as ImageIcon, Quote, Award, FileCheck,
  Music, Video, Share2, Globe, Instagram, Youtube, Link, ExternalLink,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';

interface EPKTrack {
  title: string;
  audioUrl: string;
  coverArt?: string;
  duration?: string;
  genre?: string;
  releaseDate?: string;
  plays?: number;
  isFeatured?: boolean;
}

interface EPKVideo {
  title: string;
  url: string;
  thumbnail?: string;
  description?: string;
  isLoop?: boolean;
}

interface EPKData {
  artistName: string;
  realName?: string;
  tagline?: string;
  genre: string[];
  location?: string;
  biography?: string;
  oneLineBio?: string;
  shortBio?: string;
  artistQuote?: string;
  achievements: string[];
  factSheet: { label: string; value: string }[];
  influences?: string[];
  notableMoments?: string[];
  profileImage?: string;
  coverImage?: string;
  referenceImage?: string;
  pressPhotos: { url: string; caption: string; source?: string }[];
  gallery?: string[];
  tracks?: EPKTrack[];
  videos?: EPKVideo[];
  mainSong?: { name: string; url: string };
  mainVideo?: { title: string; url: string };
  socialLinks: {
    spotify?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    youtube?: string;
    website?: string;
  };
  boostifyLinks?: {
    profile?: string;
    epk?: string;
  };
  contacts?: { label: string; name?: string; email?: string; phone?: string }[];
  pressRelease?: string;
}

interface EPKGeneratorProps {
  artistId?: string | number;
}

// ─── MusicWidget ──────────────────────────────────────────────────────────────
function MusicWidget({ tracks, mainSong }: { tracks?: EPKTrack[]; mainSong?: { name: string; url: string } }) {
  const hasTracks = tracks && tracks.length > 0;
  const hasMain = !hasTracks && !!mainSong;
  if (!hasTracks && !hasMain) {
    return (
      <div className="flex flex-col items-center py-12 text-center text-white/40 gap-3">
        <Music className="w-10 h-10 opacity-30" />
        <p className="text-sm">No hay tracks disponibles aún</p>
        <p className="text-xs">Sube música a tu perfil para verla aquí</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-white/50 text-xs uppercase tracking-wider mb-4">
        {hasTracks ? `${tracks!.length} ${tracks!.length === 1 ? 'track' : 'tracks'}` : 'Featured track'}
      </p>
      {hasTracks && tracks!.map((t, i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="flex items-center gap-4 p-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 shrink-0 overflow-hidden flex items-center justify-center">
              {t.coverArt
                ? <img src={t.coverArt} alt={t.title} className="w-full h-full object-cover" />
                : <Music className="w-6 h-6 text-white/30" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-white font-semibold text-sm truncate">{t.title}</p>
                {t.isFeatured && <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full">SINGLE</span>}
              </div>
              <p className="text-white/40 text-xs mt-0.5">
                {[t.genre, t.duration, t.plays != null && t.plays > 0 ? `${t.plays >= 1000 ? `${(t.plays / 1000).toFixed(1)}K` : t.plays} plays` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="px-4 pb-4">
            <audio controls preload="none" src={t.audioUrl} className="w-full h-10" style={{ colorScheme: 'dark' }} />
          </div>
        </div>
      ))}
      {hasMain && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <Music className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-white font-semibold text-sm">{mainSong!.name}</p>
          </div>
          <audio controls preload="none" src={mainSong!.url} className="w-full h-10" style={{ colorScheme: 'dark' }} />
        </div>
      )}
    </div>
  );
}

// ─── VideosSection ────────────────────────────────────────────────────────────
function VideosSection({ videos, mainVideo }: { videos?: EPKVideo[]; mainVideo?: { title: string; url: string } }) {
  const all: EPKVideo[] = [
    ...(videos || []),
    ...(!videos?.length && mainVideo ? [{ title: mainVideo.title, url: mainVideo.url }] : []),
  ];
  if (!all.length) {
    return (
      <div className="flex flex-col items-center py-12 text-center text-white/40 gap-3">
        <Video className="w-10 h-10 opacity-30" />
        <p className="text-sm">No hay videos disponibles aún</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-white/50 text-xs uppercase tracking-wider mb-4">
        {all.length} {all.length === 1 ? 'video' : 'videos'}
      </p>
      {all.map((v, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-white/10 bg-black">
          <video
            controls preload="none" src={v.url}
            poster={v.thumbnail && /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(v.thumbnail) ? v.thumbnail : undefined}
            className="w-full max-h-[60vh] bg-black"
            {...(v.isLoop ? { loop: true, muted: true, playsInline: true } as any : {})}
          />
          <div className="px-4 py-3 bg-white/[0.03]">
            <p className="text-white font-medium text-sm">{v.title}</p>
            {v.description && <p className="text-white/40 text-xs mt-1">{v.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── GallerySection ───────────────────────────────────────────────────────────
function GallerySection({
  pressPhotos, gallery, onOpen,
}: {
  pressPhotos?: { url: string; caption: string }[];
  gallery?: string[];
  onOpen: (imgs: string[], idx: number) => void;
}) {
  const photos = (pressPhotos || []).filter(p => !!p.url);
  const extra = (gallery || []).filter(u => !!u);
  const allUrls = [...photos.map(p => p.url), ...extra];
  if (!allUrls.length) {
    return (
      <div className="flex flex-col items-center py-12 text-center text-white/40 gap-3">
        <ImageIcon className="w-10 h-10 opacity-30" />
        <p className="text-sm">No hay imágenes en la galería</p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {photos.length > 0 && (
        <div className="space-y-3">
          <p className="text-white/50 text-xs uppercase tracking-wider">Fotos de Prensa</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((p, i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-xl overflow-hidden cursor-pointer group relative border border-white/10"
                onClick={() => onOpen(allUrls, i)}
              >
                <img src={p.url} alt={p.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <span className="text-white text-xs">{p.caption}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {extra.length > 0 && (
        <div className="space-y-3">
          <p className="text-white/50 text-xs uppercase tracking-wider">Galería</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {extra.map((url, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl overflow-hidden cursor-pointer group border border-white/10"
                onClick={() => onOpen(allUrls, photos.length + i)}
              >
                <img src={url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ShareSection ─────────────────────────────────────────────────────────────
function ShareSection({ epk, epkUrl }: { epk: EPKData; epkUrl: string }) {
  const { toast } = useToast();
  const cover = epk.coverImage || epk.profileImage || epk.pressPhotos?.[0]?.url || '';
  const copyLink = async () => {
    if (!epkUrl) return;
    try { await navigator.clipboard.writeText(epkUrl); }
    catch { const el = document.createElement('textarea'); el.value = epkUrl; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); }
    toast({ title: '✓ Link copiado al portapapeles' });
  };
  const SHARES = [
    { label: 'Copiar Link', sub: 'Para cualquier canal', color: 'border-white/15 bg-white/5 hover:bg-white/10', iconBg: 'bg-white/10', icon: <Link className="w-5 h-5 text-white/60" />, action: copyLink },
    { label: 'Compartir en Facebook', sub: 'Con imagen de portada', color: 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20', iconBg: 'bg-blue-600/30', icon: <span className="text-blue-300 font-black text-xl leading-none">f</span>, action: () => epkUrl && window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(epkUrl)}`, '_blank', 'width=600,height=460') },
    { label: 'Compartir en X / Twitter', sub: 'Con link al EPK', color: 'border-white/15 bg-white/5 hover:bg-white/10', iconBg: 'bg-black/50 border border-white/20', icon: <span className="text-white font-black text-sm leading-none">𝕏</span>, action: () => epkUrl && window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${epk.artistName}'s Electronic Press Kit 🎵`)}&url=${encodeURIComponent(epkUrl)}`, '_blank', 'width=600,height=400') },
    { label: 'Compartir por WhatsApp', sub: 'Enviar link directo', color: 'border-green-500/30 bg-green-500/10 hover:bg-green-500/20', iconBg: 'bg-green-600/30', icon: <span className="text-green-300 font-bold text-lg leading-none">W</span>, action: () => epkUrl && window.open(`https://wa.me/?text=${encodeURIComponent(`${epk.artistName} – Electronic Press Kit 🎵 ${epkUrl}`)}`, '_blank') },
  ];
  return (
    <div className="space-y-6">
      {/* Facebook post mockup */}
      <div className="space-y-3">
        <p className="text-white font-semibold text-sm flex items-center gap-2">
          <Share2 className="w-4 h-4 text-orange-400" /> Vista previa al compartir
        </p>
        <p className="text-white/40 text-xs">Así se verá en Facebook y otras redes al compartir el EPK</p>
        <div className="rounded-2xl overflow-hidden border border-white/15 max-w-xs">
          <div className="bg-[#18191a] px-3 py-2.5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black shrink-0">f</div>
            <div>
              <p className="text-[#e4e6eb] text-xs font-semibold">{epk.artistName}</p>
              <p className="text-[#b0b3b8] text-[10px]">Compartió un enlace · boostifymusic.com</p>
            </div>
          </div>
          {cover && (
            <div className="aspect-video bg-[#3a3b3c] overflow-hidden">
              <img src={cover} alt={epk.artistName} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="bg-[#3a3b3c] px-3 py-2.5 border-t border-[#3e4042]">
            <p className="text-[#e4e6eb] text-xs font-semibold">{epk.artistName} — Electronic Press Kit</p>
            <p className="text-[#b0b3b8] text-[10px] mt-0.5 line-clamp-2">
              {epk.oneLineBio || epk.shortBio || `Official EPK · ${(epk.genre || []).join(', ')}`}
            </p>
          </div>
        </div>
      </div>
      {/* Share buttons */}
      <div className="space-y-3">
        <p className="text-white font-semibold text-sm">Compartir EPK</p>
        {!epkUrl && <p className="text-white/40 text-xs bg-white/5 border border-white/10 rounded-xl p-3">Genera el EPK primero para obtener el link de compartir</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {SHARES.map((s, i) => (
            <button key={i} onClick={s.action} disabled={!epkUrl} className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-colors disabled:opacity-40 ${s.color}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg}`}>{s.icon}</div>
              <div>
                <p className="text-white font-medium text-sm">{s.label}</p>
                <p className="text-white/40 text-xs">{s.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      {/* Social links */}
      {Object.values(epk.socialLinks || {}).some(Boolean) && (
        <div className="space-y-3">
          <p className="text-white font-semibold text-sm">Links del Artista</p>
          <div className="flex flex-wrap gap-2">
            {epk.socialLinks?.spotify && <a href={epk.socialLinks.spotify} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 text-green-400 text-xs px-3 py-2 rounded-full hover:bg-green-500/25 transition-colors">Spotify</a>}
            {epk.socialLinks?.instagram && <a href={epk.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-pink-500/15 border border-pink-500/30 text-pink-400 text-xs px-3 py-2 rounded-full hover:bg-pink-500/25 transition-colors"><Instagram className="w-3 h-3" /> Instagram</a>}
            {epk.socialLinks?.youtube && <a href={epk.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-full hover:bg-red-500/25 transition-colors"><Youtube className="w-3 h-3" /> YouTube</a>}
            {epk.socialLinks?.tiktok && <a href={epk.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-slate-500/15 border border-slate-500/30 text-slate-300 text-xs px-3 py-2 rounded-full hover:bg-slate-500/25 transition-colors">TikTok</a>}
            {epk.socialLinks?.facebook && <a href={epk.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs px-3 py-2 rounded-full hover:bg-blue-500/25 transition-colors">Facebook</a>}
            {epk.socialLinks?.website && <a href={epk.socialLinks.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/70 text-xs px-3 py-2 rounded-full hover:bg-white/15 transition-colors"><Globe className="w-3 h-3" /> Website</a>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function EPKGenerator({ artistId }: EPKGeneratorProps) {
  const { toast } = useToast();
  const [generatedEPK, setGeneratedEPK] = useState<EPKData | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Load saved EPK on mount
  const { data: savedEPKRes } = useQuery<{ success: boolean; epk?: EPKData } | null>({
    queryKey: ['/api/epk/by-artist', artistId],
    queryFn: async () => {
      if (!artistId) return null;
      return apiRequest('GET', `/api/epk/by-artist/${artistId}`) as any;
    },
    enabled: !!artistId,
    staleTime: 30_000,
    retry: false,
  });

  const epk: EPKData | null = generatedEPK || (savedEPKRes?.success ? (savedEPKRes.epk ?? null) : null);
  const epkUrl = epk?.boostifyLinks?.epk || '';

  const generateEPKMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/epk/generate', { artistId: artistId ? String(artistId) : undefined });
      return response as any;
    },
    onSuccess: (data: any) => {
      if (data?.success && data?.epk) {
        setGeneratedEPK(data.epk);
        toast({ title: '✨ EPK generado exitosamente', description: 'Tu Electronic Press Kit profesional está listo' });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Error al generar EPK', variant: 'destructive' });
    },
  });

  const handleDownloadJSON = () => {
    if (!epk) return;
    const blob = new Blob([JSON.stringify(epk, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${epk.artistName}-EPK.json`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'EPK descargado', description: 'Archivo JSON guardado exitosamente' });
  };

  const openLightbox = (imgs: string[], idx: number) => { setLightboxImages(imgs); setLightboxIndex(idx); };
  const closeLightbox = () => setLightboxImages([]);

  // Lightbox overlay
  if (lightboxImages.length > 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={closeLightbox}>
        <button className="absolute top-4 right-4 text-white/60 hover:text-white z-10" onClick={closeLightbox}>
          <X className="w-8 h-8" />
        </button>
        {lightboxIndex > 0 && (
          <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white z-10" onClick={e => { e.stopPropagation(); setLightboxIndex(i => i - 1); }}>
            <ChevronLeft className="w-10 h-10" />
          </button>
        )}
        <img src={lightboxImages[lightboxIndex]} className="max-h-[90vh] max-w-[90vw] object-contain" onClick={e => e.stopPropagation()} />
        {lightboxIndex < lightboxImages.length - 1 && (
          <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white z-10" onClick={e => { e.stopPropagation(); setLightboxIndex(i => i + 1); }}>
            <ChevronRight className="w-10 h-10" />
          </button>
        )}
        <div className="absolute bottom-4 text-white/40 text-xs">{lightboxIndex + 1} / {lightboxImages.length}</div>
      </div>
    );
  }

  const cover = epk?.coverImage || epk?.profileImage || epk?.pressPhotos?.[0]?.url || '';
  const hasVideo = !!(epk?.videos?.length || epk?.mainVideo);
  const hasGallery = !!(epk?.pressPhotos?.length || epk?.gallery?.length);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-400" />
            Electronic Press Kit
          </h2>
          <p className="text-white/50 text-sm mt-0.5">
            {epk ? `${epk.artistName} · EPK profesional con IA` : 'Genera tu EPK profesional con IA'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          {epk && (
            <button onClick={handleDownloadJSON} className="flex items-center gap-1.5 border border-white/20 bg-white/5 hover:bg-white/10 text-white/70 text-xs px-3 py-2 rounded-xl transition-colors">
              <Download className="w-3.5 h-3.5" /> JSON
            </button>
          )}
          {epkUrl && (
            <a href={epkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 border border-white/20 bg-white/5 hover:bg-white/10 text-white/70 text-xs px-3 py-2 rounded-xl transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> Ver EPK
            </a>
          )}
          <button
            onClick={() => generateEPKMutation.mutate()}
            disabled={generateEPKMutation.isPending}
            className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            {generateEPKMutation.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generando...</>
              : <><Sparkles className="w-3.5 h-3.5" />{epk ? 'Regenerar EPK' : 'Generar EPK'}</>}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {generateEPKMutation.isPending && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5 space-y-3">
          <p className="text-orange-300 font-medium text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Generando EPK profesional con IA…
          </p>
          <ul className="text-xs text-white/40 space-y-1.5 ml-1">
            <li>• Analizando perfil y Master JSON del artista</li>
            <li>• Generando bio, press release y fact sheet con IA</li>
            <li>• Cargando tracks, videos y galería de imágenes</li>
            <li>• Preparando contenido listo para compartir</li>
          </ul>
        </div>
      )}

      {/* Empty state */}
      {!epk && !generateEPKMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <FileText className="w-8 h-8 text-orange-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base mb-1">No hay EPK generado</h3>
            <p className="text-white/40 text-sm max-w-sm mx-auto leading-relaxed">
              Genera un Electronic Press Kit completo con música, videos, galería y contenido optimizado para compartir en redes.
            </p>
          </div>
          <button
            onClick={() => generateEPKMutation.mutate()}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold px-6 py-3 rounded-2xl transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Generar EPK Profesional
          </button>
          <div className="flex flex-wrap gap-3 justify-center text-xs text-white/30 mt-2">
            {['🎵 Widget de música', '🎬 Videos', '🖼️ Galería', '📄 Press Release', '📊 Fact Sheet', '🔗 Share links'].map(s => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* EPK Content */}
      {epk && !generateEPKMutation.isPending && (
        <div className="space-y-4">
          {/* Hero */}
          <div className="relative rounded-2xl overflow-hidden min-h-[300px] flex items-end">
            <div className="absolute inset-0">
              {cover
                ? <img src={cover} alt="" className="w-full h-full object-cover opacity-50" />
                : <div className="w-full h-full bg-gradient-to-br from-orange-900/40 via-purple-900/30 to-black" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            </div>
            <div className="relative p-6 sm:p-8 flex gap-5 items-end w-full">
              {epk.profileImage && (
                <img src={epk.profileImage} alt={epk.artistName} className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-white/20 shrink-0 hidden sm:block" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-orange-400 text-[10px] font-bold tracking-widest uppercase mb-2">Electronic Press Kit</p>
                <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-2 truncate">{epk.artistName}</h1>
                {epk.tagline && <p className="text-white/80 text-base sm:text-lg mb-2">{epk.tagline}</p>}
                {epk.oneLineBio && <p className="text-white/50 text-sm max-w-lg line-clamp-2">{epk.oneLineBio}</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {(epk.genre || []).map((g, i) => (
                    <span key={i} className="bg-white/15 backdrop-blur text-white text-xs px-3 py-1 rounded-full">{g}</span>
                  ))}
                  {epk.location && <span className="bg-white/15 backdrop-blur text-white text-xs px-3 py-1 rounded-full">📍 {epk.location}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="bio">
            <ScrollArea type="scroll" className="w-full">
              <TabsList className="w-max flex gap-1 bg-white/5 p-1 rounded-xl">
                {([
                  { value: 'bio', label: 'Bio & Press', Icon: FileText },
                  { value: 'music', label: 'Music', Icon: Music },
                  ...(hasVideo ? [{ value: 'video', label: 'Videos', Icon: Video }] : []),
                  ...(hasGallery ? [{ value: 'gallery', label: 'Galería', Icon: ImageIcon }] : []),
                  { value: 'share', label: 'Compartir', Icon: Share2 },
                ] as { value: string; label: string; Icon: React.ElementType }[]).map(({ value, label, Icon }) => (
                  <TabsTrigger key={value} value={value} className="flex items-center gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
                    <Icon className="w-3 h-3" /> {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>

            <div className="mt-6">
              {/* BIO & PRESS */}
              <TabsContent value="bio" className="space-y-6 mt-0">
                {epk.artistQuote && (
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                    <Quote className="w-5 h-5 text-orange-400 mb-3" />
                    <p className="text-white/90 text-lg sm:text-xl italic leading-relaxed">"{epk.artistQuote}"</p>
                    <p className="text-white/40 text-sm mt-3">— {epk.artistName}</p>
                  </div>
                )}
                {epk.pressRelease && (
                  <div className="space-y-3">
                    <p className="text-white font-semibold flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-orange-400" /> Press Release
                    </p>
                    {epk.pressRelease.split(/\n\n+/).map((para, i) => (
                      <p key={i} className="text-white/70 text-sm leading-relaxed">{para}</p>
                    ))}
                  </div>
                )}
                {(epk.factSheet || []).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-white font-semibold">Fact Sheet</p>
                    <div className="grid grid-cols-2 gap-2">
                      {epk.factSheet.map((f, i) => (
                        <div key={i} className="bg-white/5 border border-white/[0.08] rounded-xl p-3">
                          <p className="text-white/40 text-[10px] uppercase tracking-wider">{f.label}</p>
                          <p className="text-white text-sm font-medium mt-0.5">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(epk.achievements || []).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-white font-semibold flex items-center gap-2">
                      <Award className="w-4 h-4 text-orange-400" /> Highlights & Logros
                    </p>
                    <div className="grid gap-2">
                      {epk.achievements.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/[0.08] rounded-xl p-3">
                          <span className="text-orange-400 font-bold text-xs shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                          <span className="text-white/80 text-sm">{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(epk.influences || []).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-white font-semibold">Influencias</p>
                    <div className="flex flex-wrap gap-2">
                      {epk.influences!.map((inf, i) => (
                        <span key={i} className="bg-white/[0.08] border border-white/15 text-white/60 text-xs px-3 py-1.5 rounded-full">{inf}</span>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* MÚSICA */}
              <TabsContent value="music" className="mt-0">
                <MusicWidget tracks={epk.tracks} mainSong={epk.mainSong} />
              </TabsContent>

              {/* VIDEOS */}
              <TabsContent value="video" className="mt-0">
                <VideosSection videos={epk.videos} mainVideo={epk.mainVideo} />
              </TabsContent>

              {/* GALERÍA */}
              <TabsContent value="gallery" className="mt-0">
                <GallerySection pressPhotos={epk.pressPhotos} gallery={epk.gallery} onOpen={openLightbox} />
              </TabsContent>

              {/* COMPARTIR */}
              <TabsContent value="share" className="mt-0">
                <ShareSection epk={epk} epkUrl={epkUrl} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
}
