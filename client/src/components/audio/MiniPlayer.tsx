/**
 * Global Mini Player — sticky bottom bar shown whenever a track is loaded.
 * Mute/unmute, prev/next, play/pause, shuffle, repeat, like, progress,
 * expand-to-NowPlaying, close. Also bridges scrobbles to the backend.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ChevronUp,
  ChevronDown,
  ListMusic,
  Music2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function fmtTime(s: number) {
  if (!Number.isFinite(s) || s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

/** Fullscreen "Now Playing" view: big cover, lyrics and the up-next queue. */
function NowPlaying({
  liked,
  canLike,
  onToggleLike,
  onClose,
}: {
  liked: boolean;
  canLike: boolean;
  onToggleLike: () => void;
  onClose: () => void;
}) {
  const {
    currentTrack,
    queue,
    isPlaying,
    progress,
    duration,
    shuffle,
    repeat,
    toggle,
    next,
    prev,
    seek,
    toggleShuffle,
    cycleRepeat,
    jumpTo,
  } = useAudioPlayer();

  const [tab, setTab] = useState<'lyrics' | 'queue'>('lyrics');

  const songId = currentTrack?.id;
  const { data: lyricsData, isLoading: lyricsLoading } = useQuery<{ lyrics: string | null }>({
    queryKey: ['/api/streaming/songs', songId, 'lyrics'],
    queryFn: () => apiRequest(`/api/streaming/songs/${songId}/lyrics`, { method: 'GET' }),
    enabled: !!songId,
    staleTime: 5 * 60 * 1000,
  });

  if (!currentTrack) return null;
  const idx = queue.findIndex((t) => t.id === currentTrack.id);
  const total = queue.length;
  const lyrics = lyricsData?.lyrics?.trim() || '';

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-gradient-to-b from-neutral-900 via-black to-black text-white">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-white/80 hover:text-white"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
        <div className="text-xs uppercase tracking-widest text-white/50">Reproduciendo</div>
        <div className="w-9" />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* left: cover + controls */}
        <div className="flex flex-col items-center justify-center gap-6 px-6 py-4 lg:w-1/2">
          <div
            className="aspect-square w-full max-w-[340px] rounded-2xl bg-cover bg-center bg-white/5 shadow-2xl ring-1 ring-white/10"
            style={{
              backgroundImage: currentTrack.coverArt ? `url(${currentTrack.coverArt})` : undefined,
            }}
          >
            {!currentTrack.coverArt && (
              <div className="flex h-full w-full items-center justify-center">
                <Music2 className="h-16 w-16 text-white/30" />
              </div>
            )}
          </div>

          <div className="w-full max-w-[340px]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-xl font-bold">{currentTrack.title}</div>
                {currentTrack.sourceHref ? (
                  <Link href={currentTrack.sourceHref}>
                    <span className="truncate text-sm text-white/60 hover:text-white hover:underline">
                      {currentTrack.artist || '—'}
                    </span>
                  </Link>
                ) : (
                  <div className="truncate text-sm text-white/60">{currentTrack.artist || '—'}</div>
                )}
              </div>
              {canLike && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={cn('h-10 w-10', liked ? 'text-orange-500' : 'text-white/70 hover:text-white')}
                  onClick={onToggleLike}
                  aria-label={liked ? 'Quitar de Me gusta' : 'Añadir a Me gusta'}
                >
                  <Heart className={cn('h-6 w-6', liked && 'fill-orange-500')} />
                </Button>
              )}
            </div>

            {/* seek */}
            <div className="mt-4 flex items-center gap-3">
              <span className="w-10 text-right text-[11px] tabular-nums text-white/60">
                {fmtTime(progress)}
              </span>
              <Slider
                value={[progress]}
                min={0}
                max={Math.max(1, duration)}
                step={0.5}
                onValueChange={(v) => seek(v[0] ?? 0)}
                className="flex-1"
              />
              <span className="w-10 text-[11px] tabular-nums text-white/60">{fmtTime(duration)}</span>
            </div>

            {/* controls */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn('h-10 w-10', shuffle ? 'text-orange-500' : 'text-white/70 hover:text-white')}
                onClick={toggleShuffle}
                aria-label="Aleatorio"
              >
                <Shuffle className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-11 w-11 text-white/80 hover:text-white"
                onClick={prev}
                aria-label="Anterior"
              >
                <SkipBack className="h-6 w-6" />
              </Button>
              <Button
                type="button"
                size="icon"
                className="h-14 w-14 rounded-full bg-white text-black hover:bg-white/90"
                onClick={toggle}
                aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-11 w-11 text-white/80 hover:text-white"
                onClick={next}
                aria-label="Siguiente"
              >
                <SkipForward className="h-6 w-6" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn('h-10 w-10', repeat !== 'off' ? 'text-orange-500' : 'text-white/70 hover:text-white')}
                onClick={cycleRepeat}
                aria-label="Repetir"
                title={repeat === 'one' ? 'Repetir una' : repeat === 'all' ? 'Repetir todo' : 'Repetir'}
              >
                {repeat === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* right: tabs lyrics / queue */}
        <div className="flex min-h-0 flex-1 flex-col border-t border-white/10 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setTab('lyrics')}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition',
                tab === 'lyrics' ? 'bg-white text-black' : 'text-white/60 hover:text-white',
              )}
            >
              Letra
            </button>
            <button
              type="button"
              onClick={() => setTab('queue')}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition',
                tab === 'queue' ? 'bg-white text-black' : 'text-white/60 hover:text-white',
              )}
            >
              <ListMusic className="h-4 w-4" /> Cola {total > 0 && `· ${total}`}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 sm:px-6">
            {tab === 'lyrics' ? (
              lyricsLoading ? (
                <p className="text-white/40">Cargando letra…</p>
              ) : lyrics ? (
                <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed text-white/80">
                  {lyrics}
                </pre>
              ) : (
                <p className="text-white/40">No hay letra disponible para esta canción.</p>
              )
            ) : (
              <ul className="space-y-1">
                {queue.map((t, i) => (
                  <li key={`${t.id}-${i}`}>
                    <button
                      type="button"
                      onClick={() => jumpTo(i)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/5',
                        i === idx && 'bg-white/10',
                      )}
                    >
                      <div
                        className="h-10 w-10 flex-shrink-0 rounded bg-cover bg-center bg-white/5"
                        style={{ backgroundImage: t.coverArt ? `url(${t.coverArt})` : undefined }}
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            'truncate text-sm',
                            i === idx ? 'font-semibold text-orange-400' : 'text-white/90',
                          )}
                        >
                          {t.title}
                        </div>
                        <div className="truncate text-xs text-white/50">{t.artist || '—'}</div>
                      </div>
                      {i === idx && isPlaying && <span className="text-xs text-orange-400">♪</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    isMuted,
    progress,
    duration,
    shuffle,
    repeat,
    toggle,
    next,
    prev,
    seek,
    toggleMuted,
    toggleShuffle,
    cycleRepeat,
    stop,
    queue,
  } = useAudioPlayer();

  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  // Bridge scrobbles → backend play counter + listening history.
  useEffect(() => {
    const onScrobble = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { track?: { id?: string | number }; msPlayed?: number }
        | undefined;
      const songId = detail?.track?.id;
      if (songId == null) return;
      apiRequest('/api/streaming/plays', {
        method: 'POST',
        data: { songId, msPlayed: detail?.msPlayed ?? 0, source: 'player' },
      }).catch(() => {
        /* best-effort, ignore */
      });
    };
    window.addEventListener('boostify:scrobble', onScrobble as EventListener);
    return () => window.removeEventListener('boostify:scrobble', onScrobble as EventListener);
  }, []);

  // Liked-songs set (shared cache with the streaming page).
  const { data: likedData } = useQuery<{ ids: number[] }>({
    queryKey: ['/api/streaming/likes/ids'],
    queryFn: () => apiRequest('/api/streaming/likes/ids', { method: 'GET' }),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
  const likedIds = useMemo(() => new Set(likedData?.ids ?? []), [likedData]);

  const likeMutation = useMutation({
    mutationFn: async ({ songId, like }: { songId: number; like: boolean }) =>
      apiRequest(`/api/streaming/likes/${songId}`, { method: like ? 'POST' : 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/streaming/likes/ids'] });
      qc.invalidateQueries({ queryKey: ['/api/streaming/likes'] });
    },
  });

  if (!currentTrack) return null;

  const idx = queue.findIndex((t) => t.id === currentTrack.id);
  const total = queue.length;
  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const songIdNum = Number(currentTrack.id);
  const canLike = isAuthenticated && Number.isFinite(songIdNum);
  const liked = canLike && likedIds.has(songIdNum);
  const toggleLike = () => {
    if (!canLike) return;
    likeMutation.mutate({ songId: songIdNum, like: !liked });
  };

  return (
    <>
      {expanded && (
        <NowPlaying
          liked={!!liked}
          canLike={canLike}
          onToggleLike={toggleLike}
          onClose={() => setExpanded(false)}
        />
      )}

      <div
        className={cn(
          'fixed inset-x-0 z-[60] border-t border-white/10',
          'bg-black/80 backdrop-blur-xl',
          'shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.6)]',
          'transition-[bottom] duration-300',
        )}
        // Sit just above the global BottomNav when it's visible. The nav
        // publishes its current height as `--bottom-nav-height` (0 when
        // hidden). When the nav is absent we still need to clear the iOS
        // home-indicator safe area, so we take whichever is larger.
        style={{ bottom: 'max(var(--bottom-nav-height, 0px), env(safe-area-inset-bottom, 0px))' }}
        role="region"
        aria-label="Audio player"
      >
        {/* progress bar */}
        <div className="absolute -top-px left-0 right-0 h-px bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-4 sm:py-3">
          {/* cover + meta — tap to expand */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="h-10 w-10 flex-shrink-0 rounded-md bg-cover bg-center bg-white/5 ring-1 ring-white/10 transition-transform hover:scale-105 hover:ring-orange-500/60 sm:h-12 sm:w-12"
              style={{
                backgroundImage: currentTrack.coverArt ? `url(${currentTrack.coverArt})` : undefined,
              }}
              aria-label="Abrir reproductor"
              title="Abrir reproductor"
            />
            <button type="button" onClick={() => setExpanded(true)} className="min-w-0 text-left">
              <div className="truncate text-sm font-semibold text-white">{currentTrack.title}</div>
              <div className="truncate text-xs text-white/60">
                {currentTrack.artist || '—'}
                {total > 1 && (
                  <span className="ml-2 text-white/40">
                    · {idx + 1}/{total}
                  </span>
                )}
              </div>
            </button>
            {canLike && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn(
                  'hidden h-9 w-9 sm:inline-flex',
                  liked ? 'text-orange-500' : 'text-white/70 hover:text-white',
                )}
                onClick={toggleLike}
                aria-label={liked ? 'Quitar de Me gusta' : 'Añadir a Me gusta'}
              >
                <Heart className={cn('h-4 w-4', liked && 'fill-orange-500')} />
              </Button>
            )}
          </div>

          {/* controls */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(
                'hidden h-9 w-9 sm:inline-flex',
                shuffle ? 'text-orange-500' : 'text-white/70 hover:text-white',
              )}
              onClick={toggleShuffle}
              aria-label="Aleatorio"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-white/80 hover:text-white"
              onClick={prev}
              aria-label="Anterior"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              className="h-10 w-10 rounded-full bg-white text-black hover:bg-white/90"
              onClick={toggle}
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-white/80 hover:text-white"
              onClick={next}
              disabled={total <= 1 && repeat === 'off' && !shuffle}
              aria-label="Siguiente"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(
                'hidden h-9 w-9 sm:inline-flex',
                repeat !== 'off' ? 'text-orange-500' : 'text-white/70 hover:text-white',
              )}
              onClick={cycleRepeat}
              aria-label="Repetir"
              title={repeat === 'one' ? 'Repetir una' : repeat === 'all' ? 'Repetir todo' : 'Repetir'}
            >
              {repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </Button>
          </div>

          {/* time + seek (desktop) */}
          <div className="hidden flex-1 items-center gap-3 md:flex">
            <span className="w-10 text-right text-[11px] tabular-nums text-white/60">
              {fmtTime(progress)}
            </span>
            <Slider
              value={[progress]}
              min={0}
              max={Math.max(1, duration)}
              step={0.5}
              onValueChange={(v) => seek(v[0] ?? 0)}
              className="flex-1"
            />
            <span className="w-10 text-[11px] tabular-nums text-white/60">{fmtTime(duration)}</span>
          </div>

          {/* expand + mute + close */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-white/70 hover:text-white"
              onClick={() => setExpanded(true)}
              aria-label="Abrir reproductor"
              title="Abrir reproductor"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(
                'h-9 w-9',
                isMuted ? 'text-amber-300 hover:text-amber-200' : 'text-white/80 hover:text-white',
              )}
              onClick={toggleMuted}
              aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
              title={isMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-white/60 hover:text-white"
              onClick={stop}
              aria-label="Cerrar reproductor"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
