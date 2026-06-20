import { Music, ShoppingBag, Play, Pause, Video, Calendar, Share2, MapPin, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import type { ArtistProfile, Song, Merchandise } from "../../pages/artist-profile";
import { InfluencerModule } from "./influencer-module";
import { ArtistNewsGenerator } from "./artist-news-generator";
import { formatLocation } from "../../lib/formatLocation";

interface ArtistProfileViewProps {
  profile: ArtistProfile;
  songs: Song[];
  merchandise: Merchandise[];
  isOwner: boolean;
}

// Paleta de colores (definida inline para este componente)
const colorPalettes = {
  'Boostify Naranja': {
    hexAccent: '#F97316',
    hexPrimary: '#FF8800',
    hexBorder: '#5E2B0C',
    textMuted: 'gray-400',
    bgGradient: "bg-gradient-to-br from-black via-gray-950 to-orange-950",
    shadow: 'shadow-orange-900/10',
  },
  'Clásico Azul': {
    hexAccent: '#3B82F6',
    hexPrimary: '#2563EB',
    hexBorder: '#1E40AF',
    textMuted: 'slate-400',
    bgGradient: "bg-gradient-to-br from-black via-slate-950 to-blue-950",
    shadow: 'shadow-blue-900/10',
  },
  'Neon Verde': {
    hexAccent: '#A3E635',
    hexPrimary: '#84CC16',
    hexBorder: '#4D7C0F',
    textMuted: 'gray-400',
    bgGradient: "bg-gradient-to-br from-black via-gray-950 to-green-950",
    shadow: 'shadow-lime-900/10',
  },
  'Cyber Morado': {
    hexAccent: '#F472B6',
    hexPrimary: '#8B5CF6',
    hexBorder: '#6D28D9',
    textMuted: 'violet-300',
    bgGradient: "bg-gradient-to-br from-black via-gray-950 to-violet-950",
    shadow: 'shadow-violet-900/10',
  },
  'Tierra Suave': {
    hexAccent: '#FBBF24',
    hexPrimary: '#D97706',
    hexBorder: '#78350F',
    textMuted: 'stone-400',
    bgGradient: "bg-gradient-to-br from-black via-stone-900 to-amber-950",
    shadow: 'shadow-amber-900/10',
  }
};

export function ArtistProfileView({
  profile,
  songs,
  merchandise,
  isOwner
}: ArtistProfileViewProps) {
  const [playingSongId, setPlayingSongId] = useState<number | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof colorPalettes>('Boostify Naranja');
  const [merchFilter, setMerchFilter] = useState('Todo');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [, setLocation] = useLocation();

  const colors = colorPalettes[selectedTheme];

  const handlePlayPause = (song: Song) => {
    if (playingSongId === song.id) {
      audioRef.current?.pause();
      setPlayingSongId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = song.audioUrl;
        audioRef.current.play();
      }
      setPlayingSongId(song.id);
    }
  };

  const coverImage = profile.coverImage || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=400&fit=crop';
  const profileImage = profile.profileImage || '/assets/default-avatar.png';
  const artistName = profile.artistName || profile.username || 'Artist';

  // Categorías de merch
  const merchCategories = ['Todo', 'Ropa', 'Música', 'Coleccionables', 'Accesorios'];
  const filteredMerch = merchFilter === 'Todo' 
    ? merchandise 
    : merchandise.filter(item => item.category === merchFilter);

  const cardStyles = `bg-gradient-to-b from-gray-900 to-gray-950 bg-opacity-90 rounded-3xl p-6 shadow-xl ${colors.shadow} transition-colors duration-500`;
  const primaryBtn = `py-2 px-4 rounded-full text-sm font-semibold transition duration-300 shadow-lg whitespace-nowrap`;

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${artistName} - Boostify Music`,
          text: `Check out ${artistName}'s profile on Boostify Music!`,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Profile link copied to clipboard!');
    }
  };

  return (
    <div className={`min-h-screen ${colors.bgGradient} text-white transition-colors duration-500`}>
      <audio ref={audioRef} onEnded={() => setPlayingSongId(null)} />
      
      {/* Hero Header */}
      <header className="relative h-96 lg:h-[450px] w-full mb-8 overflow-hidden">
        <img
          src={coverImage}
          alt={`${artistName} Cover`}
          className="absolute inset-0 w-full h-full object-cover filter brightness-75 transition-all duration-500"
          onError={(e) => { 
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.parentElement) {
              e.currentTarget.parentElement.style.background = 'black';
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
        
        {/* Barra superior */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <div 
              className="w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center font-bold text-sm tracking-widest text-white transition-colors duration-500"
              style={{ backgroundImage: `linear-gradient(to bottom right, ${colors.hexAccent}, ${colors.hexPrimary})` }}
            >
              B
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/80">Boostify Music</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              className="py-2 px-4 rounded-full text-sm font-semibold transition duration-200 bg-black/50 hover:bg-gray-800 backdrop-blur-sm"
              style={{ borderColor: colors.hexBorder, borderWidth: '1px', color: colors.hexAccent }}
              onClick={handleShare}
              data-testid="button-share"
            >
              <Share2 className="h-4 w-4 inline mr-2" />
              Compartir
            </button>
            {isOwner && (
              <button 
                className="py-2 px-4 rounded-full text-sm font-semibold transition duration-200 bg-black/50 hover:bg-gray-800 backdrop-blur-sm"
                style={{ borderColor: colors.hexBorder, borderWidth: '1px', color: colors.hexAccent }}
                onClick={() => setLocation('/dashboard')}
                data-testid="button-dashboard"
              >
                Ir al dashboard
              </button>
            )}
          </div>
        </div>

        {/* Contenido del artista en el hero */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 z-10">
          <div className="text-4xl lg:text-6xl font-extrabold mb-2 text-white drop-shadow-lg" data-testid="text-artist-name">
            {artistName}
          </div>
          <div className="text-lg transition-colors duration-500" style={{ color: colors.hexAccent }}>
            {profile.genre || 'Music Artist'} {formatLocation(profile.location) && `· ${formatLocation(profile.location)}`}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {profile.instagramHandle && (
              <span 
                className="text-xs rounded-full py-1 px-3 bg-black/50 backdrop-blur-sm border transition-colors duration-500"
                style={{ borderColor: colors.hexBorder, color: colors.hexAccent }}
              >
                📸 {profile.instagramHandle}
              </span>
            )}
            {profile.youtubeChannel && (
              <span 
                className="text-xs rounded-full py-1 px-3 bg-black/50 backdrop-blur-sm border transition-colors duration-500"
                style={{ borderColor: colors.hexBorder, color: colors.hexAccent }}
              >
                🎬 YouTube Artist
              </span>
            )}
            {songs.length > 0 && (
              <span 
                className="text-xs rounded-full py-1 px-3 bg-black/50 backdrop-blur-sm border transition-colors duration-500"
                style={{ borderColor: colors.hexBorder, color: colors.hexAccent }}
              >
                🎵 {songs.length} {songs.length === 1 ? 'Song' : 'Songs'}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-8 pt-0 pb-20 md:pb-8">
        
        {/* Selector de Paleta y Estilo */}
        <div 
          className="mb-6 p-4 rounded-xl bg-gray-900/80 backdrop-blur-sm flex flex-col md:flex-row justify-between items-center gap-4 transition-colors duration-500"
          style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}
        >
          <label htmlFor="theme-selector" className="text-sm font-medium text-white whitespace-nowrap">
            Personaliza tu Estilo:
          </label>
          <div className="flex-1 w-full max-w-sm">
            <select
              id="theme-selector"
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value as keyof typeof colorPalettes)}
              className="block w-full py-2 px-3 text-sm rounded-full border bg-black text-white focus:ring-4 appearance-none cursor-pointer transition-colors duration-500"
              style={{ borderColor: colors.hexBorder }}
            >
              {Object.keys(colorPalettes).map(themeName => (
                <option key={themeName} value={themeName}>
                  {themeName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Layout */}
        <main className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
          {/* Columna Izquierda */}
          <section className="flex flex-col gap-6">
            
            {/* Tarjeta de Información de Artista */}
            <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="relative">
                  <img
                    src={profileImage}
                    alt={`${artistName} Avatar`}
                    className="w-44 h-44 rounded-3xl object-cover shadow-xl transition-colors duration-500"
                    style={{ borderColor: colors.hexBorder, borderWidth: '1px', boxShadow: `0 4px 10px ${colors.hexAccent}50` }}
                    data-testid="img-profile"
                  />
                  <div className="absolute -right-1 -bottom-1 py-1 px-2.5 text-xs rounded-full bg-green-500 text-green-950 font-semibold shadow-xl shadow-green-500/50">
                    Verificado
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-3xl font-semibold text-white">{artistName}</div>
                  {profile.slug && (
                    <div 
                      className="text-sm mt-1 transition-colors duration-500" 
                      style={{ color: colors.hexAccent }}
                      data-testid="text-slug"
                    >
                      @{profile.slug}
                    </div>
                  )}
                  <div className={`text-sm text-gray-400 mt-2 transition-colors duration-500`}>
                    {profile.biography || 'Music artist on Boostify Music'}
                  </div>
                  
                  <div className="flex flex-wrap gap-3 mt-4">
                    {profile.website && (
                      <a 
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${primaryBtn} text-white hover:opacity-80`}
                        style={{ backgroundColor: colors.hexPrimary }}
                        data-testid="button-website"
                      >
                        <ExternalLink className="h-4 w-4 inline mr-2" />
                        Website
                      </a>
                    )}
                    <button 
                      className={`${primaryBtn} bg-black hover:bg-gray-800`}
                      style={{ borderColor: colors.hexBorder, borderWidth: '1px', color: colors.hexAccent }}
                      onClick={handleShare}
                      data-testid="button-share-profile"
                    >
                      Compartir perfil
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjeta de Songs/Tracks */}
            <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
              <div className="flex justify-between items-center mb-4">
                <div 
                  className="text-base font-semibold transition-colors duration-500 flex items-center gap-2" 
                  style={{ color: colors.hexAccent }}
                >
                  <Music className="h-5 w-5" />
                  Music Tracks {songs.length > 0 && `(${songs.length})`}
                </div>
              </div>
              
              {songs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">
                    {isOwner ? "You haven't uploaded any songs yet." : "No songs available yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {songs.filter(s => s.isPublished).map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-4 p-3 rounded-xl bg-black/50 hover:bg-gray-900/50 transition-all duration-200 border"
                      style={{ borderColor: colors.hexBorder }}
                      data-testid={`card-song-${song.id}`}
                    >
                      <div className="flex-shrink-0">
                        {song.coverArt ? (
                          <img
                            src={song.coverArt}
                            alt={song.title}
                            className="w-14 h-14 rounded-lg object-cover"
                            data-testid={`img-song-cover-${song.id}`}
                          />
                        ) : (
                          <div 
                            className="w-14 h-14 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${colors.hexPrimary}33` }}
                          >
                            <Music className="h-6 w-6" style={{ color: colors.hexAccent }} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate text-white" data-testid={`text-song-title-${song.id}`}>
                          {song.title}
                        </h3>
                        {song.description && (
                          <p className="text-sm text-gray-400 line-clamp-1">
                            {song.description}
                          </p>
                        )}
                        <div className="flex gap-2 mt-1">
                          {song.genre && (
                            <span 
                              className="text-xs py-0.5 px-2 rounded-full"
                              style={{ backgroundColor: `${colors.hexPrimary}33`, color: colors.hexAccent }}
                            >
                              {song.genre}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {song.plays} plays
                          </span>
                        </div>
                      </div>
                      <button
                        className="py-2 px-4 rounded-full text-sm font-medium transition duration-300"
                        style={{ 
                          backgroundColor: playingSongId === song.id ? colors.hexPrimary : 'transparent',
                          borderColor: colors.hexBorder,
                          borderWidth: '1px',
                          color: playingSongId === song.id ? 'white' : colors.hexAccent
                        }}
                        onClick={() => handlePlayPause(song)}
                        data-testid={`button-play-${song.id}`}
                      >
                        {playingSongId === song.id ? (
                          <>
                            <Pause className="h-4 w-4 inline mr-1" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 inline mr-1" />
                            Play
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tarjeta de Videos */}
            {profile.videos && profile.videos.length > 0 && (
              <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                <div className="flex justify-between items-center mb-4">
                  <div 
                    className="text-base font-semibold transition-colors duration-500 flex items-center gap-2" 
                    style={{ color: colors.hexAccent }}
                  >
                    <Video className="h-5 w-5" />
                    Music Videos ({profile.videos.length})
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profile.videos.map((video: any, index: number) => (
                    <div
                      key={index}
                      className="rounded-xl overflow-hidden bg-black/50 hover:bg-gray-900/50 transition-all duration-200 border cursor-pointer"
                      style={{ borderColor: colors.hexBorder }}
                      data-testid={`card-video-${index}`}
                    >
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-40 object-cover"
                        />
                      ) : (
                        <div 
                          className="w-full h-40 flex items-center justify-center"
                          style={{ backgroundColor: `${colors.hexPrimary}33` }}
                        >
                          <Video className="h-12 w-12" style={{ color: colors.hexAccent }} />
                        </div>
                      )}
                      <div className="p-3">
                        <h3 className="font-medium text-white text-sm">{video.title || 'Music Video'}</h3>
                        <p className="text-xs text-gray-400 mt-1">Powered by Boostify</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tarjeta de Merchandising */}
            {merchandise.length > 0 && (
              <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                <div className="flex justify-between items-center mb-2">
                  <div 
                    className="text-base font-semibold transition-colors duration-500 flex items-center gap-2" 
                    style={{ color: colors.hexAccent }}
                  >
                    <ShoppingBag className="h-5 w-5" />
                    Tienda Oficial (Merch)
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-3 transition-colors duration-500">
                  Productos exclusivos y ediciones limitadas.
                </p>
                
                {/* Filtros de Merchandising */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {merchCategories.map(category => (
                    <button 
                      key={category}
                      className="py-1 px-3 rounded-full text-xs font-medium transition duration-300 cursor-pointer whitespace-nowrap border"
                      style={merchFilter === category 
                        ? { backgroundColor: colors.hexPrimary, borderColor: colors.hexPrimary, color: 'white' } 
                        : { borderColor: colors.hexBorder, color: colors.hexAccent, backgroundColor: 'transparent' }
                      }
                      onClick={() => setMerchFilter(category)}
                      data-testid={`button-filter-${category}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {/* Grid de productos */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {filteredMerch.filter(m => m.isAvailable).map((item) => (
                    <div 
                      key={item.id} 
                      className="flex flex-col p-2 rounded-xl bg-black/50 hover:bg-gray-900/50 transition duration-200 cursor-pointer border"
                      style={{ borderColor: colors.hexBorder }}
                      data-testid={`card-merch-${item.id}`}
                    >
                      {item.images.length > 0 ? (
                        <img
                          src={item.images[0]}
                          alt={item.name}
                          className="w-full h-24 object-cover rounded-lg mb-2"
                          data-testid={`img-merch-${item.id}`}
                        />
                      ) : (
                        <div 
                          className="w-full h-24 flex items-center justify-center rounded-lg mb-2"
                          style={{ backgroundColor: `${colors.hexPrimary}33` }}
                        >
                          <ShoppingBag className="h-8 w-8" style={{ color: colors.hexAccent }} />
                        </div>
                      )}
                      <div className="text-sm font-medium truncate text-white" data-testid={`text-merch-name-${item.id}`}>
                        {item.name}
                      </div>
                      <div 
                        className="text-xs font-semibold mt-0.5 transition-colors duration-500"
                        style={{ color: colors.hexAccent }}
                        data-testid={`text-merch-price-${item.id}`}
                      >
                        ${item.price}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Influencer Content Module */}
          {(profile as any).id && (
            <InfluencerModule
              userId={(profile as any).id}
              artistName={artistName}
              isOwner={isOwner}
              colors={colors}
            />
          )}

          {/* AI Artist News Generator */}
          {(profile as any).id && (
            <ArtistNewsGenerator
              userId={(profile as any).id}
              artistName={artistName}
              isOwner={isOwner}
              colors={colors}
            />
          )}

          </section>

          {/* Columna Derecha */}
          <section className="flex flex-col gap-6">
            
            {/* Tarjeta de Estadísticas */}
            <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
              <div 
                className="text-base font-semibold mb-4 transition-colors duration-500" 
                style={{ color: colors.hexAccent }}
              >
                Profile Statistics
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total Canciones</span>
                  <span className="text-xl font-bold text-white">{songs.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total Reproducciones</span>
                  <span className="text-xl font-bold text-white">
                    {songs.reduce((acc, song) => acc + song.plays, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Productos en Tienda</span>
                  <span className="text-xl font-bold text-white">{merchandise.length}</span>
                </div>
              </div>
            </div>

            {/* Tarjeta de Biografía */}
            {profile.biography && (
              <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                <div 
                  className="text-base font-semibold mb-3 transition-colors duration-500" 
                  style={{ color: colors.hexAccent }}
                >
                  Biografía del artista
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {profile.biography}
                </p>
              </div>
            )}

            {/* Tarjeta de Información de Contacto */}
            <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
              <div 
                className="text-base font-semibold mb-3 transition-colors duration-500" 
                style={{ color: colors.hexAccent }}
              >
                Información
              </div>
              <div className="space-y-3">
                {profile.genre && (
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4" style={{ color: colors.hexAccent }} />
                    <span className="text-sm text-gray-300">{profile.genre}</span>
                  </div>
                )}
                {formatLocation(profile.location) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" style={{ color: colors.hexAccent }} />
                    <span className="text-sm text-gray-300">{formatLocation(profile.location)}</span>
                  </div>
                )}
                {profile.website && (
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" style={{ color: colors.hexAccent }} />
                    <a 
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline"
                      style={{ color: colors.hexAccent }}
                    >
                      {profile.website}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Tarjeta de Redes Sociales */}
            {(profile.instagramHandle || profile.twitterHandle || profile.youtubeChannel) && (
              <div className={cardStyles} style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}>
                <div 
                  className="text-base font-semibold mb-3 transition-colors duration-500" 
                  style={{ color: colors.hexAccent }}
                >
                  Redes Sociales
                </div>
                <div className="space-y-2">
                  {profile.instagramHandle && (
                    <a 
                      href={`https://instagram.com/${profile.instagramHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 transition-colors"
                      style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}
                    >
                      <span className="text-sm">📸 Instagram</span>
                      <span className="text-sm ml-auto" style={{ color: colors.hexAccent }}>
                        @{profile.instagramHandle}
                      </span>
                    </a>
                  )}
                  {profile.twitterHandle && (
                    <a 
                      href={`https://twitter.com/${profile.twitterHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 transition-colors"
                      style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}
                    >
                      <span className="text-sm">𝕏 Twitter</span>
                      <span className="text-sm ml-auto" style={{ color: colors.hexAccent }}>
                        @{profile.twitterHandle}
                      </span>
                    </a>
                  )}
                  {profile.youtubeChannel && (
                    <a 
                      href={profile.youtubeChannel}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 transition-colors"
                      style={{ borderColor: colors.hexBorder, borderWidth: '1px' }}
                    >
                      <span className="text-sm">▶️ YouTube</span>
                      <span className="text-sm ml-auto" style={{ color: colors.hexAccent }}>
                        Ver canal
                      </span>
                    </a>
                  )}
                </div>
              </div>
            )}

          </section>
        </main>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t" style={{ borderColor: colors.hexBorder }}>
          <div className="text-center">
            <p className="text-sm text-gray-400">
              Powered by <span style={{ color: colors.hexAccent }} className="font-semibold">Boostify Music</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              © {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}
